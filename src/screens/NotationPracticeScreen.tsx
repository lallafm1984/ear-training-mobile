// ─────────────────────────────────────────────────────────────
// NotationPracticeScreen — 기보형 연습 전용 화면 (선율/리듬/2성부)
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Volume2, VolumeX, Eye, EyeOff, RotateCcw, ChevronRight, Delete,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import {
  generateScore, generateAbc, Difficulty, BassDifficulty,
  ScoreNote, PitchName, Accidental, durationToSixteenths,
} from '../lib';
import type { NoteDuration } from '../lib/scoreUtils';
import { buildGeneratorOptions } from '../lib/trackConfig';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';
import PianoKeyboard from '../components/PianoKeyboard';
import DurationToolbar from '../components/DurationToolbar';
import GradingResultView from '../components/GradingResult';
import { useNoteInput } from '../hooks/useNoteInput';
import { gradeNotes, type GradingResult } from '../lib/grading';

type RouteProp = StackScreenProps<MainStackParamList, 'NotationPractice'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

// ─────────────────────────────────────────────────────────────
// 카테고리별 악보 생성
// ─────────────────────────────────────────────────────────────

function melodyDifficultyToLevel(difficulty: ContentDifficulty): number {
  const map: Record<string, number> = {
    beginner_1: 1, beginner_2: 2, beginner_3: 3,
    intermediate_1: 4, intermediate_2: 5, intermediate_3: 6,
    advanced_1: 7, advanced_2: 8, advanced_3: 9,
  };
  return map[difficulty] ?? 1;
}

function rhythmDifficultyToLevel(difficulty: ContentDifficulty): number {
  const map: Record<string, number> = {
    rhythm_1: 1, rhythm_2: 2, rhythm_3: 4,
    rhythm_4: 6, rhythm_5: 9, rhythm_6: 9,
  };
  return map[difficulty] ?? 1;
}

interface PracticeScore {
  trebleNotes: ScoreNote[];
  bassNotes: ScoreNote[];
  keySignature: string;
  timeSignature: string;
  useGrandStaff: boolean;
  barsPerStaff?: number;
}

function generatePracticeScore(category: ContentCategory, difficulty: ContentDifficulty): PracticeScore {
  if (category === 'melody') {
    const level = melodyDifficultyToLevel(difficulty);
    const trackOpts = buildGeneratorOptions('partPractice', level);
    const result = generateScore({
      keySignature: trackOpts.keySignature,
      timeSignature: trackOpts.timeSignature,
      difficulty: trackOpts.difficulty,
      measures: trackOpts.measures,
      useGrandStaff: false,
      practiceMode: 'part',
      partPracticeLevel: level,
    });
    return {
      trebleNotes: result.trebleNotes,
      bassNotes: [],
      keySignature: trackOpts.keySignature,
      timeSignature: trackOpts.timeSignature,
      useGrandStaff: false,
      barsPerStaff: level <= 2 ? 4 : level >= 4 ? 2 : undefined,
    };
  }

  if (category === 'rhythm') {
    const level = rhythmDifficultyToLevel(difficulty);
    const trackOpts = buildGeneratorOptions('partPractice', level);
    const result = generateScore({
      keySignature: 'C',
      timeSignature: trackOpts.timeSignature,
      difficulty: trackOpts.difficulty,
      measures: 4,
      useGrandStaff: false,
      practiceMode: 'part',
      partPracticeLevel: level,
    });
    const rhythmNotes: ScoreNote[] = result.trebleNotes.map(n =>
      n.pitch === 'rest'
        ? n
        : { ...n, pitch: 'B' as PitchName, octave: 4, accidental: '' as Accidental }
    );
    return {
      trebleNotes: rhythmNotes,
      bassNotes: [],
      keySignature: 'C',
      timeSignature: trackOpts.timeSignature,
      useGrandStaff: false,
      barsPerStaff: 4,
    };
  }

  // twoVoice
  const diffMap: Record<string, Difficulty> = {
    bass_1: 'beginner_3', bass_2: 'intermediate_1',
    bass_3: 'intermediate_3', bass_4: 'advanced_1',
  };
  const bassDiffMap: Record<string, BassDifficulty> = {
    bass_1: 'bass_1', bass_2: 'bass_2', bass_3: 'bass_3', bass_4: 'bass_4',
  };
  const result = generateScore({
    keySignature: 'C',
    timeSignature: '4/4',
    difficulty: diffMap[difficulty] ?? 'beginner_3',
    bassDifficulty: bassDiffMap[difficulty] ?? 'bass_1',
    measures: 4,
    useGrandStaff: true,
  });
  return {
    trebleNotes: result.trebleNotes,
    bassNotes: result.bassNotes,
    keySignature: 'C',
    timeSignature: '4/4',
    useGrandStaff: true,
    barsPerStaff: 2,
  };
}

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

