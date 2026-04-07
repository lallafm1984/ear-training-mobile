// ─────────────────────────────────────────────────────────────
// MockExamScreen — 모의시험 진행 화면
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Volume2, VolumeX, ChevronRight, Check, X,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import { EXAM_PRESETS } from '../lib/examPresets';
import { generateChoiceQuestion, type ChoiceQuestion } from '../lib/questionGenerator';
import { generateAbc } from '../lib';
import { generatePracticeScore, type PracticeScore } from '../lib/practiceScoreGenerator';
import { examNotationStore } from '../lib/examNotationStore';
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
  /** 기보형 문항용 ABC notation (재생용) */
  abcNotation?: string;
  /** 기보형 문항용 PracticeScore (채점용) */
  practiceScore?: PracticeScore;
  sectionIndex: number;
}

export default function MockExamScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { presetId } = route.params;

  const preset = EXAM_PRESETS.find(p => p.id === presetId)!;
  const { addBatchRecords } = usePracticeHistory();
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

        if (isChoice) {
          const cq = generateChoiceQuestion(section.contentType, section.difficulty);
          items.push({
            examQuestion: {
              id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              contentType: section.contentType,
              difficulty: section.difficulty,
              correctAnswer: cq.correctAnswer,
              choices: cq.choices,
            },
            choiceQuestion: cq,
            sectionIndex: sIdx,
          });
        } else {
          // 기보형 문항 (melody, rhythm, twoVoice) — ABC notation 생성
          const score = generatePracticeScore(section.contentType, section.difficulty);
          const abc = generateAbc({
            title: '',
            keySignature: score.keySignature,
            timeSignature: score.timeSignature,
            tempo: 90,
            notes: score.trebleNotes,
            bassNotes: score.useGrandStaff ? score.bassNotes : undefined,
            useGrandStaff: score.useGrandStaff,
            disableTies: score.disableTies,
          });
          items.push({
            examQuestion: {
              id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              contentType: section.contentType,
              difficulty: section.difficulty,
              correctAnswer: '',
            },
            abcNotation: abc,
            practiceScore: score,
            sectionIndex: sIdx,
          });
        }
      }
    });
    return items;
  }, [preset]);

  const totalQuestions = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selfRatings, setSelfRatings] = useState<Record<number, number>>({});

  const submittedRef = useRef(false);

  const currentQ = questions[currentIndex];
  const isChoiceType = !!currentQ.choiceQuestion;
  const isCurrentAnswered = isChoiceType
    ? !!answers[currentIndex]
    : !!selfRatings[currentIndex];
  const catConfig = getContentConfig(currentQ.examQuestion.contentType);
  const colors = CATEGORY_COLORS[currentQ.examQuestion.contentType];

  const handleSelectAnswer = useCallback((choice: string) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: choice }));
  }, [currentIndex]);

  const handleSelfRate = useCallback((rating: number) => {
    setSelfRatings(prev => ({ ...prev, [currentIndex]: rating }));
  }, [currentIndex]);

  // 기보형 문항: NotationPractice 화면으로 이동
  const pendingNotationIndexRef = useRef<number | null>(null);
  const navigatingToNotationRef = useRef(false);

  const handleOpenNotation = useCallback((questionIdx: number) => {
    const q = questions[questionIdx];
    if (!q.practiceScore) return;
    stopAudio();
    examNotationStore.setScore(q.practiceScore, questionIdx);
    pendingNotationIndexRef.current = questionIdx;
    navigatingToNotationRef.current = true;
    navigation.navigate('NotationPractice', {
      category: q.examQuestion.contentType,
      difficulty: q.examQuestion.difficulty,
      examMode: true,
    });
  }, [questions, navigation, stopAudio]);

  // NotationPractice에서 돌아올 때 결과 수신
  useFocusEffect(
    useCallback(() => {
      const idx = pendingNotationIndexRef.current;
      if (idx === null) return;
      const result = examNotationStore.getResult();
      if (result !== null) {
        setSelfRatings(prev => ({ ...prev, [idx]: result }));
        examNotationStore.clear();
      }
      pendingNotationIndexRef.current = null;
    }, []),
  );

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      stopAudio();
      setCurrentIndex(prev => prev + 1);
    }
  };


  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    stopAudio();

    // 결과 계산 + 문항별 연습 기록 수집
    let totalScore = 0;
    const maxScore = totalQuestions * 5;
    const practiceRecords: PracticeRecord[] = [];

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

      practiceRecords.push({
        id: `pr_exam_${Date.now()}_${idx}`,
        contentType: cat,
        difficulty: q.examQuestion.difficulty,
        selfRating: score,
        practicedAt: new Date().toISOString(),
      });
    });

    // 배치로 한 번에 저장 (AsyncStorage 동시 쓰기 방지)
    await addBatchRecords(practiceRecords);

    await updateStreak();

    navigation.replace('ExamResult', {
      presetId: preset.id,
      title: preset.name,
      totalScore,
      maxScore,
      categoryScores: JSON.stringify(categoryScores),
      elapsedSeconds: 0,
      totalQuestions,
    });
  }, [answers, selfRatings, questions, preset, totalQuestions, navigation, stopAudio, addBatchRecords, updateStreak]);

  // 시험 진행 중 실수로 뒤로가기 방지
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (submittedRef.current) return;
      if (navigatingToNotationRef.current) {
        navigatingToNotationRef.current = false;
        return;
      }
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

  const confirmSubmit = () => {
    Alert.alert(
      '시험 제출',
      '시험을 제출하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '제출', onPress: handleSubmit },
      ],
    );
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
          <Text style={styles.topProgress}>
            {answeredCount}/{totalQuestions} 답변
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

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
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
            {/* 기보형 문항 — 기보 입력 화면으로 이동 */}
            {selfRatings[currentIndex] ? (
              // 채점 완료된 문항
              <View style={[styles.playCard, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
                <View style={[styles.playBtn, { backgroundColor: colors.main }]}>
                  <Check size={28} color="#fff" />
                </View>
                <Text style={[styles.playHint, { color: colors.text, fontWeight: '700' }]}>
                  기보 완료
                </Text>
              </View>
            ) : (
              // 아직 미답변 문항
              <View style={[styles.playCard, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: colors.main }]}
                  onPress={() => handleOpenNotation(currentIndex)}
                  activeOpacity={0.7}
                >
                  <Volume2 size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.playHint, { color: colors.text }]}>
                  탭하여 기보 시작
                </Text>
                <TouchableOpacity
                  style={[styles.notationBtn, { backgroundColor: colors.main, borderColor: colors.main }]}
                  onPress={() => handleOpenNotation(currentIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notationBtnText, { color: '#fff' }]}>기보하기</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* 문항 진행 표시 (이동 불가, 표시만) */}
        <View style={styles.dotsContainer}>
          {questions.map((_, idx) => {
            const answered = !!answers[idx] || !!selfRatings[idx];
            const isCurrent = idx === currentIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  answered && styles.dotAnswered,
                  isCurrent && styles.dotCurrent,
                ]}
              >
                <Text style={[
                  styles.dotText,
                  answered && { color: '#fff' },
                  isCurrent && { color: '#fff' },
                ]}>
                  {idx + 1}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 하단 네비게이션 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {currentIndex < totalQuestions - 1 ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: isCurrentAnswered ? colors.main : COLORS.slate300, flex: 1 }]}
            onPress={handleNext}
            disabled={!isCurrentAnswered}
          >
            <Text style={styles.submitBtnText}>
              다음 ({currentIndex + 1}/{totalQuestions})
            </Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: isCurrentAnswered ? COLORS.amber500 : COLORS.slate300, flex: 1 }]}
            onPress={confirmSubmit}
            disabled={!isCurrentAnswered}
          >
            <Text style={styles.submitBtnText}>제출하기</Text>
          </TouchableOpacity>
        )}
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  notationBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 4,
  },
  notationBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
