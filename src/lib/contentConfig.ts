// ─────────────────────────────────────────────────────────────
// 청음 콘텐츠 카테고리 설정
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentTypeConfig, ContentDifficulty } from '../types/content';
import { BAR_MELODY_DIFFICULTY_LABELS } from './barMelody';

// ─────────────────────────────────────────────────────────────
// 카테고리 설정
// ─────────────────────────────────────────────────────────────

export const CONTENT_CATEGORIES: ContentTypeConfig[] = [
  {
    id: 'barMelody',
    name: '마디 받아쓰기',
    icon: 'Music',
    color: '#14b8a6', // teal
    bgColor: '#f0fdfa',
    description: '한 마디 선율을 듣고 음정 간격 기보',
    answerType: 'notation',
    maxLevel: 6,
    freeMaxLevel: 3,
  },
  {
    id: 'melody',
    name: '선율 받아쓰기',
    icon: 'Music',
    color: '#6366f1', // indigo
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
    color: '#f59e0b', // amber
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
    color: '#10b981', // emerald
    bgColor: '#ecfdf5',
    description: '두 음 사이의 음정 식별',
    answerType: 'choice',
    maxLevel: 6,
    freeMaxLevel: 2,
  },
  {
    id: 'chord',
    name: '화성 듣기',
    icon: 'Layers',
    color: '#8b5cf6', // violet
    bgColor: '#f5f3ff',
    description: '화음의 종류 식별',
    answerType: 'choice',
    maxLevel: 4,
    freeMaxLevel: 1,
  },
  {
    id: 'progression',
    name: '화성 진행',
    icon: 'GitBranch',
    color: '#0f766e', // teal green
    bgColor: '#ecfdf5',
    description: '화음의 흐름과 종지 판별',
    answerType: 'choice',
    maxLevel: 7,
    freeMaxLevel: 1,
  },
  {
    id: 'key',
    name: '조성 판별',
    icon: 'Key',
    color: '#ef4444', // red
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
    color: '#0ea5e9', // sky
    bgColor: '#f0f9ff',
    description: '선율+베이스 큰보표 기보',
    answerType: 'notation',
    maxLevel: 4,
    freeMaxLevel: 0, // Pro 전용
  },
  {
    id: 'scale',
    name: '음계·선법 듣기',
    icon: 'AudioLines',
    color: '#ec4899', // pink
    bgColor: '#fdf2f8',
    description: '장·단음계와 교회선법 식별',
    answerType: 'choice',
    maxLevel: 5,
    freeMaxLevel: 2,
  },
  {
    id: 'rhythmTap',
    name: '리듬 탭',
    icon: 'Hand',
    color: '#f97316', // orange
    bgColor: '#fff7ed',
    description: '들은 리듬을 탭으로 따라 치기',
    answerType: 'tap',
    maxLevel: 6,
    freeMaxLevel: 2,
  },
];

/**
 * 2.0 업데이트에서 추가된 난이도. 전부 기존 freeMaxLevel 뒤에 붙어 Pro 전용이며,
 * 화면에서는 NEW 배지로 표시한다 (오픈 범위 표: docs/CONTENT_SCOPE_2_0.md).
 */
export const NEW_CONTENT_DIFFICULTIES: ReadonlySet<string> = new Set<string>([
  'interval_5',
  'interval_6',
  'chord_5',
  'progression_5',
  'progression_6',
  'progression_7',
  'scale_5',
  'tap_5',
  'tap_6',
]);

export function isNewDifficulty(difficulty: ContentDifficulty): boolean {
  return NEW_CONTENT_DIFFICULTIES.has(difficulty);
}

/** 카테고리에 새로 추가된 난이도 수 */
export function countNewLevels(category: ContentCategory): number {
  return getDifficultyList(category).filter((d) => NEW_CONTENT_DIFFICULTIES.has(d)).length;
}

/** 무료 사용자가 열 수 있는 난이도 목록 (freeMaxLevel 개) */
export function getFreeDifficulties(category: ContentCategory): ContentDifficulty[] {
  return getDifficultyList(category).slice(0, getContentConfig(category).freeMaxLevel);
}

