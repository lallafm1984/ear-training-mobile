// ─────────────────────────────────────────────────────────────
// BeginnerCourseScreen — 귀 열기 7일 코스 (레슨 목록)
// ─────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Lock, Play, RotateCcw, Sparkles } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme/colors';
import {
  BEGINNER_LESSONS,
  BEGINNER_LESSON_EXP,
  isBeginnerLessonUnlocked,
} from '../lib/beginnerCourse';
import { useBeginnerCourseProgress } from '../hooks/useBeginnerCourseProgress';
import MascotCharacter from '../components/MascotCharacter';
import BeginnerLessonIcon from '../components/BeginnerLessonIcon';
import { useMascotExp } from '../hooks/useMascotExp';
import type { MainStackParamList } from '../navigation/MainStack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type NavProp = StackNavigationProp<MainStackParamList>;

export default function BeginnerCourseScreen() {
  const layout = useResponsiveLayout();
  const { t } = useTranslation(['beginner', 'common']);
  const navigation = useNavigation<NavProp>();
  const { progress, loaded, nextLessonId, isComplete, reload } = useBeginnerCourseProgress();
  const { level: mascotLevel } = useMascotExp();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const doneCount = progress.completedLessonIds.length;
  const total = BEGINNER_LESSONS.length;
  const progressRatio = total > 0 ? doneCount / total : 0;

  const openLesson = (lessonId: string) => {
    navigation.navigate('BeginnerLesson', { lessonId });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.primary600} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('beginner:course.title')}</Text>
          <Text style={styles.headerDesc}>{t('beginner:course.subtitle')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* 진행 카드 */}
        <View style={styles.heroCard}>
          <MascotCharacter size={72} level={mascotLevel} happy={isComplete} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.heroTitle}>
              {isComplete
                ? t('beginner:course.completeTitle')
                : t('beginner:course.progress', { done: doneCount, total })}
            </Text>
            {isComplete ? (
              <Text style={styles.heroDesc}>{t('beginner:course.completeDesc')}</Text>
            ) : (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
            )}
          </View>
        </View>

        {isComplete && (
          <TouchableOpacity
            style={styles.goCategoriesBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
          >
            <Sparkles size={16} color="#fff" />
            <Text style={styles.goCategoriesText}>{t('beginner:course.goCategories')}</Text>
          </TouchableOpacity>
        )}

        {/* 레슨 목록 */}
        <View style={styles.list}>
          {BEGINNER_LESSONS.map((lesson) => {
            const done = progress.completedLessonIds.includes(lesson.id);
            const unlocked = loaded && isBeginnerLessonUnlocked(progress, lesson.id);
            const isNext = lesson.id === nextLessonId;
            const result = progress.lessonResults[lesson.id];

            return (
              <TouchableOpacity
                key={lesson.id}
                style={[
                  styles.lessonCard,
                  isNext && { borderColor: lesson.color, backgroundColor: lesson.bgColor },
                  !unlocked && styles.lessonCardLocked,
                ]}
                onPress={() => openLesson(lesson.id)}
                disabled={!unlocked}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: unlocked ? lesson.bgColor : COLORS.slate100 },
                  ]}
                >
                  {unlocked ? (
                    <BeginnerLessonIcon lesson={lesson} />
                  ) : (
                    <Lock size={20} color={COLORS.slate400} />
                  )}
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.lessonTopRow}>
                    <Text style={[styles.dayLabel, unlocked && { color: lesson.color }]}>
                      {t('beginner:course.dayLabel', { day: lesson.day })}
                    </Text>
                    {isNext && (
                      <View style={[styles.todayChip, { backgroundColor: lesson.color }]}>
                        <Text style={styles.todayChipText}>{t('beginner:course.todayLesson')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.lessonTitle, !unlocked && { color: COLORS.slate400 }]}>
                    {t(`beginner:lessons.${lesson.id}.title`)}
                  </Text>
                  <Text style={styles.lessonDesc}>
                    {!unlocked
                      ? t('beginner:course.locked')
                      : done && result
                        ? t('beginner:course.result', {
                            correct: result.correct,
                            total: result.total,
                          })
                        : t(`beginner:lessons.${lesson.id}.desc`)}
                  </Text>
                </View>

                <View style={styles.rightArea}>
                  {done ? (
                    <View style={styles.doneBadge}>
                      <Check size={14} color="#fff" />
                    </View>
                  ) : unlocked ? (
                    <View style={[styles.startBadge, { backgroundColor: lesson.color }]}>
                      <Play size={14} color="#fff" fill="#fff" />
                    </View>
                  ) : null}
                  {done && <RotateCcw size={12} color={COLORS.slate400} />}
                  {!done && unlocked && (
                    <Text style={[styles.expText, { color: lesson.color }]}>
                      {t('beginner:course.exp', { exp: BEGINNER_LESSON_EXP })}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: COLORS.primary50,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.primary700 },
  headerDesc: { fontSize: 12, color: COLORS.slate500, marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  heroTitle: { fontSize: 16, fontWeight: '800', color: COLORS.slate800 },
  heroDesc: { fontSize: 12, color: COLORS.slate500, lineHeight: 18 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.slate100,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary500, borderRadius: 4 },
  goCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary500,
    borderRadius: 14,
    paddingVertical: 14,
  },
  goCategoriesText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  list: { gap: 10 },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
  },
  lessonCardLocked: { backgroundColor: COLORS.slate50 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 11, fontWeight: '800', color: COLORS.slate400 },
  todayChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  todayChipText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  lessonTitle: { fontSize: 15, fontWeight: '800', color: COLORS.slate800 },
  lessonDesc: { fontSize: 11, color: COLORS.slate500 },
  rightArea: { alignItems: 'center', gap: 4, minWidth: 44 },
  doneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expText: { fontSize: 10, fontWeight: '800' },
});
