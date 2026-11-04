// ─────────────────────────────────────────────────────────────
// 귀 열기 7일 코스 — 커리큘럼 정의
//
// 초급자가 "문제를 푸는 앱"이 되기 전에 "귀가 먼저 반응하는" 경험을 하도록,
// 아주 작은 식별 단위부터 시작해 기존 카테고리 연습으로 연결한다.
// 모든 문제는 클라이언트에서 생성하고 진행 상태는 로컬에만 저장한다.
// (설계: docs/BEGINNER_EAR_OPENING_COURSE_DESIGN.md)
// ─────────────────────────────────────────────────────────────

import type { ContentCategory, ContentDifficulty } from '../../types/content';

/** 미니 문제 종류 */
export type BeginnerQuestionKind =
  | 'pitchDirection' // 올라감 / 내려감 / 같음
  | 'longShort' // 긴 소리·짧은 소리·쉼 패턴
  | 'leapSize' // 가까운 도약 / 넓은 도약
  | 'leapName' // 단3도 / 장3도 / 완전5도
  | 'majorMinor' // 장조 / 단조
  | 'rhythmPattern' // 한 마디 리듬 카드 고르기
  | 'firstMelody'; // 3음 선율 계이름 고르기

export interface BeginnerLesson {
  id: string;
  day: number;
  /** 아이콘 이름 (lucide) */
  icon: 'ArrowUpDown' | 'Timer' | 'MoveVertical' | 'Sun' | 'Drum' | 'Music' | 'GraduationCap';
  color: string;
  bgColor: string;
  /** 이 레슨에서 출제할 문제 종류 (순서대로 순환) */
  questionKinds: BeginnerQuestionKind[];
  /** 출제 문제 수 */
  questionCount: number;
  /** 레슨 완료 후 연결할 기존 연습 */
  link: { category: ContentCategory; difficulty: ContentDifficulty };
}

export const BEGINNER_LESSON_EXP = 10;
export const BEGINNER_COURSE_COMPLETE_EXP = 30;

export const BEGINNER_LESSONS: BeginnerLesson[] = [
  {
    id: 'day1_pitch_direction',
    day: 1,
    icon: 'ArrowUpDown',
    color: '#6366f1',
    bgColor: '#eef2ff',
    questionKinds: ['pitchDirection'],
    questionCount: 5,
    link: { category: 'interval', difficulty: 'interval_1' },
  },
  {
    id: 'day2_long_short',
    day: 2,
    icon: 'Timer',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    questionKinds: ['longShort'],
    questionCount: 5,
    link: { category: 'rhythm', difficulty: 'rhythm_1' },
  },
  {
    id: 'day3_leap',
    day: 3,
    icon: 'MoveVertical',
    color: '#10b981',
    bgColor: '#ecfdf5',
    questionKinds: ['leapSize', 'leapSize', 'leapSize', 'leapName', 'leapName'],
    questionCount: 5,
    link: { category: 'interval', difficulty: 'interval_1' },
  },
  {
    id: 'day4_major_minor',
    day: 4,
    icon: 'Sun',
    color: '#ef4444',
    bgColor: '#fef2f2',
    questionKinds: ['majorMinor'],
    questionCount: 5,
    link: { category: 'key', difficulty: 'key_1' },
  },
  {
    id: 'day5_rhythm_pattern',
    day: 5,
    icon: 'Drum',
    color: '#d97706',
    bgColor: '#fff7ed',
    questionKinds: ['rhythmPattern'],
    questionCount: 5,
    link: { category: 'rhythm', difficulty: 'rhythm_1' },
  },
  {
    id: 'day6_first_melody',
    day: 6,
    icon: 'Music',
    color: '#0ea5e9',
    bgColor: '#f0f9ff',
    questionKinds: ['firstMelody'],
    questionCount: 5,
    link: { category: 'barMelody', difficulty: 'bar_1' },
  },
  {
    id: 'day7_graduation',
    day: 7,
    icon: 'GraduationCap',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    questionKinds: [
      'pitchDirection',
      'longShort',
      'leapName',
      'majorMinor',
      'rhythmPattern',
      'firstMelody',
    ],
    questionCount: 6,
    link: { category: 'interval', difficulty: 'interval_1' },
  },
];

export function getBeginnerLesson(id: string): BeginnerLesson | undefined {
  return BEGINNER_LESSONS.find((l) => l.id === id);
}

export function getBeginnerLessonByDay(day: number): BeginnerLesson | undefined {
  return BEGINNER_LESSONS.find((l) => l.day === day);
}
