// ─────────────────────────────────────────────────────────────
// MelodyGen 구독 타입 정의
// ─────────────────────────────────────────────────────────────

import type { Difficulty } from '../lib';

/** 2단계 요금제 */
export type PlanTier = 'free' | 'pro';

/** 플랜별 가격 (표시용) */
export const PLAN_PRICE: Record<PlanTier, string> = {
  free:    '무료',
  pro:     '5,500원 / 월',
};

/** 플랜별 한국어 이름 */
export const PLAN_NAME: Record<PlanTier, string> = {
  free:    'Free',
  pro:     'Pro',
};

/** 플랜별 색상 */
export const PLAN_COLOR: Record<PlanTier, string> = {
  free:    '#94a3b8',
  pro:     '#6366f1',
};

// ─────────────────────────────────────────────────────────────
// 구독 상태 (AsyncStorage 저장 데이터)
// ─────────────────────────────────────────────────────────────

export interface SubscriptionState {
  tier: PlanTier;
  /** 구독 만료 ISO 날짜 (free는 null) */
  expiresAt: string | null;
  /** 결제일 기준 이번 달 다운로드 사용 횟수 */
  monthlyDownloadCount: number;
  /** 다운로드 카운트 리셋 기준 날짜 (YYYY-MM 형식) */
  downloadResetMonth: string;
}

// ─────────────────────────────────────────────────────────────
// 플랜별 기능 제한 정의
// ─────────────────────────────────────────────────────────────

export interface PlanLimits {
  /** 큰보표 사용 가능 여부 */
  canUseGrandStaff: boolean;
  /** 시험 모드 사용 가능 여부 */
  canUseExamMode: boolean;
  /** 사용 가능한 난이도 (9단계) */
  allowedDifficulties: Difficulty[];
  /** 최대 생성 마디 수 */
  maxMeasures: number;
  /** 음표 편집 가능 여부 */
  canEditNotes: boolean;
  /** 음원 다운로드 가능 여부 */
  canDownloadAudio: boolean;
  /** 이미지 다운로드 가능 여부 */
  canDownloadImage: boolean;
  /** 월 다운로드 제한 횟수 (null = 무제한) */
  monthlyDownloadLimit: number | null;
  /** 악보 저장 가능 여부 */
  canSaveScores: boolean;
  /** 최대 저장 악보 수 (null = 무제한) */
  maxSavedScores: number | null;
  /** 사용 가능한 조성 목록 */
  allowedKeySignatures: string[];
  /** 사용 가능한 박자 목록 */
  allowedTimeSignatures: string[];
}

const ALL_KEY_SIGNATURES = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm',
];

const ALL_TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '12/8', '9/8', '5/4', '7/8'];

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    canUseGrandStaff:      false,
    canUseExamMode:        false,
    allowedDifficulties:   ['beginner_1', 'beginner_2', 'beginner_3'],
    maxMeasures:           4,
    canEditNotes:          false,
    canDownloadAudio:      false,
    canDownloadImage:      true,
    monthlyDownloadLimit:  0,
    canSaveScores:         true,
    maxSavedScores:        5,
    allowedKeySignatures:  ['C'],
    allowedTimeSignatures: ['4/4'],
  },
  pro: {
    canUseGrandStaff:      true,
    canUseExamMode:        true,
    allowedDifficulties:   [
      'beginner_1', 'beginner_2', 'beginner_3',
      'intermediate_1', 'intermediate_2', 'intermediate_3',
      'advanced_1', 'advanced_2', 'advanced_3',
    ],
    maxMeasures:           9999,
    canEditNotes:          true,
    canDownloadAudio:      true,
    canDownloadImage:      true,
    monthlyDownloadLimit:  null,
    canSaveScores:         true,
    maxSavedScores:        20,
    allowedKeySignatures:  ALL_KEY_SIGNATURES,
    allowedTimeSignatures: ALL_TIME_SIGNATURES,
  },
};
