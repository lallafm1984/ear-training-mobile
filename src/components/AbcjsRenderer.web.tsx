import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface AbcjsRendererProps {
  abcString: string;
  prependBasePitch?: boolean;
  prependMetronome?: boolean;
  timeSignature?: string;
  tempo?: number;
  scaleTempo?: number;
  keySignature?: string;
  metronomeFreq?: number;
  examMode?: boolean;
  examWaitSeconds?: number;
  stretchLast?: boolean;
  onNoteClick?: (noteIndex: number, voice: 'treble' | 'bass') => void;
  selectedNote?: { index: number; voice: 'treble' | 'bass' } | null;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  isExporting?: boolean;
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

export default function AbcjsRenderer({
  abcString,
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
  selectedNote,
  isPlaying = false,
  onPlayToggle,
  isExporting = false,
}: AbcjsRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingMsgRef = useRef<string | null>(null);

  const buildCombinedAbc = useCallback(() => {
    const lines = abcString.split('\n');
    const isHeader = (l: string) => (/^[A-Z]:/.test(l) && !/^V:/.test(l)) || /^%%/.test(l);
    const headerLines = lines.filter(isHeader);
    const bodyLines = lines.filter(l => !isHeader(l));
    const headerStr = headerLines.join('\n');
    const isGrandStaff = abcString.includes('V:V1') || abcString.includes('V:V2');

    const [topStr, bottomStr] = timeSignature.split('/');
    const bottom = parseInt(bottomStr, 10) || 4;
    const top = parseInt(topStr, 10) || 4;
    const multiplier = 16 / bottom;
    const sixteenthsPerBar = top * (16 / bottom);

    let scalePrepend = '';
    if (prependBasePitch) {
      const ascending = SCALE_NOTES[keySignature] || SCALE_NOTES['C'];
      const descending = [...ascending].slice(0, -1).reverse();
      const allNotes = [...ascending, ...descending, 'z'];
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

    const bodyStr = bodyLines.join('\n');
    const v1Match = bodyStr.match(/^(V:V1[^\n]*\n)([\s\S]*?)(?=\nV:V2|\n*$)/m);
    const v2Match = bodyStr.match(/(\nV:V2[^\n]*\n)([\s\S]*)$/m);

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

  const postToIframe = useCallback((msg: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    }
  }, []);

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'READY') {
          readyRef.current = true;
          if (pendingMsgRef.current) {
            postToIframe(pendingMsgRef.current);
            pendingMsgRef.current = null;
          }
        } else if (msg.type === 'NOTE_CLICK' && onNoteClick) {
          onNoteClick(msg.index, msg.voice);
        }
        // PLAY_STATE is handled by parent via isPlaying prop
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onNoteClick, postToIframe]);

  // Send UPDATE_ABC whenever props change
  useEffect(() => {
    const msg = JSON.stringify({
      type: 'UPDATE_ABC',
      abc: abcString,
      combinedAbc,
      selectedNote: selectedNote || null,
      isPlaying,
      examMode,
      examWaitSeconds,
      prependMetronome,
      prependBasePitch,
      metronomeFreq,
      timeSignature,
      tempo,
      scaleTempo,
      keySignature,
    });
    if (readyRef.current) {
      postToIframe(msg);
    } else {
      pendingMsgRef.current = msg;
    }
  }, [abcString, combinedAbc, selectedNote, isPlaying, examMode, examWaitSeconds,
      prependMetronome, prependBasePitch, metronomeFreq, timeSignature, tempo, scaleTempo,
      keySignature, postToIframe]);

  const handlePlayToggle = useCallback(() => {
    if (onPlayToggle) onPlayToggle();
    postToIframe(JSON.stringify({
      type: 'PLAY_TOGGLE',
      combinedAbc,
      examMode,
      examWaitSeconds,
      prependMetronome,
      prependBasePitch,
      metronomeFreq,
      timeSignature,
      tempo,
      scaleTempo,
      keySignature,
    }));
  }, [onPlayToggle, combinedAbc, examMode, examWaitSeconds, prependMetronome, prependBasePitch,
      metronomeFreq, timeSignature, tempo, scaleTempo, keySignature, postToIframe]);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; font-family: -apple-system, sans-serif; overflow-x: hidden; }
  #score-container { width: 100%; min-height: 120px; padding: 8px 4px; }
  #score-container svg { width: 100% !important; height: auto !important; }
  .abcjs-note:hover, .abcjs-rest:hover { cursor: pointer; }
