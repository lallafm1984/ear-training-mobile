// ─────────────────────────────────────────────────────────────
// HomeScreen — 카드형 대시보드 메인 화면
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  UserCircle,
  Flame,
  Target,
  Crown,
  BarChart3,
  Trophy,
  LogIn,
  Ear,
  Gauge,
  ChevronRight,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context';
import { useSubscription } from '../context';
import { useSkillProfile } from '../hooks';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import { useMascotExp } from '../hooks/useMascotExp';
import { useBeginnerCourseProgress } from '../hooks/useBeginnerCourseProgress';
import { BEGINNER_LESSONS, getBeginnerLesson } from '../lib/beginnerCourse';
import { useLevelTestResult } from '../hooks/useLevelTestResult';
import { COLORS } from '../theme/colors';
import { CONTENT_CATEGORIES, getContentConfig } from '../lib/contentConfig';
import type { ContentCategory } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';
import CategoryCard from '../components/CategoryCard';
import RecentActivityList from '../components/RecentActivityList';
import MascotCharacter from '../components/MascotCharacter';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type NavProp = StackNavigationProp<MainStackParamList>;

const GOAL_CATEGORIES: ContentCategory[] = [
  'melody',
  'barMelody',
  'rhythm',
  'interval',
  'chord',
  'progression',
  'key',
];
const DAILY_GOAL_COUNT = GOAL_CATEGORIES.length;

