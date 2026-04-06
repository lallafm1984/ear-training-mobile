import { normalizeNotes, gradeNotes, buildTimeline } from '../lib/grading';
import type { ScoreNote } from '../lib/scoreUtils';
import { uid } from '../lib/scoreUtils';

/** 헬퍼: ScoreNote 생성 */
function makeNote(
  pitch: ScoreNote['pitch'],
  octave: number,
  duration: ScoreNote['duration'],
  accidental: ScoreNote['accidental'] = '',
  tie = false,
): ScoreNote {
  return { pitch, octave, accidental, duration, tie, id: uid() };
}

// ──────────────────────────────────────────────
// normalizeNotes
// ──────────────────────────────────────────────
describe('normalizeNotes', () => {
  it('단순 음표가 그대로 통과한다', () => {
    const notes = [makeNote('C', 4, '4'), makeNote('D', 4, '8')];
    const result = normalizeNotes(notes);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({ pitch: 'C4', totalDuration: 4, sourceIndices: [0] }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({ pitch: 'D4', totalDuration: 2, sourceIndices: [1] }),
    );
  });

  it('같은 음높이의 타이 음표가 병합된다 (duration 합산, sourceIndices 결합)', () => {
    const notes = [
      makeNote('C', 4, '4'),
      makeNote('C', 4, '8', '', true), // tie to previous
    ];
    const result = normalizeNotes(notes);
    expect(result).toHaveLength(1);
    expect(result[0].pitch).toBe('C4');
    expect(result[0].totalDuration).toBe(6); // 4 + 2
    expect(result[0].sourceIndices).toEqual([0, 1]);
  });

  it('점음표가 올바른 총 duration으로 변환된다', () => {
    const notes = [makeNote('E', 4, '4.')];
    const result = normalizeNotes(notes);
    expect(result).toHaveLength(1);
    expect(result[0].totalDuration).toBe(6); // dotted quarter = 6 sixteenths
  });

  it('쉼표의 pitch가 "rest"가 된다', () => {
    const notes = [makeNote('rest', 0, '4')];
    const result = normalizeNotes(notes);
    expect(result[0].pitch).toBe('rest');
    expect(result[0].totalDuration).toBe(4);
  });

  it('임시표(accidental)가 pitch 문자열에 포함된다', () => {
    const notes = [makeNote('F', 4, '4', '#')];
    const result = normalizeNotes(notes);
    expect(result[0].pitch).toBe('F#4');
  });

  it('세 음표 연속 타이 병합 (C4 quarter×3 = 12)', () => {
    const notes = [
      makeNote('C', 4, '4'),
      makeNote('C', 4, '4', '', true),
      makeNote('C', 4, '4', '', true),
    ];
    const result = normalizeNotes(notes);
    expect(result).toHaveLength(1);
    expect(result[0].totalDuration).toBe(12); // 4+4+4
    expect(result[0].sourceIndices).toEqual([0, 1, 2]);
  });

  it('타이지만 음높이가 다르면 병합하지 않는다', () => {
    const notes = [
      makeNote('C', 4, '4'),
      makeNote('D', 4, '4', '', true), // different pitch
    ];
    const result = normalizeNotes(notes);
    expect(result).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────
// gradeNotes
// ──────────────────────────────────────────────
describe('gradeNotes', () => {
  it('완벽 일치 → 모두 correct, accuracy=1.0', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '8')];
    const user = [makeNote('C', 4, '4'), makeNote('D', 4, '8')];
    const result = gradeNotes(answer, user);
    expect(result.correctCount).toBe(2);
    expect(result.accuracy).toBe(1.0);
    expect(result.selfRating).toBe(5);
    expect(result.grades.every((g) => g.grade === 'correct')).toBe(true);
  });

  it('pitch만 일치 → wrong', () => {
    const answer = [makeNote('C', 4, '4')];
    const user = [makeNote('C', 4, '8')]; // same pitch, different duration
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('wrong');
    expect(result.wrongCount).toBe(1);
  });

  it('duration만 일치 → wrong', () => {
    const answer = [makeNote('C', 4, '4')];
    const user = [makeNote('D', 4, '4')]; // different pitch, same duration
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('wrong');
  });

  it('pitch도 duration도 불일치 → wrong', () => {
    const answer = [makeNote('C', 4, '4')];
    const user = [makeNote('D', 4, '8')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('wrong');
    expect(result.wrongCount).toBe(1);
  });

  it('타이 vs 점음표 동치 → correct (핵심 테스트)', () => {
    // quarter(4) + eighth(2) tie = dotted quarter(6)
    const answer = [makeNote('C', 4, '4'), makeNote('C', 4, '8', '', true)];
    const user = [makeNote('C', 4, '4.')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.accuracy).toBe(1.0);
  });

  it('점음표 vs 타이 동치 (역방향) → correct', () => {
    const answer = [makeNote('C', 4, '4.')];
    const user = [makeNote('C', 4, '4'), makeNote('C', 4, '8', '', true)];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.accuracy).toBe(1.0);
  });

  it('사용자 음표 부족 → missing', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const user = [makeNote('C', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.grades[1].grade).toBe('missing');
    expect(result.missingCount).toBe(1);
  });

  it('사용자 음표 초과 → extra', () => {
    const answer = [makeNote('C', 4, '4')];
    const user = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.grades[1].grade).toBe('extra');
    expect(result.extraCount).toBe(1);
  });

  it('selfRating 변환: 100%→5, 0%→1', () => {
    const r1 = gradeNotes([makeNote('C', 4, '4')], [makeNote('C', 4, '4')]);
    expect(r1.selfRating).toBe(5);

    const r2 = gradeNotes([makeNote('C', 4, '4')], [makeNote('D', 4, '8')]);
    expect(r2.selfRating).toBe(1);
  });

  // ── Edge cases ──

  it('빈 사용자 입력 → 모두 missing', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const result = gradeNotes(answer, []);
    expect(result.missingCount).toBe(2);
    expect(result.accuracy).toBe(0);
    expect(result.selfRating).toBe(1);
  });

  it('쉼표 vs 쉼표 → correct', () => {
    const answer = [makeNote('rest', 0, '4')];
    const user = [makeNote('rest', 0, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
  });

  it('쉼표 vs 음표 (같은 duration) → wrong', () => {
    const answer = [makeNote('rest', 0, '4')];
    const user = [makeNote('C', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('wrong');
  });

  it('삼중 타이 (C4 quarter×3 = dotted half) → correct', () => {
    const answer = [
      makeNote('C', 4, '4'),
      makeNote('C', 4, '4', '', true),
      makeNote('C', 4, '4', '', true),
    ];
    const user = [makeNote('C', 4, '2.')]; // dotted half = 12
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
  });

  it('임시표 구분: C4 vs C#4 같은 duration → wrong', () => {
    const answer = [makeNote('C', 4, '4')];
    const user = [makeNote('C', 4, '4', '#')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('wrong');
  });
});

// ──────────────────────────────────────────────
// buildTimeline
// ──────────────────────────────────────────────
describe('buildTimeline', () => {
  it('음표별 시작 위치가 48분음표 단위로 계산된다', () => {
    const notes = [makeNote('C', 4, '4'), makeNote('D', 4, '4'), makeNote('E', 4, '2')];
    const tl = buildTimeline(notes);
    expect(tl).toHaveLength(3);
    expect(tl[0].startPos).toBe(0);    // quarter = 12 forty-eighths
    expect(tl[1].startPos).toBe(12);
    expect(tl[2].startPos).toBe(24);
    expect(tl[2].duration).toBe(24);   // half = 24
  });

  it('붙임줄 음표가 하나의 이벤트로 병합된다', () => {
    const notes = [
      makeNote('C', 4, '4.'),
      makeNote('C', 4, '8', '', true),
    ];
    const tl = buildTimeline(notes);
    expect(tl).toHaveLength(1);
    expect(tl[0].duration).toBe(24);   // 18 + 6 = half
    expect(tl[0].sourceIndices).toEqual([0, 1]);
  });

  it('전방 tie (splitAtBeatBoundaries 방식) 병합', () => {
    const notes: ScoreNote[] = [
      { pitch: 'C', octave: 4, accidental: '', duration: '8', tie: true, id: uid() },
      { pitch: 'C', octave: 4, accidental: '', duration: '4', id: uid() },
    ];
    const tl = buildTimeline(notes);
    expect(tl).toHaveLength(1);
    expect(tl[0].duration).toBe(18); // 6 + 12 = dotted quarter
    expect(tl[0].sourceIndices).toEqual([0, 1]);
  });

  it('셋잇단 음표의 isTriplet이 true이다', () => {
    const notes: ScoreNote[] = [
      { pitch: 'C', octave: 4, accidental: '', duration: '8', tuplet: '3', tupletSpan: '4', tupletNoteDur: 4, id: uid() },
      { pitch: 'D', octave: 4, accidental: '', duration: '8', id: uid() },
      { pitch: 'E', octave: 4, accidental: '', duration: '8', id: uid() },
    ];
    const tl = buildTimeline(notes);
    expect(tl).toHaveLength(3);
    expect(tl[0].isTriplet).toBe(true);
    expect(tl[1].isTriplet).toBe(true);
    expect(tl[2].isTriplet).toBe(true);
    expect(tl[0].duration).toBe(4);
    expect(tl[1].startPos).toBe(4);
    expect(tl[2].startPos).toBe(8);
  });
});

// ──────────────────────────────────────────────
// gradeNotes — 박자 위치 기반 테스트
// ──────────────────────────────────────────────
describe('gradeNotes (박자 위치 기반)', () => {
  it('앞 마디 음표 수가 달라도 뒷 마디 정답에 영향 없음', () => {
    const answer = [
      makeNote('C', 4, '2'), makeNote('D', 4, '2'),
      makeNote('E', 4, '4'), makeNote('F', 4, '4'), makeNote('G', 4, '2'),
    ];
    const user = [
      makeNote('A', 4, '4'), makeNote('B', 4, '4'), makeNote('A', 4, '4'), makeNote('B', 4, '4'),
      makeNote('E', 4, '4'), makeNote('F', 4, '4'), makeNote('G', 4, '2'),
    ];
    const result = gradeNotes(answer, user);
    const correctGrades = result.grades.filter(g => g.grade === 'correct');
    expect(correctGrades.length).toBe(3);
  });

  it('점4분+8분 타이 vs 2분 → correct', () => {
    const answer = [
      makeNote('C', 4, '4.'),
      makeNote('C', 4, '8', '', true),
    ];
    const user = [makeNote('C', 4, '2')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.accuracy).toBe(1.0);
  });

  it('셋잇단 vs 일반 8분음표 → wrong (셋잇단 불일치)', () => {
    const answer: ScoreNote[] = [
      { pitch: 'C', octave: 4, accidental: '', duration: '8', tuplet: '3', tupletSpan: '4', tupletNoteDur: 4, id: uid() },
      { pitch: 'D', octave: 4, accidental: '', duration: '8', id: uid() },
      { pitch: 'E', octave: 4, accidental: '', duration: '8', id: uid() },
    ];
    const user = [makeNote('C', 4, '8'), makeNote('D', 4, '8')];
    const result = gradeNotes(answer, user);
    const wrongOrMissing = result.grades.filter(g => g.grade === 'wrong' || g.grade === 'missing' || g.grade === 'extra');
    expect(wrongOrMissing.length).toBeGreaterThan(0);
    expect(result.grades.every(g => g.grade !== 'correct')).toBe(true);
  });

  it('셋잇단 vs 셋잇단 동일 → correct', () => {
    const makeTriplet = (p: ScoreNote['pitch'], o: number, isFirst: boolean): ScoreNote => ({
      pitch: p, octave: o, accidental: '', duration: '8',
      ...(isFirst ? { tuplet: '3' as const, tupletSpan: '4' as const, tupletNoteDur: 4 } : {}),
      id: uid(),
    });
    const answer = [makeTriplet('C', 4, true), makeTriplet('D', 4, false), makeTriplet('E', 4, false)];
    const user = [makeTriplet('C', 4, true), makeTriplet('D', 4, false), makeTriplet('E', 4, false)];
    const result = gradeNotes(answer, user);
    expect(result.correctCount).toBe(3);
    expect(result.accuracy).toBe(1.0);
  });

  it('[8분,8분](붙임줄)[8분,8분] vs [8분,4분,8분] → correct', () => {
    const answer = [
      makeNote('C', 4, '8'),
      makeNote('D', 4, '8'),
      makeNote('D', 4, '8', '', true),
      makeNote('E', 4, '8'),
    ];
    const user = [
      makeNote('C', 4, '8'),
      makeNote('D', 4, '4'),
      makeNote('E', 4, '8'),
    ];
    const result = gradeNotes(answer, user);
    expect(result.correctCount).toBe(3);
    expect(result.accuracy).toBe(1.0);
  });

  it('[8분,4분,8분] vs [8분,8분](붙임줄)[8분,8분] → correct (역방향)', () => {
    const answer = [
      makeNote('C', 4, '8'),
      makeNote('D', 4, '4'),
      makeNote('E', 4, '8'),
    ];
    const user = [
      makeNote('C', 4, '8'),
      makeNote('D', 4, '8'),
      makeNote('D', 4, '8', '', true),
      makeNote('E', 4, '8'),
    ];
    const result = gradeNotes(answer, user);
    expect(result.correctCount).toBe(3);
    expect(result.accuracy).toBe(1.0);
  });

  it('8분(붙임줄)8분을 8분+8분(no tie)로 쪼개면 → wrong', () => {
    const answer = [
      makeNote('C', 4, '8'),
      makeNote('D', 4, '8'),
      makeNote('D', 4, '8', '', true),
      makeNote('E', 4, '8'),
    ];
    const user = [
      makeNote('C', 4, '8'),
      makeNote('D', 4, '8'),
      makeNote('D', 4, '8'),
      makeNote('E', 4, '8'),
    ];
    const result = gradeNotes(answer, user);
    expect(result.correctCount).toBe(2); // C, E
    expect(result.wrongCount).toBe(1);   // D (split)
    expect(result.extraCount).toBe(0);   // absorbed
  });

  it('서로 다른 박 8분(tie)8분 → 같은 pitch 8분+8분(no tie) → wrong', () => {
    const answer = [
      makeNote('D', 4, '8'),
      makeNote('D', 4, '8', '', true),
    ];
    const user = [
      makeNote('D', 4, '8'),
      makeNote('D', 4, '8'),
    ];
    const result = gradeNotes(answer, user);
    expect(result.wrongCount).toBe(1);
    expect(result.correctCount).toBe(0);
    expect(result.extraCount).toBe(0);
  });

  it('쉼표 위치에 음표 → wrong', () => {
    const answer = [makeNote('C', 4, '2'), makeNote('rest', 0, '2')];
    const user = [
      makeNote('D', 4, '4'), makeNote('E', 4, '4'),
      makeNote('F', 4, '4'), makeNote('G', 4, '4'),
    ];
    const result = gradeNotes(answer, user);
    expect(result.grades.filter(g => g.grade === 'correct').length).toBe(0);
  });
});
