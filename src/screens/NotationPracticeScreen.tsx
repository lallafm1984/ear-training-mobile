// ─────────────────────────────────────────────────────────────
// NotationPracticeScreen — 기보형 연습 전용 화면 (선율/리듬/2성부)
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Volume2, VolumeX, Eye, EyeOff, RotateCcw, ChevronRight, Delete, Music,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig } from '../lib/contentConfig';
import {
  generateAbc,
  ScoreNote, PitchName, Accidental, durationToSixteenths,
  generateAbcScaleNotes,
} from '../lib';
import type { NoteDuration } from '../lib/scoreUtils';
import {
  generatePracticeScore, melodyDifficultyToLevel,
  type PracticeScore,
} from '../lib/practiceScoreGenerator';
import { examNotationStore } from '../lib/examNotationStore';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';
import type { MainStackParamList, PracticeSettings } from '../navigation/MainStack';
import PianoKeyboard from '../components/PianoKeyboard';
import DurationToolbar from '../components/DurationToolbar';
import GradingResultView from '../components/GradingResult';
import { useNoteInput } from '../hooks/useNoteInput';
import { gradeNotes, type GradingResult, type NoteGrade } from '../lib/grading';
import { useAlert } from '../context';

type RouteProp = StackScreenProps<MainStackParamList, 'NotationPractice'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

// ─────────────────────────────────────────────────────────────
// 카테고리별 악보 생성
// ─────────────────────────────────────────────────────────────

// generatePracticeScore, melodyDifficultyToLevel, PracticeScore는
// '../lib/practiceScoreGenerator'에서 import

// ─────────────────────────────────────────────────────────────
// 리듬 전용: 난이도별 버튼 풀 + 음표 라벨
// ─────────────────────────────────────────────────────────────

// 특수 입력 식별자
const TRIPLET_MARKER = 'triplet' as const;
// 쉼표: 'r_' 접두사 + NoteDuration (예: 'r_4' = 4분쉼표)
type RhythmInput = NoteDuration | typeof TRIPLET_MARKER | `r_${NoteDuration}`;

function isRest(input: RhythmInput): boolean {
  return typeof input === 'string' && input.startsWith('r_');
}
function restDuration(input: RhythmInput): NoteDuration {
  return (input as string).slice(2) as NoteDuration;
}

// 음표 버튼 (전체 일관, 모든 난이도 동일)
const NOTE_BUTTONS: RhythmInput[] = ['1', '2', '2.', '4', '4.', '8', '8.', '16', 'triplet'];

// 쉼표 버튼 (전체 일관)
const REST_BUTTONS: RhythmInput[] = ['r_1', 'r_2', 'r_4', 'r_8', 'r_16'];

function getDurationLabels(t: (key: string) => string): Record<string, string> {
  return {
    '1': t('editor:duration.whole'),     '1.': t('practice:notation.dotWhole'),
    '2': t('editor:duration.half'),      '2.': t('practice:notation.dotHalf'),
    '4': t('editor:duration.quarter'),   '4.': t('practice:notation.dotQuarter'),
    '8': t('editor:duration.eighth'),    '8.': t('practice:notation.dotEighth'),
    '16': t('editor:duration.sixteenth'),
    'triplet': t('practice:notation.triplet'),
    'r_1': t('practice:notation.restWhole'),   'r_2': t('practice:notation.restHalf'),
    'r_4': t('practice:notation.restQuarter'), 'r_8': t('practice:notation.restEighth'),
    'r_16': t('practice:notation.restSixteenth'),
  };
}

/** MaterialCommunityIcons 아이콘 매핑 */
const DURATION_ICON: Record<string, string> = {
  '1': 'music-note-whole',
  '2': 'music-note-half',
  '2.': 'music-note-half-dotted',
  '4': 'music-note-quarter',
  '4.': 'music-note-quarter-dotted',
  '8': 'music-note-eighth',
  '8.': 'music-note-eighth-dotted',
  '16': 'music-note-sixteenth',
  'triplet': 'numeric-3-circle-outline',
  'r_1': 'music-rest-whole',
  'r_2': 'music-rest-half',
  'r_4': 'music-rest-quarter',
  'r_8': 'music-rest-eighth',
  'r_16': 'music-rest-sixteenth',
};

/** 사용자 입력을 ABC 문자열로 변환 (답지 악보용)
 *  NoteDuration → ABC duration: L:1/16 기준이므로 sixteenth 수로 변환 필요
 *  NoteDuration '1' = 온음표 = 16 sixteenths → ABC 'B16'
 *  NoteDuration '4' = 4분     = 4 sixteenths → ABC 'B4'
 *  NoteDuration '8' = 8분     = 2 sixteenths → ABC 'B2'
 */
// ── 리듬 공통 상수 ──
const SIXTEENTHS_MAP: Record<string, number> = {
  '1': 16, '1.': 24, '2': 8, '2.': 12, '4': 4, '4.': 6,
  '8': 2, '8.': 3, '16': 1, 'triplet': 4,
  'r_1': 16, 'r_2': 8, 'r_2.': 12, 'r_4': 4, 'r_4.': 6,
  'r_8': 2, 'r_8.': 3, 'r_16': 1,
};

function getBarSixteenths(timeSignature: string): number {
  const [top, bottom] = timeSignature.split('/').map(Number);
  return (top || 4) * (16 / (bottom || 4));
}

function getTotalSixteenths(input: RhythmInput[]): number {
  return input.reduce((sum, d) => sum + (SIXTEENTHS_MAP[d] ?? 4), 0);
}

