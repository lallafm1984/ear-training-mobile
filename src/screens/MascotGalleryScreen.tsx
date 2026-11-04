// ─────────────────────────────────────────────────────────────
// MascotGalleryScreen — 마스코트 컬렉션 (60레벨 · 10스테이지, 해금/잠금 표시)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme/colors';
import {
  LEVELS_PER_STAGE,
  MAX_MASCOT_LEVEL,
  STAGE_NAMES,
  getMascotParams,
  getMascotStageIndex,
} from '../lib/mascotConfig';
import { useMascotExp } from '../hooks/useMascotExp';
import MascotCharacter from '../components/MascotCharacter';
import type { MainStackParamList } from '../navigation/MainStack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type NavProp = StackNavigationProp<MainStackParamList>;

const ALL_LEVELS = Array.from({ length: MAX_MASCOT_LEVEL }, (_, i) => i + 1);

export default function MascotGalleryScreen() {
  const navigation = useNavigation<NavProp>();
  const { level: currentLevel, totalExp, progress } = useMascotExp();
  const layout = useResponsiveLayout();
  const { t } = useTranslation(['mascot', 'common']);

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
          <ArrowLeft size={24} color={COLORS.primary500} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('mascot:gallery.title')}</Text>
          <Text style={styles.headerSub}>
            {t('mascot:gallery.currentLevel', { level: currentLevel })} · {totalExp} EXP
          </Text>
        </View>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>
            {t('mascot:gallery.unlocked', { count: currentLevel, total: MAX_MASCOT_LEVEL })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* 현재 마스코트 요약 */}
        <View style={styles.heroCard}>
          <MascotCharacter size={96} level={currentLevel} happy />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.heroTitle}>
              Lv.{currentLevel} {t('mascot:stage.' + getMascotStageIndex(currentLevel))}
            </Text>
            <View style={styles.expBarBg}>
              <View style={[styles.expBarFill, { width: `${progress.progress * 100}%` }]} />
            </View>
            <Text style={styles.heroExp}>
              {t('mascot:exp.format', { current: progress.current, needed: progress.needed })}
            </Text>
            <Text style={styles.heroDesc}>{t('mascot:gallery.desc')}</Text>
          </View>
        </View>

        {/* 스테이지별 그룹 */}
        {STAGE_NAMES.map((_stageName, stageIdx) => {
          const startLevel = stageIdx * LEVELS_PER_STAGE + 1;
          const endLevel = startLevel + LEVELS_PER_STAGE - 1;
          const stageLevels = ALL_LEVELS.slice(startLevel - 1, endLevel);
          const stageColor = getMascotParams(startLevel).bodyColor;
          const stageUnlocked = currentLevel >= startLevel;

          return (
            <View key={stageIdx}>
              <View style={[styles.stageHeader, { backgroundColor: stageColor + '15' }]}>
                <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
                <Text style={[styles.stageName, { color: stageColor }]}>
                  {t('mascot:stage.' + stageIdx)}
                </Text>
                <Text style={styles.stageRange}>
                  Lv.{startLevel} ~ {endLevel}
                </Text>
                {!stageUnlocked && <Lock size={12} color={COLORS.slate400} />}
              </View>

              <View style={styles.grid}>
                {stageLevels.map((lv) => {
                  const isUnlocked = lv <= currentLevel;
                  const isCurrent = lv === currentLevel;
                  return (
                    <View
                      key={lv}
                      style={[
                        styles.card,
                        isCurrent && styles.cardCurrent,
                        !isUnlocked && styles.cardLocked,
                      ]}
                    >
                      {isCurrent && (
                        <View style={styles.currentChip}>
                          <Text style={styles.currentChipText}>{t('mascot:gallery.current')}</Text>
                        </View>
                      )}
                      <View style={!isUnlocked && styles.lockedMascot}>
                        <MascotCharacter size={56} level={lv} />
                      </View>
                      {!isUnlocked && (
                        <View style={styles.lockBadge}>
                          <Lock size={10} color={COLORS.slate500} />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.cardLevel,
                          isCurrent && { color: COLORS.primary500, fontWeight: '900' },
                          !isUnlocked && { color: COLORS.slate400 },
                        ]}
                      >
                        Lv.{lv}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
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
  headerSub: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 1,
  },
  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primary50,
    borderWidth: 1,
    borderColor: COLORS.primary200,
  },
  countChipText: { fontSize: 11, fontWeight: '800', color: COLORS.primary700 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 4,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  heroTitle: { fontSize: 16, fontWeight: '900', color: '#312e81' },
  expBarBg: { height: 8, borderRadius: 4, backgroundColor: '#c7d2fe', overflow: 'hidden' },
  expBarFill: { height: '100%', backgroundColor: COLORS.primary500, borderRadius: 4 },
  heroExp: { fontSize: 11, fontWeight: '700', color: COLORS.primary600 },
  heroDesc: { fontSize: 11, color: COLORS.slate500, lineHeight: 16 },
  // 스테이지
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '800',
  },
  stageRange: {
    fontSize: 11,
    color: COLORS.slate400,
    marginLeft: 'auto',
  },
  // 그리드 (5열)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },
  card: {
    width: '18.5%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.slate100,
    overflow: 'hidden',
  },
  cardCurrent: {
    borderColor: COLORS.primary500,
    borderWidth: 2,
    backgroundColor: '#eef2ff',
  },
  cardLocked: {
    backgroundColor: COLORS.slate50,
  },
  lockedMascot: { opacity: 0.18 },
  lockBadge: {
    position: 'absolute',
    top: 24,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentChip: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
    backgroundColor: COLORS.primary500,
  },
  currentChipText: { fontSize: 8, fontWeight: '900', color: '#fff' },
  cardLevel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slate500,
    marginTop: 4,
  },
});
