// ─────────────────────────────────────────────────────────────
// 청음 콘텐츠 6대 카테고리 설정
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentTypeConfig, ContentDifficulty } from '../types/content';

// ─────────────────────────────────────────────────────────────
// 카테고리 설정
// ─────────────────────────────────────────────────────────────

export const CONTENT_CATEGORIES: ContentTypeConfig[] = [
  {
    id: 'melody',
    name: '선율 받아쓰기',
    icon: 'Music',
    color: '#6366f1',   // indigo
    bgColor: '#eef2ff',
    description: '멜로디를 듣고 악보로 기보',
    answerType: 'notation',
    maxLevel: 9,
    freeMaxLevel: 3,
  },
  {
    id: 'rhythm',
    name: '리듬 받아쓰기',
    icon: 'Drum',
    color: '#f59e0b',   // amber
    bgColor: '#fffbeb',
    description: '리듬 패턴을 듣고 기보',
    answerType: 'notation',
    maxLevel: 6,
    freeMaxLevel: 2,
  },
  {
    id: 'interval',
    name: '음정 듣기',
    icon: 'ArrowUpDown',
    color: '#10b981',   // emerald
    bgColor: '#ecfdf5',
    description: '두 음 사이의 음정 식별',
    answerType: 'choice',
    maxLevel: 4,
    freeMaxLevel: 2,
  },
  {
    id: 'chord',
    name: '화성 듣기',
    icon: 'Layers',
    color: '#8b5cf6',   // violet
    bgColor: '#f5f3ff',
    description: '화음의 종류 식별',
    answerType: 'choice',
    maxLevel: 4,
    freeMaxLevel: 1,
  },
  {
    id: 'key',
    name: '조성 판별',
    icon: 'Key',
    color: '#ef4444',   // red
    bgColor: '#fef2f2',
    description: '선율의 조성과 장/단조 판별',
    answerType: 'choice',
    maxLevel: 3,
    freeMaxLevel: 1,
  },
  {
    id: 'twoVoice',
    name: '2성부 받아쓰기',
    icon: 'FileMusic',
    color: '#0ea5e9',   // sky
    bgColor: '#f0f9ff',
    description: '선율+베이스 큰보표 기보',
    answerType: 'notation',
    maxLevel: 4,
    freeMaxLevel: 0,    // Pro 전용
  },
];

/** 카테고리 ID로 설정 조회 */
export function getContentConfig(id: ContentCategory): ContentTypeConfig {
  return CONTENT_CATEGORIES.find(c => c.id === id)!;
}

/** 전체 카테고리 ID 목록 */
export const ALL_CONTENT_CATEGORIES: ContentCategory[] =
  CONTENT_CATEGORIES.map(c => c.id);

// ─────────────────────────────────────────────────────────────
// 카테고리별 난이도 라벨
// ─────────────────────────────────────────────────────────────

export const MELODY_DIFF_LABELS: Record<string, string> = {
  beginner_1: '초급 1 · 2분음표/4분음표',
  beginner_2: '초급 2 · 8분음표',
  beginner_3: '초급 3 · 점4분음표',
  intermediate_1: '중급 1 · 당김음',
  intermediate_2: '중급 2 · 붙임줄',
  intermediate_3: '중급 3 · 16분음표',
  advanced_1: '고급 1 · 점8분음표',
  advanced_2: '고급 2 · 셋잇단음표',
  advanced_3: '고급 3 · 임시표',
};

export const RHYTHM_DIFF_LABELS: Record<string, string> = {
  rhythm_1: '1단계 · 온/2분/4분음표',
  rhythm_2: '2단계 · 8분음표 + 쉼표',
  rhythm_3: '3단계 · 점음표 + 당김음',
  rhythm_4: '4단계 · 16분음표',
  rhythm_5: '5단계 · 셋잇단음표',
  rhythm_6: '6단계 · 복합 리듬',
};

export const INTERVAL_DIFF_LABELS: Record<string, string> = {
  interval_1: '1단계 · 완전음정 (1·4·5·8도)',
  interval_2: '2단계 · 장/단 3도, 6도',
  interval_3: '3단계 · 장/단 2도, 7도',
  interval_4: '4단계 · 증/감 + 복음정',
};

export const CHORD_DIFF_LABELS: Record<string, string> = {
  chord_1: '1단계 · 장/단 3화음',
  chord_2: '2단계 · 증/감 3화음',
  chord_3: '3단계 · 7화음 (M7·m7·dom7)',
  chord_4: '4단계 · 전위형 + 복합화음',
};

export const KEY_DIFF_LABELS: Record<string, string> = {
  key_1: '1단계 · 나란한조 (C/Am)',
  key_2: '2단계 · ♯♭ 1~3개 조성',
  key_3: '3단계 · 24조성 전체',
};

export const TWO_VOICE_DIFF_LABELS: Record<string, string> = {
  bass_1: '1단계 · 기본 베이스',
  bass_2: '2단계 · 리듬 변화',
  bass_3: '3단계 · 대위법 요소',
  bass_4: '4단계 · 복잡한 성부',
};

/** 카테고리별 난이도 라벨 맵 */
export const CATEGORY_DIFF_LABELS: Record<ContentCategory, Record<string, string>> = {
  melody: MELODY_DIFF_LABELS,
  rhythm: RHYTHM_DIFF_LABELS,
  interval: INTERVAL_DIFF_LABELS,
  chord: CHORD_DIFF_LABELS,
  key: KEY_DIFF_LABELS,
  twoVoice: TWO_VOICE_DIFF_LABELS,
};

/** 카테고리별 난이도 목록 */
export function getDifficultyList(category: ContentCategory): ContentDifficulty[] {
  const keys = Object.keys(CATEGORY_DIFF_LABELS[category]);
  return keys as ContentDifficulty[];
}

/** 난이도 라벨 조회 */
export function getDifficultyLabel(category: ContentCategory, difficulty: ContentDifficulty): string {
  return CATEGORY_DIFF_LABELS[category][difficulty] ?? difficulty;
}
