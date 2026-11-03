// ─────────────────────────────────────────────────────────────
// BeginnerLessonScreen — 귀 열기 코스 레슨 (듣기 포인트 → 미니 문제 → 결과)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Check,
  X,
  Lightbulb,
  ChevronRight,
  Trophy,
  Sparkles,
  RotateCcw,
  Headphones,
  Share2,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme/colors';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import MascotCharacter from '../components/MascotCharacter';
import {
  BEGINNER_COURSE_COMPLETE_EXP,
  BEGINNER_LESSON_EXP,
  BEGINNER_LESSONS,
  generateBeginnerLessonQuestions,
  getBeginnerLesson,
  type BeginnerQuestion,
} from '../lib/beginnerCourse';
import { useBeginnerCourseProgress } from '../hooks/useBeginnerCourseProgress';
import { useMascotExp } from '../hooks/useMascotExp';
import BeginnerLessonIcon from '../components/BeginnerLessonIcon';
import ShareCardModal from '../components/ShareCardModal';
import type { ShareCardData } from '../lib/shareCard';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'BeginnerLesson'>;

type Phase = 'intro' | 'question' | 'result';

/** 레슨 시작 전 WebView를 미리 띄워 두기 위한 무음 악보 */
const SILENT_ABC = 'X:1\nM:4/4\nL:1/4\nK:C\nz4 |]';
type CompareTarget = 'correct' | 'mine';

interface LessonOutcome {
  correct: number;
  total: number;
  firstReward: boolean;
  firstCourseReward: boolean;
}

