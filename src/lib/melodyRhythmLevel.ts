// ────────────────────────────────────────────────────────────────
// 2성부 멜로디 리듬 — scoreGenerator DURATION_POOL / LEVEL_PARAMS 리듬 필드와 동기화
// (melodyGenerator가 scoreGenerator를 import하지 않도록 분리)
// ────────────────────────────────────────────────────────────────

/** 16분음표 단위 풀 — scoreGenerator DURATION_POOL 과 동일 (L2+ 2분음표 제외) */
const DURATION_POOL_BY_LEVEL: Record<number, number[]> = {
  1: [8, 4],
  2: [4, 4, 2],
  3: [6, 4, 4],
  4: [4, 4, 4, 2],
  5: [6, 4, 4, 2],
  6: [6, 6, 4, 4, 4, 4, 2, 2, 1],
  7: [6, 6, 4, 4, 4, 3, 3, 2, 1],
  8: [6, 6, 4, 4, 4, 3, 3, 2, 1],
  9: [6, 6, 4, 4, 4, 3, 3, 2, 1],
};

/** LEVEL_PARAMS 중 리듬·셋잇단 관련만 — scoreGenerator 와 동일 */
const RHYTHM_PARAMS_BY_LEVEL: Record<number, {
  syncopationProb: number;
  dottedProb: number;
  tieProb: number;
  tripletProb: number;
  tripletBudget: [number, number];
}> = {
  1: { syncopationProb: 0, dottedProb: 0, tieProb: 0, tripletProb: 0, tripletBudget: [0, 0] },
  2: { syncopationProb: 0, dottedProb: 0, tieProb: 0, tripletProb: 0, tripletBudget: [0, 0] },
  3: { syncopationProb: 0, dottedProb: 0.80, tieProb: 0, tripletProb: 0, tripletBudget: [0, 0] },
  4: { syncopationProb: 0, dottedProb: 0.22, tieProb: 0, tripletProb: 0, tripletBudget: [0, 0] },
  5: { syncopationProb: 0.22, dottedProb: 0.22, tieProb: 0.50, tripletProb: 0, tripletBudget: [0, 0] },
  6: { syncopationProb: 0.26, dottedProb: 0.22, tieProb: 0.20, tripletProb: 0, tripletBudget: [0, 0] },
  7: { syncopationProb: 0.22, dottedProb: 0.38, tieProb: 0.25, tripletProb: 0, tripletBudget: [0, 0] },
  8: { syncopationProb: 0.26, dottedProb: 0.30, tieProb: 0.25, tripletProb: 0.50, tripletBudget: [1, 3] },
  9: { syncopationProb: 0.22, dottedProb: 0.30, tieProb: 0.25, tripletProb: 0, tripletBudget: [0, 0] },
};

export function getDurationPoolForMelodyLevel(level: number): number[] {
  const k = Math.max(1, Math.min(9, Math.floor(level)));
  return DURATION_POOL_BY_LEVEL[k];
}

export interface TrebleRhythmParams {
  syncopationProb: number;
  dottedProb: number;
  tieProb: number;
  tripletProb: number;
  tripletBudget: [number, number];
}

export function getTrebleRhythmParamsForMelodyLevel(level: number): TrebleRhythmParams {
  const k = Math.max(1, Math.min(9, Math.floor(level)));
  return { ...RHYTHM_PARAMS_BY_LEVEL[k] };
}

// ────────────────────────────────────────────────────────────────
// 부분연습 전용 — 해당 레벨 고유 요소 + 기본(2분/4분)만 사용
// ────────────────────────────────────────────────────────────────

/** 부분연습 Duration Pool (16분음표 단위, L2+ 2분음표 제외) */
const PART_PRACTICE_DURATION_POOL: Record<number, number[]> = {
  1: [8, 4],           // 2분 + 4분 (기본)
  2: [4, 4, 2],        // 4분 + 8분음표
  3: [6, 4, 4],        // 점4분 + 4분
  4: [6, 4, 4, 2],     // 점4분 + 당김음 (후처리로 패턴 생성)
  5: [6, 4, 4],        // 붙임줄 (tieProb로 제어, 점4분 포함)
  6: [4, 4, 2, 1, 1],  // + 16분음표 (비중 확보)
  7: [4, 4, 3],        // + 점8분음표
  8: [4, 4, 4],        // 셋잇단음표 (tripletProb로 제어)
  9: [4, 4, 2],        // 임시표 (chromaticProb로 제어)
};

/** 부분연습 리듬 파라미터 — 해당 레벨 고유 요소만 활성화 */
const PART_PRACTICE_RHYTHM_PARAMS: Record<number, TrebleRhythmParams> = {
  1: { syncopationProb: 0, dottedProb: 0,    tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
  2: { syncopationProb: 0, dottedProb: 0,    tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
  3: { syncopationProb: 0, dottedProb: 0.80, tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
  4: { syncopationProb: 0, dottedProb: 0.70, tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
  5: { syncopationProb: 0, dottedProb: 0.50, tieProb: 0.60, tripletProb: 0,    tripletBudget: [0, 0] },
  6: { syncopationProb: 0, dottedProb: 0,    tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
  7: { syncopationProb: 0, dottedProb: 0.45, tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
  8: { syncopationProb: 0, dottedProb: 0,    tieProb: 0,    tripletProb: 0.60, tripletBudget: [3, 5] },
  9: { syncopationProb: 0, dottedProb: 0,    tieProb: 0,    tripletProb: 0,    tripletBudget: [0, 0] },
};

export function getDurationPoolForPartPractice(level: number): number[] {
  const k = Math.max(1, Math.min(9, Math.floor(level)));
  return PART_PRACTICE_DURATION_POOL[k];
}

export function getRhythmParamsForPartPractice(level: number): TrebleRhythmParams {
  const k = Math.max(1, Math.min(9, Math.floor(level)));
  return { ...PART_PRACTICE_RHYTHM_PARAMS[k] };
}
