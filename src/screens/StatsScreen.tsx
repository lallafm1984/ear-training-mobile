// ─────────────────────────────────────────────────────────────
// StatsScreen — 학습 통계 및 진도 대시보드
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Target,
  Award,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Share2,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
  Star,
  CalendarCheck,
  Music,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { useAuth } from '../context';
import { LOCAL_DATA_BASE_KEYS, localDataKey } from '../lib/localProfileStorage';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { computeInsights } from '../lib/computeStats';
import { CONTENT_CATEGORIES } from '../lib/contentConfig';
import type { ContentCategory } from '../types/content';
import { ICON_MAP } from '../components/CategoryCard';
import { useSkillProfile } from '../hooks/useSkillProfile';
import { useWrongNotes } from '../hooks/useWrongNotes';
import { useMascotExp } from '../hooks/useMascotExp';
import ShareCardModal from '../components/ShareCardModal';
import type { ShareCardData } from '../lib/shareCard';
import PracticeCalendar from '../components/PracticeCalendar';
import DailyScoreChart from '../components/DailyScoreChart';
import type { MainStackParamList } from '../navigation/MainStack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type NavProp = StackNavigationProp<MainStackParamList>;

/** 카테고리 → 아이콘 이름 (CategoryCard 와 같은 ICON_MAP 사용) */
const CONTENT_ICON = Object.fromEntries(CONTENT_CATEGORIES.map((c) => [c.id, c.icon])) as Record<
  ContentCategory,
  string
>;

interface ExamRecord {
  id: string;
  title: string;
  total_score: number;
  max_score: number;
  completed_at: string;
}

