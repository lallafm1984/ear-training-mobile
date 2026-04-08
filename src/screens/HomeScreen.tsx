// ─────────────────────────────────────────────────────────────
// HomeScreen — 카드형 대시보드 메인 화면
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserCircle, Flame, CheckCircle, Target, Crown, BarChart3, Trophy } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../context';
import { useSubscription } from '../context';
import { useSkillProfile } from '../hooks';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useMascotExp } from '../hooks/useMascotExp';
import { COLORS } from '../theme/colors';
import { CONTENT_CATEGORIES, getContentConfig } from '../lib/contentConfig';
import type { ContentCategory } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

import CategoryCard from '../components/CategoryCard';
import RecentActivityList from '../components/RecentActivityList';
import MascotCharacter from '../components/MascotCharacter';

type NavProp = StackNavigationProp<MainStackParamList>;

const GOAL_CATEGORIES: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key'];
const DAILY_GOAL_COUNT = GOAL_CATEGORIES.length;


export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { profile } = useAuth();
  const { tier } = useSubscription();
  const { profile: skillProfile } = useSkillProfile();
  const { stats, loaded, reload } = usePracticeHistory();
  const { level: mascotLevel } = useMascotExp();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleCategoryPress = (category: ContentCategory) => {
    const config = getContentConfig(category);
    if (config.freeMaxLevel === 0 && tier === 'free') {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('CategoryPractice', { category });
  };

  // 오늘 연습한 목표 카테고리 수
  const todayGoalDone = useMemo(() => {
    const todayStr = new Date().toDateString();
    const cats = new Set<ContentCategory>();
    stats.recentRecords.forEach(r => {
      if (new Date(r.practicedAt).toDateString() === todayStr && GOAL_CATEGORIES.includes(r.contentType)) {
        cats.add(r.contentType);
      }
    });
    return cats.size;
  }, [stats.recentRecords]);

  const handleDailyGoal = () => {
    navigation.navigate('DailyGoal');
  };

  const dailyDone = todayGoalDone >= DAILY_GOAL_COUNT;

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary500} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 마스코트 인사 */}
        <View style={styles.mascotCard}>
          <MascotCharacter size={80} level={mascotLevel} happy={dailyDone} />
          <View style={styles.mascotTextArea}>
            <Text style={styles.mascotTitle}>
              {dailyDone ? '오늘도 잘 했어요!' : '오늘도 연습해 볼까요?'}
            </Text>
            <Text style={styles.mascotDesc}>
              {dailyDone
                ? '모든 목표를 달성했어요. 대단해요!'
                : `오늘의 목표 ${todayGoalDone}/${DAILY_GOAL_COUNT} 진행 중`}
            </Text>
          </View>
        </View>

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
              ? <Trophy size={24} color="#f59e0b" />
              : <Flame size={24} color="#ea580c" />}
            <Text style={[styles.actionTitle, { color: dailyDone ? '#065f46' : '#9a3412' }]}>
              {dailyDone ? '달성 완료!' : '일일 목표'}
            </Text>
            <Text style={styles.actionDesc}>
              {todayGoalDone}/{DAILY_GOAL_COUNT} 완료
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
  mascotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  mascotTextArea: {
    flex: 1,
    gap: 4,
  },
  mascotTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#312e81',
  },
  mascotDesc: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
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
