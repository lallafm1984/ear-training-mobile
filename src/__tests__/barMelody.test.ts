import { generatePracticeScore } from '../lib/practiceScoreGenerator';
import { getSixteenthsPerBar, sumScoreNotesSixteenths, uid } from '../lib/scoreUtils';
import type { ContentCategory } from '../types/content';
import type { ScoreNote } from '../lib/scoreUtils';
import {
  shouldUseFirstNoteHint,
  getMelodyAnswerNotesForGrading,
  isNotationCategory,
} from '../lib/notationPractice';
import {
  appendBarMelodyInput,
  buildBarMelodyDisplayAbc,
  buildBarMelodyDisplayNotes,
  makeBarMelodyKeyboardNote,
  removeLastBarMelodyInput,
} from '../lib/barMelody';
import { gradeNotes } from '../lib/grading';

const BAR_MELODY_DIFFICULTIES = [
  ['bar_1', 2],
  ['bar_2', 3],
  ['bar_3', 4],
  ['bar_4', 5],
] as const;

const BAR_MELODY: ContentCategory = 'barMelody';

function totalSixteenths(notes: ScoreNote[]): number {
  return sumScoreNotesSixteenths(notes);
}

function makeNote(
  pitch: ScoreNote['pitch'],
  octave: number,
  duration: ScoreNote['duration'],
): ScoreNote {
  return { id: uid(), pitch, octave, accidental: '', duration };
}

function cMajorDegree(note: ScoreNote): number {
  const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return (note.octave - 4) * 7 + order.indexOf(note.pitch);
}

function chromaticMidi(note: ScoreNote): number {
  const semitoneByPitch: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const accidentalOffset = note.accidental === '#'
    ? 1
    : note.accidental === 'b'
      ? -1
      : 0;
  return (note.octave + 1) * 12 + semitoneByPitch[note.pitch] + accidentalOffset;
}

describe('barMelody practice score generation', () => {
  it.each(BAR_MELODY_DIFFICULTIES)('generates a fixed C-major quarter-note bar for %s', (difficulty, maxStep) => {
    const score = generatePracticeScore(BAR_MELODY, difficulty as any, {
      timeSignature: '3/4',
      keySignature: 'G',
      tempo: 80,
    });

    expect(score.timeSignature).toBe('4/4');
    expect(score.keySignature).toBe('C');
    expect(score.useGrandStaff).toBe(false);
    expect(score.bassNotes).toHaveLength(0);
    expect(score.barsPerStaff).toBe(1);
    expect(score.trebleNotes).toHaveLength(4);
    expect(score.trebleNotes.every(note => note.duration === '4')).toBe(true);
    expect(score.trebleNotes.every(note => note.accidental === '')).toBe(true);
    expect(totalSixteenths(score.trebleNotes)).toBe(getSixteenthsPerBar('4/4'));

    const degrees = score.trebleNotes.map(cMajorDegree);
    expect(degrees.every(degree => degree >= 0 && degree <= 7)).toBe(true);
    for (let i = 1; i < degrees.length; i += 1) {
      const step = Math.abs(degrees[i] - degrees[i - 1]);
      expect(step).toBeGreaterThanOrEqual(1);
      expect(step).toBeLessThanOrEqual(maxStep);
    }
  });

  it('generates level 5 with exactly one chromatic neighbor tone', () => {
    for (let i = 0; i < 80; i += 1) {
      const score = generatePracticeScore(BAR_MELODY, 'bar_5' as any);
      const accidentalCount = score.trebleNotes.filter(note => note.accidental !== '').length;
      const midis = score.trebleNotes.map(chromaticMidi);

      expect(accidentalCount).toBe(1);
      for (let j = 1; j < midis.length; j += 1) {
        const step = Math.abs(midis[j] - midis[j - 1]);
        expect(step).toBeGreaterThanOrEqual(1);
        expect(step).toBeLessThanOrEqual(2);
      }
    }
  });

  it('generates level 6 with one or two chromatic tones in semitone/whole-tone motion', () => {
    const accidentalCounts = new Set<number>();

    for (let i = 0; i < 100; i += 1) {
      const score = generatePracticeScore(BAR_MELODY, 'bar_6' as any);
      const accidentalCount = score.trebleNotes.filter(note => note.accidental !== '').length;
      const midis = score.trebleNotes.map(chromaticMidi);
      accidentalCounts.add(accidentalCount);

      expect(accidentalCount).toBeGreaterThanOrEqual(1);
      expect(accidentalCount).toBeLessThanOrEqual(2);
      for (let j = 1; j < midis.length; j += 1) {
        const step = Math.abs(midis[j] - midis[j - 1]);
        expect(step).toBeGreaterThanOrEqual(1);
        expect(step).toBeLessThanOrEqual(2);
      }
    }

    expect(accidentalCounts.has(2)).toBe(true);
  });

  it('starts the first level from the previously proposed second-level interval rule', () => {
    const intervalSteps = new Set<number>();

    for (let i = 0; i < 80; i += 1) {
      const score = generatePracticeScore(BAR_MELODY, 'bar_1' as any);
      const degrees = score.trebleNotes.map(cMajorDegree);

      for (let j = 1; j < degrees.length; j += 1) {
        intervalSteps.add(Math.abs(degrees[j] - degrees[j - 1]));
      }
    }

    expect(intervalSteps.has(2)).toBe(true);
    expect([...intervalSteps].every(step => step === 1 || step === 2)).toBe(true);
  });
});