</style>
</head>
<body>
<div id="score-container"></div>
<script src="https://cdn.jsdelivr.net/npm/abcjs@6.4.2/dist/abcjs-basic-min.js"></script>
<script>
var currentAbc = '';
var synthInstance = null;
var audioCtx = null;
var isPlayingState = false;
var cancelFlag = false;
var playTimeout = null;

// Web bridge: use window.parent.postMessage instead of ReactNativeWebView
var bridge = {
  postMessage: function(data) {
    window.parent.postMessage(data, '*');
  }
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function createMetronomeClick(ctx, startTime, isAccent, frequency) {
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = frequency;
  osc.type = 'sine';
  gain.gain.setValueAtTime(isAccent ? 0.7 : 0.4, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);
  osc.start(startTime);
  osc.stop(startTime + 0.05);
}

function renderScore(abc, selectedNote) {
  if (!abc) return;
  currentAbc = abc;
  ABCJS.renderAbc('score-container', abc, {
    add_classes: true,
    responsive: 'resize',
    scale: 1.1,
    staffwidth: window.innerWidth - 20,
    wrap: { minSpacing: 1.6, maxSpacing: 2.0, preferredMeasuresPerLine: 4 },
    clickListener: function(abcElem, tuneNumber, classes, analysis, drag) {
      if (!analysis) return;
      var el = analysis.selectableElement;
      if (!el) return;
      var voiceIdx = analysis.voice || 0;
      var voice = voiceIdx === 1 ? 'bass' : 'treble';
      var voiceClass = voiceIdx === 1 ? 'abcjs-v1' : 'abcjs-v0';
      var container = document.getElementById('score-container');
      var allNotes = Array.from(container.querySelectorAll('.' + voiceClass + '.abcjs-note, .' + voiceClass + '.abcjs-rest'));
      var idx = allNotes.indexOf(el);
      if (idx >= 0) {
        bridge.postMessage(JSON.stringify({ type: 'NOTE_CLICK', index: idx, voice: voice }));
      }
    }
  });
  applyHighlight(selectedNote);
}

function applyHighlight(selectedNote) {
  var container = document.getElementById('score-container');
  if (!container) return;
  container.querySelectorAll('.abcjs-note, .abcjs-rest').forEach(function(el) {
    el.querySelectorAll('path, ellipse, polygon, polyline, rect, use').forEach(function(child) {
      child.style.fill = '#000';
    });
  });
  if (!selectedNote || selectedNote.index < 0) return;
  var voiceClass = selectedNote.voice === 'bass' ? 'abcjs-v1' : 'abcjs-v0';
  var allNotes = Array.from(container.querySelectorAll('.' + voiceClass + '.abcjs-note, .' + voiceClass + '.abcjs-rest'));
  var target = allNotes[selectedNote.index];
  if (target) {
    target.querySelectorAll('path, ellipse, polygon, polyline, rect, use').forEach(function(child) {
      child.style.fill = '#ef4444';
    });
  }
}

async function playAudio(combinedAbc, examMode, examWaitSeconds, prependMetronome, prependBasePitch, metronomeFreq, timeSignature, tempo, scaleTempo, keySignature) {
  if (isPlayingState) {
    cancelFlag = true;
    if (synthInstance) { try { synthInstance.stop(); } catch(e){} }
    if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
    isPlayingState = false;
    bridge.postMessage(JSON.stringify({ type: 'PLAY_STATE', isPlaying: false }));
    return;
  }
  isPlayingState = true;
  cancelFlag = false;
  bridge.postMessage(JSON.stringify({ type: 'PLAY_STATE', isPlaying: true }));
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    var parts = timeSignature.split('/');
    var top = parseInt(parts[0]) || 4;
    var bottom = parseInt(parts[1]) || 4;
    var beatDuration = 60 / tempo;
    var actualBeatDuration = beatDuration * (4 / bottom);
    var scaleBeatDuration = (60 / scaleTempo) * (4 / bottom);
    var parsed = ABCJS.renderAbc("*", combinedAbc, { responsive: 'resize' });
    var visualObj = parsed && parsed[0];
    if (visualObj && visualObj.lines && visualObj.lines.length) {
      var synth = new ABCJS.synth.CreateSynth();
      synthInstance = synth;
      await synth.init({ audioContext: audioCtx, visualObj: visualObj });
      await synth.prime();
      if (prependMetronome) {
        var metroStart = prependBasePitch ? 16 * scaleBeatDuration : 0;
        for (var i = 0; i < top; i++) {
          createMetronomeClick(audioCtx, audioCtx.currentTime + metroStart + i * actualBeatDuration, i === 0, metronomeFreq);
        }
      }
      synth.start();
      var totalDuration = visualObj.getTotalTime ? visualObj.getTotalTime() : 0;
      if (!totalDuration || isNaN(totalDuration)) {
        var bodyStr = combinedAbc.split('\\n').filter(function(l) {
          return !/^[A-Z]:/.test(l) && !/^%%/.test(l);
        }).join('\\n');
        var measures = (bodyStr.match(/\\|/g) || []).length;
        totalDuration =
          (prependBasePitch ? 16 * scaleBeatDuration : 0) +
          (prependMetronome ? top * actualBeatDuration : 0) +
          measures * top * actualBeatDuration;
      }
      var endMs = (totalDuration + 0.5) * 1000;
      playTimeout = setTimeout(function() {
        playTimeout = null;
        isPlayingState = false;
        bridge.postMessage(JSON.stringify({ type: 'PLAY_STATE', isPlaying: false }));
      }, Math.min(endMs, 120000));
    } else {
      isPlayingState = false;
      bridge.postMessage(JSON.stringify({ type: 'PLAY_STATE', isPlaying: false }));
    }
  } catch(e) {
    console.error('Playback error:', e);
    isPlayingState = false;
    bridge.postMessage(JSON.stringify({ type: 'PLAY_STATE', isPlaying: false }));
  }
}

