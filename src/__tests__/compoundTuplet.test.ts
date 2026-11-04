/**
 * 복합박자(6/8·9/8) 잇단음표 규칙 — 셋잇단 레벨은 둘잇단(duplet)으로 출제
 *
 * 근거: 복합박자의 박(점4분)은 이미 8분음표 셋으로 나뉘므로, 단순박자의 셋잇단("박을 셋으로")에
 * 대응하는 관용 표기는 "박을 둘로 나누는" 둘잇단음표다 (2:3). ABC: (2:3:2, 채점 타임라인: span 18 → 9×2.
 *  · 리듬 L5(rhythm_5) 6/8·9/8: 둘잇단(tuplet '2', span '4.')이 박머리에 있고 셋잇단은 없음. L1~L4는 잇단음표 없음
 *  · 선율 고급 2(advanced_2, 셋잇단 레벨) 6/8: 둘잇단이 박머리에 나오고 셋잇단은 없음, 마디 길이 보존
 *  · 단순박자(4/4)는 기존대로 셋잇단만
 *  · ABC 변환·채점 타임라인·리듬 정답 시퀀스가 둘잇단을 올바르게 다룬다
 */
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ko', languageTag: 'ko-KR' }],
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

import { generatePracticeScore } from '../lib/practiceScoreGenerator';
import { generateRhythmDictation } from '../lib/rhythmEngine';
import { buildTimeline, gradeNotes } from '../lib/grading';
import { generateAbc } from '../lib/scoreUtils/abc';
import { durationToSixteenths, getSixteenthsPerBar, uid } from '../lib/scoreUtils';
import type { ScoreNote } from '../lib/scoreUtils';

// ── 헬퍼 ────────────────────────────────────────────────────────
type Group = { idx: number; type: string; span: string; start16: number; size: number };

/** 잇단음표 그룹 목록 + 총 길이(16분 단위). tupletNoteDur 규약(그룹 합 = span)으로 위치를 누적한다 */
function scan(notes: ScoreNote[]): { groups: Group[]; total16: number } {
  const groups: Group[] = [];
  let pos = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.tuplet) {
      const size = parseInt(n.tuplet, 10);
      groups.push({ idx: i, type: n.tuplet, span: n.tupletSpan ?? n.duration, start16: pos, size });
      let sum = 0;
      for (let k = 0; k < size && i + k < notes.length; k++) {
        sum += notes[i + k].tupletNoteDur ?? durationToSixteenths(notes[i + k].duration);
      }
      pos += sum;
      i += size - 1;
      continue;
    }
    pos += durationToSixteenths(n.duration);
  }
  return { groups, total16: pos };
}

function duplet(pitch: 'B' | 'C' = 'B'): ScoreNote[] {
  return [
    {
      id: uid(),
      pitch,
      octave: 4,
      accidental: '',
      duration: '8',
      tuplet: '2',
      tupletSpan: '4.',
      tupletNoteDur: 2,
    },
    { id: uid(), pitch, octave: 4, accidental: '', duration: '8', tupletNoteDur: 4 },
  ];
}

const plain = (duration: ScoreNote['duration'], pitch: ScoreNote['pitch'] = 'B'): ScoreNote => ({
  id: uid(),
  pitch,
  octave: 4,
  accidental: '',
  duration,
});

// ── 리듬 받아쓰기 ────────────────────────────────────────────────
describe('리듬 받아쓰기 — 복합박자 둘잇단', () => {
  it.each(['6/8', '9/8'])('L5 %s: 둘잇단(2:3, 점4분 span)이 박머리에 있고 셋잇단은 없다', (ts) => {
    const bar = getSixteenthsPerBar(ts);
    for (let i = 0; i < 12; i++) {
      const notes = generateRhythmDictation(5, 4, ts);
      const { groups, total16 } = scan(notes);
      expect(total16).toBe(bar * 4);
      expect(groups.length).toBeGreaterThan(0);
      for (const g of groups) {
        expect(g.type).toBe('2');
        expect(g.span).toBe('4.');
        expect(g.start16 % 6).toBe(0); // 박머리(점4분 단위)
        // 그룹 합계 = 6 (tupletNoteDur [2, 4])
        expect(notes[g.idx].tupletNoteDur).toBe(2);
        expect(notes[g.idx + 1].tupletNoteDur).toBe(4);
        expect(notes[g.idx + 1].tuplet).toBeUndefined();
      }
    }
  });

  it('L1~L4 6/8: 잇단음표 없음 / L6 6/8: 둘잇단만 허용', () => {
    for (let level = 1; level <= 4; level++) {
      for (let i = 0; i < 6; i++) {
        const { groups } = scan(generateRhythmDictation(level, 4, '6/8'));
        expect(groups).toEqual([]);
      }
    }
    for (let i = 0; i < 10; i++) {
      const { groups, total16 } = scan(generateRhythmDictation(6, 4, '6/8'));
      expect(total16).toBe(48);
      for (const g of groups) expect(g.type).toBe('2');
    }
  });

  it('L5 4/4: 단순박자는 기존대로 셋잇단(3:2, 4분 span)만', () => {
    for (let i = 0; i < 8; i++) {
      const notes = generateRhythmDictation(5, 4, '4/4');
      const { groups, total16 } = scan(notes);
      expect(total16).toBe(64);
      expect(groups.length).toBeGreaterThan(0);
      for (const g of groups) {
        expect(g.type).toBe('3');
        expect(g.span).toBe('4');
      }
    }
  });

  it('practiceScoreGenerator rhythm_5 @ 6/8 도 둘잇단으로 나온다', () => {
    const s = generatePracticeScore('rhythm', 'rhythm_5' as never, { timeSignature: '6/8' });
    const { groups } = scan(s.trebleNotes);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.type === '2' && g.span === '4.')).toBe(true);
  });
});

