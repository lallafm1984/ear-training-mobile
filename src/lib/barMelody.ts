import type { ContentDifficulty } from '../types/content';
import type { Accidental, PitchName, ScoreNote } from './scoreUtils';
import { makeRest, uid } from './scoreUtils';

export const BAR_MELODY_SLOT_COUNT = 4;

export const BAR_MELODY_DIFFICULTY_LABELS: Record<string, string> = {
  bar_1: '1단계 · 2도+3도',
  bar_2: '2단계 · 4도까지',
  bar_3: '3단계 · 5도까지',
  bar_4: '4단계 · 6도까지',
  bar_5: '5단계 · 반음 이웃음',
  bar_6: '6단계 · 반음+온음',
};

const MAX_INTERVAL_STEPS_BY_DIFFICULTY: Record<string, number> = {
  bar_1: 2,
  bar_2: 3,
  bar_3: 4,
  bar_4: 5,
};

const C_MAJOR_PITCHES: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export interface BarMelodyPitchOption {
  degree: number;
  pitch: PitchName;
  octave: number;
}

interface BarMelodyChromaticOption {
  midi: number;
  pitch: PitchName;
  octave: number;
  accidental: Accidental;
}

export const BAR_MELODY_PITCH_OPTIONS: BarMelodyPitchOption[] = Array.from({ length: 8 }, (_, degree) => ({
  degree,
  pitch: C_MAJOR_PITCHES[degree % 7],
  octave: 4 + Math.floor(degree / 7),
}));

const BAR_MELODY_CHROMATIC_PITCH_OPTIONS: BarMelodyChromaticOption[] = [
  { midi: 60, pitch: 'C', octave: 4, accidental: '' },
  { midi: 61, pitch: 'C', octave: 4, accidental: '#' },
  { midi: 62, pitch: 'D', octave: 4, accidental: '' },
  { midi: 63, pitch: 'D', octave: 4, accidental: '#' },
  { midi: 64, pitch: 'E', octave: 4, accidental: '' },
  { midi: 65, pitch: 'F', octave: 4, accidental: '' },
  { midi: 66, pitch: 'F', octave: 4, accidental: '#' },
  { midi: 67, pitch: 'G', octave: 4, accidental: '' },
  { midi: 68, pitch: 'G', octave: 4, accidental: '#' },
  { midi: 69, pitch: 'A', octave: 4, accidental: '' },
  { midi: 70, pitch: 'A', octave: 4, accidental: '#' },
  { midi: 71, pitch: 'B', octave: 4, accidental: '' },
  { midi: 72, pitch: 'C', octave: 5, accidental: '' },
];

const BAR_MELODY_NATURAL_CHROMATIC_PITCH_OPTIONS = BAR_MELODY_CHROMATIC_PITCH_OPTIONS
  .filter(option => !option.accidental);

export function buildBarMelodyDisplayNotes(notes: (ScoreNote | null)[]): ScoreNote[] {
  return Array.from({ length: BAR_MELODY_SLOT_COUNT }, (_, index) => {
    const note = notes[index];
    if (!note) return makeRest('4');
    return { ...note, duration: '4', tie: false };
  });
}

function barMelodyPitchToAbc(note: ScoreNote): string {
  if (note.pitch === 'rest') return 'z';

  const accidentalPrefix = note.accidental === '#'
    ? '^'
    : note.accidental === 'b'
      ? '_'
      : note.accidental === 'n'
        ? '='
        : '';

  if (note.octave <= 2) return `${accidentalPrefix}${note.pitch},${','.repeat(3 - note.octave)}`;
  if (note.octave === 3) return `${accidentalPrefix}${note.pitch},`;
  if (note.octave === 4) return `${accidentalPrefix}${note.pitch}`;
  if (note.octave === 5) return `${accidentalPrefix}${note.pitch.toLowerCase()}`;
  return `${accidentalPrefix}${note.pitch.toLowerCase()}${"'".repeat(note.octave - 5)}`;
}

export function buildBarMelodyDisplayAbc(notes: (ScoreNote | null)[]): string {
  const body = buildBarMelodyDisplayNotes(notes)
    .map(note => `${barMelodyPitchToAbc(note)}4`)
    .join(' ');

  return [
    'X:1',
    'T:',
    'M:4/4',
    'L:1/16',
    'Q:1/4=80',
    'K:C',
    `${body} |]`,
  ].join('\n');
}

export function getBarMelodyMaxIntervalStep(difficulty: ContentDifficulty): number {
  return MAX_INTERVAL_STEPS_BY_DIFFICULTY[difficulty] ?? MAX_INTERVAL_STEPS_BY_DIFFICULTY.bar_1;
}

export function makeBarMelodyNote(degree: number): ScoreNote {
  const clamped = Math.max(0, Math.min(7, Math.round(degree)));
  const option = BAR_MELODY_PITCH_OPTIONS[clamped];
  return {
    id: uid(),
    pitch: option.pitch,
    octave: option.octave,
    accidental: '',
    duration: '4',
  };
}