window.addEventListener('message', function(event) {
  try {
    var msg = JSON.parse(event.data);
    if (msg.type === 'UPDATE_ABC') {
      renderScore(msg.abc, msg.selectedNote);
      if (msg.isPlaying !== isPlayingState) {
        if (msg.isPlaying) {
          playAudio(msg.combinedAbc, msg.examMode, msg.examWaitSeconds, msg.prependMetronome, msg.prependBasePitch, msg.metronomeFreq, msg.timeSignature, msg.tempo, msg.scaleTempo, msg.keySignature);
        } else {
          if (isPlayingState) {
            cancelFlag = true;
            if (synthInstance) { try { synthInstance.stop(); } catch(e){} }
            if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
            isPlayingState = false;
          }
        }
      }
    } else if (msg.type === 'PLAY_TOGGLE') {
      playAudio(msg.combinedAbc, msg.examMode, msg.examWaitSeconds, msg.prependMetronome, msg.prependBasePitch, msg.metronomeFreq, msg.timeSignature, msg.tempo, msg.scaleTempo, msg.keySignature);
    } else if (msg.type === 'HIGHLIGHT') {
      applyHighlight(msg.selectedNote);
    }
  } catch(e) {
    console.error('Message parse error:', e);
  }
});

// Initial ready notification
bridge.postMessage(JSON.stringify({ type: 'READY' }));
</script>
</body>
</html>`;

  const srcDoc = html;

  return (
    <View style={styles.container}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        style={iframeStyle}
        sandbox="allow-scripts allow-same-origin"
        scrolling="no"
      />
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.playBtn, isPlaying && styles.stopBtn]}
          onPress={handlePlayToggle}
          activeOpacity={0.8}
        >
          <Text style={styles.playBtnText}>
            {isPlaying ? '⏹ 정지' : '▶ 재생'}
          </Text>
        </TouchableOpacity>
        {isExporting && (
          <View style={styles.exportingRow}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.exportingText}>음원 생성 중...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const iframeStyle: React.CSSProperties = {
  width: '100%',
  height: 200,
  border: 'none',
  backgroundColor: '#fff',
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginTop: 8,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6366f1',
    borderRadius: 10,
  },
  stopBtn: {
    backgroundColor: '#ef4444',
  },
  playBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  exportingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportingText: {
    color: '#64748b',
    fontSize: 13,
  },
});
