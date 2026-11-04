// ─────────────────────────────────────────────────────────────
// 3분 레벨 테스트 — 진행(계단식 난이도)·결과 산출·저장 정규화 (순수 함수)
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentDifficulty } from '../../types/content';
import { LEVEL_TEST_AREAS, type LevelTestArea, type LevelTestAreaConfig } from './config';

export interface LevelTestStep {
  area: LevelTestArea;
  category: ContentCategory;
  difficulty: ContentDifficulty;
  /** 난이도 사다리에서의 위치 (0부터) */
  difficultyIndex: number;
  /** 영역 안에서 몇 번째 문항인지 (0부터) */
  questionInArea: number;
  /** 전체 몇 번째 문항인지 (0부터) */
  ordinal: number;
}

export interface LevelTestAnswer {
  area: LevelTestArea;
  difficultyIndex: number;
  correct: boolean;
}

export interface LevelTestSession {
  answers: LevelTestAnswer[];
  areaIndex: number;
  questionInArea: number;
  difficultyIndex: number;
}

export function createLevelTestSession(): LevelTestSession {
  return { answers: [], areaIndex: 0, questionInArea: 0, difficultyIndex: 0 };
}

export function isLevelTestDone(session: LevelTestSession): boolean {
  return session.areaIndex >= LEVEL_TEST_AREAS.length;
}

export function currentLevelTestStep(session: LevelTestSession): LevelTestStep | null {
  if (isLevelTestDone(session)) return null;
  const cfg = LEVEL_TEST_AREAS[session.areaIndex];
  return {
    area: cfg.area,
    category: cfg.category,
    difficulty: cfg.difficulties[session.difficultyIndex],
    difficultyIndex: session.difficultyIndex,
    questionInArea: session.questionInArea,
    ordinal: session.answers.length,
  };
}

/** 계단식: 맞히면 한 단계 위, 틀리면 한 단계 아래 (사다리 범위 안에서) */
export function nextDifficultyIndex(
  cfg: LevelTestAreaConfig,
  currentIndex: number,
  correct: boolean,
): number {
  const max = cfg.difficulties.length - 1;
  return correct ? Math.min(currentIndex + 1, max) : Math.max(currentIndex - 1, 0);
}

export function answerLevelTest(session: LevelTestSession, correct: boolean): LevelTestSession {
  if (isLevelTestDone(session)) return session;
  const cfg = LEVEL_TEST_AREAS[session.areaIndex];
  const answers = [
    ...session.answers,
    { area: cfg.area, difficultyIndex: session.difficultyIndex, correct },
  ];
  const nextQuestion = session.questionInArea + 1;
  if (nextQuestion >= cfg.questionCount) {
    return { answers, areaIndex: session.areaIndex + 1, questionInArea: 0, difficultyIndex: 0 };
  }
  return {
    answers,
    areaIndex: session.areaIndex,
    questionInArea: nextQuestion,
    difficultyIndex: nextDifficultyIndex(cfg, session.difficultyIndex, correct),
  };
}

// ─────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────

export type LevelTestOverall = 'beginner' | 'elementary' | 'intermediate' | 'advanced';

export interface LevelTestAreaResult {
  area: LevelTestArea;
  category: ContentCategory;
  correct: number;
  total: number;
  /** 맞힌 문제 중 가장 높은 단계 (0부터). 하나도 못 맞히면 -1 */
  levelIndex: number;
  /** 사다리 길이 (화면의 레벨 막대용) */
  levelCount: number;
  /** 추천 시작 난이도 */
  recommendedDifficulty: ContentDifficulty;
}

export interface LevelTestResult {
  version: 1;
  takenAt: string;
  /** 전체 정답률 0~100 */
  score: number;
  overall: LevelTestOverall;
  /** 귀 열기 코스부터 권할지 */
  recommendCourse: boolean;
  areas: LevelTestAreaResult[];
}

export function estimateAreaLevelIndex(answers: LevelTestAnswer[]): number {
  return answers.reduce((best, a) => (a.correct ? Math.max(best, a.difficultyIndex) : best), -1);
}

export function overallFromScore(score: number): LevelTestOverall {
  if (score < 35) return 'beginner';
  if (score < 60) return 'elementary';
  if (score < 85) return 'intermediate';
  return 'advanced';
}

export function buildLevelTestResult(
  answers: LevelTestAnswer[],
  takenAt: string = new Date().toISOString(),
): LevelTestResult {
  const areas: LevelTestAreaResult[] = LEVEL_TEST_AREAS.map((cfg) => {
    const mine = answers.filter((a) => a.area === cfg.area);
    const levelIndex = estimateAreaLevelIndex(mine);
    return {
      area: cfg.area,
      category: cfg.category,
      correct: mine.filter((a) => a.correct).length,
      total: cfg.questionCount,
      levelIndex,
      levelCount: cfg.difficulties.length,
      recommendedDifficulty: cfg.difficulties[Math.max(0, levelIndex)],
    };
  });

  const total = areas.reduce((s, a) => s + a.total, 0);
  const correct = areas.reduce((s, a) => s + a.correct, 0);
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const overall = overallFromScore(score);
  const interval = areas.find((a) => a.area === 'interval');
  const recommendCourse = overall === 'beginner' || (interval ? interval.levelIndex < 0 : false);

  return { version: 1, takenAt, score, overall, recommendCourse, areas };
}

/** 저장값 정규화. 구조가 깨졌으면 null */
export function normalizeLevelTestResult(raw: unknown): LevelTestResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<LevelTestResult>;
  if (typeof r.takenAt !== 'string' || !Array.isArray(r.areas)) return null;
  const areas = r.areas.filter(
    (a): a is LevelTestAreaResult =>
      !!a &&
      typeof a === 'object' &&
      typeof a.area === 'string' &&
      typeof a.recommendedDifficulty === 'string' &&
      typeof a.levelIndex === 'number',
  );
  if (areas.length === 0) return null;
  const score = typeof r.score === 'number' ? r.score : 0;
  return {
    version: 1,
    takenAt: r.takenAt,
    score,
    overall: r.overall ?? overallFromScore(score),
    recommendCourse: r.recommendCourse === true,
    areas,
  };
}

/** 게스트 → 계정 이관: 더 최근 결과를 남긴다. */
export function mergeLevelTestResults(
  guest: LevelTestResult | null,
  account: LevelTestResult | null,
): LevelTestResult | null {
  if (!guest) return account;
  if (!account) return guest;
  return new Date(guest.takenAt).getTime() > new Date(account.takenAt).getTime() ? guest : account;
}

/** 카테고리의 추천 시작 난이도 (결과에 없는 카테고리는 null) */
export function recommendedDifficultyFor(
  result: LevelTestResult | null,
  category: ContentCategory,
): ContentDifficulty | null {
  if (!result) return null;
  const area = result.areas.find((a) => a.category === category);
  return area ? area.recommendedDifficulty : null;
}