export default function BeginnerLessonScreen() {
  const { t, i18n } = useTranslation(['beginner', 'content', 'common', 'share']);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const lesson = getBeginnerLesson(route.params.lessonId);
  const { completeLesson, isComplete: courseComplete } = useBeginnerCourseProgress();
  const { addExp, level: mascotLevel } = useMascotExp();

  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<BeginnerQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [shareData, setShareData] = useState<ShareCardData | null>(null);

  // 오디오: 숨겨진 렌더러 하나로 문제 소리·정답·내 답을 번갈아 재생
  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackAbc, setPlaybackAbc] = useState(SILENT_ABC);
  const [compareTarget, setCompareTarget] = useState<CompareTarget | null>(null);
  const pendingPlayRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const question = questions[index];
  const answered = selectedId !== null;
  const isCorrect = answered && selectedId === question?.correctId;

  const startLesson = useCallback(() => {
    if (!lesson) return;
    const qs = generateBeginnerLessonQuestions(lesson.questionKinds, lesson.questionCount);
    setQuestions(qs);
    setIndex(0);
    setSelectedId(null);
    setCorrectCount(0);
    setOutcome(null);
    setCompareTarget(null);
    setPlaybackAbc(qs[0]?.abc ?? '');
    setPhase('question');
  }, [lesson]);

  // 문제 진입 시 자동 1회 재생
  useEffect(() => {
    if (phase !== 'question' || !question) return;
    setPlaybackAbc(question.abc);
    setCompareTarget(null);
    const timer = setTimeout(() => abcjsRef.current?.togglePlay(), 600);
    return () => clearTimeout(timer);
  }, [phase, question]);

  useEffect(() => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    const timer = setTimeout(() => abcjsRef.current?.togglePlay(), 450);
    return () => clearTimeout(timer);
  }, [playbackAbc]);

  useFocusEffect(
    useCallback(() => {
      return () => abcjsRef.current?.stopPlay();
    }, []),
  );

  const playAbc = useCallback(
    (abc: string) => {
      abcjsRef.current?.stopPlay();
      if (abc === playbackAbc) {
        setTimeout(() => abcjsRef.current?.togglePlay(), 120);
        return;
      }
      pendingPlayRef.current = true;
      setPlaybackAbc(abc);
    },
    [playbackAbc],
  );

  const handlePlayQuestion = useCallback(() => {
    if (!question) return;
    if (isPlaying && compareTarget === null) {
      abcjsRef.current?.stopPlay();
      return;
    }
    setCompareTarget(null);
    playAbc(question.abc);
  }, [question, isPlaying, compareTarget, playAbc]);

  const playCompare = useCallback(
    (target: CompareTarget) => {
      if (!question) return;
      const mine = question.choices.find((c) => c.id === selectedId);
      const abc = target === 'mine' && mine ? mine.abc : question.abc;
      setCompareTarget(target);
      playAbc(abc);
    },
    [question, selectedId, playAbc],
  );

  const handleSelect = (choiceId: string) => {
    if (answered || !question) return;
    setSelectedId(choiceId);
    if (choiceId === question.correctId) setCorrectCount((c) => c + 1);
  };

  const finishLesson = useCallback(async () => {
    if (!lesson) return;
    abcjsRef.current?.stopPlay();
    const total = questions.length;
    const result = await completeLesson(lesson.id, {
      completedAt: new Date().toISOString(),
      correct: correctCount,
      total,
    });
    let exp = 0;
    if (result.firstReward) exp += BEGINNER_LESSON_EXP;
    if (result.firstCourseReward) exp += BEGINNER_COURSE_COMPLETE_EXP;
    if (exp > 0) await addExp(exp);
    setOutcome({
      correct: correctCount,
      total,
      firstReward: result.firstReward,
      firstCourseReward: result.firstCourseReward,
    });
    setPhase('result');
  }, [lesson, questions.length, correctCount, completeLesson, addExp]);

  const handleNext = () => {
    if (index + 1 >= questions.length) {
      void finishLesson();
      return;
    }
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    abcjsRef.current?.stopPlay();
    setSelectedId(null);
    setIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (phase === 'question') {
      Alert.alert(t('beginner:lesson.quitTitle'), t('beginner:lesson.quitMessage'), [
        { text: t('beginner:lesson.quitCancel'), style: 'cancel' },
        {
          text: t('beginner:lesson.quitConfirm'),
          style: 'destructive',
          onPress: () => {
            abcjsRef.current?.stopPlay();
            navigation.goBack();
          },
        },
      ]);
      return;
    }
    navigation.goBack();
  };

  const nextLesson = useMemo(() => {
    if (!lesson) return undefined;
    return BEGINNER_LESSONS.find((l) => l.day === lesson.day + 1);
  }, [lesson]);

  if (!lesson) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.slate700} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const choiceStyle = (choiceId: string) => {
    if (!answered) return styles.choiceIdle;
    if (choiceId === question.correctId) return styles.choiceCorrect;
    if (choiceId === selectedId) return styles.choiceWrong;
    return styles.choiceDim;
  };

  // ─── 결과 ───
  const renderResult = () => {
    if (!outcome) return null;
    const ratio = outcome.total ? outcome.correct / outcome.total : 0;
    const message =
      ratio === 1
        ? t('beginner:lesson.result.perfect')
        : ratio >= 0.6
          ? t('beginner:lesson.result.good')
          : t('beginner:lesson.result.keepGoing');
    const linkName = t(`content:category.${lesson.link.category}.name`);
    return (
      <View style={styles.resultArea}>
        <MascotCharacter size={120} level={mascotLevel} happy={ratio >= 0.6} />
        <Text style={[styles.resultTitle, { color: lesson.color }]}>
          {t('beginner:lesson.result.title', { day: lesson.day })}
        </Text>
        <Text style={styles.resultScore}>
          {t('beginner:lesson.result.score', { correct: outcome.correct, total: outcome.total })}
        </Text>
        <Text style={styles.resultMessage}>{message}</Text>
        {nextLesson && (
          <Text style={styles.nextPreview}>
            {t('beginner:lesson.result.nextPreview', {
              title: t(`beginner:lessons.${nextLesson.id}.title`),
            })}
          </Text>
        )}

        <View style={styles.rewardBox}>
          <Trophy size={18} color={COLORS.amber600} />
          <Text style={styles.rewardText}>
            {outcome.firstReward
              ? t('beginner:lesson.result.expEarned', { exp: BEGINNER_LESSON_EXP })
              : t('beginner:lesson.result.expAlready')}
          </Text>
        </View>
        {outcome.firstCourseReward && (
          <View style={[styles.rewardBox, { backgroundColor: COLORS.primary50 }]}>
            <Sparkles size={18} color={COLORS.primary600} />
            <Text style={[styles.rewardText, { color: COLORS.primary700 }]}>
              {t('beginner:lesson.result.courseBonus', { exp: BEGINNER_COURSE_COMPLETE_EXP })}
            </Text>
          </View>
        )}
        {courseComplete && (
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() =>
              setShareData({
                kind: 'course',
                title: t('share:kind.course'),
                headline: t('share:course.headline'),
                headlineLabel: t('share:course.label'),
                stats: [
                  {
                    label: t('share:stat.lessons'),
                    value: `${BEGINNER_LESSONS.length}/${BEGINNER_LESSONS.length}`,
                  },
                  { label: t('share:stat.level'), value: `Lv.${mascotLevel}` },
                ],
                accent: lesson.color,
                date: new Date().toLocaleDateString(i18n.language),
                mascotLevel,
                happy: true,
              })
            }
            activeOpacity={0.8}
          >
            <Share2 size={16} color={COLORS.primary700} />
            <Text style={styles.shareBtnText}>{t('share:buttonLong')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.resultActions}>
          {nextLesson ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: nextLesson.color }]}
              onPress={() => navigation.replace('BeginnerLesson', { lessonId: nextLesson.id })}
            >
              <Text style={styles.primaryBtnText}>{t('beginner:lesson.result.nextDay')}</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: lesson.color }]}
            onPress={() =>
              navigation.navigate('ChoicePractice', {
                category: lesson.link.category,
                difficulty: lesson.link.difficulty,
              })
            }
          >
            <Headphones size={16} color={lesson.color} />
            <Text style={[styles.secondaryBtnText, { color: lesson.color }]}>
              {t('beginner:lesson.result.goPractice', { name: linkName })}
            </Text>
          </TouchableOpacity>
          <View style={styles.resultRow}>
            <TouchableOpacity style={styles.ghostBtn} onPress={startLesson}>
              <RotateCcw size={14} color={COLORS.slate600} />
              <Text style={styles.ghostBtnText}>{t('beginner:lesson.result.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.ghostBtnText}>{t('beginner:lesson.result.backToCourse')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── 듣기 포인트 ───
  const renderIntro = () => (
    <View style={styles.introArea}>
      <View style={[styles.introIcon, { backgroundColor: lesson.bgColor }]}>
        <BeginnerLessonIcon lesson={lesson} size={36} />
      </View>
      <Text style={styles.introDay}>{t('beginner:course.dayLabel', { day: lesson.day })}</Text>
      <Text style={styles.introTitle}>{t(`beginner:lessons.${lesson.id}.title`)}</Text>
      <View style={[styles.introCard, { borderColor: lesson.color + '40' }]}>
        <View style={styles.introCardHeader}>
          <Headphones size={16} color={lesson.color} />
          <Text style={[styles.introCardTitle, { color: lesson.color }]}>
            {t('beginner:lesson.introTitle')}
          </Text>
        </View>
        <Text style={styles.introText}>{t(`beginner:lessons.${lesson.id}.intro`)}</Text>
        <View style={[styles.tipBox, { backgroundColor: lesson.bgColor }]}>
          <Lightbulb size={14} color={lesson.color} />
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '800', color: lesson.color }}>
              {t('beginner:lesson.introTip')}
            </Text>{' '}
            {t(`beginner:lessons.${lesson.id}.tip`)}
          </Text>
        </View>
      </View>
    </View>
  );

  // ─── 문제 ───
  const renderQuestion = () => {
    if (!question) return null;
    const mine = question.choices.find((c) => c.id === selectedId);
    const correct = question.choices.find((c) => c.id === question.correctId);
    return (
      <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
        <Text style={styles.prompt}>{t(`beginner:${question.promptKey}`)}</Text>

        <View style={[styles.playCard, { backgroundColor: lesson.bgColor }]}>
          <TouchableOpacity
            style={[
              styles.playBtn,
              { backgroundColor: isPlaying && !compareTarget ? COLORS.slate400 : lesson.color },
            ]}
            onPress={handlePlayQuestion}
            activeOpacity={0.7}
          >
            {isPlaying && !compareTarget ? (
              <VolumeX size={30} color="#fff" />
            ) : (
              <Volume2 size={30} color="#fff" />
            )}
          </TouchableOpacity>
          <Text style={[styles.playHint, { color: lesson.color }]}>
            {isPlaying && !compareTarget
              ? t('beginner:lesson.playing')
              : answered
                ? t('beginner:lesson.replay')
                : t('beginner:lesson.listen')}
          </Text>
          {!answered && <Text style={styles.chooseHint}>{t('beginner:lesson.chooseHint')}</Text>}
        </View>

        <View style={styles.choices}>
          {question.choices.map((choice, idx) => {
            const showCheck = answered && choice.id === question.correctId;
            const showX = answered && !isCorrect && choice.id === selectedId;
            return (
              <TouchableOpacity
                key={`${question.id}_${choice.id}`}
                style={[styles.choice, choiceStyle(choice.id)]}
                onPress={() => handleSelect(choice.id)}
                disabled={answered}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.choiceIndex,
                    showCheck && { backgroundColor: COLORS.success },
                    showX && { backgroundColor: COLORS.error },
                  ]}
                >
                  <Text style={[styles.choiceIndexText, (showCheck || showX) && { color: '#fff' }]}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  {choice.glyph ? <Text style={styles.choiceGlyph}>{choice.glyph}</Text> : null}
                  {!choice.glyph || t(`beginner:${choice.labelKey}`) !== choice.glyph ? (
                    <Text style={[styles.choiceText, choice.glyph && styles.choiceSubText]}>
                      {t(`beginner:${choice.labelKey}`)}
                    </Text>
                  ) : null}
                </View>
                {showCheck && <Check size={20} color={COLORS.success} />}
                {showX && <X size={20} color={COLORS.error} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {answered && (
          <View style={[styles.explainCard, { borderColor: isCorrect ? '#a7f3d0' : '#fecaca' }]}>
            <Text style={[styles.feedback, { color: isCorrect ? '#047857' : '#b91c1c' }]}>
              {isCorrect ? t('beginner:lesson.correct') : t('beginner:lesson.wrong')}
            </Text>
            {!isCorrect && correct && (
              <Text style={styles.explainAnswer}>{t(`beginner:${correct.labelKey}`)}</Text>
            )}
            <View style={styles.explainHeader}>
              <Lightbulb size={14} color={lesson.color} />
              <Text style={[styles.explainTitle, { color: lesson.color }]}>
                {t('beginner:lesson.explainTitle')}
              </Text>
            </View>
            <Text style={styles.explainText}>{t(`beginner:${question.explanationKey}`)}</Text>

            <View style={styles.compareRow}>
              <TouchableOpacity
                style={[
                  styles.compareBtn,
                  compareTarget === 'correct' && isPlaying
                    ? { backgroundColor: COLORS.success, borderColor: COLORS.success }
                    : { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
                ]}
                onPress={() => playCompare('correct')}
              >
                <Volume2
                  size={14}
                  color={compareTarget === 'correct' && isPlaying ? '#fff' : '#047857'}
                />
                <Text
                  style={[
                    styles.compareText,
                    { color: compareTarget === 'correct' && isPlaying ? '#fff' : '#047857' },
                  ]}
                >
                  {t('beginner:lesson.listenCorrect')}
                </Text>
              </TouchableOpacity>
              {!isCorrect && mine && (
                <TouchableOpacity
                  style={[
                    styles.compareBtn,
                    compareTarget === 'mine' && isPlaying
                      ? { backgroundColor: COLORS.error, borderColor: COLORS.error }
                      : { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
                  ]}
                  onPress={() => playCompare('mine')}
                >
                  <Volume2
                    size={14}
                    color={compareTarget === 'mine' && isPlaying ? '#fff' : '#b91c1c'}
                  />
                  <Text
                    style={[
                      styles.compareText,
                      { color: compareTarget === 'mine' && isPlaying ? '#fff' : '#b91c1c' },
                    ]}
                  >
                    {t('beginner:lesson.listenMine')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: lesson.bgColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={lesson.color} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: lesson.color }]}>
            {t('beginner:course.dayLabel', { day: lesson.day })} ·{' '}
            {t(`beginner:lessons.${lesson.id}.title`)}
          </Text>
          {phase === 'question' && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: lesson.color,
                    width: `${((index + (answered ? 1 : 0)) / Math.max(1, questions.length)) * 100}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>
        {phase === 'question' && (
          <View style={styles.counterChip}>
            <Text style={styles.counterText}>
              {t('beginner:lesson.question', { current: index + 1, total: questions.length })}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'intro' && renderIntro()}
        {phase === 'question' && renderQuestion()}
        {phase === 'result' && renderResult()}
      </ScrollView>

      {/* 숨겨진 렌더러 (오디오 전용) */}
      <View style={styles.hiddenRenderer}>
        <AbcjsRenderer
          ref={abcjsRef}
          abcString={playbackAbc}
          hideNotes
          tempo={84}
          isPlaying={isPlaying}
          onPlayStateChange={setIsPlaying}
        />
      </View>

      {phase !== 'result' && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {phase === 'intro' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: lesson.color }]}
              onPress={startLesson}
            >
              <Text style={styles.primaryBtnText}>{t('beginner:lesson.begin')}</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          ) : answered ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: lesson.color }]}
              onPress={handleNext}
            >
              <Text style={styles.primaryBtnText}>
                {index + 1 >= questions.length
                  ? t('beginner:lesson.seeResult')
                  : t('beginner:lesson.next')}
              </Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      <ShareCardModal data={shareData} onClose={() => setShareData(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  counterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  counterText: { fontSize: 12, fontWeight: '800', color: COLORS.slate600 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },

  introArea: { alignItems: 'center', gap: 10 },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introDay: { fontSize: 12, fontWeight: '800', color: COLORS.slate400 },
  introTitle: { fontSize: 22, fontWeight: '900', color: COLORS.slate800, marginBottom: 8 },
  introCard: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 12,
  },
  introCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  introCardTitle: { fontSize: 13, fontWeight: '800' },
  introText: { fontSize: 15, lineHeight: 24, color: COLORS.slate700 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20, color: COLORS.slate600 },

  prompt: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slate800,
    lineHeight: 24,
    textAlign: 'center',
  },
  playCard: {
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    paddingVertical: 22,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHint: { fontSize: 13, fontWeight: '700' },
  chooseHint: { fontSize: 11, color: COLORS.slate500 },
  choices: { gap: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  choiceIdle: { backgroundColor: '#fff', borderColor: COLORS.slate200 },
  choiceCorrect: { backgroundColor: '#ecfdf5', borderColor: COLORS.success },
  choiceWrong: { backgroundColor: '#fef2f2', borderColor: COLORS.error },
  choiceDim: { backgroundColor: COLORS.slate50, borderColor: COLORS.slate200, opacity: 0.6 },
  choiceIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIndexText: { fontSize: 13, fontWeight: '800', color: COLORS.slate500 },
  choiceGlyph: { fontSize: 22, color: COLORS.slate800, letterSpacing: 2 },
  choiceText: { fontSize: 16, fontWeight: '700', color: COLORS.slate800 },
  choiceSubText: { fontSize: 12, fontWeight: '600', color: COLORS.slate500, marginTop: 2 },
  explainCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  feedback: { fontSize: 16, fontWeight: '900' },
  explainAnswer: { fontSize: 14, fontWeight: '800', color: COLORS.slate800 },
  explainHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  explainTitle: { fontSize: 12, fontWeight: '800' },
  explainText: { fontSize: 14, lineHeight: 22, color: COLORS.slate700 },
  compareRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  compareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  compareText: { fontSize: 12, fontWeight: '800' },
  hiddenRenderer: { height: 0, overflow: 'hidden', opacity: 0 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: COLORS.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  resultArea: { alignItems: 'center', gap: 8, paddingTop: 10 },
  resultTitle: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  resultScore: { fontSize: 18, fontWeight: '800', color: COLORS.slate800 },
  resultMessage: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.slate600,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  nextPreview: { fontSize: 12, fontWeight: '700', color: COLORS.slate400 },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.amber50,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  rewardText: { fontSize: 14, fontWeight: '800', color: COLORS.amber800 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary50,
    borderWidth: 1,
    borderColor: COLORS.primary200,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  shareBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.primary700 },
  resultActions: { alignSelf: 'stretch', gap: 10, marginTop: 16 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  resultRow: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.slate100,
  },
  ghostBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.slate600 },
});
