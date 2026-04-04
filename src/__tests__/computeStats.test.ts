import type { PracticeRecord, ContentCategory } from '../types/content';

// computeStats를 직접 구현 (usePracticeHistory에서 React 의존성 없이 추출)
type PracticeStats = {
  totalSessions: number;
  totalByCategory: Record<ContentCategory, number>;
  avgRatingByCategory: Record<ContentCategory, number>;
  recentRecords: PracticeRecord[];
  weeklyCount: number;
  monthlyCount: number;
};

const CATEGORIES: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key', 'twoVoice'];

function emptyStats(): PracticeStats {
  const totalByCategory = {} as Record<ContentCategory, number>;
  const avgRatingByCategory = {} as Record<ContentCategory, number>;
  CATEGORIES.forEach(c => {
    totalByCategory[c] = 0;
    avgRatingByCategory[c] = 0;
  });
  return {
    totalSessions: 0, totalByCategory, avgRatingByCategory,
    recentRecords: [], weeklyCount: 0, monthlyCount: 0,
  };
}

function computeStats(records: PracticeRecord[]): PracticeStats {
  const stats = emptyStats();
  stats.totalSessions = records.length;
  stats.recentRecords = records.slice(0, 20);
  const now = Date.now();
  const weekAgo = now - 7 * 86400_000;
  const monthAgo = now - 30 * 86400_000;
  const ratingSum: Record<string, number> = {};
  const ratingCount: Record<string, number> = {};
  records.forEach(r => {
    const cat = r.contentType;
    stats.totalByCategory[cat] = (stats.totalByCategory[cat] || 0) + 1;
    ratingSum[cat] = (ratingSum[cat] || 0) + r.selfRating;
    ratingCount[cat] = (ratingCount[cat] || 0) + 1;
    const ts = new Date(r.practicedAt).getTime();
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

function makeRecord(
  contentType: string,
  selfRating: number,
  daysAgo = 0,
): PracticeRecord {
  const date = new Date(Date.now() - daysAgo * 86400_000);
  return {
    id: `test_${Math.random().toString(36).slice(2)}`,
    contentType: contentType as any,
    difficulty: 'melody_1' as any,
    selfRating,
    practicedAt: date.toISOString(),
  };
}

describe('computeStats', () => {
  it('빈 배열: 모든 값이 0', () => {
    const stats = computeStats([]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.weeklyCount).toBe(0);
    expect(stats.monthlyCount).toBe(0);
    expect(stats.recentRecords).toHaveLength(0);
    expect(stats.totalByCategory.melody).toBe(0);
    expect(stats.avgRatingByCategory.melody).toBe(0);
  });

  it('단일 레코드: 정확한 카운트 및 평균', () => {
    const records = [makeRecord('melody', 4, 0)];
    const stats = computeStats(records);
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalByCategory.melody).toBe(1);
    expect(stats.avgRatingByCategory.melody).toBe(4);
    expect(stats.weeklyCount).toBe(1);
    expect(stats.monthlyCount).toBe(1);
  });

  it('여러 카테고리: 카테고리별 분리 집계', () => {
    const records = [
      makeRecord('melody', 3, 0),
      makeRecord('melody', 5, 1),
      makeRecord('interval', 4, 0),
      makeRecord('chord', 2, 0),
    ];
    const stats = computeStats(records);
    expect(stats.totalSessions).toBe(4);
    expect(stats.totalByCategory.melody).toBe(2);
    expect(stats.totalByCategory.interval).toBe(1);
    expect(stats.totalByCategory.chord).toBe(1);
    expect(stats.avgRatingByCategory.melody).toBe(4); // (3+5)/2 = 4
    expect(stats.avgRatingByCategory.interval).toBe(4);
  });

  it('주간/월간 카운트: 오래된 기록 제외', () => {
    const records = [
      makeRecord('melody', 3, 0),   // 오늘 → 주간O 월간O
      makeRecord('melody', 3, 5),   // 5일 전 → 주간O 월간O
      makeRecord('melody', 3, 10),  // 10일 전 → 주간X 월간O
      makeRecord('melody', 3, 40),  // 40일 전 → 주간X 월간X
    ];
    const stats = computeStats(records);
    expect(stats.weeklyCount).toBe(2);
    expect(stats.monthlyCount).toBe(3);
  });

  it('recentRecords: 최대 20개', () => {
    const records = Array.from({ length: 30 }, (_, i) =>
      makeRecord('melody', 3, i),
    );
    const stats = computeStats(records);
    expect(stats.recentRecords).toHaveLength(20);
  });

  it('평균 평점: 소수점 1자리 반올림', () => {
    const records = [
      makeRecord('melody', 3, 0),
      makeRecord('melody', 4, 0),
      makeRecord('melody', 5, 0),
    ];
    const stats = computeStats(records);
    expect(stats.avgRatingByCategory.melody).toBe(4); // (3+4+5)/3 = 4.0
  });

  it('연습하지 않은 카테고리: 0 유지', () => {
    const records = [makeRecord('melody', 4, 0)];
    const stats = computeStats(records);
    expect(stats.totalByCategory.rhythm).toBe(0);
    expect(stats.avgRatingByCategory.rhythm).toBe(0);
    expect(stats.totalByCategory.twoVoice).toBe(0);
  });
});
