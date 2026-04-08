// ─────────────────────────────────────────────────────────────
// DailyGoalScreen — 오늘의 일일 목표 목록
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, CheckCircle, Circle, Flame, Trophy, Play,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig } from '../lib/contentConfig';
import { STAGE_NAMES } from '../lib/mascotConfig';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useMascotExp } from '../hooks/useMascotExp';
import MascotCharacter from '../components/MascotCharacter';
import type { ContentCategory } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;

const GOAL_CATEGORIES: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key'];
const DAILY_GOAL_COUNT = GOAL_CATEGORIES.length;

interface GoalItem {
  category: ContentCategory;
  completed: boolean;
}

/** 연속 목표 달성일 계산 (5개 카테고리 모두 연습한 날) */
function computeGoalStreak(
  records: { practicedAt: string; contentType: string }[],
): number {
  const byDate: Record<string, Set<string>> = {};
  records.forEach(r => {
    const d = new Date(r.practicedAt).toDateString();
    if (!byDate[d]) byDate[d] = new Set();
    byDate[d].add(r.contentType);
  });

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000).toDateString();
    const cats = byDate[d];
    const done = cats ? GOAL_CATEGORIES.every(c => cats.has(c)) : false;
    if (done) {
      streak++;
    } else {
      if (i === 0) continue; // 오늘은 아직 진행 중이므로 스킵
      break;
    }
  }

  return streak;
}

export default function DailyGoalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { records, stats, reload } = usePracticeHistory();
  const { level, progress, totalExp, addExp } = useMascotExp();
  const prevCompletedRef = useRef<number>(0);

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
    records.forEach(r => {
      if (new Date(r.practicedAt).toDateString() === todayStr) {
        cats.add(r.contentType);
      }
    });
    return cats;
  }, [records]);

  // 일일 목표 목록 생성 (고정 5개 카테고리)
  const goals: GoalItem[] = useMemo(() => {
    return GOAL_CATEGORIES.map(cat => ({
      category: cat,
      completed: todayCategories.has(cat),
    }));
  }, [todayCategories]);

  const completedCount = goals.filter(g => g.completed).length;
  const allDone = completedCount >= DAILY_GOAL_COUNT;
  const progressPct = Math.round((completedCount / DAILY_GOAL_COUNT) * 100);

  // 연속 달성일
  const goalStreak = useMemo(
    () => computeGoalStreak(records),
    [records],
  );

  // EXP 지급: 새로 완료된 목표마다 2 EXP, 전부 완료 시 +10 EXP 보너스
  useEffect(() => {
    const prev = prevCompletedRef.current;
    if (completedCount > prev) {
      const newlyCompleted = completedCount - prev;
      let expToAdd = newlyCompleted * 2;
      if (completedCount >= DAILY_GOAL_COUNT && prev < DAILY_GOAL_COUNT) {
        expToAdd += 10;
      }
      addExp(expToAdd);
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount, addExp]);

  const handleGoalPress = (category: ContentCategory) => {
    navigation.navigate('CategoryPractice', { category });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color="#ea580c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>오늘의 목표</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 진행 카드 */}
        <View style={[styles.progressCard, allDone && styles.progressCardDone]}>
          <View style={styles.mascotRow}>
            <MascotCharacter size={64} level={level} happy={allDone} />
            <View style={styles.mascotInfo}>
              <Text style={[styles.progressTitle, allDone && { color: '#065f46' }]}>
                {allDone ? '목표 달성!' : '오늘의 목표를 완료하세요'}
              </Text>
              <Text style={styles.levelText}>
                Lv.{level} {STAGE_NAMES[Math.min(9, Math.floor((level - 1) / 10))]}
              </Text>
              <View style={styles.expBarBg}>
                <View style={[styles.expBarFill, { width: `${progress.progress * 100}%` }]} />
              </View>
              <Text style={styles.expText}>
                {progress.current} / {progress.needed} EXP
              </Text>
            </View>
          </View>

          <Text style={styles.progressCount}>
            {completedCount} / {DAILY_GOAL_COUNT} 완료
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
              <Text style={styles.streakText}>연속 {goalStreak}일 달성</Text>
            </View>
          )}
        </View>

        {/* 목표 목록 */}
        <Text style={styles.sectionTitle}>목표 목록</Text>
        <View style={styles.goalList}>
          {goals.map((goal, idx) => {
            const config = getContentConfig(goal.category);
            const colors = CATEGORY_COLORS[goal.category];

            return (
              <TouchableOpacity
                key={`${goal.category}-${idx}`}
                style={[
                  styles.goalItem,
                  goal.completed && styles.goalItemDone,
                ]}
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
                    <Text style={[
                      styles.goalName,
                      goal.completed && { color: COLORS.slate400, textDecorationLine: 'line-through' },
                    ]}>
                      {config.name}
                    </Text>
                    <Text style={styles.goalDesc}>{config.description}</Text>
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
          <Text style={styles.tipText}>
            각 카테고리를 1회 이상 연습하면 목표가 완료됩니다.{'\n'}
            매일 꾸준히 달성하면 연속 달성일이 늘어납니다!
          </Text>
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
});
