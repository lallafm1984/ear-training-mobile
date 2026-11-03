// ─────────────────────────────────────────────────────────────
// LevelTestScreen — 3분 레벨 테스트 (안내 → 계단식 12문항 → 영역별 시작 추천)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronRight,
  Gauge,
  Clock,
  Ear,
  RotateCcw,
  Play,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import MascotCharacter from '../components/MascotCharacter';
import { useMascotExp } from '../hooks/useMascotExp';
import { useLevelTestResult } from '../hooks/useLevelTestResult';
import {
  LEVEL_TEST_MINUTES,
  LEVEL_TEST_TOTAL_QUESTIONS,
  answerLevelTest,
  buildLevelTestQuestion,
  buildLevelTestResult,
  createLevelTestSession,
  currentLevelTestStep,
  isLevelTestDone,
  type LevelTestQuestion,
  type LevelTestResult,
  type LevelTestSession,
} from '../lib/levelTest';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;
type Phase = 'intro' | 'question' | 'result';

/** 테스트 시작 전 WebView를 미리 띄워 두기 위한 무음 악보 */
const SILENT_ABC = 'X:1\nM:4/4\nL:1/4\nK:C\nz4 |]';
/** 답을 고른 뒤 다음 문제로 넘어가기까지의 짧은 피드백 시간 */
const ADVANCE_DELAY_MS = 900;

