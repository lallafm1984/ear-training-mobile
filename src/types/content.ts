// ─────────────────────────────────────────────────────────────
// 청음 콘텐츠 카테고리 타입 정의
// ─────────────────────────────────────────────────────────────

/** 청음 콘텐츠 카테고리 */
export type ContentCategory =
  | 'melody'
  | 'barMelody'
  | 'rhythm'
  | 'interval'
  | 'chord'
  | 'progression'
  | 'key'
  | 'twoVoice';

/** 답안 형태: 기보형(악보 작성) vs 객관식 */
export type AnswerType = 'notation' | 'choice';

/** 카테고리별 설정 */
export interface ContentTypeConfig {
  id: ContentCategory;
  /** 한국어 이름 */
  name: string;
  /** Lucide 아이콘 이름 */
  icon: string;
  /** 테마 색상 (메인) */
  color: string;
  /** 배경 색상 */
  bgColor: string;
  /** 설명 */
  description: string;
  /** 답안 형태 */
  answerType: AnswerType;
  /** 최대 난이도 수 */
  maxLevel: number;
  /** Free 사용자 최대 레벨 (0이면 Pro 전용) */
  freeMaxLevel: number;
}

// ─────────────────────────────────────────────────────────────
// 카테고리별 난이도 타입
// ─────────────────────────────────────────────────────────────

/** 선율 난이도 (기존 9단계) */
export type MelodyDifficulty =
  | 'beginner_1' | 'beginner_2' | 'beginner_3'
  | 'intermediate_1' | 'intermediate_2' | 'intermediate_3'
  | 'advanced_1' | 'advanced_2' | 'advanced_3';

/** 마디 받아쓰기 난이도 (음정 폭/반음 기준 6단계) */
export type BarMelodyDifficulty =
  | 'bar_1' | 'bar_2' | 'bar_3' | 'bar_4' | 'bar_5' | 'bar_6';

/** 리듬 난이도 (6단계) */
export type RhythmDifficulty =
  | 'rhythm_1' | 'rhythm_2' | 'rhythm_3'
  | 'rhythm_4' | 'rhythm_5' | 'rhythm_6';

/** 음정 듣기 난이도 (4단계) */
export type IntervalDifficulty =
  | 'interval_1' | 'interval_2' | 'interval_3' | 'interval_4';

/** 화성 듣기 난이도 (3단계) */
export type ChordDifficulty =
  | 'chord_2' | 'chord_3' | 'chord_4';

/** 화성 진행 난이도 (4단계) */
export type ProgressionDifficulty =
  | 'progression_1' | 'progression_2' | 'progression_3' | 'progression_4';

/** 조성 판별 난이도 (3단계) */
export type KeyDifficulty =
  | 'key_1' | 'key_2' | 'key_3';

/** 2성부 난이도 (기존 bass_1~4) */
export type TwoVoiceDifficulty =
  | 'bass_1' | 'bass_2' | 'bass_3' | 'bass_4';

/** 통합 난이도 타입 */
export type ContentDifficulty =
  | BarMelodyDifficulty
  | MelodyDifficulty
  | RhythmDifficulty
  | IntervalDifficulty
  | ChordDifficulty
  | ProgressionDifficulty
  | KeyDifficulty
  | TwoVoiceDifficulty;

// ─────────────────────────────────────────────────────────────
// 연습 기록
// ─────────────────────────────────────────────────────────────

export interface PracticeRecord {
  id: string;
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  /** 자기 평가 (1~5) */
  selfRating: number;
  /** 연습 시간 */
  practicedAt: string;
}
