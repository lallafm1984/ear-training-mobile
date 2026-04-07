// ─────────────────────────────────────────────────────────────
// HomeScreen — 카드형 대시보드 메인 화면
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserCircle, Flame, CheckCircle, Target, Crown, BarChart3 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../context';
import { useSubscription } from '../context';
import { useSkillProfile } from '../hooks';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { COLORS } from '../theme/colors';
import { CONTENT_CATEGORIES, getContentConfig, getDifficultyList } from '../lib/contentConfig';
import type { ContentCategory, ContentDifficulty } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

import CategoryCard from '../components/CategoryCard';
import QuickStartCard from '../components/QuickStartCard';
import RecentActivityList from '../components/RecentActivityList';

type NavProp = StackNavigationProp<MainStackParamList>;

const DAILY_GOAL_FREE = 2;
const DAILY_GOAL_PRO = 5;

/** 연습 기록 기반 가장 약한 카테고리 추천 */
function getSmartRecommendation(
  stats: { totalByCategory: Record<ContentCategory, number>; avgRatingByCategory: Record<ContentCategory, number> },
  partPracticeLevel: number,
): { category: ContentCategory; difficulty: ContentDifficulty } {
  const candidates: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key'];

  // 연습 횟수가 가장 적은 카테고리, 동률이면 평균 점수가 낮은 카테고리
  const sorted = [...candidates].sort((a, b) => {
    const countDiff = (stats.totalByCategory[a] || 0) - (stats.totalByCategory[b] || 0);
    if (countDiff !== 0) return countDiff;
    return (stats.avgRatingByCategory[a] || 0) - (stats.avgRatingByCategory[b] || 0);
  });

  const category = sorted[0];
  const difficulties = getDifficultyList(category);

  // 카테고리별 적절한 난이도 결정
  let levelIndex: number;
  if (category === 'melody') {
    levelIndex = Math.min(partPracticeLevel - 1, difficulties.length - 1);
  } else {
    // 평균 점수 기반: 3점 이상이면 다음 레벨
    const avg = stats.avgRatingByCategory[category] || 0;
    const count = stats.totalByCategory[category] || 0;
    if (count === 0) {
      levelIndex = 0;
    } else if (avg >= 4) {
      levelIndex = Math.min(Math.floor(count / 5), difficulties.length - 1);
    } else {
      levelIndex = Math.min(Math.floor(count / 8), difficulties.length - 1);
    }
  }

  return {
    category,
    difficulty: difficulties[Math.max(0, levelIndex)],
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { profile } = useAuth();
  const { tier } = useSubscription();
  const { profile: skillProfile } = useSkillProfile();
  const { stats, loaded } = usePracticeHistory();

  // 스마트 추천
  const recommendation = useMemo(
    () => getSmartRecommendation(stats, skillProfile.partPracticeLevel),
    [stats, skillProfile.partPracticeLevel],
  );

  const handleCategoryPress = (category: ContentCategory) => {
    const config = getContentConfig(category);
    if (config.freeMaxLevel === 0 && tier === 'free') {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('CategoryPractice', { category });
  };

  const handleQuickStart = () => {
    navigation.navigate('CategoryPractice', { category: recommendation.category });
  };

  const dailyGoal = tier === 'pro' ? DAILY_GOAL_PRO : DAILY_GOAL_FREE;

  const handleDailyGoal = () => {
    navigation.navigate('CategoryPractice', { category: recommendation.category });
  };

  const dailyDone = stats.dailyCount >= dailyGoal;

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
      <View style={[styles.header, { paddingTop: 4 }]}>
        <View>
          <Text style={styles.appName}>MelodyGen</Text>
          <Text style={styles.greeting}>
            안녕하세요, {profile?.display_name ?? '학생'}님
          </Text>
        </View>
        <View style={styles.headerRight}>
          {tier === 'pro' && (
            <View style={styles.proBadge}>
              <Crown size={12} color={COLORS.primary500} />
              <Text style={styles.proText}>Pro</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            hitSlop={8}
          >
            <UserCircle size={32} color={COLORS.slate500} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 빠른 시작 */}
        <QuickStartCard
          category={recommendation.category}
          difficulty={recommendation.difficulty}
          streakDays={skillProfile.streakDays}
          onPress={handleQuickStart}
        />

        {/* 메인 액션 카드 */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionCard,
              dailyDone
                ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }
                : { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
            ]}
            onPress={handleDailyGoal}
            activeOpacity={0.7}
          >
            {dailyDone
              ? <CheckCircle size={24} color={COLORS.success} />
              : <Flame size={24} color="#ea580c" />}
            <Text style={[styles.actionTitle, { color: dailyDone ? '#065f46' : '#9a3412' }]}>
              일일 목표
            </Text>
            <Text style={styles.actionDesc}>
              {stats.dailyCount}/{dailyGoal} 완료
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
            onPress={() => navigation.navigate('MockExamSetup')}
            activeOpacity={0.7}
          >
            <Target size={24} color={COLORS.amber600} />
            <Text style={[styles.actionTitle, { color: COLORS.amber800 }]}>모의시험</Text>
            <Text style={styles.actionDesc}>실전 연습</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.7}
          >
            <BarChart3 size={24} color={COLORS.success} />
            <Text style={[styles.actionTitle, { color: '#065f46' }]}>통계</Text>
            <Text style={styles.actionDesc}>학습 진도</Text>
          </TouchableOpacity>
        </View>

        {/* 청음 훈련 유형 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>청음 훈련 유형</Text>
          <View style={styles.categoryGrid}>
            {CONTENT_CATEGORIES.map((config) => (
              <CategoryCard
                key={config.id}
                config={config}
                onPress={() => handleCategoryPress(config.id)}
                locked={config.freeMaxLevel === 0 && tier === 'free'}
                practiceCount={stats.totalByCategory[config.id] || 0}
              />
            ))}
          </View>
        </View>

        {/* 최근 연습 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 연습</Text>
          <RecentActivityList records={stats.recentRecords} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary500,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.slate500,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  proText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary500,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionDesc: {
    fontSize: 10,
    color: COLORS.slate500,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
