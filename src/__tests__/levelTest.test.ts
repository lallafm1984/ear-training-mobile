jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ko', languageTag: 'ko-KR' }],
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

import {
  LEVEL_TEST_AREAS,
  LEVEL_TEST_TOTAL_QUESTIONS,
  answerLevelTest,
  buildLevelTestQuestion,
  buildLevelTestResult,
  createLevelTestSession,
  currentLevelTestStep,
  estimateAreaLevelIndex,
  isLevelTestDone,
  mergeLevelTestResults,
  normalizeLevelTestResult,
  recommendedDifficultyFor,
  type LevelTestAnswer,
} from '../lib/levelTest';

describe('레벨 테스트 진행', () => {
  it('영역 순서대로 정해진 문항 수를 낸 뒤 끝난다', () => {
    let s = createLevelTestSession();
    const seen: string[] = [];
    while (!isLevelTestDone(s)) {
      const step = currentLevelTestStep(s)!;
      seen.push(step.area);
      s = answerLevelTest(s, true);
    }
    expect(seen).toHaveLength(LEVEL_TEST_TOTAL_QUESTIONS);
    expect(seen).toEqual(
      LEVEL_TEST_AREAS.flatMap((a) => Array.from({ length: a.questionCount }, () => a.area)),
    );
    expect(currentLevelTestStep(s)).toBeNull();
    expect(answerLevelTest(s, true)).toBe(s);
  });

  it('맞히면 한 단계 올라가고 틀리면 내려가며 사다리 범위를 벗어나지 않는다', () => {
    let s = createLevelTestSession(); // interval, 4문항, 사다리 4단
    expect(currentLevelTestStep(s)!.difficulty).toBe('interval_1');
    s = answerLevelTest(s, true);
    expect(currentLevelTestStep(s)!.difficulty).toBe('interval_2');
    s = answerLevelTest(s, false);
    expect(currentLevelTestStep(s)!.difficulty).toBe('interval_1');
    s = answerLevelTest(s, false);
    expect(currentLevelTestStep(s)!.difficulty).toBe('interval_1');
    s = answerLevelTest(s, true);
    // 영역이 바뀌면 다시 1단계부터
    expect(currentLevelTestStep(s)!.area).toBe('chord');
    expect(currentLevelTestStep(s)!.difficulty).toBe('chord_2');
  });
});

describe('레벨 테스트 결과', () => {
  const answers = (spec: Array<[LevelTestAnswer['area'], number, boolean]>) =>
    spec.map(([area, difficultyIndex, correct]) => ({ area, difficultyIndex, correct }));

  it('맞힌 문제 중 가장 높은 단계를 영역 레벨로 본다', () => {
    expect(
      estimateAreaLevelIndex(
        answers([
          ['interval', 0, true],
          ['interval', 1, true],
          ['interval', 2, false],
          ['interval', 1, true],
        ]),
      ),
    ).toBe(1);
    expect(estimateAreaLevelIndex(answers([['key', 0, false]]))).toBe(-1);
  });

  it('전부 맞히면 advanced, 최고 단계 추천, 코스 권유 없음', () => {
    let s = createLevelTestSession();
    while (!isLevelTestDone(s)) s = answerLevelTest(s, true);
    const r = buildLevelTestResult(s.answers, '2026-11-03T00:00:00Z');
    expect(r.score).toBe(100);
    expect(r.overall).toBe('advanced');
    expect(r.recommendCourse).toBe(false);
    expect(recommendedDifficultyFor(r, 'interval')).toBe('interval_4');
    expect(recommendedDifficultyFor(r, 'chord')).toBe('chord_4');
    expect(recommendedDifficultyFor(r, 'key')).toBe('key_3');
    expect(recommendedDifficultyFor(r, 'melody')).toBeNull();
  });

  it('전부 틀리면 beginner, 1단계 추천, 귀 열기 코스 권유', () => {
    let s = createLevelTestSession();
    while (!isLevelTestDone(s)) s = answerLevelTest(s, false);
    const r = buildLevelTestResult(s.answers);
    expect(r.score).toBe(0);
    expect(r.overall).toBe('beginner');
    expect(r.recommendCourse).toBe(true);
    r.areas.forEach((a) => {
      expect(a.levelIndex).toBe(-1);
      expect(a.recommendedDifficulty).toBe(
        LEVEL_TEST_AREAS.find((c) => c.area === a.area)!.difficulties[0],
      );
    });
  });

  it('음정을 하나도 못 맞히면 점수와 무관하게 코스를 권한다', () => {
    let s = createLevelTestSession();
    // interval 4문항 모두 오답, 나머지 모두 정답
    for (let i = 0; i < 4; i++) s = answerLevelTest(s, false);
    while (!isLevelTestDone(s)) s = answerLevelTest(s, true);
    const r = buildLevelTestResult(s.answers);
    expect(r.overall).toBe('intermediate');
    expect(r.recommendCourse).toBe(true);
  });

  it('저장값을 정규화하고 깨진 값은 null', () => {
    expect(normalizeLevelTestResult(null)).toBeNull();
    expect(normalizeLevelTestResult({ takenAt: 'x' })).toBeNull();
    expect(normalizeLevelTestResult({ takenAt: 'x', areas: [{}] })).toBeNull();
    const r = buildLevelTestResult([], '2026-11-03T00:00:00Z');
    const back = normalizeLevelTestResult(JSON.parse(JSON.stringify(r)));
    expect(back).toEqual(r);
  });

  it('이관 시 더 최근 결과를 남긴다', () => {
    const older = buildLevelTestResult([], '2026-10-01T00:00:00Z');
    const newer = buildLevelTestResult([], '2026-11-01T00:00:00Z');
    expect(mergeLevelTestResults(older, newer)).toBe(newer);
    expect(mergeLevelTestResults(newer, older)).toBe(newer);
    expect(mergeLevelTestResults(null, older)).toBe(older);
    expect(mergeLevelTestResults(older, null)).toBe(older);
  });
});

describe('레벨 테스트 문항', () => {
  it('모든 단계에서 소리·보기·정답이 갖춰진 문항을 만든다', () => {
    LEVEL_TEST_AREAS.forEach((cfg) => {
      cfg.difficulties.forEach((difficulty, difficultyIndex) => {
        for (let i = 0; i < 5; i++) {
          const q = buildLevelTestQuestion({
            area: cfg.area,
            category: cfg.category,
            difficulty,
            difficultyIndex,
            questionInArea: 0,
            ordinal: 0,
          });
          expect(q.abc.length).toBeGreaterThan(0);
          expect(q.choices.length).toBeGreaterThanOrEqual(2);
          expect(q.choices.some((c) => c.id === q.correctId)).toBe(true);
          expect(new Set(q.choices.map((c) => c.id)).size).toBe(q.choices.length);
          q.choices.forEach((c) => expect(c.label || c.labelKey).toBeTruthy());
          expect(q.prompt || q.promptKey).toBeTruthy();
        }
      });
    });
  });
});
