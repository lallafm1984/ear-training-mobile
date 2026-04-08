// ─────────────────────────────────────────────────────────────
// MockExamSetupScreen — 모의시험 설정 및 프리셋 선택
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Play, GraduationCap, BookOpen, Trophy,
  ArrowUpDown, Layers, Crown, Lock,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useSubscription } from '../context';
import { COLORS } from '../theme/colors';
import { EXAM_PRESETS } from '../lib/examPresets';
import { getContentConfig } from '../lib/contentConfig';
import type { ExamPreset } from '../types/exam';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  GraduationCap,
  BookOpen,
  Trophy,
  ArrowUpDown,
  Layers,
};

export default function MockExamSetupScreen() {
  const { t } = useTranslation(['exam', 'content', 'common']);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { tier } = useSubscription();
  const [selectedPreset, setSelectedPreset] = useState<ExamPreset | null>(null);

  const handleStart = () => {
    if (!selectedPreset) return;

    // free 유저는 기초 종합만 사용 가능
    if (tier === 'free' && selectedPreset.id !== 'basic') {
      navigation.navigate('Paywall');
      return;
    }

    navigation.navigate('MockExam', { presetId: selectedPreset.id });
  };

  const totalQuestions = selectedPreset
    ? selectedPreset.sections.reduce((sum, s) => sum + s.questionCount, 0)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.amber700} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('exam:setup.title')}</Text>
          <Text style={styles.headerDesc}>{t('exam:setup.headerDesc')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 프리셋 목록 */}
        <Text style={styles.sectionTitle}>{t('exam:setup.examType')}</Text>

        <View style={styles.presetList}>
          {EXAM_PRESETS.map(preset => {
            const active = selectedPreset?.id === preset.id;
            const IconComp = ICON_MAP[preset.icon] ?? GraduationCap;
            const isLocked = tier === 'free' && preset.id !== 'basic';
            const qCount = preset.sections.reduce((s, sec) => s + sec.questionCount, 0);

            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  active && !isLocked && styles.presetCardActive,
                  isLocked && styles.presetCardLocked,
                ]}
                onPress={() => isLocked ? navigation.navigate('Paywall') : setSelectedPreset(preset)}
                activeOpacity={isLocked ? 1 : 0.7}
              >
                <View style={styles.presetHeader}>
                  <View style={[
                    styles.presetIcon,
                    isLocked
                      ? { backgroundColor: '#b0bccc' }
                      : active ? { backgroundColor: COLORS.amber500 } : { backgroundColor: COLORS.amber50 },
                  ]}>
                    <IconComp size={20} color={isLocked ? '#6b7a8d' : active ? '#fff' : COLORS.amber600} />
                  </View>
                  <View style={styles.presetInfo}>
                    <View style={styles.presetNameRow}>
                      <Text style={[styles.presetName, isLocked && styles.presetNameLocked, !isLocked && active && { color: COLORS.amber700 }]}>
                        {t(`exam:preset.${preset.id.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`)}
                      </Text>
                      {isLocked && (
                        <View style={styles.lockBadge}>
                          <Lock size={10} color={COLORS.slate600} />
                          <Text style={styles.lockBadgeText}>Pro</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.presetDesc, isLocked && { color: COLORS.slate400 }]}>
                      {t(`exam:preset.${preset.id.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}Desc`)}
                    </Text>
                  </View>
                </View>

                <View style={styles.presetMeta}>
                  <Text style={[styles.presetMetaText, isLocked && { color: COLORS.slate400 }]}>
                    {t('exam:setup.questionCount', { count: qCount })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 선택된 프리셋 상세 */}
        {selectedPreset && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{t('exam:setup.examComposition')}</Text>
            {selectedPreset.sections.map((section, idx) => {
              const catConfig = getContentConfig(section.contentType);
              return (
                <View key={idx} style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <Text style={styles.detailCat}>{t(`content:category.${section.contentType}.name`)}</Text>
                    <Text style={styles.detailDiff}>
                      {t('content:difficulty.' + section.contentType + '.' + section.difficulty)}
                    </Text>
                  </View>
                  <Text style={styles.detailCount}>{t('exam:setup.questionCount', { count: section.questionCount })}</Text>
                </View>
              );
            })}

            <View style={styles.detailSummary}>
              <Text style={styles.detailSummaryText}>
                {t('exam:setup.totalQuestions', { count: totalQuestions })} · {t('exam:setup.totalPoints', { points: 100 })}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 시작 버튼 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[
            styles.startBtn,
            { backgroundColor: selectedPreset ? COLORS.amber500 : COLORS.slate300 },
          ]}
          onPress={handleStart}
          disabled={!selectedPreset}
          activeOpacity={0.8}
        >
          <Play size={20} color="#fff" fill="#fff" />
          <Text style={styles.startText}>
            {selectedPreset
              ? t('exam:setup.startExam', { count: totalQuestions })
              : t('exam:setup.selectPreset')}
          </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fffbeb',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.amber700,
  },
  headerDesc: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  presetList: {
    gap: 10,
  },
  presetCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    gap: 10,
  },
  presetCardActive: {
    borderColor: COLORS.amber500,
    backgroundColor: '#fffbeb',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetInfo: {
    flex: 1,
  },
  presetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate700,
  },
  presetDesc: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 2,
  },
  presetCardLocked: {
    backgroundColor: '#dde3ed',
    borderColor: '#94a3b8',
    borderStyle: 'dashed',
  },
  presetNameLocked: {
    color: COLORS.slate500,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#64748b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  presetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 52,
  },
  presetMetaText: {
    fontSize: 12,
    color: COLORS.slate400,
    fontWeight: '500',
  },
  presetMetaDot: {
    fontSize: 12,
    color: COLORS.slate300,
  },
  // 상세
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate800,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLeft: {
    flex: 1,
  },
  detailCat: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  detailDiff: {
    fontSize: 11,
    color: COLORS.slate400,
    marginTop: 1,
  },
  detailCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.amber700,
  },
  detailSummary: {
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
    paddingTop: 10,
    alignItems: 'center',
  },
  detailSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate600,
  },
  // 하단
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
