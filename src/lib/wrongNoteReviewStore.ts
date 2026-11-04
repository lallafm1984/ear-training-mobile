// ─────────────────────────────────────────────────────────────
// 오답노트 → 객관식 연습 화면으로 복습 문제 큐를 넘기는 모듈 스토어
// (examNotationStore 와 같은 이유로 navigation params 에 객체를 싣지 않는다)
// ─────────────────────────────────────────────────────────────

import type { ChoiceQuestion } from './questionGenerator';

let queue: ChoiceQuestion[] = [];
let totalCount = 0;

export const wrongNoteReviewStore = {
  set(questions: ChoiceQuestion[]) {
    queue = [...questions];
    totalCount = questions.length;
  },
  /** 다음 복습 문제를 꺼낸다. 큐가 비었으면 null */
  next(): ChoiceQuestion | null {
    return queue.shift() ?? null;
  },
  remaining(): number {
    return queue.length;
  },
  total(): number {
    return totalCount;
  },
  clear() {
    queue = [];
    totalCount = 0;
  },
};