export default function StatsScreen() {
  const navigation = useNavigation<NavProp>();
  const layout = useResponsiveLayout();
  const { t, i18n } = useTranslation([
    'stats',
    'practice',
    'common',
    'wrongNotes',
    'share',
    'content',
  ]);
  const { storageUserId } = useAuth();
  const { records, stats, loaded, reload } = usePracticeHistory();
  const { profile: skillProfile } = useSkillProfile();
  const { notes: wrongNotes } = useWrongNotes();
  const { level: mascotLevel } = useMascotExp();
  const [shareData, setShareData] = useState<ShareCardData | null>(null);
  const unresolvedWrong = wrongNotes.filter((n) => !n.resolvedAt).length;
  // 카테고리별 분석·약점/강점·주간 증감·활동일
  const insights = useMemo(() => computeInsights(records), [records]);

  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState(false);

  // 시험 월 필터: null = 전체
  const [examMonth, setExamMonth] = useState<{ year: number; month: number } | null>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // 시험 기록 로드 (전체)
  useEffect(() => {
    setExamLoading(true);
    setExamError(false);
    const examKey = localDataKey(LOCAL_DATA_BASE_KEYS.examSessions, storageUserId);
    AsyncStorage.getItem(examKey)
      .then((raw) => {
        if (raw) {
          try {
            setExamRecords(JSON.parse(raw) as ExamRecord[]);
          } catch {
            setExamError(true);
          }
        }
        setExamLoading(false);
      })
      .catch(() => {
        setExamError(true);
        setExamLoading(false);
      });
  }, [storageUserId]);

  // 월별 필터된 시험 기록
  const filteredExams = useMemo(() => {
    if (!examMonth) return examRecords;
    return examRecords.filter((e) => {
      const d = new Date(e.completed_at);
      return d.getFullYear() === examMonth.year && d.getMonth() === examMonth.month;
    });
  }, [examRecords, examMonth]);

  // 시험 월 네비게이션
  const prevExamMonth = () => {
    if (!examMonth) return;
    const m =
      examMonth.month === 0
        ? { year: examMonth.year - 1, month: 11 }
        : { year: examMonth.year, month: examMonth.month - 1 };
    setExamMonth(m);
  };
  const nextExamMonth = () => {
    if (!examMonth) return;
    const m =
      examMonth.month === 11
        ? { year: examMonth.year + 1, month: 0 }
        : { year: examMonth.year, month: examMonth.month + 1 };
    setExamMonth(m);
  };

  // 시험 통계 계산
  const examStats = useMemo(() => {
    if (filteredExams.length === 0) return null;
    const total = filteredExams.length;
    const avgPct = Math.round(
      filteredExams.reduce(
        (s, e) => s + (e.max_score > 0 ? (e.total_score / e.max_score) * 100 : 0),
        0,
      ) / total,
    );
    const bestPct = Math.round(
      Math.max(
        ...filteredExams.map((e) => (e.max_score > 0 ? (e.total_score / e.max_score) * 100 : 0)),
      ),
    );

    const byPreset: Record<
      string,
      { title: string; count: number; totalPct: number; best: number }
    > = {};
    filteredExams.forEach((e) => {
      const pct = e.max_score > 0 ? (e.total_score / e.max_score) * 100 : 0;
      if (!byPreset[e.title])
        byPreset[e.title] = { title: e.title, count: 0, totalPct: 0, best: 0 };
      byPreset[e.title].count++;
      byPreset[e.title].totalPct += pct;
      byPreset[e.title].best = Math.max(byPreset[e.title].best, pct);
    });

    return { total, avgPct, bestPct, byPreset };
  }, [filteredExams]);

  const pctColor = (p: number) =>
    p >= 70 ? COLORS.success : p >= 50 ? COLORS.amber600 : COLORS.error;

  // ── DEV 전용: 테스트 데이터 주입 ──
  const seedTestData = async () => {
    const categories = [
      'melody',
      'barMelody',
      'rhythm',
      'interval',
      'chord',
      'key',
      'twoVoice',
    ] as const;
    const difficulties = [
      'beginner_1',
      'beginner_1',
      'rhythm_2',
      'interval_1',
      'chord_2',
      'key_1',
      'bass_1',
    ];
    const now = Date.now();

    const practiceRecords = Array.from({ length: 200 }, (_, i) => ({
      id: `seed_${i}`,
      contentType: categories[i % categories.length],
      difficulty: difficulties[i % difficulties.length],
      selfRating: Math.floor(Math.random() * 5) + 1,
      practicedAt: new Date(now - Math.random() * 60 * 86400_000).toISOString(),
    }));
    await AsyncStorage.setItem(
      localDataKey(LOCAL_DATA_BASE_KEYS.recentActivity, storageUserId),
      JSON.stringify(practiceRecords),
    );

    const examTitles = ['기초 청음', '중급 종합', '리듬 집중'];
    const examRecords = Array.from({ length: 30 }, (_, i) => ({
      id: `exam_seed_${i}`,
      title: examTitles[i % examTitles.length],
      total_score: Math.floor(Math.random() * 80) + 20,
      max_score: 100,
      completed_at: new Date(now - Math.random() * 60 * 86400_000).toISOString(),
    }));
    await AsyncStorage.setItem(
      localDataKey(LOCAL_DATA_BASE_KEYS.examSessions, storageUserId),
      JSON.stringify(examRecords),
    );

    // 스킬 프로필 — 연속 학습일 주입
    const skillRaw = await AsyncStorage.getItem(
      localDataKey(LOCAL_DATA_BASE_KEYS.skillProfile, storageUserId),
    );
    const skillProfile = skillRaw ? JSON.parse(skillRaw) : {};
    await AsyncStorage.setItem(
      localDataKey(LOCAL_DATA_BASE_KEYS.skillProfile, storageUserId),
      JSON.stringify({ ...skillProfile, streakDays: 14 }),
    );
    await AsyncStorage.setItem(
      localDataKey(LOCAL_DATA_BASE_KEYS.lastPracticeDate, storageUserId),
      new Date().toDateString(),
    );

    await reload();
    setExamRecords(examRecords);
  };

  if (!loaded) {
    return (
      <SafeAreaView
        style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator size="large" color={COLORS.primary500} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common:button.goBack')}
        >
          <ArrowLeft size={24} color={COLORS.primary500} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('stats:title')}</Text>
        {stats.totalSessions > 0 && (
          <TouchableOpacity
            onPress={() =>
              setShareData({
                kind: 'stats',
                title: t('share:kind.stats'),
                headline: `${skillProfile.streakDays}${t('common:unit.day')}`,
                headlineLabel: t('share:stats.streakLabel'),
                stats: [
                  { label: t('share:stat.sessions'), value: `${stats.totalSessions}` },
                  { label: t('share:stat.weekly'), value: `${stats.weeklyCount}` },
                  { label: t('share:stat.level'), value: `Lv.${mascotLevel}` },
                ],
                date: new Date().toLocaleDateString(i18n.language),
                mascotLevel,
                happy: skillProfile.streakDays > 0,
              })
            }
            style={styles.shareBtn}
            hitSlop={8}
          >
            <Share2 size={20} color={COLORS.primary500} />
          </TouchableOpacity>
        )}
        {__DEV__ && (
          <TouchableOpacity onPress={seedTestData} style={styles.devBtn}>
            <Text style={styles.devBtnText}>SEED</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* 요약 카드 */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Calendar size={20} color={COLORS.primary500} />
            <Text
              style={[
                styles.summaryValue,
                String(skillProfile.streakDays).length >= 4 && { fontSize: 18 },
              ]}
            >
              {skillProfile.streakDays}
            </Text>
            <Text style={styles.summaryLabel}>{t('stats:summary.streak')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Target size={20} color={COLORS.amber500} />
            <Text
              style={[
                styles.summaryValue,
                String(stats.totalSessions).length >= 4 && { fontSize: 18 },
              ]}
            >
              {stats.totalSessions}
            </Text>
            <Text style={styles.summaryLabel}>{t('stats:summary.totalSessions')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <TrendingUp size={20} color={COLORS.success} />
            <Text
              style={[
                styles.summaryValue,
                String(stats.weeklyCount).length >= 4 && { fontSize: 18 },
              ]}
            >
              {stats.weeklyCount}
            </Text>
            <Text style={styles.summaryLabel}>{t('stats:summary.thisWeek')}</Text>
            {stats.totalSessions > 0 && (
              <View style={styles.summaryDeltaRow}>
                {insights.weeklyDelta > 0 ? (
                  <ArrowUp size={10} color={COLORS.success} />
                ) : insights.weeklyDelta < 0 ? (
                  <ArrowDown size={10} color={COLORS.error} />
                ) : (
                  <Minus size={10} color={COLORS.slate400} />
                )}
                <Text
                  style={[
                    styles.summaryDelta,
                    insights.weeklyDelta > 0 && { color: COLORS.success },
                    insights.weeklyDelta < 0 && { color: COLORS.error },
                  ]}
                  numberOfLines={1}
                >
                  {insights.weeklyDelta > 0
                    ? t('stats:summary.deltaUp', { count: insights.weeklyDelta })
                    : insights.weeklyDelta < 0
                      ? t('stats:summary.deltaDown', { count: -insights.weeklyDelta })
                      : t('stats:summary.deltaSame')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 오답노트 */}
        <TouchableOpacity
          style={styles.notesCard}
          onPress={() => navigation.navigate('WrongNotes', undefined)}
          activeOpacity={0.8}
        >
          <View style={styles.notesIcon}>
            <BookOpen size={18} color={COLORS.primary600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notesTitle}>{t('wrongNotes:stats.card')}</Text>
            <Text style={styles.notesDesc}>
              {unresolvedWrong > 0
                ? t('wrongNotes:stats.cardDesc', { count: unresolvedWrong })
                : t('wrongNotes:stats.cardEmpty')}
            </Text>
          </View>
          {unresolvedWrong > 0 && (
            <View style={styles.notesBadge}>
              <Text style={styles.notesBadgeText}>{unresolvedWrong}</Text>
            </View>
          )}
          <ChevronRight size={18} color={COLORS.slate400} />
        </TouchableOpacity>

        {/* 빈 상태 안내 */}
        {stats.totalSessions === 0 && (
          <View style={styles.emptyCard}>
            <Target size={32} color={COLORS.slate300} />
            <Text style={styles.emptyTitle}>{t('practice:empty.title')}</Text>
            <Text style={styles.emptyDesc}>{t('practice:empty.desc')}</Text>
          </View>
        )}

        {/* 월간 캘린더 (항상 표시, 오늘 자동선택) */}
        <PracticeCalendar records={records} />

        {/* 일별 평균 점수 차트 */}
        {stats.totalSessions > 0 && (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{t('stats:section.dailyScore')}</Text>
              <Text style={styles.sectionSubLabel}>{t('stats:section.dailyScoreMax')}</Text>
            </View>
            <DailyScoreChart records={records} />
          </>
        )}

        {/* 카테고리별 연습 — 횟수·평균 평가·최다 난이도, 약점/강점 */}
        {insights.byCategory.length > 0 && (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{t('stats:section.byCategory')}</Text>
              <View style={styles.activeDaysRow}>
                <CalendarCheck size={12} color={COLORS.slate500} />
                <Text style={styles.sectionSubLabel}>
                  {t('stats:section.activeDays', { count: insights.activeDays30 })}
                </Text>
              </View>
            </View>
            <View style={styles.catCard}>
              {insights.byCategory.map((c, i) => {
                const palette = CATEGORY_COLORS[c.category];
                const Icon = ICON_MAP[CONTENT_ICON[c.category]] ?? Music;
                const isWeak = insights.weakest === c.category;
                const isStrong = insights.strongest === c.category;
                return (
                  <TouchableOpacity
                    key={c.category}
                    style={[styles.catRow, i > 0 && styles.catRowBorder]}
                    onPress={() =>
                      navigation.navigate('CategoryPractice', {
                        category: c.category,
                        ...(c.topDifficulty ? { initialDifficulty: c.topDifficulty } : {}),
                      })
                    }
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('content:category.' + c.category + '.name')}
                  >
                    <View style={[styles.catIcon, { backgroundColor: palette.bg }]}>
                      <Icon size={18} color={palette.main} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.catNameRow}>
                        <Text style={styles.catName} numberOfLines={1}>
                          {t('content:category.' + c.category + '.name')}
                        </Text>
                        {isWeak && (
                          <View style={[styles.catChip, { backgroundColor: '#fee2e2' }]}>
                            <AlertCircle size={10} color={COLORS.error} />
                            <Text style={[styles.catChipText, { color: COLORS.error }]}>
                              {t('stats:category.weak')}
                            </Text>
                          </View>
                        )}
                        {isStrong && (
                          <View style={[styles.catChip, { backgroundColor: '#dcfce7' }]}>
                            <Star size={10} color={COLORS.success} />
                            <Text style={[styles.catChipText, { color: COLORS.success }]}>
                              {t('stats:category.strong')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.catMeta} numberOfLines={1}>
                        {t('stats:category.summary', { count: c.count, rating: c.avgRating })}
                        {c.topDifficulty
                          ? ` · ${t('content:difficulty.' + c.category + '.' + c.topDifficulty, {
                              defaultValue: c.topDifficulty,
                            })}`
                          : ''}
                      </Text>
                      <View style={styles.catBarTrack}>
                        <View
                          style={[
                            styles.catBarFill,
                            {
                              width: `${Math.round((c.avgRating / 5) * 100)}%`,
                              backgroundColor: palette.main,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <ChevronRight size={16} color={COLORS.slate300} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 모의시험 통계 */}
        {examLoading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={COLORS.primary500} />
            <Text style={{ fontSize: 13, color: COLORS.slate400, marginTop: 8 }}>
              {t('stats:exam.loading')}
            </Text>
          </View>
        )}
        {examError && !examLoading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: COLORS.error }}>{t('stats:exam.loadError')}</Text>
          </View>
        )}
        {!examLoading && !examError && examRecords.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('stats:section.examStats')}</Text>

            {/* 월 선택 */}
            <View style={styles.monthSelector}>
              <TouchableOpacity
                onPress={() => {
                  if (!examMonth) {
                    const now = new Date();
                    setExamMonth({ year: now.getFullYear(), month: now.getMonth() });
                  } else {
                    prevExamMonth();
                  }
                }}
                hitSlop={12}
                style={styles.monthArrow}
              >
                <ChevronLeft size={18} color={examMonth ? COLORS.slate600 : COLORS.slate300} />
              </TouchableOpacity>

              <Text style={styles.monthLabel}>
                {examMonth
                  ? t('stats:month.format', { year: examMonth.year, month: examMonth.month + 1 })
                  : t('stats:month.all')}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (!examMonth) return;
                  nextExamMonth();
                }}
                hitSlop={12}
                style={styles.monthArrow}
              >
                <ChevronRight size={18} color={examMonth ? COLORS.slate600 : COLORS.slate300} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setExamMonth(
                    examMonth
                      ? null
                      : (() => {
                          const now = new Date();
                          return { year: now.getFullYear(), month: now.getMonth() };
                        })(),
                  )
                }
                style={[styles.allBtn, !examMonth && styles.allBtnActive]}
              >
                <Text style={[styles.allBtnText, !examMonth && { color: '#fff' }]}>
                  {examMonth ? t('stats:month.all') : t('stats:month.monthly')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 통계 카드 */}
            {examStats ? (
              <>
                <View style={styles.examSummaryRow}>
                  <View style={styles.examSummaryCard}>
                    <Text style={styles.examSummaryValue}>{examStats.total}</Text>
                    <Text style={styles.examSummaryLabel}>{t('stats:exam.attempts')}</Text>
                  </View>
                  <View style={styles.examSummaryCard}>
                    <Text style={[styles.examSummaryValue, { color: pctColor(examStats.avgPct) }]}>
                      {examStats.avgPct}
                      {t('common:unit.score')}
                    </Text>
                    <Text style={styles.examSummaryLabel}>{t('stats:exam.avgScore')}</Text>
                  </View>
                  <View style={styles.examSummaryCard}>
                    <Text style={[styles.examSummaryValue, { color: pctColor(examStats.bestPct) }]}>
                      {examStats.bestPct}
                      {t('common:unit.score')}
                    </Text>
                    <Text style={styles.examSummaryLabel}>{t('stats:exam.bestScore')}</Text>
                  </View>
                </View>

                <View style={styles.examCard}>
                  {Object.values(examStats.byPreset).map((p) => {
                    const avg = Math.round(p.totalPct / p.count);
                    const best = Math.round(p.best);
                    return (
                      <View key={p.title} style={styles.examRow}>
                        <View style={styles.examLeft}>
                          <Award size={16} color={COLORS.amber500} />
                          <View>
                            <Text style={styles.examTitle}>{p.title}</Text>
                            <Text style={styles.examDate}>
                              {t('stats:exam.attemptCount', { count: p.count })}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.examRight}>
                          <Text style={[styles.examScore, { color: pctColor(avg) }]}>
                            {t('stats:exam.avgLabel', { score: avg })}
                          </Text>
                          <Text style={styles.examBest}>
                            {t('stats:exam.bestLabel', { score: best })}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyDesc}>
                  {examMonth
                    ? t('stats:exam.noRecords', {
                        year: examMonth.year,
                        month: examMonth.month + 1,
                      })
                    : t('stats:exam.noRecordsAll')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <ShareCardModal data={shareData} onClose={() => setShareData(null)} />
    </SafeAreaView>
  );
}

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
  shareBtn: { padding: 4 },
  devBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  devBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.slate800,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 20,
  },
  // 요약 — 주간 증감
  summaryDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  summaryDelta: { fontSize: 10, fontWeight: '600', color: COLORS.slate400 },
  // 카테고리별 연습
  activeDaysRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  catRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.slate100 },
  catIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catName: { fontSize: 14, fontWeight: '700', color: COLORS.slate800, flexShrink: 1 },
  catMeta: { fontSize: 12, color: COLORS.slate500 },
  catBarTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.slate100, overflow: 'hidden' },
  catBarFill: { height: 4, borderRadius: 2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catChipText: { fontSize: 10, fontWeight: '700' },
  // 요약
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slate600,
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.slate400,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.slate800,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.slate400,
    fontWeight: '500',
  },
  // 섹션
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  sectionSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slate400,
  },
  // 월 선택
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    gap: 8,
  },
  monthArrow: {
    padding: 4,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate700,
    minWidth: 100,
    textAlign: 'center',
  },
  allBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.slate100,
    marginLeft: 4,
  },
  allBtnActive: {
    backgroundColor: COLORS.amber500,
  },
  allBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate500,
  },
  // 시험 기록
  examCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  examRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  examTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  examDate: {
    fontSize: 11,
    color: COLORS.slate400,
  },
  examRight: {
    alignItems: 'flex-end',
  },
  examScore: {
    fontSize: 14,
    fontWeight: '800',
  },
  examBest: {
    fontSize: 11,
    color: COLORS.slate400,
    marginTop: 1,
  },
  // 시험 요약 카드
  examSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  examSummaryCard: {
    flex: 1,
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.amber500 + '20',
  },
  examSummaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.slate800,
  },
  examSummaryLabel: {
    fontSize: 10,
    color: COLORS.slate500,
    fontWeight: '500',
  },
  // 오답노트 카드
  notesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  notesIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate800 },
  notesDesc: { fontSize: 11, color: COLORS.slate500, marginTop: 2 },
  notesBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
