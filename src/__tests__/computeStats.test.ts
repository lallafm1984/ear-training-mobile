import { computeInsights, computeStats } from '../lib/computeStats';
import type { PracticeRecord } from '../types/content';

function makeRecord(
  contentType: PracticeRecord['contentType'],
  selfRating: number,
  daysAgo = 0,
): PracticeRecord {
  const date = new Date(Date.now() - daysAgo * 86400_000);
  return {
    id: `test_${Math.random().toString(36).slice(2)}`,
    contentType,
    difficulty: 'beginner_1',
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
    expect(stats.totalByCategory.progression).toBe(0);
    expect(stats.avgRatingByCategory.progression).toBe(0);
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
      makeRecord('progression', 5, 0),
    ];
    const stats = computeStats(records);
    expect(stats.totalSessions).toBe(5);
    expect(stats.totalByCategory.melody).toBe(2);
    expect(stats.totalByCategory.interval).toBe(1);
    expect(stats.totalByCategory.chord).toBe(1);
    expect(stats.totalByCategory.progression).toBe(1);
    expect(stats.avgRatingByCategory.melody).toBe(4); // (3+5)/2 = 4
    expect(stats.avgRatingByCategory.interval).toBe(4);
    expect(stats.avgRatingByCategory.progression).toBe(5);
  });

  it('주간/월간 카운트: 오래된 기록 제외', () => {
    const records = [
      makeRecord('melody', 3, 0), // 오늘 → 주간O 월간O
      makeRecord('melody', 3, 5), // 5일 전 → 주간O 월간O
      makeRecord('melody', 3, 10), // 10일 전 → 주간X 월간O
      makeRecord('melody', 3, 40), // 40일 전 → 주간X 월간X
    ];
    const stats = computeStats(records);
    expect(stats.weeklyCount).toBe(2);
    expect(stats.monthlyCount).toBe(3);
  });

  it('recentRecords: 최대 20개', () => {
    const records = Array.from({ length: 30 }, (_, i) => makeRecord('melody', 3, i));
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
    expect(stats.totalByCategory.barMelody).toBe(0);
    expect(stats.avgRatingByCategory.barMelody).toBe(0);
    expect(stats.totalByCategory.progression).toBe(0);
    expect(stats.avgRatingByCategory.progression).toBe(0);
    expect(stats.totalByCategory.twoVoice).toBe(0);
  });
});

describe('computeInsights', () => {
  const withDiff = (
    contentType: PracticeRecord['contentType'],
    difficulty: PracticeRecord['difficulty'],
    selfRating: number,
    daysAgo: number,
  ): PracticeRecord => ({ ...makeRecord(contentType, selfRating, daysAgo), difficulty });

  it('빈 기록: 카테고리 없음, 약점/강점 없음, 증감 0', () => {
    const ins = computeInsights([]);
    expect(ins.byCategory).toEqual([]);
    expect(ins.weakest).toBeNull();
    expect(ins.strongest).toBeNull();
    expect(ins.weeklyDelta).toBe(0);
    expect(ins.activeDays30).toBe(0);
  });

  it('카테고리별 횟수·평균·최다 난이도·연습 난이도 수를 집계하고 횟수 내림차순으로 정렬한다', () => {
    const ins = computeInsights([
      withDiff('interval', 'interval_1', 4, 1),
      withDiff('interval', 'interval_2', 5, 2),
      withDiff('interval', 'interval_2', 3, 3),
      withDiff('melody', 'beginner_1', 2, 1),
    ]);
    expect(ins.byCategory.map((c) => c.category)).toEqual(['interval', 'melody']);
    const iv = ins.byCategory[0];
    expect(iv.count).toBe(3);
    expect(iv.avgRating).toBe(4);
    expect(iv.topDifficulty).toBe('interval_2');
    expect(iv.levelsPracticed).toBe(2);
    expect(iv.lastPracticedAt).not.toBeNull();
  });

  it('약점·강점은 3회 이상 연습한 카테고리에서만 고르고 3.5 기준으로 나눈다', () => {
    const recs = [
      ...[1, 2, 2].map((r, i) => withDiff('rhythm', 'rhythm_1', r, i)),
      ...[5, 4, 5].map((r, i) => withDiff('chord', 'chord_2', r, i)),
      withDiff('key', 'key_1', 1, 0), // 1회 — 판단 제외
    ];
    const ins = computeInsights(recs);
    expect(ins.weakest).toBe('rhythm');
    expect(ins.strongest).toBe('chord');
  });

  it('모두 잘하면 약점은 없고, 모두 못하면 강점은 없다', () => {
    const good = computeInsights([4, 5, 5].map((r, i) => withDiff('scale', 'scale_1', r, i)));
    expect(good.weakest).toBeNull();
    expect(good.strongest).toBe('scale');
    const bad = computeInsights([1, 2, 1].map((r, i) => withDiff('scale', 'scale_1', r, i)));
    expect(bad.weakest).toBe('scale');
    expect(bad.strongest).toBeNull();
  });

  it('주간 증감은 최근 7일 − 그 전 7일, 활동일은 최근 30일의 서로 다른 날짜 수', () => {
    const recs = [
      makeRecord('melody', 3, 0),
      makeRecord('melody', 3, 0),
      makeRecord('melody', 3, 2),
      makeRecord('melody', 3, 9),
      makeRecord('melody', 3, 40), // 30일 밖
    ];
    const ins = computeInsights(recs);
    expect(ins.weeklyDelta).toBe(3 - 1);
    expect(ins.lastWeekCount).toBe(1);
    expect(ins.activeDays30).toBe(3);
  });

  it('알 수 없는 난이도 id(구버전 기록)도 그대로 집계한다', () => {
    const ins = computeInsights([withDiff('interval', 'legacy_x' as never, 3, 0)]);
    expect(ins.byCategory[0].topDifficulty).toBe('legacy_x');
  });
});
