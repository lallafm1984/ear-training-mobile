'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Switch, KeyboardAvoidingView, Platform, Pressable, Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useAlert, useSubscription, useAuth } from '../context';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScoreState, ScoreNote, NoteDuration, Accidental, PitchName, TupletType,
  generateAbc, getMeasureCount, getTupletNoteDuration, durationToSixteenths,
  getSixteenthsPerBar, sixteenthsToDuration, getValidTupletTypesForDuration,
  generateScore, Difficulty, DifficultyCategory, getDifficultyCategory,
  BassDifficulty, BASS_DIFF_LABELS, BASS_DIFF_DESC,
} from '../lib';
import { TRACK_META, buildGeneratorOptions } from '../lib/trackConfig';
import type { TrackType } from '../theme/colors';
import { AbcjsRenderer, UpgradeModal } from '../components';
import type { UpgradeReason } from '../components';
import {
  Sliders, Disc3, Sparkles, Archive, Download, Trash2, Undo,
  Save, X, ChevronDown, Music2, RefreshCw, FileAudio, Lock, UserCircle,
  Eye, EyeOff, FileCode, Copy, Crown,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { PLAN_NAME, PLAN_COLOR } from '../types';
import { useDownloadQuota } from '../hooks';
import PaywallScreen from './PaywallScreen';
import ProfileScreen from './ProfileScreen';
import type {
  PlaybackMode, APExamSettings, KoreanExamSettings, EchoSettings, CustomPlaySettings,
} from '../types';
import {
  PLAYBACK_MODE_LABELS, PLAYBACK_MODE_DESCRIPTIONS,
  DEFAULT_AP_SETTINGS, DEFAULT_KOREAN_SETTINGS,
  DEFAULT_ECHO_SETTINGS, DEFAULT_CUSTOM_SETTINGS,
  DEFAULT_PRACTICE_WAIT_SECONDS,
} from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── 쉼표 채우기 유틸 ──
function fillWithRests(sixteenths: number): NoteDuration[] {
  if (sixteenths <= 0) return [];
  const OPTIONS: [NoteDuration, number][] = [
    ['1', 16], ['2.', 12], ['2', 8], ['4.', 6], ['4', 4], ['8.', 3], ['8', 2], ['16', 1],
  ];
  const result: NoteDuration[] = [];
  let rem = sixteenths;
  for (const [dur, s] of OPTIONS) {
    while (rem >= s) { result.push(dur); rem -= s; }
  }
  return result;
}

interface SavedScore { id: string; title: string; state: ScoreState; savedAt: string; }

async function getSavedScores(): Promise<SavedScore[]> {
  try { const j = await AsyncStorage.getItem('melodygen_scores'); return j ? JSON.parse(j) : []; } catch { return []; }
}
async function persistScores(s: SavedScore[]) {
  await AsyncStorage.setItem('melodygen_scores', JSON.stringify(s));
}

const DURATIONS: { value: NoteDuration; label: string }[] = [
  { value: '1', label: '온' },
  { value: '2', label: '2분' },
  { value: '4', label: '4분' },
  { value: '8', label: '8분' },
  { value: '16', label: '16분' },
];
const ACCIDENTALS: { value: Accidental; label: string }[] = [
  { value: '', label: '없음' },
  { value: '#', label: '♯' },
  { value: 'b', label: '♭' },
  { value: 'n', label: '♮' },
];
const PITCHES: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const PITCH_LABELS: Record<string, string> = {
  C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시',
};
const PITCH_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  C: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  D: { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' },
  E: { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' },
  F: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  G: { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' },
  A: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  B: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
};
const DIFF_LABELS: Record<Difficulty, string> = {
  beginner_1: '초급 1', beginner_2: '초급 2', beginner_3: '초급 3',
  intermediate_1: '중급 1', intermediate_2: '중급 2', intermediate_3: '중급 3',
  advanced_1: '고급 1', advanced_2: '고급 2', advanced_3: '고급 3',
};
const DIFF_DESC: Record<Difficulty, string> = {
  beginner_1: '온음표 · 2분음표',
  beginner_2: '4분음표 · 점2분음표 · 쉼표',
  beginner_3: '8분음표 · 8분쉼표',
  intermediate_1: '점4분음표',
  intermediate_2: '붙임줄 · 당김음',
  intermediate_3: '16분음표 · 16분쉼표',
  advanced_1: '점8분음표',
  advanced_2: '임시표 (♯ · ♭ · ♮)',
  advanced_3: '셋잇단음표',
};
const DIFF_CATEGORY_LABELS: Record<DifficultyCategory, string> = {
  beginner: '초급', intermediate: '중급', advanced: '고급',
};
const DIFF_CATEGORY_COLORS: Record<DifficultyCategory, { bg: string; text: string; activeBg: string }> = {
  beginner: { bg: '#ecfdf5', text: '#065f46', activeBg: '#10b981' },
  intermediate: { bg: '#fef9c3', text: '#854d0e', activeBg: '#f59e0b' },
  advanced: { bg: '#fee2e2', text: '#991b1b', activeBg: '#ef4444' },
};
const ALL_DIFFICULTIES: Difficulty[] = [
  'beginner_1', 'beginner_2', 'beginner_3',
  'intermediate_1', 'intermediate_2', 'intermediate_3',
  'advanced_1', 'advanced_2', 'advanced_3',
];
const ALL_BASS_DIFFICULTIES: BassDifficulty[] = [
  'bass_1', 'bass_2', 'bass_3', 'bass_4',
];

// ── 조성 데이터 ──
// 5도권 순서 (♭ → 중립 → ♯)
const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
// 조성별 샤프/플랫 수 (표시용)
const KEY_ACCIDENTAL: Record<string, string> = {
  'C': '', 'G': '♯', 'D': '♯♯', 'A': '♯♯♯', 'E': '4♯', 'B': '5♯', 'F#': '6♯',
  'F': '♭', 'Bb': '♭♭', 'Eb': '♭♭♭', 'Ab': '4♭', 'Db': '5♭',
  'Am': '', 'Em': '♯', 'Bm': '♯♯', 'F#m': '♯♯♯', 'C#m': '4♯', 'G#m': '5♯',
  'Dm': '♭', 'Gm': '♭♭', 'Cm': '♭♭♭', 'Fm': '4♭', 'Bbm': '5♭', 'Ebm': '6♭',
};
// 박자 옵션 (자주 쓰이는 것만)
const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '12/8', '9/8', '5/4', '7/8'];

// ── 바텀시트 모달 ──
function BottomSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.sheetOverlay}>
        {/* 오버레이 탭으로 닫기 */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={[styles.sheetInner, { paddingBottom: Math.max(insets.bottom, 24) }]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ScoreEditorScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  // ── 구독 관련 훅 ──
  const { tier, limits, remainingDownloads } = useSubscription();
  const { profile } = useAuth();

  // AI 생성 로딩 상태
  const [isGenerating, setIsGenerating] = useState(false);

  // ── 구독/계정 모달 상태 ──
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>('grand_staff');
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 업그레이드 모달 열기 헬퍼
  const openUpgrade = useCallback((reason: UpgradeReason) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  }, []);

  const { checkCanDownload, consumeDownload, checkImageDownload } = useDownloadQuota(
    useCallback((reason: UpgradeReason) => {
      setUpgradeReason(reason);
      setShowUpgradeModal(true);
    }, [])
  );

  const [state, setState] = useState<ScoreState>({
    title: '새 악보', keySignature: 'C', timeSignature: '4/4', tempo: 80, notes: [],
  });
  const [duration, setDuration] = useState<NoteDuration>('4');
  const [accidental, setAccidental] = useState<Accidental>('');
  const [octave, setOctave] = useState(4);
  const [tie, setTie] = useState(false);
  const [tuplet, setTuplet] = useState<TupletType>('');
  const [tupletCounter, setTupletCounter] = useState(0);
  const [activeStaff, setActiveStaff] = useState<'treble' | 'bass'>('treble');
  const [selectedNote, setSelectedNote] = useState<{ id: string; staff: 'treble' | 'bass' } | null>(null);

  // 재생 옵션
  const [prependBasePitch, setPrependBasePitch] = useState(false);
  const [prependMetronome, setPrependMetronome] = useState(false);
  const [scaleTempo, setScaleTempo] = useState(80);
  const [metronomeFreq, setMetronomeFreq] = useState(1000);
  const [examMode, setExamMode] = useState(false);
  const [examWaitSeconds, setExamWaitSeconds] = useState(DEFAULT_PRACTICE_WAIT_SECONDS);
  const [isPlaying, setIsPlaying] = useState(false);
  /** 테스트용: ABC 표기 팝업 */
  const [showAbcNotationModal, setShowAbcNotationModal] = useState(false);
  const [showNoteCursor, setShowNoteCursor] = useState(true);
  const [showMeasureHighlight, setShowMeasureHighlight] = useState(true);
  const [hideNotes, setHideNotes] = useState(false);
  const [genHideNotes, setGenHideNotes] = useState(false);
  // 새 재생 모드 시스템
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode | null>(null);
  const [apExamSettings, setApExamSettings] = useState<APExamSettings>({ ...DEFAULT_AP_SETTINGS });
  const [koreanExamSettings, setKoreanExamSettings] = useState<KoreanExamSettings>({ ...DEFAULT_KOREAN_SETTINGS });
  const [echoSettings, setEchoSettings] = useState<EchoSettings>({ ...DEFAULT_ECHO_SETTINGS });
  const [customPlaySettings, setCustomPlaySettings] = useState<CustomPlaySettings>({ ...DEFAULT_CUSTOM_SETTINGS });

  // 패널
  const [mobileSheet, setMobileSheet] = useState<'settings' | 'playback' | 'generate' | 'saved' | null>(null);
  const [mobileSubMenu, setMobileSubMenu] = useState<'duration' | 'accidental' | 'octave' | 'tie' | 'tuplet' | null>(null);

  // 자동생성
  const [genDifficulty, setGenDifficulty] = useState<Difficulty>('beginner_1');
  const [genBassDifficulty, setGenBassDifficulty] = useState<BassDifficulty>('bass_1');
  const [genMeasures, setGenMeasures] = useState(4);
  const [genTab, setGenTab] = useState<'melody' | 'grand'>('melody');
  // 부분연습 / 종합연습
  const [genPracticeMode, setGenPracticeMode] = useState<'partPractice' | 'comprehensive'>('partPractice');
  const [genPartLevel, setGenPartLevel] = useState(1);
  const [genCompLevel, setGenCompLevel] = useState(1);
  const [savedScores, setSavedScores] = useState<SavedScore[]>([]);

  // 악보 설정 - 조성 탭 (장조/단조)
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>('major');



  const rendererRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const dragBaseOffsetRef = useRef(0);
  const isDragScrollingRef = useRef(false);

  // adjustedDy: 드래그 시작 기준점 대비 누적 이동량, NaN = 드래그 종료
  const handleWebViewScrollDelta = useCallback((adjustedDy: number) => {
    if (isNaN(adjustedDy)) {
      // 드래그 종료
      isDragScrollingRef.current = false;
      return;
    }
    if (!isDragScrollingRef.current) {
      // 드래그 시작 → 현재 스크롤 위치를 기준점으로 고정
      isDragScrollingRef.current = true;
      dragBaseOffsetRef.current = scrollOffsetRef.current;
    }
    const newOffset = Math.max(0, dragBaseOffsetRef.current - adjustedDy);
    scrollOffsetRef.current = newOffset;
    scrollViewRef.current?.scrollTo({ y: newOffset, animated: false });
  }, []);

  useEffect(() => { getSavedScores().then(setSavedScores); }, []);

  const curNotes = state.useGrandStaff && activeStaff === 'bass' ? (state.bassNotes || []) : state.notes;

  const handleSelectNote = (id: string, staff: 'treble' | 'bass') => {
    // Premium만 음표 편집 가능
    if (!limits.canEditNotes) {
      openUpgrade('edit_notes');
      return;
    }
    const arr = staff === 'bass' ? (state.bassNotes || []) : state.notes;
    const note = arr.find(n => n.id === id);
    if (!note) return;
    setSelectedNote({ id, staff });
    setActiveStaff(staff);
    if (note.pitch !== 'rest') { setOctave(note.octave); setAccidental(note.accidental); }
    setDuration(note.duration); setTie(note.tie ?? false); setTuplet((note.tuplet as TupletType) || ''); setTupletCounter(0);
  };
  const handleDeselect = () => setSelectedNote(null);

  const handleTupletChange = (newTuplet: TupletType) => {
    if (!selectedNote) { setTuplet(newTuplet); setTupletCounter(0); return; }
    setTuplet(newTuplet); setTupletCounter(0);
    const isBass = selectedNote.staff === 'bass';
    setState(p => {
      const pArr = isBass ? (p.bassNotes || []) : p.notes;
      const pIdx = pArr.findIndex(n => n.id === selectedNote.id);
      if (pIdx < 0) return p;
      const newArr = [...pArr];
      const target = newArr[pIdx];
      const oldN = target.tuplet ? parseInt(target.tuplet, 10) : 0;
      const newN = newTuplet ? parseInt(newTuplet, 10) : 0;
      const spanDur = target.tupletSpan || target.duration;
      const isRest = target.pitch === 'rest';

      if (newTuplet === '') {
        const { tuplet: _t, tupletSpan: _s, tupletNoteDur: _d, ...rest } = target;
        newArr[pIdx] = { ...rest };
        if (!isRest && oldN > 1) newArr.splice(pIdx + 1, oldN - 1);
      } else {
        const tupletNoteDur = getTupletNoteDuration(newTuplet, spanDur);
        const noteDur = sixteenthsToDuration(tupletNoteDur);
        newArr[pIdx] = { ...target, tuplet: newTuplet, tupletSpan: spanDur, tupletNoteDur };
        if (!isRest) {
          const makeNote = (): ScoreNote => ({ id: Math.random().toString(36).substr(2, 9), pitch: target.pitch, octave: target.octave, accidental: target.accidental, duration: noteDur, tie: false });
          if (oldN === 0) { const added = Array.from({ length: newN - 1 }, makeNote); newArr.splice(pIdx + 1, 0, ...added); }
          else if (newN > oldN) { const added = Array.from({ length: newN - oldN }, makeNote); newArr.splice(pIdx + oldN, 0, ...added); }
          else if (newN < oldN) { newArr.splice(pIdx + newN, oldN - newN); }
        }
      }
      return { ...p, ...(isBass ? { bassNotes: newArr } : { notes: newArr }) };
    });
  };

  const handleModifyNotePitch = (pitch: PitchName) => {
    if (!selectedNote) return;
    const isBass = selectedNote.staff === 'bass';
    setState(p => {
      const arr = isBass ? (p.bassNotes || []) : p.notes;
      const next = arr.map(n => n.id === selectedNote.id ? { ...n, pitch, octave: pitch === 'rest' ? 4 : octave, accidental: pitch === 'rest' ? '' as Accidental : accidental } : n);
      return { ...p, ...(isBass ? { bassNotes: next } : { notes: next }) };
    });
  };

  const handleDurationChange = (d: NoteDuration) => {
    if (!selectedNote) { setDuration(d); return; }
    const isBass = selectedNote.staff === 'bass';
    const arr = isBass ? (state.bassNotes || []) : state.notes;
    const idx = arr.findIndex(n => n.id === selectedNote.id);
    if (idx < 0) { setDuration(d); return; }

    const oldNote = arr[idx];
    const oldS = durationToSixteenths(oldNote.duration);
    const barLen = getSixteenthsPerBar(state.timeSignature);
    let noteStart = 0;
    for (let i = 0; i < idx; i++) noteStart += durationToSixteenths(arr[i].duration);
    const noteStartInMeasure = noteStart % barLen;
    const maxSixteenths = barLen - noteStartInMeasure;

    const DUR_OPTIONS: [NoteDuration, number][] = [['1', 16], ['2.', 12], ['2', 8], ['4.', 6], ['4', 4], ['8.', 3], ['8', 2], ['16', 1]];
    let requestedS = durationToSixteenths(d);
    let effectiveDur: NoteDuration = d;
    let newS = requestedS;
    if (requestedS > maxSixteenths) {
      const capped = DUR_OPTIONS.find(([, s]) => s <= maxSixteenths);
      if (!capped) { setDuration(d); return; }
      effectiveDur = capped[0]; newS = capped[1];
    }
    setDuration(effectiveDur);

    setState(p => {
      const pArr = isBass ? (p.bassNotes || []) : p.notes;
      const pIdx = pArr.findIndex(n => n.id === selectedNote.id);
      if (pIdx < 0) return p;
      const newArr = [...pArr];
      newArr[pIdx] = { ...pArr[pIdx], duration: effectiveDur };

      if (newS < oldS) {
        const noteEndInBar = (noteStart + newS) % barLen;
        const spaceLeft = noteEndInBar === 0 ? 0 : barLen - noteEndInBar;
        const fillAmount = Math.min(oldS - newS, spaceLeft);
        if (fillAmount > 0) {
          const rests: ScoreNote[] = fillWithRests(fillAmount).map(rd => ({ id: Math.random().toString(36).substr(2, 9), pitch: 'rest' as PitchName, octave: 4, duration: rd, accidental: '' as Accidental, tie: false }));
          newArr.splice(pIdx + 1, 0, ...rests);
        }
      } else if (newS > oldS) {
        const delta = newS - oldS; let remaining = delta; let removeCount = 0; let leftoverRests: ScoreNote[] = [];
        for (let i = pIdx + 1; i < newArr.length; i++) {
          const nextS = durationToSixteenths(newArr[i].duration);
          if (nextS <= remaining) { removeCount++; remaining -= nextS; if (remaining === 0) break; }
          else { removeCount++; leftoverRests = fillWithRests(nextS - remaining).map(rd => ({ id: Math.random().toString(36).substr(2, 9), pitch: 'rest' as PitchName, octave: 4, duration: rd, accidental: '' as Accidental, tie: false })); remaining = 0; break; }
        }
        if (removeCount > 0) { newArr.splice(pIdx + 1, removeCount); if (leftoverRests.length > 0) newArr.splice(pIdx + 1, 0, ...leftoverRests); }
      }
      return { ...p, ...(isBass ? { bassNotes: newArr } : { notes: newArr }) };
    });
  };

  const handleAddNote = (pitch: PitchName) => {
    if (selectedNote) { handleModifyNotePitch(pitch); return; }
    const isRest = pitch === 'rest';
    const tupletCount = tuplet ? parseInt(tuplet, 10) : 0;
    const isFirstInTuplet = tuplet && !isRest && tupletCounter === 0;
    const newNote: ScoreNote = {
      id: Math.random().toString(36).substr(2, 9), pitch, octave: isRest ? 4 : octave, accidental: isRest ? '' : accidental,
      duration, tie: isRest ? false : tie, tuplet: isFirstInTuplet ? tuplet : undefined, tupletSpan: isFirstInTuplet ? duration : undefined, tupletNoteDur: isFirstInTuplet ? getTupletNoteDuration(tuplet, duration) : undefined,
    };
    const isBass = state.useGrandStaff && activeStaff === 'bass';
    setState(p => {
      const arr = isBass ? (p.bassNotes || []) : p.notes;
      return { ...p, ...(isBass ? { bassNotes: [...arr, newNote] } : { notes: [...arr, newNote] }) };
    });
    if (tuplet && !isRest) {
      const next = tupletCounter + 1;
      if (next >= tupletCount) { setTupletCounter(0); setTuplet(''); }
      else setTupletCounter(next);
    }
  };

  const handleDeleteNote = (id: string, staff: 'treble' | 'bass') => {
    const isBass = staff === 'bass';
    setState(p => {
      const arr = isBass ? (p.bassNotes || []) : p.notes;
      return { ...p, ...(isBass ? { bassNotes: arr.filter(n => n.id !== id) } : { notes: arr.filter(n => n.id !== id) }) };
    });
    if (selectedNote?.id === id) setSelectedNote(null);
  };

  const handleAbcNoteClick = useCallback((noteIndex: number, voice: 'treble' | 'bass') => {
    const arr = voice === 'bass' ? (state.bassNotes || []) : state.notes;
    if (noteIndex < arr.length) handleSelectNote(arr[noteIndex].id, voice);
  }, [state.notes, state.bassNotes]);

  const selectedNoteAbcInfo = (() => {
    if (!selectedNote) return null;
    const arr = selectedNote.staff === 'bass' ? (state.bassNotes || []) : state.notes;
    const index = arr.findIndex(n => n.id === selectedNote.id);
    if (index < 0) return null;
    return { index, voice: selectedNote.staff };
  })();

  const handleUndo = () => {
    const isBass = state.useGrandStaff && activeStaff === 'bass';
    setState(p => isBass ? { ...p, bassNotes: (p.bassNotes || []).slice(0, -1) } : { ...p, notes: p.notes.slice(0, -1) });
  };

  const handleClear = () => {
    const isBass = state.useGrandStaff && activeStaff === 'bass';
    showAlert({
      title: '전체 삭제',
      message: `${isBass ? '낮은' : '높은'}음자리의 모든 음표를 지우시겠습니까?`,
      type: 'warning',
      buttons: [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => setState(p => isBass ? { ...p, bassNotes: [] } : { ...p, notes: [] }) },
      ],
    });
  };

  const handleGenerate = useCallback(async () => {
    // 재생 중인 경우 먼저 중단
    if (isPlaying) {
      rendererRef.current?.togglePlay();
    }

    // 바텀시트 열린 상태에서 로딩 표시
    setIsGenerating(true);

    // 트랙/레벨에서 GeneratorOptions 빌드
    const level = genPracticeMode === 'partPractice' ? genPartLevel : genCompLevel;
    const trackOpts = buildGeneratorOptions(genPracticeMode as TrackType, level);
    const { levelOverrides: _lo, ...baseOpts } = trackOpts;
    const effectiveDifficulty = baseOpts.difficulty;

    // AI API 연결 연출 (난이도별 랜덤 딜레이)
    const category = getDifficultyCategory(effectiveDifficulty);
    const [minMs, maxMs] = {
      beginner: [800, 1300],
      intermediate: [1300, 1800],
      advanced: [1800, 2300],
    }[category];
    const delay = minMs + Math.random() * (maxMs - minMs);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 종합연습: 큰보표 설정은 트랙 config에서 결정
    // 부분연습: 항상 1성부 (C장조/4/4/4마디)
    const result = generateScore({
      keySignature: baseOpts.keySignature,
      timeSignature: baseOpts.timeSignature,
      difficulty: effectiveDifficulty,
      bassDifficulty: baseOpts.useGrandStaff ? baseOpts.bassDifficulty : undefined,
      measures: baseOpts.measures,
      useGrandStaff: baseOpts.useGrandStaff,
      practiceMode: genPracticeMode === 'partPractice' ? 'part' : 'comprehensive',
      partPracticeLevel: genPracticeMode === 'partPractice' ? genPartLevel : undefined,
    });
    const tieDifficulties: Difficulty[] = ['beginner_1', 'beginner_2', 'beginner_3', 'intermediate_1'];
    const barsPerStaff =
      ['beginner_1', 'beginner_2'].includes(effectiveDifficulty)
        ? 4
        : effectiveDifficulty.startsWith('intermediate_') || effectiveDifficulty.startsWith('advanced_')
          ? 2
          : undefined;
    setState(p => ({
      ...p,
      keySignature: baseOpts.keySignature,
      timeSignature: baseOpts.timeSignature,
      useGrandStaff: baseOpts.useGrandStaff,
      notes: result.trebleNotes,
      bassNotes: result.bassNotes,
      disableTies: tieDifficulties.includes(effectiveDifficulty),
      barsPerStaff,
    }));
    setHideNotes(genHideNotes);
    setIsGenerating(false);

    // 생성 완료 후 0.5초 딜레이 후 바텀시트 닫기
    await new Promise(resolve => setTimeout(resolve, 500));
    setMobileSheet(null);
  }, [genPracticeMode, genPartLevel, genCompLevel, genHideNotes, isPlaying]);

  const handleSave = useCallback(async () => {
    const scores = await getSavedScores();
    const limit = limits.maxSavedScores;
    if (limit !== null && scores.length >= limit) {
      // 저장 한도 초과 시 업그레이드 모달 표시 (Free: 5개, Pro: 20개)
      openUpgrade('save_scores');
      return;
    }
    scores.unshift({ id: Date.now().toString(), title: state.title || '제목 없음', state: { ...state }, savedAt: new Date().toISOString() });
    await persistScores(scores); setSavedScores(scores); showAlert({ title: '성공', message: '악보가 저장되었습니다.', type: 'success' });
    setMobileSheet(null);
  }, [state, limits, openUpgrade]);

  const handleLoadScore = useCallback((saved: SavedScore) => {
    setState(saved.state); setMobileSheet(null);
  }, []);

  const handleDeleteSaved = useCallback(async (id: string) => {
    showAlert({
      title: '삭제',
      message: '저장된 악보를 삭제하시겠습니까?',
      type: 'warning',
      buttons: [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: async () => {
          const scores = (await getSavedScores()).filter(s => s.id !== id);
          await persistScores(scores); setSavedScores(scores);
        }},
      ],
    });
  }, []);

  const handleOctaveChange = (newOctave: number) => {
    setOctave(newOctave);
    if (!selectedNote) return;
    const isBass = selectedNote.staff === 'bass';
    setState(p => {
      const arr = isBass ? (p.bassNotes || []) : p.notes;
      return { ...p, ...(isBass ? { bassNotes: arr.map(n => n.id === selectedNote.id ? { ...n, octave: newOctave } : n) } : { notes: arr.map(n => n.id === selectedNote.id ? { ...n, octave: newOctave } : n) }) };
    });
  };

  const handleAccidentalChange = (acc: Accidental) => {
    setAccidental(acc);
    if (!selectedNote) return;
    const isBass = selectedNote.staff === 'bass';
    setState(p => {
      const arr = isBass ? (p.bassNotes || []) : p.notes;
      return { ...p, ...(isBass ? { bassNotes: arr.map(n => n.id === selectedNote.id ? { ...n, accidental: acc } : n) } : { notes: arr.map(n => n.id === selectedNote.id ? { ...n, accidental: acc } : n) }) };
    });
  };

  const abcString = generateAbc(state);
  const noteCount = state.notes.length + (state.bassNotes?.length ?? 0);

  const copyAbcToClipboard = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(abcString);
      showAlert({ title: '복사 완료', message: 'ABC 표기가 클립보드에 복사되었습니다.', type: 'success' });
    } catch {
      showAlert({ title: '오류', message: '복사에 실패했습니다.', type: 'error' });
    }
  }, [abcString]);

  const openAbcNotationModal = useCallback(() => {
    if (noteCount === 0) {
      showAlert({ title: '알림', message: '표시할 악보가 없습니다.', type: 'info' });
      return;
    }
    setShowAbcNotationModal(true);
  }, [noteCount]);

  const selectedNoteObj = selectedNote ? (selectedNote.staff === 'bass' ? state.bassNotes : state.notes)?.find(n => n.id === selectedNote.id) : null;

  const baseDur = (duration.endsWith('.') ? duration.slice(0, -1) : duration) as NoteDuration;
  const hasDot = duration.endsWith('.');
  const dotDisabled = baseDur === '16';

  const handleBaseDurationClick = (base: NoteDuration) => {
    const newDur = (hasDot && base !== '16') ? `${base}.` as NoteDuration : base;
    handleDurationChange(newDur);
  };
  const handleDotToggle = () => {
    if (dotDisabled) return;
    if (hasDot) handleDurationChange(baseDur);
    else handleDurationChange(`${baseDur}.` as NoteDuration);
  };

  return (
    <SafeAreaView
      style={styles.root}
      edges={['bottom']}
    >
      {/* 상단 시스템 상태바 색상 영역 */}
      <View style={{ height: insets.top, backgroundColor: '#6366f1' }} />
      {/* ═══════════════════════════════════════════════
          모바일: 상단 앱바 (타이틀 + 계정)
          ═══════════════════════════════════════════════ */}
      <View style={styles.topBar}>
        {/* 좌측: 타이틀 */}
        <View style={styles.topBarLeft}>
          <Music2 size={18} color="#6366f1" />
          <Text style={styles.topBarTitle}>MelodyGen</Text>
        </View>
        {/* 중앙: 등급 배지 (절대 위치로 진짜 중앙) */}
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' as const, pointerEvents: 'box-none' as const }}>
          <TouchableOpacity
            style={[styles.tierBadge, { backgroundColor: `${PLAN_COLOR[tier]}18`, borderColor: `${PLAN_COLOR[tier]}44` }]}
            onPress={() => setShowPaywall(true)}
            activeOpacity={0.7}
          >
            <Crown size={11} color={PLAN_COLOR[tier]} />
            <Text style={[styles.tierBadgeText, { color: PLAN_COLOR[tier] }]}>{PLAN_NAME[tier]}</Text>
          </TouchableOpacity>
        </View>
        {/* 우측: 빈 공간 (좌우 균형) */}
        <View style={{ width: 40 }} />
      </View>

      {/* ── 상단 도구 바 (이미지/오디오 내보내기) ── */}
      <View style={styles.playBar}>
        <TouchableOpacity
          onPress={async () => {
            const ok = await checkImageDownload();
            if (ok) rendererRef.current?.requestExportImage();
          }}
          style={[styles.playBarBtn, { borderWidth: 1, borderColor: '#e2e8f0', flex: 1, justifyContent: 'center' }]}
        >
          {limits.canDownloadImage
            ? <Download size={14} color="#64748b" />
            : <Lock size={14} color="#94a3b8" />}
          <Text style={{ fontSize: 12, color: limits.canDownloadImage ? '#64748b' : '#94a3b8', marginLeft: 6, fontWeight: '600' }}>이미지 저장</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            const ok = await checkCanDownload();
            if (ok) rendererRef.current?.requestExportAudio();
          }}
          style={[styles.playBarBtn, {
            backgroundColor: limits.canDownloadAudio ? '#6366f1' : '#f1f5f9',
            borderWidth: 0,
            flex: 1,
            justifyContent: 'center'
          }]}
        >
          {limits.canDownloadAudio
            ? <FileAudio size={14} color="#ffffff" />
            : <Lock size={14} color="#94a3b8" />}
          <Text style={{ fontSize: 12, color: limits.canDownloadAudio ? '#ffffff' : '#94a3b8', marginLeft: 6, fontWeight: 'bold' }}>
            MP3 저장{limits.canDownloadAudio && remainingDownloads !== null ? ` (${remainingDownloads})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: selectedNote ? 320 : 140 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (!isDragScrollingRef.current) {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }
        }}
      >
        {/* ── 악보 표시 ── */}
        <View style={styles.scoreContainer}>
          <View style={{ padding: 0 }}>
            {noteCount === 0 ? (
              <View style={styles.emptyContainer}>
                <Music2 size={36} color="#e2e8f0" />
                <Text style={styles.emptyTitle}>악보가 비어 있습니다</Text>
                <Text style={styles.emptySubtitle}>하단 「AI 자동생성」을 눌러{'\n'}악보를 만들어보세요</Text>
              </View>
            ) : (
              <AbcjsRenderer
                ref={rendererRef}
                abcString={abcString}
                scoreTitle={state.title}
                prependBasePitch={prependBasePitch}
                prependMetronome={prependMetronome}
                timeSignature={state.timeSignature}
                tempo={state.tempo}
                scaleTempo={scaleTempo}
                keySignature={state.keySignature}
                metronomeFreq={metronomeFreq}
                playbackMode={playbackMode || undefined}
                examMode={examMode}
                examWaitSeconds={examWaitSeconds}
                apExamSettings={apExamSettings}
                koreanExamSettings={koreanExamSettings}
                echoSettings={echoSettings}
                customPlaySettings={customPlaySettings}
                barsPerStaff={state.barsPerStaff}
                stretchLast={getMeasureCount(state) > 0 && getMeasureCount(state) % 4 === 0}
                onNoteClick={handleAbcNoteClick}
                onScrollDelta={handleWebViewScrollDelta}
                selectedNote={selectedNoteAbcInfo}
                isPlaying={isPlaying}
                onPlayStateChange={(playing) => setIsPlaying(playing)}
                onAudioSaveSuccess={consumeDownload}
                showNoteCursor={showNoteCursor}
                showMeasureHighlight={showMeasureHighlight}
                hideNotes={hideNotes}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── 모바일 하단 고정 영역 ── */}
      <View style={[styles.bottomFixedPalette, { borderTopColor: selectedNote ? '#fcd34d' : '#e2e8f0', paddingBottom: Math.max(insets.bottom, 12) }]}>

        {/* ── 재생 버튼 (단독 위치) ── */}
        {!selectedNote && (
          <View style={styles.bottomPlayContainer}>
            <TouchableOpacity
              onPress={openAbcNotationModal}
              disabled={noteCount === 0}
              style={[
                styles.abcTestBtn,
                noteCount === 0 && styles.abcTestBtnDisabled,
              ]}
              accessibilityLabel="ABC 표기 보기 (테스트)"
            >
              <FileCode size={18} color={noteCount === 0 ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => rendererRef.current?.togglePlay()}
              style={[
                styles.floatingPlayBtn,
                isPlaying && { backgroundColor: '#ef4444', shadowColor: '#ef4444' }
              ]}
            >
              <Text style={styles.floatingPlayBtnText}>
                {isPlaying ? '■  정지하기' : '▶  재생하기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHideNotes(h => !h)}
              style={{
                position: 'absolute',
                right: 16,
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: hideNotes ? '#fef2f2' : '#f1f5f9',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: hideNotes ? '#fca5a5' : '#e2e8f0',
              }}
            >
              {hideNotes
                ? <EyeOff size={18} color="#ef4444" />
                : <Eye size={18} color="#64748b" />}
            </TouchableOpacity>
          </View>
        )}

        {/* ── 하단 네비게이션 바 (수정 모드가 아닐 때만 표시) ── */}
        {!selectedNote && (
          <View style={styles.bottomNavBar}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setMobileSheet('settings')}>
              <Sliders size={18} color="#6366f1" />
              <Text style={[styles.navBtnText, { color: '#6366f1' }]}>{state.keySignature}·{state.timeSignature}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setMobileSheet('playback')}>
              <Disc3 size={18} color="#6366f1" />
              <Text style={[styles.navBtnText, { color: '#6366f1' }]}>재생 옵션</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navBtn, styles.navBtnCenter]} onPress={() => setMobileSheet('generate')}>
              <Sparkles size={20} color="#1e293b" />
              <Text style={[styles.navBtnText, { color: '#1e293b', fontWeight: 'bold' }]}>AI 자동생성</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setMobileSheet('saved')}>
              <Archive size={18} color="#64748b" />
              <Text style={[styles.navBtnText, { color: '#64748b' }]}>악보 관리</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setShowProfile(true)}>
              <UserCircle size={18} color="#64748b" />
              <Text style={[styles.navBtnText, { color: '#64748b' }]}>계정</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 모바일 상태바 (음표 있을 때) */}
        {noteCount > 0 && (
          <View style={[styles.statusBarRow, { backgroundColor: selectedNote ? '#fef2f2' : '#f8fafc', borderBottomColor: selectedNote ? '#fecaca' : '#e2e8f0', justifyContent: 'center' }]}>
            {selectedNote ? (
              <TouchableOpacity onPress={handleDeselect}>
                <Text style={[styles.statusBarText, { color: '#dc2626', textDecorationLine: 'underline' }]}>선택 해제</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.statusBarText}>
                {limits.canEditNotes ? '음표를 터치하면 수정할 수 있습니다' : '음표 편집은 Pro 플랜에서 사용 가능합니다'}
              </Text>
            )}
          </View>
        )}

        {/* ── 수정 모드일 때만 팔레트 전체 표시 ── */}
        {selectedNote ? (
          <>
            {/* 잇단음표 서브메뉴 */}
            {mobileSubMenu === 'tuplet' && (
              <View style={styles.subMenuContainer}>
                {(() => {
                  const TUPLET_LABELS: Record<TupletType, string> = { '': '없음', '2': '2연', '3': '3연', '4': '4연', '5': '5연', '6': '6연', '7': '7연', '8': '8연' };
                  const valid = getValidTupletTypesForDuration(duration);
                  const withCurrent = tuplet && !valid.includes(tuplet) ? [...valid, tuplet] : valid;
                  const options: [TupletType, string][] = [['', '없음'], ...withCurrent.map(t => [t, TUPLET_LABELS[t] || `${t}연`] as [TupletType, string])];
                  return options.map(([v, l]) => (
                    <TouchableOpacity key={v} onPress={() => { handleTupletChange(v); setMobileSubMenu(null); }}
                      style={[styles.subMenuChip, { backgroundColor: tuplet === v ? '#f59e0b' : '#ffffff', borderWidth: tuplet === v ? 0 : 1 }]}>
                      <Text style={[styles.subMenuChipText, { color: tuplet === v ? '#ffffff' : '#1e293b' }]}>{l}</Text>
                    </TouchableOpacity>
                  ));
                })()}
              </View>
            )}

            {/* 변화표 서브메뉴 */}
            {mobileSubMenu === 'accidental' && (
              <View style={styles.subMenuContainer}>
                {ACCIDENTALS.map(a => (
                  <TouchableOpacity key={a.label} onPress={() => { handleAccidentalChange(a.value); setMobileSubMenu(null); }}
                    style={[styles.subMenuChip, { flex: 1, backgroundColor: accidental === a.value ? '#ef4444' : '#ffffff', borderWidth: accidental === a.value ? 0 : 1 }]}>
                    <Text style={[styles.subMenuChipText, { color: accidental === a.value ? '#ffffff' : '#1e293b' }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 1행: 편집 버튼 (Premium만 표시) */}
            <View style={styles.paletteRow1}>
              <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
                {limits.canEditNotes && (
                  <>
                    <TouchableOpacity onPress={handleUndo} style={[styles.iconButton, { opacity: curNotes.length === 0 ? 0.3 : 1 }]} disabled={curNotes.length === 0}>
                      <Undo size={13} color="#1e293b" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteNote(selectedNote.id, selectedNote.staff)} style={[styles.iconButton, { backgroundColor: '#fef2f2' }]}>
                      <Trash2 size={13} color="#ef4444" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* 2행: 옥타브, 변화표, Tie, 잇단음 */}
            <View style={styles.paletteRow2}>
              <TouchableOpacity onPress={() => handleOctaveChange(Math.max(2, octave - 1))} style={styles.octaveBtn}><Text style={styles.octaveBtnText}>−</Text></TouchableOpacity>
              <Text style={styles.octaveText}>Oct{octave}</Text>
              <TouchableOpacity onPress={() => handleOctaveChange(Math.min(6, octave + 1))} style={styles.octaveBtn}><Text style={styles.octaveBtnText}>+</Text></TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity onPress={() => setMobileSubMenu(mobileSubMenu === 'accidental' ? null : 'accidental')}
                style={[styles.optionChip, { backgroundColor: mobileSubMenu === 'accidental' ? '#ef4444' : accidental ? '#fef2f2' : '#f8fafc', borderWidth: mobileSubMenu === 'accidental' || accidental ? 0 : 1 }]}>
                <Text style={[styles.optionChipText, { color: mobileSubMenu === 'accidental' ? '#fff' : accidental ? '#ef4444' : '#1e293b' }]}>{accidental === '#' ? '♯' : accidental === 'b' ? '♭' : accidental === 'n' ? '♮' : '변화표'}</Text>
                <ChevronDown size={9} color={mobileSubMenu === 'accidental' ? '#fff' : accidental ? '#ef4444' : '#1e293b'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setTie(v => !v)}
                style={[styles.optionChip, { backgroundColor: tie ? '#6366f1' : '#f8fafc', borderWidth: tie ? 0 : 1 }]}>
                <Text style={[styles.optionChipText, { color: tie ? '#fff' : '#1e293b' }]}>Tie{tie ? '✓' : ''}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMobileSubMenu(mobileSubMenu === 'tuplet' ? null : 'tuplet')}
                style={[styles.optionChip, { backgroundColor: mobileSubMenu === 'tuplet' ? '#f59e0b' : tuplet ? '#FEF3C7' : '#f8fafc', borderWidth: mobileSubMenu === 'tuplet' || tuplet ? 0 : 1 }]}>
                <Text style={[styles.optionChipText, { color: mobileSubMenu === 'tuplet' ? '#fff' : tuplet ? '#92400e' : '#1e293b' }]}>{tuplet ? `${tuplet}연` : '잇단음'}</Text>
                <ChevronDown size={9} color={mobileSubMenu === 'tuplet' ? '#fff' : tuplet ? '#92400e' : '#1e293b'} />
              </TouchableOpacity>
            </View>

            {/* 3행: 길이 */}
            <View style={styles.paletteRow3}>
              {DURATIONS.map(d => (
                <TouchableOpacity key={d.value} onPress={() => handleBaseDurationClick(d.value)}
                  style={[styles.durBtn, { backgroundColor: baseDur === d.value ? '#6366f1' : '#f8fafc', borderWidth: baseDur === d.value ? 0 : 1 }]}>
                  <Text style={[styles.durBtnText, { color: baseDur === d.value ? '#fff' : '#1e293b' }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={handleDotToggle} disabled={dotDisabled}
                style={[styles.durBtn, { backgroundColor: hasDot ? '#ef4444' : '#f8fafc', borderWidth: hasDot ? 0 : 1, opacity: dotDisabled ? 0.4 : 1 }]}>
                <Text style={[styles.durBtnText, { color: hasDot ? '#fff' : dotDisabled ? '#cbd5e1' : '#1e293b' }]}>점·</Text>
              </TouchableOpacity>
            </View>

            {/* 4행: 음정 */}
            <View style={styles.paletteRow4}>
              {PITCHES.map(p => (
                <TouchableOpacity key={p} onPress={() => handleAddNote(p)}
                  style={[styles.pitchBtn, { backgroundColor: PITCH_STYLES[p].bg, borderColor: selectedNoteObj?.pitch === p ? '#fbbf24' : PITCH_STYLES[p].border }]}>
                  <Text style={[styles.pitchBtnText, { color: PITCH_STYLES[p].text }]}>{p}</Text>
                  <Text style={[styles.pitchBtnSubText, { color: PITCH_STYLES[p].text }]}>{PITCH_LABELS[p]}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => handleAddNote('rest')} style={[styles.pitchBtn, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                <Text style={[styles.pitchBtnText, { color: '#94a3b8', fontSize: 11 }]}>쉼표</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>

      {/* ── 바텀시트 모달 컨텐츠 ── */}
      <BottomSheet open={mobileSheet === 'settings'} onClose={() => setMobileSheet(null)} title="악보 설정">
        {/* 제목 */}
        <View style={styles.bsGroup}>
          <Text style={styles.bsLabel}>악보 제목</Text>
          <TextInput
            style={styles.bsInput}
            value={state.title}
            onChangeText={t => setState(p => ({ ...p, title: t }))}
            placeholder="제목을 입력하세요"
            placeholderTextColor="#cbd5e1"
          />
        </View>

        {/* 박자 */}
        <View style={styles.bsGroup}>
          <Text style={styles.bsLabel}>박자</Text>
          <View style={styles.settingsChipRow}>
            {TIME_SIGNATURES.map(t => {
              const allowed = limits.allowedTimeSignatures.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    if (!allowed) { setMobileSheet(null); openUpgrade('time_signature'); return; }
                    setState(p => ({ ...p, timeSignature: t }));
                  }}
                  style={[styles.settingsChip, state.timeSignature === t && styles.settingsChipActive, !allowed && { opacity: 0.45 }]}
                >
                  {!allowed && <Lock size={8} color="#94a3b8" style={{ marginRight: 2 }} />}
                  <Text style={[styles.settingsChipText, state.timeSignature === t && styles.settingsChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* BPM */}
        <View style={styles.bsGroup}>
          <Text style={styles.bsLabel}>빠르기 (BPM)</Text>
          <View style={styles.settingsBpmRow}>
            <TouchableOpacity
              onPress={() => setState(p => ({ ...p, tempo: Math.max(40, (p.tempo || 80) - 5) }))}
              style={styles.bpmStepBtn}
            >
              <Text style={styles.bpmStepBtnText}>－</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.bpmInput}
              keyboardType="number-pad"
              value={state.tempo === 0 ? '' : String(state.tempo)}
              onChangeText={t => {
                if (t === '') { setState(p => ({ ...p, tempo: 0 })); return; }
                const n = parseInt(t);
                if (!isNaN(n)) setState(p => ({ ...p, tempo: n }));
              }}
              onEndEditing={() => setState(p => ({ ...p, tempo: Math.max(40, p.tempo || 80) }))}
            />
            <TouchableOpacity
              onPress={() => setState(p => ({ ...p, tempo: Math.min(240, (p.tempo || 80) + 5) }))}
              style={styles.bpmStepBtn}
            >
              <Text style={styles.bpmStepBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 조성 */}
        <View style={styles.bsGroup}>
          <Text style={styles.bsLabel}>조성</Text>
          {/* 장조/단조 탭 */}
          <View style={styles.keyModeTabRow}>
            <TouchableOpacity
              onPress={() => setKeyMode('major')}
              style={[styles.keyModeTab, keyMode === 'major' && styles.keyModeTabActive]}
            >
              <Text style={[styles.keyModeTabText, keyMode === 'major' && styles.keyModeTabTextActive]}>장조 (Major)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setKeyMode('minor')}
              style={[styles.keyModeTab, keyMode === 'minor' && styles.keyModeTabActive]}
            >
              <Text style={[styles.keyModeTabText, keyMode === 'minor' && styles.keyModeTabTextActive]}>단조 (Minor)</Text>
            </TouchableOpacity>
          </View>
          {/* 조성 그리드 */}
          <View style={styles.keyGrid}>
            {(keyMode === 'major' ? MAJOR_KEYS : MINOR_KEYS).map(k => {
              const isActive = state.keySignature === k;
              const acc = KEY_ACCIDENTAL[k] ?? '';
              const allowed = limits.allowedKeySignatures.includes(k);
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => {
                    if (!allowed) { setMobileSheet(null); openUpgrade('key_signature'); return; }
                    setState(p => ({ ...p, keySignature: k }));
                  }}
                  style={[styles.keyChip, isActive && styles.keyChipActive, !allowed && { opacity: 0.45 }]}
                >
                  {!allowed && <Lock size={7} color="#94a3b8" style={{ position: 'absolute', top: 3, right: 3 }} />}
                  <Text style={[styles.keyChipMain, isActive && styles.keyChipMainActive]}>{k}</Text>
                  {acc ? <Text style={[styles.keyChipSub, isActive && { color: '#c7d2fe' }]}>{acc}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet open={mobileSheet === 'playback'} onClose={() => setMobileSheet(null)} title="재생 옵션">

        {/* ── 공통 설정값 (모든 모드에 적용) ── */}
        <Text style={[styles.playOptLabel, { marginBottom: 10 }]}>공통 설정</Text>
        <View style={styles.commonSettingsRow}>
          <View style={styles.commonSettingsCard}>
            <Text style={styles.commonSettingsLabel}>스케일 BPM</Text>
            <TextInput
              style={styles.commonSettingsInput}
              keyboardType="number-pad"
              value={String(scaleTempo || '')}
              onChangeText={v => { const n = parseInt(v); if (!isNaN(n)) setScaleTempo(n); }}
            />
          </View>
          <View style={styles.commonSettingsCard}>
            <Text style={styles.commonSettingsLabel}>카운트인 (Hz)</Text>
            <TextInput
              style={styles.commonSettingsInput}
              keyboardType="number-pad"
              value={String(metronomeFreq || '')}
              onChangeText={v => { const n = parseInt(v); if (!isNaN(n)) setMetronomeFreq(n); }}
            />
          </View>
        </View>

        {/* 재생 시 표시 옵션 */}
        <View style={styles.commonSettingsRow}>
          <View style={[styles.commonSettingsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={styles.commonSettingsLabel}>현재 음표 표시</Text>
            <Switch value={showNoteCursor} onValueChange={setShowNoteCursor} />
          </View>
          <View style={[styles.commonSettingsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={styles.commonSettingsLabel}>현재 마디 표시</Text>
            <Switch value={showMeasureHighlight} onValueChange={setShowMeasureHighlight} />
          </View>
        </View>

        {/* ── 재생 모드 선택 (accordion) ── */}
        <Text style={[styles.playOptLabel, { marginBottom: 10 }]}>재생 모드</Text>

        {/* ① 일반 재생 */}
        {(() => {
          const isActive = !playbackMode && !examMode;
          return (
            <View style={styles.modeAccordion}>
              <TouchableOpacity
                onPress={() => { setPlaybackMode(null); setExamMode(false); }}
                style={[styles.modeCard, isActive && styles.modeCardActive, isActive && styles.modeCardExpanded]}
                activeOpacity={0.75}
              >
                <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive]}>일반 재생</Text>
                <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive]}>전체를 한 번 재생합니다</Text>
              </TouchableOpacity>

              {/* 일반 재생 설정: 스케일·카운트인 ON/OFF */}
              {isActive && (
                <View style={styles.modeSettingsBox}>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>스케일 재생</Text>
                    <Switch value={prependBasePitch} onValueChange={setPrependBasePitch} />
                  </View>
                  <View style={[styles.modeOptRow, { marginBottom: 0 }]}>
                    <Text style={styles.modeOptLabel}>카운트인</Text>
                    <Switch value={prependMetronome} onValueChange={setPrependMetronome} />
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ② 연습 모드 */}
        {(() => {
          const isActive = playbackMode === 'practice';
          const locked = !limits.canUseExamMode;
          return (
            <View style={styles.modeAccordion}>
              <TouchableOpacity
                onPress={() => {
                  if (locked) { setMobileSheet(null); openUpgrade('exam_mode'); return; }
                  setPlaybackMode('practice'); setExamMode(true);
                }}
                style={[styles.modeCard, isActive && styles.modeCardActive, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {locked && <Lock size={12} color="#94a3b8" />}
                  <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                    {PLAYBACK_MODE_LABELS.practice}
                  </Text>
                  {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
                </View>
                <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                  구간별 반복 훈련 · 슬라이딩 방식
                </Text>
              </TouchableOpacity>

              {/* 연습 모드 설정 (accordion) */}
              {isActive && !locked && (
                <View style={styles.modeSettingsBox}>
                  {/* 순서 표시 */}
                  <View style={styles.modeSeqBox}>
                    <Text style={styles.modeSeqText}>
                      {'스케일 → 전체 재생 → '}
                      <Text style={styles.modeSeqHighlight}>{examWaitSeconds}초</Text>
                      {'\n→ 2마디씩 ×2회 + 4마디 누적 ('}
                      <Text style={styles.modeSeqHighlight}>{examWaitSeconds}초</Text>
                      {' 휴식)\n→ 다음 2마디로 이동, 반복\n→ 전체 재생'}
                    </Text>
                  </View>
                  {/* 옵션 */}
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>구간 휴식 (초)</Text>
                    <TextInput
                      style={styles.modeOptInput}
                      keyboardType="number-pad"
                      value={String(examWaitSeconds || '')}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setExamWaitSeconds(n); }}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ③ AP 시험 모드 */}
        {(() => {
          const isActive = playbackMode === 'ap_exam';
          const locked = !limits.canUseExamMode;
          return (
            <View style={styles.modeAccordion}>
              <TouchableOpacity
                onPress={() => {
                  if (locked) { setMobileSheet(null); openUpgrade('exam_mode'); return; }
                  setPlaybackMode('ap_exam'); setExamMode(true);
                }}
                style={[styles.modeCard, isActive && styles.modeCardActiveAP, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {locked && <Lock size={12} color="#94a3b8" />}
                  <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                    {PLAYBACK_MODE_LABELS.ap_exam}
                  </Text>
                  {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
                </View>
                <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                  4회 통재생 · 첫 휴식 {apExamSettings.firstRestSeconds}초 · 이후 {apExamSettings.restSeconds}초
                </Text>
              </TouchableOpacity>

              {isActive && !locked && (
                <View style={[styles.modeSettingsBox, { borderColor: '#bfdbfe' }]}>
                  <View style={styles.modeSeqBox}>
                    <Text style={styles.modeSeqText}>
                      {'스케일 → 으뜸화음 → 전체 재생 →\n'}
                      <Text style={styles.modeSeqHighlight}>{apExamSettings.firstRestSeconds}초 휴식</Text>
                      {' → 전체 재생 →\n'}
                      <Text style={styles.modeSeqHighlight}>{apExamSettings.restSeconds}초 휴식</Text>
                      {' → 전체 재생 →\n'}
                      <Text style={styles.modeSeqHighlight}>{apExamSettings.restSeconds}초 휴식</Text>
                      {' → 전체 재생'}
                    </Text>
                  </View>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>1회차 후 휴식 (초)</Text>
                    <TextInput
                      style={styles.modeOptInput}
                      keyboardType="number-pad"
                      value={String(apExamSettings.firstRestSeconds)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setApExamSettings(s => ({ ...s, firstRestSeconds: n })); }}
                    />
                  </View>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>2·3·4회차 후 휴식 (초)</Text>
                    <TextInput
                      style={styles.modeOptInput}
                      keyboardType="number-pad"
                      value={String(apExamSettings.restSeconds)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setApExamSettings(s => ({ ...s, restSeconds: n })); }}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ④ 한국 입시 모드 */}
        {(() => {
          const isActive = playbackMode === 'korean_exam';
          const locked = !limits.canUseExamMode;
          return (
            <View style={styles.modeAccordion}>
              <TouchableOpacity
                onPress={() => {
                  if (locked) { setMobileSheet(null); openUpgrade('exam_mode'); return; }
                  setPlaybackMode('korean_exam'); setExamMode(true);
                }}
                style={[styles.modeCard, isActive && styles.modeCardActiveKR, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {locked && <Lock size={12} color="#94a3b8" />}
                  <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                    {PLAYBACK_MODE_LABELS.korean_exam}
                  </Text>
                  {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
                </View>
                <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                  {koreanExamSettings.totalPlays}회 통재생 · {koreanExamSettings.restSeconds}초 휴식
                </Text>
              </TouchableOpacity>

              {isActive && !locked && (
                <View style={[styles.modeSettingsBox, { borderColor: '#fde68a' }]}>
                  <View style={styles.modeSeqBox}>
                    <Text style={styles.modeSeqText}>
                      {'스케일 → 으뜸화음 → 시작음 →\n'}
                      {Array.from({ length: koreanExamSettings.totalPlays }, (_, i) => (
                        i < koreanExamSettings.totalPlays - 1 ? (
                          <Text key={i}>
                            {'전체 재생 → '}
                            <Text style={styles.modeSeqHighlight}>{koreanExamSettings.restSeconds}초 휴식</Text>
                            {' → '}
                          </Text>
                        ) : (
                          <Text key={i}>{'전체 재생'}</Text>
                        )
                      ))}
                    </Text>
                  </View>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>재생 횟수</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[3, 4, 5].map(n => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setKoreanExamSettings(s => ({ ...s, totalPlays: n }))}
                          style={[styles.modeCountChip, koreanExamSettings.totalPlays === n && { backgroundColor: '#d97706', borderColor: '#d97706' }]}
                        >
                          <Text style={[styles.modeCountChipText, koreanExamSettings.totalPlays === n && { color: '#fff' }]}>{n}회</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>재생 간 휴식 (초)</Text>
                    <TextInput
                      style={styles.modeOptInput}
                      keyboardType="number-pad"
                      value={String(koreanExamSettings.restSeconds)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setKoreanExamSettings(s => ({ ...s, restSeconds: n })); }}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ⑤ 에코 모드 (ABRSM) */}
        {(() => {
          const isActive = playbackMode === 'echo';
          const locked = !limits.canUseExamMode;
          return (
            <View style={styles.modeAccordion}>
              <TouchableOpacity
                onPress={() => {
                  if (locked) { setMobileSheet(null); openUpgrade('exam_mode'); return; }
                  setPlaybackMode('echo'); setExamMode(true);
                }}
                style={[styles.modeCard, isActive && styles.modeCardActiveEcho, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {locked && <Lock size={12} color="#94a3b8" />}
                  <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                    {PLAYBACK_MODE_LABELS.echo}
                  </Text>
                  {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
                </View>
                <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                  {echoSettings.phraseMeasures}마디씩 · {echoSettings.responseSeconds}초 응답
                </Text>
              </TouchableOpacity>

              {isActive && !locked && (
                <View style={[styles.modeSettingsBox, { borderColor: '#bbf7d0' }]}>
                  <View style={styles.modeSeqBox}>
                    <Text style={styles.modeSeqText}>
                      {'스케일 → 으뜸화음 →\n('}
                      <Text style={styles.modeSeqHighlight}>{echoSettings.phraseMeasures}마디</Text>
                      {' 재생 → '}
                      <Text style={styles.modeSeqHighlight}>{echoSettings.responseSeconds}초</Text>
                      {' 응답) × 마디 수 만큼 반복'}
                    </Text>
                  </View>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>구간 크기 (마디)</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[1, 2, 4].map(n => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setEchoSettings(s => ({ ...s, phraseMeasures: n }))}
                          style={[styles.modeCountChip, echoSettings.phraseMeasures === n && { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}
                        >
                          <Text style={[styles.modeCountChipText, echoSettings.phraseMeasures === n && { color: '#fff' }]}>{n}마디</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>응답 시간 (초)</Text>
                    <TextInput
                      style={styles.modeOptInput}
                      keyboardType="number-pad"
                      value={String(echoSettings.responseSeconds)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setEchoSettings(s => ({ ...s, responseSeconds: n })); }}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ⑥ 커스텀 모드 */}
        {(() => {
          const isActive = playbackMode === 'custom';
          const locked = !limits.canUseExamMode;
          const { prependScale, prependTonicChord, prependCountIn,
            totalPlays, useSegments, segmentMeasures, segmentRepeats, restSeconds } = customPlaySettings;

          // 순서 텍스트 앞부분 (스케일·으뜸화음·카운트인)
          const prefixParts: string[] = [];
          if (prependScale) prefixParts.push('스케일');
          if (prependTonicChord) prefixParts.push('으뜸화음');

          // 본 재생 순서 텍스트
          let bodyText = '';
          if (useSegments) {
            bodyText = `전체 재생 → ${restSeconds}초 휴식 → ` +
              `${segmentMeasures}마디×${segmentRepeats}회 → ` +
              `${restSeconds}초 휴식 (전 구간 반복) → 전체 재생`;
          } else {
            const playParts: string[] = [];
            for (let i = 0; i < totalPlays; i++) {
              playParts.push('전체 재생');
              if (i < totalPlays - 1) playParts.push(`${restSeconds}초 휴식`);
            }
            bodyText = playParts.join(' → ');
          }

          return (
            <View style={[styles.modeAccordion, { marginBottom: 0 }]}>
              <TouchableOpacity
                onPress={() => {
                  if (locked) { setMobileSheet(null); openUpgrade('exam_mode'); return; }
                  setPlaybackMode('custom'); setExamMode(true);
                }}
                style={[styles.modeCard, isActive && styles.modeCardActiveCustom, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {locked && <Lock size={12} color="#94a3b8" />}
                  <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                    {PLAYBACK_MODE_LABELS.custom}
                  </Text>
                  {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
                </View>
                <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                  재생 횟수·구간·휴식 직접 설정
                </Text>
              </TouchableOpacity>

              {isActive && !locked && (
                <View style={[styles.modeSettingsBox, { borderColor: '#e9d5ff' }]}>

                  {/* ── 순서 텍스트 ── */}
                  <View style={styles.modeSeqBox}>
                    <Text style={styles.modeSeqText}>
                      {prefixParts.length > 0 && (
                        <Text>
                          {prefixParts.join(' → ')}
                          {' → '}
                        </Text>
                      )}
                      {/* 본 재생 부분: '초 휴식' 토큰만 굵게 */}
                      {bodyText.split(/(\d+초 휴식)/g).map((seg, i) =>
                        /^\d+초 휴식$/.test(seg)
                          ? <Text key={i} style={styles.modeSeqHighlight}>{seg}</Text>
                          : <Text key={i}>{seg}</Text>
                      )}
                    </Text>
                  </View>

                  {/* ── 준비 옵션 ── */}
                  <View style={[styles.modeOptRow, { marginBottom: 6 }]}>
                    <Text style={styles.modeOptLabel}>스케일 재생</Text>
                    <Switch value={prependScale} onValueChange={v => setCustomPlaySettings(s => ({ ...s, prependScale: v }))} trackColor={{ true: '#9333ea' }} />
                  </View>
                  <View style={[styles.modeOptRow, { marginBottom: 14 }]}>
                    <Text style={styles.modeOptLabel}>으뜸화음 재생</Text>
                    <Switch value={prependTonicChord} onValueChange={v => setCustomPlaySettings(s => ({ ...s, prependTonicChord: v }))} trackColor={{ true: '#9333ea' }} />
                  </View>

                  {/* ── 구간 분할 ── */}
                  <View style={[styles.modeOptRow, { marginBottom: 10 }]}>
                    <Text style={styles.modeOptLabel}>구간 분할</Text>
                    <Switch value={useSegments} onValueChange={v => setCustomPlaySettings(s => ({ ...s, useSegments: v }))} trackColor={{ true: '#9333ea' }} />
                  </View>
                  {!useSegments && (
                    <View style={styles.modeOptRow}>
                      <Text style={styles.modeOptLabel}>재생 횟수</Text>
                      <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(totalPlays)}
                        onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, totalPlays: n })); }} />
                    </View>
                  )}
                  {useSegments && (
                    <>
                      <View style={styles.modeOptRow}>
                        <Text style={styles.modeOptLabel}>구간 크기 (마디)</Text>
                        <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(segmentMeasures)}
                          onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, segmentMeasures: n })); }} />
                      </View>
                      <View style={styles.modeOptRow}>
                        <Text style={styles.modeOptLabel}>구간 반복 횟수</Text>
                        <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(segmentRepeats)}
                          onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, segmentRepeats: n })); }} />
                      </View>
                    </>
                  )}
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>휴식 시간 (초)</Text>
                    <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(restSeconds)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, restSeconds: n })); }} />
                  </View>
                </View>
              )}
            </View>
          );
        })()}

      </BottomSheet>

      {/* ── AI 자동생성 Modal (탭 구조, 고정 생성버튼) ── */}
      {(() => {
        return (
          <Modal
            visible={mobileSheet === 'generate'}
            transparent
            animationType="slide"
            onRequestClose={() => setMobileSheet(null)}
            statusBarTranslucent
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMobileSheet(null)} />
              <View style={styles.genSheetContent}>
                <View style={styles.sheetHandle} />

                {/* 헤더 */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>AI 자동생성</Text>
                  <TouchableOpacity onPress={() => setMobileSheet(null)} style={styles.sheetCloseBtn}>
                    <X size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* 탭 바 */}
                <View style={styles.genTabBar}>
                  <TouchableOpacity
                    style={[styles.genTabItem, genTab === 'melody' && styles.genTabItemActive]}
                    onPress={() => setGenTab('melody')}
                  >
                    <Music2 size={12} color={genTab === 'melody' ? '#6366f1' : '#94a3b8'} />
                    <Text style={[styles.genTabText, genTab === 'melody' && styles.genTabTextActive]}>선율</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genTabItem, genTab === 'grand' && styles.genTabItemActive]}
                    onPress={() => setGenTab('grand')}
                  >
                    <Music2 size={12} color={genTab === 'grand' ? '#7c3aed' : '#94a3b8'} />
                    <Text style={[styles.genTabText, genTab === 'grand' && styles.genTabTextActivePurple]}>큰보표</Text>
                    {(state.useGrandStaff ?? false) && <View style={styles.genTabActiveDot} />}
                  </TouchableOpacity>
                </View>

                {/* 탭 콘텐츠 (스크롤) */}
                <ScrollView
                  contentContainerStyle={styles.genSheetInner}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {genTab === 'melody' ? (
                    <>
                      {/* 연습 모드 선택 탭 */}
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                        {(['partPractice', 'comprehensive'] as const).map(mode => {
                          const meta = TRACK_META[mode];
                          const isActive = genPracticeMode === mode;
                          const modeColor = mode === 'partPractice' ? '#6366f1' : '#f59e0b';
                          return (
                            <TouchableOpacity
                              key={mode}
                              onPress={() => setGenPracticeMode(mode)}
                              style={[
                                styles.genCatChip,
                                {
                                  flex: 1,
                                  backgroundColor: isActive ? modeColor : '#f1f5f9',
                                  borderColor: isActive ? modeColor : '#e2e8f0',
                                  borderWidth: 1.5,
                                  borderRadius: 10,
                                  paddingVertical: 10,
                                  alignItems: 'center',
                                },
                              ]}
                            >
                              <Text style={[
                                styles.genCatChipText,
                                {
                                  color: isActive ? '#fff' : '#475569',
                                  fontWeight: isActive ? '700' : '600',
                                  fontSize: 13,
                                },
                              ]}>
                                {meta.name}
                              </Text>
                              <Text style={{
                                color: isActive ? 'rgba(255,255,255,0.8)' : '#94a3b8',
                                fontSize: 10,
                                marginTop: 2,
                              }}>
                                {meta.description}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* 레벨 선택 */}
                      {genPracticeMode === 'partPractice' ? (
                        <>
                          <Text style={styles.genSectionLabel}>단계 선택</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {TRACK_META.partPractice.levels.map(lv => {
                              const isActive = genPartLevel === lv.level;
                              const allowed = !lv.requiresPro || limits.canUseGrandStaff;
                              return (
                                <TouchableOpacity
                                  key={lv.level}
                                  onPress={() => {
                                    if (!allowed) { setMobileSheet(null); openUpgrade('difficulty'); return; }
                                    setGenPartLevel(lv.level);
                                  }}
                                  style={[
                                    styles.genDiffBtn,
                                    {
                                      backgroundColor: isActive ? '#6366f1' : '#eef2ff',
                                      borderColor: isActive ? '#6366f1' : '#c7d2fe',
                                      opacity: allowed ? 1 : 0.45,
                                      shadowColor: isActive ? '#6366f1' : 'transparent',
                                      shadowOpacity: isActive ? 0.35 : 0,
                                      shadowRadius: 5,
                                      shadowOffset: { width: 0, height: 2 },
                                      elevation: isActive ? 3 : 0,
                                    },
                                  ]}
                                >
                                  {!allowed && (
                                    <Lock size={8} color={isActive ? 'rgba(255,255,255,0.7)' : '#4338ca99'} style={{ marginBottom: 1 }} />
                                  )}
                                  <Text style={[styles.genDiffBtnLabel, { color: isActive ? '#fff' : '#4338ca' }]}>
                                    {lv.name}
                                  </Text>
                                  <Text style={[styles.genDiffBtnDesc, { color: isActive ? 'rgba(255,255,255,0.85)' : '#4338cacc' }]} numberOfLines={2}>
                                    {lv.description}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {/* 부분연습 안내 */}
                          <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontSize: 11, color: '#64748b', lineHeight: 16 }}>
                              선택한 요소 + 기본음표(2분·4분)만 나옵니다.{'\n'}
                              C장조 · 4/4박자 · 4마디 고정
                            </Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.genSectionLabel}>단계 선택</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {TRACK_META.comprehensive.levels.map(lv => {
                              const isActive = genCompLevel === lv.level;
                              const allowed = !lv.requiresPro || limits.canUseGrandStaff;
                              return (
                                <TouchableOpacity
                                  key={lv.level}
                                  onPress={() => {
                                    if (!allowed) { setMobileSheet(null); openUpgrade('difficulty'); return; }
                                    setGenCompLevel(lv.level);
                                  }}
                                  style={[
                                    styles.genDiffBtn,
                                    {
                                      backgroundColor: isActive ? '#f59e0b' : '#fffbeb',
                                      borderColor: isActive ? '#f59e0b' : '#fde68a',
                                      opacity: allowed ? 1 : 0.45,
                                      shadowColor: isActive ? '#f59e0b' : 'transparent',
                                      shadowOpacity: isActive ? 0.35 : 0,
                                      shadowRadius: 5,
                                      shadowOffset: { width: 0, height: 2 },
                                      elevation: isActive ? 3 : 0,
                                    },
                                  ]}
                                >
                                  {!allowed && (
                                    <Lock size={8} color={isActive ? 'rgba(255,255,255,0.7)' : '#b4530999'} style={{ marginBottom: 1 }} />
                                  )}
                                  <Text style={[styles.genDiffBtnLabel, { color: isActive ? '#fff' : '#b45309' }]}>
                                    {lv.name}
                                  </Text>
                                  <Text style={[styles.genDiffBtnDesc, { color: isActive ? 'rgba(255,255,255,0.85)' : '#b45309cc' }]} numberOfLines={2}>
                                    {lv.description}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {/* 종합연습 안내 */}
                          <View style={{ marginTop: 10, padding: 10, backgroundColor: '#fffbeb', borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' }}>
                            <Text style={{ fontSize: 11, color: '#92400e', lineHeight: 16 }}>
                              선택한 범위의 모든 요소가 종합적으로 나옵니다.{'\n'}
                              조성·박자·큰보표가 랜덤으로 결정됩니다 · 8마디
                            </Text>
                          </View>
                        </>
                      )}

                      {/* 음표 숨기기 */}
                      <View style={[styles.genOptionRow, { marginTop: 14 }, genHideNotes && { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                        <View style={[styles.genCardIconWrap, { backgroundColor: genHideNotes ? '#fef3c7' : '#f1f5f9' }]}>
                          {genHideNotes
                            ? <EyeOff size={13} color="#d97706" />
                            : <Eye size={13} color="#64748b" />
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.genCardTitle, genHideNotes && { color: '#92400e' }]}>음표 숨기기</Text>
                          <Text style={[styles.genCardSubtitle, { marginLeft: 0 }, genHideNotes && { color: '#d97706' }]}>
                            생성된 악보의 음표를 가립니다.
                          </Text>
                        </View>
                        <Switch
                          value={genHideNotes}
                          onValueChange={setGenHideNotes}
                          trackColor={{ true: '#f59e0b', false: '#e2e8f0' }}
                          thumbColor="#ffffff"
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      {/* 큰보표 토글 */}
                      <View style={[styles.genOptionRow, (state.useGrandStaff ?? false) && { backgroundColor: '#faf5ff', borderColor: '#ddd6fe' }]}>
                        <View style={[styles.genCardIconWrap, { backgroundColor: (state.useGrandStaff ?? false) ? '#ede9fe' : '#f1f5f9' }]}>
                          <Music2 size={13} color={(state.useGrandStaff ?? false) ? '#7c3aed' : '#64748b'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.genCardTitle, (state.useGrandStaff ?? false) && { color: '#5b21b6' }]}>큰보표 (Grand Staff)</Text>
                          <Text style={[styles.genCardSubtitle, { marginLeft: 0 }]}>높은음자리 + 낮은음자리</Text>
                        </View>
                        {limits.canUseGrandStaff ? (
                          <Switch
                            value={state.useGrandStaff ?? false}
                            onValueChange={v => setState(p => ({ ...p, useGrandStaff: v, bassNotes: p.bassNotes || [] }))}
                            trackColor={{ true: '#7c3aed', false: '#e2e8f0' }}
                            thumbColor="#ffffff"
                          />
                        ) : (
                          <TouchableOpacity
                            onPress={() => { setMobileSheet(null); openUpgrade('grand_staff'); }}
                            style={styles.genProBadge}
                          >
                            <Lock size={11} color="#7c3aed" />
                            <Text style={styles.genProBadgeText}>PRO</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* 베이스 난이도 — 항상 표시, 큰보표 OFF면 비활성 */}
                      <View style={{ marginTop: 14, opacity: (state.useGrandStaff ?? false) ? 1 : 0.4 }}>
                        <Text style={[styles.genSectionLabel, { color: '#7c3aed' }]}>베이스 난이도</Text>
                        {[
                          ALL_BASS_DIFFICULTIES,
                        ].map((row, rowIdx) => (
                          <View key={rowIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                            {row.map(bd => {
                              const isActive = genBassDifficulty === bd && (state.useGrandStaff ?? false);
                              const levelNum = bd.split('_')[1];
                              return (
                                <TouchableOpacity
                                  key={bd}
                                  onPress={() => { if (state.useGrandStaff ?? false) setGenBassDifficulty(bd); }}
                                  disabled={!(state.useGrandStaff ?? false)}
                                  style={[
                                    styles.genBassBtn,
                                    {
                                      backgroundColor: isActive ? '#7c3aed' : '#ede9fe',
                                      borderColor: isActive ? '#7c3aed' : '#c4b5fd',
                                      shadowColor: isActive ? '#7c3aed' : 'transparent',
                                      shadowOpacity: isActive ? 0.35 : 0,
                                      shadowRadius: 4,
                                      shadowOffset: { width: 0, height: 2 },
                                      elevation: isActive ? 3 : 0,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.genDiffBtnLabel, { color: isActive ? '#fff' : '#5b21b6' }]}>
                                    {levelNum}단계
                                  </Text>
                                  <Text style={[styles.genDiffBtnDesc, { color: isActive ? 'rgba(255,255,255,0.85)' : '#7c3aedcc' }]} numberOfLines={2}>
                                    {BASS_DIFF_DESC[bd]}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </ScrollView>

                {/* 고정 하단 - 생성 버튼 */}
                <View style={[styles.genSheetFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <TouchableOpacity
                    style={styles.genPrimaryBtn}
                    onPress={handleGenerate}
                    activeOpacity={0.85}
                  >
                    <Sparkles size={16} color="#fff" />
                    <Text style={styles.genPrimaryBtnText}>
                      생성하기
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.genFooter}>
                    현재 조성 · 박자 · 큰보표 설정이 적용됩니다. 기존 음표는 교체됩니다.
                  </Text>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      <BottomSheet open={mobileSheet === 'saved'} onClose={() => setMobileSheet(null)} title="악보 관리">
        <TouchableOpacity style={[styles.bsPrimaryBtn, { backgroundColor: '#10b981', marginBottom: 16 }]} onPress={handleSave}>
          <Save size={15} color="#fff" />
          <Text style={styles.bsPrimaryBtnText}>현재 악보 저장</Text>
        </TouchableOpacity>
        {savedScores.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginVertical: 24 }}>저장된 악보가 없습니다.</Text>
        ) : (
          savedScores.map(s => (
            <View key={s.id} style={styles.savedCard}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>{s.title}</Text>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginVertical: 4 }}>{s.state.keySignature} · {s.state.timeSignature} · {s.state.tempo}BPM · {new Date(s.savedAt).toLocaleDateString('ko-KR')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity onPress={() => handleLoadScore(s)} style={[styles.savedBtn, { flex: 1, backgroundColor: '#eef2ff' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6366f1' }}>열기</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSaved(s.id)} style={[styles.savedBtn, { backgroundColor: '#fef2f2' }]}>
                  <Trash2 size={13} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </BottomSheet>

      {/* ── ABC Notation (테스트용) ── */}
      <Modal
        visible={showAbcNotationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAbcNotationModal(false)}
        statusBarTranslucent
      >
        <View style={styles.abcModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowAbcNotationModal(false)}
          />
          <View style={styles.abcModalCard}>
            <View style={styles.abcModalHeader}>
              <Text style={styles.abcModalTitle}>ABC Notation</Text>
              <TouchableOpacity
                onPress={() => setShowAbcNotationModal(false)}
                style={styles.abcModalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.abcModalHint}>생성된 악보의 ABC 표기법입니다. (테스트용)</Text>
            <ScrollView
              style={styles.abcModalScroll}
              contentContainerStyle={styles.abcModalScrollContent}
              nestedScrollEnabled
            >
              <Text selectable style={styles.abcModalText}>{abcString}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.abcModalCopyBtn} onPress={copyAbcToClipboard} activeOpacity={0.85}>
              <Copy size={16} color="#ffffff" />
              <Text style={styles.abcModalCopyBtnText}>텍스트 전체 복사</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── AI 생성 로딩 팝업 ── */}
      <Modal
        visible={isGenerating}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.aiLoadingOverlay}>
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.aiLoadingTitle}>AI가 악보를 생성 중입니다</Text>
            <Text style={styles.aiLoadingSubtitle}>잠시만 기다려주세요...</Text>
            <View style={styles.aiLoadingDots}>
              <View style={[styles.aiLoadingDot, { backgroundColor: '#6366f1' }]} />
              <View style={[styles.aiLoadingDot, { backgroundColor: '#818cf8' }]} />
              <View style={[styles.aiLoadingDot, { backgroundColor: '#a5b4fc' }]} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 업그레이드 유도 모달 ── */}
      <UpgradeModal
        visible={showUpgradeModal}
        reason={upgradeReason}
        onClose={() => setShowUpgradeModal(false)}
        onGoToPaywall={() => { setShowUpgradeModal(false); setShowPaywall(true); }}
      />

      {/* ── 요금제 선택 화면 (전체 모달) ── */}
      <Modal
        visible={showPaywall}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPaywall(false)}
      >
        <PaywallScreen onClose={() => setShowPaywall(false)} />
      </Modal>

      {/* ── 계정/프로필 화면 (전체 모달) ── */}
      <Modal
        visible={showProfile}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowProfile(false)}
      >
        <ProfileScreen
          onClose={() => setShowProfile(false)}
          onGoToPaywall={() => { setShowProfile(false); setShowPaywall(true); }}
        />
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },

  // ── 상단 앱바 ──
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  topBarAccountBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  topBarAccountText: { fontSize: 12, fontWeight: '600', color: '#64748b', maxWidth: 80 },

  // ── 재생 컨트롤 바 ──
  playBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  playBarBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  playBarPlayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 10,
  },
  bottomPlayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  floatingPlayBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingPlayBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },

  // ── 하단 네비게이션 바 ──
  bottomNavBar: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  navBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 3,
  },
  navBtnCenter: {
    backgroundColor: '#fcd34d', borderRadius: 14,
    marginHorizontal: 4, marginVertical: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  navBtnText: { fontSize: 10, fontWeight: '600' },

  scoreContainer: {
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', height: 160 },
  emptyTitle: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8', marginTop: 12 },
  emptySubtitle: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  bottomFixedPalette: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 10 },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  statusBarText: { fontSize: 11, color: '#94a3b8' },
  subMenuContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6, gap: 6, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  subMenuChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderColor: '#e2e8f0' },
  subMenuChipText: { fontSize: 13, fontWeight: 'bold' },

  paletteRow1: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  smallChip: { paddingHorizontal: 10, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderColor: '#e2e8f0' },
  smallChipText: { fontSize: 11, fontWeight: 'bold' },
  iconButton: { width: 32, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },

  paletteRow2: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4 },
  octaveBtn: { width: 32, height: 28, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  octaveBtnText: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  octaveText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#1e293b' },
  divider: { width: 1, height: 20, backgroundColor: '#e2e8f0', marginHorizontal: 2 },
  optionChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 28, borderRadius: 8, borderColor: '#e2e8f0', marginRight: 4 },
  optionChipText: { fontSize: 11, fontWeight: 'bold' },

  paletteRow3: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, gap: 4 },
  durBtn: { flex: 1, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderColor: '#e2e8f0' },
  durBtnText: { fontSize: 11, fontWeight: 'bold' },

  paletteRow4: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
  pitchBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  pitchBtnText: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  pitchBtnSubText: { fontSize: 9, fontWeight: 'bold' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  sheetTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  sheetInner: { paddingHorizontal: 16, paddingBottom: 24 },

  bsGroup: { marginBottom: 10 },
  bsLabel: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4 },
  bsInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1e293b' },
  bsChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderColor: '#e2e8f0', marginRight: 8 },
  bsChipText: { fontSize: 13, fontWeight: 'bold' },

  playOptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  playOptLabel: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  playOptSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, marginBottom: 16 },
  playOptSubLabel: { fontSize: 11, color: '#94a3b8' },
  playOptInput: { width: 80, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  playOptBox: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: 16, padding: 16 },

  bsDurBtn: { flex: 1, paddingVertical: 6, borderRadius: 12, borderColor: '#e2e8f0', alignItems: 'center' },
  bsPrimaryBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  bsPrimaryBtnText: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },

  savedCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 8 },
  savedBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },


  // 잠긴 기능 버튼
  lockedFeatureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lockedFeatureText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
  },

  // ── AI 자동생성 바텀시트 전용 스타일 ──
  genCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e8edf2',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  genCardPurple: {
    backgroundColor: '#faf5ff',
    borderColor: '#ddd6fe',
  },
  genCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  genCardIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  genCardSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
    marginLeft: 34,
  },
  genCatChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 6,
    marginTop: 2,
  },
  genCatChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  genDiffBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  genDiffBtnNum: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  genDiffBtnSub: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  genDiffBtnLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  genDiffBtnDesc: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  genDiffBtnCost: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  genCostBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  genCostBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  genDescBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e8edf2',
  },
  genDescText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  genMeasureBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  genMeasureBtnNum: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  genMeasureBtnSub: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  genProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  genProBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 0.5,
  },
  genBassSeparator: {
    marginTop: 12,
  },
  genBassDivider: {
    height: 1,
    backgroundColor: '#ddd6fe',
    marginBottom: 10,
  },
  genBassTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  genBassBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  genBassBtnNum: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  genBassBtnSub: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  genPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  genPrimaryBtnDisabled: {
    backgroundColor: '#f1f5f9',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  genPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  genPrimaryBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  genPrimaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  genWarningRow: {
    marginTop: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
  },
  genWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  genFooter: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },

  // ── 자동생성 탭 모달 전용 스타일 ──
  genSheetContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  genSheetInner: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  genTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
  },
  genTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
  },
  genTabItemActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  genTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  genTabTextActive: {
    color: '#6366f1',
  },
  genTabTextActivePurple: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '600',
  },
  genTabActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
  },
  genSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  genOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8edf2',
    padding: 12,
    marginBottom: 8,
  },
  genSheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  genGrandOffHint: {
    marginTop: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8edf2',
    padding: 16,
    alignItems: 'center',
  },
  genGrandOffHintText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  genGrandCostBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 8,
  },
  genGrandCostBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },

  // ── 악보 설정 전용 스타일 ──
  // 박자 칩
  settingsChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  settingsChip: {
    width: (SCREEN_WIDTH - 32 - 8 * 3) / 4,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  settingsChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  settingsChipText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  settingsChipTextActive: { color: '#ffffff' },

  // BPM 스텝 컨트롤
  settingsBpmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden',
  },
  bpmStepBtn: {
    width: 48, height: 48, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  bpmStepBtnText: { fontSize: 20, fontWeight: '600', color: '#475569' },
  bpmInput: {
    flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1e293b',
    paddingVertical: 10,
  },

  // 조성 탭 (장조/단조)
  keyModeTabRow: {
    flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8,
    padding: 2, marginBottom: 8,
  },
  keyModeTab: {
    flex: 1, paddingVertical: 6, borderRadius: 6,
    alignItems: 'center',
  },
  keyModeTabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  keyModeTabText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  keyModeTabTextActive: { color: '#1e293b' },

  // 조성 그리드 (6열)
  keyGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
  },
  keyChip: {
    width: (SCREEN_WIDTH - 32 - 5 * 5) / 6,
    paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  keyChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  keyChipMain: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  keyChipMainActive: { color: '#ffffff' },
  keyChipSub: { fontSize: 8, color: '#94a3b8', marginTop: 0 },

  // ── 재생 모드 카드 ──
  // 미선택: 흰 배경 + 테두리 + 그림자 → 버튼감
  modeCard: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  modeCardActive: {
    backgroundColor: '#6366f1', borderColor: '#6366f1',
    shadowColor: '#6366f1', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveAP: {
    backgroundColor: '#2563eb', borderColor: '#2563eb',
    shadowColor: '#2563eb', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveKR: {
    backgroundColor: '#d97706', borderColor: '#d97706',
    shadowColor: '#d97706', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveEcho: {
    backgroundColor: '#16a34a', borderColor: '#16a34a',
    shadowColor: '#16a34a', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveCustom: {
    backgroundColor: '#9333ea', borderColor: '#9333ea',
    shadowColor: '#9333ea', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardLocked: {
    backgroundColor: '#f8fafc', borderColor: '#e2e8f0',
    shadowOpacity: 0, elevation: 0, opacity: 0.65,
  },
  modeCardTitle: {
    fontSize: 13, fontWeight: 'bold' as const, color: '#1e293b',
  },
  modeCardTitleActive: {
    color: '#ffffff',
  },
  modeCardDesc: {
    fontSize: 11, color: '#64748b', marginTop: 2,
  },
  modeCardDescActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  // 설정 박스가 열릴 때 카드 하단 모서리를 직각으로
  modeCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },

  // 설정 박스: 카드와 연결된 느낌 — 어두운 배경, 상단 모서리 없음
  modeSettingsBox: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#cbd5e1',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 14,
    marginBottom: 0,
  },
  modeSettingsTitle: {
    fontSize: 13, fontWeight: 'bold' as const, color: '#1e293b', marginBottom: 12,
  },
  modeCountChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  modeCountChipActive: {
    backgroundColor: '#6366f1', borderColor: '#6366f1',
  },
  modeCountChipText: {
    fontSize: 12, fontWeight: 'bold' as const, color: '#475569',
  },

  // ── accordion 래퍼 ──
  modeAccordion: {
    marginBottom: 10,
  },

  // ── 모드 설정 내부 옵션 행 ──
  modeOptRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  modeOptLabel: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  modeOptInput: {
    width: 72,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 13,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    color: '#1e293b',
  },

  // ── 순서 텍스트 박스 ──
  modeSeqBox: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modeSeqText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 18,
  },
  modeSeqHighlight: {
    fontSize: 11,
    fontWeight: 'bold' as const,
    color: '#1e293b',
  },

  // ── 공통 설정 카드 ──
  commonSettingsRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 20,
  },
  commonSettingsCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center' as const,
    gap: 6,
  },
  commonSettingsLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600' as const,
  },
  commonSettingsInput: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#1e293b',
    textAlign: 'center' as const,
    minWidth: 60,
    paddingVertical: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: '#c7d2fe',
  },

  // ── Gen 배지 (상단 바) ──
  tierBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  genBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 3,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  genBadgeIcon: {
    fontSize: 12,
  },
  genBadgeText: {
    fontSize: 13,
    fontWeight: 'bold' as const,
    color: '#4338ca',
  },
  genBadgeLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#6366f1',
  },

  // ── ABC 표기 팝업 (테스트) ──
  abcModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  abcModalCard: {
    width: '100%' as const,
    maxWidth: 520,
    maxHeight: '85%' as const,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  abcModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  abcModalTitle: {
    fontSize: 17,
    fontWeight: 'bold' as const,
    color: '#1e293b',
  },
  abcModalCloseBtn: {
    padding: 4,
  },
  abcModalHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  abcModalScroll: {
    maxHeight: 360,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  abcModalScrollContent: {
    padding: 12,
    paddingBottom: 16,
  },
  abcModalText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#334155',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  abcModalCopyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
  },
  abcModalCopyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  abcTestBtn: {
    position: 'absolute' as const,
    left: 16,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 2,
  },
  abcTestBtnDisabled: {
    opacity: 0.45,
  },

  // ── AI 생성 로딩 모달 ──
  aiLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  aiLoadingContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    minWidth: 240,
  },
  aiLoadingTitle: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#1e293b',
    marginTop: 16,
    textAlign: 'center' as const,
  },
  aiLoadingSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
  aiLoadingDots: {
    flexDirection: 'row' as const,
    gap: 6,
    marginTop: 16,
  },
  aiLoadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
