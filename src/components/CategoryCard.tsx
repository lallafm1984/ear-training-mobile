// ─────────────────────────────────────────────────────────────
// CategoryCard — 청음 카테고리 카드 컴포넌트
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Music, Drum, ArrowUpDown, Layers, Key, FileMusic, Lock,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import type { ContentTypeConfig } from '../types/content';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Music, Drum, ArrowUpDown, Layers, Key, FileMusic,
};

interface CategoryCardProps {
  config: ContentTypeConfig;
  onPress: () => void;
  locked?: boolean;
  /** 연습 횟수 (진도 표시용) */
  practiceCount?: number;
}

function CategoryCard({ config, onPress, locked, practiceCount }: CategoryCardProps) {
  const IconComponent = ICON_MAP[config.icon] ?? Music;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: config.bgColor, borderColor: config.color + '30' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: config.color + '18' }]}>
        <IconComponent size={24} color={config.color} />
      </View>
      <Text style={[styles.name, { color: config.color }]} numberOfLines={1}>
        {config.name}
      </Text>
      <Text style={styles.desc} numberOfLines={1}>
        {config.description}
      </Text>
      {locked && (
        <View style={styles.lockBadge}>
          <Lock size={10} color={COLORS.slate400} />
          <Text style={styles.lockText}>Pro</Text>
        </View>
      )}
      {!locked && practiceCount != null && practiceCount > 0 && (
        <View style={[styles.countBadge, { backgroundColor: config.color + '20' }]}>
          <Text style={[styles.countText, { color: config.color }]}>
            {practiceCount}회
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(CategoryCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  desc: {
    fontSize: 10,
    color: COLORS.slate500,
    textAlign: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: COLORS.slate100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  lockText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slate400,
  },
  countBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
