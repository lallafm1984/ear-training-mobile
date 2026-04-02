// ─────────────────────────────────────────────────────────────
// MelodyGen 구독 타입 정의
// ─────────────────────────────────────────────────────────────

import type { Difficulty } from '../lib';

/** 3단계 요금제 */
export type PlanTier = 'free' | 'pro' | 'premium';

/** 플랜별 가격 (표시용) */
export const PLAN_PRICE: Record<PlanTier, string> = {
  free:    '무료',
  pro:     '5,500원 / 월',
  premium: '11,000원 / 월',
};

/** 플랜별 한국어 이름 */
export const PLAN_NAME: Record<PlanTier, string> = {
  free:    'Free',
  pro:     'Pro',
  premium: 'Premium',
};

/** 플랜별 색상 */
export const PLAN_COLOR: Record<PlanTier, string> = {
  free:    '#94a3b8',
  pro:     '#6366f1',
  premium: '#f59e0b',
};

// ─────────────────────────────────────────────────────────────
// 구독 상태 (AsyncStorage 저장 데이터)
// ─────────────────────────────────────────────────────────────

export interface SubscriptionState {
  tier: PlanTier;
  /** 구독 만료 ISO 날짜 (free는 null) */
  expiresAt: string | null;
  /** 결제일 기준 이번 달 다운로드 사용 횟수 (Pro용) */
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
  /** 광고 표시 여부 */
  showAds: boolean;
  /** 자동생성 호출 n회마다 광고 (0 = 광고 없음) */
  adEveryNGenerations: number;
  /** 생성 포인트 소모 방식 여부 */
  usesGenPoints: boolean;
  /** 악보 저장 가능 여부 */
  canSaveScores: boolean;
  /** 최대 저장 악보 수 (null = 무제한) */
  maxSavedScores: number | null;
}

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
    showAds:               true,
    adEveryNGenerations:   5,
    usesGenPoints:         true,
    canSaveScores:         true,
    maxSavedScores:        5,
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
    canEditNotes:          false,
    canDownloadAudio:      false,
    canDownloadImage:      true,
    monthlyDownloadLimit:  null,
    showAds:               false,
    adEveryNGenerations:   0,
    usesGenPoints:         true,
    canSaveScores:         true,
    maxSavedScores:        10,
  },
  premium: {
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
    monthlyDownloadLimit:  null, // 무제한
    showAds:               false,
    adEveryNGenerations:   0,
    usesGenPoints:         false,
    canSaveScores:         true,
    maxSavedScores:        30,
  },
};
