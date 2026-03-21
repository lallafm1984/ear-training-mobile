// ─────────────────────────────────────────────────────────────
// Gen 포인트 비용 계산
// ─────────────────────────────────────────────────────────────

import type { Difficulty } from './scoreGenerator';

/**
 * 난이도 9단계별 Gen 비용 테이블
 *
 * 단선율 / 큰보표 (큰보표 = 단선율 × 1.5)
 *
 * 기준: Pro 유저(400 Gen/일) 기준 중급 1단계에서 약 13~20회 생성 가능
 *
 *   초급 1: 8  / 12   — Free 유저도 하루 12회, 진입 장벽 최소화
 *   초급 2: 12 / 18
 *   초급 3: 15 / 23
 *   중급 1: 20 / 30   ← 주력 단계, Pro 하루 20회 (4마디 기준)
 *   중급 2: 24 / 36
 *   중급 3: 28 / 42
 *   고급 1: 35 / 53
 *   고급 2: 45 / 68
 *   고급 3: 55 / 83   — 서울대·한예종 수준, 패키지 구매 유인
 */
const GEN_COST_TABLE: Record<Difficulty, { single: number; grand: number }> = {
  beginner_1:     { single: 8,  grand: 12 },
  beginner_2:     { single: 12, grand: 18 },
  beginner_3:     { single: 15, grand: 23 },
  intermediate_1: { single: 20, grand: 30 },
  intermediate_2: { single: 24, grand: 36 },
  intermediate_3: { single: 28, grand: 42 },
  advanced_1:     { single: 35, grand: 53 },
  advanced_2:     { single: 45, grand: 68 },
  advanced_3:     { single: 55, grand: 83 },
};

/**
 * 마디 수에 따른 추가 Gen 비용 (단선율·큰보표 동일)
 *
 *   4마디:       +0
 *   8마디:       +5
 *   12마디:      +10
 *   16마디 이상: +15
 *
 * 큰보표 프리미엄은 난이도 기본 비용(GEN_COST_TABLE)에서만 적용 (× 1.5)
 */
export function getMeasureExtraCost(measures: number): number {
  if (measures >= 16) return 15;
  if (measures >= 12) return 10;
  if (measures >= 8)  return  5;
  return 0;
}

/**
 * AI 자동생성 시 차감할 Gen 비용을 반환합니다.
 * @param difficulty    - 선택된 난이도
 * @param useGrandStaff - 큰보표 사용 여부 (기본 비용에만 프리미엄 적용)
 * @param measures      - 생성 마디 수 (기본 4마디, 8마디부터 추가 비용)
 */
export function getGenCost(
  difficulty: Difficulty,
  useGrandStaff: boolean,
  measures: number = 4,
): number {
  const costs = GEN_COST_TABLE[difficulty];
  const base  = useGrandStaff ? costs.grand : costs.single;
  return base + getMeasureExtraCost(measures);
}

