// ─────────────────────────────────────────────────────────────
// 트랙 시스템 설정 — 기획서 v2.0 기반
// ─────────────────────────────────────────────────────────────

import type { Difficulty, BassDifficulty, GeneratorOptions } from './scoreGenerator';
import type { TrackType } from '../theme/colors';

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

export type RhythmLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type IntervalLevel = 1 | 2 | 3 | 4;
export type KeyLevel = 1 | 2 | 3 | 4;
export type ComprehensiveLevel = 1 | 2 | 3;

export type TrackLevel = RhythmLevel | IntervalLevel | KeyLevel | ComprehensiveLevel;

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
// 리듬 트랙 — 6레벨
// ─────────────────────────────────────────────────────────────

const RHYTHM_CONFIGS: Record<RhythmLevel, TrackLevelConfig> = {
  1: {
    difficulty: 'beginner_1', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: { maxInterval: 2 },
  },
  2: {
    difficulty: 'beginner_2', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: { maxInterval: 3 },
  },
  3: {
    difficulty: 'beginner_3', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: { maxInterval: 3 },
  },
  4: {
    difficulty: 'intermediate_2', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
  },
  5: {
    difficulty: 'intermediate_3', keySignature: 'C', timeSignature: '4/4',
    measures: 8, useGrandStaff: false,
  },
  6: {
    difficulty: 'advanced_3', keySignature: 'C', timeSignature: '4/4',
    measures: 8, useGrandStaff: false,
  },
};

// ─────────────────────────────────────────────────────────────
// 음정 트랙 — 4레벨
// ─────────────────────────────────────────────────────────────