describe('barMelody notation practice behavior', () => {
  it('builds a one-bar display score with rests for empty answer slots', () => {
    const first = makeNote('C', 4, '8');
    const display = buildBarMelodyDisplayNotes([first, null, makeNote('E', 4, '2'), null]);

    expect(display).toHaveLength(4);
    expect(display[0]).toMatchObject({ pitch: 'C', octave: 4, duration: '4', tie: false });
    expect(display[1]).toMatchObject({ pitch: 'rest', duration: '4' });
    expect(display[2]).toMatchObject({ pitch: 'E', octave: 4, duration: '4', tie: false });
    expect(display[3]).toMatchObject({ pitch: 'rest', duration: '4' });
  });

  it('keeps four visible quarter rests in the initial answer ABC', () => {
    const abc = buildBarMelodyDisplayAbc([null, null, null, null]);

    expect(abc).toContain('M:4/4');
    expect(abc).toContain('L:1/16');
    expect(abc).toContain('z4 z4 z4 z4 |]');
  });

  it('preserves empty answer slots as quarter rests between keyboard notes', () => {
    const abc = buildBarMelodyDisplayAbc([
      makeBarMelodyKeyboardNote('C', 4),
      null,
      makeBarMelodyKeyboardNote('C', 4, '#'),
      null,
    ]);

    expect(abc).toContain('C4 z4 ^C4 z4 |]');
  });

  it('fills bar melody answers from the keyboard in slot order and undoes the last slot', () => {
    const first = makeBarMelodyKeyboardNote('C', 4);
    const second = makeBarMelodyKeyboardNote('E', 4);

    const afterFirst = appendBarMelodyInput([null, null, null, null], first);
    const afterSecond = appendBarMelodyInput(afterFirst, second);
    const afterUndo = removeLastBarMelodyInput(afterSecond);

    expect(afterSecond[0]).toMatchObject({ pitch: 'C', octave: 4, duration: '4', tie: false });
    expect(afterSecond[1]).toMatchObject({ pitch: 'E', octave: 4, duration: '4', tie: false });
    expect(afterSecond[2]).toBeNull();
    expect(afterUndo[0]).toMatchObject({ pitch: 'C', octave: 4 });
    expect(afterUndo[1]).toBeNull();
  });

  it('keeps four slots when keyboard input is already full', () => {
    const full = [
      makeBarMelodyKeyboardNote('C', 4),
      makeBarMelodyKeyboardNote('D', 4),
      makeBarMelodyKeyboardNote('E', 4),
      makeBarMelodyKeyboardNote('F', 4),
    ];

    const next = appendBarMelodyInput(full, makeBarMelodyKeyboardNote('G', 4));

    expect(next).toHaveLength(4);
    expect(next.map(note => note?.pitch)).toEqual(['C', 'D', 'E', 'F']);
  });

  it('is a notation category without a first-note hint', () => {
    expect(isNotationCategory(BAR_MELODY)).toBe(true);
    expect(shouldUseFirstNoteHint(BAR_MELODY)).toBe(false);
  });

  it('grades barMelody from the first note', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const same = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const firstWrong = [makeNote('E', 4, '4'), makeNote('D', 4, '4')];

    const fullAnswer = getMelodyAnswerNotesForGrading(BAR_MELODY, answer);

    expect(gradeNotes(fullAnswer, same).accuracy).toBe(1);
    expect(gradeNotes(fullAnswer, firstWrong).correctCount).toBe(1);
  });

  it('keeps the first-note hint grading behavior for melody', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];

    expect(shouldUseFirstNoteHint('melody')).toBe(true);
    expect(getMelodyAnswerNotesForGrading('melody', answer)).toEqual([answer[1]]);
  });
});
