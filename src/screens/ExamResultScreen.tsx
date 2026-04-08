// ─────────────────────────────────────────────────────────────
// ExamResultScreen — 모의시험 결과 화면
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RotateCcw, Home, Trophy, TrendingUp,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig } from '../lib/contentConfig';
import type { ContentCategory } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

type RouteProp = StackScreenProps<MainStackParamList, 'ExamResult'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

export default function ExamResultScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const savedRef = useRef(false);
  const {
    presetId,
    title,
    totalScore,
    maxScore,
    categoryScores: categoryScoresStr,
    elapsedSeconds,
    totalQuestions,
  } = route.params;

  const categoryScores: Record<string, { score: number; max: number; count: number }> =
    JSON.parse(categoryScoresStr);


  // AsyncStorage에 시험 결과 저장 (1회)
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    const record = {
      id: `es_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      preset_id: presetId,
      title,
      total_score: totalScore,
      max_score: maxScore,
      total_questions: totalQuestions,
      elapsed_seconds: elapsedSeconds,
      category_scores: categoryScores,
      completed_at: new Date().toISOString(),
    };

    AsyncStorage.getItem('@melodygen_exam_sessions').then(raw => {
      const existing = raw ? JSON.parse(raw) : [];
      const updated = [record, ...existing].slice(0, 50);
      AsyncStorage.setItem('@melodygen_exam_sessions', JSON.stringify(updated));
    });
  }, []);

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: 'A+', color: '#10b981', message: '탁월한 실력입니다!' };
    if (pct >= 80) return { label: 'A', color: '#10b981', message: '훌륭해요!' };
    if (pct >= 70) return { label: 'B+', color: '#3b82f6', message: '잘 하고 있어요!' };
    if (pct >= 60) return { label: 'B', color: '#3b82f6', message: '조금 더 연습하면 좋겠어요' };
    if (pct >= 50) return { label: 'C', color: COLORS.amber500, message: '꾸준히 연습해 보세요' };
    return { label: 'D', color: '#ef4444', message: '기초부터 다시 연습해 보세요' };
  };

  const grade = getGrade(percentage);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 결과 헤더 */}
        <View style={styles.resultHeader}>
          <Trophy size={32} color={COLORS.amber500} />
          <Text style={styles.resultTitle}>시험 완료!</Text>
          <Text style={styles.examTitle}>{title}</Text>
        </View>

        {/* 점수 원형 */}
        <View style={[styles.scoreCircle, { borderColor: grade.color }]}>
          <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
          <Text style={[styles.scorePercent, { color: grade.color }]}>{percentage}점</Text>
          <Text style={styles.scoreFraction}>만점 100점</Text>
        </View>

        <Text style={[styles.gradeMessage, { color: grade.color }]}>{grade.message}</Text>

        {/* 통계 요약 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalQuestions}문항</Text>
            <Text style={styles.statLabel}>전체 문항</Text>
          </View>
          <View style={[styles.statItem, styles.statBorder]}>
            <Text style={styles.statValue}>{percentage}%</Text>
            <Text style={styles.statLabel}>정답률</Text>
          </View>
        </View>

        {/* 카테고리별 결과 */}
        <Text style={styles.sectionTitle}>카테고리별 결과</Text>

        <View style={styles.categoryResults}>
          {Object.entries(categoryScores).map(([cat, data]) => {
            const catConfig = getContentConfig(cat as ContentCategory);
            const colors = CATEGORY_COLORS[cat as ContentCategory];
            const catPct = data.max > 0 ? Math.round((data.score / data.max) * 100) : 0;

            return (
              <View key={cat} style={styles.catRow}>
                <View style={styles.catLeft}>
                  <View style={[styles.catDot, { backgroundColor: colors.main }]} />
                  <View>
                    <Text style={styles.catName}>{catConfig.name}</Text>
                    <Text style={styles.catCount}>{data.count}문항</Text>
                  </View>
                </View>

                <View style={styles.catRight}>
                  <View style={styles.catBarBg}>
                    <View
                      style={[
                        styles.catBarFill,
                        { width: `${catPct}%`, backgroundColor: colors.main },
                      ]}
                    />
                  </View>
                  <Text style={[styles.catScore, { color: colors.main }]}>
                    {Math.round(data.score)}/{Math.round(data.max)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 개선 팁 */}
        {percentage < 80 && (
          <View style={styles.tipCard}>
            <TrendingUp size={18} color={COLORS.primary500} />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>학습 팁</Text>
              <Text style={styles.tipText}>
                {(() => {
                  const weakest = Object.entries(categoryScores)
                    .sort(([, a], [, b]) => {
                      const diff = (a.score / a.max) - (b.score / b.max);
                      if (diff !== 0) return diff;
                      return b.count - a.count; // 동점이면 문항 수가 많은 것 우선
                    })[0];
                  if (!weakest) return '꾸준히 연습하세요!';
                  const catName = getContentConfig(weakest[0] as ContentCategory).name;
                  return `${catName} 영역을 집중적으로 연습해 보세요. 카테고리별 연습에서 해당 영역을 선택할 수 있습니다.`;
                })()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 하단 액션 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.amber500 }]}
          onPress={() => navigation.replace('MockExamSetup')}
        >
          <RotateCcw size={18} color="#fff" />
          <Text style={styles.actionBtnText}>다시 시험보기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.slate200 }]}
          onPress={() => navigation.navigate('Home')}
        >
          <Home size={18} color={COLORS.slate700} />
          <Text style={[styles.actionBtnText, { color: COLORS.slate700 }]}>홈으로</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 20,
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.slate800,
    marginTop: 4,
  },
  examTitle: {
    fontSize: 14,
    color: COLORS.slate500,
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  gradeLabel: {
    fontSize: 28,
    fontWeight: '900',
  },
  scorePercent: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  scoreFraction: {
    fontSize: 13,
    color: COLORS.slate400,
    fontWeight: '600',
  },
  gradeMessage: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  // 통계
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.slate100,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.slate400,
    marginTop: 2,
  },
  // 카테고리별
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
    alignSelf: 'flex-start',
  },
  categoryResults: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
  catCount: {
    fontSize: 11,
    color: COLORS.slate400,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end',
  },
  catBarBg: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.slate100,
    overflow: 'hidden',
  },
  catBarFill: {
    height: 6,
    borderRadius: 3,
  },
  catScore: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  // 팁
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    width: '100%',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary700,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: COLORS.slate600,
    lineHeight: 18,
  },
  // 하단
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