const DURATION_LABELS: Record<string, string> = {
  '1': '온음표', '1.': '점온음표',
  '2': '2분', '2.': '점2분',
  '4': '4분', '4.': '점4분',
  '8': '8분', '8.': '점8분',
  '16': '16분',
  'triplet': '셋잇단',
  'r_1': '온쉼표', 'r_2': '2분쉼표', 'r_4': '4분쉼표',
  'r_8': '8분쉼표', 'r_16': '16분쉼표',
};

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
function userInputToAbc(input: RhythmInput[], timeSignature: string): string {
  if (input.length === 0) return '';
  // NoteDuration → sixteenths count (ABC duration with L:1/16)
  const durToAbc: Record<string, string> = {
    '1':  'B16',       // 온음표 = 16 sixteenths
    '1.': 'B24',       // 점온음표 = 24 sixteenths
    '2':  'B8',        // 2분 = 8 sixteenths
    '2.': 'B12',       // 점2분 = 12 sixteenths
    '4':  'B4',        // 4분 = 4 sixteenths
    '4.': 'B6',        // 점4분 = 6 sixteenths
    '8':  'B2',        // 8분 = 2 sixteenths
    '8.': 'B3',        // 점8분 = 3 sixteenths
    '16': 'B1',        // 16분 = 1 sixteenth
    'triplet': '(3:2:3B2B2B2',
    // 쉼표
    'r_1':  'z16',     // 온쉼표
    'r_2':  'z8',      // 2분쉼표
    'r_2.': 'z12',
    'r_4':  'z4',      // 4분쉼표
    'r_4.': 'z6',
    'r_8':  'z2',      // 8분쉼표
    'r_8.': 'z3',
    'r_16': 'z1',      // 16분쉼표
  };
  // 박자표에서 마디 길이 (sixteenths) 계산
  const [top, bottom] = timeSignature.split('/').map(Number);
  const barSixteenths = (top || 4) * (16 / (bottom || 4));

  // 각 입력의 sixteenths 수
  const sixteenthsMap: Record<string, number> = {
    '1': 16, '1.': 24, '2': 8, '2.': 12, '4': 4, '4.': 6,
    '8': 2, '8.': 3, '16': 1, 'triplet': 4,
    'r_1': 16, 'r_2': 8, 'r_2.': 12, 'r_4': 4, 'r_4.': 6,
    'r_8': 2, 'r_8.': 3, 'r_16': 1,
  };

  let abc = '';
  let barPos = 0;
  for (const d of input) {
    abc += (durToAbc[d] ?? 'B4') + ' ';
    barPos += sixteenthsMap[d] ?? 4;
    if (barPos >= barSixteenths) {
      abc += '| ';
      barPos = 0;
    }
  }
  // 마지막 마디선 정리
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { category, difficulty } = route.params;

  const config = getContentConfig(category);
  const colors = CATEGORY_COLORS[category];
  const diffLabel = getDifficultyLabel(category, difficulty);

  const { addRecord } = usePracticeHistory();
  const { applyEvaluation, updateStreak } = useSkillProfile();
  const abcjsRef = useRef<AbcjsRendererHandle>(null);

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
  const [showResult, setShowResult] = useState(false);
  const [rhythmTab, setRhythmTab] = useState<'note' | 'rest'>('note');

  // ── 리듬 전용 상태 ──
  const isRhythm = category === 'rhythm';
  const [userInput, setUserInput] = useState<RhythmInput[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [rhythmResults, setRhythmResults] = useState<{ correct: RhythmInput; user: RhythmInput | null; isCorrect: boolean }[]>([]);
  const [correctCounts, setCorrectCounts] = useState<number[]>([]);

  // ── 선율/2성부 입력 모드 상태 ──
  const isMelodyInput = category === 'melody' || category === 'twoVoice';
  const [melodySubmitted, setMelodySubmitted] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const lastAddTimeRef = useRef(0);

  const firstHintNote = score?.trebleNotes[0] ?? null;

  const noteInput = useNoteInput({
    keySignature: score?.keySignature ?? 'C',
    timeSignature: score?.timeSignature ?? '4/4',
    measures: 4,
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
    setRhythmResults([]);
    setCorrectCounts([]);
    setMelodySubmitted(false);
    setGradingResult(null);
    noteInput.selectNote(null);

    setTimeout(() => {
      const newScore = generatePracticeScore(category, difficulty);
      setScore(newScore);
      if (category === 'melody' || category === 'twoVoice') {
        noteInput.reset(newScore.trebleNotes[0] ?? null);
      }
      setIsGenerating(false);
    }, 500);
  }, [category, difficulty]);

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
      };
    }, []),
  );

  // ── ABC 문자열 생성 ──
  const abcString = score ? generateAbc({
    title: '',
    keySignature: score.keySignature,
    timeSignature: score.timeSignature,
    tempo: 90,
    notes: score.trebleNotes,
    bassNotes: score.useGrandStaff ? score.bassNotes : undefined,
    useGrandStaff: score.useGrandStaff,
  }) : '';

  // ── 재생 상태 콜백 (WebView → React, 자연 종료 포함) ──
  const handlePlayStateChange = useCallback((playing: boolean) => {
    playingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  // ── 재생/정지 (ref 기반, 클로저 이슈 없음) ──
  const handlePlay = useCallback(() => {
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

  // ── 리듬: 음표 입력 ──
  const handleRhythmInput = useCallback((dur: RhythmInput) => {
    if (submitted || !score) return;
    const answer = getAnswerSequence(score.trebleNotes);
    if (userInput.length >= answer.length) return;
    setUserInput(prev => [...prev, dur]);
  }, [submitted, score, userInput.length]);

  const handleRhythmDelete = useCallback(() => {
    if (submitted) return;
    setUserInput(prev => prev.slice(0, -1));
  }, [submitted]);

  // ── 리듬: 제출 + 채점 ──
  const handleRhythmSubmit = useCallback(async () => {
    if (!score || submitted) return;
    const answer = getAnswerSequence(score.trebleNotes);
    const results = answer.map((dur, i) => ({
      correct: dur,
      user: userInput[i] ?? null,
      isCorrect: dur === userInput[i],
    }));
    setRhythmResults(results);
    setSubmitted(true);
    setHideNotes(false);

    const correctCount = results.filter(r => r.isCorrect).length;
    const rating = Math.max(1, Math.round((correctCount / answer.length) * 5));
    setPracticeCount(prev => prev + 1);
    setRatings(prev => [...prev, rating]);
    setCorrectCounts(prev => [...prev, correctCount]);

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
    const levelMatch = difficulty.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    await applyEvaluation('partPractice', level, evalRating);
  }, [score, submitted, userInput, category, difficulty, addRecord, updateStreak, applyEvaluation]);

  // ── 선율/2성부: 제출 + 채점 ──
  const handleMelodySubmit = useCallback(async () => {
    if (!score || melodySubmitted) return;

    const result = gradeNotes(score.trebleNotes, noteInput.trebleNotes);

    if (score.useGrandStaff && score.bassNotes.length > 0) {
      const bassResult = gradeNotes(score.bassNotes, noteInput.bassNotes);
      const totalGrades = [...result.grades, ...bassResult.grades];
      const answerLen = result.grades.length + bassResult.grades.length;
      const correctCount = totalGrades.filter(g => g.grade === 'correct').length;
      const partialCount = totalGrades.filter(g => g.grade === 'partial').length;
      const combinedAcc = answerLen > 0 ? Math.round(((correctCount + partialCount * 0.5) / answerLen) * 100) / 100 : 0;
      result.accuracy = combinedAcc;
      result.selfRating = combinedAcc >= 0.9 ? 5 : combinedAcc >= 0.7 ? 4 : combinedAcc >= 0.5 ? 3 : combinedAcc >= 0.3 ? 2 : 1;
      result.correctCount = correctCount;
      result.partialCount = partialCount;
      result.wrongCount = totalGrades.filter(g => g.grade === 'wrong').length;
      result.missingCount = totalGrades.filter(g => g.grade === 'missing').length;
      result.extraCount = totalGrades.filter(g => g.grade === 'extra').length;
    }

    setGradingResult(result);
    setMelodySubmitted(true);
    setHideNotes(false);
    setPracticeCount(prev => prev + 1);
    setRatings(prev => [...prev, result.selfRating]);

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
      category, difficulty, addRecord, updateStreak, applyEvaluation]);

  const rhythmAnswer = score ? getAnswerSequence(score.trebleNotes) : [];
  const noteButtons = NOTE_BUTTONS;
  const restButtons = REST_BUTTONS;

  // ── 결과 화면 ──
  if (showResult) {
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;
    const totalCorrect = correctCounts.reduce((a, b) => a + b, 0);
    const totalNotes = correctCounts.length > 0 ? correctCounts.length * (rhythmAnswer.length || 1) : 0;

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultCircle, { borderColor: colors.main }]}>
            <Text style={[styles.resultScore, { color: colors.main }]}>{avgRating}</Text>
            <Text style={styles.resultMax}>/5</Text>
          </View>

          <Text style={styles.resultTitle}>연습 완료!</Text>
          <Text style={styles.resultDesc}>
            {config.name} · {diffLabel} · {practiceCount}문제
          </Text>

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: colors.main }]}
              onPress={() => {
                setShowResult(false);
                setPracticeCount(0);
                setRatings([]);
                setCorrectCounts([]);
                generate();
              }}
            >
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.resultBtnText}>다시 연습</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: COLORS.slate200 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.resultBtnText, { color: COLORS.slate700 }]}>돌아가기</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.main} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.main }]}>{config.name}</Text>
          <Text style={styles.headerSub}>{diffLabel} · {practiceCount + 1}문제</Text>
        </View>
        {practiceCount > 0 && (
          <TouchableOpacity onPress={handleFinish} hitSlop={8}>
            <Text style={[styles.finishText, { color: colors.main }]}>종료</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
      >
        {isGenerating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.main} />
            <Text style={styles.loadingText}>악보 생성 중...</Text>
          </View>
        ) : (
          <>
            {/* 재생 카드 — 선율/2성부 모드에서는 컴팩트 */}
            {isMelodyInput ? (
              <View style={[styles.playCardCompact, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
                <TouchableOpacity
                  style={[styles.playBtnSmall, { backgroundColor: isPlaying ? COLORS.slate400 : colors.main }]}
                  onPress={handlePlay}
                  activeOpacity={0.7}
                >
                  {isPlaying
                    ? <VolumeX size={20} color="#fff" />
                    : <Volume2 size={20} color="#fff" />}
                </TouchableOpacity>
                <Text style={[styles.playHint, { color: colors.text }]}>
                  {isPlaying ? '재생 중...' : '탭하여 재생'}
                </Text>
              </View>
            ) : (
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
                  {isPlaying ? '재생 중...' : '탭하여 재생'}
                </Text>
              </View>
            )}

            {/* 악보 영역 */}
            <View style={[styles.scoreCard, { borderColor: colors.main + '20' }]}>
              <View style={styles.scoreHeader}>
                <Text style={styles.scoreLabel}>
                  {hideNotes ? (isRhythm ? '리듬을 듣고 맞춰보세요' : '악보가 숨겨져 있습니다') : '정답 악보'}
                </Text>
                {!isRhythm && !isMelodyInput && (
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
                tempo={90}
                isPlaying={isPlaying}
                onPlayStateChange={handlePlayStateChange}
                barsPerStaff={score?.barsPerStaff}
                prependMetronome={isRhythm}
                timeSignature={score?.timeSignature ?? '4/4'}
              />
            </View>

            {/* 선율/2성부 모드: 답안 악보 */}
            {isMelodyInput && !melodySubmitted && (
              <View style={styles.rhythmInputDisplay}>
                <Text style={styles.rhythmInputLabel}>내 답안</Text>
                {noteInput.trebleNotes.length > 0 ? (
                  <View style={[styles.scoreCard, { borderColor: noteInput.selectedNoteIndex !== null ? colors.main : colors.main + '20' }]}>
                    <AbcjsRenderer
                      abcString={noteInput.getUserAbcString()}
                      hideNotes={false}
                      tempo={90}
                      barsPerStaff={score?.barsPerStaff}
                      timeSignature={score?.timeSignature ?? '4/4'}
                      stretchLast={false}
                      onNoteClick={(index, voice) => {
                        // addNote 직후 자동 선택 방지 (WebView 재렌더링 시 발생할 수 있음)
                        if (Date.now() - lastAddTimeRef.current < 300) return;
                        noteInput.setActiveVoice(voice);
                        noteInput.selectNote(index);
                      }}
                      selectedNote={noteInput.selectedNoteIndex !== null ? {
                        index: noteInput.selectedNoteIndex,
                        voice: noteInput.activeVoice,
                      } : null}
                    />
                  </View>
                ) : (
                  <View style={styles.rhythmEmptyAnswer}>
                    <Text style={styles.rhythmEmptyText}>아래 건반을 탭하여 입력하세요</Text>
                  </View>
                )}
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
                barsPerStaff={score?.barsPerStaff}
                onNext={handleNext}
                onFinish={handleFinish}
                showFinish={practiceCount >= 1}
              />
            )}

            {/* 리듬 모드: 답지 악보 (사용자 입력 실시간 표시) */}
            {isRhythm && (
              <View style={styles.rhythmInputDisplay}>
                <Text style={styles.rhythmInputLabel}>
                  내 답 ({userInput.length}/{rhythmAnswer.length})
                </Text>
                {userInput.length > 0 ? (
                  <View style={[styles.scoreCard, {
                    borderColor: submitted
                      ? (rhythmResults.every(r => r.isCorrect) ? '#86efac' : '#fca5a5')
                      : colors.main + '20',
                  }]}>
                    <AbcjsRenderer
                      abcString={userInputToAbc(userInput, score?.timeSignature ?? '4/4')}
                      hideNotes={false}
                      tempo={90}
                      barsPerStaff={4}
                      stretchLast={false}
                    />
                  </View>
                ) : (
                  <View style={styles.rhythmEmptyAnswer}>
                    <Text style={styles.rhythmEmptyText}>아래 음표를 탭하여 입력하세요</Text>
                  </View>
                )}
                {submitted && (
                  <View style={styles.rhythmGradeRow}>
                    {rhythmResults.map((r, i) => (
                      <View key={i} style={[styles.rhythmGradeDot, {
                        backgroundColor: r.isCorrect ? '#dcfce7' : '#fee2e2',
                        borderColor: r.isCorrect ? '#86efac' : '#fca5a5',
                      }]}>
                        <Text style={{ fontSize: 8, fontWeight: '800', color: r.isCorrect ? '#166534' : '#991b1b' }}>
                          {r.isCorrect ? 'O' : 'X'}
                        </Text>
                      </View>
                    ))}
                    <Text style={[styles.rhythmResultText, { color: colors.main }]}>
                      {rhythmResults.filter(r => r.isCorrect).length}/{rhythmResults.length}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 하단 고정 */}
      {!isGenerating && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
                    <Text style={[styles.rhythmTabText, rhythmTab === 'note' && { color: '#fff' }]}>음표</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rhythmTab, rhythmTab === 'rest' && { backgroundColor: COLORS.slate600 }]}
                    onPress={() => setRhythmTab('rest')}
                  >
                    <MaterialCommunityIcons name="music-rest-quarter" size={16} color={rhythmTab === 'rest' ? '#fff' : COLORS.slate500} />
                    <Text style={[styles.rhythmTabText, rhythmTab === 'rest' && { color: '#fff' }]}>쉼표</Text>
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
                        disabled={userInput.length >= rhythmAnswer.length}
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
                      ← 삭제
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rhythmActionBtn, {
                      backgroundColor: userInput.length === rhythmAnswer.length ? colors.main : COLORS.slate200,
                    }]}
                    onPress={handleRhythmSubmit}
                    disabled={userInput.length !== rhythmAnswer.length}
                  >
                    <Text style={[styles.rhythmActionBtnText, {
                      color: userInput.length === rhythmAnswer.length ? '#fff' : COLORS.slate400,
                    }]}>
                      제출
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
                  <Text style={styles.nextBtnText}>다음 문제</Text>
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
                {practiceCount >= 1 && (
                  <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: COLORS.slate200 }]}
                    onPress={handleFinish}
                  >
                    <Text style={[styles.nextBtnText, { color: COLORS.slate700 }]}>연습 종료</Text>
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
                      <Text style={[styles.voiceTabText, noteInput.activeVoice === 'treble' && { color: '#fff' }]}>높은음자리</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.voiceTab, noteInput.activeVoice === 'bass' && { backgroundColor: colors.main }]}
                      onPress={() => noteInput.setActiveVoice('bass')}
                    >
                      <Text style={[styles.voiceTabText, noteInput.activeVoice === 'bass' && { color: '#fff' }]}>낮은음자리</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DurationToolbar
                  selectedDuration={noteInput.selectedDuration}
                  isDotted={noteInput.isDotted}
                  accidentalMode={noteInput.accidentalMode}
                  tieMode={noteInput.tieMode}
                  canAddDuration={(dur) => {
                    if (noteInput.selectedNoteIndex !== null) {
                      return noteInput.canEditDuration(dur);
                    }
                    return noteInput.canAddDuration(dur);
                  }}
                  onDurationSelect={(dur) => {
                    if (noteInput.selectedNoteIndex !== null) {
                      noteInput.updateSelectedNoteDuration(dur);
                    } else {
                      noteInput.setDuration(dur);
                    }
                  }}
                  onToggleDot={noteInput.toggleDot}
                  onAccidentalMode={noteInput.setAccidentalMode}
                  onToggleTie={noteInput.toggleTie}
                  onAddRest={() => {
                    if (noteInput.selectedNoteIndex !== null) {
                      noteInput.replaceWithRest();
                    } else {
                      noteInput.addRest();
                      lastAddTimeRef.current = Date.now();
                    }
                  }}
                  onUndo={noteInput.undo}
                  onClear={noteInput.clear}
                  accentColor={colors.main}
                  tripletMode={noteInput.tripletMode}
                  onToggleTriplet={noteInput.toggleTriplet}
                />
                <PianoKeyboard
                  onKeyPress={(pitch, octave, acc) => {
                    noteInput.addNote(pitch, octave, acc);
                    lastAddTimeRef.current = Date.now();
                  }}
                  accentColor={colors.main}
                  initialOctave={noteInput.activeVoice === 'bass' ? 3 : 4}
                />
                <View style={styles.rhythmActionRow}>
                  {noteInput.selectedNoteIndex !== null && (
                    <>
                      <Text style={{ fontSize: 11, color: colors.main, fontWeight: '600' }}>
                        건반을 눌러 교체
                      </Text>
                      <TouchableOpacity
                        style={[styles.rhythmActionBtn, { backgroundColor: '#fee2e2' }]}
                        onPress={noteInput.deleteSelectedNote}
                      >
                        <Text style={[styles.rhythmActionBtnText, { color: '#991b1b' }]}>삭제</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rhythmActionBtn, { backgroundColor: COLORS.slate200 }]}
                        onPress={noteInput.cancelEdit}
                      >
                        <Text style={[styles.rhythmActionBtnText, { color: COLORS.slate600 }]}>수정취소</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.rhythmActionBtn, {
                      backgroundColor: noteInput.trebleNotes.length > 1 ? colors.main : COLORS.slate200,
                    }]}
                    onPress={handleMelodySubmit}
                    disabled={noteInput.trebleNotes.length <= 1}
                  >
                    <Text style={[styles.rhythmActionBtnText, {
                      color: noteInput.trebleNotes.length > 1 ? '#fff' : COLORS.slate400,
                    }]}>제출</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null
          ) : (
            // ── 폴백: 자기 평가 ──
            !rated ? (
              <>
                <Text style={styles.rateLabel}>자기 평가</Text>
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
                  <Text style={styles.nextBtnText}>다음 문제</Text>
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
                {practiceCount >= 1 && (
                  <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: COLORS.slate200 }]}
                    onPress={handleFinish}
                  >
                    <Text style={[styles.nextBtnText, { color: COLORS.slate700 }]}>연습 종료</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, color: COLORS.slate500, marginTop: 2 },
  finishText: { fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
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
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  playCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  playBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  // 악보 카드
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate100,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate500,
  },
  // 하단
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.slate200,
    backgroundColor: '#fff',
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
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    backgroundColor: '#fff',
  },
  rateBtnText: {
    fontSize: 18,
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
    gap: 6,
    marginBottom: 8,
    height: 116,
    alignContent: 'flex-start',
  },
  rhythmDurBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    gap: 2,
  },
  rhythmDurLabel: {
    fontSize: 8,
    fontWeight: '700',
  },
  rhythmActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rhythmActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  rhythmActionBtnText: {
    fontSize: 14,
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
