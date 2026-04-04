// ─────────────────────────────────────────────────────────────
// MockExamScreen — 모의시험 진행 화면
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Volume2, VolumeX, ChevronRight, ChevronLeft, Check, X, Clock,
  AlertTriangle,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import { EXAM_PRESETS } from '../lib/examPresets';
import { generateChoiceQuestion, type ChoiceQuestion } from '../lib/questionGenerator';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import type { ExamQuestion, MockExamSession, ExamSection } from '../types/exam';
import type { ContentCategory, PracticeRecord } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

type RouteProp = StackScreenProps<MainStackParamList, 'MockExam'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

interface QuestionItem {
  examQuestion: ExamQuestion;
  choiceQuestion?: ChoiceQuestion;
  sectionIndex: number;
}

export default function MockExamScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { presetId } = route.params;

  const preset = EXAM_PRESETS.find(p => p.id === presetId)!;
  const { addRecord } = usePracticeHistory();
  const { updateStreak } = useSkillProfile();

  // 오디오 재생
  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopAudio = useCallback(() => {
    if (isPlaying) abcjsRef.current?.togglePlay();
  }, [isPlaying]);

  const handlePlay = useCallback(() => {
    abcjsRef.current?.togglePlay();
  }, []);

  // 화면 벗어날 때 오디오 정지
  useFocusEffect(
    useCallback(() => {
      return () => { stopAudio(); };
    }, [stopAudio]),
  );

  // 문제 생성 (최초 1회)
  const questions = useMemo<QuestionItem[]>(() => {
    const items: QuestionItem[] = [];
    preset.sections.forEach((section, sIdx) => {
      for (let i = 0; i < section.questionCount; i++) {
        const isChoice = ['interval', 'chord', 'key'].includes(section.contentType);
        const cq = isChoice
          ? generateChoiceQuestion(section.contentType, section.difficulty)
          : undefined;

        items.push({
          examQuestion: {
            id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            contentType: section.contentType,
            difficulty: section.difficulty,
            correctAnswer: cq?.correctAnswer ?? '',
            choices: cq?.choices,
          },
          choiceQuestion: cq,
          sectionIndex: sIdx,
        });
      }
    });
    return items;
  }, [preset]);

  const totalQuestions = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selfRatings, setSelfRatings] = useState<Record<number, number>>({});

  // 타이머
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const timeLimit = preset.timeLimitMinutes
    ? preset.timeLimitMinutes * 60
    : undefined;
  const isTimeUp = timeLimit ? elapsedSeconds >= timeLimit : false;
  const submittedRef = useRef(false);

  useEffect(() => {
    if (isTimeUp && !submittedRef.current) {
      submittedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      handleSubmit();
    }
  }, [isTimeUp, handleSubmit]);

  // 시험 진행 중 실수로 뒤로가기 방지
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (submittedRef.current) return; // 이미 제출된 경우 허용
      e.preventDefault();
      Alert.alert(
        '시험 종료',
        '시험을 종료하시겠습니까? 진행 상황이 사라집니다.',
        [
          { text: '계속하기', style: 'cancel' },
          { text: '종료', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsubscribe;
  }, [navigation]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];
  const isChoiceType = !!currentQ.choiceQuestion;
  const catConfig = getContentConfig(currentQ.examQuestion.contentType);
  const colors = CATEGORY_COLORS[currentQ.examQuestion.contentType];

  const handleSelectAnswer = useCallback((choice: string) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: choice }));
  }, [currentIndex]);

  const handleSelfRate = useCallback((rating: number) => {
    setSelfRatings(prev => ({ ...prev, [currentIndex]: rating }));
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      stopAudio();
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      stopAudio();
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudio();

    // 결과 계산 + 문항별 연습 기록 저장
    let totalScore = 0;
    const maxScore = totalQuestions * 5;

    const categoryScores: Record<string, { score: number; max: number; count: number }> = {};

    questions.forEach((q, idx) => {
      const cat = q.examQuestion.contentType;
      if (!categoryScores[cat]) {
        categoryScores[cat] = { score: 0, max: 0, count: 0 };
      }
      categoryScores[cat].count++;
      categoryScores[cat].max += 5;

      let score: number;
      if (isChoiceQuestion(q)) {
        const isCorrect = answers[idx] === q.examQuestion.correctAnswer;
        score = isCorrect ? 5 : (selfRatings[idx] ?? 1);
      } else {
        score = selfRatings[idx] ?? 1;
      }
      totalScore += score;
      categoryScores[cat].score += score;

      // 문항별 연습 기록 저장
      const record: PracticeRecord = {
        id: `pr_exam_${Date.now()}_${idx}`,
        contentType: cat,
        difficulty: q.examQuestion.difficulty,
        selfRating: score,
        practicedAt: new Date().toISOString(),
      };
      addRecord(record);
    });

    await updateStreak();

    navigation.replace('ExamResult', {
      presetId: preset.id,
      title: preset.name,
      totalScore,
      maxScore,
      categoryScores: JSON.stringify(categoryScores),
      elapsedSeconds,
      totalQuestions,
    });
  }, [answers, selfRatings, questions, preset, elapsedSeconds, totalQuestions, navigation, stopAudio, addRecord, updateStreak]);

  const confirmSubmit = () => {
    const unanswered = questions.filter((_, idx) => {
      if (isChoiceQuestion(questions[idx])) return !answers[idx];
      return !selfRatings[idx];
    }).length;

    if (unanswered > 0) {
      Alert.alert(
        '미답변 문항',
        `${unanswered}문항이 미답변입니다. 제출하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '제출', onPress: handleSubmit },
        ],
      );
    } else {
      handleSubmit();
    }
  };

  // 진행도
  const answeredCount = questions.filter((_, idx) =>
    answers[idx] || selfRatings[idx]
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Text style={styles.topTitle}>{preset.name}</Text>
          <Text style={styles.topProgress}>
            {currentIndex + 1} / {totalQuestions}
          </Text>
        </View>
        <View style={styles.topRight}>
          <Clock size={14} color={isTimeUp ? COLORS.error : COLORS.slate500} />
          <Text style={[styles.topTimer, isTimeUp && { color: COLORS.error }]}>
            {formatTime(elapsedSeconds)}
            {timeLimit && ` / ${formatTime(timeLimit)}`}
          </Text>
        </View>
      </View>

      {/* 진행 바 */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
              backgroundColor: COLORS.amber500,
            },
          ]}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* 문항 카테고리 표시 */}
        <View style={[styles.catChip, { backgroundColor: colors.bg }]}>
          <Text style={[styles.catChipText, { color: colors.main }]}>
            {catConfig.name}
          </Text>
          <Text style={styles.catChipDiff}>
            {getDifficultyLabel(currentQ.examQuestion.contentType, currentQ.examQuestion.difficulty)}
          </Text>
        </View>

        {isChoiceType && currentQ.choiceQuestion ? (
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
            {/* 숨겨진 렌더러 (오디오만) */}
            <View style={styles.hiddenRenderer}>
              <AbcjsRenderer
                ref={abcjsRef}
                abcString={currentQ.choiceQuestion.abcNotation}
                hideNotes
                tempo={80}
                isPlaying={isPlaying}
                onPlayStateChange={setIsPlaying}
              />
            </View>

            {/* 보기 */}
            <View style={styles.choicesContainer}>
              {currentQ.choiceQuestion.choices.map((choice, idx) => {
                const isSelected = answers[currentIndex] === choice;
                return (
                  <TouchableOpacity
                    key={`${currentQ.examQuestion.id}_${idx}`}
                    style={[
                      styles.choiceItem,
                      isSelected && { borderColor: colors.main, backgroundColor: colors.bg },
                    ]}
                    onPress={() => handleSelectAnswer(choice)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.choiceIndex,
                      isSelected ? { backgroundColor: colors.main } : { backgroundColor: COLORS.slate200 },
                    ]}>
                      <Text style={[
                        styles.choiceIndexText,
                        isSelected && { color: '#fff' },
                      ]}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.choiceText,
                      isSelected && { color: colors.text, fontWeight: '700' },
                    ]}>
                      {choice}
                    </Text>
                    {isSelected && <Check size={18} color={colors.main} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* 기보형 문항 — 자기 평가 */}
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
                {isPlaying ? '재생 중...' : '멜로디를 듣고 악보에 기보하세요'}
              </Text>
            </View>

            <Text style={styles.ratingTitle}>자기 평가 (1~5점)</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(r => {
                const isActive = selfRatings[currentIndex] === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.ratingBtn,
                      isActive && { backgroundColor: colors.main, borderColor: colors.main },
                    ]}
                    onPress={() => handleSelfRate(r)}
                  >
                    <Text style={[
                      styles.ratingText,
                      isActive && { color: '#fff' },
                    ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 문항 네비게이션 (번호 도트) */}
        <View style={styles.dotsContainer}>
          {questions.map((_, idx) => {
            const answered = !!answers[idx] || !!selfRatings[idx];
            const isCurrent = idx === currentIndex;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dot,
                  answered && styles.dotAnswered,
                  isCurrent && styles.dotCurrent,
                ]}
                onPress={() => { stopAudio(); setCurrentIndex(idx); }}
              >
                <Text style={[
                  styles.dotText,
                  answered && { color: '#fff' },
                  isCurrent && { color: '#fff' },
                ]}>
                  {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 하단 네비게이션 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && { opacity: 0.4 }]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={20} color={COLORS.slate600} />
          <Text style={styles.navBtnText}>이전</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: COLORS.amber500 }]}
          onPress={confirmSubmit}
        >
          <Text style={styles.submitBtnText}>
            제출 ({answeredCount}/{totalQuestions})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, currentIndex === totalQuestions - 1 && { opacity: 0.4 }]}
          onPress={handleNext}
          disabled={currentIndex === totalQuestions - 1}
        >
          <Text style={styles.navBtnText}>다음</Text>
          <ChevronRight size={20} color={COLORS.slate600} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function isChoiceQuestion(q: QuestionItem): boolean {
  return !!q.choiceQuestion;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fffbeb',
  },
  topLeft: {},
  topTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.amber700,
  },
  topProgress: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topTimer: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate600,
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.slate100,
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  catChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 8,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  catChipDiff: {
    fontSize: 11,
    color: COLORS.slate500,
  },
  playCard: {
    alignItems: 'center',
    paddingVertical: 28,
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
  hiddenRenderer: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  choicesContainer: {
    gap: 8,
  },
  choiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    backgroundColor: '#fff',
    gap: 12,
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
    color: COLORS.slate500,
  },
  choiceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  // 자기평가
  ratingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate700,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  ratingBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    backgroundColor: '#fff',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate600,
  },
  // 문항 도트
  dotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.slate100,
  },
  dotAnswered: {
    backgroundColor: COLORS.amber400,
  },
  dotCurrent: {
    backgroundColor: COLORS.amber600,
  },
  dotText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate500,
  },
  // 하단
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slate600,
  },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