/** 리듬 입력을 마디 단위로 분할 */
function splitRhythmIntoMeasures(input: RhythmInput[], barSixteenths: number): RhythmInput[][] {
  const measures: RhythmInput[][] = [];
  let current: RhythmInput[] = [];
  let pos = 0;
  for (const d of input) {
    current.push(d);
    pos += SIXTEENTHS_MAP[d] ?? 4;
    if (pos >= barSixteenths) {
      measures.push(current);
      current = [];
      pos = 0;
    }
  }
  if (current.length > 0) measures.push(current);
  return measures;
}

/** 채점용 정답 마디 배열 (마지막 마디 후행 쉼표 제거) */
function getGradableMeasures(notes: ScoreNote[], barSixteenths: number): RhythmInput[][] {
  const full = getAnswerSequence(notes);
  const measures = splitRhythmIntoMeasures(full, barSixteenths);
  if (measures.length === 0) return measures;

  // 마지막 마디에서 후행 쉼표 제거
  const last = [...measures[measures.length - 1]];
  while (last.length > 0 && isRest(last[last.length - 1])) last.pop();

  if (last.length > 0) {
    return [...measures.slice(0, -1), last];
  }
  return measures.slice(0, -1);
}

/** 음표 순서 리듬 채점 (note-by-note) */
function gradeRhythmNoteByNote(
  answer: RhythmInput[],
  userInput: RhythmInput[],
): { grades: NoteGrade[]; accuracy: number; correctCount: number; wrongCount: number } {
  const grades: NoteGrade[] = [];
  let correctCount = 0;
  const maxLen = Math.max(answer.length, userInput.length);

  for (let i = 0; i < maxLen; i++) {
    const ans = answer[i] ?? null;
    const usr = userInput[i] ?? null;

    if (ans && usr) {
      const match = ans === usr;
      if (match) correctCount++;
      grades.push({
        grade: match ? 'correct' : 'wrong',
        answerSourceIndices: [i],
        userSourceIndices: [i],
      });
    } else if (ans && !usr) {
      grades.push({
        grade: 'missing',
        answerSourceIndices: [i],
        userSourceIndices: [],
      });
    } else {
      grades.push({
        grade: 'extra',
        answerSourceIndices: [],
        userSourceIndices: [i],
      });
    }
  }

  const wrongCount = grades.filter(g => g.grade !== 'correct').length;
  const accuracy = maxLen > 0 ? correctCount / answer.length : 0;
  return { grades, accuracy, correctCount, wrongCount };
}

function userInputToAbc(input: RhythmInput[], timeSignature: string, pitch: string = 'B'): string {
  if (input.length === 0) return '';
  const p = pitch;
  const durToAbc: Record<string, string> = {
    '1':  `${p}16`, '1.': `${p}24`, '2':  `${p}8`, '2.': `${p}12`,
    '4':  `${p}4`,  '4.': `${p}6`,  '8':  `${p}2`, '8.': `${p}3`,
    '16': `${p}1`,  'triplet': `(3:2:3${p}2${p}2${p}2`,
    'r_1':  'z16', 'r_2':  'z8', 'r_2.': 'z12',
    'r_4':  'z4',  'r_4.': 'z6', 'r_8':  'z2',
    'r_8.': 'z3',  'r_16': 'z1',
  };
  const barSixteenths = getBarSixteenths(timeSignature);

  let abc = '';
  let barPos = 0;
  for (const d of input) {
    abc += (durToAbc[d] ?? `${p}4`) + ' ';
    barPos += SIXTEENTHS_MAP[d] ?? 4;
    if (barPos >= barSixteenths) {
      abc += '| ';
      barPos = 0;
    }
  }
  abc = abc.trimEnd();
  if (!abc.endsWith('|')) abc += ' |]';
  else abc = abc.slice(0, -1) + ']';

  return `X:1\nM:${timeSignature}\nL:1/16\nK:C\n${abc}`;
}

