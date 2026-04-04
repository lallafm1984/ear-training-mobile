'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
} from 'react-native';
import { useAlert, useSubscription, useAuth } from '../../context';
import { useRoute } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScoreState, ScoreNote, NoteDuration, Accidental, PitchName, TupletType,
  generateAbc, getMeasureCount, getTupletNoteDuration, durationToSixteenths,
  getSixteenthsPerBar, sixteenthsToDuration,
  generateScore, Difficulty, getDifficultyCategory,
  BassDifficulty,
} from '../../lib';
import { buildGeneratorOptions } from '../../lib/trackConfig';
import type { TrackType } from '../../theme/colors';
import { AbcjsRenderer, UpgradeModal } from '../../components';
import type { UpgradeReason } from '../../components';
import {
  Sliders, Disc3, Sparkles, Archive,
  Download, Music2, FileAudio, Lock,
  UserCircle, Eye, EyeOff, FileCode, Crown,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { PLAN_NAME, PLAN_COLOR } from '../../types';
import { useDownloadQuota } from '../../hooks';
import PaywallScreen from '../PaywallScreen';
import ProfileScreen from '../ProfileScreen';
import type {
  PlaybackMode, APExamSettings, KoreanExamSettings, EchoSettings, CustomPlaySettings,
} from '../../types';
import type { ContentCategory, ContentDifficulty } from '../../types/content';
import {
  DEFAULT_AP_SETTINGS, DEFAULT_KOREAN_SETTINGS,
  DEFAULT_ECHO_SETTINGS, DEFAULT_CUSTOM_SETTINGS,
  DEFAULT_PRACTICE_WAIT_SECONDS,
} from '../../types';

type ScoreEditorRouteProp = StackScreenProps<MainStackParamList, 'ScoreEditor'>['route'];

/** ContentDifficulty → partPractice level 매핑 */
function difficultyToPartLevel(category: ContentCategory, difficulty: ContentDifficulty): { mode: 'partPractice' | 'comprehensive'; level: number } {
  // 선율: beginner_1~advanced_3 = partPractice L1~9
  if (category === 'melody') {
    const map: Record<string, number> = {
      beginner_1: 1, beginner_2: 2, beginner_3: 3,
      intermediate_1: 4, intermediate_2: 5, intermediate_3: 6,
      advanced_1: 7, advanced_2: 8, advanced_3: 9,
    };
    return { mode: 'partPractice', level: map[difficulty] ?? 1 };
  }
  // 리듬: rhythm_1~6 = partPractice L1~6
  if (category === 'rhythm') {
    const num = parseInt(difficulty.replace('rhythm_', ''), 10);
    return { mode: 'partPractice', level: Math.min(Math.max(num || 1, 1), 9) };
  }
  // 2성부: bass_1~4 = comprehensive L1~4
  if (category === 'twoVoice') {
    const num = parseInt(difficulty.replace('bass_', ''), 10);
    return { mode: 'comprehensive', level: Math.min(Math.max(num || 1, 1), 4) };
  }
  return { mode: 'partPractice', level: 1 };
}

import NotePalette from './NotePalette';
import SettingsSheet from './SettingsSheet';
import PlaybackSheet from './PlaybackSheet';
import GenerateSheet from './GenerateSheet';
import SavedScoresSheet from './SavedScoresSheet';
import AbcNotationModal from './AbcNotationModal';
import LoadingModal from './LoadingModal';
import { styles } from './styles';
import { fillWithRests, getSavedScores, persistScores } from './utils';
import type { SavedScore } from './types';

export default function ScoreEditorScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const route = useRoute<ScoreEditorRouteProp>();
  const routeParams = route.params;

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
  const [showAbcNotationModal, setShowAbcNotationModal] = useState(false);
  const [showNoteCursor, setShowNoteCursor] = useState(true);
  const [showMeasureHighlight, setShowMeasureHighlight] = useState(true);
  const [hideNotes, setHideNotes] = useState(false);
  const [genHideNotes, setGenHideNotes] = useState(false);
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
  // params 기반 초기값 설정
  const initialGenConfig = (() => {
    if (routeParams?.category && routeParams?.difficulty) {
      return difficultyToPartLevel(routeParams.category, routeParams.difficulty);
    }
    if (routeParams?.practiceMode && routeParams?.level) {
      return { mode: routeParams.practiceMode, level: routeParams.level };
    }
    return { mode: 'partPractice' as const, level: 1 };
  })();

  const [genPracticeMode, setGenPracticeMode] = useState<'partPractice' | 'comprehensive'>(initialGenConfig.mode);
  const [genPartLevel, setGenPartLevel] = useState(initialGenConfig.mode === 'partPractice' ? initialGenConfig.level : 1);
  const [genCompLevel, setGenCompLevel] = useState(initialGenConfig.mode === 'comprehensive' ? initialGenConfig.level : 1);
  const [savedScores, setSavedScores] = useState<SavedScore[]>([]);

  const rendererRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const dragBaseOffsetRef = useRef(0);
  const isDragScrollingRef = useRef(false);

  const handleWebViewScrollDelta = useCallback((adjustedDy: number) => {
    if (isNaN(adjustedDy)) {
      isDragScrollingRef.current = false;
      return;
    }
    if (!isDragScrollingRef.current) {
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
    if (isPlaying) {
      rendererRef.current?.togglePlay();
    }
    setIsGenerating(true);

    const level = genPracticeMode === 'partPractice' ? genPartLevel : genCompLevel;
    const trackOpts = buildGeneratorOptions(genPracticeMode as TrackType, level);
    const { levelOverrides: _lo, ...baseOpts } = trackOpts;
    const effectiveDifficulty = baseOpts.difficulty;

    const category = getDifficultyCategory(effectiveDifficulty);
    const [minMs, maxMs] = {
      beginner: [800, 1300],
      intermediate: [1300, 1800],
      advanced: [1800, 2300],
    }[category];
    const delay = minMs + Math.random() * (maxMs - minMs);
    await new Promise(resolve => setTimeout(resolve, delay));

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

    await new Promise(resolve => setTimeout(resolve, 500));
    setMobileSheet(null);
  }, [genPracticeMode, genPartLevel, genCompLevel, genHideNotes, isPlaying]);

  // ── navigation params가 있으면 마운트 시 자동 생성 ──
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (autoGeneratedRef.current) return;
    if (routeParams?.category || routeParams?.practiceMode) {
      autoGeneratedRef.current = true;
      handleGenerate();
    }
  }, [handleGenerate, routeParams]);

  const handleSave = useCallback(async () => {
    const scores = await getSavedScores();
    const limit = limits.maxSavedScores;
    if (limit !== null && scores.length >= limit) {
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
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={{ height: insets.top, backgroundColor: '#6366f1' }} />

      {/* ── 상단 앱바 ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Music2 size={18} color="#6366f1" />
          <Text style={styles.topBarTitle}>MelodyGen</Text>
        </View>
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
        <View style={{ width: 40 }} />
      </View>

      {/* ── 상단 도구 바 ── */}
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
            borderWidth: 0, flex: 1, justifyContent: 'center',
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
        contentContainerStyle={{ paddingBottom: Math.max(selectedNote ? 320 : 140, insets.bottom + 140) }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (!isDragScrollingRef.current) {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }
        }}
      >
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

      {/* ── 하단 고정 영역 ── */}
      <View style={[styles.bottomFixedPalette, { borderTopColor: selectedNote ? '#fcd34d' : '#e2e8f0', paddingBottom: Math.max(insets.bottom, 12) }]}>

        {/* 재생 버튼 영역 */}
        {!selectedNote && (
          <View style={styles.bottomPlayContainer}>
            <TouchableOpacity
              onPress={openAbcNotationModal}
              disabled={noteCount === 0}
              style={[styles.abcTestBtn, noteCount === 0 && styles.abcTestBtnDisabled]}
              accessibilityLabel="ABC 표기 보기 (테스트)"
            >
              <FileCode size={18} color={noteCount === 0 ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => rendererRef.current?.togglePlay()}
              style={[styles.floatingPlayBtn, isPlaying && { backgroundColor: '#ef4444', shadowColor: '#ef4444' }]}
            >
              <Text style={styles.floatingPlayBtnText}>
                {isPlaying ? '■  정지하기' : '▶  재생하기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHideNotes(h => !h)}
              style={{
                position: 'absolute', right: 16,
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: hideNotes ? '#fef2f2' : '#f1f5f9',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: hideNotes ? '#fca5a5' : '#e2e8f0',
              }}
            >
              {hideNotes ? <EyeOff size={18} color="#ef4444" /> : <Eye size={18} color="#64748b" />}
            </TouchableOpacity>
          </View>
        )}

        {/* 하단 네비게이션 바 */}
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

        {/* 상태바 (음표 있을 때) */}
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

        {/* 수정 모드 팔레트 */}
        {selectedNote && (
          <NotePalette
            selectedNote={selectedNote}
            selectedNoteObj={selectedNoteObj}
            curNotesLength={curNotes.length}
            canEditNotes={limits.canEditNotes}
            duration={duration}
            accidental={accidental}
            octave={octave}
            tie={tie}
            tuplet={tuplet}
            mobileSubMenu={mobileSubMenu}
            setMobileSubMenu={setMobileSubMenu}
            onBaseDurationClick={handleBaseDurationClick}
            onDotToggle={handleDotToggle}
            onAccidentalChange={handleAccidentalChange}
            onOctaveChange={handleOctaveChange}
            onTieToggle={() => setTie(v => !v)}
            onTupletChange={handleTupletChange}
            onAddNote={handleAddNote}
            onUndo={handleUndo}
            onDelete={() => handleDeleteNote(selectedNote.id, selectedNote.staff)}
            baseDur={baseDur}
            hasDot={hasDot}
            dotDisabled={dotDisabled}
          />
        )}
      </View>

      {/* ── 바텀시트 모달들 ── */}
      <SettingsSheet
        open={mobileSheet === 'settings'}
        onClose={() => setMobileSheet(null)}
        state={state}
        setState={setState}
        limits={limits}
        openUpgrade={openUpgrade}
      />

      <PlaybackSheet
        open={mobileSheet === 'playback'}
        onClose={() => setMobileSheet(null)}
        scaleTempo={scaleTempo}
        setScaleTempo={setScaleTempo}
        metronomeFreq={metronomeFreq}
        setMetronomeFreq={setMetronomeFreq}
        showNoteCursor={showNoteCursor}
        setShowNoteCursor={setShowNoteCursor}
        showMeasureHighlight={showMeasureHighlight}
        setShowMeasureHighlight={setShowMeasureHighlight}
        playbackMode={playbackMode}
        setPlaybackMode={setPlaybackMode}
        examMode={examMode}
        setExamMode={setExamMode}
        examWaitSeconds={examWaitSeconds}
        setExamWaitSeconds={setExamWaitSeconds}
        prependBasePitch={prependBasePitch}
        setPrependBasePitch={setPrependBasePitch}
        prependMetronome={prependMetronome}
        setPrependMetronome={setPrependMetronome}
        apExamSettings={apExamSettings}
        setApExamSettings={setApExamSettings}
        koreanExamSettings={koreanExamSettings}
        setKoreanExamSettings={setKoreanExamSettings}
        echoSettings={echoSettings}
        setEchoSettings={setEchoSettings}
        customPlaySettings={customPlaySettings}
        setCustomPlaySettings={setCustomPlaySettings}
        limits={limits}
        openUpgrade={openUpgrade}
      />

      <GenerateSheet
        open={mobileSheet === 'generate'}
        onClose={() => setMobileSheet(null)}
        genTab={genTab}
        setGenTab={setGenTab}
        genPracticeMode={genPracticeMode}
        setGenPracticeMode={setGenPracticeMode}
        genPartLevel={genPartLevel}
        setGenPartLevel={setGenPartLevel}
        genCompLevel={genCompLevel}
        setGenCompLevel={setGenCompLevel}
        genHideNotes={genHideNotes}
        setGenHideNotes={setGenHideNotes}
        genBassDifficulty={genBassDifficulty}
        setGenBassDifficulty={setGenBassDifficulty}
        useGrandStaff={state.useGrandStaff ?? false}
        onToggleGrandStaff={(v) => setState(p => ({ ...p, useGrandStaff: v, bassNotes: v ? (p.bassNotes || []) : undefined }))}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        limits={limits}
        openUpgrade={openUpgrade}
      />

      <SavedScoresSheet
        open={mobileSheet === 'saved'}
        onClose={() => setMobileSheet(null)}
        savedScores={savedScores}
        onSave={handleSave}
        onLoad={handleLoadScore}
        onDelete={handleDeleteSaved}
      />

      <AbcNotationModal
        visible={showAbcNotationModal}
        onClose={() => setShowAbcNotationModal(false)}
        abcString={abcString}
        onCopy={copyAbcToClipboard}
      />

      <LoadingModal visible={isGenerating} />

      {/* ── 업그레이드 모달 ── */}
      <UpgradeModal
        visible={showUpgradeModal}
        reason={upgradeReason}
        onClose={() => setShowUpgradeModal(false)}
        onGoToPaywall={() => { setShowUpgradeModal(false); setShowPaywall(true); }}
      />

      {/* ── 결제 화면 ── */}
      <Modal
        visible={showPaywall}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPaywall(false)}
      >
        <PaywallScreen onClose={() => setShowPaywall(false)} />
      </Modal>

      {/* ── 프로필 화면 ── */}
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
