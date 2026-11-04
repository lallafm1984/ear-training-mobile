// ─────────────────────────────────────────────────────────────
// dailyGoal — 일일 목표(7개 카테고리) 판정 (순수 함수, 로컬 기록 기반)
//
// HomeScreen 카드와 DailyGoalScreen 이 같은 기준으로 "오늘 달성 수"와
// "연속 달성일"을 계산하도록 한곳에 모았다.
// ─────────────────────────────────────────────────────────────

import type { ContentCategory } from '../types/content';

/** 일일 목표에 포함되는 카테고리 (twoVoice·scale·rhythmTap 은 제외) */
export const DAILY_GOAL_CATEGORIES: readonly ContentCategory[] = [
  'melody',
  'barMelody',
  'rhythm',
  'interval',
  'chord',
  'progression',
  'key',
];
export const DAILY_GOAL_COUNT = DAILY_GOAL_CATEGORIES.length;

interface GoalRecordLike {
  practicedAt: string;
  contentType: ContentCategory;
}

/** 기준 날짜(기본 오늘)에 연습한 목표 카테고리 집합 */
export function goalCategoriesOn(
  records: readonly GoalRecordLike[],
  day: Date = new Date(),
): Set<ContentCategory> {
  const dayStr = day.toDateString();
  const cats = new Set<ContentCategory>();
  for (const r of records) {
    if (!DAILY_GOAL_CATEGORIES.includes(r.contentType)) continue;
    if (new Date(r.practicedAt).toDateString() === dayStr) cats.add(r.contentType);
  }
  return cats;
}

/** 오늘 달성한 목표 수 (0 ~ DAILY_GOAL_COUNT) */
export function countGoalsDoneToday(records: readonly GoalRecordLike[], now: Date = new Date()) {
  return goalCategoriesOn(records, now).size;
}

/**
 * 연속 목표 달성일. 오늘은 아직 진행 중이므로 미달성이어도 끊지 않고 어제부터 센다.
 * 최대 365일까지만 본다.
 */
export function computeGoalStreak(
  records: readonly GoalRecordLike[],
  now: Date = new Date(),
): number {
  const byDate: Record<string, Set<ContentCategory>> = {};
  for (const r of records) {
    if (!DAILY_GOAL_CATEGORIES.includes(r.contentType)) continue;
    const d = new Date(r.practicedAt).toDateString();
    (byDate[d] ??= new Set()).add(r.contentType);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now.getTime() - i * 86_400_000).toDateString();
    const cats = byDate[d];
    const done = cats ? DAILY_GOAL_CATEGORIES.every((c) => cats.has(c)) : false;
    if (done) {
      streak++;
    } else if (i !== 0) {
      break;
    }
  }
  return streak;
}
