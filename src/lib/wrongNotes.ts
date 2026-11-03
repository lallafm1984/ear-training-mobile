// ─────────────────────────────────────────────────────────────
// wrongNotes — 오답노트 (객관식 오답 스냅샷)와 약점 요약 (순수 함수, 로컬 저장 전용)
//
// 객관식 연습·모의시험에서 틀린 문제를 통째로(소리·보기·해설) 보관해 다시 들어보고
// 다시 풀 수 있게 한다. 같은 문제를 또 틀리면 횟수만 늘고, 복습에서 맞히면 해결 처리한다.
// ─────────────────────────────────────────────────────────────

import type { ChoiceQuestion } from './questionGenerator';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';

export type WrongNoteSource = 'practice' | 'exam';

export interface WrongNote {
  /** 문제 서명 기반 id (카테고리·난이도·정답·악보) — 같은 문제는 같은 id */
  id: string;
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  prompt: string;
  abcNotation: string;
  correctAnswer: string;
  choices: string[];
  choiceAbc: Record<string, string>;
  explanation: string;
  /** 마지막으로 고른 오답 */
  myAnswer: string;
  wrongCount: number;
  firstWrongAt: string;
  lastWrongAt: string;
  resolvedAt: string | null;
  source: WrongNoteSource;
}

export const MAX_WRONG_NOTES = 200;
/** 약점 계산에 쓰는 기간 */
export const WEAKNESS_WINDOW_DAYS = 30;
/** 한 번에 복습할 최대 문제 수 */
export const MAX_REVIEW_BATCH = 10;

function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function wrongNoteId(
  q: Pick<ChoiceQuestion, 'contentType' | 'difficulty' | 'correctAnswer' | 'abcNotation'>,
): string {
  return `wn_${q.contentType}_${q.difficulty}_${hashString(`${q.correctAnswer}|${q.abcNotation}`)}`;
}

export function buildWrongNote(
  q: ChoiceQuestion,
  myAnswer: string,
  source: WrongNoteSource,
  now: string = new Date().toISOString(),
): WrongNote {
  return {
    id: wrongNoteId(q),
    contentType: q.contentType,
    difficulty: q.difficulty,
    prompt: q.prompt,
    abcNotation: q.abcNotation,
    correctAnswer: q.correctAnswer,
    choices: [...q.choices],
    choiceAbc: { ...q.choiceAbc },
    explanation: q.explanation,
    myAnswer,
    wrongCount: 1,
    firstWrongAt: now,
    lastWrongAt: now,
    resolvedAt: null,
    source,
  };
}

/** 오답 추가. 같은 문제면 횟수를 올리고 다시 미해결로 되돌린다. 최신 오답이 앞에 온다. */
export function upsertWrongNote(notes: WrongNote[], incoming: WrongNote): WrongNote[] {
  const existing = notes.find((n) => n.id === incoming.id);
  const merged: WrongNote = existing
    ? {
        ...existing,
        myAnswer: incoming.myAnswer,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: incoming.lastWrongAt,
        resolvedAt: null,
        source: incoming.source,
        // 언어가 바뀌었을 수 있으니 문구는 최신 것으로
        prompt: incoming.prompt,
        explanation: incoming.explanation,
        choices: incoming.choices,
        choiceAbc: incoming.choiceAbc,
      }
    : incoming;
  const rest = notes.filter((n) => n.id !== incoming.id);
  return trimWrongNotes([merged, ...rest]);
}

export function resolveWrongNote(
  notes: WrongNote[],
  id: string,
  now: string = new Date().toISOString(),
): WrongNote[] {
  return notes.map((n) => (n.id === id && !n.resolvedAt ? { ...n, resolvedAt: now } : n));
}

export function removeWrongNote(notes: WrongNote[], id: string): WrongNote[] {
  return notes.filter((n) => n.id !== id);
}

export function removeResolvedWrongNotes(notes: WrongNote[]): WrongNote[] {
  return notes.filter((n) => !n.resolvedAt);
}

/** 상한을 넘기면 해결된 오래된 것부터, 그래도 넘치면 가장 오래된 것부터 버린다. */
export function trimWrongNotes(notes: WrongNote[]): WrongNote[] {
  if (notes.length <= MAX_WRONG_NOTES) return notes;
  const byRecent = [...notes].sort(
    (a, b) => new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime(),
  );
  const unresolved = byRecent.filter((n) => !n.resolvedAt);
  const resolved = byRecent.filter((n) => !!n.resolvedAt);
  return [...unresolved, ...resolved].slice(0, MAX_WRONG_NOTES);
}

