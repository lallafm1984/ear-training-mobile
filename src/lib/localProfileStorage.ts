// ─────────────────────────────────────────────────────────────
// localProfileStorage — 로컬 학습 데이터의 소유자 키와 게스트 → 계정 이관
//
// 연습 기록·실력 프로필·마스코트 EXP·시험 결과는 모두 AsyncStorage에
// `<base>_<ownerId>` 형태로 저장된다. 로그인 전에는 ownerId가 GUEST_STORAGE_ID이고,
// 로그인하면 게스트 키의 데이터를 계정 키로 병합한 뒤 게스트 키를 지운다.
// 이 모듈은 순수 함수와 저장소 인터페이스만 다루므로 테스트가 쉽다.
// ─────────────────────────────────────────────────────────────

import type { PracticeRecord } from '../types/content';
import type { UserSkillProfile } from './trackConfig';
import {
  mergeBeginnerProgress,
  normalizeBeginnerProgress,
  type BeginnerCourseProgress,
} from './beginnerCourse/progress';
import {
  mergeLevelTestResults,
  normalizeLevelTestResult,
  type LevelTestResult,
} from './levelTest/engine';

export const GUEST_STORAGE_ID = 'guest';

/** 게스트 모드로 앱을 사용 중임을 기억하는 전역 플래그 키 */
export const GUEST_MODE_FLAG_KEY = '@melodygen_guest_mode';

export const LOCAL_DATA_BASE_KEYS = {
  recentActivity: '@melodygen_recent_activity',
  skillProfile: '@melodygen_skill_profile',
  lastPracticeDate: '@melodygen_last_practice_date',
  mascotExp: '@melodygen_mascot_exp',
  dailyExpRewarded: '@melodygen_daily_exp_rewarded',
  examSessions: '@melodygen_exam_sessions',
  beginnerCourse: '@melodygen_beginner_course',
  levelTest: '@melodygen_level_test',
} as const;

export type LocalDataBaseKey = (typeof LOCAL_DATA_BASE_KEYS)[keyof typeof LOCAL_DATA_BASE_KEYS];

export const MAX_PRACTICE_RECORDS = 5000;
export const MAX_EXAM_SESSIONS = 50;

export function localDataKey(base: LocalDataBaseKey, ownerId: string): string {
  return `${base}_${ownerId}`;
}

/** 특정 소유자의 로컬 학습 데이터 키 전체 */
export function allLocalDataKeys(ownerId: string): string[] {
  return Object.values(LOCAL_DATA_BASE_KEYS).map((base) => localDataKey(base, ownerId));
}

// ─────────────────────────────────────────────────────────────
// 병합 규칙
// ─────────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 두 기록 목록을 id 기준으로 합치고 최신순으로 정렬한다. */
export function mergePracticeRecords(
  guest: PracticeRecord[],
  account: PracticeRecord[],
): PracticeRecord[] {
  const byId = new Map<string, PracticeRecord>();
  for (const r of [...account, ...guest]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.practicedAt) - Date.parse(a.practicedAt))
    .slice(0, MAX_PRACTICE_RECORDS);
}

/** 실력 프로필은 더 높은 레벨·더 긴 연속일을 택하고, 최근 정확도는 계정 값을 우선한다. */
export function mergeSkillProfiles(
  guest: Partial<UserSkillProfile>,
  account: Partial<UserSkillProfile> | null,
): Partial<UserSkillProfile> {
  if (!account) return guest;
  const merged: Partial<UserSkillProfile> = { ...guest, ...account };
  const numericMax = (key: keyof UserSkillProfile) => {
    const g = guest[key];
    const a = account[key];
    if (typeof g === 'number' && typeof a === 'number') {
      (merged as Record<string, unknown>)[key] = Math.max(g, a);
    }
  };
  numericMax('partPracticeLevel');
  numericMax('comprehensiveLevel');
  numericMax('streakDays');
  return merged;
}

export interface MascotExpData {
  totalExp: number;
  lastExpDate: string;
}

/** 마스코트 EXP는 합산한다. 양쪽에서 쌓은 노력을 모두 인정한다. */
export function mergeMascotExp(guest: MascotExpData, account: MascotExpData | null): MascotExpData {
  if (!account) return guest;
  const latest = [guest.lastExpDate, account.lastExpDate].filter(Boolean).sort().pop() ?? '';
  return { totalExp: guest.totalExp + account.totalExp, lastExpDate: latest };
}

interface ExamSessionLike {
  id: string;
  completed_at: string;
}

export function mergeExamSessions<T extends ExamSessionLike>(guest: T[], account: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of [...account, ...guest]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
    .slice(0, MAX_EXAM_SESSIONS);
}

/** 마지막 연습일(Date#toDateString 형식)은 더 최근 값을 택한다. */
export function mergeLastPracticeDate(guest: string | null, account: string | null): string | null {
  if (!guest) return account;
  if (!account) return guest;
  return Date.parse(guest) > Date.parse(account) ? guest : account;
}

// ─────────────────────────────────────────────────────────────
// 이관 실행
// ─────────────────────────────────────────────────────────────

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

/** 게스트 키에 남은 데이터가 하나라도 있는지 */
export async function hasGuestData(storage: KeyValueStorage): Promise<boolean> {
  for (const key of allLocalDataKeys(GUEST_STORAGE_ID)) {
    if ((await storage.getItem(key)) !== null) return true;
  }
  return false;
}

export interface GuestMigrationResult {
  migrated: boolean;
  practiceRecords: number;
  examSessions: number;
}

