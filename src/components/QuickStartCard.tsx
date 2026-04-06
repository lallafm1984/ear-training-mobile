// ─────────────────────────────────────────────────────────────
// QuickStartCard — 빠른 시작 / 오늘의 추천 카드
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import type { ContentCategory } from '../types/content';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import type { ContentDifficulty } from '../types/content';

interface QuickStartCardProps {
  category: ContentCategory;
  difficulty: ContentDifficulty;
  streakDays: number;
  onPress: () => void;
}

export default function QuickStartCard({
  category,
  difficulty,
  streakDays,
  onPress,
}: QuickStartCardProps) {
  const config = getContentConfig(category);
  const diffLabel = getDifficultyLabel(category, difficulty);
  const catColor = CATEGORY_COLORS[category].main;

  return (
    <View style={styles.container}>
      {/* 스트릭 배너 */}
      {streakDays > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakText}>
            연속 학습 {streakDays}일째!
          </Text>
        </View>
      )}

      {/* 빠른 시작 */}
      <TouchableOpacity style={[styles.card, { backgroundColor: catColor }]} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.left}>
          <View style={styles.iconCircle}>
            <Zap size={20} color={COLORS.white} fill={COLORS.white} />
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.label}>빠른 시작</Text>
          <Text style={styles.title}>오늘의 추천 연습</Text>
          <Text style={styles.detail} numberOfLines={1}>
            {config.name} · {diffLabel}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  streakBanner: {
    backgroundColor: COLORS.amber100,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber800,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary500,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 14,
  },
  left: {},
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 2,
  },
  detail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
});
