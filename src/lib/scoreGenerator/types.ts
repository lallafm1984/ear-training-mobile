import type { ScoreNote } from '../scoreUtils';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

/**
 * 9단계 난이도 체계:
 *   초급 1~3 (beginner_1/2/3)  → 문서 Level 1~3
 *   중급 1~3 (intermediate_1/2/3) → 문서 Level 3~4 사이, Level 4, Level 4~5 사이
 *   고급 1~3 (advanced_1/2/3) → 문서 Level 5, Level 5~6 사이, Level 6
 */
export type Difficulty =
  | 'beginner_1' | 'beginner_2' | 'beginner_3'
  | 'intermediate_1' | 'intermediate_2' | 'intermediate_3'
  | 'advanced_1' | 'advanced_2' | 'advanced_3';

export type BassDifficulty = 'bass_1' | 'bass_2' | 'bass_3' | 'bass_4';

/** 상위 카테고리 */
export type DifficultyCategory = 'beginner' | 'intermediate' | 'advanced';

export function getDifficultyCategory(d: Difficulty): DifficultyCategory {
  if (d.startsWith('beginner')) return 'beginner';
  if (d.startsWith('intermediate')) return 'intermediate';
  return 'advanced';
}

/** 난이도를 내부 수치 레벨(1~9)로 변환 */
export function difficultyLevel(d: Difficulty): number {
  const map: Record<Difficulty, number> = {
    beginner_1: 1, beginner_2: 2, beginner_3: 3,
    intermediate_1: 4, intermediate_2: 5, intermediate_3: 6,
    advanced_1: 7, advanced_2: 8, advanced_3: 9,
  };
  return map[d];
}

export interface GeneratorOptions {
  keySignature: string;
  timeSignature: string;
  difficulty: Difficulty;
  bassDifficulty?: BassDifficulty;
  measures: number;
  useGrandStaff: boolean;
  /** 부분연습 모드 */
  practiceMode?: 'part' | 'comprehensive';
  /** 부분연습 레벨 (1~9) — practiceMode === 'part' 일 때 사용 */
  partPracticeLevel?: number;
}

