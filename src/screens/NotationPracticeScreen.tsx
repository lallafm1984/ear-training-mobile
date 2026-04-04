// ─────────────────────────────────────────────────────────────
// NotationPracticeScreen — 기보형 연습 전용 화면 (선율/리듬/2성부)
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Volume2, VolumeX, Eye, EyeOff, RotateCcw, ChevronRight,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import {
  generateScore, generateAbc, Difficulty, BassDifficulty,
  ScoreNote, PitchName, Accidental,
} from '../lib';
import { buildGeneratorOptions } from '../lib/trackConfig';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

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
  const [hideNotes, setHideNotes] = useState(true);
  const [selfRating, setSelfRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [practiceCount, setPracticeCount] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);

  // ── 악보 생성 ──
  const generate = useCallback(() => {
    setIsGenerating(true);
    setHideNotes(true);
    setSelfRating(0);
    setRated(false);
    setIsPlaying(false);

    // 약간의 딜레이로 로딩 표시
    setTimeout(() => {
      const newScore = generatePracticeScore(category, difficulty);
      setScore(newScore);
      setIsGenerating(false);
    }, 500);
  }, [category, difficulty]);

  // 마운트 시 첫 악보 생성
  useEffect(() => { generate(); }, [generate]);

  // 화면 이탈 시 오디오 정지
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isPlaying) abcjsRef.current?.togglePlay();
      };
    }, [isPlaying]),
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

  // ── 재생 ──
  const handlePlay = useCallback(() => {
    abcjsRef.current?.togglePlay();
  }, []);

  // ── 자기 평가 ──
  const handleRate = useCallback(async (rating: number) => {
    setSelfRating(rating);
    setRated(true);
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
  }, [category, difficulty, addRecord, updateStreak]);

  // ── 다음 문제 ──
  const handleNext = useCallback(() => {
    if (isPlaying) abcjsRef.current?.togglePlay();
    generate();
  }, [generate, isPlaying]);

  // ── 연습 종료 ──
  const handleFinish = useCallback(() => {
    if (isPlaying) abcjsRef.current?.togglePlay();
    setShowResult(true);
  }, [isPlaying]);

  // ── 결과 화면 ──
  if (showResult) {
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

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
            {/* 재생 카드 */}
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

            {/* 악보 영역 */}
            <View style={[styles.scoreCard, { borderColor: colors.main + '20' }]}>
              <View style={styles.scoreHeader}>
                <Text style={styles.scoreLabel}>
                  {hideNotes ? '악보가 숨겨져 있습니다' : '악보'}
                </Text>
                <TouchableOpacity
                  onPress={() => rated && setHideNotes(h => !h)}
                  disabled={!rated}
                  style={{ opacity: rated ? 1 : 0.3 }}
                >
                  {hideNotes
                    ? <EyeOff size={18} color={COLORS.slate400} />
                    : <Eye size={18} color={colors.main} />}
                </TouchableOpacity>
              </View>
              <AbcjsRenderer
                ref={abcjsRef}
                abcString={abcString}
                hideNotes={hideNotes}
                tempo={90}
                isPlaying={isPlaying}
                onPlayStateChange={setIsPlaying}
                barsPerStaff={score?.barsPerStaff}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* 하단 고정: 자기 평가 또는 다음/종료 */}
      {!isGenerating && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!rated ? (
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
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
    backgroundColor: COLORS.bgPrimary,
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
});
