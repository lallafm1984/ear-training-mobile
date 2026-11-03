// ─────────────────────────────────────────────────────────────
// RhythmTapScreen — 리듬 탭 (듣기 → 메트로놈에 맞춰 탭 → 타이밍 채점)
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Play,
  Square,
  Hand,
  RotateCcw,
  ChevronRight,
  Volume2,
  Share2,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import AbcjsRenderer, {
  type AbcjsRendererHandle,
  type ClickTrackState,
} from '../components/AbcjsRenderer';
import ShareCardModal from '../components/ShareCardModal';
import { useAlert, useSessionContentLog } from '../context';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import { useMascotExp } from '../hooks/useMascotExp';
import {
  RHYTHM_TAP_COUNT_IN_BARS,
  generateRhythmTapQuestion,
  gradeTaps,
  rhythmTapLevelNumber,
  tapScoreToEvaluation,
  tapScoreToRating,
  type RhythmTapQuestion,
  type TapGrade,
  type TapStatus,
} from '../lib/rhythmTap';
import type { ShareCardData } from '../lib/shareCard';
import type { PracticeRecord, RhythmTapDifficulty } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type RouteProp = StackScreenProps<MainStackParamList, 'RhythmTap'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;
type Phase = 'listen' | 'tap' | 'result' | 'summary';

const STATUS_COLORS: Record<TapStatus, string> = {
  perfect: COLORS.success,
  early: COLORS.amber500,
  late: COLORS.amber500,
  miss: COLORS.error,
};

