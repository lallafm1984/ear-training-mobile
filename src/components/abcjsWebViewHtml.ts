import { ABCJS_SOURCE } from './abcjsSource';

export const WEBVIEW_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no">
<style>
  * {
    margin:0; padding:0; box-sizing:border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html, body {
    background: transparent !important;
    font-family:-apple-system,sans-serif;
    overflow: visible !important;
    /* 수직 스크롤(pan-y)은 브라우저/네이티브에게 위임 */
    touch-action: pan-y !important;
  }

  #score-wrapper {
    width:100%;
    overflow: visible !important;
    touch-action: pan-y !important;
  }

  #score-container {
    display:inline-block;
    padding:10px 0;
    touch-action: pan-y !important;
  }

  #score-container svg {
    display:block;
    overflow: visible !important;
    touch-action: pan-y !important;
  }

  .abcjs-note, .abcjs-rest, .abcjs-staff-extra {
    cursor: pointer;
  }

  /* ── 이음줄(슬러·서로 다른 음)만 숨김 — 붙임줄(타이·같은 음)은 .abcjs-tie 로 표시 유지
       abcjs 6.x: tie=.abcjs-tie / slur(legato)=.abcjs-legato ── */
  .abcjs-legato {
    display: none;
  }

  /* ── 재생 중 시각 피드백 ── */
  .abcjs-cursor {
    stroke: #ef4444;
    stroke-width: 2.5;
    opacity: 0.85;
    pointer-events: none;
  }
  .abcjs-playback-note path,
  .abcjs-playback-note ellipse,
  .abcjs-playback-note polygon,
  .abcjs-playback-note polyline,
  .abcjs-playback-note rect,
  .abcjs-playback-note use {
    fill: #6366f1 !important;
  }
  .abcjs-measure-highlight {
    fill: #6366f1;
    opacity: 0.14;
    pointer-events: none;
  }

  #synth-target { display:none; }
  #controls {
    display:none !important;
  }
  #play-btn {
    display:inline-flex; align-items:center; gap:8px;
    padding:12px 28px; background:#6366f1; border:none; border-radius:12px;
    color:#fff; font-size:16px; font-weight:800; letter-spacing:0.3px;
    box-shadow:0 3px 6px rgba(99,102,241,0.3);
    -webkit-tap-highlight-color:transparent; user-select:none; cursor:pointer;
  }
  #play-btn.playing { background:#ef4444; box-shadow:0 3px 6px rgba(239,68,68,0.3); }
  #play-btn:active { opacity:0.85; }
</style>
</head>
<body>
<div id="score-wrapper">
  <div id="score-container"></div>
</div>
<div id="synth-target"></div>
<div id="controls">
  <button id="play-btn" type="button">
    <span id="play-icon">&#9654;</span>
    <span id="play-text">재생</span>
  </button>
</div>