function makeBarMelodyChromaticNote(option: BarMelodyChromaticOption): ScoreNote {
  return {
    id: uid(),
    pitch: option.pitch,
    octave: option.octave,
    accidental: option.accidental,
    duration: '4',
    tie: false,
  };
}

export function makeBarMelodyKeyboardNote(
  pitch: PitchName,
  octave: number,
  accidental: Accidental = '',
): ScoreNote {
  return {
    id: uid(),
    pitch,
    octave,
    accidental,
    duration: '4',
    tie: false,
  };
}

export function appendBarMelodyInput(
  notes: (ScoreNote | null)[],
  note: ScoreNote,
): (ScoreNote | null)[] {
  const next = Array.from({ length: BAR_MELODY_SLOT_COUNT }, (_, index) => notes[index] ?? null);
  const emptyIndex = next.findIndex(value => value === null);
  if (emptyIndex < 0) return next;
  next[emptyIndex] = { ...note, duration: '4', tie: false };
  return next;
}

export function removeLastBarMelodyInput(notes: (ScoreNote | null)[]): (ScoreNote | null)[] {
  const next = Array.from({ length: BAR_MELODY_SLOT_COUNT }, (_, index) => notes[index] ?? null);
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]) {
      next[index] = null;
      break;
    }
  }
  return next;
}

export function getBarMelodyDegree(note: ScoreNote): number | null {
  if (note.pitch === 'rest' || note.accidental) return null;
  if (note.octave < 4 || note.octave > 5) return null;
  const pitchIndex = C_MAJOR_PITCHES.indexOf(note.pitch);
  if (pitchIndex < 0) return null;
  const degree = (note.octave - 4) * 7 + pitchIndex;
  return degree >= 0 && degree <= 7 ? degree : null;
}

function countChromaticOptions(options: BarMelodyChromaticOption[]): number {
  return options.filter(option => option.accidental).length;
}

function pickRandomOption<T>(options: T[]): T | undefined {
  return options[Math.floor(Math.random() * options.length)];
}

function generateChromaticBarMelodyNotes(difficulty: ContentDifficulty): ScoreNote[] {
  const targetAccidentals = difficulty === 'bar_6' && Math.random() < 0.5 ? 2 : 1;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const first = pickRandomOption(BAR_MELODY_NATURAL_CHROMATIC_PITCH_OPTIONS);
    if (!first) break;

    const selected: BarMelodyChromaticOption[] = [first];

    while (selected.length < BAR_MELODY_SLOT_COUNT) {
      const current = selected[selected.length - 1];
      const accidentalCount = countChromaticOptions(selected);
      const slotsRemaining = BAR_MELODY_SLOT_COUNT - selected.length;
      const accidentalsNeeded = targetAccidentals - accidentalCount;
      const mustPickAccidental = accidentalsNeeded >= slotsRemaining;
      const accidentalLimitReached = accidentalCount >= targetAccidentals;

      const candidates = BAR_MELODY_CHROMATIC_PITCH_OPTIONS.filter(option => {
        const semitoneStep = Math.abs(option.midi - current.midi);
        if (semitoneStep < 1 || semitoneStep > 2) return false;
        if (accidentalLimitReached && option.accidental) return false;
        if (mustPickAccidental && !option.accidental) return false;
        return true;
      });

      const next = pickRandomOption(candidates);
      if (!next) break;
      selected.push(next);
    }

    if (
      selected.length === BAR_MELODY_SLOT_COUNT
      && countChromaticOptions(selected) === targetAccidentals
    ) {
      return selected.map(makeBarMelodyChromaticNote);
    }
  }

  const fallback = targetAccidentals === 2
    ? [60, 61, 62, 63]
    : [60, 61, 62, 64];
  return fallback
    .map(midi => BAR_MELODY_CHROMATIC_PITCH_OPTIONS.find(option => option.midi === midi))
    .filter((option): option is BarMelodyChromaticOption => Boolean(option))
    .map(makeBarMelodyChromaticNote);
}

export function generateBarMelodyNotes(difficulty: ContentDifficulty): ScoreNote[] {
  if (difficulty === 'bar_5' || difficulty === 'bar_6') {
    return generateChromaticBarMelodyNotes(difficulty);
  }

  const maxStep = getBarMelodyMaxIntervalStep(difficulty);
  const degrees: number[] = [Math.floor(Math.random() * BAR_MELODY_PITCH_OPTIONS.length)];

  while (degrees.length < BAR_MELODY_SLOT_COUNT) {
    const current = degrees[degrees.length - 1];
    const candidates = BAR_MELODY_PITCH_OPTIONS
      .map(option => option.degree)
      .filter(degree => {
        const step = Math.abs(degree - current);
        return step >= 1 && step <= maxStep;
      });
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? current;
    degrees.push(next);
  }

  return degrees.map(makeBarMelodyNote);
}