export default function HomeScreen() {
  const layout = useResponsiveLayout();
  const { t } = useTranslation(['home', 'common', 'beginner', 'levelTest', 'mascot']);
  const navigation = useNavigation<NavProp>();
  const { profile, isGuest, exitGuestMode } = useAuth();
  const { tier } = useSubscription();
  const { profile: _skillProfile } = useSkillProfile();
  const { stats, loaded, reload } = usePracticeHistory();
  const { level: mascotLevel } = useMascotExp();
  const {
    progress: courseProgress,
    nextLessonId,
    isComplete: courseComplete,
    reload: reloadCourse,
  } = useBeginnerCourseProgress();
  const nextLesson = nextLessonId ? getBeginnerLesson(nextLessonId) : undefined;
  const { result: levelTest, reload: reloadLevelTest } = useLevelTestResult();

  useFocusEffect(
    useCallback(() => {
      reload();
      void reloadCourse();
      void reloadLevelTest();
    }, [reload, reloadCourse, reloadLevelTest]),
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
    stats.recentRecords.forEach((r) => {
      if (
        new Date(r.practicedAt).toDateString() === todayStr &&
        GOAL_CATEGORIES.includes(r.contentType)
      ) {
        cats.add(r.contentType);
      }
    });
    return cats.size;
  }, [stats.recentRecords]);

  const handleDailyGoal = () => {
    navigation.navigate('DailyGoal');
  };

  const dailyDone = todayGoalDone >= DAILY_GOAL_COUNT;
  const displayName = profile?.display_name ?? t('home:greeting.defaultUser');

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
      <View style={[styles.header, { paddingTop: 4 }]}>
        <View>
          <Text style={styles.appName}>MelodyGen</Text>
          <Text style={styles.greeting}>{t('home:greeting.hello', { name: displayName })}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.tierBadge,
              tier === 'pro'
                ? { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }
                : { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
            ]}
            onPress={() => navigation.navigate('Paywall')}
            activeOpacity={0.7}
          >
            <Crown size={12} color={tier === 'pro' ? COLORS.primary500 : COLORS.slate400} />
            <Text
              style={[
                styles.tierText,
                { color: tier === 'pro' ? COLORS.primary500 : COLORS.slate500 },
              ]}
            >
              {tier === 'pro' ? 'Pro' : 'Free'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} hitSlop={8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <UserCircle size={32} color={COLORS.slate500} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* 마스코트 인사 → 탭하면 갤러리 */}
        <TouchableOpacity
          style={styles.mascotCard}
          onPress={() => navigation.navigate('MascotGallery')}
          activeOpacity={0.85}
        >
          <MascotCharacter size={80} level={mascotLevel} happy={dailyDone} />
          <View style={styles.mascotTextArea}>
            <Text style={styles.mascotTitle}>
              {dailyDone ? t('home:greeting.allDone') : t('home:greeting.keepGoing')}
            </Text>
            <Text style={styles.mascotDesc}>
              {dailyDone
                ? t('home:greeting.allDoneDesc')
                : t('home:greeting.goalProgress', { done: todayGoalDone, total: DAILY_GOAL_COUNT })}
            </Text>
            <View style={styles.mascotLinkRow}>
              <Text style={styles.mascotLink}>
                Lv.{mascotLevel} · {t('mascot:gallery.open')}
              </Text>
              <ChevronRight size={14} color={COLORS.primary500} />
            </View>
          </View>
        </TouchableOpacity>

        {/* 게스트 안내 */}
        {isGuest && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={() => void exitGuestMode()}
            activeOpacity={0.8}
          >
            <View style={styles.guestBannerIcon}>
              <LogIn size={16} color={COLORS.primary500} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestBannerTitle}>{t('home:guestBanner.title')}</Text>
              <Text style={styles.guestBannerDesc}>{t('home:guestBanner.desc')}</Text>
            </View>
            <Text style={styles.guestBannerBtn}>{t('home:guestBanner.button')}</Text>
          </TouchableOpacity>
        )}

        {/* 시작 도우미: 귀 열기 코스 + 레벨 테스트 */}
        <View style={styles.starterRow}>
          <TouchableOpacity
            style={[
              styles.starterCard,
              courseComplete && { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
            ]}
            onPress={() => navigation.navigate('BeginnerCourse')}
            activeOpacity={0.8}
          >
            <View style={[styles.starterIcon, courseComplete && { backgroundColor: '#d1fae5' }]}>
              <Ear size={18} color={courseComplete ? '#047857' : COLORS.primary600} />
            </View>
            <Text style={styles.starterTitle} numberOfLines={2}>
              {t('beginner:home.title')}
            </Text>
            <Text style={styles.starterDesc} numberOfLines={2}>
              {courseComplete
                ? t('beginner:home.done')
                : nextLesson && courseProgress.completedLessonIds.length > 0
                  ? t('beginner:home.inProgress', {
                      day: nextLesson.day,
                      done: courseProgress.completedLessonIds.length,
                      total: BEGINNER_LESSONS.length,
                    })
                  : t('beginner:home.desc')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.starterCard, { borderColor: '#fde68a', backgroundColor: '#fffbeb' }]}
            onPress={() => navigation.navigate('LevelTest')}
            activeOpacity={0.8}
          >
            <View style={[styles.starterIcon, { backgroundColor: '#fef3c7' }]}>
              <Gauge size={18} color={COLORS.amber600} />
            </View>
            <Text style={styles.starterTitle} numberOfLines={2}>
              {t('levelTest:home.title')}
            </Text>
            <Text style={styles.starterDesc} numberOfLines={2}>
              {levelTest
                ? t('levelTest:home.done', {
                    overall: t(`levelTest:result.overall.${levelTest.overall}`),
                  })
                : t('levelTest:home.desc')}
            </Text>
          </TouchableOpacity>
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
            {dailyDone ? <Trophy size={24} color="#f59e0b" /> : <Flame size={24} color="#ea580c" />}
            <Text style={[styles.actionTitle, { color: dailyDone ? '#065f46' : '#9a3412' }]}>
              {dailyDone ? t('home:action.dailyDone') : t('home:action.dailyGoal')}
            </Text>
            <Text style={styles.actionDesc}>
              {t('home:action.dailyProgress', { done: todayGoalDone, total: DAILY_GOAL_COUNT })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
            onPress={() => navigation.navigate('MockExamSetup')}
            activeOpacity={0.7}
          >
            <Target size={24} color={COLORS.amber600} />
            <Text style={[styles.actionTitle, { color: COLORS.amber800 }]}>
              {t('home:action.mockExam')}
            </Text>
            <Text style={styles.actionDesc}>{t('home:action.mockExamDesc')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.7}
          >
            <BarChart3 size={24} color={COLORS.success} />
            <Text style={[styles.actionTitle, { color: '#065f46' }]}>{t('home:action.stats')}</Text>
            <Text style={styles.actionDesc}>{t('home:action.statsDesc')}</Text>
          </TouchableOpacity>
        </View>

        {/* 청음 훈련 유형 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home:section.earTrainingTypes')}</Text>
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
          <Text style={styles.sectionTitle}>{t('home:section.recentPractice')}</Text>
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
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
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
  mascotLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  mascotLink: { fontSize: 11, color: COLORS.primary500, fontWeight: '800' },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  guestBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate800,
  },
  guestBannerDesc: {
    fontSize: 11,
    color: COLORS.slate500,
    marginTop: 2,
  },
  guestBannerBtn: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary500,
  },
  starterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  starterCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  starterIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  starterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  starterDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.slate500,
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
    textAlign: 'center',
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
