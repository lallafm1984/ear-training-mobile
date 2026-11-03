import {
  GUEST_STORAGE_ID,
  LOCAL_DATA_BASE_KEYS,
  allLocalDataKeys,
  hasGuestData,
  localDataKey,
  mergeExamSessions,
  mergeLastPracticeDate,
  mergeMascotExp,
  mergePracticeRecords,
  mergeSkillProfiles,
  migrateGuestDataToAccount,
  type KeyValueStorage,
} from '../lib/localProfileStorage';
import type { PracticeRecord } from '../types/content';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => data.delete(k));
    },
  };
}

const rec = (id: string, practicedAt: string): PracticeRecord => ({
  id,
  contentType: 'interval',
  difficulty: 'interval_1',
  selfRating: 3,
  practicedAt,
});

describe('localDataKey', () => {
  it('소유자 ID를 접미사로 붙인다', () => {
    expect(localDataKey(LOCAL_DATA_BASE_KEYS.recentActivity, 'u1')).toBe(
      '@melodygen_recent_activity_u1',
    );
    expect(allLocalDataKeys(GUEST_STORAGE_ID)).toHaveLength(7);
  });
});

describe('merge 규칙', () => {
  it('연습 기록은 id 중복을 제거하고 최신순으로 정렬한다', () => {
    const merged = mergePracticeRecords(
      [rec('g1', '2026-11-01T10:00:00Z'), rec('dup', '2026-10-01T00:00:00Z')],
      [rec('a1', '2026-11-02T10:00:00Z'), rec('dup', '2026-10-01T00:00:00Z')],
    );
    expect(merged.map((r) => r.id)).toEqual(['a1', 'g1', 'dup']);
  });

  it('실력 프로필은 레벨·연속일의 최댓값을 택하고 정확도는 계정 값을 유지한다', () => {
    const merged = mergeSkillProfiles(
      { partPracticeLevel: 4, comprehensiveLevel: 1, streakDays: 7, recentAccuracy: 0.9 },
      { partPracticeLevel: 2, comprehensiveLevel: 3, streakDays: 2, recentAccuracy: 0.5 },
    );
    expect(merged).toMatchObject({
      partPracticeLevel: 4,
      comprehensiveLevel: 3,
      streakDays: 7,
      recentAccuracy: 0.5,
    });
  });

  it('계정 프로필이 없으면 게스트 프로필을 그대로 쓴다', () => {
    expect(mergeSkillProfiles({ partPracticeLevel: 3 }, null)).toEqual({ partPracticeLevel: 3 });
  });

  it('마스코트 EXP는 합산하고 최근 날짜를 택한다', () => {
    expect(
      mergeMascotExp(
        { totalExp: 40, lastExpDate: '2026-11-03' },
        { totalExp: 100, lastExpDate: '2026-10-20' },
      ),
    ).toEqual({ totalExp: 140, lastExpDate: '2026-11-03' });
  });

  it('시험 결과는 최신순 50개로 제한한다', () => {
    const guest = Array.from({ length: 40 }, (_, i) => ({
      id: `g${i}`,
      completed_at: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    }));
    const account = Array.from({ length: 40 }, (_, i) => ({
      id: `a${i}`,
      completed_at: new Date(Date.UTC(2026, 5, i + 1)).toISOString(),
    }));
    const merged = mergeExamSessions(guest, account);
    expect(merged).toHaveLength(50);
    expect(merged[0].id).toBe('a39');
  });

  it('마지막 연습일은 더 최근 값을 택한다', () => {
    expect(mergeLastPracticeDate('Mon Nov 02 2026', 'Tue Nov 03 2026')).toBe('Tue Nov 03 2026');
    expect(mergeLastPracticeDate(null, 'Tue Nov 03 2026')).toBe('Tue Nov 03 2026');
    expect(mergeLastPracticeDate('Mon Nov 02 2026', null)).toBe('Mon Nov 02 2026');
  });
});

