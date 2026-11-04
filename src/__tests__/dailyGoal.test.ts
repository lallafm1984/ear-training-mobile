import {
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_COUNT,
  computeGoalStreak,
  countGoalsDoneToday,
  goalCategoriesOn,
} from '../lib/dailyGoal';
import type { ContentCategory } from '../types/content';

const NOW = new Date(2026, 10, 3, 15, 0, 0); // 2026-11-03 15:00 (로컬)

function at(daysAgo: number, hour = 10): string {
  const d = new Date(NOW.getTime() - daysAgo * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function rec(contentType: ContentCategory, daysAgo: number, hour = 10) {
  return { contentType, practicedAt: at(daysAgo, hour) };
}

function fullDay(daysAgo: number) {
  return DAILY_GOAL_CATEGORIES.map((c, i) => rec(c, daysAgo, 8 + i));
}

describe('dailyGoal', () => {
  it('목표 카테고리는 7개이며 twoVoice·scale·rhythmTap 은 포함하지 않는다', () => {
    expect(DAILY_GOAL_COUNT).toBe(7);
    expect(DAILY_GOAL_CATEGORIES).not.toContain('twoVoice');
    expect(DAILY_GOAL_CATEGORIES).not.toContain('scale');
    expect(DAILY_GOAL_CATEGORIES).not.toContain('rhythmTap');
  });

  it('오늘 연습한 목표 카테고리만 센다 (목표 외 카테고리·어제 기록 제외)', () => {
    const records = [
      rec('melody', 0),
      rec('melody', 0, 12), // 같은 카테고리 중복
      rec('twoVoice', 0), // 목표 외
      rec('rhythm', 1), // 어제
    ];
    expect(goalCategoriesOn(records, NOW)).toEqual(new Set(['melody']));
    expect(countGoalsDoneToday(records, NOW)).toBe(1);
  });

  it('기록이 20개를 넘어도 오늘 달성 수가 줄지 않는다 (최근 N개만 보던 버그 방지)', () => {
    const records = [
      ...Array.from({ length: 30 }, (_, i) => rec('melody', 0, 9 + (i % 10))),
      rec('key', 0, 7), // 아침에 먼저 한 조성 연습
    ];
    expect(countGoalsDoneToday(records, NOW)).toBe(2);
  });

  it('연속 달성일: 오늘 미달성이면 어제부터 세고, 어제가 미달성이면 0', () => {
    expect(computeGoalStreak([...fullDay(1), ...fullDay(2), rec('melody', 0)], NOW)).toBe(2);
    expect(computeGoalStreak([...fullDay(2), ...fullDay(3)], NOW)).toBe(0);
  });

  it('연속 달성일: 오늘 달성 시 오늘을 포함하고, 중간에 빠진 날에서 끊긴다', () => {
    expect(computeGoalStreak([...fullDay(0), ...fullDay(1), ...fullDay(3)], NOW)).toBe(2);
  });

  it('6/7 만 채운 날은 달성으로 보지 않는다', () => {
    const sixOfSeven = fullDay(1).slice(0, 6);
    expect(computeGoalStreak([...sixOfSeven, ...fullDay(2)], NOW)).toBe(0);
  });
});
