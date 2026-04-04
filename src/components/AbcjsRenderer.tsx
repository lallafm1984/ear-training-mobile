import React, { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View, StyleSheet, Platform, PanResponder,
} from 'react-native';
import { useAlert } from '../context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { APExamSettings, KoreanExamSettings, EchoSettings, CustomPlaySettings } from '../types';
import { generateAbcScaleNotes } from '../lib';
import { WEBVIEW_HTML } from './abcjsWebViewHtml';

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
  /** 한 줄에 표시할 마디 수. 미지정 시 총 마디 수 기반 자동 결정 */
  barsPerStaff?: number;
}

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
  barsPerStaff,
}: AbcjsRendererProps, ref: React.ForwardedRef<AbcjsRendererHandle>) {
  const { showAlert } = useAlert();
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
  // 일반 재생 모드일 때만 스케일·카운트인 프리픽스를 추가
  const isNormalMode = !examMode && !playbackMode;
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
    if (isNormalMode && prependBasePitch) {
      const ascending  = generateAbcScaleNotes(keySignature);
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
    if (isNormalMode && prependMetronome) {
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
    if (isNormalMode && prependBasePitch) {
      let barPos = 0;
      for (let i = 0; i < 16; i++) {
        bassSilence += `z${multiplier} `;
        barPos += multiplier;
        if (barPos >= sixteenthsPerBar) { bassSilence += '| '; barPos = 0; }
      }
      if (barPos > 0) bassSilence += '| ';
    }
    if (isNormalMode && prependMetronome) {
      for (let i = 0; i < top; i++) bassSilence += `z${multiplier} `;
      bassSilence += '| ';
    }
    return headerStr + '\n' + v1Match[1] + prepends + v1Match[2] + v2Match[1] + bassSilence + v2Match[2];
  }, [abcString, prependBasePitch, prependMetronome, timeSignature, tempo, scaleTempo, keySignature, isNormalMode]);

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
      barsPerStaff: barsPerStaff || null,
    }));
  }, [abcString, combinedAbc, selectedNote, webViewReady,
      examMode, examWaitSeconds, prependMetronome, prependBasePitch,
      metronomeFreq, timeSignature, tempo, scaleTempo, keySignature, stretchLast,
      playbackMode, hideNotes, showNoteCursor, showMeasureHighlight,
      apExamSettings, koreanExamSettings, echoSettings, customPlaySettings, barsPerStaff]);

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
        showAlert({ title: '저장 완료', message: `사진 앱에 저장되었습니다.\n파일명: ${filename}`, type: 'success' });
      } else {
        showAlert({ title: '저장 실패', message: '파일을 저장할 수 없습니다.', type: 'error' });
      }
    } catch {
      if (savedToLib) {
        showAlert({ title: '저장 완료', message: `사진 앱에 저장되었습니다.\n파일명: ${filename}`, type: 'success' });
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
          // 악보 전체 높이 + 하단 여유 (잘림 방지)
          const h = Math.max((msg.height as number) + 20, 100);
          setWebViewHeight(h);
          break;
        }
        case 'EXPORT_IMAGE_DATA':
          setIsExportingImage(false);
          saveToDevice(msg.base64, 'png', 'image/png').catch(() => {
            showAlert({ title: '오류', message: '이미지 저장에 실패했습니다.', type: 'error' });
          });
          break;
        case 'EXPORT_IMAGE_ERROR':
          setIsExportingImage(false);
          showAlert({ title: '오류', message: '악보 이미지를 생성할 수 없습니다.', type: 'error' });
          break;
        case 'EXPORT_AUDIO_DATA':
          setIsExportingAudio(false);
          saveToDevice(msg.base64, 'wav', 'audio/wav').then(() => {
            onAudioSaveSuccess?.();
          }).catch(() => {
            showAlert({ title: '오류', message: '음원 저장에 실패했습니다.', type: 'error' });
          });
          break;
        case 'EXPORT_AUDIO_ERROR':
          setIsExportingAudio(false);
          showAlert({ title: '오류', message: msg.message || '음원 생성에 실패했습니다.', type: 'error' });
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
          originWhitelist={['about:*']}
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
