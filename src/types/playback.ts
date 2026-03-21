// ─────────────────────────────────────────────────────────────
// MelodyGen 재생 모드 타입 정의
// ─────────────────────────────────────────────────────────────

/**
 * 재생 모드:
 * - practice:    연습 모드 (슬라이딩 윈도우 — 기존 시험 모드)
 * - ap_exam:     AP Music Theory 스타일 (4회 통재생)
 * - korean_exam: 한국 예고/음대 입시 스타일 (3~5회 통재생)
 * - echo:        ABRSM 에코 스타일 (프레이즈별 즉시 응답)
 * - custom:      커스텀 모드 (교사 설정)
 */
export type PlaybackMode = 'practice' | 'ap_exam' | 'korean_exam' | 'echo' | 'custom';

/** AP 시험 모드 설정 */
export interface APExamSettings {
  /** 첫 재생 후 휴식 시간 (초) — 기본 30 */
  firstRestSeconds: number;
  /** 이후 재생 간 휴식 시간 (초) — 기본 60 */
  restSeconds: number;
}

/** 한국 입시 모드 설정 */
export interface KoreanExamSettings {
  /** 총 재생 횟수 (3~5) — 기본 3 */
  totalPlays: number;
  /** 재생 간 휴식 시간 (초) — 기본 60 */
  restSeconds: number;
}

/** ABRSM 에코 모드 설정 */
export interface EchoSettings {
  /** 프레이즈 길이 (마디 수) — 기본 2 */
  phraseMeasures: number;
  /** 프레이즈 후 응답 시간 (초) — 기본 5 */
  responseSeconds: number;
}

/** 커스텀 모드 설정 */
export interface CustomPlaySettings {
  /** 총 재생 횟수 — 기본 3 */
  totalPlays: number;
  /** 구간 분할 여부 */
  useSegments: boolean;
  /** 구간 크기 (마디 수, useSegments가 true일 때) — 기본 2 */
  segmentMeasures: number;
  /** 구간별 반복 횟수 — 기본 2 */
  segmentRepeats: number;
  /** 재생 간 휴식 시간 (초) — 기본 30 */
  restSeconds: number;
  /** 음계 선행 여부 — 기본 false */
  prependScale: boolean;
  /** 으뜸화음 선행 여부 — 기본 false */
  prependTonicChord: boolean;
  /** 카운트인 선행 여부 — 기본 false */
  prependCountIn: boolean;
}

/** 연습 모드 기본 대기 시간 (초) */
export const DEFAULT_PRACTICE_WAIT_SECONDS = 3;

/** 모드별 기본 설정 */
export const DEFAULT_AP_SETTINGS: APExamSettings = {
  firstRestSeconds: 30,
  restSeconds: 60,
};

export const DEFAULT_KOREAN_SETTINGS: KoreanExamSettings = {
  totalPlays: 3,
  restSeconds: 60,
};

export const DEFAULT_ECHO_SETTINGS: EchoSettings = {
  phraseMeasures: 2,
  responseSeconds: 5,
};

export const DEFAULT_CUSTOM_SETTINGS: CustomPlaySettings = {
  totalPlays: 3,
  useSegments: false,
  segmentMeasures: 2,
  segmentRepeats: 2,
  restSeconds: 30,
  prependScale: false,
  prependTonicChord: false,
  prependCountIn: false,
};

/** 모드별 한국어 라벨 */
export const PLAYBACK_MODE_LABELS: Record<PlaybackMode, string> = {
  practice: '연습 모드',
  ap_exam: 'AP 시험',
  korean_exam: '한국 입시',
  echo: '에코 (ABRSM)',
  custom: '커스텀',
};

/** 모드별 설명 */
export const PLAYBACK_MODE_DESCRIPTIONS: Record<PlaybackMode, string> = {
  practice: '슬라이딩 윈도우 방식 · 구간별 반복 훈련',
  ap_exam: '4회 통재생 · 30초/1분 휴식',
  korean_exam: '3~5회 통재생 · 1분 휴식',
  echo: '2마디 프레이즈 · 즉시 응답',
  custom: '재생 횟수·구간·휴식 직접 설정',
};
