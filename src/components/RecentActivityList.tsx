// ─────────────────────────────────────────────────────────────
// RecentActivityList — 최근 연습 활동 리스트
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import type { PracticeRecord } from '../types/content';
import { getContentConfig, getDifficultyLabel } from '../lib/contentConfig';
import { CATEGORY_COLORS } from '../theme/colors';

interface RecentActivityListProps {
  records: PracticeRecord[];
  maxItems?: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

function ratingToStars(rating: number): string {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export default function RecentActivityList({ records, maxItems = 5 }: RecentActivityListProps) {
  const items = records.slice(0, maxItems);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Clock size={20} color="#94a3b8" />
        <Text style={styles.emptyText}>아직 연습 기록이 없습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((record) => {
        const config = getContentConfig(record.contentType);
        const colors = CATEGORY_COLORS[record.contentType];
        return (
          <View key={record.id} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: colors.main }]} />
            <View style={styles.info}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {config.name}
              </Text>
              <Text style={styles.itemDetail} numberOfLines={1}>
                {getDifficultyLabel(record.contentType, record.difficulty)}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={[styles.rating, { color: colors.main }]}>
                {ratingToStars(record.selfRating)}
              </Text>
              <Text style={styles.time}>{timeAgo(record.practicedAt)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  info: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemDetail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  rating: {
    fontSize: 10,
    letterSpacing: 1,
  },
  time: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
