// ─────────────────────────────────────────────────────────────
// 트랙 시스템 설정 — 부분연습 + 종합연습
// ─────────────────────────────────────────────────────────────

import type { Difficulty, BassDifficulty, GeneratorOptions } from './scoreGenerator';
import type { TrackType } from '../theme/colors';

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

export type PartPracticeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ComprehensiveLevel = 1 | 2 | 3 | 4;

export type TrackLevel = PartPracticeLevel | ComprehensiveLevel;

export interface TrackLevelConfig {
  difficulty: Difficulty;
  keySignature: string | 'random';
  timeSignature: string | 'random';
  measures: number;
  useGrandStaff: boolean;
  bassDifficulty?: BassDifficulty;
  /** LEVEL_PARAMS 오버라이드 */
  levelOverrides?: Record<string, number | number[] | string[]>;
}

export interface TrackMeta {
  type: TrackType;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  levels: TrackLevelMeta[];
}

export interface TrackLevelMeta {
  level: number;
  name: string;
  description: string;
  /** Pro 이상 필요 여부 */
  requiresPro: boolean;
}

// ─────────────────────────────────────────────────────────────
// 조성 풀
// ─────────────────────────────────────────────────────────────

const KEY_POOL_K1 = ['C', 'G', 'F', 'Am', 'Dm', 'Em'];
const KEY_POOL_K2 = [
  ...KEY_POOL_K1,
  'D', 'Bb', 'A', 'Eb', 'Bm', 'Gm', 'Cm',
];
const KEY_POOL_K3 = [
  ...KEY_POOL_K2,
  'E', 'Ab', 'B', 'Db', 'F#m', 'C#m', 'Fm', 'Bbm',
];
const KEY_POOL_K4 = [
  ...KEY_POOL_K3,
  'F#', 'Gb', 'Cb', 'C#', 'G#m', 'D#m', 'Abm', 'Ebm',
];

export const KEY_POOLS: Record<number, string[]> = {
  1: KEY_POOL_K1,
  2: KEY_POOL_K2,
  3: KEY_POOL_K3,
  4: KEY_POOL_K4,
};

// ─────────────────────────────────────────────────────────────
// 큰보표 베이스 최소 난이도 (선율 난이도 연동)
// ─────────────────────────────────────────────────────────────

export function getMinBassDifficulty(difficulty: Difficulty): BassDifficulty {
  if (difficulty.startsWith('advanced'))      return 'bass_3';
  if (difficulty.startsWith('intermediate'))  return 'bass_2';
  return 'bass_1';
}

export function getAllowedBassDifficulties(difficulty: Difficulty): BassDifficulty[] {
  const all: BassDifficulty[] = ['bass_1', 'bass_2', 'bass_3', 'bass_4'];
  const min = getMinBassDifficulty(difficulty);
  return all.slice(all.indexOf(min));
}

// ─────────────────────────────────────────────────────────────
// 부분연습 트랙 — 9단계
// 해당 레벨 고유 요소 + 기본(2분/4분)만 사용
// C장조 고정, 4/4 고정, 4마디, 큰보표 비활성
// ─────────────────────────────────────────────────────────────

