// ─────────────────────────────────────────────────────────────
// StatsScreen — 학습 통계 및 진도 대시보드
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, TrendingUp, Calendar, Target, Award,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { CONTENT_CATEGORIES, getContentConfig } from '../lib/contentConfig';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useSkillProfile } from '../hooks/useSkillProfile';
import { useAuth } from '../context';
import { supabase } from '../lib';
import type { ContentCategory } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;

interface ExamRecord {
  id: string;
  title: string;
  total_score: number;
  max_score: number;
  completed_at: string;
}

export default function StatsScreen() {
  const navigation = useNavigation<NavProp>();
  const { stats, loaded } = usePracticeHistory();
  const { profile: skillProfile } = useSkillProfile();
  const { session } = useAuth();

  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState(false);

  // 시험 기록 로드
  useEffect(() => {
    if (!session?.user?.id) return;
    setExamLoading(true);
    setExamError(false);
    supabase
      .from('exam_sessions')
      .select('id, title, total_score, max_score, completed_at')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) {
          console.warn('[StatsScreen] 시험 기록 로드 실패:', error.message);
          setExamError(true);
        } else if (data) {
          setExamRecords(data as ExamRecord[]);
        }
        setExamLoading(false);
      });
  }, [session?.user?.id]);

  const maxCategoryCount = Math.max(
    ...Object.values(stats.totalByCategory),
    1,
  );

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary500} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.primary500} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>학습 통계</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 요약 카드 */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Calendar size={20} color={COLORS.primary500} />
            <Text style={styles.summaryValue}>{skillProfile.streakDays}</Text>
            <Text style={styles.summaryLabel}>연속 학습일</Text>
          </View>
          <View style={styles.summaryCard}>
            <Target size={20} color={COLORS.amber500} />
            <Text style={styles.summaryValue}>{stats.totalSessions}</Text>
            <Text style={styles.summaryLabel}>총 연습 횟수</Text>
          </View>
          <View style={styles.summaryCard}>
            <TrendingUp size={20} color={COLORS.success} />
            <Text style={styles.summaryValue}>{stats.weeklyCount}</Text>
            <Text style={styles.summaryLabel}>이번 주</Text>
          </View>
        </View>

        {/* 빈 상태 안내 */}
        {stats.totalSessions === 0 && (
          <View style={styles.emptyCard}>
            <Target size={32} color={COLORS.slate300} />
            <Text style={styles.emptyTitle}>아직 연습 기록이 없어요</Text>
            <Text style={styles.emptyDesc}>연습을 시작하면 여기서 통계를 확인할 수 있습니다</Text>
          </View>
        )}

        {/* 카테고리별 진도 */}
        <Text style={styles.sectionTitle}>카테고리별 진도</Text>
        <View style={styles.progressCard}>
          {CONTENT_CATEGORIES.map(cat => {
            const colors = CATEGORY_COLORS[cat.id];
            const count = stats.totalByCategory[cat.id] || 0;
            const avgRating = stats.avgRatingByCategory[cat.id] || 0;
            const barWidth = maxCategoryCount > 0
              ? Math.max((count / maxCategoryCount) * 100, 4)
              : 4;

            return (
              <View key={cat.id} style={styles.catRow}>
                <View style={styles.catLabel}>
                  <View style={[styles.catDot, { backgroundColor: colors.main }]} />
                  <Text style={styles.catName}>{cat.name}</Text>
                </View>

                <View style={styles.catBarArea}>
                  <View style={styles.catBarBg}>
                    <View style={[styles.catBarFill, { width: `${barWidth}%`, backgroundColor: colors.main }]} />
                  </View>
                  <View style={styles.catMeta}>
                    <Text style={styles.catCount}>{count}회</Text>
                    {avgRating > 0 && (
                      <Text style={[styles.catRating, { color: colors.main }]}>
                        평균 {avgRating}점
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* 월간 활동 */}
        <Text style={styles.sectionTitle}>활동 요약</Text>
        <View style={styles.activityCard}>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>이번 달 연습</Text>
            <Text style={styles.activityValue}>{stats.monthlyCount}회</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>이번 주 연습</Text>
            <Text style={styles.activityValue}>{stats.weeklyCount}회</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>연속 학습일</Text>
            <Text style={styles.activityValue}>{skillProfile.streakDays}일</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>현재 레벨</Text>
            <Text style={styles.activityValue}>{skillProfile.partPracticeLevel}단계</Text>
          </View>
        </View>

        {/* 시험 기록 */}
        {examLoading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={COLORS.primary500} />
            <Text style={{ fontSize: 13, color: COLORS.slate400, marginTop: 8 }}>시험 기록 로딩 중...</Text>
          </View>
        )}
        {examError && !examLoading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: COLORS.error }}>시험 기록을 불러올 수 없습니다</Text>
          </View>
        )}
        {!examLoading && !examError && examRecords.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>최근 모의시험</Text>
            <View style={styles.examCard}>
              {examRecords.map(exam => {
                const pct = exam.max_score > 0
                  ? Math.round((exam.total_score / exam.max_score) * 100)
                  : 0;
                const date = new Date(exam.completed_at);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

                return (
                  <View key={exam.id} style={styles.examRow}>
                    <View style={styles.examLeft}>
                      <Award size={16} color={COLORS.amber500} />
                      <View>
                        <Text style={styles.examTitle}>{exam.title}</Text>
                        <Text style={styles.examDate}>{dateStr}</Text>
                      </View>
                    </View>
                    <View style={styles.examRight}>
                      <Text style={[
                        styles.examScore,
                        { color: pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.amber600 : COLORS.error },
                      ]}>
                        {pct}%
                      </Text>
                      <Text style={styles.examFraction}>
                        {exam.total_score}/{exam.max_score}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
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
    color: COLORS.slate800,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 20,
  },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  // 카테고리 진도
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  catRow: {
    gap: 6,
  },
  catLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  catBarArea: {
    paddingLeft: 16,
    gap: 4,
  },
  catBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.slate100,
    overflow: 'hidden',
  },
  catBarFill: {
    height: 8,
    borderRadius: 4,
  },
  catMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  catCount: {
    fontSize: 11,
    color: COLORS.slate400,
    fontWeight: '500',
  },
  catRating: {
    fontSize: 11,
    fontWeight: '600',
  },
  // 활동 요약
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityLabel: {
    fontSize: 13,
    color: COLORS.slate500,
  },
  activityValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate700,
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
    fontSize: 16,
    fontWeight: '800',
  },
  examFraction: {
    fontSize: 11,
    color: COLORS.slate400,
  },
});
