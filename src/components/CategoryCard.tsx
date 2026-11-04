// ─────────────────────────────────────────────────────────────
// CategoryCard — 청음 카테고리 카드 컴포넌트
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Music,
  Drum,
  ArrowUpDown,
  Layers,
  GitBranch,
  Key,
  FileMusic,
  AudioLines,
  Hand,
  Lock,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../theme/colors';
import type { ContentTypeConfig } from '../types/content';

export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Music,
  Drum,
  ArrowUpDown,
  Layers,
  GitBranch,
  Key,
  FileMusic,
  AudioLines,
  Hand,
};

interface CategoryCardProps {
  config: ContentTypeConfig;
  onPress: () => void;
  locked?: boolean;
  /** 연습 횟수 (진도 표시용) */
  practiceCount?: number;
  /** 카드 폭(dp). 그리드 열 수에 맞춰 부모가 계산해 넘긴다. 없으면 30% */
  width?: number;
  /** 이번 업데이트에서 추가된 난이도 수 — 0보다 크면 NEW 배지 */
  newCount?: number;
}

function CategoryCard({
  config,
  onPress,
  locked,
  practiceCount,
  width,
  newCount,
}: CategoryCardProps) {
  const { t } = useTranslation(['common', 'content']);
  const IconComponent = ICON_MAP[config.icon] ?? Music;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        width != null && { flexBasis: width },
        locked
          ? { backgroundColor: '#dde3ed', borderColor: '#94a3b8', borderStyle: 'dashed' }
          : { backgroundColor: config.bgColor, borderColor: config.color + '30' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.iconWrap, { backgroundColor: locked ? '#b0bccc' : config.color + '18' }]}
      >
        <IconComponent size={24} color={locked ? '#6b7a8d' : config.color} />
      </View>
      <Text
        style={[styles.name, { color: locked ? COLORS.slate400 : config.color }]}
        numberOfLines={1}
      >
        {t('content:category.' + config.id + '.name')}
      </Text>
      <Text style={[styles.desc, locked && { color: COLORS.slate400 }]} numberOfLines={1}>
        {t('content:category.' + config.id + '.description')}
      </Text>
      {locked && (
        <View style={styles.lockBadge}>
          <Lock size={10} color={COLORS.slate600} />
          <Text style={styles.lockText}>Pro</Text>
        </View>
      )}
      {!locked && newCount != null && newCount > 0 && (
        <View style={[styles.newBadge, { backgroundColor: config.color }]}>
          <Text style={styles.newText}>{t('common:badge.new')}</Text>
        </View>
      )}
      {!locked && practiceCount != null && practiceCount > 0 && (
        <View style={[styles.countBadge, { backgroundColor: config.color + '20' }]}>
          <Text style={[styles.countText, { color: config.color }]}>
            {practiceCount}
            {t('common:unit.count')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(CategoryCard);

const styles = StyleSheet.create({
  card: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '30%',
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
  newBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#64748b',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  lockText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
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
