import React, { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View, StyleSheet, Alert, Platform, PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { APExamSettings, KoreanExamSettings, EchoSettings, CustomPlaySettings } from '../types/playback';

export interface AbcjsRendererHandle {
  requestExportImage: () => void;
  requestExportAudio: () => void;
  togglePlay: () => void;
}

interface AbcjsRendererProps {
  abcString: string;
  scoreTitle?: string;
  prependBasePitch?: boolean;
  prependMetronome?: boolean;
  timeSignature?: string;
  tempo?: number;
  scaleTempo?: number;
  keySignature?: string;
  /** 드래그 스크롤 델타(px) 전달 — PanResponder 오버레이에서 RN 레벨로 처리 */
  onScrollDelta?: (deltaY: number) => void;
  metronomeFreq?: number;
  examMode?: boolean;
  examWaitSeconds?: number;
  stretchLast?: boolean;
  onNoteClick?: (noteIndex: number, voice: 'treble' | 'bass') => void;
  selectedNote?: { index: number; voice: 'treble' | 'bass' } | null;
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  playbackMode?: string;
  hideNotes?: boolean;
  apExamSettings?: APExamSettings;
  koreanExamSettings?: KoreanExamSettings;
  echoSettings?: EchoSettings;
  customPlaySettings?: CustomPlaySettings;
  onAudioSaveSuccess?: () => void;
  showNoteCursor?: boolean;
  showMeasureHighlight?: boolean;
}

const SCALE_NOTES: Record<string, string[]> = {
  'C':   ['C','D','E','F','G','A','B','c'],
  'G':   ['G','A','B','c','d','e','f','g'],
  'D':   ['D','E','F','G','A','B','c','d'],
  'A':   ['A,','B,','C','D','E','F','G','A'],
  'F':   ['F','G','A','B','c','d','e','f'],
  'Bb':  ['B,','C','D','E','F','G','A','B'],
  'Eb':  ['E','F','G','A','B','c','d','e'],
  'Am':  ['A,','B,','C','D','E','F','G','A'],
  'Em':  ['E','F','G','A','B','c','d','e'],
  'Bm':  ['B,','C','D','E','F','G','A','B'],
  'F#m': ['F,','G,','A,','B,','C','D','E','F'],
  'Dm':  ['D','E','F','G','A','B','c','d'],
  'Gm':  ['G,','A,','B,','C','D','E','F','G'],
  'Cm':  ['C','D','E','F','G','A','B','c'],
};

const AbcjsRendererBase = forwardRef<AbcjsRendererHandle, AbcjsRendererProps>(function AbcjsRenderer({
  abcString,
  scoreTitle = 'score',
  prependBasePitch = false,
  prependMetronome = false,
  timeSignature = '4/4',
  tempo = 120,
  scaleTempo = 120,
  keySignature = 'C',
  metronomeFreq = 1000,
  examMode = false,
  examWaitSeconds = 3,
  stretchLast = true,
  onNoteClick,
  onScrollDelta,
  selectedNote,
  isPlaying = false,
  onPlayStateChange,
  playbackMode,
  hideNotes = false,
  apExamSettings,
  koreanExamSettings,
  echoSettings,
  customPlaySettings,
  onAudioSaveSuccess,
  showNoteCursor = true,
  showMeasureHighlight = true,
}: AbcjsRendererProps, ref: React.ForwardedRef<AbcjsRendererHandle>) {
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewHeight, setWebViewHeight] = useState(100);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingAudio, setIsExportingAudio] = useState(false);

  // ── PanResponder 오버레이: RN 레벨에서 드래그/탭 판별 ──
  const TAP_SLOP = 8;
  const TAP_MS   = 350;
  const gestureRef = useRef({ startTime: 0, isDrag: false, grantOffset: 0 });
  const onScrollDeltaRef = useRef(onScrollDelta);
  useEffect(() => { onScrollDeltaRef.current = onScrollDelta; }, [onScrollDelta]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) =>
        Math.abs(gs.dy) > TAP_SLOP && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => {
        gestureRef.current = { startTime: Date.now(), isDrag: false, grantOffset: 0 };
      },
      onPanResponderMove: (_e, gs) => {
        if (Math.abs(gs.dy) > TAP_SLOP && Math.abs(gs.dy) > Math.abs(gs.dx)) {
          if (!gestureRef.current.isDrag) {
            // 드래그 시작 시점의 gs.dy를 기준점으로 기록
            gestureRef.current.isDrag = true;
            gestureRef.current.grantOffset = gs.dy;
          }
          // 드래그 시작 기준점 대비 순수 이동량만 전달
          const adjustedDy = gs.dy - gestureRef.current.grantOffset;
          onScrollDeltaRef.current?.(adjustedDy);
        }
      },
      onPanResponderRelease: (e, gs) => {
        if (gestureRef.current.isDrag) {
          // 드래그 종료 신호
          onScrollDeltaRef.current?.(NaN);
        } else {
          const dt = Date.now() - gestureRef.current.startTime;
          if (Math.abs(gs.dx) < TAP_SLOP && Math.abs(gs.dy) < TAP_SLOP && dt < TAP_MS) {
            webViewRef.current?.postMessage(JSON.stringify({
              type: 'TAP',
              x: e.nativeEvent.locationX,
              y: e.nativeEvent.locationY,
            }));
          }
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // ── combined ABC 빌드 (스케일 + 메트로놈 프리픽스 포함) ──
  const buildCombinedAbc = useCallback(() => {
    const lines = abcString.split('\n');
    const isHeader = (l: string) => (/^[A-Z]:/.test(l) && !/^V:/.test(l)) || /^%%/.test(l);
    const headerLines = lines.filter(isHeader);
    const bodyLines   = lines.filter(l => !isHeader(l));
    const headerStr   = headerLines.join('\n');
    const isGrandStaff = abcString.includes('V:V1') || abcString.includes('V:V2');

    const [topStr, bottomStr] = timeSignature.split('/');
    const bottom = parseInt(bottomStr, 10) || 4;
    const top    = parseInt(topStr,    10) || 4;
    const multiplier      = 16 / bottom;
    const sixteenthsPerBar = top * (16 / bottom);

    let scalePrepend = '';
    if (prependBasePitch) {
      const ascending  = SCALE_NOTES[keySignature] || SCALE_NOTES['C'];
      const descending = [...ascending].slice(0, -1).reverse();
      const allNotes   = [...ascending, ...descending, 'z'];
      let barPos = 0;
      scalePrepend += `[Q:${scaleTempo}] `;
      for (const n of allNotes) {
        scalePrepend += `${n}${multiplier} `;
        barPos += multiplier;
        if (barPos >= sixteenthsPerBar) { scalePrepend += '| '; barPos = 0; }
      }
      if (barPos > 0) scalePrepend += '| ';
      scalePrepend += `[Q:${tempo}] `;
    }

    let metronomePrepend = '';
    if (prependMetronome) {
      for (let i = 0; i < top; i++) metronomePrepend += `z${multiplier} `;
      metronomePrepend += '| ';
    }

    const prepends = scalePrepend + metronomePrepend;

    if (!isGrandStaff) {
      return headerStr + '\n' + prepends + bodyLines.join('\n');
    }

    const bodyStr  = bodyLines.join('\n');
    const v1Match  = bodyStr.match(/^(V:V1[^\n]*\n)([\s\S]*?)(?=\nV:V2|\n*$)/m);
    const v2Match  = bodyStr.match(/(\nV:V2[^\n]*\n)([\s\S]*)$/m);
    if (!v1Match || !v2Match) return headerStr + '\n' + prepends + bodyStr;

    let bassSilence = '';
    if (prependBasePitch) {
      let barPos = 0;
      for (let i = 0; i < 16; i++) {
        bassSilence += `z${multiplier} `;
        barPos += multiplier;
        if (barPos >= sixteenthsPerBar) { bassSilence += '| '; barPos = 0; }
      }
      if (barPos > 0) bassSilence += '| ';
    }
    if (prependMetronome) {
      for (let i = 0; i < top; i++) bassSilence += `z${multiplier} `;
      bassSilence += '| ';
    }
    return headerStr + '\n' + v1Match[1] + prepends + v1Match[2] + v2Match[1] + bassSilence + v2Match[2];
  }, [abcString, prependBasePitch, prependMetronome, timeSignature, tempo, scaleTempo, keySignature]);

  const combinedAbc = buildCombinedAbc();

  // ── WebView로 데이터 전송 ──
  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({
      type: 'UPDATE_ABC',
      abc: abcString,
      combinedAbc,
      selectedNote: selectedNote || null,
      examMode,
      examWaitSeconds,
      prependMetronome,
      prependBasePitch,
      metronomeFreq,
      timeSignature,
      tempo,
      scaleTempo,
      keySignature,
      stretchLast,
      playbackMode: playbackMode || null,
      hideNotes,
      showNoteCursor,
      showMeasureHighlight,
      apExamSettings: apExamSettings || null,
      koreanExamSettings: koreanExamSettings || null,
      echoSettings: echoSettings || null,
      customPlaySettings: customPlaySettings || null,
    }));
  }, [abcString, combinedAbc, selectedNote, webViewReady,
      examMode, examWaitSeconds, prependMetronome, prependBasePitch,
      metronomeFreq, timeSignature, tempo, scaleTempo, keySignature, stretchLast,
      playbackMode, hideNotes, showNoteCursor, showMeasureHighlight,
      apExamSettings, koreanExamSettings, echoSettings, customPlaySettings]);

  // ── RN 파일 저장: 기기에 직접 저장 + 공유 시트 제공 ──
  const saveToDevice = useCallback(async (base64: string, ext: string, mime: string) => {
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safe     = scoreTitle.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const filename = `${safe}_${ts}.${ext}`;
    const cacheUri = (FileSystem.cacheDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(cacheUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isImage = ext === 'png';
    let savedToLib = false;

    if (isImage) {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(cacheUri);
          savedToLib = true;
        }
      } catch {}
    }

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(cacheUri, {
          mimeType: mime,
          dialogTitle: savedToLib
            ? `갤러리 저장 완료 — 다른 앱으로도 공유할 수 있습니다`
            : `${ext.toUpperCase()} 파일 저장`,
          UTI: isImage ? 'public.png' : 'public.audio',
        });
      } else if (savedToLib) {
        Alert.alert('저장 완료', `사진 앱에 저장되었습니다.\n파일명: ${filename}`);
      } else {
        Alert.alert('저장 실패', '파일을 저장할 수 없습니다.');
      }
    } catch {
      if (savedToLib) {
        Alert.alert('저장 완료', `사진 앱에 저장되었습니다.\n파일명: ${filename}`);
      }
    }
  }, [scoreTitle]);

  // ── WebView 메시지 수신 ──
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'READY':
          setWebViewReady(true);
          break;
        case 'NOTE_CLICK':
          onNoteClick?.(msg.index, msg.voice);
          break;
        case 'PLAY_STATE':
          onPlayStateChange?.(msg.isPlaying);
          break;

        case 'HEIGHT': {
          // 악보 전체 높이 + 아주 작은 여유 (하단 잘림 방지)
          const h = Math.max((msg.height as number) + 40, 100);
          setWebViewHeight(h);
          break;
        }
        case 'EXPORT_IMAGE_DATA':
          setIsExportingImage(false);
          saveToDevice(msg.base64, 'png', 'image/png').catch(() => {
            Alert.alert('오류', '이미지 저장에 실패했습니다.');
          });
          break;
        case 'EXPORT_IMAGE_ERROR':
          setIsExportingImage(false);
          Alert.alert('오류', '악보 이미지를 생성할 수 없습니다.');
          break;
        case 'EXPORT_AUDIO_DATA':
          setIsExportingAudio(false);
          saveToDevice(msg.base64, 'wav', 'audio/wav').then(() => {
            onAudioSaveSuccess?.();
          }).catch(() => {
            Alert.alert('오류', '음원 저장에 실패했습니다.');
          });
          break;
        case 'EXPORT_AUDIO_ERROR':
          setIsExportingAudio(false);
          Alert.alert('오류', msg.message || '음원 생성에 실패했습니다.');
          break;
      }
    } catch {}
  }, [onNoteClick, onPlayStateChange, saveToDevice, onAudioSaveSuccess]);

  const togglePlay = useCallback(() => {
    if (!webViewRef.current || !abcString) return;
    webViewRef.current.postMessage(JSON.stringify({ type: 'TOGGLE_PLAY' }));
  }, [abcString]);

  const requestExportImage = useCallback(() => {
    if (!webViewRef.current || !abcString) return;
    setIsExportingImage(true);
    webViewRef.current.postMessage(JSON.stringify({ type: 'EXPORT_IMAGE' }));
  }, [abcString]);

  const requestExportAudio = useCallback(() => {
    if (!webViewRef.current || !abcString) return;
    setIsExportingAudio(true);
    webViewRef.current.postMessage(JSON.stringify({ type: 'EXPORT_AUDIO' }));
  }, [abcString]);

  useImperativeHandle(ref, () => ({
    togglePlay,
    requestExportImage,
    requestExportAudio,
  }), [togglePlay, requestExportImage, requestExportAudio]);

  return (
    <View style={[styles.container, { height: webViewHeight }]}>
      {/* pointerEvents="none" 래퍼로 WebView의 네이티브 터치 가로채기를 완전 차단 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <WebView
          ref={webViewRef}
          source={{ html: WEBVIEW_HTML }}
          style={[styles.webView, { height: webViewHeight, opacity: webViewReady ? 1 : 0 }]}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          allowUniversalAccessFromFileURLs
          scrollEnabled={false}
          overScrollMode="never"
          nestedScrollEnabled={false}
          androidLayerType="hardware"
        />
      </View>
      {/* PanResponder 오버레이: 드래그→scrollTo, 탭→WebView에 좌표 전달 */}
      <View style={styles.overlay} {...panResponder.panHandlers} />
    </View>
  );
});

