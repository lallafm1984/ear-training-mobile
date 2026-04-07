// ─────────────────────────────────────────────────────────────
// computeStats — 연습 기록 통계 계산 (순수 함수)
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, PracticeRecord } from '../types/content';

export interface PracticeStats {
  totalSessions: number;
  totalByCategory: Record<ContentCategory, number>;
  avgRatingByCategory: Record<ContentCategory, number>;
  recentRecords: PracticeRecord[];
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
}

const CATEGORIES: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key', 'twoVoice'];

function emptyStats(): PracticeStats {
  const totalByCategory = {} as Record<ContentCategory, number>;
  const avgRatingByCategory = {} as Record<ContentCategory, number>;
  CATEGORIES.forEach(c => {
    totalByCategory[c] = 0;
    avgRatingByCategory[c] = 0;
  });
  return {
    totalSessions: 0,
    totalByCategory,
    avgRatingByCategory,
    recentRecords: [],
    dailyCount: 0,
    weeklyCount: 0,
    monthlyCount: 0,
  };
}

export function computeStats(records: PracticeRecord[]): PracticeStats {
  const stats = emptyStats();
  stats.totalSessions = records.length;
  stats.recentRecords = records.slice(0, 20);

  const now = Date.now();
  const todayStr = new Date(now).toDateString();
  const weekAgo = now - 7 * 86400_000;
  const monthAgo = now - 30 * 86400_000;

  const ratingSum: Record<string, number> = {};
  const ratingCount: Record<string, number> = {};

  records.forEach(r => {
    const cat = r.contentType;
    stats.totalByCategory[cat] = (stats.totalByCategory[cat] || 0) + 1;

    ratingSum[cat] = (ratingSum[cat] || 0) + r.selfRating;
    ratingCount[cat] = (ratingCount[cat] || 0) + 1;

    const practiceDate = new Date(r.practicedAt);
    if (practiceDate.toDateString() === todayStr) stats.dailyCount++;
    const ts = practiceDate.getTime();
    if (ts >= weekAgo) stats.weeklyCount++;
    if (ts >= monthAgo) stats.monthlyCount++;
  });

  CATEGORIES.forEach(c => {
    stats.avgRatingByCategory[c] = ratingCount[c]
      ? Math.round((ratingSum[c] / ratingCount[c]) * 10) / 10
      : 0;
  });

  return stats;
}