export interface GeneratedScore {
  trebleNotes: ScoreNote[];
  bassNotes: ScoreNote[];
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

// PITCH_ORDER, getBassBaseOctave, CHORD_TONES → imported from scoreUtils

/**
 * 9단계별 리듬 풀 (16분음표 단위) — 누적 도입
 *   L1: 온(16)·2분(8)·4분(4)
 *   L2: + 점2분(12) / 쉼표 도입
 *   L3: + 8분(2) / 8분쉼표
 *   L4: + 점4분(6) — 4·8분 비중 약간↑
 *   L5: 붙임줄 당김음 (L4보다 촘촘한 풀)
 *   L6: + 16분(1) — 8·16 비중↑
 *   L7–L9: 점4·4·점8·8·16 균형 (고급은 중급보다 긴 음가 비중 유지)
 */
export const DURATION_POOL: Record<Difficulty, number[]> = {
  // L1: 온·2분
  beginner_1:     [16, 8],
  // L2: 4분·점2분 (쉼표 포함)
  beginner_2:     [12, 8, 4],
  // L3: + 8분 (온음표 제외)
  beginner_3:     [12, 8, 4, 2],
  // L4: 점4분 중심 + 4·8 조금 더
  intermediate_1: [8, 6, 4, 4, 2, 2],
  // L5: L4와 동일 계열 (당김음·타이로 난이도 상승)
  intermediate_2: [8, 6, 4, 4, 2, 2],
  // L6: 16분 등장, 점4분·4분 비중으로 과밀 방지
  intermediate_3: [6, 6, 4, 4, 4, 4, 2, 2, 1],
  // L7–L9: 점4분·4분 중심, 점8·8·16 유지
  advanced_1:     [6, 6, 4, 4, 4, 3, 3, 2, 1],
  advanced_2:     [6, 6, 4, 4, 4, 3, 3, 2, 1],
  advanced_3:     [6, 6, 4, 4, 4, 3, 3, 2, 1],
};

// ────────────────────────────────────────────────────────────────
// Bass difficulty labels & params
// ────────────────────────────────────────────────────────────────

export const BASS_DIFF_LABELS: Record<BassDifficulty, string> = {
  bass_1: '1단계', bass_2: '2단계', bass_3: '3단계', bass_4: '4단계',
};

export const BASS_DIFF_DESC: Record<BassDifficulty, string> = {
  bass_1: '지속음 — 마디당 한 음 유지',
  bass_2: '순차진행 — 2도 순차 이동만',
  bass_3: '순차+도약 — 간헐적 5도 포함',
  bass_4: '혼합리듬 — 도약+리듬 변화',
};

export interface BassLevelParams {
  mode: 'pedal' | 'root_beat' | 'directed_step' | 'harmonic_half' | 'harmonic_mixed';
  durationPool: number[];
  minDur: number;
}

export const BASS_LEVEL_PARAMS: Record<BassDifficulty, BassLevelParams> = {
  bass_1: { mode: 'pedal',           durationPool: [16, 8], minDur: 8 },
  bass_2: { mode: 'harmonic_half',   durationPool: [8],     minDur: 8 },
  bass_3: { mode: 'harmonic_mixed',  durationPool: [8, 4],  minDur: 4 },
  bass_4: { mode: 'harmonic_mixed',  durationPool: [8, 4, 2], minDur: 2 },
};

// ────────────────────────────────────────────────────────────────
// 난이도별 파라미터 테이블 (문서 기반)
// ────────────────────────────────────────────────────────────────

export interface LevelParams {
  // 선율
  maxInterval: number;          // 최대 음정 (도 단위)
  stepwiseProb: number;         // 순차진행 확률
  maxLeap: number;              // 허용 도약 (도)
  chromaticBudget: [number, number]; // 반음계 임시표 [min, max]
  chromaticProb: number;        // 노트당 임시표 확률
  // 리듬
  syncopationProb: number;      // 당김음 확률
  tripletBudget: [number, number]; // 셋잇단 [min, max]
  tripletProb: number;          // 셋잇단 삽입 확률
  /** 붙임줄(같은 음·타이): 직전 음과 높이가 같을 때만 적용 */
  tieProb: number;
  restProb: number;             // 쉼표 확률
  dottedProb: number;           // 점음표 확률
  // 2성부
  contraryMotionRatio: number;  // 반진행 비율
  bassIndependence: number;     // 베이스 리듬 독립도 (0~1)
  voiceCrossingMax: number;     // 성부 교차 최대 횟수
  consonanceRatio: number;      // 협화음 비율
  // 종지
  cadenceType: string[];        // 사용 가능한 종지 유형
  // 함정
  maxTraps: number;             // 연습 1회당 최대 함정 수
}

export const LEVEL_PARAMS: Record<Difficulty, LevelParams> = {
  // ── L1: 온·2분·4분 ──
  beginner_1: {
    maxInterval: 3, stepwiseProb: 0.95, maxLeap: 3,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0, dottedProb: 0,
    contraryMotionRatio: 0.30, bassIndependence: 0,
    voiceCrossingMax: 0, consonanceRatio: 1.0,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── L2: 점2분·쉼표 ──
  beginner_2: {
    maxInterval: 4, stepwiseProb: 0.88, maxLeap: 4,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0.20, dottedProb: 0.35,
    contraryMotionRatio: 0.30, bassIndependence: 0,
    voiceCrossingMax: 0, consonanceRatio: 1.0,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── L3: 8분·8분쉼표 ──
  beginner_3: {
    maxInterval: 5, stepwiseProb: 0.82, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0.20, dottedProb: 0.25,
    contraryMotionRatio: 0.40, bassIndependence: 0.2,
    voiceCrossingMax: 0, consonanceRatio: 0.95,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── L4: 점4분 ──
  intermediate_1: {
    maxInterval: 5, stepwiseProb: 0.75, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0.15, dottedProb: 0.80,
    contraryMotionRatio: 0.50, bassIndependence: 0.3,
    voiceCrossingMax: 0, consonanceRatio: 0.92,
    cadenceType: ['perfect', 'half'],
    maxTraps: 0,
  },
  // ── L5: 붙임줄 당김음 ──
  intermediate_2: {
    maxInterval: 5, stepwiseProb: 0.70, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.30, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.30, restProb: 0.15, dottedProb: 0.22,
    contraryMotionRatio: 0.50, bassIndependence: 0.45,
    voiceCrossingMax: 0, consonanceRatio: 0.88,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── L6: 16분·16분쉼표 ──
  intermediate_3: {
    maxInterval: 5, stepwiseProb: 0.65, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.26, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.20, restProb: 0.20, dottedProb: 0.22,
    contraryMotionRatio: 0.55, bassIndependence: 0.55,
    voiceCrossingMax: 1, consonanceRatio: 0.85,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── L7: 점8분 ──
  advanced_1: {
    maxInterval: 5, stepwiseProb: 0.60, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.22, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.38,
    contraryMotionRatio: 0.60, bassIndependence: 0.65,
    voiceCrossingMax: 1, consonanceRatio: 0.82,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── L8: 임시표 ──
  advanced_2: {
    maxInterval: 5, stepwiseProb: 0.55, maxLeap: 5,
    chromaticBudget: [2, 4], chromaticProb: 0.15,
    syncopationProb: 0.22, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.30,
    contraryMotionRatio: 0.65, bassIndependence: 0.75,
    voiceCrossingMax: 2, consonanceRatio: 0.80,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── L9: 셋잇단 ──
  advanced_3: {
    maxInterval: 5, stepwiseProb: 0.50, maxLeap: 5,
    chromaticBudget: [2, 4], chromaticProb: 0.15,
    syncopationProb: 0.26, tripletBudget: [1, 3], tripletProb: 0.50,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.30,
    contraryMotionRatio: 0.65, bassIndependence: 0.85,
    voiceCrossingMax: 2, consonanceRatio: 0.78,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64'],
    maxTraps: 3,
  },
};