// ── 선율(고급 2 · 셋잇단 레벨) ──────────────────────────────────
describe('선율 고급 2(셋잇단 레벨) — 복합박자 둘잇단', () => {
  it('6/8: 둘잇단이 박머리에 나오고 셋잇단은 없으며 마디 길이가 보존된다', () => {
    let dupletScores = 0;
    for (let i = 0; i < 10; i++) {
      const s = generatePracticeScore('melody', 'advanced_2' as never, { timeSignature: '6/8' });
      const { groups, total16 } = scan(s.trebleNotes);
      expect(total16 % 12).toBe(0);
      for (const g of groups) {
        expect(g.type).toBe('2');
        expect(g.span).toBe('4.');
        expect(g.start16 % 6).toBe(0);
        expect(s.trebleNotes[g.idx].tupletNoteDur).toBe(2);
        expect(s.trebleNotes[g.idx + 1].tupletNoteDur).toBe(4);
      }
      if (groups.length > 0) dupletScores++;
    }
    // 특성 요소는 최소 2마디 보장 → 대부분의 생성에서 둘잇단이 있어야 한다
    expect(dupletScores).toBeGreaterThanOrEqual(8);
  });

  it('4/4: 단순박자는 셋잇단(3:2)만 쓴다', () => {
    let tripletScores = 0;
    for (let i = 0; i < 6; i++) {
      const s = generatePracticeScore('melody', 'advanced_2' as never, { timeSignature: '4/4' });
      const { groups, total16 } = scan(s.trebleNotes);
      expect(total16 % 16).toBe(0);
      for (const g of groups) {
        expect(g.type).toBe('3');
        expect(g.span).toBe('4');
      }
      if (groups.length > 0) tripletScores++;
    }
    expect(tripletScores).toBeGreaterThanOrEqual(5);
  });
});

// ── ABC · 채점 ──────────────────────────────────────────────────
describe('둘잇단 ABC 변환·채점', () => {
  const bar68: ScoreNote[] = [plain('4.', 'C'), ...duplet('B')];

  it('generateAbc: 둘잇단은 (2:3:2 로 표기되고 마디가 한 번만 닫힌다', () => {
    const abc = generateAbc({
      title: '',
      keySignature: 'C',
      timeSignature: '6/8',
      tempo: 90,
      notes: [...bar68, ...bar68],
    });
    const body = abc
      .split('\n')
      .filter((l) => !/^[A-Z]:/.test(l))
      .join(' ');
    expect(body).toContain('(2:3:2');
    expect(body).not.toContain('(3:2:3');
    // 두 마디 → 마디선 1개 + 종지선
    expect(body.split('|').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('buildTimeline: 둘잇단 두 음은 각각 점4분의 절반(48분 단위 9)을 차지한다', () => {
    const events = buildTimeline(bar68);
    expect(events.map((e) => e.duration)).toEqual([18, 9, 9]);
    expect(events.map((e) => e.startPos)).toEqual([0, 18, 27]);
    expect(events[1].isTriplet).toBe(true);
    expect(events[2].isTriplet).toBe(true);
  });

  it('gradeNotes: 같은 둘잇단 입력은 모두 정답, 점4분 하나로 적으면 오답', () => {
    const same = gradeNotes(bar68, [plain('4.', 'C'), ...duplet('B')]);
    expect(same.wrongCount + same.missingCount + same.extraCount).toBe(0);
    const merged = gradeNotes(bar68, [plain('4.', 'C'), plain('4.', 'B')]);
    expect(merged.wrongCount + merged.missingCount + merged.extraCount).toBeGreaterThan(0);
  });
});
