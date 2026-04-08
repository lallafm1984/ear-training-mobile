// ─────────────────────────────────────────────────────────────
// ChoicePracticeScreen — 객관식 연습 (음정 / 화성 / 조성)
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Volume2, VolumeX, Check, X, RotateCcw, ChevronRight,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import { generateChoiceQuestion, type ChoiceQuestion } from '../lib/questionGenerator';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

type RouteProp = StackScreenProps<MainStackParamList, 'ChoicePractice'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

type AnswerState = 'waiting' | 'correct' | 'wrong';

export default function ChoicePracticeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { category, difficulty } = route.params;
  const { addRecord } = usePracticeHistory();
  const { updateStreak, applyEvaluation } = useSkillProfile();

  const config = getContentConfig(category);
  const colors = CATEGORY_COLORS[category];
  const diffLabel = getDifficultyLabel(category, difficulty);

  // 문제 상태
  const [question, setQuestion] = useState<ChoiceQuestion>(() =>
    generateChoiceQuestion(category, difficulty),
  );
  const [answerState, setAnswerState] = useState<AnswerState>('waiting');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [showResult, setShowResult] = useState(false);

  // 오디오 재생
  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopAudio = useCallback(() => {
    abcjsRef.current?.stopPlay();
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      abcjsRef.current?.stopPlay();
    } else {
      abcjsRef.current?.togglePlay();
    }
  }, [isPlaying]);

  // 문제 진입/변경 시 자동 1회 재생 (렌더러 초기화 대기 후)
  useEffect(() => {
    const timer = setTimeout(() => {
      abcjsRef.current?.togglePlay();
    }, 500);
    return () => clearTimeout(timer);
  }, [question.id]);

  // 화면 벗어날 때 오디오 정지
  useFocusEffect(
    useCallback(() => {
      return () => { stopAudio(); };
    }, [stopAudio]),
  );

  // 애니메이션
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleSelect = useCallback((choice: string) => {
    if (answerState !== 'waiting') return;

    setSelectedChoice(choice);
    const isCorrect = choice === question.correctAnswer;
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    if (!isCorrect) {
      // 틀렸을 때 흔들기 애니메이션
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [answerState, question.correctAnswer, shakeAnim]);

  const handleNext = useCallback(() => {
    // 문제 전환 시 오디오 정지
    stopAudio();

    // 페이드 아웃 → 새 문제 → 페이드 인
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => {
      setQuestion(generateChoiceQuestion(category, difficulty));
      setAnswerState('waiting');
      setSelectedChoice(null);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  }, [category, difficulty, fadeAnim]);

  const handleFinish = useCallback(async () => {
    stopAudio();

    const selfRating = stats.total > 0 ? Math.max(1, Math.round((stats.correct / stats.total) * 5)) : 3;
    const record: PracticeRecord = {
      id: `pr_${Date.now()}`,
      contentType: category,
      difficulty,
      selfRating,
      practicedAt: new Date().toISOString(),
    };

    await addRecord(record);
    await updateStreak();

    // 스킬 프로필 정확도 업데이트
    const pct = stats.total > 0 ? stats.correct / stats.total : 0.5;
    const evalRating = pct >= 0.8 ? 'easy' : pct >= 0.5 ? 'normal' : 'hard';
    const levelMatch = difficulty.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    await applyEvaluation('partPractice', level, evalRating);

    setShowResult(true);
  }, [category, difficulty, stats, addRecord, updateStreak, applyEvaluation, stopAudio]);

  const getChoiceStyle = (choice: string) => {
    if (answerState === 'waiting') {
      return styles.choiceDefault;
    }
    if (choice === question.correctAnswer) {
      return styles.choiceCorrect;
    }
    if (choice === selectedChoice && answerState === 'wrong') {
      return styles.choiceWrong;
    }
    return styles.choiceDisabled;
  };

  const getChoiceTextColor = (choice: string) => {
    if (answerState === 'waiting') return COLORS.slate700;
    if (choice === question.correctAnswer) return '#065f46';
    if (choice === selectedChoice && answerState === 'wrong') return '#991b1b';
    return COLORS.slate400;
  };

  // ─── 결과 화면 ───
  if (showResult) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultCircle, { borderColor: colors.main }]}>
            <Text style={[styles.resultPct, { color: colors.main }]}>{pct}%</Text>
            <Text style={styles.resultFraction}>{stats.correct}/{stats.total}</Text>
          </View>

          <Text style={styles.resultTitle}>연습 완료!</Text>
          <Text style={styles.resultDesc}>
            {config.name} · {diffLabel}
          </Text>

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: colors.main }]}
              onPress={() => {
                setStats({ correct: 0, total: 0 });
                setShowResult(false);
                setAnswerState('waiting');
                setSelectedChoice(null);
                setIsPlaying(false);
                setQuestion(generateChoiceQuestion(category, difficulty));
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

  // ─── 문제 풀기 화면 ───
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.main} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.main }]}>{config.name}</Text>
          <Text style={styles.headerDesc}>{diffLabel}</Text>
        </View>
        <View style={styles.statsChip}>
          <Text style={styles.statsText}>
            {stats.correct}/{stats.total}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.questionArea, { opacity: fadeAnim }]}>
          {/* 문제 프롬프트 */}
          <Text style={styles.prompt}>{question.prompt}</Text>

          {/* 재생 버튼 + 숨겨진 AbcjsRenderer */}
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
          {/* 숨겨진 렌더러 (오디오만 사용) */}
          <View style={styles.hiddenRenderer}>
            <AbcjsRenderer
              ref={abcjsRef}
              abcString={question.abcNotation}
              hideNotes
              tempo={80}
              isPlaying={isPlaying}
              onPlayStateChange={setIsPlaying}
            />
          </View>

          {/* 보기 */}
          <Animated.View
            style={[
              styles.choicesContainer,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {question.choices.map((choice, idx) => (
              <TouchableOpacity
                key={`${question.id}_${idx}`}
                style={[styles.choiceItem, getChoiceStyle(choice)]}
                onPress={() => handleSelect(choice)}
                activeOpacity={answerState === 'waiting' ? 0.7 : 1}
                disabled={answerState !== 'waiting'}
              >
                <View style={styles.choiceLeft}>
                  <View style={[
                    styles.choiceIndex,
                    choice === question.correctAnswer && answerState !== 'waiting'
                      ? { backgroundColor: '#10b981' }
                      : choice === selectedChoice && answerState === 'wrong'
                        ? { backgroundColor: '#ef4444' }
                        : { backgroundColor: COLORS.slate200 },
                  ]}>
                    <Text style={[
                      styles.choiceIndexText,
                      (answerState !== 'waiting' && (choice === question.correctAnswer || choice === selectedChoice))
                        ? { color: '#fff' }
                        : { color: COLORS.slate500 },
                    ]}>
                      {String.fromCharCode(65 + idx)}
                    </Text>
                  </View>
                  <Text style={[styles.choiceText, { color: getChoiceTextColor(choice) }]}>
                    {choice}
                  </Text>
                </View>

                {answerState !== 'waiting' && choice === question.correctAnswer && (
                  <Check size={18} color="#10b981" />
                )}
                {answerState === 'wrong' && choice === selectedChoice && (
                  <X size={18} color="#ef4444" />
                )}
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Animated.View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {answerState !== 'waiting' ? (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: colors.main }]}
              onPress={handleNext}
            >
              <Text style={styles.bottomBtnText}>다음 문제</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>

            {stats.total >= 5 && (
              <TouchableOpacity
                style={[styles.bottomBtn, { backgroundColor: COLORS.slate200 }]}
                onPress={handleFinish}
              >
                <Text style={[styles.bottomBtnText, { color: COLORS.slate700 }]}>연습 종료</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          stats.total >= 5 && (
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: COLORS.slate200 }]}
              onPress={handleFinish}
            >
              <Text style={[styles.bottomBtnText, { color: COLORS.slate700 }]}>연습 종료</Text>
            </TouchableOpacity>
          )
        )}
      </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  headerDesc: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 2,
  },
  statsChip: {
    backgroundColor: COLORS.slate100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate700,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 20,
  },
  questionArea: {
    gap: 20,
  },
  prompt: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.slate800,
    textAlign: 'center',
  },
  playCard: {
    alignItems: 'center',
    paddingVertical: 32,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  hiddenRenderer: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  choicesContainer: {
    gap: 10,
  },
  choiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  choiceDefault: {
    backgroundColor: '#fff',
    borderColor: COLORS.slate200,
  },
  choiceCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  choiceWrong: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  choiceDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: COLORS.slate100,
  },
  choiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  choiceIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIndexText: {
    fontSize: 13,
    fontWeight: '800',
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
  },
  bottomActions: {
    gap: 8,
  },
  bottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  bottomBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  // 결과 화면
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  resultCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  resultPct: {
    fontSize: 36,
    fontWeight: '900',
  },
  resultFraction: {
    fontSize: 14,
    color: COLORS.slate500,
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 24,
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
    marginTop: 24,
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
