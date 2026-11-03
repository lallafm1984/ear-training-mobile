// ─────────────────────────────────────────────────────────────
// ChoicePracticeScreen — 객관식 연습 (음정 / 화성 / 조성)
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  Lightbulb,
  Eye,
  EyeOff,
  BookOpen,
  Share2,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { generateChoiceQuestion, type ChoiceQuestion } from '../lib/questionGenerator';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import { useSessionContentLog } from '../context';
import { useWrongNotes } from '../hooks/useWrongNotes';
import { wrongNoteReviewStore } from '../lib/wrongNoteReviewStore';
import { useMascotExp } from '../hooks/useMascotExp';
import ShareCardModal from '../components/ShareCardModal';
import type { ShareCardData } from '../lib/shareCard';
import type { PracticeRecord } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

type RouteProp = StackScreenProps<MainStackParamList, 'ChoicePractice'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

type AnswerState = 'waiting' | 'correct' | 'wrong';
/** 비교 청취 대상: 정답 소리 / 내가 고른 보기의 소리 */
type CompareTarget = 'correct' | 'mine';

export default function ChoicePracticeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { category, difficulty, review = false } = route.params;
  const { addRecord } = usePracticeHistory();
  const { updateStreak, applyEvaluation } = useSkillProfile();
  const { trackContentRun } = useSessionContentLog();
  const { addWrong, resolve: resolveWrongNote } = useWrongNotes();
  const { level: mascotLevel } = useMascotExp();
  const [shareData, setShareData] = useState<ShareCardData | null>(null);
  const [sessionWrong, setSessionWrong] = useState(0);

  const { t, i18n } = useTranslation(['practice', 'content', 'common', 'wrongNotes', 'share']);
  const colors = CATEGORY_COLORS[category];
  const diffLabel = t('content:difficulty.' + category + '.' + difficulty);

  // 문제 상태
  // 복습 모드면 오답노트 큐에서, 아니면 새로 생성
  const nextQuestion = useCallback(
    () =>
      (review ? wrongNoteReviewStore.next() : null) ?? generateChoiceQuestion(category, difficulty),
    [review, category, difficulty],
  );
  const [question, setQuestion] = useState<ChoiceQuestion>(nextQuestion);
  const reviewTotal = review ? wrongNoteReviewStore.total() : 0;
  const reviewDone = review && wrongNoteReviewStore.remaining() === 0;

  useEffect(() => {
    return () => {
      if (review) wrongNoteReviewStore.clear();
    };
  }, [review]);
  const [answerState, setAnswerState] = useState<AnswerState>('waiting');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [showResult, setShowResult] = useState(false);

  // 해설·비교 청취: 숨겨진 렌더러 하나로 정답 소리와 내 답 소리를 번갈아 재생한다.
  const [playbackAbc, setPlaybackAbc] = useState(question.abcNotation);
  const [compareTarget, setCompareTarget] = useState<CompareTarget | null>(null);
  const [showScore, setShowScore] = useState(false);
  const pendingPlayRef = useRef(false);

  useEffect(() => {
    trackContentRun({ contentType: category, difficulty, source: 'choice_practice' });
  }, [category, difficulty, question.id, trackContentRun]);

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

  // 새 문제가 오면 비교 청취 상태를 초기화한다.
  useEffect(() => {
    setPlaybackAbc(question.abcNotation);
    setCompareTarget(null);
    setShowScore(false);
  }, [question.id, question.abcNotation]);

  // 비교 대상이 바뀌어 렌더러가 새 악보를 받은 뒤 재생한다.
  useEffect(() => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    const timer = setTimeout(() => {
      abcjsRef.current?.togglePlay();
    }, 450);
    return () => clearTimeout(timer);
  }, [playbackAbc]);

  const playCompare = useCallback(
    (target: CompareTarget) => {
      const abc =
        target === 'mine' && selectedChoice
          ? (question.choiceAbc[selectedChoice] ?? question.abcNotation)
          : question.abcNotation;
      setCompareTarget(target);
      abcjsRef.current?.stopPlay();
      if (abc === playbackAbc) {
        // 같은 악보면 처음부터 다시 재생
        setTimeout(() => abcjsRef.current?.togglePlay(), 120);
        return;
      }
      pendingPlayRef.current = true;
      setPlaybackAbc(abc);
    },
    [playbackAbc, question, selectedChoice],
  );

  // 화면 벗어날 때 오디오 정지
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAudio();
      };
    }, [stopAudio]),
  );

  // 애니메이션
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleSelect = useCallback(
    (choice: string) => {
      if (answerState !== 'waiting') return;

      setSelectedChoice(choice);
      const isCorrect = choice === question.correctAnswer;
      setAnswerState(isCorrect ? 'correct' : 'wrong');
      setStats((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));

      // 오답노트: 틀리면 저장(또는 횟수 증가), 복습에서 맞히면 해결
      if (isCorrect) {
        if (review) void resolveWrongNote(question.id);
      } else {
        setSessionWrong((n) => n + 1);
        void addWrong(question, choice, 'practice');
      }

      if (!isCorrect) {
        // 틀렸을 때 흔들기 애니메이션
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
      }
    },
    [answerState, question, review, addWrong, resolveWrongNote, shakeAnim],
  );

  const handleNext = useCallback(() => {
    // 문제 전환 시 오디오 정지
    stopAudio();

    // 페이드 아웃 → 새 문제 → 페이드 인
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setQuestion(nextQuestion());
      setAnswerState('waiting');
      setSelectedChoice(null);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [nextQuestion, fadeAnim, stopAudio]);

  const handleFinish = useCallback(async () => {
    stopAudio();

    const selfRating =
      stats.total > 0 ? Math.max(1, Math.round((stats.correct / stats.total) * 5)) : 3;
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
            <Text style={styles.resultFraction}>
              {stats.correct}/{stats.total}
            </Text>
          </View>

          <Text style={styles.resultTitle}>{t('practice:choice.resultTitle')}</Text>
          <Text style={styles.resultDesc}>
            {t('content:category.' + category + '.name')} · {diffLabel}
          </Text>

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: colors.main }]}
              onPress={() => {
                setStats({ correct: 0, total: 0 });
                setSessionWrong(0);
                setShowResult(false);
                setAnswerState('waiting');
                setSelectedChoice(null);
                setIsPlaying(false);
                setQuestion(generateChoiceQuestion(category, difficulty));
              }}
            >
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.resultBtnText}>{t('practice:choice.retryPractice')}</Text>
            </TouchableOpacity>

            {sessionWrong > 0 && (
              <TouchableOpacity
                style={[styles.resultBtn, { backgroundColor: COLORS.primary50 }]}
                onPress={() => navigation.navigate('WrongNotes', { category })}
              >
                <BookOpen size={18} color={COLORS.primary600} />
                <Text style={[styles.resultBtnText, { color: COLORS.primary600 }]}>
                  {t('wrongNotes:result.viewNotes', { count: sessionWrong })}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.resultRow}>
              <TouchableOpacity
                style={[styles.resultBtn, styles.resultHalf, { backgroundColor: COLORS.slate200 }]}
                onPress={() =>
                  setShareData({
                    kind: 'practice',
                    title: t('share:kind.practice'),
                    subtitle: `${t('content:category.' + category + '.name')} · ${diffLabel}`,
                    headline: `${pct}%`,
                    headlineLabel: t('share:stat.accuracy'),
                    stats: [
                      { label: t('share:stat.correct'), value: `${stats.correct}/${stats.total}` },
                      { label: t('share:stat.questions'), value: `${stats.total}` },
                    ],
                    accent: colors.main,
                    date: new Date().toLocaleDateString(i18n.language),
                    mascotLevel,
                    happy: pct >= 60,
                  })
                }
              >
                <Share2 size={16} color={COLORS.slate700} />
                <Text style={[styles.resultBtnText, { color: COLORS.slate700 }]}>
                  {t('share:button')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resultBtn, styles.resultHalf, { backgroundColor: COLORS.slate200 }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.resultBtnText, { color: COLORS.slate700 }]}>
                  {t('common:button.goBack')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <ShareCardModal data={shareData} onClose={() => setShareData(null)} />
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
          <Text style={[styles.headerTitle, { color: colors.main }]}>
            {review ? t('wrongNotes:review.title') : t('content:category.' + category + '.name')}
          </Text>
          <Text style={styles.headerDesc}>
            {review
              ? `${t('content:category.' + category + '.name')} · ${t(
                  'wrongNotes:review.progress',
                  {
                    current: Math.min(
                      stats.total + (answerState === 'waiting' ? 1 : 0),
                      reviewTotal,
                    ),
                    total: reviewTotal,
                  },
                )}`
              : diffLabel}
          </Text>
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
          <View
            style={[
              styles.playCard,
              { backgroundColor: colors.bg, borderColor: colors.main + '30' },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.playBtn,
                { backgroundColor: isPlaying ? COLORS.slate400 : colors.main },
              ]}
              onPress={handlePlay}
              activeOpacity={0.7}
            >
              {isPlaying ? <VolumeX size={28} color="#fff" /> : <Volume2 size={28} color="#fff" />}
            </TouchableOpacity>
            <Text style={[styles.playHint, { color: colors.text }]}>
              {isPlaying ? t('practice:choice.playing') : t('practice:choice.tapToPlay')}
            </Text>
          </View>
          {/* 숨겨진 렌더러 (오디오만 사용) */}
          <View style={styles.hiddenRenderer}>
            <AbcjsRenderer
              ref={abcjsRef}
              abcString={playbackAbc}
              hideNotes
              tempo={80}
              isPlaying={isPlaying}
              onPlayStateChange={setIsPlaying}
            />
          </View>

          {/* 보기 */}
          <Animated.View
            style={[styles.choicesContainer, { transform: [{ translateX: shakeAnim }] }]}
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
                  <View
                    style={[
                      styles.choiceIndex,
                      choice === question.correctAnswer && answerState !== 'waiting'
                        ? { backgroundColor: '#10b981' }
                        : choice === selectedChoice && answerState === 'wrong'
                          ? { backgroundColor: '#ef4444' }
                          : { backgroundColor: COLORS.slate200 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceIndexText,
                        answerState !== 'waiting' &&
                        (choice === question.correctAnswer || choice === selectedChoice)
                          ? { color: '#fff' }
                          : { color: COLORS.slate500 },
                      ]}
                    >
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

          {/* 해설 + 비교 청취 */}
          {answerState !== 'waiting' && (
            <View style={[styles.explainCard, { borderColor: colors.main + '30' }]}>
              <View style={styles.explainHeader}>
                <Lightbulb size={16} color={colors.main} />
                <Text style={[styles.explainTitle, { color: colors.main }]}>
                  {t('practice:choice.explainTitle')}
                </Text>
              </View>
              <Text style={styles.explainAnswer}>{question.correctAnswer}</Text>
              <Text style={styles.explainText}>{question.explanation}</Text>
              {answerState === 'wrong' && (
                <Text style={styles.savedHint}>{t('wrongNotes:choice.saved')}</Text>
              )}

              <View style={styles.compareRow}>
                <TouchableOpacity
                  style={[
                    styles.compareBtn,
                    compareTarget === 'correct' && isPlaying
                      ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                      : { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
                  ]}
                  onPress={() => playCompare('correct')}
                  activeOpacity={0.7}
                >
                  <Volume2
                    size={15}
                    color={compareTarget === 'correct' && isPlaying ? '#fff' : '#047857'}
                  />
                  <Text
                    style={[
                      styles.compareBtnText,
                      { color: compareTarget === 'correct' && isPlaying ? '#fff' : '#047857' },
                    ]}
                  >
                    {t('practice:choice.listenCorrect')}
                  </Text>
                </TouchableOpacity>

                {answerState === 'wrong' &&
                  selectedChoice &&
                  question.choiceAbc[selectedChoice] && (
                    <TouchableOpacity
                      style={[
                        styles.compareBtn,
                        compareTarget === 'mine' && isPlaying
                          ? { backgroundColor: '#ef4444', borderColor: '#ef4444' }
                          : { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
                      ]}
                      onPress={() => playCompare('mine')}
                      activeOpacity={0.7}
                    >
                      <Volume2
                        size={15}
                        color={compareTarget === 'mine' && isPlaying ? '#fff' : '#b91c1c'}
                      />
                      <Text
                        style={[
                          styles.compareBtnText,
                          { color: compareTarget === 'mine' && isPlaying ? '#fff' : '#b91c1c' },
                        ]}
                      >
                        {t('practice:choice.listenMine')}
                      </Text>
                    </TouchableOpacity>
                  )}

                <TouchableOpacity
                  style={[styles.compareBtn, styles.scoreToggleBtn]}
                  onPress={() => setShowScore((v) => !v)}
                  activeOpacity={0.7}
                >
                  {showScore ? (
                    <EyeOff size={15} color={COLORS.slate600} />
                  ) : (
                    <Eye size={15} color={COLORS.slate600} />
                  )}
                  <Text style={[styles.compareBtnText, { color: COLORS.slate600 }]}>
                    {showScore ? t('practice:choice.hideScore') : t('practice:choice.showScore')}
                  </Text>
                </TouchableOpacity>
              </View>

              {showScore && (
                <View style={styles.scoreReveal}>
                  <Text style={styles.scoreRevealLabel}>
                    {compareTarget === 'mine' && selectedChoice
                      ? t('practice:choice.scoreMine', { choice: selectedChoice })
                      : t('practice:choice.scoreCorrect', { choice: question.correctAnswer })}
                  </Text>
                  <AbcjsRenderer abcString={playbackAbc} tempo={80} />
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {answerState !== 'waiting' ? (
          <View style={styles.bottomActions}>
            {!reviewDone && (
              <TouchableOpacity
                style={[styles.bottomBtn, { backgroundColor: colors.main }]}
                onPress={handleNext}
              >
                <Text style={styles.bottomBtnText}>{t('practice:choice.nextQuestion')}</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
            )}

            {(stats.total >= 5 || review) && (
              <TouchableOpacity
                style={[styles.bottomBtn, { backgroundColor: COLORS.slate200 }]}
                onPress={handleFinish}
              >
                <Text style={[styles.bottomBtnText, { color: COLORS.slate700 }]}>
                  {t('practice:choice.finishPractice')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          (stats.total >= 5 || (review && stats.total > 0)) && (
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: COLORS.slate200 }]}
              onPress={handleFinish}
            >
              <Text style={[styles.bottomBtnText, { color: COLORS.slate700 }]}>
                {t('practice:choice.finishPractice')}
              </Text>
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
  savedHint: { fontSize: 11, color: COLORS.slate400, fontWeight: '600', marginTop: 2 },
  explainCard: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explainTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  explainAnswer: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  explainText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.slate600,
  },
  compareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  scoreToggleBtn: {
    backgroundColor: '#f8fafc',
    borderColor: COLORS.slate200,
  },
  compareBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scoreReveal: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  scoreRevealLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate500,
    paddingHorizontal: 10,
    paddingTop: 8,
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
  resultRow: { flexDirection: 'row', gap: 10 },
  resultHalf: { flex: 1 },
});
