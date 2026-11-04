// ─────────────────────────────────────────────────────────────
// computeStats — 연습 기록 통계 계산 (순수 함수)
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';

export interface PracticeStats {
  totalSessions: number;
  totalByCategory: Record<ContentCategory, number>;
  avgRatingByCategory: Record<ContentCategory, number>;
  recentRecords: PracticeRecord[];
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
}

const CATEGORIES: ContentCategory[] = [
  'melody',
  'barMelody',
  'rhythm',
  'interval',
  'chord',
  'progression',
  'key',
  'twoVoice',
  'scale',
  'rhythmTap',
];

function emptyStats(): PracticeStats {
  const totalByCategory = {} as Record<ContentCategory, number>;
  const avgRatingByCategory = {} as Record<ContentCategory, number>;
  CATEGORIES.forEach((c) => {
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

  records.forEach((r) => {
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

  CATEGORIES.forEach((c) => {
    stats.avgRatingByCategory[c] = ratingCount[c]
      ? Math.round((ratingSum[c] / ratingCount[c]) * 10) / 10
      : 0;
  });

  return stats;
}

// ─────────────────────────────────────────────────────────────
// computeInsights — 통계 화면용 심화 지표 (카테고리별 분석·약점/강점·주간 증감·활동일)
// ─────────────────────────────────────────────────────────────

export interface CategoryInsight {
  category: ContentCategory;
  count: number;
  /** 평균 자기 평가 (1~5, 기록 없으면 0) */
  avgRating: number;
  lastPracticedAt: string | null;
  /** 가장 많이 연습한 난이도 (동률이면 최근 것) */
  topDifficulty: ContentDifficulty | null;
  /** 연습해 본 난이도 수 */
  levelsPracticed: number;
}

export interface PracticeInsights {
  /** 연습 기록이 있는 카테고리만, 연습 횟수 내림차순 */
  byCategory: CategoryInsight[];
  /** 약점: 기록 3회 이상인 카테고리 중 평균 평가가 가장 낮은 것 (평균 3.5 미만일 때만) */
  weakest: ContentCategory | null;
  /** 강점: 기록 3회 이상인 카테고리 중 평균 평가가 가장 높은 것 (평균 3.5 이상일 때만) */
  strongest: ContentCategory | null;
  /** 이번 주(최근 7일) − 지난 주(8~14일 전) 연습 횟수 */
  weeklyDelta: number;
  lastWeekCount: number;
  /** 최근 30일 중 연습한 날 수 */
  activeDays30: number;
}

const MIN_RECORDS_FOR_JUDGEMENT = 3;
const RATING_MIDPOINT = 3.5;

export function computeInsights(records: PracticeRecord[]): PracticeInsights {
  const now = Date.now();
  const weekAgo = now - 7 * 86400_000;
  const twoWeeksAgo = now - 14 * 86400_000;
  const monthAgo = now - 30 * 86400_000;

  const acc = new Map<
    ContentCategory,
    {
      count: number;
      ratingSum: number;
      last: number;
      byDiff: Map<ContentDifficulty, { count: number; last: number }>;
    }
  >();
  let thisWeek = 0;
  let lastWeek = 0;
  const activeDays = new Set<string>();

  for (const r of records) {
    const ts = new Date(r.practicedAt).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts >= weekAgo) thisWeek++;
    else if (ts >= twoWeeksAgo) lastWeek++;
    if (ts >= monthAgo) activeDays.add(new Date(ts).toDateString());

    const a = acc.get(r.contentType) ?? { count: 0, ratingSum: 0, last: 0, byDiff: new Map() };
    a.count++;
    a.ratingSum += r.selfRating;
    a.last = Math.max(a.last, ts);
    const d = a.byDiff.get(r.difficulty) ?? { count: 0, last: 0 };
    d.count++;
    d.last = Math.max(d.last, ts);
    a.byDiff.set(r.difficulty, d);
    acc.set(r.contentType, a);
  }

  const byCategory: CategoryInsight[] = [...acc.entries()]
    .map(([category, a]) => {
      let top: ContentDifficulty | null = null;
      let best = { count: -1, last: -1 };
      for (const [diff, d] of a.byDiff) {
        if (d.count > best.count || (d.count === best.count && d.last > best.last)) {
          best = d;
          top = diff;
        }
      }
      return {
        category,
        count: a.count,
        avgRating: Math.round((a.ratingSum / a.count) * 10) / 10,
        lastPracticedAt: a.last ? new Date(a.last).toISOString() : null,
        topDifficulty: top,
        levelsPracticed: a.byDiff.size,
      };
    })
    .sort(
      (x, y) =>
        y.count - x.count || (y.lastPracticedAt ?? '').localeCompare(x.lastPracticedAt ?? ''),
    );

  const judged = byCategory.filter((c) => c.count >= MIN_RECORDS_FOR_JUDGEMENT);
  let weakest: ContentCategory | null = null;
  let strongest: ContentCategory | null = null;
  if (judged.length > 0) {
    const low = judged.reduce((m, c) => (c.avgRating < m.avgRating ? c : m));
    const high = judged.reduce((m, c) => (c.avgRating > m.avgRating ? c : m));
    if (low.avgRating < RATING_MIDPOINT) weakest = low.category;
    if (high.avgRating >= RATING_MIDPOINT && high.category !== weakest) strongest = high.category;
  }

  return {
    byCategory,
    weakest,
    strongest,
    weeklyDelta: thisWeek - lastWeek,
    lastWeekCount: lastWeek,
    activeDays30: activeDays.size,
  };
}