const INTERVAL_CONFIGS: Record<IntervalLevel, TrackLevelConfig> = {
  1: {
    difficulty: 'beginner_1', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: { maxInterval: 2, stepwiseProb: 0.95, maxLeap: 2 },
  },
  2: {
    difficulty: 'beginner_3', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      maxInterval: 3, stepwiseProb: 0.82, maxLeap: 3,
      syncopationProb: 0, tieProb: 0, dottedProb: 0.15,
    },
  },
  3: {
    difficulty: 'intermediate_1', keySignature: 'C', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
    levelOverrides: {
      maxInterval: 5, stepwiseProb: 0.70, maxLeap: 5,
      syncopationProb: 0, tieProb: 0, dottedProb: 0.15,
    },
  },
  4: {
    difficulty: 'advanced_1', keySignature: 'C', timeSignature: '4/4',
    measures: 8, useGrandStaff: false,
    levelOverrides: {
      maxInterval: 8, stepwiseProb: 0.55, maxLeap: 8,
      syncopationProb: 0, tieProb: 0, dottedProb: 0.20,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// 조성 트랙 — 4레벨
// ─────────────────────────────────────────────────────────────

const KEY_CONFIGS: Record<KeyLevel, TrackLevelConfig> = {
  1: {
    difficulty: 'beginner_3', keySignature: 'random', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
  },
  2: {
    difficulty: 'beginner_3', keySignature: 'random', timeSignature: '4/4',
    measures: 4, useGrandStaff: false,
  },
  3: {
    difficulty: 'intermediate_1', keySignature: 'random', timeSignature: '4/4',
    measures: 8, useGrandStaff: false,
  },
  4: {
    difficulty: 'advanced_2', keySignature: 'random', timeSignature: '4/4',
    measures: 8, useGrandStaff: false,
  },
};

// ─────────────────────────────────────────────────────────────
// 종합 트랙 — 3레벨
// ─────────────────────────────────────────────────────────────

interface ComprehensiveConfig {
  difficultyPool: Difficulty[];
  keyPool: string[];
  timePool: string[];
  measureRange: [number, number];
  allowGrandStaff: boolean;
  bassPool?: BassDifficulty[];
}

const COMPREHENSIVE_CONFIGS: Record<ComprehensiveLevel, ComprehensiveConfig> = {
  1: {
    difficultyPool: ['beginner_1', 'beginner_2', 'beginner_3'],
    keyPool: KEY_POOL_K1,
    timePool: ['4/4', '3/4'],
    measureRange: [4, 4],
    allowGrandStaff: false,
  },
  2: {
    difficultyPool: ['beginner_3', 'intermediate_1', 'intermediate_2', 'intermediate_3'],
    keyPool: KEY_POOL_K2,
    timePool: ['4/4', '3/4', '6/8'],
    measureRange: [4, 8],
    allowGrandStaff: true,
    bassPool: ['bass_2', 'bass_3'],
  },
  3: {
    difficultyPool: ['intermediate_2', 'intermediate_3', 'advanced_1', 'advanced_2', 'advanced_3'],
    keyPool: KEY_POOL_K4,
    timePool: ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '2/2'],
    measureRange: [8, 16],
    allowGrandStaff: true,
    bassPool: ['bass_3', 'bass_4'],
  },
};

// ─────────────────────────────────────────────────────────────
// 트랙 메타데이터 (UI 표시용)
// ─────────────────────────────────────────────────────────────

export const TRACK_META: Record<TrackType, TrackMeta> = {
  rhythm: {
    type: 'rhythm',
    name: '리듬',
    description: 'C장조 고정, 리듬 패턴만 단계적으로 상승',
    icon: 'drum',
    maxLevel: 6,
    levels: [
      { level: 1, name: '기본 박',   description: '온·2분·4분음표',         requiresPro: false },
      { level: 2, name: '점음표',    description: '+ 점2분·점4분, 쉼표',    requiresPro: false },
      { level: 3, name: '8분음표',   description: '+ 8분·8분쉼표',          requiresPro: false },
      { level: 4, name: '당김음',    description: '+ 붙임줄, 당김음',       requiresPro: false },
      { level: 5, name: '16분음표',  description: '+ 16분·16분쉼표',        requiresPro: true },
      { level: 6, name: '셋잇단',    description: '+ 셋잇단음표, 점8분',    requiresPro: true },
    ],
  },
  interval: {
    type: 'interval',
    name: '음정',
    description: '단순 리듬 고정, 도약 폭만 단계적으로 상승',
    icon: 'music',
    maxLevel: 4,
    levels: [
      { level: 1, name: '순차',      description: '2도 이내',              requiresPro: false },
      { level: 2, name: '3도 도약',   description: '3도 포함',              requiresPro: false },
      { level: 3, name: '5도 도약',   description: '5도 포함',              requiresPro: false },
      { level: 4, name: '넓은 도약',  description: '8도(옥타브)까지',       requiresPro: true },
    ],
  },
  key: {
    type: 'key',
    name: '조성',
    description: '단순 리듬 고정, 조표 복잡도만 상승',
    icon: 'key',
    maxLevel: 4,
    levels: [
      { level: 1, name: '기본 조성',  description: 'C, G, F, Am 등 (♯♭ 0~1)', requiresPro: false },
      { level: 2, name: '2~3개 조표', description: 'D, Bb, Em 등 (♯♭ 2~3)',   requiresPro: false },
      { level: 3, name: '4~5개 조표', description: 'E, Ab, F#m 등',            requiresPro: true },
      { level: 4, name: '전체 조성',  description: '모든 24 조성 + 임시표',     requiresPro: true },
    ],
  },
  comprehensive: {
    type: 'comprehensive',
    name: '종합',
    description: '리듬+음정+조성 결합 실전 훈련',
    icon: 'star',
    maxLevel: 3,
    levels: [
      { level: 1, name: '기초 종합', description: '초급 범위 · 쉬운 조성',         requiresPro: false },
      { level: 2, name: '실전 종합', description: '중급 범위 · 6/8 포함 · 큰보표', requiresPro: true },
      { level: 3, name: '완전 종합', description: '고급 범위 · 전체 조성·박자',    requiresPro: true },
    ],
  },
};

export const ALL_TRACKS: TrackType[] = ['rhythm', 'interval', 'key', 'comprehensive'];

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
    const [minM, maxM] = cfg.measureRange;
    const measures = minM === maxM ? minM : pickRandom([minM, maxM]);
    const useGrandStaff = cfg.allowGrandStaff && Math.random() > 0.5;
    const bassDifficulty = useGrandStaff && cfg.bassPool
      ? pickRandom(cfg.bassPool) : undefined;

    return {
      difficulty, keySignature, timeSignature, measures,
      useGrandStaff, bassDifficulty,
    };
  }

  const configMap: Record<string, Record<number, TrackLevelConfig>> = {
    rhythm: RHYTHM_CONFIGS,
    interval: INTERVAL_CONFIGS,
    key: KEY_CONFIGS,
  };

  const cfg = configMap[track]?.[level];
  if (!cfg) throw new Error(`Invalid track/level: ${track}/${level}`);

  let keySignature = cfg.keySignature;
  if (keySignature === 'random') {
    // 조성 트랙: 레벨에 맞는 풀에서 선택
    const pool = track === 'key' ? (KEY_POOLS[level] ?? KEY_POOL_K1) : KEY_POOL_K1;
    keySignature = pickRandom(pool);
  }

  return {
    difficulty: cfg.difficulty,
    keySignature,
    timeSignature: cfg.timeSignature === 'random' ? '4/4' : cfg.timeSignature,
    measures: cfg.measures,
    useGrandStaff: cfg.useGrandStaff,
    bassDifficulty: cfg.bassDifficulty,
    levelOverrides: cfg.levelOverrides,
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
  rhythmLevel: number;
  intervalLevel: number;
  keyLevel: number;
  comprehensiveLevel: number;
  recentAccuracy: number;
  streakDays: number;
  lastQuickTrack: TrackType | null;
  sameTrackCount: number;
}

export const DEFAULT_SKILL_PROFILE: UserSkillProfile = {
  rhythmLevel: 1,
  intervalLevel: 1,
  keyLevel: 1,
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
  // 1. 각 트랙 진행률 계산
  const progress: { track: TrackType; ratio: number; level: number; max: number }[] = [
    { track: 'rhythm',        ratio: profile.rhythmLevel / 6,        level: profile.rhythmLevel,        max: 6 },
    { track: 'interval',      ratio: profile.intervalLevel / 4,      level: profile.intervalLevel,      max: 4 },
    { track: 'key',           ratio: profile.keyLevel / 4,           level: profile.keyLevel,           max: 4 },
    { track: 'comprehensive', ratio: profile.comprehensiveLevel / 3, level: profile.comprehensiveLevel, max: 3 },
  ];

  // 2. 가장 약한 트랙 (같은 트랙 3회 연속 시 순환)
  progress.sort((a, b) => a.ratio - b.ratio);

  let selected = progress[0];
  if (
    profile.lastQuickTrack === selected.track &&
    profile.sameTrackCount >= 2 &&
    progress.length > 1
  ) {
    selected = progress[1];
  }

  // 3. 정확도 기반 레벨 조정
  let level = selected.level;
  if (profile.recentAccuracy >= 0.8 && level < selected.max) {
    level = level + 1;
  } else if (profile.recentAccuracy < 0.5 && level > 1) {
    level = level - 1;
  }

  return { track: selected.track, level, maxLevel: selected.max };
}