describe('migrateGuestDataToAccount', () => {
  it('게스트 데이터가 없으면 아무것도 하지 않는다', async () => {
    const storage = memoryStorage({ '@melodygen_recent_activity_u1': '[]' });
    expect(await hasGuestData(storage)).toBe(false);
    const result = await migrateGuestDataToAccount(storage, 'u1');
    expect(result.migrated).toBe(false);
    expect(storage.data.size).toBe(1);
  });

  it('게스트 키를 계정 키로 병합하고 게스트 키를 지운다', async () => {
    const storage = memoryStorage({
      '@melodygen_recent_activity_guest': JSON.stringify([rec('g1', '2026-11-01T10:00:00Z')]),
      '@melodygen_recent_activity_u1': JSON.stringify([rec('a1', '2026-11-02T10:00:00Z')]),
      '@melodygen_skill_profile_guest': JSON.stringify({ partPracticeLevel: 5 }),
      '@melodygen_mascot_exp_guest': JSON.stringify({ totalExp: 25, lastExpDate: '2026-11-01' }),
      '@melodygen_last_practice_date_guest': 'Sun Nov 01 2026',
      '@melodygen_daily_exp_rewarded_guest': JSON.stringify({ date: 'Sun Nov 01 2026', count: 2 }),
      '@melodygen_exam_sessions_guest': JSON.stringify([
        { id: 'e1', completed_at: '2026-11-01T00:00:00Z' },
      ]),
      '@melodygen_beginner_course_guest': JSON.stringify({
        completedLessonIds: ['day1_pitch_direction'],
        lessonResults: {
          day1_pitch_direction: { completedAt: '2026-11-01T00:00:00Z', correct: 4, total: 5 },
        },
        rewardedLessonIds: ['day1_pitch_direction'],
        courseRewarded: false,
      }),
      '@melodygen_beginner_course_u1': JSON.stringify({
        completedLessonIds: ['day2_long_short'],
        lessonResults: {
          day2_long_short: { completedAt: '2026-10-01T00:00:00Z', correct: 5, total: 5 },
        },
        rewardedLessonIds: ['day2_long_short'],
        courseRewarded: false,
      }),
    });

    const result = await migrateGuestDataToAccount(storage, 'u1');

    expect(result).toEqual({ migrated: true, practiceRecords: 1, examSessions: 1 });
    expect(await hasGuestData(storage)).toBe(false);
    expect(JSON.parse(storage.data.get('@melodygen_recent_activity_u1')!)).toHaveLength(2);
    expect(JSON.parse(storage.data.get('@melodygen_skill_profile_u1')!)).toEqual({
      partPracticeLevel: 5,
    });
    expect(JSON.parse(storage.data.get('@melodygen_mascot_exp_u1')!)).toEqual({
      totalExp: 25,
      lastExpDate: '2026-11-01',
    });
    expect(storage.data.get('@melodygen_last_practice_date_u1')).toBe('Sun Nov 01 2026');
    expect(JSON.parse(storage.data.get('@melodygen_daily_exp_rewarded_u1')!)).toEqual({
      date: 'Sun Nov 01 2026',
      count: 2,
    });
    expect(JSON.parse(storage.data.get('@melodygen_exam_sessions_u1')!)).toHaveLength(1);
    const course = JSON.parse(storage.data.get('@melodygen_beginner_course_u1')!);
    expect(course.completedLessonIds.sort()).toEqual(['day1_pitch_direction', 'day2_long_short']);
    expect(course.rewardedLessonIds).toHaveLength(2);
  });

  it('깨진 JSON은 건너뛰고 나머지는 이관한다', async () => {
    const storage = memoryStorage({
      '@melodygen_recent_activity_guest': '{not json',
      '@melodygen_mascot_exp_guest': JSON.stringify({ totalExp: 10, lastExpDate: '2026-11-01' }),
    });
    const result = await migrateGuestDataToAccount(storage, 'u1');
    expect(result.migrated).toBe(true);
    expect(storage.data.has('@melodygen_recent_activity_u1')).toBe(false);
    expect(JSON.parse(storage.data.get('@melodygen_mascot_exp_u1')!).totalExp).toBe(10);
  });

  it('게스트 ID로는 이관하지 않는다', async () => {
    const storage = memoryStorage({ '@melodygen_mascot_exp_guest': '{"totalExp":1}' });
    const result = await migrateGuestDataToAccount(storage, GUEST_STORAGE_ID);
    expect(result.migrated).toBe(false);
  });
});