// ─── WebView HTML (시험용 마디 재생 + WAV 내보내기 포함) ──────────────────────
const WEBVIEW_HTML = `<!DOCTYPE html>
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
    touch-action: pan-y !important;
  }

  .abcjs-note, .abcjs-rest, .abcjs-staff-extra {
    cursor: pointer;
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

  /* ── 재생 커서 ── */
  .abcjs-playback-cursor {
    stroke: #3b82f6;
    stroke-width: 3;
    stroke-linecap: round;
    opacity: 0.85;
    pointer-events: none;
  }
  .abcjs-measure-hl {
    fill: rgba(99,102,241,0.07);
    pointer-events: none;
  }
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

<script src="https://cdn.jsdelivr.net/npm/abcjs@6.4.2/dist/abcjs-basic-min.js"></script>
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
  var currentVisualObj   = null;
  var timingCallbacks    = null;
  var cursorSvgLine      = null;
  var measureHlRect      = null;
  var highlightedEls     = [];

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

    var renderResult = ABCJS.renderAbc('score-container', abc, {
      add_classes: true,
      responsive: 'resize',
      scale: 1.2,
      staffwidth: 800,
      wrap: { minSpacing: 1.8, maxSpacing: 1.8, preferredMeasuresPerLine: 4 },
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
    currentVisualObj = renderResult && renderResult[0];
    cursorSvgLine = null;
    measureHlRect = null;

    // 렌더링 완료 후 여러 타이밍에 높이 측정 (abcjs SVG 렌더링이 비동기이므로)
    setTimeout(function() { applyHighlight(selectedNote); reportHeight(); }, 100);
    setTimeout(reportHeight, 300);
    setTimeout(reportHeight, 600);
  }

  function applyHighlight(sel) {
    var ct = document.getElementById('score-container'); if (!ct) return;
    ct.querySelectorAll('.abcjs-note,.abcjs-rest').forEach(function(el) {
      el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) { c.style.fill='#000'; });
    });
    if (!sel || sel.index < 0) return;
    var vc  = sel.voice === 'bass' ? 'abcjs-v1' : 'abcjs-v0';
    var all = Array.from(ct.querySelectorAll('.' + vc + '.abcjs-note, .' + vc + '.abcjs-rest'));
    var t   = all[sel.index];
    if (t) t.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) { c.style.fill='#ef4444'; });
  }

  /* ── 재생 커서/하이라이트 ── */
  function ensureCursorLine() {
    if (cursorSvgLine) return cursorSvgLine;
    var svg = document.querySelector('#score-container svg');
    if (!svg) return null;
    cursorSvgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cursorSvgLine.setAttribute('class', 'abcjs-playback-cursor');
    cursorSvgLine.style.display = 'none';
    svg.appendChild(cursorSvgLine);
    return cursorSvgLine;
  }
  function ensureMeasureRect() {
    if (measureHlRect) return measureHlRect;
    var svg = document.querySelector('#score-container svg');
    if (!svg) return null;
    measureHlRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    measureHlRect.setAttribute('class', 'abcjs-measure-hl');
    measureHlRect.style.display = 'none';
    svg.insertBefore(measureHlRect, svg.firstChild);
    return measureHlRect;
  }

  function clearPlaybackCursor() {
    if (cursorSvgLine) cursorSvgLine.style.display = 'none';
    if (measureHlRect) measureHlRect.style.display = 'none';
    highlightedEls.forEach(function(el) {
      if (el) el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) {
        c.style.fill = '';
      });
    });
    highlightedEls = [];
  }

  function onPlaybackEvent(event) {
    clearPlaybackCursor();
    if (!event) return;

    // 커서 라인 (수직선)
    if (currentParams.showNoteCursor) {
      var line = ensureCursorLine();
      if (line && event.left !== undefined) {
        line.setAttribute('x1', event.left);
        line.setAttribute('x2', event.left);
        line.setAttribute('y1', event.top);
        line.setAttribute('y2', event.top + event.height);
        line.style.display = '';
      }

      // 현재 음표 요소 색상 변경
      if (event.elements) {
        event.elements.forEach(function(elArr) {
          if (!elArr) return;
          elArr.forEach(function(el) {
            if (!el) return;
            el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) {
              c.style.fill = '#3b82f6';
            });
            highlightedEls.push(el);
          });
        });
      }
    }

    // 마디 배경 하이라이트 — 바선(.abcjs-bar) 기반
    if (currentParams.showMeasureHighlight && event.left !== undefined) {
      var ct2 = document.getElementById('score-container');
      var svg2 = ct2 ? ct2.querySelector('svg') : null;
      if (svg2) {
        var noteX = event.left;
        var noteTop = event.top;
        var noteH = event.height;

        var bars = svg2.querySelectorAll('.abcjs-bar');
        var barPositions = [];
        bars.forEach(function(b) {
          var r = b.getBBox();
          barPositions.push({ x: r.x, top: r.y, bottom: r.y + r.height });
        });

        // 같은 줄(y 범위 겹침) 바선만 추출
        var sameLine = barPositions.filter(function(bp) {
          return bp.top < noteTop + noteH && bp.bottom > noteTop;
        });

        // 현재 음표를 기준으로 좌·우 경계 바선 결정
        var leftBar = null, rightBar = null;
        for (var si = 0; si < sameLine.length; si++) {
          if (sameLine[si].x <= noteX) {
            if (!leftBar || sameLine[si].x > leftBar.x) leftBar = sameLine[si];
          }
          if (sameLine[si].x > noteX) {
            if (!rightBar || sameLine[si].x < rightBar.x) rightBar = sameLine[si];
          }
        }

        var mLeft = leftBar ? leftBar.x : 0;
        var mRight = rightBar ? rightBar.x : (leftBar ? leftBar.x + 200 : noteX + 100);
        var mTop2 = sameLine.length > 0 ? sameLine[0].top : noteTop;
        var mBottom = sameLine.length > 0 ? sameLine[0].bottom : noteTop + noteH;
        for (var sj = 1; sj < sameLine.length; sj++) {
          mTop2 = Math.min(mTop2, sameLine[sj].top);
          mBottom = Math.max(mBottom, sameLine[sj].bottom);
        }

        // 큰보표: 같은 시스템(줄)의 다른 보표 바선까지 세로 범위 확장
        // 시스템 내부 간격 < staffH < 시스템 간 간격이므로 staffH를 threshold로 사용
        // staffH는 초기값 고정 — 루프 내 재계산 시 threshold가 커져 다른 줄을 침범함
        var xEps = 2;
        var refX = leftBar ? leftBar.x : (rightBar ? rightBar.x : -1);
        if (refX >= 0) {
          var staffH = mBottom - mTop2;
          var maxGap = staffH;
          for (var bj = 0; bj < barPositions.length; bj++) {
            var bp = barPositions[bj];
            if (Math.abs(bp.x - refX) > xEps) continue;
            var gapBelow = bp.top - mBottom;
            var gapAbove = mTop2 - bp.bottom;
            if ((gapBelow >= -5 && gapBelow <= maxGap) ||
                (gapAbove >= -5 && gapAbove <= maxGap)) {
              mTop2 = Math.min(mTop2, bp.top);
              mBottom = Math.max(mBottom, bp.bottom);
            }
          }
        }

        var rect = ensureMeasureRect();
        if (rect) {
          rect.setAttribute('x', mLeft);
          rect.setAttribute('y', mTop2);
          rect.setAttribute('width', mRight - mLeft);
          rect.setAttribute('height', mBottom - mTop2);
          rect.setAttribute('rx', '4');
          rect.style.display = '';
        }
      }
    }
  }

  function startTimingCallbacks(delayMs) {
    stopTimingCallbacks();
    if (!currentVisualObj) return;
    if (!currentParams.showNoteCursor && !currentParams.showMeasureHighlight) return;
    try {
      timingCallbacks = new ABCJS.TimingCallbacks(currentVisualObj, {
        eventCallback: onPlaybackEvent,
        beatSubdivisions: 4,
      });
    } catch(e) { return; }
    if (delayMs > 0) {
      playTimeout2 = setTimeout(function() {
        if (isPlayingState && timingCallbacks) {
          try { timingCallbacks.start(); } catch(e) {}
        }
      }, delayMs);
    } else {
      try { timingCallbacks.start(); } catch(e) {}
    }
  }
  var playTimeout2 = null;

  function stopTimingCallbacks() {
    if (playTimeout2) { clearTimeout(playTimeout2); playTimeout2 = null; }
    if (timingCallbacks) {
      try { timingCallbacks.stop(); } catch(e) {}
      timingCallbacks = null;
    }
    clearPlaybackCursor();
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
    var v1 = bodyStr.match(/V:V1[^\\n]*\\n([\\s\\S]*?)(?=\\nV:V2)/m);
    var v2 = bodyStr.match(/V:V2[^\\n]*\\n([\\s\\S]*)$/m);
    return {
      header: header, isGrand: true,
      treble: splitBodyMeasures(v1 ? v1[1] : ''),
      bass:   splitBodyMeasures(v2 ? v2[1] : ''),
    };
  }
  function rebuildSegmentAbc(header, isGrand, treble, bass) {
    if (!isGrand) return header + '\\n' + treble.join(' | ') + ' |]';
    return header + '\\nV:V1 clef=treble\\n' + treble.join(' | ') + ' |]' +
                    '\\nV:V2 clef=bass\\n'   + bass.join(' | ')   + ' |]';
  }

  /* ── 일반 재생 ── */
  function stopAudio() {
    cancelFlag = true;
    if (synthInstance) { try { synthInstance.stop(); } catch(e) {} synthInstance = null; }
    if (playTimeout)   { clearTimeout(playTimeout); playTimeout = null; }
    stopTimingCallbacks();
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

        var prependDelay = 0;
        if (p.prependBasePitch) prependDelay += 16 * sBeat;
        if (p.prependMetronome) prependDelay += top * beat;
        startTimingCallbacks(prependDelay * 1000);

        var dur = (res && res.duration) ? res.duration : 30;
        playTimeout = setTimeout(function() {
          if (isPlayingState) {
            isPlayingState = false; synthInstance = null;
            stopTimingCallbacks();
            setPlayBtnUI(false); postMsg({ type:'PLAY_STATE', isPlaying:false }); reportHeight();
          }
        }, (dur + 2) * 1000);
      }).catch(function() { stopAudio(); });
  }

  /* ── 시험용 재생: 마디 단위 순차 ── */
  function playSingleAbcAsync(abc, durationSec) {
    return new Promise(function(resolve) {
      if (cancelFlag) { resolve(); return; }
      var parsed = ABCJS.renderAbc('synth-target', abc, {});
      var vo = parsed && parsed[0];
      if (!vo) { resolve(); return; }
      var synth = new ABCJS.synth.CreateSynth();
      synthInstance = synth;
      synth.init({ audioContext: audioCtx, visualObj: vo,
                   options:{ soundFontVolumeMultiplier:2.0 } })
        .then(function(){ return synth.prime(); })
        .then(function(){
          synth.start();
          var waitMs = durationSec * 1000 + 200;
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
      var segAbc = rebuildSegmentAbc(parts.header, parts.isGrand,
        parts.treble.slice(from, end),
        parts.isGrand ? parts.bass.slice(from, end) : []);
      return playSingleAbcAsync(segAbc, count * measureDur);
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
        'Am':['A,','B,','C','D','E','F','G','A'],'Em':['E','F','G','A','B','c','d','e'],
        'Bm':['B,','C','D','E','F','G','A','B'],'F#m':['F,','G,','A,','B,','C','D','E','F'],
        'Dm':['D','E','F','G','A','B','c','d'],'Gm':['G,','A,','B,','C','D','E','F','G'],
        'Cm':['C','D','E','F','G','A','B','c'] };
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

    Promise.resolve()
      .then(function() {
        // 1) 스케일
        if (!p.prependBasePitch || cancelFlag) return;
        return playSingleAbcAsync(buildScaleAbc(), 16 * sBeat);
      })
      .then(function() {
        // 2) 메트로놈 → 전체 → 휴식
        if (cancelFlag) return;
        return playMetro()
          .then(function(){ return cancelFlag ? null : playRange(0, N); })
          .then(function(){ return cancelFlag ? null : rest(); });
      })
      .then(function() {
        // 3) 2마디 단위 반복
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
        // 4) 마지막: 메트로놈 → 전체
        if (cancelFlag) return;
        return playMetro().then(function(){ return cancelFlag ? null : playRange(0, N); });
      })
      .then(function() {
        stopTimingCallbacks();
        isPlayingState = false; setPlayBtnUI(false);
        postMsg({ type:'PLAY_STATE', isPlaying:false }); reportHeight();
      });
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
    ct.querySelectorAll('.abcjs-note,.abcjs-rest').forEach(function(el) {
      el.querySelectorAll('path,ellipse,polygon,polyline,rect,use').forEach(function(c) {
        c.style.visibility = hide ? 'hidden' : 'visible';
      });
    });
    // 잇단음표(트리플릿) 숫자·괄호도 같이 숨기기
    ct.querySelectorAll('.abcjs-triplet').forEach(function(el) {
      el.querySelectorAll('path,text,line').forEach(function(c) {
        c.style.visibility = hide ? 'hidden' : 'visible';
      });
    });
    // 꼬리·빔·가림줄 — 단, 박자표(.abcjs-staff-extra) 안은 보존
    ct.querySelectorAll('.abcjs-stem,.abcjs-beam-elem,.abcjs-ledger').forEach(function(el) {
      if (el.closest && el.closest('.abcjs-staff-extra')) return;
      // 선두(staff-extra) 영역의 bbox와 겹치면 박자표 꼬리로 판단해 보존
      var extras = ct.querySelectorAll('.abcjs-staff-extra');
      var skip = false;
      try {
        var elBox = el.getBBox ? el.getBBox() : null;
        if (elBox) {
          var eCx = elBox.x + elBox.width / 2, eCy = elBox.y + elBox.height / 2;
          for (var xi = 0; xi < extras.length; xi++) {
            var exBox = extras[xi].getBBox();
            if (eCx >= exBox.x && eCx <= exBox.x + exBox.width &&
                eCy >= exBox.y && eCy <= exBox.y + exBox.height) { skip = true; break; }
          }
        }
      } catch(e) {}
      if (skip) return;
      el.querySelectorAll('path,line,rect').forEach(function(c) {
        c.style.visibility = hide ? 'hidden' : 'visible';
      });
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

// ─── 스타일 ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
  },
  webView: {
    width: '100%',
    backgroundColor: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});

export default AbcjsRendererBase;
