import {
  BEGINNER_LESSONS,
  EMPTY_BEGINNER_PROGRESS,
  applyBeginnerLessonResult,
  generateBeginnerLessonQuestions,
  generateBeginnerQuestion,
  getNextBeginnerLessonId,
  isBeginnerCourseComplete,
  isBeginnerLessonUnlocked,
  mergeBeginnerProgress,
  normalizeBeginnerProgress,
  type BeginnerQuestionKind,
} from '../lib/beginnerCourse';

const KINDS: BeginnerQuestionKind[] = [
  'pitchDirection',
  'longShort',
  'leapSize',
  'leapName',
  'majorMinor',
  'rhythmPattern',
  'firstMelody',
];

describe('귀 열기 코스 문제 생성', () => {
  KINDS.forEach((kind) => {
    it(`${kind}: 보기마다 소리가 있고 정답이 보기에 포함된다`, () => {
      for (let i = 0; i < 20; i++) {
        const q = generateBeginnerQuestion(kind);
        expect(q.kind).toBe(kind);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.choices.length).toBeLessThanOrEqual(3);
        expect(new Set(q.choices.map((c) => c.id)).size).toBe(q.choices.length);
        const correct = q.choices.find((c) => c.id === q.correctId);
        expect(correct).toBeDefined();
        expect(correct!.abc).toBe(q.abc);
        q.choices.forEach((c) => {
          expect(c.abc).toContain('K:');
          expect(c.labelKey).toMatch(/^choices\./);
        });
        expect(q.explanationKey).toMatch(/^explain\./);
        expect(q.promptKey).toMatch(/^prompts\./);
      }
    });
  });

  it('올라감/내려감/같음 문제의 두 번째 음이 방향과 맞는다', () => {
    const order = [
      'C',
      '^C',
      'D',
      '^D',
      'E',
      'F',
      '^F',
      'G',
      '^G',
      'A',
      '^A',
      'B',
      'c',
      '^c',
      'd',
      '^d',
      'e',
    ];
    for (let i = 0; i < 30; i++) {
      const q = generateBeginnerQuestion('pitchDirection');
      const body = q.abc.split('\n').pop()!;
      const [first, second] = body
        .replace('|]', '')
        .trim()
        .split(/\s+/)
        .map((n) => n.replace(/\d/g, ''));
      const diff = order.indexOf(second) - order.indexOf(first);
      if (q.correctId === 'up') expect(diff).toBeGreaterThan(0);
      if (q.correctId === 'down') expect(diff).toBeLessThan(0);
      if (q.correctId === 'same') expect(diff).toBe(0);
    }
  });

  it('레슨 문제는 종류 목록을 순환한다', () => {
    const qs = generateBeginnerLessonQuestions(['leapSize', 'leapName'], 5);
    expect(qs.map((q) => q.kind)).toEqual([
      'leapSize',
      'leapName',
      'leapSize',
      'leapName',
      'leapSize',
    ]);
  });

  it('3음 선율 보기는 길이가 같다', () => {
    for (let i = 0; i < 20; i++) {
      const q = generateBeginnerQuestion('firstMelody');
      const noteCount = (abc: string) =>
        abc
          .split('\n')
          .pop()!
          .split(/\s+/)
          .filter((n) => /^[A-Ga-g]/.test(n)).length;
      const n = noteCount(q.abc);
      q.choices.forEach((c) => expect(noteCount(c.abc)).toBe(n));
    }
  });
});

describe('귀 열기 코스 진행 상태', () => {
  it('7일 레슨이 day 순서로 정의되어 있다', () => {
    expect(BEGINNER_LESSONS.map((l) => l.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(BEGINNER_LESSONS.map((l) => l.id)).size).toBe(7);
  });

  it('완료한 레슨 다음 레슨이 열리고 다음 레슨 ID를 돌려준다', () => {
    let p = EMPTY_BEGINNER_PROGRESS;
    expect(getNextBeginnerLessonId(p)).toBe('day1_pitch_direction');
    expect(isBeginnerLessonUnlocked(p, 'day1_pitch_direction')).toBe(true);
    expect(isBeginnerLessonUnlocked(p, 'day2_long_short')).toBe(false);

    p = applyBeginnerLessonResult(p, 'day1_pitch_direction', {
      completedAt: '2026-11-03T00:00:00Z',
      correct: 3,
      total: 5,
    });
    expect(getNextBeginnerLessonId(p)).toBe('day2_long_short');
    expect(isBeginnerLessonUnlocked(p, 'day2_long_short')).toBe(true);
    expect(isBeginnerCourseComplete(p)).toBe(false);
  });

  it('재도전 시 더 나은 점수만 남긴다', () => {
    let p = applyBeginnerLessonResult(EMPTY_BEGINNER_PROGRESS, 'day1_pitch_direction', {
      completedAt: '2026-11-03T00:00:00Z',
      correct: 5,
      total: 5,
    });
    p = applyBeginnerLessonResult(p, 'day1_pitch_direction', {
      completedAt: '2026-11-04T00:00:00Z',
      correct: 2,
      total: 5,
    });
    expect(p.lessonResults.day1_pitch_direction).toEqual({
      completedAt: '2026-11-04T00:00:00Z',
      correct: 5,
      total: 5,
    });
    expect(p.completedLessonIds).toHaveLength(1);
  });

  it('모든 레슨을 끝내면 코스 완료다', () => {
    const p = BEGINNER_LESSONS.reduce(
      (acc, l) => applyBeginnerLessonResult(acc, l.id, { completedAt: 'x', correct: 1, total: 1 }),
      EMPTY_BEGINNER_PROGRESS,
    );
    expect(isBeginnerCourseComplete(p)).toBe(true);
    expect(getNextBeginnerLessonId(p)).toBeNull();
  });

  it('깨진 저장값은 빈 진행 상태로 정규화한다', () => {
    expect(normalizeBeginnerProgress('oops')).toEqual(EMPTY_BEGINNER_PROGRESS);
    expect(normalizeBeginnerProgress({ completedLessonIds: 'x' })).toEqual(EMPTY_BEGINNER_PROGRESS);
  });

  it('게스트와 계정 진행을 합칠 때 완료 목록은 합집합, 결과는 더 나은 쪽', () => {
    const guest = applyBeginnerLessonResult(EMPTY_BEGINNER_PROGRESS, 'day1_pitch_direction', {
      completedAt: 'g',
      correct: 5,
      total: 5,
    });
    const account = applyBeginnerLessonResult(EMPTY_BEGINNER_PROGRESS, 'day1_pitch_direction', {
      completedAt: 'a',
      correct: 2,
      total: 5,
    });
    const merged = mergeBeginnerProgress(guest, account);
    expect(merged.lessonResults.day1_pitch_direction.correct).toBe(5);
    expect(merged.completedLessonIds).toEqual(['day1_pitch_direction']);
  });
});
