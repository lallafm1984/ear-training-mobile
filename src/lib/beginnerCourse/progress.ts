// ─────────────────────────────────────────────────────────────
// 귀 열기 코스 — 진행 상태 (로컬 저장 전용)
// ─────────────────────────────────────────────────────────────

import { BEGINNER_LESSONS } from './config';

export interface BeginnerLessonResult {
  completedAt: string;
  correct: number;
  total: number;
}

export interface BeginnerCourseProgress {
  completedLessonIds: string[];
  lessonResults: Record<string, BeginnerLessonResult>;
  /** EXP를 이미 지급한 레슨 (중복 지급 방지) */
  rewardedLessonIds: string[];
  /** 코스 전체 완료 보너스 지급 여부 */
  courseRewarded: boolean;
}

export const EMPTY_BEGINNER_PROGRESS: BeginnerCourseProgress = {
  completedLessonIds: [],
  lessonResults: {},
  rewardedLessonIds: [],
  courseRewarded: false,
};

export function normalizeBeginnerProgress(raw: unknown): BeginnerCourseProgress {
  if (!raw || typeof raw !== 'object') return EMPTY_BEGINNER_PROGRESS;
  const r = raw as Partial<BeginnerCourseProgress>;
  return {
    completedLessonIds: Array.isArray(r.completedLessonIds) ? r.completedLessonIds : [],
    lessonResults: r.lessonResults && typeof r.lessonResults === 'object' ? r.lessonResults : {},
    rewardedLessonIds: Array.isArray(r.rewardedLessonIds) ? r.rewardedLessonIds : [],
    courseRewarded: r.courseRewarded === true,
  };
}

/** 다음에 할 레슨 (가장 낮은 미완료 day). 전부 완료면 null */
export function getNextBeginnerLessonId(progress: BeginnerCourseProgress): string | null {
  const next = BEGINNER_LESSONS.find((l) => !progress.completedLessonIds.includes(l.id));
  return next ? next.id : null;
}

export function isBeginnerCourseComplete(progress: BeginnerCourseProgress): boolean {
  return BEGINNER_LESSONS.every((l) => progress.completedLessonIds.includes(l.id));
}

/** 레슨 잠금 여부: 이전 day를 모두 완료해야 열린다 (복습은 언제나 가능) */
export function isBeginnerLessonUnlocked(
  progress: BeginnerCourseProgress,
  lessonId: string,
): boolean {
  const idx = BEGINNER_LESSONS.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return idx === 0;
  return BEGINNER_LESSONS.slice(0, idx).every((l) => progress.completedLessonIds.includes(l.id));
}

/** 레슨 완료 반영. 재도전 시 더 나은 점수만 남긴다. */
export function applyBeginnerLessonResult(
  progress: BeginnerCourseProgress,
  lessonId: string,
  result: BeginnerLessonResult,
): BeginnerCourseProgress {
  const prev = progress.lessonResults[lessonId];
  const better =
    !prev || result.correct / Math.max(1, result.total) >= prev.correct / Math.max(1, prev.total);
  return {
    ...progress,
    completedLessonIds: progress.completedLessonIds.includes(lessonId)
      ? progress.completedLessonIds
      : [...progress.completedLessonIds, lessonId],
    lessonResults: {
      ...progress.lessonResults,
      [lessonId]: better ? result : { ...prev, completedAt: result.completedAt },
    },
  };
}

/** 게스트 → 계정 이관 시 두 진행 상태를 합친다. */
export function mergeBeginnerProgress(
  guest: BeginnerCourseProgress,
  account: BeginnerCourseProgress | null,
): BeginnerCourseProgress {
  if (!account) return guest;
  const lessonResults: Record<string, BeginnerLessonResult> = { ...guest.lessonResults };
  for (const [id, r] of Object.entries(account.lessonResults)) {
    const g = lessonResults[id];
    if (!g || r.correct / Math.max(1, r.total) >= g.correct / Math.max(1, g.total)) {
      lessonResults[id] = r;
    }
  }
  return {
    completedLessonIds: [...new Set([...account.completedLessonIds, ...guest.completedLessonIds])],
    lessonResults,
    rewardedLessonIds: [...new Set([...account.rewardedLessonIds, ...guest.rewardedLessonIds])],
    courseRewarded: account.courseRewarded || guest.courseRewarded,
  };
}