/** 카테고리 ID로 설정 조회 */
export function getContentConfig(id: ContentCategory): ContentTypeConfig {
  return CONTENT_CATEGORIES.find((c) => c.id === id)!;
}

/** 전체 카테고리 ID 목록 */
export const ALL_CONTENT_CATEGORIES: ContentCategory[] = CONTENT_CATEGORIES.map((c) => c.id);

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
  rhythm_1: '1단계 · 2분/4분음표 + 4분쉼표',
  rhythm_2: '2단계 · 8분음표 + 쉼표',
  rhythm_3: '3단계 · 점음표 + 당김음',
  rhythm_4: '4단계 · 16분음표',
  rhythm_5: '5단계 · 셋잇단음표',
  rhythm_6: '6단계 · 복합 리듬',
};

export const INTERVAL_DIFF_LABELS: Record<string, string> = {
  interval_1: '1단계 · 3도·4도·5도·8도',
  interval_2: '2단계 · + 2도·6도',
  interval_3: '3단계 · + 반음·7도',
  interval_4: '4단계 · 전체 (동음·증4도 포함)',
  interval_5: '5단계 · 화성 음정 (동시 울림)',
  interval_6: '6단계 · 복합음정 (9도~13도)',
};

export const CHORD_DIFF_LABELS: Record<string, string> = {
  chord_2: '1단계 · 장/단/증/감3화음',
  chord_3: '2단계 · + 장7·단7·속7화음',
  chord_4: '3단계 · + 감7·반감7화음',
  chord_5: '4단계 · + 3화음 전위(제1·제2전위)',
};

export const PROGRESSION_DIFF_LABELS: Record<string, string> = {
  progression_1: '1단계 · 기본 진행',
  progression_2: '2단계 · 종지 판별',
  progression_3: '3단계 · 실전 진행',
  progression_4: '4단계 · 문맥형',
  progression_5: '5단계 · 종지 세분화 (PAC·IAC·반·기만)',
  progression_6: '6단계 · 기능 진행 (ii6·V7·전위)',
  progression_7: '7단계 · 로마숫자 화음 판별',
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

export const SCALE_DIFF_LABELS: Record<string, string> = {
  scale_1: '1단계 · 장음계 / 자연단음계',
  scale_2: '2단계 · + 화성·가락단음계',
  scale_3: '3단계 · 교회선법 7종',
  scale_4: '4단계 · + 펜타토닉·온음·블루스',
  scale_5: '5단계 · 상행·하행 (가락단음계 하행형)',
};

export const RHYTHM_TAP_DIFF_LABELS: Record<string, string> = {
  tap_1: '1단계 · 4분/2분음표 1마디',
  tap_2: '2단계 · 8분음표 + 쉼표',
  tap_3: '3단계 · 점음표·당김음 2마디',
  tap_4: '4단계 · 16분음표 2마디',
  tap_5: '5단계 · 3/4박자 점음표·당김음 2마디',
  tap_6: '6단계 · 6/8박자 2마디',
};

/** 카테고리별 난이도 라벨 맵 */
export const CATEGORY_DIFF_LABELS: Record<ContentCategory, Record<string, string>> = {
  barMelody: BAR_MELODY_DIFFICULTY_LABELS,
  melody: MELODY_DIFF_LABELS,
  rhythm: RHYTHM_DIFF_LABELS,
  interval: INTERVAL_DIFF_LABELS,
  chord: CHORD_DIFF_LABELS,
  progression: PROGRESSION_DIFF_LABELS,
  key: KEY_DIFF_LABELS,
  twoVoice: TWO_VOICE_DIFF_LABELS,
  scale: SCALE_DIFF_LABELS,
  rhythmTap: RHYTHM_TAP_DIFF_LABELS,
};

/** 카테고리별 난이도 목록 */
export function getDifficultyList(category: ContentCategory): ContentDifficulty[] {
  const keys = Object.keys(CATEGORY_DIFF_LABELS[category]);
  return keys as ContentDifficulty[];
}

/** 난이도 라벨 조회 */
export function getDifficultyLabel(
  category: ContentCategory,
  difficulty: ContentDifficulty,
): string {
  return CATEGORY_DIFF_LABELS[category][difficulty] ?? difficulty;
}
