// ─────────────────────────────────────────────────────────────
// 모의시험 ↔ 기보연습 화면 간 데이터 전달 스토어
// Navigation params에 복잡한 객체를 넣지 않기 위해 모듈 레벨 스토어 사용
// ─────────────────────────────────────────────────────────────

import type { PracticeScore } from './practiceScoreGenerator';

let _score: PracticeScore | null = null;
let _questionIndex: number = -1;
let _selfRating: number | null = null;

export const examNotationStore = {
  /** MockExamScreen → NotationPracticeScreen: 문항 데이터 설정 */
  setScore(score: PracticeScore, questionIndex: number) {
    _score = score;
    _questionIndex = questionIndex;
    _selfRating = null;
  },

  getScore(): PracticeScore | null {
    return _score;
  },

  getQuestionIndex(): number {
    return _questionIndex;
  },

  /** NotationPracticeScreen → MockExamScreen: 채점 결과 설정 */
  setResult(selfRating: number) {
    _selfRating = selfRating;
  },

  getResult(): number | null {
    return _selfRating;
  },

  clear() {
    _score = null;
    _questionIndex = -1;
    _selfRating = null;
  },
};
