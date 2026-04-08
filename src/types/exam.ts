// ─────────────────────────────────────────────────────────────
// 모의시험 타입 정의 (학생 자습용)
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentDifficulty } from './content';
import type { PlaybackMode } from './playback';

/** 시험 섹션 (카테고리별 문항 구성) */
export interface ExamSection {
  contentType: ContentCategory;
  questionCount: number;
  difficulty: ContentDifficulty;
  /** 섹션 전체 배점 (문항 수로 균등 분배) */
  points: number;
}

/** 모의시험 설정 */
export interface MockExamConfig {
  id: string;
  title: string;
  sections: ExamSection[];
  playbackMode: PlaybackMode;
  /** 전체 제한시간 (분), undefined면 무제한 */
  timeLimitMinutes?: number;
  createdAt: string;
}

/** 시험 프리셋 */
export interface ExamPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: ExamSection[];
  playbackMode: PlaybackMode;
  timeLimitMinutes?: number;
}

/** 시험 문항 */
export interface ExamQuestion {
  id: string;
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  /** 정답 (기보형이면 ABC notation, 객관식이면 보기 텍스트) */
  correctAnswer: string;
  /** 객관식 보기 */
  choices?: string[];
  /** 사용자 답안 */
  userAnswer?: string;
  /** 자기 평가 (1~5) */
  selfRating?: number;
}

/** 모의시험 세션 */
export interface MockExamSession {
  id: string;
  config: MockExamConfig;
  questions: ExamQuestion[];
  /** 현재 문항 인덱스 */
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  /** 총점 (자기 평가 합산) */
  totalScore: number;
  /** 만점 */
  maxScore: number;
}

/** 시험 결과 요약 */
export interface ExamResultSummary {
  sessionId: string;
  title: string;
  totalScore: number;
  maxScore: number;
  /** 카테고리별 점수 */
  categoryScores: Record<ContentCategory, { score: number; max: number; count: number }>;
  completedAt: string;
}
