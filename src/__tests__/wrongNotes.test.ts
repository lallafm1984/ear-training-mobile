import {
  MAX_WRONG_NOTES,
  buildWrongNote,
  mergeWrongNotes,
  normalizeWrongNotes,
  pickReviewNotes,
  removeWrongNote,
  resolveWrongNote,
  summarizeWeakness,
  upsertWrongNote,
  wrongNoteId,
  wrongNoteToChoiceQuestion,
  type WrongNote,
} from '../lib/wrongNotes';
import type { ChoiceQuestion } from '../lib/questionGenerator';
import type { PracticeRecord } from '../types/content';

const q = (over: Partial<ChoiceQuestion> = {}): ChoiceQuestion => ({
  id: 'q1',
  contentType: 'interval',
  difficulty: 'interval_1',
  correctAnswer: '장3도 (M3)',
  choices: ['장3도 (M3)', '완전5도 (P5)', '단3도 (m3)'],
  abcNotation: 'X:1\nK:C\nC E |]',
  prompt: '두 음을 듣고 음정을 맞추세요.',
  explanation: '장3도예요.',
  choiceAbc: { '장3도 (M3)': 'a', '완전5도 (P5)': 'b', '단3도 (m3)': 'c' },
  ...over,
});

describe('오답노트', () => {
  it('같은 문제는 같은 id, 다른 문제는 다른 id', () => {
    expect(wrongNoteId(q())).toBe(wrongNoteId(q({ id: 'other' })));
    expect(wrongNoteId(q())).not.toBe(wrongNoteId(q({ abcNotation: 'X:1\nK:C\nC G |]' })));
  });

  it('추가·재오답·해결·삭제', () => {
    let notes = upsertWrongNote(
      [],
      buildWrongNote(q(), '완전5도 (P5)', 'practice', '2026-11-01T00:00:00Z'),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].wrongCount).toBe(1);

    notes = resolveWrongNote(notes, notes[0].id, '2026-11-02T00:00:00Z');
    expect(notes[0].resolvedAt).toBe('2026-11-02T00:00:00Z');

    notes = upsertWrongNote(
      notes,
      buildWrongNote(q(), '단3도 (m3)', 'exam', '2026-11-03T00:00:00Z'),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      wrongCount: 2,
      myAnswer: '단3도 (m3)',
      resolvedAt: null,
      source: 'exam',
      firstWrongAt: '2026-11-01T00:00:00Z',
      lastWrongAt: '2026-11-03T00:00:00Z',
    });

    expect(removeWrongNote(notes, notes[0].id)).toHaveLength(0);
  });

  it('최신 오답이 앞에 오고 상한을 넘기면 해결된 것부터 버린다', () => {
    let notes: WrongNote[] = [];
    for (let i = 0; i < MAX_WRONG_NOTES + 5; i++) {
      const note = buildWrongNote(
        q({ correctAnswer: `a${i}` }),
        'x',
        'practice',
        new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      );
      notes = upsertWrongNote(notes, i < 10 ? { ...note, resolvedAt: note.lastWrongAt } : note);
    }
    expect(notes).toHaveLength(MAX_WRONG_NOTES);
    expect(notes[0].correctAnswer).toBe(`a${MAX_WRONG_NOTES + 4}`);
    expect(notes.filter((n) => n.resolvedAt)).toHaveLength(5);
  });

  it('복습 대상은 미해결·최근순·필터·상한', () => {
    const notes = [
      { ...buildWrongNote(q({ correctAnswer: 'a' }), 'x', 'practice', '2026-11-01T00:00:00Z') },
      {
        ...buildWrongNote(q({ correctAnswer: 'b' }), 'x', 'practice', '2026-11-03T00:00:00Z'),
        resolvedAt: '2026-11-03T01:00:00Z',
      },
      buildWrongNote(
        q({ correctAnswer: 'c', contentType: 'chord', difficulty: 'chord_2' }),
        'x',
        'practice',
        '2026-11-02T00:00:00Z',
      ),
    ];
    expect(pickReviewNotes(notes).map((n) => n.correctAnswer)).toEqual(['c', 'a']);
    expect(pickReviewNotes(notes, { contentType: 'interval' }).map((n) => n.correctAnswer)).toEqual(
      ['a'],
    );
    expect(pickReviewNotes(notes, undefined, 1)).toHaveLength(1);
  });

  it('노트를 다시 풀 수 있는 문제로 되돌린다', () => {
    const note = buildWrongNote(q(), 'x', 'practice');
    const back = wrongNoteToChoiceQuestion(note);
    expect(back.id).toBe(note.id);
    expect(back.choices).toEqual(q().choices);
    expect(back.choiceAbc).toEqual(q().choiceAbc);
  });

  it('이관 시 횟수를 합치고 더 최근 상태를 따른다', () => {
    const guest = [buildWrongNote(q(), 'x', 'practice', '2026-11-05T00:00:00Z')];
    const account = [
      {
        ...buildWrongNote(q(), 'y', 'exam', '2026-11-01T00:00:00Z'),
        wrongCount: 2,
        resolvedAt: '2026-11-02T00:00:00Z',
      },
    ];
    const merged = mergeWrongNotes(guest, account);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      wrongCount: 3,
      myAnswer: 'x',
      resolvedAt: null,
      firstWrongAt: '2026-11-01T00:00:00Z',
    });
    expect(normalizeWrongNotes([{ id: 1 }, merged[0], null])).toHaveLength(1);
  });
});

describe('약점 요약', () => {
  const rec = (
    contentType: PracticeRecord['contentType'],
    difficulty: string,
    rating: number,
    at: string,
  ) => ({ id: at, contentType, difficulty, selfRating: rating, practicedAt: at }) as PracticeRecord;

  it('미해결 오답·오답 횟수·낮은 자기평가를 합산해 상위 3개를 고른다', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const notes = [
      { ...buildWrongNote(q(), 'x', 'practice', '2026-11-08T00:00:00Z'), wrongCount: 2 },
      {
        ...buildWrongNote(
          q({ contentType: 'key', difficulty: 'key_1', correctAnswer: 'G' }),
          'x',
          'practice',
          '2026-11-09T00:00:00Z',
        ),
        resolvedAt: '2026-11-09T01:00:00Z',
      },
      buildWrongNote(q({ correctAnswer: 'old' }), 'x', 'practice', '2026-09-01T00:00:00Z'),
    ];
    const records = [
      rec('rhythm', 'rhythm_2', 1, '2026-11-09T00:00:00Z'),
      rec('rhythm', 'rhythm_2', 2, '2026-11-08T00:00:00Z'),
      rec('melody', 'beginner_1', 5, '2026-11-08T00:00:00Z'),
    ];
    const spots = summarizeWeakness(notes, records, now);
    expect(spots.map((s) => `${s.contentType}|${s.difficulty}`)).toEqual([
      'interval|interval_1',
      'rhythm|rhythm_2',
      'key|key_1',
    ]);
    expect(spots[0]).toMatchObject({ unresolved: 1, wrongCount: 2, score: 5 });
    expect(spots[1]).toMatchObject({ lowRatingSessions: 2, score: 4 });
    expect(spots[2]).toMatchObject({ unresolved: 0, wrongCount: 1, score: 1 });
  });
});