<script>${ABCJS_SOURCE}</script>
<script>
(function() {
  'use strict';
  var currentAbc         = '';
  var currentCombinedAbc = '';
  var currentParams      = {};
  var synthInstance      = null;
  var audioCtx           = null;
  var isPlayingState     = false;
  var cancelFlag         = false;
  var playTimeout        = null;
  var fixedHeight        = 0;
  var displayVisualObj   = null;
  var timingCb           = null;
  var cursorLine         = null;

  function postMsg(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }
  function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

  function reportHeight() {
    var wrapper  = document.getElementById('score-wrapper');
    var controls = document.getElementById('controls');
    // scrollHeight를 사용해 실제 콘텐츠 전체 높이를 정확히 측정
    var wh = wrapper ? Math.max(wrapper.offsetHeight, wrapper.scrollHeight) : 0;
    var ch = controls ? Math.max(controls.offsetHeight, controls.scrollHeight) : 0;
    var bodyH = Math.max(document.body.offsetHeight, document.body.scrollHeight);
    var h = Math.max(wh + ch, bodyH);
    if (h > 50) { postMsg({ type:'HEIGHT', height:h }); }
  }

  // DOM 변화를 감지해서 높이가 바뀔 때마다 다시 보고 (악보가 길어질 때 실시간 반응)
  var observer = new MutationObserver(function() {
    // 렌더링이 완전히 끝난 뒤 측정하기 위해 약간 지연
    setTimeout(reportHeight, 50);
  });
  window.addEventListener('DOMContentLoaded', function() {
    var tgt = document.getElementById('score-wrapper');
    if(tgt) observer.observe(tgt, { childList: true, subtree: true, attributes: true });
  });

  // ResizeObserver로 크기 변화 즉시 감지
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function() { reportHeight(); });
    window.addEventListener('DOMContentLoaded', function() {
      var tgt = document.getElementById('score-wrapper');
      if (tgt) ro.observe(tgt);
    });
  }

  function setPlayBtnUI(playing) {
    var btn  = document.getElementById('play-btn');
    var icon = document.getElementById('play-icon');
    var text = document.getElementById('play-text');
    if (!btn) return;
    if (playing) {
      btn.classList.add('playing');
      icon.innerHTML = '&#9632;';
      text.textContent = '정지';
    } else {
      btn.classList.remove('playing');
      icon.innerHTML = '&#9654;';
      text.textContent = '재생';
    }
  }

  function createMetronomeClick(ctx, t, accent, freq) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    g.gain.setValueAtTime(accent ? 0.7 : 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.start(t); osc.stop(t + 0.05);
  }

  /* ── 악보 렌더링 ── */
  function renderScore(abc, selectedNote) {
    if (!abc) return;
    var bodyLines = abc.split('\\n').filter(function(l) {
      return l.trim() && !/^[A-Z]:/.test(l) && !/^%%/.test(l);
    });
    var isMultiVoice = /V:V[12]/.test(abc);
    var countLines = bodyLines;
    if (isMultiVoice) {
      var inV1 = false;
      countLines = bodyLines.filter(function(l) {
        if (/^V:V1/.test(l)) { inV1 = true; return false; }
        if (/^V:V2/.test(l)) { inV1 = false; return false; }
        return inV1;
      });
    }
    var bodyStr    = countLines.join(' ');

    // 총 마디 수 계산 → 짝수 마디씩 배치 (2 또는 4)
    var totalBars = (bodyStr.match(/\|/g) || []).length;
    var doubleBars = (bodyStr.match(/\|\|/g) || []).length;
    totalBars = Math.max(1, totalBars - doubleBars);
    // 마디당 평균 음표 수로 줄당 마디 수 자동 결정
    // ABC 음표 문자: A-G(저음), a-g(고음), z(쉼표)
    var totalNotes = (bodyStr.match(/[A-Ga-gz]/g) || []).length;
    var avgNotesPerBar = totalBars > 0 ? totalNotes / totalBars : 4;
    var autoPerLine = avgNotesPerBar <= 10 ? 4 : 2;
    var perLine = currentParams.barsPerStaff || autoPerLine;

    var renderResult = ABCJS.renderAbc('score-container', abc, {
      add_classes: true,
      responsive: 'resize',
      scale: 1.2,
      staffwidth: 800,
      wrap: { minSpacing: 1.8, maxSpacing: 2.5, preferredMeasuresPerLine: perLine },
      format: { stretchlast: currentParams.stretchLast },
      clickListener: function(abcElem, tuneNumber, classes, analysis) {
        if (!analysis) return;
        var el = analysis.selectableElement; if (!el) return;
        var voiceIdx = analysis.voice || 0;
        var voice = voiceIdx === 1 ? 'bass' : 'treble';
        var vc    = voiceIdx === 1 ? 'abcjs-v1' : 'abcjs-v0';
        var ct    = document.getElementById('score-container');
        var all   = Array.from(ct.querySelectorAll('.' + vc + '.abcjs-note, .' + vc + '.abcjs-rest'));
        var idx   = all.indexOf(el);
        if (idx >= 0) postMsg({ type:'NOTE_CLICK', index:idx, voice:voice });
      }
    });
    displayVisualObj = renderResult && renderResult[0];

    // 렌더링 완료 후 여러 타이밍에 높이 측정 (abcjs SVG 렌더링이 비동기이므로)
    setTimeout(function() {
      applyHighlight(selectedNote);
      applyNoteColors(currentParams.noteColors);
      reportHeight();
    }, 100);
    setTimeout(reportHeight, 300);
    setTimeout(reportHeight, 600);
  }

  function applyNoteColors(colors) {
    if (!colors || !colors.length) return;
    var ct = document.getElementById('score-container'); if (!ct) return;
    var all = Array.from(ct.querySelectorAll('.abcjs-v0.abcjs-note, .abcjs-v0.abcjs-rest'));
    all.forEach(function(el, i) {
      var color = colors[i];
      var fill = color === 'correct' ? '#16a34a'
               : color === 'wrong'   ? '#dc2626'
               : null;
      if (!fill) return;
      el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) {
        c.style.fill = fill;
      });
    });
  }

  function applyHighlight(sel) {
    var ct = document.getElementById('score-container'); if (!ct) return;
    var svg = ct.querySelector('svg');

    // 기존 하이라이트 rect 제거
    ct.querySelectorAll('.abcjs-note-highlight').forEach(function(el) {
      el.parentNode && el.parentNode.removeChild(el);
    });
    // 음표 색상 초기화 후 noteColors 재적용
    ct.querySelectorAll('.abcjs-note,.abcjs-rest').forEach(function(el) {
      el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) { c.style.fill=''; });
    });
    applyNoteColors(currentParams.noteColors);

    if (!sel || sel.index < 0 || !svg) return;
    var vc  = sel.voice === 'bass' ? 'abcjs-v1' : 'abcjs-v0';
    var all = Array.from(ct.querySelectorAll('.' + vc + '.abcjs-note, .' + vc + '.abcjs-rest'));
    var t   = all[sel.index];
    if (!t) return;

    try {
      // screen 좌표 → SVG 좌표 변환 함수
      var svgBCR = svg.getBoundingClientRect();
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var vbX = (vb && vb.width) ? vb.x : 0;
      var vbY = (vb && vb.width) ? vb.y : 0;
      var vbW = (vb && vb.width) ? vb.width : (parseFloat(svg.getAttribute('width')) || svgBCR.width);
      var vbH = (vb && vb.height) ? vb.height : (parseFloat(svg.getAttribute('height')) || svgBCR.height);
      function toSvgX(sx) { return vbX + (sx - svgBCR.left) * vbW / svgBCR.width; }
      function toSvgY(sy) { return vbY + (sy - svgBCR.top) * vbH / svgBCR.height; }
      function toSvgW(sw) { return sw * vbW / svgBCR.width; }
      function toSvgH(sh) { return sh * vbH / svgBCR.height; }

      // 음표의 화면 좌표 → SVG 좌표
      var noteScr = t.getBoundingClientRect();
      var nX = toSvgX(noteScr.left);
      var nY = toSvgY(noteScr.top);
      var nW = toSvgW(noteScr.width);
      var nH = toSvgH(noteScr.height);
      var nCY = nY + nH / 2;

      // 바라인으로 보표 세로 범위 결정 (모든 줄에서 동일한 높이)
      var barEls = svg.querySelectorAll('.abcjs-bar');
      var sTop = nY, sBot = nY + nH;
      for (var bi = 0; bi < barEls.length; bi++) {
        try {
          var bScr = barEls[bi].getBoundingClientRect();
          var bY = toSvgY(bScr.top);
          var bBot = toSvgY(bScr.bottom);
          if (bY <= nCY && bBot >= nCY) {
            sTop = bY;
            sBot = bBot;
            break;
          }
        } catch(e3) {}
      }

      var padX = 10, padY = 5;
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x',      String(nX - padX));
      rect.setAttribute('y',      String(sTop - padY));
      rect.setAttribute('width',  String(nW + padX * 2));
      rect.setAttribute('height', String(sBot - sTop + padY * 2));
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
      rect.setAttribute('fill', '#fef2f2');
      rect.setAttribute('stroke', '#ef4444');
      rect.setAttribute('stroke-width', '1.2');
      rect.setAttribute('opacity', '0.85');
      rect.setAttribute('class', 'abcjs-note-highlight');
      rect.setAttribute('pointer-events', 'none');
      // SVG 루트에 삽입 (transform 무관하게 절대 좌표로 배치)
      svg.insertBefore(rect, svg.firstChild);
    } catch(e) {}
  }

  /* ── ABC 파싱 유틸 ── */
  function splitBodyMeasures(body) {
    return body.replace(/\\|\\]\\s*$/g, '').split('|').map(function(s){ return s.trim(); }).filter(Boolean);
  }
  function parseAbcParts(abc) {
    var lines   = abc.split('\\n');
    var isHdr   = function(l) { return (/^[A-Z]:/.test(l) && !/^V:/.test(l)) || /^%%/.test(l); };
    var header  = lines.filter(isHdr).join('\\n');
    var bodyStr = lines.filter(function(l){ return !isHdr(l); }).join('\\n');
    var isGrand = bodyStr.includes('V:V1');
    if (!isGrand) {
      return { header: header, isGrand: false, treble: splitBodyMeasures(bodyStr), bass: [] };
    }
    // 큰보표: V:V1/V:V2 블록이 줄 단위로 반복될 수 있으므로 모든 블록을 수집
    var allV1 = [];
    var allV2 = [];
    var v1Regex = /V:V1[^\\n]*\\n([\\s\\S]*?)(?=\\nV:V[12]|$)/gm;
    var v2Regex = /V:V2[^\\n]*\\n([\\s\\S]*?)(?=\\nV:V[12]|$)/gm;
    var m;
    while ((m = v1Regex.exec(bodyStr)) !== null) {
      allV1.push(m[1]);
    }
    while ((m = v2Regex.exec(bodyStr)) !== null) {
      allV2.push(m[1]);
    }
    return {
      header: header, isGrand: true,
      treble: splitBodyMeasures(allV1.join(' | ')),
      bass:   splitBodyMeasures(allV2.join(' | ')),
    };
  }
  function rebuildSegmentAbc(header, isGrand, treble, bass) {
    // 오디오 전용: 레이아웃 지시자 제거 (%%barsperstaff, %%staves 등이 신스 재생을 제한할 수 있음)
    var cleanHdr = header.split('\\n')
      .filter(function(l){ return l.trim() && !/^%%staves/.test(l) && !/^%%barsperstaff/.test(l); })
      .join('\\n');
    if (!isGrand) return cleanHdr + '\\n' + treble.join(' | ') + ' |]';
    return cleanHdr + '\\nV:V1 clef=treble\\n' + treble.join(' | ') + ' |]' +
                      '\\nV:V2 clef=bass\\n'   + bass.join(' | ')   + ' |]';
  }

  /* ── 재생 중 시각 피드백 (커서 / 마디 하이라이트) ── */
  function clearPlaybackHighlights() {
    var ct = document.getElementById('score-container');
    if (!ct) return;
    // 음표 하이라이트 제거
    ct.querySelectorAll('.abcjs-playback-note').forEach(function(el) {
      el.classList.remove('abcjs-playback-note');
    });
    // 커서 라인 제거
    if (cursorLine && cursorLine.parentNode) {
      cursorLine.parentNode.removeChild(cursorLine);
    }
    cursorLine = null;
    // 마디 하이라이트 제거
    ct.querySelectorAll('.abcjs-measure-highlight').forEach(function(el) {
      el.parentNode.removeChild(el);
    });
  }

  // 시험 모드용: 마디 범위(from~to-1)를 SVG에 직접 하이라이트
  function highlightMeasureRange(from, to, isGrand) {
    if (!currentParams.showMeasureHighlight) return;
    if (from >= to) return;
    var ct = document.getElementById('score-container');
    if (!ct) return;
    var svg = ct.querySelector('svg');
    if (!svg) return;

    ct.querySelectorAll('.abcjs-measure-highlight').forEach(function(el) {
      el.parentNode && el.parentNode.removeChild(el);
    });

    var barEls = svg.querySelectorAll('.abcjs-bar');
    if (!barEls.length) return;
    var bars = [];
    for (var i = 0; i < barEls.length; i++) {
      var bb = barEls[i].getBBox ? barEls[i].getBBox() : null;
      if (bb && bb.height > 5) bars.push({ x: bb.x, y: bb.y, h: bb.height });
    }
    if (!bars.length) return;

    bars.sort(function(a, b) { return a.y !== b.y ? a.y - b.y : a.x - b.x; });

    // y 좌표로 스태프 행 그룹화
    var rows = [];
    var Y_THR = 10;
    bars.forEach(function(b) {
      for (var ri = 0; ri < rows.length; ri++) {
        if (Math.abs(b.y - rows[ri].y) <= Y_THR) { rows[ri].bars.push(b); return; }
      }
      rows.push({ y: b.y, h: b.h, bars: [b] });
    });
    rows.forEach(function(r) { r.bars.sort(function(a, b) { return a.x - b.x; }); });

    var stavesPerSystem = isGrand ? 2 : 1;
    var numSystems = Math.ceil(rows.length / stavesPerSystem);
    var measureIdx = 0;

    for (var si = 0; si < numSystems; si++) {
      var sysRows = rows.slice(si * stavesPerSystem, (si + 1) * stavesPerSystem);
      if (!sysRows.length) continue;
      var refRow = sysRows[0];
      // N개의 barline = N개의 마디
      // 마디 mi: x1 = (mi===0 ? 0 : bars[mi-1].x), x2 = bars[mi].x
      var measInSys = refRow.bars.length;

      for (var mi = 0; mi < measInSys; mi++) {
        var gmi = measureIdx + mi;
        if (gmi >= from && gmi < to) {
          (function(mi) {
            sysRows.forEach(function(row) {
              if (mi >= row.bars.length) return;
              var x1 = mi === 0 ? 0 : row.bars[mi - 1].x;
              var x2 = row.bars[mi].x;
              var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('x',      String(x1));
              rect.setAttribute('y',      String(row.y));
              rect.setAttribute('width',  String(x2 - x1));
              rect.setAttribute('height', String(row.h));
              rect.setAttribute('class',  'abcjs-measure-highlight');
              rect.setAttribute('rx', '3');
              svg.insertBefore(rect, svg.firstChild);
            });
          })(mi);
        }
      }
      measureIdx += measInSys;
    }
  }

  function onPlaybackEvent(ev) {
    var p = currentParams;
    clearPlaybackHighlights();

    // 곡 종료 시 ev === null
    if (!ev) return;

    var ct = document.getElementById('score-container');
    if (!ct) return;
    var svg = ct.querySelector('svg');
    if (!svg) return;

    // 음표 커서: 음표 왼쪽에 수직 선 (마디 하이라이트와 동일 높이)
    if (p.showNoteCursor && ev.elements) {
      if (typeof ev.left !== 'undefined' && typeof ev.top !== 'undefined') {
        var MARGIN = 3;
        var staffH = ev.height || 50;

        cursorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cursorLine.setAttribute('x1', String(ev.left - MARGIN));
        cursorLine.setAttribute('y1', String(ev.top));
        cursorLine.setAttribute('x2', String(ev.left - MARGIN));
        cursorLine.setAttribute('y2', String(ev.top + staffH));
        cursorLine.setAttribute('class', 'abcjs-cursor');
        svg.appendChild(cursorLine);
      }
    }

    // 마디 하이라이트: 바라인 위치를 기준으로 전체 마디 영역 강조
    if (p.showMeasureHighlight && typeof ev.left !== 'undefined') {
      var noteX = ev.left;
      var noteTop = ev.top;
      var noteH = ev.height || 50;

      // SVG 내 모든 바라인(abcjs-bar) 요소의 x 좌표 수집
      var barEls = svg.querySelectorAll('.abcjs-bar');
      var barPositions = []; // { x, top, bottom }
      for (var bi = 0; bi < barEls.length; bi++) {
        var bBox = barEls[bi].getBBox ? barEls[bi].getBBox() : null;
        if (bBox) {
          barPositions.push({ x: bBox.x, top: bBox.y, bottom: bBox.y + bBox.height });
        }
      }

      // 현재 음표와 같은 줄에 있는 바라인 필터
      var sameLine = barPositions.filter(function(bp) {
        return bp.top < noteTop + noteH && bp.bottom > noteTop;
      });
      sameLine.sort(function(a, b) { return a.x - b.x; });

      // 현재 음표 좌측/우측의 바라인 찾기
      var leftBar = null, rightBar = null;
      for (var si = 0; si < sameLine.length; si++) {
        if (sameLine[si].x <= noteX) leftBar = sameLine[si];
        if (sameLine[si].x > noteX && !rightBar) rightBar = sameLine[si];
      }

      var mLeft = leftBar ? leftBar.x : 0;
      var mRight = rightBar ? rightBar.x : (leftBar ? leftBar.x + 200 : noteX + 100);

      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(mLeft));
      rect.setAttribute('y', String(noteTop));
      rect.setAttribute('width', String(mRight - mLeft));
      rect.setAttribute('height', String(noteH));
      rect.setAttribute('class', 'abcjs-measure-highlight');
      rect.setAttribute('rx', '3');
      svg.insertBefore(rect, svg.firstChild);
    }
  }

  function stopTimingCallbacks() {
    if (timingCb) {
      try { timingCb.stop(); } catch(e) {}
      timingCb = null;
    }
    clearPlaybackHighlights();
  }

  function startTimingCallbacks() {
    stopTimingCallbacks();
    var p = currentParams;
    if (!displayVisualObj) return;
    if (!p.showNoteCursor && !p.showMeasureHighlight) return;

    try {
      timingCb = new ABCJS.TimingCallbacks(displayVisualObj, {
        eventCallback: onPlaybackEvent
      });
    } catch(e) { return; }

    // 스케일/메트로놈 프리펜드 시간만큼 지연 후 시작
    var ts  = (p.timeSignature || '4/4').split('/');
    var top = parseInt(ts[0]) || 4, btm = parseInt(ts[1]) || 4;
    var beat  = (60 / (p.tempo || 120)) * (4 / btm);
    var sBeat = (60 / (p.scaleTempo || 120)) * (4 / btm);
    var delayMs = 0;
    if (p.prependBasePitch) delayMs += 16 * sBeat * 1000;
    if (p.prependMetronome) delayMs += top * beat * 1000;

    if (delayMs > 0) {
      setTimeout(function() {
        if (isPlayingState && timingCb) {
          try { timingCb.start(); } catch(e) {}
        }
      }, delayMs);
    } else {
      try { timingCb.start(); } catch(e) {}
    }
  }

  /* ── 일반 재생 ── */
  function stopAudio() {
    cancelFlag = true;
    stopTimingCallbacks();
    if (synthInstance) { try { synthInstance.stop(); } catch(e) {} synthInstance = null; }
    if (playTimeout)   { clearTimeout(playTimeout); playTimeout = null; }
    // AudioContext suspend로 스케줄된 메트로놈 클릭도 즉시 중단
    if (audioCtx && audioCtx.state === 'running') {
      try { audioCtx.suspend(); } catch(e) {}
    }
    isPlayingState = false; setPlayBtnUI(false);
    postMsg({ type:'PLAY_STATE', isPlaying:false });
    reportHeight();
  }

  function doSynth(abc) {
    var p      = currentParams;
    var parsed = ABCJS.renderAbc('synth-target', abc, {});
    var vo     = parsed && parsed[0];
    if (!vo || !vo.lines || !vo.lines.length) { stopAudio(); return; }
    var synth = new ABCJS.synth.CreateSynth();
    synthInstance = synth;
    synth.init({
      audioContext: audioCtx, visualObj: vo,
      options: { soundFontVolumeMultiplier: 2.0 }
    }).then(function() { return synth.prime(); })
      .then(function(res) {
        var ts   = (p.timeSignature || '4/4').split('/');
        var top  = parseInt(ts[0]) || 4, btm = parseInt(ts[1]) || 4;
        var beat = (60 / (p.tempo || 120)) * (4 / btm);
        var sBeat= (60 / (p.scaleTempo || 120)) * (4 / btm);
        if (p.prependMetronome) {
          var mStart = p.prependBasePitch ? 16 * sBeat : 0;
          for (var i = 0; i < top; i++)
            createMetronomeClick(audioCtx, audioCtx.currentTime + mStart + i * beat, i===0, p.metronomeFreq||1000);
        }
        synth.start();
        startTimingCallbacks();
        var dur = (res && res.duration) ? res.duration : 30;
        playTimeout = setTimeout(function() {
          if (isPlayingState) {
            stopTimingCallbacks();
            isPlayingState = false; synthInstance = null;
            setPlayBtnUI(false); postMsg({ type:'PLAY_STATE', isPlaying:false }); reportHeight();
          }
        }, (dur + 2) * 1000);
      }).catch(function() { stopAudio(); });
  }

  /* ── 시험용 재생: 마디 단위 순차 ── */
  /* voOverride: 이미 렌더링된 visualObj 직접 사용 (display:none 렌더링 우회) */
  function playSingleAbcAsync(abc, durationSec, voOverride) {
    return new Promise(function(resolve) {
      if (cancelFlag) { resolve(); return; }
      if (synthInstance) { try { synthInstance.stop(); } catch(e){} synthInstance = null; }
      var vo = voOverride || null;
      if (!vo) {
        var parsed = ABCJS.renderAbc('synth-target', abc, {});
        vo = parsed && parsed[0];
      }
      if (!vo) { resolve(); return; }
      var synth = new ABCJS.synth.CreateSynth();
      synthInstance = synth;
      synth.init({ audioContext: audioCtx, visualObj: vo,
                   options:{ soundFontVolumeMultiplier:2.0 } })
        .then(function(){ return synth.prime(); })
        .then(function(res){
          synth.start();
          /* voOverride(displayVisualObj) 사용 시 res.duration이 정확, 아니면 계산값 fallback */
          var dur = (voOverride && res && res.duration) ? res.duration : durationSec;
          var waitMs = dur * 1000 + 200;
          var step = 100, elapsed = 0;
          function tick() {
            if (cancelFlag) { try { synth.stop(); } catch(e){} resolve(); return; }
            elapsed += step;
            if (elapsed < waitMs) { setTimeout(tick, step); }
            else { resolve(); }
          }
          setTimeout(tick, step);
        }).catch(function(){ resolve(); });
    });
  }

  function examPlay() {
    var p  = currentParams;
    var ts = (p.timeSignature || '4/4').split('/');
    var top   = parseInt(ts[0]) || 4;
    var btm   = parseInt(ts[1]) || 4;
    var beat  = (60 / (p.tempo || 120)) * (4 / btm);
    var sBeat = (60 / (p.scaleTempo || 120)) * (4 / btm);
    var measureDur  = top * beat;
    var examWait    = (p.examWaitSeconds || 3) * 1000;
    var metroFreq   = p.metronomeFreq || 1000;
    var parts       = parseAbcParts(currentAbc);
    var N           = parts.treble.length;

    function playMetro() {
      return new Promise(function(resolve) {
        if (cancelFlag) { resolve(); return; }
        for (var j = 0; j < top; j++)
          createMetronomeClick(audioCtx, audioCtx.currentTime + j * beat, j===0, metroFreq);
        setTimeout(resolve, measureDur * 1000);
      });
    }
    function maybeMetro() {
      if (!shouldMetro) return Promise.resolve();
      return playMetro();
    }
    function rest() {
      return new Promise(function(resolve) {
        if (cancelFlag) { resolve(); return; }
        setTimeout(resolve, examWait);
      });
    }
    function playRange(from, to) {
      if (cancelFlag) return Promise.resolve();
      var end   = Math.min(to, N);
      var count = end - from;
      if (count <= 0) return Promise.resolve();

      // TimingCallbacks로 음표 커서 + 마디 하이라이트 (displayVisualObj 기반)
      stopTimingCallbacks();
      var rangeStopTimer = null;
      if (displayVisualObj) {
        try {
          timingCb = new ABCJS.TimingCallbacks(displayVisualObj, {
            eventCallback: onPlaybackEvent
          });
          timingCb.start(from / N, 'percent');
          // 세그먼트 끝에서 다음 마디가 잠깐 보이지 않도록 미리 정지
          rangeStopTimer = setTimeout(function() {
            stopTimingCallbacks();
          }, Math.max(0, count * measureDur * 1000 - 100));
        } catch(e) {}
      }

      /* 전체 재생: displayVisualObj 직접 사용 (synth-target 렌더링 우회)
         부분 재생: rebuildSegmentAbc로 구간 ABC 생성 후 synth-target 렌더링 */
      var isFullRange = (from === 0 && end >= N);
      var segAbc = isFullRange
        ? null
        : rebuildSegmentAbc(parts.header, parts.isGrand,
            parts.treble.slice(from, end),
            parts.isGrand ? parts.bass.slice(from, end) : []);
      var voOverride = isFullRange ? displayVisualObj : null;
      return playSingleAbcAsync(segAbc, count * measureDur, voOverride)
        .then(function() {
          if (rangeStopTimer) { clearTimeout(rangeStopTimer); rangeStopTimer = null; }
          stopTimingCallbacks();
        });
    }

    // 스케일 빌드
    function buildScaleAbc() {
      var cleanHdr = parts.header.split('\\n')
        .filter(function(l){ return l.trim() && !/^%%staves/.test(l) && !/^%%barsperstaff/.test(l); })
        .join('\\n');
      var scaleNotes = { 'C':['C','D','E','F','G','A','B','c'],
        'G':['G','A','B','c','d','e','f','g'],'D':['D','E','F','G','A','B','c','d'],
        'A':['A,','B,','C','D','E','F','G','A'],'F':['F','G','A','B','c','d','e','f'],
        'Bb':['B,','C','D','E','F','G','A','B'],'Eb':['E','F','G','A','B','c','d','e'],
        'Am':['A,','B,','C','D','E','F','^G','A'],'Em':['E','F','G','A','B','c','^d','e'],
        'Bm':['B,','C','D','E','F','G','^A','B'],'F#m':['F,','G,','A,','B,','C','D','^E','F'],
        'Dm':['D','E','F','G','A','B','^c','d'],'Gm':['G,','A,','B,','C','D','E','^F','G'],
        'Cm':['C','D','E','F','G','A','=B','c'] };
      var asc  = scaleNotes[p.keySignature || 'C'] || scaleNotes['C'];
      var desc = asc.slice(0, -1).reverse();
      var all  = asc.concat(desc).concat(['z']);
      var mult = 16 / btm;
      var spb  = top * mult;
      var barPos = 0, body = '[Q:' + (p.scaleTempo||120) + '] ';
      all.forEach(function(n) {
        body += n + mult + ' '; barPos += mult;
        if (barPos >= spb) { body += '| '; barPos = 0; }
      });
      return cleanHdr + '\\n' + body.trimEnd().replace(/\\|$/, '').trimEnd() + ' |]';
    }

    var mode = p.playbackMode || 'practice';

    // 공통 헬퍼: 으뜸화음 ABC 빌드
    function buildTonicChordAbc() {
      var cleanHdr = parts.header.split('\\n')
        .filter(function(l){ return l.trim() && !/^%%staves/.test(l) && !/^%%barsperstaff/.test(l); })
        .join('\\n');
      var chords = {
        'C':'[CEG]','G':'[GBd]','D':'[DFA]','A':'[Ace]','F':'[FAc]',
        'Bb':'[BDF]','Eb':'[EGB]',
        'Am':'[Ace]','Em':'[EGB]','Bm':'[Bdf]','Dm':'[DFA]','Gm':'[GBd]','Cm':'[CEG]'
      };
      var chord = chords[p.keySignature || 'C'] || '[CEG]';
      var mult = 16 / btm;
      return cleanHdr + '\\n' + chord + (mult * top) + ' |]';
    }

    // 공통 헬퍼: 시작음 ABC 빌드 (첫 번째 음 추출)
    function buildStartingNoteAbc() {
      var cleanHdr = parts.header.split('\\n')
        .filter(function(l){ return l.trim() && !/^%%staves/.test(l) && !/^%%barsperstaff/.test(l); })
        .join('\\n');
      var firstMeasure = parts.treble[0] || 'C';
      var m = firstMeasure.match(/[=^_]*[A-Ga-g][,']*/);
      var note = m ? m[0] : 'C';
      var mult = 16 / btm;
      return cleanHdr + '\\n' + note + (mult * top) + ' |]';
    }

    // 공통 헬퍼: 초 단위 휴식
    function restSec(seconds) {
      return new Promise(function(resolve) {
        if (cancelFlag) { resolve(); return; }
        setTimeout(resolve, seconds * 1000);
      });
    }

    // 완료 처리
    function finish() {
      clearPlaybackHighlights();
      isPlayingState = false; setPlayBtnUI(false);
      postMsg({ type:'PLAY_STATE', isPlaying:false }); reportHeight();
    }

    if (mode === 'practice') {
      // ② 연습 모드: 스케일 → 카운트인→전체→휴식 → 2마디 슬라이딩 → 카운트인→전체
      Promise.resolve()
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildScaleAbc(), 16 * sBeat);
        })
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); })
            .then(function(){ return cancelFlag ? null : rest(); });
        })
        .then(function() {
          var chain = Promise.resolve();
          for (var s = 0; s < N; s += 2) {
            (function(s) {
              chain = chain.then(function() {
                if (cancelFlag) return;
                var pairEnd = Math.min(s + 2, N);
                return playMetro()
                  .then(function(){ return cancelFlag ? null : playRange(s, pairEnd); })
                  .then(function(){ return cancelFlag ? null : rest(); })
                  .then(function(){ return cancelFlag ? null : playMetro(); })
                  .then(function(){ return cancelFlag ? null : playRange(s, pairEnd); })
                  .then(function(){ return cancelFlag ? null : rest(); })
                  .then(function() {
                    if (s + 2 < N && !cancelFlag) {
                      var cumEnd = Math.min(s + 4, N);
                      return playMetro()
                        .then(function(){ return cancelFlag ? null : playRange(s, cumEnd); })
                        .then(function(){ return cancelFlag ? null : rest(); });
                    }
                  });
              });
            })(s);
          }
          return chain;
        })
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); });
        })
        .then(finish);

    } else if (mode === 'ap_exam') {
      // ③ AP 시험: 스케일→으뜸화음→(카운트인→전체)×4 (첫 휴식 firstRest, 이후 rest)
      var ap = p.apExamSettings || { firstRestSeconds: 30, restSeconds: 60 };
      Promise.resolve()
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildScaleAbc(), 16 * sBeat);
        })
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildTonicChordAbc(), measureDur);
        })
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); })
            .then(function(){ return cancelFlag ? null : restSec(ap.firstRestSeconds); });
        })
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); })
            .then(function(){ return cancelFlag ? null : restSec(ap.restSeconds); });
        })
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); })
            .then(function(){ return cancelFlag ? null : restSec(ap.restSeconds); });
        })
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); });
        })
        .then(finish);

    } else if (mode === 'korean_exam') {
      // ④ 한국 입시: 스케일→으뜸화음→시작음→(카운트인→전체→휴식)×totalPlays
      var kr = p.koreanExamSettings || { totalPlays: 3, restSeconds: 60 };
      Promise.resolve()
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildScaleAbc(), 16 * sBeat);
        })
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildTonicChordAbc(), measureDur);
        })
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildStartingNoteAbc(), measureDur);
        })
        .then(function() {
          var chain = Promise.resolve();
          for (var i = 0; i < kr.totalPlays; i++) {
            (function(i) {
              chain = chain.then(function() {
                if (cancelFlag) return;
                return playMetro().then(function(){ return playRange(0, N); })
                  .then(function() {
                    if (i < kr.totalPlays - 1 && !cancelFlag) return restSec(kr.restSeconds);
                  });
              });
            })(i);
          }
          return chain;
        })
        .then(finish);

    } else if (mode === 'echo') {
      // ⑤ 에코: 스케일→으뜸화음→(카운트인→N마디→응답시간)×구간 수
      var echo = p.echoSettings || { phraseMeasures: 2, responseSeconds: 5 };
      var phraseSize = echo.phraseMeasures || 2;
      Promise.resolve()
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildScaleAbc(), 16 * sBeat);
        })
        .then(function() {
          if (cancelFlag) return;
          return playSingleAbcAsync(buildTonicChordAbc(), measureDur);
        })
        .then(function() {
          var chain = Promise.resolve();
          for (var s = 0; s < N; s += phraseSize) {
            (function(s) {
              chain = chain.then(function() {
                if (cancelFlag) return;
                var end = Math.min(s + phraseSize, N);
                return playMetro().then(function(){ return playRange(s, end); })
                  .then(function(){ return cancelFlag ? null : restSec(echo.responseSeconds); });
              });
            })(s);
          }
          return chain;
        })
        .then(finish);

    } else if (mode === 'custom') {
      // ⑥ 커스텀
      var cs = p.customPlaySettings || {};
      Promise.resolve()
        .then(function() {
          if (cs.prependScale && !cancelFlag)
            return playSingleAbcAsync(buildScaleAbc(), 16 * sBeat);
        })
        .then(function() {
          if (cs.prependTonicChord && !cancelFlag)
            return playSingleAbcAsync(buildTonicChordAbc(), measureDur);
        })
        .then(function() {
          if (cs.useSegments) {
            // 구간 분할: 카운트인→전체→휴식 → (카운트인→segment→휴식)×repeats per segment → 카운트인→전체
            var segSize = cs.segmentMeasures || 2;
            var segRep  = cs.segmentRepeats || 2;
            var chain = Promise.resolve()
              .then(function() {
                if (cancelFlag) return;
                return playMetro()
                  .then(function(){ return cancelFlag ? null : playRange(0, N); })
                  .then(function(){ if (!cancelFlag) return restSec(cs.restSeconds || 30); });
              });
            for (var s = 0; s < N; s += segSize) {
              (function(s) {
                chain = chain.then(function() {
                  if (cancelFlag) return;
                  var end = Math.min(s + segSize, N);
                  var repChain = Promise.resolve();
                  for (var r = 0; r < segRep; r++) {
                    (function(r) {
                      repChain = repChain.then(function() {
                        if (cancelFlag) return;
                        return playMetro()
                          .then(function(){ return cancelFlag ? null : playRange(s, end); })
                          .then(function(){ if (!cancelFlag) return restSec(cs.restSeconds || 30); });
                      });
                    })(r);
                  }
                  return repChain;
                });
              })(s);
            }
            chain = chain.then(function() {
              if (cancelFlag) return;
              return playMetro().then(function(){ return playRange(0, N); });
            });
            return chain;
          } else {
            // 통재생: (카운트인→전체→휴식)×totalPlays
            var total = cs.totalPlays || 3;
            var chain = Promise.resolve();
            for (var i = 0; i < total; i++) {
              (function(i) {
                chain = chain.then(function() {
                  if (cancelFlag) return;
                  return playMetro().then(function(){ return playRange(0, N); })
                    .then(function() {
                      if (i < total - 1 && !cancelFlag) return restSec(cs.restSeconds || 30);
                    });
                });
              })(i);
            }
            return chain;
          }
        })
        .then(finish);

    } else {
      // fallback: practice와 동일
      Promise.resolve()
        .then(function() {
          if (cancelFlag) return;
          return playMetro().then(function(){ return playRange(0, N); });
        })
        .then(finish);
    }
  }


  function toggleAudioPlayback() {
    if (isPlayingState) { stopAudio(); return; }
    var abc = currentCombinedAbc; if (!abc) return;
    isPlayingState = true; cancelFlag = false; setPlayBtnUI(true);
    postMsg({ type:'PLAY_STATE', isPlaying:true });
    try {
      if (!audioCtx || audioCtx.state === 'closed')
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { stopAudio(); return; }
    var resume = audioCtx.state === 'suspended' ? audioCtx.resume() : Promise.resolve();
    resume.then(function() {
      if (currentParams.examMode) { examPlay(); }
      else { doSynth(currentCombinedAbc); }
    });
  }

  document.getElementById('play-btn').addEventListener('click', toggleAudioPlayback);

  /* ─── 이미지 내보내기 ─── */
  function exportImage() {
    try {
      var ct  = document.getElementById('score-container');
      var svg = ct ? ct.querySelector('svg') : null;
      if (!svg) { postMsg({ type:'EXPORT_IMAGE_ERROR' }); return; }
      var clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var bbox = svg.getBoundingClientRect();
      var srcW = parseFloat(clone.getAttribute('width')  || '') || bbox.width  || 800;
      var srcH = parseFloat(clone.getAttribute('height') || '') || bbox.height || 400;
      if (!clone.getAttribute('viewBox'))
        clone.setAttribute('viewBox', '0 0 ' + srcW + ' ' + srcH);
      clone.setAttribute('width',  String(srcW));
      clone.setAttribute('height', String(srcH));
      var outW  = 1920;
      var scale = outW / srcW;
      var outH  = Math.round(srcH * scale);
      var svgData = new XMLSerializer().serializeToString(clone);
      var svgB64  = btoa(unescape(encodeURIComponent(svgData)));
      var dataUrl = 'data:image/svg+xml;base64,' + svgB64;
      var img = new Image();
      img.onload = function() {
        var canvas    = document.createElement('canvas');
        canvas.width  = outW; canvas.height = outH;
        var ctx       = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
        var base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
        postMsg({ type:'EXPORT_IMAGE_DATA', base64: base64 });
      };
      img.onerror = function() { postMsg({ type:'EXPORT_IMAGE_ERROR' }); };
      img.src = dataUrl;
    } catch(e) { postMsg({ type:'EXPORT_IMAGE_ERROR' }); }
  }

  /* ─── WAV 내보내기 ─── */
  function encodeWav(buffer) {
    var numCh   = buffer.numberOfChannels;
    var rate    = buffer.sampleRate;
    var bps     = 16;
    var blkAlign= numCh * bps / 8;
    var byteRate= rate * blkAlign;
    var dataLen = buffer.length * blkAlign;
    var ab      = new ArrayBuffer(44 + dataLen);
    var v       = new DataView(ab);
    var ws = function(off, s) { for (var i=0;i<s.length;i++) v.setUint8(off+i, s.charCodeAt(i)); };
    ws(0,'RIFF'); v.setUint32(4, 36+dataLen, true);
    ws(8,'WAVE'); ws(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true);
    v.setUint16(22,numCh,true); v.setUint32(24,rate,true);
    v.setUint32(28,byteRate,true); v.setUint16(32,blkAlign,true);
    v.setUint16(34,bps,true); ws(36,'data'); v.setUint32(40,dataLen,true);
    var chs = []; for (var c=0;c<numCh;c++) chs.push(buffer.getChannelData(c));
    var off = 44;
    for (var i=0;i<buffer.length;i++) {
      for (var c=0;c<numCh;c++) {
        var s = Math.max(-1,Math.min(1,chs[c][i]));
        v.setInt16(off, s<0 ? s*0x8000 : s*0x7FFF, true); off+=2;
      }
    }
    var bytes = new Uint8Array(ab);
    var bin   = '';
    for (var j=0;j<bytes.byteLength;j++) bin += String.fromCharCode(bytes[j]);
    return btoa(bin);
  }

  function exportAudio() {
    var abc = currentCombinedAbc;
    if (!abc) { postMsg({ type:'EXPORT_AUDIO_ERROR', message:'악보가 없습니다.' }); return; }
    var parsed = ABCJS.renderAbc('synth-target', abc, {});
    var vo     = parsed && parsed[0];
    if (!vo || !vo.lines || !vo.lines.length) {
      postMsg({ type:'EXPORT_AUDIO_ERROR', message:'악보 파싱에 실패했습니다.' }); return;
    }
    var p    = currentParams;
    var rate = 44100;
    var totalDur = vo.getTotalTime ? vo.getTotalTime() : 0;
    if (!totalDur || isNaN(totalDur)) {
      var ts2  = (p.timeSignature||'4/4').split('/');
      var top2 = parseInt(ts2[0])||4, btm2 = parseInt(ts2[1])||4;
      var beat2  = (60/(p.tempo||120))*(4/btm2);
      var sBeat2 = (60/(p.scaleTempo||120))*(4/btm2);
      var bodyLines2 = abc.split('\\n').filter(function(l){ return !/^[A-Z]:/.test(l) && !/^%%/.test(l); });
      var measures2  = (bodyLines2.join('\\n').match(/\\|/g)||[]).length;
      totalDur = (p.prependBasePitch  ? 16*sBeat2 : 0)
               + (p.prependMetronome ? top2*beat2 : 0)
               + measures2 * top2 * beat2;
    }
    totalDur += 2;
    var frames = Math.max(1, Math.floor(rate * totalDur));
    var offCtx;
    try { offCtx = new OfflineAudioContext(2, frames, rate); } catch(e) {
      postMsg({ type:'EXPORT_AUDIO_ERROR', message:'OfflineAudioContext 생성 실패' }); return;
    }
    offCtx.resume  = function(){ return Promise.resolve(); };
    offCtx.suspend = function(){ return Promise.resolve(); };
    var synth2 = new ABCJS.synth.CreateSynth();
    synth2.init({ audioContext: offCtx, visualObj: vo,
                  options:{ soundFontVolumeMultiplier:2.0 } })
      .then(function(){ return synth2.prime(); })
      .then(function(){
        if (p.prependMetronome) {
          var ts3  = (p.timeSignature||'4/4').split('/');
          var top3 = parseInt(ts3[0])||4, btm3 = parseInt(ts3[1])||4;
          var beat3  = (60/(p.tempo||120))*(4/btm3);
          var sBeat3 = (60/(p.scaleTempo||120))*(4/btm3);
          var mStart = p.prependBasePitch ? 16*sBeat3 : 0;
          for (var i=0;i<top3;i++)
            createMetronomeClick(offCtx, mStart + i*beat3, i===0, p.metronomeFreq||1000);
        }
        synth2.start();
        return offCtx.startRendering();
      }).then(function(rendered){
        postMsg({ type:'EXPORT_AUDIO_DATA', base64: encodeWav(rendered) });
      }).catch(function(e){
        postMsg({ type:'EXPORT_AUDIO_ERROR', message: String(e) });
      });
  }

  /* ── 악보 음표 숨기기 (hideNotes) ── */
  function applyHideNotes(hide) {
    var ct = document.getElementById('score-container'); if (!ct) return;
    var v = hide ? 'hidden' : 'visible';
    ct.querySelectorAll('.abcjs-note,.abcjs-rest').forEach(function(el) {
      el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) {
        c.style.visibility = v;
      });
    });
    /* 슬러(.abcjs-legato)·타이(.abcjs-tie) — 음표와 별도 SVG 그룹(.abcjs-slur) */
    ct.querySelectorAll('.abcjs-slur').forEach(function(el) {
      el.style.visibility = v;
    });
    /* 잇단(트리플릿) 숫자·괄호 등 — 음표와 별도 그룹 (.abcjs-triplet) */
    ct.querySelectorAll('.abcjs-triplet').forEach(function(el) {
      el.style.visibility = v;
    });
    /* 꼬리·빔·가림줄 — 음표 그룹 밖에 별도 요소로 그려짐.
       박자표 등 선두(.abcjs-staff-extra) 꼬리는 유지. abcjs는 꼬리를 pathToBack 으로 그릴 때
       부모 <g> 밖(SVG 직하위)에 두는 경우가 있어, staff-extra 영역과의 bbox 겹침으로도 판별함. */
    var staffExtraGroups = ct.querySelectorAll('.abcjs-staff-extra');
    function stemBelongsToStaffExtra(el) {
      if (el.closest && el.closest('.abcjs-staff-extra')) return true;
      try {
        if (!el.getBBox) return false;
        var b = el.getBBox();
        var cx = b.x + b.width / 2;
        var cy = b.y + b.height / 2;
        for (var gi = 0; gi < staffExtraGroups.length; gi++) {
          var sb = staffExtraGroups[gi].getBBox();
          if (cx >= sb.x - 2 && cx <= sb.x + sb.width + 2 &&
              cy >= sb.y - 4 && cy <= sb.y + sb.height + 4) return true;
        }
      } catch (e) {}
      return false;
    }
    ct.querySelectorAll('.abcjs-stem,.abcjs-beam-elem,.abcjs-ledger').forEach(function(el) {
      if (hide && stemBelongsToStaffExtra(el)) return;
      el.style.visibility = v;
    });
  }

  /* ── 메시지 수신 ── */
  function handleMsg(data) {
    try {
      var msg = JSON.parse(data);
      if (msg.type === 'UPDATE_ABC') {
        currentAbc         = msg.abc         || '';
        currentCombinedAbc = msg.combinedAbc || msg.abc || '';
        currentParams = {
          examMode:         msg.examMode        || false,
          examWaitSeconds:  msg.examWaitSeconds || 3,
          prependMetronome: msg.prependMetronome|| false,
          prependBasePitch: msg.prependBasePitch|| false,
          metronomeFreq:    msg.metronomeFreq   || 1000,
          timeSignature:    msg.timeSignature   || '4/4',
          tempo:            msg.tempo           || 120,
          scaleTempo:       msg.scaleTempo      || 120,
          keySignature:     msg.keySignature    || 'C',
          stretchLast:      msg.stretchLast     || false,
          playbackMode:     msg.playbackMode    || null,
          hideNotes:        msg.hideNotes       || false,
          showNoteCursor:   msg.showNoteCursor  !== false,
          showMeasureHighlight: msg.showMeasureHighlight !== false,
          apExamSettings:   msg.apExamSettings  || null,
          koreanExamSettings: msg.koreanExamSettings || null,
          echoSettings:     msg.echoSettings    || null,
          customPlaySettings: msg.customPlaySettings || null,
          barsPerStaff:     msg.barsPerStaff    || null,
          noteColors:       msg.noteColors      || null,
        };
        renderScore(msg.abc, msg.selectedNote);
        if (msg.hideNotes) setTimeout(function(){ applyHideNotes(true); }, 200);
      } else if (msg.type === 'SYNC_PLAY_STATE') {
        if (!msg.isPlaying && isPlayingState) stopAudio();
      } else if (msg.type === 'HIGHLIGHT') {
        applyHighlight(msg.selectedNote);
      } else if (msg.type === 'TAP') {
        // RN PanResponder에서 탭으로 판정된 좌표 → 가장 가까운 음표 탐색
        var tapCt = document.getElementById('score-container');
        if (tapCt) {
          var noteEls = tapCt.querySelectorAll('.abcjs-note, .abcjs-rest');
          var bestEl = null, bestDist = Infinity;
          for (var ni = 0; ni < noteEls.length; ni++) {
            var nr = noteEls[ni].getBoundingClientRect();
            var cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2;
            var dist = Math.sqrt(Math.pow(msg.x - cx, 2) + Math.pow(msg.y - cy, 2));
            var inHit = msg.x >= nr.left - 24 && msg.x <= nr.right + 24 &&
                        msg.y >= nr.top  - 32 && msg.y <= nr.bottom + 32;
            if (inHit && dist < bestDist) { bestDist = dist; bestEl = noteEls[ni]; }
          }
          if (bestEl) {
            var isV1 = bestEl.classList.contains('abcjs-v1');
            var tapVoice = isV1 ? 'bass' : 'treble';
            var tapVc = isV1 ? 'abcjs-v1' : 'abcjs-v0';
            var tapAll = Array.from(tapCt.querySelectorAll('.' + tapVc + '.abcjs-note, .' + tapVc + '.abcjs-rest'));
            var tapIdx = tapAll.indexOf(bestEl);
            if (tapIdx >= 0) { postMsg({ type:'NOTE_CLICK', index:tapIdx, voice:tapVoice }); }
          }
        }
      } else if (msg.type === 'TOGGLE_PLAY') {
        toggleAudioPlayback();
      } else if (msg.type === 'STOP_AUDIO') {
        if (isPlayingState) stopAudio();
      } else if (msg.type === 'EXPORT_IMAGE') {
        exportImage();
      } else if (msg.type === 'EXPORT_AUDIO') {
        exportAudio();
      }
    } catch(e) {}
  }
  document.addEventListener('message', function(e){ handleMsg(e.data); });
  window.addEventListener('message',   function(e){ handleMsg(e.data); });

  /* 터치 이벤트는 RN PanResponder 오버레이가 처리하므로 WebView에서는 불필요 */

  postMsg({ type:'READY' });
  setTimeout(reportHeight, 80);
})();
</script>
</body>
</html>`;