const PART_PRACTICE_CONFIGS: Record<PartPracticeLevel, TrackLevelConfig> = {
  // 1단계: 2분 + 4분 (기본)
  1: {
    difficulty: 'beginner_1', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0, tieProb: 0,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 2단계: 8분음표
  2: {
    difficulty: 'beginner_3', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0, tieProb: 0,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 3단계: 점4분음표
  3: {
    difficulty: 'intermediate_1', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0.80, tieProb: 0,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 4단계: 붙임줄
  4: {
    difficulty: 'intermediate_2', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0, tieProb: 0.40,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 5단계: 당김음
  5: {
    difficulty: 'intermediate_2', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0.40, dottedProb: 0, tieProb: 0,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 6단계: 16분음표
  6: {
    difficulty: 'intermediate_3', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0, tieProb: 0,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 7단계: 점8분음표
  7: {
    difficulty: 'advanced_1', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0.45, tieProb: 0,
      tripletProb: 0, chromaticProb: 0,
    },
  },
  // 8단계: 임시표
  8: {
    difficulty: 'advanced_2', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0, tieProb: 0,
      tripletProb: 0, chromaticBudget: [2, 4], chromaticProb: 0.20,
    },
  },
  // 9단계: 셋잇단음표
  9: {
    difficulty: 'advanced_3', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      stepwiseProb: 0.80, maxInterval: 4, maxLeap: 4,
      syncopationProb: 0, dottedProb: 0, tieProb: 0,
      tripletProb: 0.60, tripletBudget: [2, 4], chromaticProb: 0,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// 종합연습 트랙 — 4단계 (모두 8마디)
// ─────────────────────────────────────────────────────────────

interface ComprehensiveConfig {
  difficultyPool: Difficulty[];
  keyPool: string[];
  timePool: string[];
  measures: number;
  allowGrandStaff: boolean;
  bassPool?: BassDifficulty[];
}

const COMPREHENSIVE_CONFIGS: Record<ComprehensiveLevel, ComprehensiveConfig> = {
  // 1단계: 기초 종합 (부분연습 L1~2 범위)
  1: {
    difficultyPool: ['beginner_1', 'beginner_2', 'beginner_3'],
    keyPool: KEY_POOL_K1,
    timePool: ['4/4', '3/4'],
    measures: 8,
    allowGrandStaff: false,
  },
  // 2단계: 중급 종합 (부분연습 L1~5 범위)
  2: {
    difficultyPool: ['beginner_3', 'intermediate_1', 'intermediate_2'],
    keyPool: KEY_POOL_K2,
    timePool: ['4/4', '3/4', '6/8'],
    measures: 8,
    allowGrandStaff: false,
  },
  // 3단계: 고급 종합 (부분연습 L1~7 범위)
  3: {
    difficultyPool: ['intermediate_1', 'intermediate_2', 'intermediate_3', 'advanced_1'],
    keyPool: KEY_POOL_K3,
    timePool: ['4/4', '3/4', '2/4', '6/8', '9/8'],
    measures: 8,
    allowGrandStaff: true,
    bassPool: ['bass_2', 'bass_3'],
  },
  // 4단계: 완전 종합 (부분연습 L1~9 전체)
  4: {
    difficultyPool: ['intermediate_3', 'advanced_1', 'advanced_2', 'advanced_3'],
    keyPool: KEY_POOL_K4,
    timePool: ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '2/2'],
    measures: 8,
    allowGrandStaff: true,
    bassPool: ['bass_3', 'bass_4'],
  },
};

// ─────────────────────────────────────────────────────────────
// 트랙 메타데이터 (UI 표시용)
// ─────────────────────────────────────────────────────────────

export const TRACK_META: Record<TrackType, TrackMeta> = {
  partPractice: {
    type: 'partPractice',
    name: '부분연습',
    description: '해당 요소 + 기본음표(2분/4분)만으로 집중 연습',
    icon: 'target',
    maxLevel: 9,
    levels: [
      { level: 1, name: '1단계', description: '2분음표·4분음표',         requiresPro: false },
      { level: 2, name: '2단계', description: '8분음표',                 requiresPro: false },
      { level: 3, name: '3단계', description: '점4분음표',               requiresPro: false },
      { level: 4, name: '4단계', description: '붙임줄',                  requiresPro: false },
      { level: 5, name: '5단계', description: '당김음',                  requiresPro: false },
      { level: 6, name: '6단계', description: '16분음표',                requiresPro: true },
      { level: 7, name: '7단계', description: '점8분음표',               requiresPro: true },
      { level: 8, name: '8단계', description: '임시표',                  requiresPro: true },
      { level: 9, name: '9단계', description: '셋잇단음표',              requiresPro: true },
    ],
  },
  comprehensive: {
    type: 'comprehensive',
    name: '종합연습',
    description: '리듬+음정+조성 결합 실전 훈련',
    icon: 'star',
    maxLevel: 4,
    levels: [
      { level: 1, name: '1단계', description: '기초 종합 · 기본+8분',                     requiresPro: false },
      { level: 2, name: '2단계', description: '중급 종합 · +점4분·붙임줄·당김음',          requiresPro: true },
      { level: 3, name: '3단계', description: '고급 종합 · +16분·점8분',                   requiresPro: true },
      { level: 4, name: '4단계', description: '완전 종합 · 전체 요소',                     requiresPro: true },
    ],
  },
};

export const ALL_TRACKS: TrackType[] = ['partPractice', 'comprehensive'];

// ─────────────────────────────────────────────────────────────
// 설정 조회 함수
// ─────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 트랙/레벨 → GeneratorOptions 변환
 * 종합 트랙은 내부 풀에서 랜덤 선택
 */
export function buildGeneratorOptions(
  track: TrackType,
  level: number,
): GeneratorOptions & { levelOverrides?: Record<string, unknown> } {
  if (track === 'comprehensive') {
    const cfg = COMPREHENSIVE_CONFIGS[level as ComprehensiveLevel];
    const difficulty = pickRandom(cfg.difficultyPool);
    const keySignature = pickRandom(cfg.keyPool);
    const timeSignature = pickRandom(cfg.timePool);
    const useGrandStaff = cfg.allowGrandStaff && Math.random() > 0.5;
    const bassDifficulty = useGrandStaff && cfg.bassPool
      ? pickRandom(cfg.bassPool) : undefined;

    return {
      difficulty, keySignature, timeSignature,
      measures: cfg.measures,
      useGrandStaff, bassDifficulty,
    };
  }

  // partPractice
  const cfg = PART_PRACTICE_CONFIGS[level as PartPracticeLevel];
  if (!cfg) throw new Error(`Invalid partPractice level: ${level}`);

  return {
    difficulty: cfg.difficulty,
    keySignature: cfg.keySignature,
    timeSignature: cfg.timeSignature,
    measures: cfg.measures,
    useGrandStaff: cfg.useGrandStaff,
    bassDifficulty: cfg.bassDifficulty,
    levelOverrides: cfg.levelOverrides,
    practiceMode: 'part',
    partPracticeLevel: level,
  };
}

// ─────────────────────────────────────────────────────────────
// Gen 비용 계산 (트랙 기반)
// ─────────────────────────────────────────────────────────────

const GEN_COST_TABLE: Record<Difficulty, number> = {
  beginner_1: 8, beginner_2: 10, beginner_3: 12,
  intermediate_1: 14, intermediate_2: 16, intermediate_3: 18,
  advanced_1: 18, advanced_2: 20, advanced_3: 22,
};

function measureExtraCost(measures: number): number {
  if (measures >= 16) return 6;
  if (measures >= 12) return 4;
  if (measures >= 8) return 2;
  return 0;
}

export function getTrackGenCost(track: TrackType, level: number): number {
  const opts = buildGeneratorOptions(track, level);
  return GEN_COST_TABLE[opts.difficulty] + measureExtraCost(opts.measures);
}

// ─────────────────────────────────────────────────────────────
// Quick Start 추천 알고리즘
// ─────────────────────────────────────────────────────────────

export interface UserSkillProfile {
  partPracticeLevel: number;
  comprehensiveLevel: number;
  recentAccuracy: number;
  streakDays: number;
  lastQuickTrack: TrackType | null;
  sameTrackCount: number;
}

export const DEFAULT_SKILL_PROFILE: UserSkillProfile = {
  partPracticeLevel: 1,
  comprehensiveLevel: 1,
  recentAccuracy: 0.6,
  streakDays: 0,
  lastQuickTrack: null,
  sameTrackCount: 0,
};

export interface QuickStartRecommendation {
  track: TrackType;
  level: number;
  maxLevel: number;
}

export function getQuickStartRecommendation(
  profile: UserSkillProfile,
): QuickStartRecommendation {
  // 각 트랙 진행률 계산
  const progress: { track: TrackType; ratio: number; level: number; max: number }[] = [
    { track: 'partPractice',  ratio: profile.partPracticeLevel / 9,   level: profile.partPracticeLevel,   max: 9 },
    { track: 'comprehensive', ratio: profile.comprehensiveLevel / 4,  level: profile.comprehensiveLevel,  max: 4 },
  ];

  // 가장 약한 트랙 (같은 트랙 3회 연속 시 순환)
  progress.sort((a, b) => a.ratio - b.ratio);

  let selected = progress[0];
  if (
    profile.lastQuickTrack === selected.track &&
    profile.sameTrackCount >= 2 &&
    progress.length > 1
  ) {
    selected = progress[1];
  }

  // 정확도 기반 레벨 조정
  let level = selected.level;
  if (profile.recentAccuracy >= 0.8 && level < selected.max) {
    level = level + 1;
  } else if (profile.recentAccuracy < 0.5 && level > 1) {
    level = level - 1;
  }

  return { track: selected.track, level, maxLevel: selected.max };
}
