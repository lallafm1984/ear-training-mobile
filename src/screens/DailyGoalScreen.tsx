// ─────────────────────────────────────────────────────────────
// DailyGoalScreen — 오늘의 일일 목표 목록
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, Circle, Flame, Play, Bell } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';

import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_COUNT, computeGoalStreak } from '../lib/dailyGoal';
import { useMascotExp } from '../hooks/useMascotExp';
import { useAuth, useAlert } from '../context';
import { LOCAL_DATA_BASE_KEYS, localDataKey } from '../lib/localProfileStorage';
import { useReminderSettings } from '../hooks/useReminderSettings';
import { REMINDER_NUDGE_DISMISSED_KEY } from '../lib/reminder';
import MascotCharacter from '../components/MascotCharacter';
import { getMascotStageIndex } from '../lib/mascotConfig';
import type { ContentCategory } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type NavProp = StackNavigationProp<MainStackParamList>;

interface GoalItem {
  category: ContentCategory;
  completed: boolean;
}

export default function DailyGoalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const layout = useResponsiveLayout();
  const { t } = useTranslation(['practice', 'content', 'mascot', 'common', 'profile']);
  const { records, reload } = usePracticeHistory();
  const { storageUserId } = useAuth();
  const { showAlert } = useAlert();

  // 목표를 모두 채운 날, 리마인더가 꺼져 있으면 한 번만 켜기를 권한다.
  const {
    settings: reminder,
    loaded: reminderLoaded,
    setEnabled: setReminder,
  } = useReminderSettings();
  const [nudgeDismissed, setNudgeDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(REMINDER_NUDGE_DISMISSED_KEY)
      .then((v) => setNudgeDismissed(v === '1'))
      .catch(() => setNudgeDismissed(true));
  }, []);
  const dismissNudge = useCallback(() => {
    setNudgeDismissed(true);
    AsyncStorage.setItem(REMINDER_NUDGE_DISMISSED_KEY, '1').catch(() => {});
  }, []);
  const enableReminderFromNudge = useCallback(async () => {
    const outcome = await setReminder(true);
    if (outcome === 'saved') {
      dismissNudge();
      return;
    }
    if (outcome === 'permission_denied') {
      showAlert({
        title: t('profile:reminder.permissionTitle'),
        message: t('profile:reminder.permissionMessage'),
        type: 'warning',
        buttons: [
          { text: t('common:button.later'), style: 'cancel' },
          {
            text: t('common:button.goToSettings'),
            onPress: () => {
              Linking.openSettings().catch(() => {});
            },
          },
        ],
      });
    }
  }, [setReminder, dismissNudge, showAlert, t]);
  const { level, progress, addExp } = useMascotExp();
  const [rewardedCount, setRewardedCount] = useState<number | null>(null);

  const EXP_REWARD_KEY = localDataKey(LOCAL_DATA_BASE_KEYS.dailyExpRewarded, storageUserId);

  // 오늘 이미 보상한 목표 수 로드
  useEffect(() => {
    if (!EXP_REWARD_KEY) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(EXP_REWARD_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          const todayStr = new Date().toDateString();
          if (data.date === todayStr) {
            setRewardedCount(data.count);
            return;
          }
        }
        setRewardedCount(0);
      } catch {
        setRewardedCount(0);
      }
    })();
  }, [EXP_REWARD_KEY]);

  // 화면 포커스될 때 최신 기록 다시 로드
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // 오늘 연습한 카테고리 Set
  const todayCategories = useMemo(() => {
    const todayStr = new Date().toDateString();
    const cats = new Set<ContentCategory>();
    records.forEach((r) => {
      if (new Date(r.practicedAt).toDateString() === todayStr) {
        cats.add(r.contentType);
      }
    });
    return cats;
  }, [records]);

  // 일일 목표 목록 생성 (고정 7개 카테고리)
  const goals: GoalItem[] = useMemo(() => {
    return DAILY_GOAL_CATEGORIES.map((cat) => ({
      category: cat,
      completed: todayCategories.has(cat),
    }));
  }, [todayCategories]);

  const completedCount = goals.filter((g) => g.completed).length;
  const allDone = completedCount >= DAILY_GOAL_COUNT;
  const progressPct = Math.round((completedCount / DAILY_GOAL_COUNT) * 100);

  // 연속 달성일
  const goalStreak = useMemo(() => computeGoalStreak(records), [records]);

  // EXP 지급: 새로 완료된 목표마다 5 EXP, 전부 완료 시 +5 EXP 보너스 (하루 최대 40)
  // rewardedCount를 AsyncStorage에 저장하여 화면 재진입 시 중복 지급 방지
  useEffect(() => {
    if (!EXP_REWARD_KEY) return;
    if (rewardedCount === null) return; // 아직 로드 안됨
    if (completedCount <= rewardedCount) return; // 새로 완료된 목표 없음

    const newlyCompleted = completedCount - rewardedCount;
    let expToAdd = newlyCompleted * 5;
    if (completedCount >= DAILY_GOAL_COUNT && rewardedCount < DAILY_GOAL_COUNT) {
      expToAdd += 5;
    }
    addExp(expToAdd);

    const newCount = completedCount;
    setRewardedCount(newCount);
    AsyncStorage.setItem(
      EXP_REWARD_KEY,
      JSON.stringify({
        date: new Date().toDateString(),
        count: newCount,
      }),
    ).catch(() => {});
  }, [completedCount, rewardedCount, addExp, EXP_REWARD_KEY]);

  const handleGoalPress = (category: ContentCategory) => {
    navigation.navigate('CategoryPractice', { category });
  };

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
          <ArrowLeft size={24} color="#ea580c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('practice:dailyGoal.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          layout.contentStyle,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 진행 카드 */}
        <View style={[styles.progressCard, allDone && styles.progressCardDone]}>
          <TouchableOpacity
            style={styles.mascotRow}
            onPress={() => navigation.navigate('MascotGallery')}
            activeOpacity={0.8}
          >
            <MascotCharacter size={64} level={level} happy={allDone} />
            <View style={styles.mascotInfo}>
              <Text style={[styles.progressTitle, allDone && { color: '#065f46' }]}>
                {allDone ? t('practice:dailyGoal.complete') : t('practice:dailyGoal.keepGoing')}
              </Text>
              <Text style={styles.levelText}>
                Lv.{level} {t('mascot:stage.' + getMascotStageIndex(level))} ·{' '}
                <Text style={styles.galleryLink}>{t('mascot:gallery.open')}</Text>
              </Text>
              <View style={styles.expBarBg}>
                <View style={[styles.expBarFill, { width: `${progress.progress * 100}%` }]} />
              </View>
              <Text style={styles.expText}>
                {t('mascot:exp.format', { current: progress.current, needed: progress.needed })}
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.progressCount}>
            {t('practice:dailyGoal.progress', { done: completedCount, total: DAILY_GOAL_COUNT })}
          </Text>

          {/* 프로그레스 바 */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: allDone ? COLORS.success : '#ea580c',
                },
              ]}
            />
          </View>

          {/* 연속 달성일 */}
          {goalStreak > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={14} color="#f59e0b" />
              <Text style={styles.streakText}>
                {t('practice:dailyGoal.streak', { days: goalStreak })}
              </Text>
            </View>
          )}
        </View>

        {/* 리마인더 권유 (전부 달성 + 알림 꺼짐 + 아직 닫지 않음) */}
        {allDone && reminderLoaded && !reminder.enabled && nudgeDismissed === false && (
          <View style={styles.nudgeCard}>
            <View style={styles.nudgeIcon}>
              <Bell size={18} color="#4f46e5" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.nudgeTitle}>{t('practice:dailyGoal.reminderNudge.title')}</Text>
              <Text style={styles.nudgeDesc}>{t('practice:dailyGoal.reminderNudge.desc')}</Text>
              <View style={styles.nudgeActions}>
                <TouchableOpacity
                  style={styles.nudgePrimary}
                  onPress={() => void enableReminderFromNudge()}
                >
                  <Text style={styles.nudgePrimaryText}>
                    {t('practice:dailyGoal.reminderNudge.enable')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nudgeGhost} onPress={dismissNudge}>
                  <Text style={styles.nudgeGhostText}>
                    {t('practice:dailyGoal.reminderNudge.later')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 목표 목록 */}
        <Text style={styles.sectionTitle}>{t('practice:dailyGoal.sectionTitle')}</Text>
        <View style={styles.goalList}>
          {goals.map((goal, idx) => {
            const colors = CATEGORY_COLORS[goal.category];

            return (
              <TouchableOpacity
                key={`${goal.category}-${idx}`}
                style={[styles.goalItem, goal.completed && styles.goalItemDone]}
                onPress={() => !goal.completed && handleGoalPress(goal.category)}
                activeOpacity={goal.completed ? 1 : 0.7}
              >
                <View style={styles.goalLeft}>
                  {goal.completed ? (
                    <CheckCircle size={24} color={COLORS.success} />
                  ) : (
                    <Circle size={24} color={COLORS.slate300} />
                  )}
                  <View style={styles.goalInfo}>
                    <Text
                      style={[
                        styles.goalName,
                        goal.completed && {
                          color: COLORS.slate400,
                          textDecorationLine: 'line-through',
                        },
                      ]}
                    >
                      {t('content:category.' + goal.category + '.name')}
                    </Text>
                    <Text style={styles.goalDesc}>
                      {t('content:category.' + goal.category + '.description')}
                    </Text>
                  </View>
                </View>

                {!goal.completed && (
                  <View style={[styles.goBtn, { backgroundColor: colors.main }]}>
                    <Play size={14} color="#fff" fill="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 안내 */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>{t('practice:dailyGoal.tip')}</Text>
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#9a3412',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  // 진행 카드
  progressCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  progressCardDone: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  mascotInfo: {
    flex: 1,
    gap: 3,
  },
  galleryLink: { color: COLORS.primary500, fontWeight: '800' },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate500,
  },
  expBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.slate200,
    overflow: 'hidden',
  },
  expBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
  },
  expText: {
    fontSize: 10,
    color: COLORS.slate400,
    fontWeight: '500',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#9a3412',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate500,
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.slate200,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: 10,
    borderRadius: 5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  // 섹션
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  // 목표 목록
  goalList: {
    gap: 8,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  goalItemDone: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate800,
  },
  goalDesc: {
    fontSize: 11,
    color: COLORS.slate400,
    marginTop: 2,
  },
  goBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 안내
  tipCard: {
    backgroundColor: COLORS.slate100,
    borderRadius: 12,
    padding: 14,
  },
  tipText: {
    fontSize: 12,
    color: COLORS.slate500,
    lineHeight: 18,
    textAlign: 'center',
  },

  // 리마인더 권유
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 16,
    padding: 14,
  },
  nudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeTitle: { fontSize: 14, fontWeight: '800', color: '#312e81' },
  nudgeDesc: { fontSize: 12, lineHeight: 17, color: COLORS.slate600 },
  nudgeActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  nudgePrimary: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nudgePrimaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  nudgeGhost: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  nudgeGhostText: { color: COLORS.slate500, fontSize: 12, fontWeight: '700' },
});