export default function RhythmTapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const difficulty = route.params.difficulty as RhythmTapDifficulty;
  const layout = useResponsiveLayout();
  const { t, i18n } = useTranslation(['rhythmTap', 'content', 'common', 'share']);
  const { showAlert } = useAlert();
  const { trackContentRun } = useSessionContentLog();
  const { addRecord } = usePracticeHistory();
  const { applyEvaluation, updateStreak } = useSkillProfile();
  const { level: mascotLevel } = useMascotExp();
  const colors = CATEGORY_COLORS.rhythmTap;
  const diffLabel = t('content:difficulty.rhythmTap.' + difficulty);

  const [question, setQuestion] = useState<RhythmTapQuestion>(() =>
    generateRhythmTapQuestion(difficulty),
  );
  const [phase, setPhase] = useState<Phase>('listen');
  const [isPlaying, setIsPlaying] = useState(false);
  const [grade, setGrade] = useState<TapGrade | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [shareData, setShareData] = useState<ShareCardData | null>(null);

  // 탭 단계 진행 상태 (카운트인 → 패턴)
  const [tapClock, setTapClock] = useState<{ beat: number; inCountIn: boolean } | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);

  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const tapsRef = useRef<number[]>([]);
  const clockStartRef = useRef<number | null>(null);
  const patternStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const padScale = useRef(new Animated.Value(1)).current;
  const padFlash = useRef(new Animated.Value(0)).current;
  const gradedRef = useRef(false);

  const roundNumber = scores.length + 1;

  useEffect(() => {
    trackContentRun({ contentType: 'rhythmTap', difficulty, source: 'tap_practice' });
  }, [difficulty, question.id, trackContentRun]);

  const stopClock = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopAllAudio = useCallback(() => {
    abcjsRef.current?.stopPlay();
    abcjsRef.current?.stopClickTrack();
  }, []);

  useEffect(() => {
    return () => {
      stopClock();
      stopAllAudio();
    };
  }, [stopAllAudio, stopClock]);

  // 새 리듬이 오면 자동으로 1회 들려준다 (렌더러 초기화 대기)
  useEffect(() => {
    if (phase !== 'listen') return;
    const timer = setTimeout(() => abcjsRef.current?.togglePlay(), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const handlePlay = useCallback(() => {
    if (isPlaying) abcjsRef.current?.stopPlay();
    else abcjsRef.current?.togglePlay();
  }, [isPlaying]);

  // ─── 탭 단계 ───
  const startTapPhase = useCallback(() => {
    abcjsRef.current?.stopPlay();
    tapsRef.current = [];
    gradedRef.current = false;
    clockStartRef.current = null;
    patternStartRef.current = null;
    setTapClock({ beat: 0, inCountIn: true });
    setPhase('tap');
    abcjsRef.current?.playClickTrack({
      tempo: question.tempo,
      top: question.beatsPerBar,
      btm: 4,
      countInBars: RHYTHM_TAP_COUNT_IN_BARS,
      bars: question.measures,
      tailMs: Math.round(question.toleranceMs + 250),
    });
  }, [question]);

  const finishTapPhase = useCallback(() => {
    stopClock();
    if (gradedRef.current) return;
    gradedRef.current = true;
    const patternStart = patternStartRef.current;
    if (patternStart === null) {
      setPhase('listen');
      return;
    }
    const tol = question.toleranceMs;
    const tapsRel = tapsRef.current
      .map((ts) => ts - patternStart)
      .filter((ms) => ms >= -tol && ms <= question.totalMs + tol);
    const result = gradeTaps(question.onsetsMs, tapsRel, tol);
    setGrade(result);
    setScores((prev) => [...prev, result.score]);
    setTapClock(null);
    setPhase('result');
  }, [question, stopClock]);

  const handleClickTrackState = useCallback(
    (state: ClickTrackState) => {
      if (state.error) {
        stopClock();
        setTapClock(null);
        setPhase('listen');
        showAlert({
          title: t('common:button.retry'),
          message: t('rhythmTap:error.audio'),
          type: 'error',
        });
        return;
      }
      if (state.isPlaying) {
        const beatMs = state.beatMs ?? question.beatMs;
        const beatsPerBar = state.beatsPerBar ?? question.beatsPerBar;
        const countInBeats = (state.countInBars ?? RHYTHM_TAP_COUNT_IN_BARS) * beatsPerBar;
        const start = Date.now() + (state.leadMs ?? 0);
        clockStartRef.current = start;
        patternStartRef.current = start + countInBeats * beatMs;
        stopClock();
        tickRef.current = setInterval(() => {
          const elapsed = Date.now() - start;
          const beat = Math.floor(elapsed / beatMs);
          setTapClock({
            beat: beat < countInBeats ? beat : beat - countInBeats,
            inCountIn: beat < countInBeats,
          });
        }, 40);
        return;
      }
      // 클릭 트랙 종료 → 채점
      finishTapPhase();
    },
    [finishTapPhase, question, showAlert, stopClock, t],
  );

  const handleTap = useCallback(() => {
    tapsRef.current.push(Date.now());
    padScale.setValue(0.96);
    padFlash.setValue(1);
    Animated.parallel([
      Animated.spring(padScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.timing(padFlash, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [padFlash, padScale]);

  const cancelTap = useCallback(() => {
    gradedRef.current = true;
    stopClock();
    abcjsRef.current?.stopClickTrack();
    setTapClock(null);
    setPhase('listen');
  }, [stopClock]);

  // ─── 다음/반복/종료 ───
  const retrySame = useCallback(() => {
    stopAllAudio();
    setGrade(null);
    setPhase('listen');
    setTimeout(() => abcjsRef.current?.togglePlay(), 400);
  }, [stopAllAudio]);

  const nextRhythm = useCallback(() => {
    stopAllAudio();
    setGrade(null);
    setPhase('listen');
    setQuestion(generateRhythmTapQuestion(difficulty));
  }, [difficulty, stopAllAudio]);

  const avgScore = useMemo(
    () => (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0),
    [scores],
  );

  const finishPractice = useCallback(async () => {
    stopAllAudio();
    const record: PracticeRecord = {
      id: `pr_${Date.now()}`,
      contentType: 'rhythmTap',
      difficulty,
      selfRating: tapScoreToRating(avgScore),
      practicedAt: new Date().toISOString(),
    };
    await addRecord(record);
    await updateStreak();
    await applyEvaluation(
      'partPractice',
      rhythmTapLevelNumber(difficulty),
      tapScoreToEvaluation(avgScore),
    );
    setPhase('summary');
  }, [addRecord, applyEvaluation, avgScore, difficulty, stopAllAudio, updateStreak]);

  const restartPractice = useCallback(() => {
    setScores([]);
    setGrade(null);
    setPhase('listen');
    setQuestion(generateRhythmTapQuestion(difficulty));
  }, [difficulty]);

  const handleBack = useCallback(() => {
    stopClock();
    stopAllAudio();
    navigation.goBack();
  }, [navigation, stopAllAudio, stopClock]);

  const onTimelineLayout = (e: LayoutChangeEvent) => setTimelineWidth(e.nativeEvent.layout.width);

  // ─── 렌더: 듣기 ───
  const renderListen = () => (
    <View style={styles.stage}>
      <Text style={styles.stageTitle}>{t('rhythmTap:listen.title')}</Text>
      <Text style={styles.stageDesc}>{t('rhythmTap:listen.desc')}</Text>
      <TouchableOpacity
        style={[styles.playCircle, { backgroundColor: isPlaying ? COLORS.slate700 : colors.main }]}
        onPress={handlePlay}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? t('rhythmTap:listen.playing') : t('rhythmTap:listen.play')}
      >
        {isPlaying ? (
          <Square size={34} color="#fff" fill="#fff" />
        ) : (
          <Play size={38} color="#fff" fill="#fff" />
        )}
      </TouchableOpacity>
      <Text style={styles.playLabel}>
        {isPlaying ? t('rhythmTap:listen.playing') : t('rhythmTap:listen.play')}
      </Text>
      <View style={[styles.infoChip, { backgroundColor: colors.bg }]}>
        <Text style={[styles.infoChipText, { color: colors.text }]}>
          {t('rhythmTap:listen.bars', { count: question.measures, tempo: question.tempo })}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.main }]}
        onPress={startTapPhase}
        activeOpacity={0.85}
      >
        <Hand size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>{t('rhythmTap:listen.start')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── 렌더: 탭 ───
  const renderTap = () => {
    const beatsPerBar = question.beatsPerBar;
    const inCountIn = tapClock?.inCountIn ?? true;
    const beat = tapClock?.beat ?? 0;
    const currentBeatInBar = beat % beatsPerBar;
    const flashBg = padFlash.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.bg, colors.main + '66'],
    });
    return (
      <View style={styles.stage}>
        <Text style={[styles.countLabel, { color: inCountIn ? COLORS.slate500 : colors.text }]}>
          {inCountIn ? t('rhythmTap:tap.countIn') : t('rhythmTap:tap.go')}
        </Text>
        <Text style={[styles.countNumber, { color: inCountIn ? COLORS.slate400 : colors.main }]}>
          {tapClock ? currentBeatInBar + 1 : '·'}
        </Text>
        <View style={styles.beatDots}>
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <View
              key={i}
              style={[
                styles.beatDot,
                tapClock && i === currentBeatInBar
                  ? {
                      backgroundColor: inCountIn ? COLORS.slate400 : colors.main,
                      transform: [{ scale: 1.25 }],
                    }
                  : { backgroundColor: COLORS.slate200 },
              ]}
            />
          ))}
        </View>

        <Animated.View style={{ transform: [{ scale: padScale }], alignSelf: 'stretch' }}>
          <Animated.View
            style={[styles.pad, { borderColor: colors.main, backgroundColor: flashBg }]}
          >
            <Pressable onPressIn={handleTap} style={styles.padPress}>
              <Hand size={44} color={colors.main} />
              <Text style={[styles.padText, { color: colors.text }]}>{t('rhythmTap:tap.pad')}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
        <Text style={styles.stageDesc}>{t('rhythmTap:tap.hint')}</Text>
        <TouchableOpacity style={styles.ghostBtn} onPress={cancelTap}>
          <Text style={styles.ghostBtnText}>{t('rhythmTap:tap.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── 렌더: 결과 ───
  const renderResult = () => {
    if (!grade) return null;
    const message =
      grade.score >= 85
        ? t('rhythmTap:result.msgGreat')
        : grade.score >= 60
          ? t('rhythmTap:result.msgGood')
          : t('rhythmTap:result.msgKeep');
    const scoreColor =
      grade.score >= 85 ? COLORS.success : grade.score >= 60 ? colors.main : COLORS.error;
    const total = Math.max(1, question.totalMs);
    const xOf = (ms: number) => Math.max(0, Math.min(1, ms / total)) * timelineWidth;
    const barCount = question.measures;
    return (
      <View style={styles.stage}>
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{grade.score}</Text>
          <Text style={styles.scoreUnit}>
            {t('rhythmTap:result.matched', { matched: grade.matched, expected: grade.expected })}
          </Text>
        </View>
        <Text style={[styles.resultMessage, { color: scoreColor }]}>{message}</Text>
        {grade.extra > 0 && (
          <Text style={styles.extraText}>
            {t('rhythmTap:result.extra', { count: grade.extra })}
          </Text>
        )}

        {/* 타이밍 타임라인 */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>{t('rhythmTap:result.timeline')}</Text>
          <View style={styles.timeline} onLayout={onTimelineLayout}>
            <View style={styles.timelineBase} />
            {Array.from({ length: barCount * question.beatsPerBar + 1 }, (_, i) => {
              const ms = i * question.beatMs;
              const isBar = i % question.beatsPerBar === 0;
              return (
                <View
                  key={`g${i}`}
                  style={[
                    styles.gridLine,
                    {
                      left: xOf(ms),
                      height: isBar ? 36 : 18,
                      backgroundColor: isBar ? COLORS.slate300 : COLORS.slate200,
                    },
                  ]}
                />
              );
            })}
            {grade.extraTapsMs.map((ms, i) => (
              <View key={`x${i}`} style={[styles.extraTick, { left: xOf(ms) - 1 }]} />
            ))}
            {grade.matches.map((m, i) => (
              <React.Fragment key={`m${i}`}>
                <View
                  style={[
                    styles.expectedDot,
                    { left: xOf(m.expectedMs) - 8, backgroundColor: STATUS_COLORS[m.status] },
                  ]}
                />
                {m.tapMs !== null && (
                  <View
                    style={[
                      styles.tapTick,
                      { left: xOf(m.tapMs) - 1, backgroundColor: STATUS_COLORS[m.status] },
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
          <View style={styles.legend}>
            {(['perfect', 'early', 'late', 'miss'] as TapStatus[]).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[s] }]} />
                <Text style={styles.legendText}>{t(`rhythmTap:result.${s}`)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.main }]}
            onPress={handlePlay}
            activeOpacity={0.85}
          >
            <Volume2 size={16} color={colors.main} />
            <Text style={[styles.secondaryBtnText, { color: colors.main }]}>
              {isPlaying ? t('rhythmTap:listen.playing') : t('rhythmTap:result.listenAnswer')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.main }]}
            onPress={nextRhythm}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('rhythmTap:result.next')}</Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.row}>
            <TouchableOpacity style={styles.ghostBtn} onPress={retrySame}>
              <RotateCcw size={14} color={COLORS.slate600} />
              <Text style={styles.ghostBtnText}>{t('rhythmTap:result.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => void finishPractice()}>
              <Text style={styles.ghostBtnText}>{t('rhythmTap:result.finish')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── 렌더: 요약 ───
  const renderSummary = () => (
    <View style={styles.stage}>
      <View style={[styles.scoreCircle, { borderColor: colors.main }]}>
        <Text style={[styles.scoreText, { color: colors.main }]}>{avgScore}</Text>
        <Text style={styles.scoreUnit}>
          {t('rhythmTap:summary.rounds', { count: scores.length })}
        </Text>
      </View>
      <Text style={styles.stageTitle}>{t('rhythmTap:summary.title')}</Text>
      <Text style={styles.stageDesc}>{t('rhythmTap:summary.avg', { score: avgScore })}</Text>
      <View style={styles.resultActions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.main }]}
          onPress={restartPractice}
          activeOpacity={0.85}
        >
          <RotateCcw size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>{t('rhythmTap:summary.retry')}</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() =>
              setShareData({
                kind: 'practice',
                title: t('share:kind.practice'),
                subtitle: `${t('content:category.rhythmTap.name')} · ${diffLabel}`,
                headline: `${avgScore}${t('common:unit.score')}`,
                headlineLabel: t('rhythmTap:summary.rounds', { count: scores.length }),
                stats: [
                  { label: t('share:stat.questions'), value: `${scores.length}` },
                  { label: t('share:stat.level'), value: `Lv.${mascotLevel}` },
                ],
                accent: colors.main,
                date: new Date().toLocaleDateString(i18n.language),
                mascotLevel,
                happy: avgScore >= 60,
              })
            }
          >
            <Share2 size={14} color={COLORS.slate600} />
            <Text style={styles.ghostBtnText}>{t('share:button')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleBack}>
            <Text style={styles.ghostBtnText}>{t('rhythmTap:summary.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common:button.goBack')}
        >
          <ArrowLeft size={24} color={colors.main} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.main }]}>{t('rhythmTap:title')}</Text>
          <Text style={styles.headerSub}>{diffLabel}</Text>
        </View>
        {phase !== 'summary' && (
          <View style={[styles.roundChip, { backgroundColor: colors.main }]}>
            <Text style={styles.roundChipText}>{t('rhythmTap:round', { n: roundNumber })}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          layout.contentStyle,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={phase !== 'tap'}
      >
        {phase === 'listen' && renderListen()}
        {phase === 'tap' && renderTap()}
        {phase === 'result' && renderResult()}
        {phase === 'summary' && renderSummary()}

        {/* 악보: 결과 단계에서만 보이고, 그 외에는 오디오 전용으로 숨긴다 */}
        <View style={phase === 'result' ? styles.scoreVisible : styles.hidden}>
          <AbcjsRenderer
            ref={abcjsRef}
            abcString={question.abc}
            tempo={question.tempo}
            timeSignature={question.timeSignature}
            prependMetronome={true}
            barsPerStaff={question.measures}
            hideNotes={phase !== 'result'}
            showNoteCursor={false}
            showMeasureHighlight={false}
            isPlaying={isPlaying}
            onPlayStateChange={setIsPlaying}
            onClickTrackState={handleClickTrackState}
          />
        </View>
      </ScrollView>

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
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, color: COLORS.slate500, marginTop: 2 },
  roundChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  roundChipText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  stage: { alignItems: 'center', gap: 14 },
  stageTitle: { fontSize: 20, fontWeight: '900', color: COLORS.slate800, textAlign: 'center' },
  stageDesc: {
    fontSize: 13,
    color: COLORS.slate500,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  playCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  playLabel: { fontSize: 14, fontWeight: '700', color: COLORS.slate600 },
  infoChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  infoChipText: { fontSize: 12, fontWeight: '800' },
  primaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: COLORS.bgCard,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
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
  row: { alignSelf: 'stretch', flexDirection: 'row', gap: 10 },
  countLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  countNumber: { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  beatDots: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  beatDot: { width: 14, height: 14, borderRadius: 7 },
  pad: {
    alignSelf: 'stretch',
    height: 230,
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
  },
  padPress: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  padText: { fontSize: 16, fontWeight: '900' },
  scoreCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    gap: 2,
  },
  scoreText: { fontSize: 44, fontWeight: '900', lineHeight: 50 },
  scoreUnit: { fontSize: 12, fontWeight: '700', color: COLORS.slate500 },
  resultMessage: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  extraText: { fontSize: 12, color: COLORS.slate500, marginTop: -8 },
  timelineCard: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  timelineTitle: { fontSize: 13, fontWeight: '800', color: COLORS.slate700 },
  timeline: { height: 44, justifyContent: 'center' },
  timelineBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 21,
    height: 2,
    backgroundColor: COLORS.slate200,
  },
  gridLine: { position: 'absolute', top: 4, width: 1 },
  expectedDot: { position: 'absolute', top: 14, width: 16, height: 16, borderRadius: 8 },
  tapTick: { position: 'absolute', top: 34, width: 2, height: 10 },
  extraTick: {
    position: 'absolute',
    top: 34,
    width: 2,
    height: 10,
    backgroundColor: COLORS.slate400,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '700', color: COLORS.slate500 },
  resultActions: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  hidden: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
  scoreVisible: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
});