export default function LevelTestScreen() {
  const { t, i18n } = useTranslation(['levelTest', 'content', 'beginner', 'common']);
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { result: savedResult, save } = useLevelTestResult();
  const { level: mascotLevel } = useMascotExp();

  const [phase, setPhase] = useState<Phase>('intro');
  const [session, setSession] = useState<LevelTestSession>(createLevelTestSession);
  const [question, setQuestion] = useState<LevelTestQuestion | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<LevelTestResult | null>(null);

  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackAbc, setPlaybackAbc] = useState(SILENT_ABC);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = currentLevelTestStep(session);
  const answered = selectedId !== null;

  // 세션이 바뀌면 그 단계의 문항을 만든다
  useEffect(() => {
    if (phase !== 'question') return;
    const next = currentLevelTestStep(session);
    if (!next) return;
    setQuestion(buildLevelTestQuestion(next));
    setSelectedId(null);
  }, [phase, session]);

  // 문항 진입 시 자동 1회 재생
  useEffect(() => {
    if (phase !== 'question' || !question) return;
    setPlaybackAbc(question.abc);
    const timer = setTimeout(() => abcjsRef.current?.togglePlay(), 600);
    return () => clearTimeout(timer);
  }, [phase, question]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => abcjsRef.current?.stopPlay();
    }, []),
  );

  const startTest = useCallback(() => {
    setResult(null);
    setSession(createLevelTestSession());
    setPhase('question');
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      abcjsRef.current?.stopPlay();
      return;
    }
    abcjsRef.current?.togglePlay();
  }, [isPlaying]);

  const finish = useCallback(
    async (finalSession: LevelTestSession) => {
      abcjsRef.current?.stopPlay();
      const built = buildLevelTestResult(finalSession.answers);
      await save(built);
      setResult(built);
      setPhase('result');
    },
    [save],
  );

  const handleSelect = (choiceId: string) => {
    if (answered || !question) return;
    setSelectedId(choiceId);
    const correct = choiceId === question.correctId;
    const nextSession = answerLevelTest(session, correct);
    advanceTimer.current = setTimeout(() => {
      abcjsRef.current?.stopPlay();
      if (isLevelTestDone(nextSession)) {
        void finish(nextSession);
        return;
      }
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setSession(nextSession);
    }, ADVANCE_DELAY_MS);
  };

  const handleBack = () => {
    if (phase === 'question') {
      Alert.alert(t('levelTest:question.quitTitle'), t('levelTest:question.quitMessage'), [
        { text: t('levelTest:question.quitCancel'), style: 'cancel' },
        {
          text: t('levelTest:question.quitConfirm'),
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

  const choiceStyle = (choiceId: string) => {
    if (!answered || !question) return styles.choiceIdle;
    if (choiceId === question.correctId) return styles.choiceCorrect;
    if (choiceId === selectedId) return styles.choiceWrong;
    return styles.choiceDim;
  };

  const choiceLabel = (c: LevelTestQuestion['choices'][number]) =>
    c.label ?? (c.labelKey ? t(`beginner:${c.labelKey}`) : c.id);

  // ─── 안내 ───
  const renderIntro = () => (
    <View style={styles.introArea}>
      <View style={styles.introIcon}>
        <Gauge size={36} color={COLORS.primary600} />
      </View>
      <Text style={styles.introTitle}>{t('levelTest:intro.title')}</Text>
      <View style={styles.minutesChip}>
        <Clock size={13} color={COLORS.primary600} />
        <Text style={styles.minutesText}>
          {t('levelTest:intro.minutes', { minutes: LEVEL_TEST_MINUTES })}
        </Text>
      </View>
      <Text style={styles.introSubtitle}>
        {t('levelTest:intro.subtitle', { count: LEVEL_TEST_TOTAL_QUESTIONS })}
      </Text>
      <View style={styles.introCard}>
        {(['bullet1', 'bullet2', 'bullet3'] as const).map((k) => (
          <View key={k} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{t(`levelTest:intro.${k}`)}</Text>
          </View>
        ))}
      </View>
      {savedResult && (
        <Text style={styles.takenAt}>
          {t('levelTest:result.takenAt', {
            date: new Date(savedResult.takenAt).toLocaleDateString(i18n.language),
          })}
          {' · '}
          {t(`levelTest:result.overall.${savedResult.overall}`)}
        </Text>
      )}
    </View>
  );

  // ─── 문항 ───
  const renderQuestion = () => {
    if (!question || !step) return null;
    const colors = CATEGORY_COLORS[question.category];
    return (
      <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
        <View style={[styles.areaChip, { backgroundColor: colors.bg }]}>
          <Text style={[styles.areaChipText, { color: colors.text }]}>
            {t('levelTest:question.area', {
              name: t(`content:category.${question.category}.name`),
              level: step.difficultyIndex + 1,
            })}
          </Text>
        </View>
        <Text style={styles.prompt}>
          {question.prompt ?? (question.promptKey ? t(`beginner:${question.promptKey}`) : '')}
        </Text>

        <View style={[styles.playCard, { backgroundColor: colors.bg }]}>
          <TouchableOpacity
            style={[styles.playBtn, { backgroundColor: isPlaying ? COLORS.slate400 : colors.main }]}
            onPress={handlePlay}
            activeOpacity={0.7}
          >
            {isPlaying ? <VolumeX size={30} color="#fff" /> : <Volume2 size={30} color="#fff" />}
          </TouchableOpacity>
          <Text style={[styles.playHint, { color: colors.text }]}>
            {isPlaying
              ? t('levelTest:question.playing')
              : answered
                ? t('levelTest:question.replay')
                : t('levelTest:question.listen')}
          </Text>
          {!answered && <Text style={styles.chooseHint}>{t('levelTest:question.hint')}</Text>}
        </View>

        <View style={styles.choices}>
          {question.choices.map((choice, idx) => {
            const showCheck = answered && choice.id === question.correctId;
            const showX = answered && choice.id === selectedId && choice.id !== question.correctId;
            const label = choiceLabel(choice);
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
                  {!choice.glyph || label !== choice.glyph ? (
                    <Text style={[styles.choiceText, choice.glyph && styles.choiceSubText]}>
                      {label}
                    </Text>
                  ) : null}
                </View>
                {showCheck && <Check size={20} color={COLORS.success} />}
                {showX && <X size={20} color={COLORS.error} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  // ─── 결과 ───
  const renderResult = () => {
    if (!result) return null;
    const correct = result.areas.reduce((s, a) => s + a.correct, 0);
    const total = result.areas.reduce((s, a) => s + a.total, 0);
    return (
      <View style={styles.resultArea}>
        <MascotCharacter size={110} level={mascotLevel} happy={result.score >= 60} />
        <Text style={styles.resultTitle}>{t('levelTest:result.title')}</Text>
        <View style={styles.overallChip}>
          <Text style={styles.overallText}>{t(`levelTest:result.overall.${result.overall}`)}</Text>
        </View>
        <Text style={styles.resultScore}>{t('levelTest:result.score', { correct, total })}</Text>
        <Text style={styles.resultDesc}>{t(`levelTest:result.overallDesc.${result.overall}`)}</Text>

        {result.recommendCourse && (
          <TouchableOpacity
            style={styles.courseCard}
            onPress={() => navigation.replace('BeginnerCourse')}
            activeOpacity={0.8}
          >
            <View style={styles.courseIcon}>
              <Ear size={20} color={COLORS.primary600} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseTitle}>{t('levelTest:result.courseTitle')}</Text>
              <Text style={styles.courseDesc}>{t('levelTest:result.courseDesc')}</Text>
            </View>
            <ChevronRight size={18} color={COLORS.primary500} />
          </TouchableOpacity>
        )}

        <Text style={styles.areaTitle}>{t('levelTest:result.areaTitle')}</Text>
        <View style={styles.areaList}>
          {result.areas.map((area) => {
            const colors = CATEGORY_COLORS[area.category];
            const filled = area.levelIndex + 1;
            return (
              <View key={area.area} style={styles.areaRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.areaHeader}>
                    <Text style={[styles.areaName, { color: colors.text }]}>
                      {t(`content:category.${area.category}.name`)}
                    </Text>
                    <Text style={styles.areaScore}>
                      {area.correct}/{area.total}
                    </Text>
                  </View>
                  <View style={styles.levelBar}>
                    {Array.from({ length: area.levelCount }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.levelSeg,
                          { backgroundColor: i < filled ? colors.main : COLORS.slate200 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.areaStart}>
                    {t('levelTest:result.start', {
                      label: t(`content:difficulty.${area.category}.${area.recommendedDifficulty}`),
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.practiceBtn, { backgroundColor: colors.main }]}
                  onPress={() =>
                    navigation.navigate('CategoryPractice', {
                      category: area.category,
                      initialDifficulty: area.recommendedDifficulty,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Play size={12} color="#fff" fill="#fff" />
                  <Text style={styles.practiceBtnText}>{t('levelTest:result.practice')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={styles.resultRow}>
          <TouchableOpacity style={styles.ghostBtn} onPress={startTest}>
            <RotateCcw size={14} color={COLORS.slate600} />
            <Text style={styles.ghostBtnText}>{t('levelTest:result.retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.ghostBtnText}>{t('levelTest:result.home')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const progress = phase === 'question' ? session.answers.length + (answered ? 1 : 0) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.primary600} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('levelTest:intro.title')}</Text>
          {phase === 'question' && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(progress / LEVEL_TEST_TOTAL_QUESTIONS) * 100}%` },
                ]}
              />
            </View>
          )}
        </View>
        {phase === 'question' && (
          <View style={styles.counterChip}>
            <Text style={styles.counterText}>
              {t('levelTest:question.progress', {
                current: Math.min(session.answers.length + 1, LEVEL_TEST_TOTAL_QUESTIONS),
                total: LEVEL_TEST_TOTAL_QUESTIONS,
              })}
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
          tempo={80}
          isPlaying={isPlaying}
          onPlayStateChange={setIsPlaying}
        />
      </View>

      {phase === 'intro' && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={startTest}>
            <Text style={styles.primaryBtnText}>{t('levelTest:intro.start')}</Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
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
    backgroundColor: COLORS.primary50,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.primary700 },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary500 },
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
    backgroundColor: COLORS.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introTitle: { fontSize: 22, fontWeight: '900', color: COLORS.slate800 },
  minutesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  minutesText: { fontSize: 12, fontWeight: '800', color: COLORS.primary600 },
  introSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.slate600,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  introCard: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    padding: 16,
    gap: 10,
    marginTop: 6,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary400,
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21, color: COLORS.slate700 },
  takenAt: { fontSize: 12, color: COLORS.slate400, fontWeight: '600', marginTop: 4 },

  areaChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  areaChipText: { fontSize: 12, fontWeight: '800' },
  prompt: { fontSize: 16, fontWeight: '700', color: COLORS.slate800, lineHeight: 24 },
  playCard: { alignItems: 'center', gap: 10, borderRadius: 20, paddingVertical: 22 },
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
    backgroundColor: COLORS.primary500,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  resultArea: { alignItems: 'center', gap: 8, paddingTop: 6 },
  resultTitle: { fontSize: 20, fontWeight: '900', color: COLORS.slate800, marginTop: 6 },
  overallChip: {
    backgroundColor: COLORS.primary500,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  overallText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  resultScore: { fontSize: 15, fontWeight: '800', color: COLORS.slate600 },
  resultDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.slate600,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  courseCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.primary50,
    borderWidth: 1.5,
    borderColor: COLORS.primary200,
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary700 },
  courseDesc: { fontSize: 11, lineHeight: 16, color: COLORS.slate600, marginTop: 3 },
  areaTitle: {
    alignSelf: 'flex-start',
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate800,
    marginTop: 14,
  },
  areaList: { alignSelf: 'stretch', gap: 10 },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    padding: 14,
  },
  areaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  areaName: { fontSize: 14, fontWeight: '800' },
  areaScore: { fontSize: 12, fontWeight: '700', color: COLORS.slate400 },
  levelBar: { flexDirection: 'row', gap: 4 },
  levelSeg: { flex: 1, height: 8, borderRadius: 4 },
  areaStart: { fontSize: 12, fontWeight: '600', color: COLORS.slate500 },
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  practiceBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  resultRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 12 },
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