/**
 * 게스트 데이터를 계정 키로 병합하고 게스트 키를 지운다.
 * 계정에 이미 데이터가 있어도 덮어쓰지 않고 합친다.
 */
export async function migrateGuestDataToAccount(
  storage: KeyValueStorage,
  userId: string,
): Promise<GuestMigrationResult> {
  const result: GuestMigrationResult = { migrated: false, practiceRecords: 0, examSessions: 0 };
  if (!userId || userId === GUEST_STORAGE_ID) return result;
  if (!(await hasGuestData(storage))) return result;

  const read = (base: LocalDataBaseKey, owner: string) =>
    storage.getItem(localDataKey(base, owner));
  const write = (base: LocalDataBaseKey, value: unknown) =>
    storage.setItem(localDataKey(base, userId), JSON.stringify(value));

  // 연습 기록
  const guestRecords = safeParse<PracticeRecord[]>(
    await read(LOCAL_DATA_BASE_KEYS.recentActivity, GUEST_STORAGE_ID),
  );
  if (guestRecords?.length) {
    const accountRecords =
      safeParse<PracticeRecord[]>(await read(LOCAL_DATA_BASE_KEYS.recentActivity, userId)) ?? [];
    const merged = mergePracticeRecords(guestRecords, accountRecords);
    await write(LOCAL_DATA_BASE_KEYS.recentActivity, merged);
    result.practiceRecords = guestRecords.length;
  }

  // 실력 프로필
  const guestSkill = safeParse<Partial<UserSkillProfile>>(
    await read(LOCAL_DATA_BASE_KEYS.skillProfile, GUEST_STORAGE_ID),
  );
  if (guestSkill) {
    const accountSkill = safeParse<Partial<UserSkillProfile>>(
      await read(LOCAL_DATA_BASE_KEYS.skillProfile, userId),
    );
    await write(LOCAL_DATA_BASE_KEYS.skillProfile, mergeSkillProfiles(guestSkill, accountSkill));
  }

  // 마지막 연습일
  const guestLast = await read(LOCAL_DATA_BASE_KEYS.lastPracticeDate, GUEST_STORAGE_ID);
  if (guestLast) {
    const accountLast = await read(LOCAL_DATA_BASE_KEYS.lastPracticeDate, userId);
    const merged = mergeLastPracticeDate(guestLast, accountLast);
    if (merged)
      await storage.setItem(localDataKey(LOCAL_DATA_BASE_KEYS.lastPracticeDate, userId), merged);
  }

  // 마스코트 EXP
  const guestExp = safeParse<MascotExpData>(
    await read(LOCAL_DATA_BASE_KEYS.mascotExp, GUEST_STORAGE_ID),
  );
  if (guestExp && typeof guestExp.totalExp === 'number') {
    const accountExp = safeParse<MascotExpData>(await read(LOCAL_DATA_BASE_KEYS.mascotExp, userId));
    await write(LOCAL_DATA_BASE_KEYS.mascotExp, mergeMascotExp(guestExp, accountExp));
  }

  // 오늘 보상 횟수: 계정 값이 없을 때만 가져온다 (중복 지급보다 누락이 안전)
  const guestRewarded = await read(LOCAL_DATA_BASE_KEYS.dailyExpRewarded, GUEST_STORAGE_ID);
  if (guestRewarded && (await read(LOCAL_DATA_BASE_KEYS.dailyExpRewarded, userId)) === null) {
    await storage.setItem(
      localDataKey(LOCAL_DATA_BASE_KEYS.dailyExpRewarded, userId),
      guestRewarded,
    );
  }

  // 시험 결과
  const guestExams = safeParse<ExamSessionLike[]>(
    await read(LOCAL_DATA_BASE_KEYS.examSessions, GUEST_STORAGE_ID),
  );
  if (guestExams?.length) {
    const accountExams =
      safeParse<ExamSessionLike[]>(await read(LOCAL_DATA_BASE_KEYS.examSessions, userId)) ?? [];
    await write(LOCAL_DATA_BASE_KEYS.examSessions, mergeExamSessions(guestExams, accountExams));
    result.examSessions = guestExams.length;
  }

  // 귀 열기 코스 진행
  const guestCourse = safeParse<BeginnerCourseProgress>(
    await read(LOCAL_DATA_BASE_KEYS.beginnerCourse, GUEST_STORAGE_ID),
  );
  if (guestCourse) {
    const accountCourse = safeParse<BeginnerCourseProgress>(
      await read(LOCAL_DATA_BASE_KEYS.beginnerCourse, userId),
    );
    await write(
      LOCAL_DATA_BASE_KEYS.beginnerCourse,
      mergeBeginnerProgress(
        normalizeBeginnerProgress(guestCourse),
        accountCourse ? normalizeBeginnerProgress(accountCourse) : null,
      ),
    );
  }

  // 레벨 테스트 결과: 더 최근 것을 남긴다
  const guestLevel = normalizeLevelTestResult(
    safeParse<LevelTestResult>(await read(LOCAL_DATA_BASE_KEYS.levelTest, GUEST_STORAGE_ID)),
  );
  if (guestLevel) {
    const accountLevel = normalizeLevelTestResult(
      safeParse<LevelTestResult>(await read(LOCAL_DATA_BASE_KEYS.levelTest, userId)),
    );
    const merged = mergeLevelTestResults(guestLevel, accountLevel);
    if (merged) await write(LOCAL_DATA_BASE_KEYS.levelTest, merged);
  }

  await storage.multiRemove(allLocalDataKeys(GUEST_STORAGE_ID));
  result.migrated = true;
  return result;
}
