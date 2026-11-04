// ─────────────────────────────────────────────────────────────
// 3분 레벨 테스트 — 영역·문항 수·난이도 사다리 정의
//
// 음정·화성·조성은 기존 객관식 생성기를, 리듬은 귀 열기 코스의 리듬 카드 문제를 쓴다.
// 영역마다 "맞히면 한 단계 위, 틀리면 한 단계 아래"로 난이도를 옮기고(계단식),
// 맞힌 문제 중 가장 높은 단계를 그 영역의 시작 추천 난이도로 삼는다.
// 모든 문제는 클라이언트에서 생성하고 결과는 로컬에만 저장한다.
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentDifficulty } from '../../types/content';

export type LevelTestArea = 'interval' | 'chord' | 'key' | 'rhythm';

export interface LevelTestAreaConfig {
  area: LevelTestArea;
  category: ContentCategory;
  /** 이 영역에서 출제할 문항 수 */
  questionCount: number;
  /** 낮은 단계부터 높은 단계 순서의 난이도 사다리 */
  difficulties: ContentDifficulty[];
}

export const LEVEL_TEST_AREAS: LevelTestAreaConfig[] = [
  {
    area: 'interval',
    category: 'interval',
    questionCount: 4,
    difficulties: ['interval_1', 'interval_2', 'interval_3', 'interval_4'],
  },
  {
    area: 'chord',
    category: 'chord',
    questionCount: 3,
    difficulties: ['chord_2', 'chord_3', 'chord_4'],
  },
  {
    area: 'key',
    category: 'key',
    questionCount: 3,
    difficulties: ['key_1', 'key_2', 'key_3'],
  },
  {
    // 리듬은 리듬 카드 고르기(한 마디)로 감각만 확인한다. 난이도 사다리는 추천 시작 레벨 계산에만 쓴다.
    area: 'rhythm',
    category: 'rhythm',
    questionCount: 2,
    difficulties: ['rhythm_1', 'rhythm_2'],
  },
];

export const LEVEL_TEST_TOTAL_QUESTIONS = LEVEL_TEST_AREAS.reduce(
  (sum, a) => sum + a.questionCount,
  0,
);

/** 안내 문구용 예상 소요 시간(분) */
export const LEVEL_TEST_MINUTES = 3;

export function getLevelTestArea(area: LevelTestArea): LevelTestAreaConfig {
  const found = LEVEL_TEST_AREAS.find((a) => a.area === area);
  if (!found) throw new Error(`Unknown level test area: ${area}`);
  return found;
}