export function normalizeWrongNotes(raw: unknown): WrongNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (n): n is WrongNote =>
      !!n &&
      typeof n === 'object' &&
      typeof n.id === 'string' &&
      typeof n.contentType === 'string' &&
      typeof n.difficulty === 'string' &&
      typeof n.abcNotation === 'string' &&
      typeof n.correctAnswer === 'string' &&
      Array.isArray(n.choices),
  );
}

/** 게스트 → 계정 이관: 같은 문제는 횟수를 합치고 더 최근 상태를 따른다. */
export function mergeWrongNotes(guest: WrongNote[], account: WrongNote[]): WrongNote[] {
  const byId = new Map<string, WrongNote>();
  for (const n of account) byId.set(n.id, n);
  for (const g of guest) {
    const a = byId.get(g.id);
    if (!a) {
      byId.set(g.id, g);
      continue;
    }
    const newer = new Date(g.lastWrongAt).getTime() >= new Date(a.lastWrongAt).getTime() ? g : a;
    byId.set(g.id, {
      ...newer,
      wrongCount: a.wrongCount + g.wrongCount,
      firstWrongAt:
        new Date(a.firstWrongAt).getTime() <= new Date(g.firstWrongAt).getTime()
          ? a.firstWrongAt
          : g.firstWrongAt,
    });
  }
  return trimWrongNotes(
    [...byId.values()].sort(
      (x, y) => new Date(y.lastWrongAt).getTime() - new Date(x.lastWrongAt).getTime(),
    ),
  );
}

/** 저장된 오답을 다시 풀 수 있는 객관식 문제로 되돌린다 (id = 노트 id). */
export function wrongNoteToChoiceQuestion(note: WrongNote): ChoiceQuestion {
  return {
    id: note.id,
    contentType: note.contentType,
    difficulty: note.difficulty,
    correctAnswer: note.correctAnswer,
    choices: [...note.choices],
    abcNotation: note.abcNotation,
    prompt: note.prompt,
    explanation: note.explanation,
    choiceAbc: { ...note.choiceAbc },
  };
}

/** 복습 대상: 미해결 중 최근 오답 순, 카테고리·난이도 필터 가능 */
export function pickReviewNotes(
  notes: WrongNote[],
  filter?: { contentType?: ContentCategory; difficulty?: ContentDifficulty },
  limit: number = MAX_REVIEW_BATCH,
): WrongNote[] {
  return notes
    .filter((n) => !n.resolvedAt)
    .filter((n) => !filter?.contentType || n.contentType === filter.contentType)
    .filter((n) => !filter?.difficulty || n.difficulty === filter.difficulty)
    .sort((a, b) => new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime())
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// 약점 요약
// ─────────────────────────────────────────────────────────────

export interface WeakSpot {
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  /** 미해결 오답 수 */
  unresolved: number;
  /** 기간 내 누적 오답 횟수 */
  wrongCount: number;
  /** 기간 내 자기평가 2 이하 세션 수 (기보형 포함) */
  lowRatingSessions: number;
  score: number;
}

/**
 * 최근 기간의 오답(미해결 가중)과 낮은 자기평가 세션을 합쳐 약한 카테고리·난이도를 고른다.
 * score = 미해결×3 + 오답횟수 + 낮은평가세션×2
 */
export function summarizeWeakness(
  notes: WrongNote[],
  records: PracticeRecord[],
  now: Date = new Date(),
  limit = 3,
): WeakSpot[] {
  const since = now.getTime() - WEAKNESS_WINDOW_DAYS * 86_400_000;
  const map = new Map<string, WeakSpot>();
  const get = (contentType: ContentCategory, difficulty: ContentDifficulty) => {
    const key = `${contentType}|${difficulty}`;
    let spot = map.get(key);
    if (!spot) {
      spot = {
        contentType,
        difficulty,
        unresolved: 0,
        wrongCount: 0,
        lowRatingSessions: 0,
        score: 0,
      };
      map.set(key, spot);
    }
    return spot;
  };

  for (const n of notes) {
    const t = new Date(n.lastWrongAt).getTime();
    if (Number.isNaN(t) || t < since) continue;
    const spot = get(n.contentType, n.difficulty);
    spot.wrongCount += n.wrongCount;
    if (!n.resolvedAt) spot.unresolved += 1;
  }
  for (const r of records) {
    const t = new Date(r.practicedAt).getTime();
    if (Number.isNaN(t) || t < since) continue;
    if (r.selfRating <= 2) get(r.contentType, r.difficulty).lowRatingSessions += 1;
  }

  return [...map.values()]
    .map((s) => ({ ...s, score: s.unresolved * 3 + s.wrongCount + s.lowRatingSessions * 2 }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.unresolved - a.unresolved)
    .slice(0, limit);
}