/** 정답 시퀀스 추출 (음표 + 쉼표 포함, 셋잇단 그룹은 'triplet' 1개로 축약) */
function getAnswerSequence(notes: ScoreNote[]): RhythmInput[] {
  const result: RhythmInput[] = [];
  let i = 0;
  while (i < notes.length) {
    const note = notes[i];
    if (note.tuplet === '3') {
      result.push('triplet');
      i += 3;
    } else if (note.pitch === 'rest') {
      result.push(`r_${note.duration}` as RhythmInput);
      i++;
    } else {
      result.push(note.duration);
      i++;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function NotationPracticeScreen() {
  const { t } = useTranslation(['practice', 'editor', 'content', 'common']);
  const DURATION_LABELS = getDurationLabels(t);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { category, difficulty, practiceSettings, examMode } = route.params;

  const config = getContentConfig(category);
  const colors = CATEGORY_COLORS[category];
  const diffLabel = t('content:difficulty.' + category + '.' + difficulty);

  const { addRecord } = usePracticeHistory();
  const { applyEvaluation, updateStreak } = useSkillProfile();
  const { showAlert } = useAlert();
  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const scaleAbcjsRef = useRef<AbcjsRendererHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const dragBaseOffsetRef = useRef(0);
  const isDragScrollingRef = useRef(false);

  const handleScrollDelta = useCallback((adjustedDy: number) => {
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
    scrollRef.current?.scrollTo({ y: newOffset, animated: false });
  }, []);

  // ── 상태 ──
  const [score, setScore] = useState<PracticeScore | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const playingRef = useRef(false);
  const [hideNotes, setHideNotes] = useState(true);
  const [selfRating, setSelfRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [practiceCount, setPracticeCount] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [accuracies, setAccuracies] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [rhythmTab, setRhythmTab] = useState<'note' | 'rest'>('note');

  // ── 리듬 전용 상태 ──
  const isRhythm = category === 'rhythm';
  const [userInput, setUserInput] = useState<RhythmInput[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correctCounts, setCorrectCounts] = useState<number[]>([]);

  // ── 선율/2성부 입력 모드 상태 ──
  const isMelodyInput = category === 'melody' || category === 'twoVoice';
  const [melodySubmitted, setMelodySubmitted] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const lastAddTimeRef = useRef(0);

  const firstHintNote = score?.trebleNotes[0] ?? null;

  // 생성된 악보에서 실제 마디 수 계산
  const scoreMeasures = (() => {
    if (!score) return 4;
    const barSix = getBarSixteenths(score.timeSignature);
    const totalSix = score.trebleNotes.reduce(
      (sum, n) => sum + durationToSixteenths(n.duration), 0,
    );
    return Math.max(1, Math.ceil(totalSix / barSix));
  })();

  const noteInput = useNoteInput({
    keySignature: score?.keySignature ?? 'C',
    timeSignature: score?.timeSignature ?? '4/4',
    measures: scoreMeasures,
    useGrandStaff: score?.useGrandStaff ?? false,
    firstNote: isMelodyInput ? firstHintNote : null,
  });

  // ── 악보 생성 ──
  const generate = useCallback(() => {
    setIsGenerating(true);
    setHideNotes(true);
    setSelfRating(0);
    setRated(false);
    setIsPlaying(false);
    setUserInput([]);
    setSubmitted(false);
    setCorrectCounts([]);
    setMelodySubmitted(false);
    setGradingResult(null);
    noteInput.selectNote(null);

    setTimeout(() => {
      // 시험 모드: 스토어에서 미리 생성된 score 사용
      const newScore = examMode
        ? examNotationStore.getScore()
        : generatePracticeScore(category, difficulty, practiceSettings);
      if (!newScore) return;
      setScore(newScore);
      if (category === 'melody' || category === 'twoVoice') {
        const first = newScore.trebleNotes[0] ?? null;
        // 실제 마디 수 계산하여 reset에 전달
        const barSix = getBarSixteenths(newScore.timeSignature);
        const totalSix = newScore.trebleNotes.reduce(
          (sum, n) => sum + durationToSixteenths(n.duration), 0,
        );
        const actualMeasures = Math.max(1, Math.ceil(totalSix / barSix));
        noteInput.reset(first ? { ...first, tie: false } : null, actualMeasures, barSix, newScore.useGrandStaff);
      }
      setIsGenerating(false);
    }, 500);
  }, [category, difficulty, practiceSettings, examMode]);

  // 마운트 시 첫 악보 생성
  useEffect(() => { generate(); }, [generate]);

  // 화면 이탈 시 오디오 정지
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (playingRef.current) {
          abcjsRef.current?.stopPlay();
          playingRef.current = false;
          setIsPlaying(false);
        }
        scaleAbcjsRef.current?.stopPlay();
      };
    }, []),
  );

  // ── ABC 문자열 생성 ──
  const abcString = score ? generateAbc({
    title: '',
    keySignature: score.keySignature,
    timeSignature: score.timeSignature,
    tempo: practiceSettings?.tempo ?? 90,
    notes: score.trebleNotes,
    bassNotes: score.useGrandStaff ? score.bassNotes : undefined,
    useGrandStaff: score.useGrandStaff,
    disableTies: score.disableTies,
  }) : '';

  // ── 스케일 ABC 문자열 ──
  const scaleAbcString = score ? (() => {
    const scaleNotes = generateAbcScaleNotes(score.keySignature);
    return `X:1\nT: \nM:4/4\nL:1/4\nQ:1/4=${practiceSettings?.tempo ?? 90}\nK:${score.keySignature}\n${scaleNotes.join(' ')} |]`;
  })() : '';

  const [isPlayingScale, setIsPlayingScale] = useState(false);

  const handlePlayScale = useCallback(() => {
    if (playingRef.current) {
      abcjsRef.current?.stopPlay();
      playingRef.current = false;
      setIsPlaying(false);
    }
    scaleAbcjsRef.current?.togglePlay();
  }, []);

  const handleScalePlayStateChange = useCallback((playing: boolean) => {
    setIsPlayingScale(playing);
  }, []);

  // ── 재생 상태 콜백 (WebView → React, 자연 종료 포함) ──
  const handlePlayStateChange = useCallback((playing: boolean) => {
    playingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  // ── 재생/정지 (ref 기반, 클로저 이슈 없음) ──
  const handlePlay = useCallback(() => {
    // 스케일 재생 중이면 정지
    scaleAbcjsRef.current?.stopPlay();
    setIsPlayingScale(false);

    if (playingRef.current) {
      abcjsRef.current?.stopPlay();
      playingRef.current = false;
      setIsPlaying(false);
    } else {
      abcjsRef.current?.togglePlay();
      // 상태는 WebView 콜백(handlePlayStateChange)으로 업데이트
    }
  }, []);

  // ── 자기 평가 ──
  const handleRate = useCallback(async (rating: number) => {
    setSelfRating(rating);
    setTimeout(() => setRated(true), 300); // 선택 피드백 후 전환
    setHideNotes(false);
    setPracticeCount(prev => prev + 1);
    setRatings(prev => [...prev, rating]);
    setAccuracies(prev => [...prev, (rating - 1) / 4]);

    // 연습 기록 저장
    const record: PracticeRecord = {
      id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      contentType: category,
      difficulty,
      selfRating: rating,
      practicedAt: new Date().toISOString(),
    };
    await addRecord(record);
    await updateStreak();

    // 스킬 프로필 반영
    const evalRating = rating >= 4 ? 'easy' : rating >= 3 ? 'normal' : 'hard' as const;
    const track = category === 'twoVoice' ? 'comprehensive' : 'partPractice' as const;
    const levelMatch = difficulty.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    await applyEvaluation(track, level, evalRating);
  }, [category, difficulty, addRecord, updateStreak, applyEvaluation]);

  // ── 다음 문제 ──
  const handleNext = useCallback(() => {
    if (playingRef.current) {
      abcjsRef.current?.stopPlay();
      playingRef.current = false;
      setIsPlaying(false);
    }
    generate();
  }, [generate]);

  // ── 연습 종료 ──
  const handleFinish = useCallback(() => {
    if (playingRef.current) {
      abcjsRef.current?.stopPlay();
      playingRef.current = false;
      setIsPlaying(false);
    }
    setShowResult(true);
  }, []);

  // ── 리듬: 정답 시퀀스 ──
  const timeSignature = score?.timeSignature ?? '4/4';
  const barSix = getBarSixteenths(timeSignature);
  const fullAnswer = score ? getAnswerSequence(score.trebleNotes) : [];
  const fullTotalSixteenths = getTotalSixteenths(fullAnswer);

  // ── 리듬: 음표 입력 (전체 4마디 duration 기반 제한) ──
  const handleRhythmInput = useCallback((dur: RhythmInput) => {
    if (submitted || !score) return;
    const currentTotal = getTotalSixteenths(userInput);
    const adding = SIXTEENTHS_MAP[dur] ?? 4;
    if (currentTotal + adding > fullTotalSixteenths) return;
    setUserInput(prev => [...prev, dur]);
  }, [submitted, score, userInput, fullTotalSixteenths]);

  const handleRhythmDelete = useCallback(() => {
    if (submitted) return;
    setUserInput(prev => prev.slice(0, -1));
  }, [submitted]);

  // ── 리듬: 제출 + 마디 단위 채점 (마지막 마디 후행 쉼표는 채점 제외) ──
  const handleRhythmSubmit = useCallback(async () => {
    if (!score || submitted) return;

    const gradableAnswer = getGradableMeasures(score.trebleNotes, barSix).flat();
    const { grades, accuracy, correctCount, wrongCount } = gradeRhythmNoteByNote(gradableAnswer, userInput);

    const result: GradingResult = {
      grades,
      accuracy,
      selfRating: accuracy >= 0.9 ? 5 : accuracy >= 0.7 ? 4 : accuracy >= 0.5 ? 3 : accuracy >= 0.3 ? 2 : 1,
      correctCount,
      wrongCount,
      missingCount: 0,
      extraCount: 0,
    };

    if (examMode) {
      examNotationStore.setResult(result.selfRating);
      navigation.goBack();
      return;
    }

    setGradingResult(result);
    setSubmitted(true);
    setHideNotes(false);

    setPracticeCount(prev => prev + 1);
    setRatings(prev => [...prev, result.selfRating]);
    setAccuracies(prev => [...prev, result.accuracy]);
    setCorrectCounts(prev => [...prev, correctCount]);

    const record: PracticeRecord = {
      id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      contentType: category,
      difficulty,
      selfRating: result.selfRating,
      practicedAt: new Date().toISOString(),
    };
    await addRecord(record);
    await updateStreak();

    const evalRating = result.selfRating >= 4 ? 'easy' : result.selfRating >= 3 ? 'normal' : 'hard' as const;
    const levelMatch = difficulty.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    await applyEvaluation('partPractice', level, evalRating);
  }, [score, submitted, userInput, barSix, category, difficulty, addRecord, updateStreak, applyEvaluation, examMode]);

  // ── 선율/2성부: 제출 + 채점 ──
  const handleMelodySubmit = useCallback(async () => {
    if (!score || melodySubmitted) return;

    // 첫 음표는 힌트로 제공되므로 채점에서 제외
    const result = gradeNotes(score.trebleNotes.slice(1), noteInput.trebleNotes.slice(1));
    // userSourceIndices를 +1 오프셋 (원본 배열 기준 색상 표시용)
    result.grades = result.grades.map(g => ({
      ...g,
      userSourceIndices: g.userSourceIndices.map(i => i + 1),
    }));

    if (score.useGrandStaff && score.bassNotes.length > 0) {
      const bassResult = gradeNotes(score.bassNotes, noteInput.bassNotes);
      const totalGrades = [...result.grades, ...bassResult.grades];
      const answerLen = result.grades.length + bassResult.grades.length;
      const correctCount = totalGrades.filter(g => g.grade === 'correct').length;
      const combinedAcc = answerLen > 0 ? Math.round((correctCount / answerLen) * 100) / 100 : 0;
      result.accuracy = combinedAcc;
      result.selfRating = combinedAcc >= 0.9 ? 5 : combinedAcc >= 0.7 ? 4 : combinedAcc >= 0.5 ? 3 : combinedAcc >= 0.3 ? 2 : 1;
      result.correctCount = correctCount;
      result.wrongCount = totalGrades.filter(g => g.grade === 'wrong').length;
      result.missingCount = totalGrades.filter(g => g.grade === 'missing').length;
      result.extraCount = totalGrades.filter(g => g.grade === 'extra').length;
    }

    if (examMode) {
      examNotationStore.setResult(result.selfRating);
      navigation.goBack();
      return;
    }

    setGradingResult(result);
    setMelodySubmitted(true);
    setHideNotes(false);

    setPracticeCount(prev => prev + 1);
    setRatings(prev => [...prev, result.selfRating]);
    setAccuracies(prev => [...prev, result.accuracy]);

    const record: PracticeRecord = {
      id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      contentType: category,
      difficulty,
      selfRating: result.selfRating,
      practicedAt: new Date().toISOString(),
    };
    await addRecord(record);
    await updateStreak();

    const evalRating = result.selfRating >= 4 ? 'easy' : result.selfRating >= 3 ? 'normal' : 'hard' as const;
    const track = category === 'twoVoice' ? 'comprehensive' : 'partPractice' as const;
    const levelMatch = difficulty.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    await applyEvaluation(track, level, evalRating);
  }, [score, melodySubmitted, noteInput.trebleNotes, noteInput.bassNotes,
      category, difficulty, addRecord, updateStreak, applyEvaluation, examMode]);

  const userTotalSixteenths = getTotalSixteenths(userInput);
  const rhythmFilled = userTotalSixteenths >= fullTotalSixteenths && fullTotalSixteenths > 0;
  const noteButtons = NOTE_BUTTONS;
  const restButtons = REST_BUTTONS;

  // ── 결과 화면 ──
  if (showResult) {
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;
    const avgAccuracy = accuracies.length > 0
      ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
      : 0;
    const percentage = Math.round(avgAccuracy * 100);
    const totalCorrect = correctCounts.reduce((a, b) => a + b, 0);

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultCircle, { borderColor: colors.main }]}>
            <Text style={[styles.resultScore, { color: colors.main }]}>{percentage}%</Text>
            <Text style={styles.resultMax}>{avgRating} / 5</Text>
          </View>

          <Text style={styles.resultTitle}>{t('practice:choice.resultTitle')}</Text>
          <Text style={styles.resultDesc}>
            {t(`content:category.${category}.name`)} · {diffLabel} · {t('practice:notation.problemCount', { count: practiceCount })}
          </Text>

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: colors.main }]}
              onPress={() => {
                setShowResult(false);
                setPracticeCount(0);
                setRatings([]);
                setAccuracies([]);
                setCorrectCounts([]);
                generate();
              }}
            >
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.resultBtnText}>{t('practice:choice.retryPractice')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: COLORS.slate200 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.resultBtnText, { color: COLORS.slate700 }]}>{t('common:button.goBack')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── 연습 화면 ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        {!melodySubmitted && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft size={24} color={colors.main} />
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.main }]}>{t(`content:category.${category}.name`)}</Text>
          <Text style={styles.headerSub}>{diffLabel} · {t('practice:notation.problemCount', { count: practiceCount + 1 })}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isMelodyInput && !melodySubmitted && (
            <TouchableOpacity onPress={noteInput.clear} hitSlop={8}>
              <Text style={[styles.finishText, { color: COLORS.slate500, fontSize: 13 }]}>{t('practice:notation.reset')}</Text>
            </TouchableOpacity>
          )}
          {practiceCount > 0 && (submitted || melodySubmitted || rated) && (
            <TouchableOpacity onPress={handleFinish} hitSlop={8}>
              <Text style={[styles.finishText, { color: colors.main }]}>{t('practice:notation.finish')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          melodySubmitted
            ? { paddingBottom: insets.bottom + 24, flexGrow: 1 }
            : { paddingBottom: insets.bottom + 120 },
        ]}
        onScroll={(e) => {
          if (!isDragScrollingRef.current) {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }
        }}
        scrollEventThrottle={16}
      >
        {isGenerating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.main} />
            <Text style={styles.loadingText}>{t('practice:notation.generating')}</Text>
          </View>
        ) : (
          <>
            {/* 숨겨진 스케일 렌더러 (오디오 전용) */}
            {isMelodyInput && scaleAbcString ? (
              <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <AbcjsRenderer
                  ref={scaleAbcjsRef}
                  abcString={scaleAbcString}
                  hideNotes={true}
                  tempo={90}
                  onPlayStateChange={handleScalePlayStateChange}
                  timeSignature={score?.timeSignature ?? '4/4'}
                />
              </View>
            ) : null}

            {/* 재생 카드 — 선율/2성부 모드에서는 컴팩트 + 스케일 듣기 (제출 전만 표시) */}
            {isMelodyInput && !melodySubmitted ? (
              <View style={[styles.playCardCompact, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
                <TouchableOpacity
                  style={styles.playGroupCompact}
                  onPress={handlePlayScale}
                  activeOpacity={0.7}
                >
                  <View style={[styles.playBtnSmall, { backgroundColor: isPlayingScale ? COLORS.slate400 : colors.main + '18' }]}>
                    <Music size={18} color={isPlayingScale ? '#fff' : colors.main} />
                  </View>
                  <Text style={[styles.playHint, { color: COLORS.slate500, fontSize: 11 }]}>
                    {isPlayingScale ? t('practice:notation.scalePlayingShort') : t('practice:notation.scale')}
                  </Text>
                </TouchableOpacity>
                <View style={{ width: 1, height: 20, backgroundColor: COLORS.slate200, marginHorizontal: 4 }} />
                <TouchableOpacity
                  style={styles.playGroupCompact}
                  onPress={handlePlay}
                  activeOpacity={0.7}
                >
                  <View style={[styles.playBtnSmall, { backgroundColor: isPlaying ? COLORS.slate400 : colors.main }]}>
                    {isPlaying
                      ? <VolumeX size={20} color="#fff" />
                      : <Volume2 size={20} color="#fff" />}
                  </View>
                  <Text style={[styles.playHint, { color: colors.text }]}>
                    {isPlaying ? t('practice:notation.playing') : t('practice:notation.tapToPlay')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (!isMelodyInput && !(isRhythm && submitted)) ? (
              <View style={[styles.playCard, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: isPlaying ? COLORS.slate400 : colors.main }]}
                  onPress={handlePlay}
                  activeOpacity={0.7}
                >
                  {isPlaying
                    ? <VolumeX size={28} color="#fff" />
                    : <Volume2 size={28} color="#fff" />}
                </TouchableOpacity>
                <Text style={[styles.playHint, { color: colors.text }]}>
                  {isPlaying ? t('practice:notation.playing') : t('practice:notation.tapToPlay')}
                </Text>
              </View>
            ) : null}

            {/* 악보 영역 — 선율/2성부에서는 숨김 (오디오 재생용 렌더러만 유지) */}
            {isMelodyInput ? (
              <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <AbcjsRenderer
                  ref={abcjsRef}
                  abcString={abcString}
                  hideNotes={true}
                  tempo={practiceSettings?.tempo ?? 80}
                  isPlaying={isPlaying}
                  onPlayStateChange={handlePlayStateChange}
                  barsPerStaff={2}
                  prependMetronome={true}
                  timeSignature={score?.timeSignature ?? '4/4'}
                />
              </View>
            ) : (isRhythm && submitted) ? (
              /* 리듬 제출 후: 정답 악보 숨김 — GradingResultView에서 표시 */
              <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                <AbcjsRenderer
                  ref={abcjsRef}
                  abcString={abcString}
                  hideNotes={true}
                  tempo={practiceSettings?.tempo ?? 80}
                  isPlaying={isPlaying}
                  onPlayStateChange={handlePlayStateChange}
                  timeSignature={score?.timeSignature ?? '4/4'}
                />
              </View>
            ) : (
              <View style={[styles.scoreCard, { borderColor: colors.main + '20' }]}>
                <View style={styles.scoreHeader}>
                  <Text style={styles.scoreLabel}>
                    {hideNotes ? (isRhythm ? t('practice:notation.listenRhythm') : t('practice:notation.scoreHidden')) : t('practice:notation.answerScore')}
                  </Text>
                  {!isRhythm && (
                    <TouchableOpacity
                      onPress={() => rated && setHideNotes(h => !h)}
                      disabled={!rated}
                      style={{ opacity: rated ? 1 : 0.3 }}
                    >
                      {hideNotes
                        ? <EyeOff size={18} color={COLORS.slate400} />
                        : <Eye size={18} color={colors.main} />}
                    </TouchableOpacity>
                  )}
                </View>
                <AbcjsRenderer
                  ref={abcjsRef}
                  abcString={abcString}
                  hideNotes={hideNotes}
                  tempo={practiceSettings?.tempo ?? 80}
                  onScrollDelta={handleScrollDelta}
                  isPlaying={isPlaying}
                  onPlayStateChange={handlePlayStateChange}
                  barsPerStaff={isRhythm ? 4 : score?.barsPerStaff}
                  prependMetronome={isRhythm}
                  showNoteCursor={!isRhythm}
                  timeSignature={score?.timeSignature ?? '4/4'}
                />
              </View>
            )}

            {/* 선율/2성부 모드: 답안 악보 */}
            {isMelodyInput && !melodySubmitted && (
              <View style={styles.rhythmInputDisplay}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.rhythmInputLabel}>{t('practice:notation.myAnswer')}</Text>
                  <Text style={{ fontSize: 12, color: colors.main, fontWeight: '600' }}>
                    {t('practice:notation.barBeat', {
                      measure: noteInput.getCurrentPositionInfo().measure,
                      total: noteInput.getCurrentPositionInfo().totalMeasures,
                      beat: noteInput.getCurrentPositionInfo().beat,
                    })}
                  </Text>
                </View>
                <View style={[styles.scoreCard, { borderColor: colors.main + '20' }]}>
                  <AbcjsRenderer
                    abcString={noteInput.getUserAbcString()}
                    hideNotes={false}
                    tempo={practiceSettings?.tempo ?? 80}
                    barsPerStaff={2}
                    timeSignature={score?.timeSignature ?? '4/4'}
                    stretchLast={true}
                    onScrollDelta={handleScrollDelta}
                    onNoteClick={(index, voice) => {
                      if (Date.now() - lastAddTimeRef.current < 300) return;
                      noteInput.setActiveVoice(voice);
                      noteInput.moveCursor(index);
                    }}
                    selectedNote={{
                      index: noteInput.cursorIndex,
                      voice: noteInput.activeVoice,
                    }}
                  />
                </View>
              </View>
            )}

            {/* 선율/2성부 모드: 채점 결과 */}
            {isMelodyInput && melodySubmitted && gradingResult && (
              <GradingResultView
                answerAbcString={abcString}
                userAbcString={noteInput.getUserAbcString()}
                gradingResult={gradingResult}
                timeSignature={score?.timeSignature ?? '4/4'}
                accentColor={colors.main}
                barsPerStaff={2}
                onScrollDelta={handleScrollDelta}
              />
            )}

            {/* 리듬 모드: 제출 전 — 사용자 입력 실시간 표시 */}
            {isRhythm && !submitted && (
              <View style={styles.rhythmInputDisplay}>
                <Text style={styles.rhythmInputLabel}>
                  {t('practice:notation.myAnswerMeasure', {
                    current: splitRhythmIntoMeasures(userInput, barSix).filter(m => getTotalSixteenths(m) >= barSix).length,
                    total: splitRhythmIntoMeasures(fullAnswer, barSix).length,
                  })}
                </Text>
                {userInput.length > 0 ? (
                  <View style={[styles.scoreCard, { borderColor: colors.main + '20' }]}>
                    <AbcjsRenderer
                      abcString={userInputToAbc(userInput, timeSignature, practiceSettings?.rhythmPitch ?? 'B')}
                      hideNotes={false}
                      tempo={practiceSettings?.tempo ?? 80}
                      barsPerStaff={4}
                      stretchLast={false}
                    />
                  </View>
                ) : (
                  <View style={styles.rhythmEmptyAnswer}>
                    <Text style={styles.rhythmEmptyText}>{t('practice:notation.tapNoteToInput')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 리듬 모드: 제출 후 — 선율과 동일한 결과 화면 */}
            {isRhythm && submitted && gradingResult && (
              <GradingResultView
                answerAbcString={abcString}
                userAbcString={userInputToAbc(userInput, timeSignature, practiceSettings?.rhythmPitch ?? 'B')}
                gradingResult={gradingResult}
                timeSignature={timeSignature}
                accentColor={colors.main}
                barsPerStaff={2}
                onScrollDelta={handleScrollDelta}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* 하단 고정 — 채점 결과: 다음 문제 버튼 (선율/리듬 제출 후) */}
      {!isGenerating && ((isMelodyInput && melodySubmitted) || (isRhythm && submitted)) && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {examMode ? (
            <View style={styles.nextRow}>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: COLORS.amber500 }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.nextBtnText}>{t('practice:notation.backToExam')}</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
          <View style={styles.nextRow}>
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.main }]}
              onPress={handleNext}
            >
              <Text style={styles.nextBtnText}>{t('practice:choice.nextQuestion')}</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
            {practiceCount >= 1 && (
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: COLORS.slate200 }]}
                onPress={handleFinish}
              >
                <Text style={[styles.nextBtnText, { color: COLORS.slate700 }]}>{t('practice:choice.finishPractice')}</Text>
              </TouchableOpacity>
            )}
          </View>
          )}
        </View>
      )}

      {/* 하단 고정 — 입력 모드 (제출 전만) */}
      {!isGenerating && !(isMelodyInput && melodySubmitted) && !(isRhythm && submitted) && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* 되돌리기 — 경계선 우측 상단 */}
          {isMelodyInput && !melodySubmitted && (
            <TouchableOpacity
              style={styles.undoFloating}
              onPress={noteInput.undo}
              accessibilityLabel={t('practice:notation.undo')}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="undo" size={14} color={COLORS.slate400} />
            </TouchableOpacity>
          )}
          {isRhythm ? (
            // ── 리듬 모드: 음표 버튼 팔레트 ──
            !submitted ? (
              <>
                {/* 음표/쉼표 탭 */}
                <View style={styles.rhythmTabRow}>
                  <TouchableOpacity
                    style={[styles.rhythmTab, rhythmTab === 'note' && { backgroundColor: colors.main }]}
                    onPress={() => setRhythmTab('note')}
                  >
                    <MaterialCommunityIcons name="music-note-quarter" size={16} color={rhythmTab === 'note' ? '#fff' : COLORS.slate500} />
                    <Text style={[styles.rhythmTabText, rhythmTab === 'note' && { color: '#fff' }]}>{t('practice:notation.noteTab')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rhythmTab, rhythmTab === 'rest' && { backgroundColor: COLORS.slate600 }]}
                    onPress={() => setRhythmTab('rest')}
                  >
                    <MaterialCommunityIcons name="music-rest-quarter" size={16} color={rhythmTab === 'rest' ? '#fff' : COLORS.slate500} />
                    <Text style={[styles.rhythmTabText, rhythmTab === 'rest' && { color: '#fff' }]}>{t('practice:notation.restTab')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.rhythmBtnRow}>
                  {(rhythmTab === 'note' ? noteButtons : restButtons).map(dur => {
                    const iconName = DURATION_ICON[dur] ?? 'music-note-quarter';
                    const isNote = rhythmTab === 'note';
                    return (
                      <TouchableOpacity
                        key={dur}
                        style={[styles.rhythmDurBtn, { borderColor: isNote ? colors.main + '40' : COLORS.slate300 }]}
                        onPress={() => handleRhythmInput(dur)}
                        disabled={rhythmFilled}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={iconName as any}
                          size={26}
                          color={isNote ? colors.main : COLORS.slate600}
                        />
                        <Text style={[styles.rhythmDurLabel, { color: isNote ? colors.main : COLORS.slate600 }]}>
                          {DURATION_LABELS[dur] ?? dur}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.rhythmActionRow}>
                  <TouchableOpacity
                    style={[styles.rhythmActionBtn, { backgroundColor: COLORS.slate100 }]}
                    onPress={handleRhythmDelete}
                    disabled={userInput.length === 0}
                  >
                    <Text style={[styles.rhythmActionBtnText, { color: COLORS.slate600 }]}>
                      {t('practice:notation.delete')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rhythmActionBtn, {
                      backgroundColor: rhythmFilled ? colors.main : COLORS.slate200,
                    }]}
                    onPress={handleRhythmSubmit}
                    disabled={!rhythmFilled}
                  >
                    <Text style={[styles.rhythmActionBtnText, {
                      color: rhythmFilled ? '#fff' : COLORS.slate400,
                    }]}>
                      {t('practice:notation.submit')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.nextRow}>
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: colors.main }]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextBtnText}>{t('practice:choice.nextQuestion')}</Text>
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
                {practiceCount >= 1 && (
                  <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: COLORS.slate200 }]}
                    onPress={handleFinish}
                  >
                    <Text style={[styles.nextBtnText, { color: COLORS.slate700 }]}>{t('practice:choice.finishPractice')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          ) : isMelodyInput ? (
            // ── 선율/2성부 모드: 피아노 입력 ──
            !melodySubmitted ? (
              <>
                {score?.useGrandStaff && (
                  <View style={styles.voiceRow}>
                    <TouchableOpacity
                      style={[styles.voiceTab, noteInput.activeVoice === 'treble' && { backgroundColor: colors.main }]}
                      onPress={() => noteInput.setActiveVoice('treble')}
                    >
                      <Text style={[styles.voiceTabText, noteInput.activeVoice === 'treble' && { color: '#fff' }]}>{t('practice:notation.treble')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.voiceTab, noteInput.activeVoice === 'bass' && { backgroundColor: colors.main }]}
                      onPress={() => noteInput.setActiveVoice('bass')}
                    >
                      <Text style={[styles.voiceTabText, noteInput.activeVoice === 'bass' && { color: '#fff' }]}>{t('practice:notation.bass')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DurationToolbar
                  selectedDuration={noteInput.selectedDuration}
                  isDotted={noteInput.isDotted}
                  accidentalMode={noteInput.accidentalMode}
                  tieMode={noteInput.selectedNoteIndex !== null ? noteInput.isSelectedNoteTied : noteInput.tieMode}
                  canAddDuration={(dur) => noteInput.canReplaceDuration(dur)}
                  onDurationSelect={(dur) => {
                    noteInput.setDuration(dur);
                  }}
                  onToggleDot={noteInput.toggleDot}
                  onAccidentalMode={noteInput.setAccidentalMode}
                  onToggleTie={() => {
                    if (noteInput.selectedNoteIndex !== null) {
                      noteInput.toggleSelectedTie();
                    } else {
                      noteInput.toggleTie();
                    }
                  }}
                  onAddRest={() => {
                    noteInput.addRest();
                    lastAddTimeRef.current = Date.now();
                  }}
                  onUndo={noteInput.undo}
                  accentColor={colors.main}
                  tripletMode={noteInput.tripletMode}
                  onToggleTriplet={() => {
                    if (noteInput.selectedNoteIndex !== null) {
                      noteInput.replaceWithTriplet();
                    } else {
                      noteInput.toggleTriplet();
                    }
                  }}
                />
                <View style={{ marginTop: 2 }}>
                  <PianoKeyboard
                    onKeyPress={(pitch, octave, acc) => {
                      noteInput.addNote(pitch, octave, acc);
                      lastAddTimeRef.current = Date.now();
                    }}
                    accentColor={colors.main}
                    initialOctave={noteInput.activeVoice === 'bass' ? 3 : 4}
                  />
                </View>
                <View style={[styles.rhythmActionRow, { marginTop: 3 }]}>
                  <TouchableOpacity
                    style={[styles.rhythmActionBtn, {
                      backgroundColor: noteInput.isComplete ? colors.main : COLORS.slate200,
                    }]}
                    onPress={() => {
                      showAlert({
                        title: t('practice:notation.submitConfirmTitle'),
                        message: t('practice:notation.submitConfirmMessage'),
                        type: 'warning',
                        buttons: [
                          { text: t('common:button.cancel'), style: 'cancel' },
                          { text: t('practice:notation.submit'), onPress: handleMelodySubmit },
                        ],
                      });
                    }}
                    disabled={!noteInput.isComplete}
                  >
                    <Text style={[styles.rhythmActionBtnText, {
                      color: noteInput.isComplete ? '#fff' : COLORS.slate400,
                    }]}>{t('practice:notation.submit')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null
          ) : (
            // ── 폴백: 자기 평가 ──
            !rated ? (
              <>
                <Text style={styles.rateLabel}>{t('practice:selfEval.title')}</Text>
                <View style={styles.rateRow}>
                  {[1, 2, 3, 4, 5].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.rateBtn,
                        selfRating === r && { backgroundColor: colors.main, borderColor: colors.main },
                      ]}
                      onPress={() => handleRate(r)}
                    >
                      <Text style={[
                        styles.rateBtnText,
                        selfRating === r && { color: '#fff' },
                      ]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.nextRow}>
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: colors.main }]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextBtnText}>{t('practice:choice.nextQuestion')}</Text>
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
                {practiceCount >= 1 && (
                  <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: COLORS.slate200 }]}
                    onPress={handleFinish}
                  >
                    <Text style={[styles.nextBtnText, { color: COLORS.slate700 }]}>{t('practice:choice.finishPractice')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerSub: { fontSize: 11, color: COLORS.slate500, marginTop: 1 },
  finishText: { fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  // 로딩
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.slate500,
    fontWeight: '600',
  },
  // 재생 카드
  playCard: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  playCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  playGroupCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  // 악보 카드
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate100,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slate500,
  },
  // 하단
  bottomBar: {
    position: 'relative',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.slate200,
    backgroundColor: '#fff',
  },
  undoFloating: {
    position: 'absolute',
    top: -35,
    right: 12,
    zIndex: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate700,
    textAlign: 'center',
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  rateBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    backgroundColor: '#fff',
  },
  rateBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate600,
  },
  nextRow: {
    gap: 8,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  // 결과
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 16,
  },
  resultCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultScore: {
    fontSize: 36,
    fontWeight: '900',
  },
  resultMax: {
    fontSize: 16,
    color: COLORS.slate400,
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.slate800,
  },
  resultDesc: {
    fontSize: 14,
    color: COLORS.slate500,
  },
  resultActions: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  resultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  resultBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  // 리듬 전용
  rhythmInputDisplay: {
    gap: 8,
  },
  rhythmInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate500,
  },
  rhythmInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rhythmEmptyAnswer: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rhythmEmptyText: {
    fontSize: 13,
    color: COLORS.slate400,
  },
  rhythmGradeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  rhythmGradeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rhythmResultText: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  rhythmTabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  rhythmTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.slate100,
  },
  rhythmTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate500,
  },
  rhythmBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
    height: 104,
    alignContent: 'flex-start',
  },
  rhythmDurBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    gap: 1,
  },
  rhythmDurLabel: {
    fontSize: 8,
    fontWeight: '700',
  },
  rhythmActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rhythmActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  rhythmActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  voiceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  voiceTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.slate100,
  },
  voiceTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate500,
  },
});
