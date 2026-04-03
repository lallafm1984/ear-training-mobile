// ─────────────────────────────────────────────────────────────
// HomeScreen — 카드형 대시보드 메인 화면
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserCircle, BookOpen, Target, Crown, BarChart3 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../context';
import { useSubscription } from '../context';
import { useSkillProfile } from '../hooks';
import { COLORS } from '../theme/colors';
import { CONTENT_CATEGORIES, getContentConfig, getDifficultyList } from '../lib/contentConfig';
import type { ContentCategory, PracticeRecord, ContentDifficulty } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';

import CategoryCard from '../components/CategoryCard';
import QuickStartCard from '../components/QuickStartCard';
import RecentActivityList from '../components/RecentActivityList';

const RECENT_KEY = '@melodygen_recent_activity';

type NavProp = StackNavigationProp<MainStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { profile } = useAuth();
  const { tier } = useSubscription();
  const { profile: skillProfile } = useSkillProfile();

  const [recentRecords, setRecentRecords] = useState<PracticeRecord[]>([]);

  // 최근 기록 로드
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then(raw => {
      if (raw) {
        try { setRecentRecords(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  // 추천 카테고리 결정 (기본 melody)
  const recommendedCategory: ContentCategory = 'melody';
  const recommendedDifficulty: ContentDifficulty =
    getDifficultyList(recommendedCategory)[
      Math.min(skillProfile.partPracticeLevel - 1, getDifficultyList(recommendedCategory).length - 1)
    ];

  const handleCategoryPress = (category: ContentCategory) => {
    const config = getContentConfig(category);
    if (config.freeMaxLevel === 0 && tier === 'free') {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('CategoryPractice', { category });
  };

  const handleQuickStart = () => {
    navigation.navigate('CategoryPractice', { category: recommendedCategory });
  };

  const handlePractice = () => {
    navigation.navigate('ScoreEditor', undefined);
  };

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
          category={recommendedCategory}
          difficulty={recommendedDifficulty}
          streakDays={skillProfile.streakDays}
          onPress={handleQuickStart}
        />

        {/* 메인 액션 카드 */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}
            onPress={handlePractice}
            activeOpacity={0.7}
          >
            <BookOpen size={24} color={COLORS.primary500} />
            <Text style={[styles.actionTitle, { color: COLORS.primary700 }]}>연습하기</Text>
            <Text style={styles.actionDesc}>자유롭게 연습</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
            onPress={() => {
              navigation.navigate('MockExamSetup');
            }}
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
              />
            ))}
          </View>
        </View>

        {/* 최근 연습 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 연습</Text>
          <RecentActivityList records={recentRecords} />
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
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionDesc: {
    fontSize: 11,
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
