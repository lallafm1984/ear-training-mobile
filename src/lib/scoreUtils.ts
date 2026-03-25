export type NoteDuration = '1' | '1.' | '2' | '4' | '8' | '16' | '2.' | '4.' | '8.';
export type Accidental = '#' | 'b' | 'n' | '';
export type PitchName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B' | 'rest';

export type TupletType = '' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export interface ScoreNote {
  pitch: PitchName;
  octave: number;
  accidental: Accidental;
  duration: NoteDuration;
  /** 붙임줄(타이): 직전 음표와 음높이가 같을 때 ABC `-`로 연결. 이음줄(슬러·다른 음)과 구분 */
  tie?: boolean;
  /**
   * Tuplet information — only set on the FIRST note of a tuplet group.
   * 'tuplet' = the tuplet count (3, 5, 6, 7)
   * 'tupletSpan' = the total duration the group occupies (e.g. '4' = quarter note)
   * 'tupletNoteDur' = the calculated visual duration for each note in the group (in 16ths)
   */
  tuplet?: TupletType;
  tupletSpan?: NoteDuration;
  tupletNoteDur?: number;
  id: string;
}

export interface ScoreState {
  title: string;
  keySignature: string;
  timeSignature: string;
  tempo: number;
  notes: ScoreNote[];
  bassNotes?: ScoreNote[];
  useGrandStaff?: boolean;
  /** 못갖춘마디(anacrusis) 박수, 16분음표 단위. 0 또는 미정의 = 없음 */
  pickupSixteenths?: number;
}

// ────────────────────────────────────────────────────────────────
// Duration utilities
// ────────────────────────────────────────────────────────────────

/**
 * Parses duration to the number of 16th notes.
 */
export function durationToSixteenths(dur: NoteDuration): number {
  switch (dur) {
    case '1': return 16;
    case '1.': return 24;
    case '2': return 8;
    case '2.': return 12;
    case '4': return 4;
    case '4.': return 6;
    case '8': return 2;
    case '8.': return 3;
    case '16': return 1;
    default: return 4;
  }
}

/** 16분음표 수 -> NoteDuration (잇단음표용 쉼표 생성 등) */
export const SIXTEENTHS_TO_DURATION: [number, NoteDuration][] = [
  [24, '1.'], [16, '1'], [12, '2.'], [8, '2'], [6, '4.'], [4, '4'], [3, '8.'], [2, '8'], [1, '16'],
];

/** 16분음표 수 → NoteDuration Record (빠른 조회용) */
export const SIXTEENTHS_TO_DUR: Record<number, NoteDuration> = {
  24: '1.', 16: '1', 12: '2.', 8: '2', 6: '4.', 4: '4', 3: '8.', 2: '8', 1: '16',
};

export function sixteenthsToDuration(sixteenths: number): NoteDuration {
  const found = SIXTEENTHS_TO_DURATION.find(([s]) => s <= sixteenths);
  return found ? found[1] : '16';
}

/**
 * Returns the maximum 16th notes per bar based on time signature.
 */
export function getSixteenthsPerBar(timeSignature: string): number {
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);
  if (!top || !bottom) return 16;
  return top * (16 / bottom);
}

/**
 * 총 길이와 못갖춘마디(P)로 각 마디의 16분음표 길이를 구한다.
 */
function computeBarLengthsFromTotal(
  totalSixteenths: number,
  sixteenthsPerBar: number,
  pickupSixteenths: number,
): number[] {
  if (totalSixteenths <= 0) return [];
  const B = sixteenthsPerBar;
  const P = pickupSixteenths;

  if (P <= 0) {
    const lengths: number[] = [];
    let rem = totalSixteenths;
    while (rem > 0) {
      const len = rem >= B ? B : rem;
      lengths.push(len);
      rem -= len;
    }
    return lengths;
  }

  if (totalSixteenths <= P) {
    return [totalSixteenths];
  }

  const remClass = totalSixteenths % B;

  if (remClass === P) {
    const lengths: number[] = [];
    let pos = 0;
    lengths.push(P);
    pos = P;
    while (pos < totalSixteenths) {
      const r = totalSixteenths - pos;
      const next = r >= B ? B : r;
      lengths.push(next);
      pos += next;
    }
    return lengths;
  }

  if (remClass === 0) {
    const lengths: number[] = [];
    let pos = 0;
    lengths.push(P);
    pos += P;
    while (pos < totalSixteenths) {
      const remaining = totalSixteenths - pos;
      if (remaining <= B - P) {
        lengths.push(remaining);
        break;
      }
      lengths.push(B);
      pos += B;
    }
    return lengths;
  }

  const lengths: number[] = [];
  let pos = 0;
  lengths.push(P);
  pos += P;
  while (pos < totalSixteenths) {
    const r = totalSixteenths - pos;
    const next = r >= B ? B : r;
    lengths.push(next);
    pos += next;
  }
  return lengths;
}

function barGlobalStarts(barLengths: number[]): number[] {
  const s: number[] = [];
  let acc = 0;
  for (let i = 0; i < barLengths.length; i++) {
    s.push(acc);
    acc += barLengths[i];
  }
  return s;
}

function getBarIndexAndLocal(globalPos: number, barLengths: number[]): { bi: number; local: number } {
  let g = 0;
  for (let i = 0; i < barLengths.length; i++) {
    const L = barLengths[i];
    if (globalPos < g + L) {
      return { bi: i, local: globalPos - g };
    }
    g += L;
  }
  const last = barLengths.length - 1;
  return { bi: last, local: barLengths[last] };
}

// ────────────────────────────────────────────────────────────────
// Tuplet utilities
// ────────────────────────────────────────────────────────────────

export function getTupletNoteDuration(tupletType: TupletType, spanDuration: NoteDuration): number {
  const spanSixteenths = durationToSixteenths(spanDuration);
  const isDotted = (spanDuration as string).includes('.');

  switch (tupletType) {
    case '2': return Math.max(1, Math.floor(spanSixteenths / 3));
    case '3': return Math.max(1, Math.floor(spanSixteenths / 2));
    case '4': return Math.max(1, Math.floor(spanSixteenths / 6));
    case '5': return isDotted
      ? Math.max(1, Math.floor(spanSixteenths / 6))
      : Math.max(1, Math.floor(spanSixteenths / 4));
    case '6': return Math.max(1, Math.floor(spanSixteenths / 4));
    case '7': return isDotted
      ? Math.max(1, Math.floor(spanSixteenths / 6))
      : Math.max(1, Math.floor(spanSixteenths / 4));
    case '8': return Math.max(1, Math.floor(spanSixteenths / 6));
    default:  return spanSixteenths;
  }
}

export function getTupletActualSixteenths(tupletType: TupletType, spanDuration: NoteDuration): number {
  return durationToSixteenths(spanDuration);
}

export function getValidTupletTypesForDuration(spanDuration: NoteDuration): TupletType[] {
  const span = durationToSixteenths(spanDuration);
  const isDotted = (spanDuration as string).includes('.');

  if (isDotted) {
    const result: TupletType[] = ['2'];
    if (span >= 6) result.push('4', '5', '7', '8');
    return result;
  } else {
    const result: TupletType[] = [];
    if (span >= 2) result.push('3');
    if (span >= 4) result.push('5', '6', '7');
    return result;
  }
}

// ────────────────────────────────────────────────────────────────
// Beam group utilities
// ────────────────────────────────────────────────────────────────

export function getBeamGroupSixteenths(timeSignature: string): number {
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);
  if (bottom === 8 && top % 3 === 0 && top >= 6) {
    return 6;
  }
  return 16 / bottom;
}

/** 복합 박자 판별 (6/8, 9/8, 12/8 등) */
function isCompoundMeter(timeSignature: string): boolean {
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);
  return bottom === 8 && top % 3 === 0 && top >= 6;
}

function getBeamBreakPoints(timeSignature: string): number[] {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSignature);
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);

  if (isCompoundMeter(timeSignature)) {
    const points: number[] = [];
    for (let i = 6; i < sixteenthsPerBar; i += 6) points.push(i);
    return points;
  }

  if (bottom === 8 && top === 5) {
    return [6];
  }
  if (bottom === 8 && top === 7) {
    return [4, 8];
  }

  const beatSize = 16 / bottom;
  const points: number[] = [];
  for (let i = beatSize; i < sixteenthsPerBar; i += beatSize) points.push(i);
  return points;
}

// ────────────────────────────────────────────────────────────────
// Scale degree utilities
// ────────────────────────────────────────────────────────────────

const PITCH_NAMES_ORDER: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function getScaleDegrees(keySignature: string): PitchName[] {
  const rootLetter = keySignature.charAt(0) as PitchName;
  const rootIdx = PITCH_NAMES_ORDER.indexOf(rootLetter);
  if (rootIdx === -1) return [...PITCH_NAMES_ORDER];
  const result: PitchName[] = [];
  for (let i = 0; i < 7; i++) {
    result.push(PITCH_NAMES_ORDER[(rootIdx + i) % 7]);
  }
  return result;
}

export function generateAbcScaleNotes(keySignature: string): string[] {
  const scale = getScaleDegrees(keySignature);
  const isMinor = keySignature.endsWith('m');
  const rootIdx = PITCH_NAMES_ORDER.indexOf(scale[0]);

  const lowThreshold = isMinor ? 3 : 5;
  let octave = rootIdx >= lowThreshold ? 3 : 4;

  const result: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const pitch = scale[i % 7];
    if (i > 0) {
      const prev = scale[(i - 1) % 7];
      if (PITCH_NAMES_ORDER.indexOf(pitch) <= PITCH_NAMES_ORDER.indexOf(prev)) {
        octave++;
      }
    }
    if (octave <= 3) {
      result.push(pitch + ','.repeat(4 - octave));
    } else if (octave === 4) {
      result.push(pitch);
    } else {
      result.push(pitch.toLowerCase() + "'".repeat(octave - 5));
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────
// Key signature & accidental engine
// ────────────────────────────────────────────────────────────────

const KEY_SIG_MAP: Record<string, Record<string, string>> = {
  'C':  {},
  'G':  { F: '#' },
  'D':  { F: '#', C: '#' },
  'A':  { F: '#', C: '#', G: '#' },
  'E':  { F: '#', C: '#', G: '#', D: '#' },
  'B':  { F: '#', C: '#', G: '#', D: '#', A: '#' },
  'F#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
  'C#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },
  'F':  { B: 'b' },
  'Bb': { B: 'b', E: 'b' },
  'Eb': { B: 'b', E: 'b', A: 'b' },
  'Ab': { B: 'b', E: 'b', A: 'b', D: 'b' },
  'Db': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b' },
  'Gb': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b' },
  'Cb': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b', F: 'b' },
  'Am':  {},
  'Em':  { F: '#' },
  'Bm':  { F: '#', C: '#' },
  'F#m': { F: '#', C: '#', G: '#' },
  'C#m': { F: '#', C: '#', G: '#', D: '#' },
  'G#m': { F: '#', C: '#', G: '#', D: '#', A: '#' },
  'D#m': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
  'A#m': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },
  'Dm':  { B: 'b' },
  'Gm':  { B: 'b', E: 'b' },
  'Cm':  { B: 'b', E: 'b', A: 'b' },
  'Fm':  { B: 'b', E: 'b', A: 'b', D: 'b' },
  'Bbm': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b' },
  'Ebm': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b' },
  'Abm': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b', F: 'b' },
};

/** 조표에서 특정 음이름의 기본 변화를 반환 ('' | '#' | 'b') */
export function getKeySigAlteration(keySignature: string, pitchName: string): string {
  const map = KEY_SIG_MAP[keySignature] || {};
  return map[pitchName] || '';
}

/** 조표에 표기되는 변화표 개수(난이도·임시표 밀도 보정용) */
export function getKeySignatureAccidentalCount(keySignature: string): number {
  const map = KEY_SIG_MAP[keySignature] || {};
  return Object.keys(map).length;
}

function resolveAbcAccidental(
  pitch: PitchName,
  octave: number,
  accidental: Accidental,
  keySignature: string,
  measureState: Map<string, string>,
): string {
  if (pitch === 'rest') return '';

  const keySigAlt = getKeySigAlteration(keySignature, pitch);
  const noteKey = `${pitch}${octave}`;

  let desiredAlt: string;
  if (accidental === '') {
    desiredAlt = keySigAlt;
  } else if (accidental === 'n') {
    desiredAlt = '';
  } else {
    desiredAlt = accidental;
  }

  let currentAlt: string;
  if (measureState.has(noteKey)) {
    currentAlt = measureState.get(noteKey)!;
  } else {
    currentAlt = keySigAlt;
  }

  if (desiredAlt === currentAlt) {
    return '';
  }

  measureState.set(noteKey, desiredAlt);

  switch (desiredAlt) {
    case '#': return '^';
    case 'b': return '_';
    case '': return '=';
    default: return '';
  }
}


// ────────────────────────────────────────────────────────────────
// Enharmonic spelling
// ────────────────────────────────────────────────────────────────

/** MIDI 음높이 계산용 반음 오프셋 */
const PITCH_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function pitchToMidi(note: ScoreNote): number {
  if (note.pitch === 'rest') return -1;
  const base = PITCH_SEMITONES[note.pitch] ?? 0;
  const accVal = note.accidental === '#' ? 1 : note.accidental === 'b' ? -1 : 0;
  return (note.octave + 1) * 12 + base + accVal;
}

/**
 * 조표를 반영한 실제 MIDI 음높이 (건반 비교·성부 충돌 검사용).
 * 명시 임시표가 없으면 조표의 #/b를 적용하고, 제자리표(n)는 조표를 무시한 자연음.
 */
export function noteToMidiWithKey(note: ScoreNote, keySignature: string): number {
  if (note.pitch === 'rest') return -1;
  const base = PITCH_SEMITONES[note.pitch] ?? 0;
  let accVal = 0;
  if (note.accidental === 'n') {
    accVal = 0;
  } else if (note.accidental === '#') {
    accVal = 1;
  } else if (note.accidental === 'b') {
    accVal = -1;
  } else {
    const ka = getKeySigAlteration(keySignature, note.pitch);
    if (ka === '#') accVal = 1;
    else if (ka === 'b') accVal = -1;
  }
  return (note.octave + 1) * 12 + base + accVal;
}

/** 조표가 샤프계열인지 플랫계열인지 반환 */
const SHARP_KEYS = new Set(['G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']);
const FLAT_KEYS  = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);

function getKeySigType(keySignature: string): 'sharp' | 'flat' | 'none' {
  if (SHARP_KEYS.has(keySignature)) return 'sharp';
  if (FLAT_KEYS.has(keySignature))  return 'flat';
  return 'none';
}

const ENHARMONIC_TO_FLAT: Partial<Record<PitchName, { pitch: PitchName; acc: Accidental }>> = {
  C: { pitch: 'D', acc: 'b' },
  D: { pitch: 'E', acc: 'b' },
  F: { pitch: 'G', acc: 'b' },
  G: { pitch: 'A', acc: 'b' },
  A: { pitch: 'B', acc: 'b' },
};

const ENHARMONIC_TO_SHARP: Partial<Record<PitchName, { pitch: PitchName; acc: Accidental }>> = {
  D: { pitch: 'C', acc: '#' },
  E: { pitch: 'D', acc: '#' },
  G: { pitch: 'F', acc: '#' },
  A: { pitch: 'G', acc: '#' },
  B: { pitch: 'A', acc: '#' },
};

function normalizeEnharmonic(note: ScoreNote, preferFlat: boolean): ScoreNote {
  if (note.pitch === 'rest') return note;
  if (note.accidental === '#' && preferFlat) {
    const flat = ENHARMONIC_TO_FLAT[note.pitch];
    if (flat) return { ...note, pitch: flat.pitch, accidental: flat.acc };
  } else if (note.accidental === 'b' && !preferFlat) {
    const sharp = ENHARMONIC_TO_SHARP[note.pitch];
    if (sharp) return { ...note, pitch: sharp.pitch, accidental: sharp.acc };
  }
  return note;
}

function applyEnharmonicSpelling(notes: ScoreNote[], keySignature: string): ScoreNote[] {
  const keySigType = getKeySigType(keySignature);

  return notes.map((note, i) => {
    if (note.pitch === 'rest') return note;
    if (note.accidental !== '#' && note.accidental !== 'b') return note;

    const keySigMap = KEY_SIG_MAP[keySignature] || {};
    if (keySigMap[note.pitch] === note.accidental) return note;

    const prevNote = (() => {
      for (let j = i - 1; j >= 0; j--) {
        if (notes[j].pitch !== 'rest') return notes[j];
      }
      return null;
    })();
    const nextNote = (() => {
      for (let j = i + 1; j < notes.length; j++) {
        if (notes[j].pitch !== 'rest') return notes[j];
      }
      return null;
    })();

    let direction: 'up' | 'down' | 'none' = 'none';
    const currMidi = pitchToMidi(note);
    if (nextNote) {
      const nextMidi = pitchToMidi(nextNote);
      direction = nextMidi > currMidi ? 'up' : nextMidi < currMidi ? 'down' : 'none';
    } else if (prevNote) {
      const prevMidi = pitchToMidi(prevNote);
      direction = currMidi > prevMidi ? 'up' : currMidi < prevMidi ? 'down' : 'none';
    }

    let preferFlat: boolean;
    if (keySigType === 'flat') {
      preferFlat = true;
    } else if (keySigType === 'sharp') {
      preferFlat = false;
    } else {
      preferFlat = direction === 'down';
    }

    return normalizeEnharmonic(note, preferFlat);
  });
}

// ────────────────────────────────────────────────────────────────
// Beat visibility: 필수 박 경계에서 음표 분할
// ────────────────────────────────────────────────────────────────

function getMandatoryBoundaries(timeSignature: string): number[] {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSignature);
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);

  if (timeSignature === '4/4' || timeSignature === 'C') {
    return [8];
  }

  if (timeSignature === '3/4') {
    return [8];
  }

  if (top === 2) {
    return [];
  }

  if (isCompoundMeter(timeSignature)) {
    const points: number[] = [];
    for (let i = 6; i < sixteenthsPerBar; i += 6) points.push(i);
    return points;
  }

  const beatSize = 16 / bottom;
  const points: number[] = [];
  for (let i = beatSize; i < sixteenthsPerBar; i += beatSize) points.push(i);
  return points;
}

function findExactDuration(sixteenths: number): NoteDuration | null {
  for (const [s, d] of SIXTEENTHS_TO_DURATION) {
    if (s === sixteenths) return d;
  }
  return null;
}

/** 음표 스트림 총 길이(16분음표). 잇단음표는 span 기준. */
function sumScoreNotesSixteenths(notes: ScoreNote[]): number {
  let sum = 0;
  let tupletRemaining = 0;
  let tupletSpanAcc = 0;
  for (const note of notes) {
    if (note.tuplet && tupletRemaining === 0) {
      tupletRemaining = parseInt(note.tuplet, 10);
      tupletSpanAcc = getTupletActualSixteenths(
        note.tuplet, note.tupletSpan || note.duration,
      );
    }
    if (tupletRemaining > 0) {
      tupletRemaining--;
      if (tupletRemaining === 0) sum += tupletSpanAcc;
    } else {
      sum += durationToSixteenths(note.duration);
    }
  }
  return sum;
}

/**
 * 박 가시성 규칙에 따라 필수 박 경계를 넘는 음표를 분할.
 * 같은 음이 이어지는 조각은 붙임줄(타이)로 tie: true → ABC `-` 출력.
 *
 * 잇단음표 그룹 내부는 분할하지 않음.
 * pickupSixteenths>0 이면 마디 길이 배열로 경계를 잡는다(못갖춘마디).
 */
function splitAtBeatBoundaries(
  notes: ScoreNote[],
  timeSignature: string,
  pickupSixteenths = 0,
): ScoreNote[] {
  const B = getSixteenthsPerBar(timeSignature);
  const total = sumScoreNotesSixteenths(notes);
  const barLengths = computeBarLengthsFromTotal(total, B, pickupSixteenths);
  if (barLengths.length === 0) return notes;

  const mandatoryAll = getMandatoryBoundaries(timeSignature);

  const _isCompound = isCompoundMeter(timeSignature);
  const [, _btm] = timeSignature.split('/');
  const _beatSize = _isCompound ? 6 : 16 / (parseInt(_btm, 10) || 4);
  const allBeatBounds: number[] = [];
  for (let i = _beatSize; i < B; i += _beatSize) allBeatBounds.push(i);

  if (mandatoryAll.length === 0 && allBeatBounds.length === 0) return notes;

  const barStarts = barGlobalStarts(barLengths);
  const result: ScoreNote[] = [];
  let globalPos = 0;
  let tupletRemaining = 0;
  let tupletSpanSixteenths = 0;

  for (const note of notes) {
    if (note.tuplet) {
      const p = parseInt(note.tuplet, 10);
      tupletRemaining = p;
      tupletSpanSixteenths = getTupletActualSixteenths(
        note.tuplet, note.tupletSpan || note.duration,
      );
    }

    if (tupletRemaining > 0) {
      result.push(note);
      tupletRemaining--;
      if (tupletRemaining === 0) {
        globalPos += tupletSpanSixteenths;
      }
      continue;
    }

    const dur = durationToSixteenths(note.duration);
    const noteStart = globalPos;
    const noteEnd = noteStart + dur;

    if (note.pitch === 'rest') {
      result.push(note);
      globalPos = noteEnd;
      continue;
    }

    const splitGlobals = new Set<number>();
    let traverse = noteStart;
    while (traverse < noteEnd) {
      const { bi, local: locStart } = getBarIndexAndLocal(traverse, barLengths);
      const barLen = barLengths[bi];
      const barGStart = barStarts[bi];
      const barGEnd = barGStart + barLen;
      const chunkEnd = Math.min(noteEnd, barGEnd);

      const locEnd = chunkEnd - barGStart;

      const mandInBar = mandatoryAll.filter(
        (b) => b < barLen && b > locStart && b < locEnd,
      );
      for (const b of mandInBar) {
        splitGlobals.add(barGStart + b);
      }

      if (locStart % _beatSize !== 0) {
        const offBeatBounds = allBeatBounds.filter(
          (b) => b < barLen && b > locStart && b < locEnd,
        );
        for (const b of offBeatBounds) {
          splitGlobals.add(barGStart + b);
        }
      }

      // 홑박자 점음표 분해: 박 위에서 시작하는 점음표가 다음 박 경계를 넘으면
      // 기본 음가 + 점 음가로 분할 (예: 점4분 → 4분- 8분 붙임줄)
      // 겹박자(6/8 등)에서는 점4분이 기본 박이므로 적용하지 않음
      if (!_isCompound && (note.duration as string).includes('.') && locStart % _beatSize === 0) {
        const baseDur = Math.round(dur * 2 / 3);
        const splitLocal = locStart + baseDur;
        if (
          splitLocal > locStart && splitLocal < locEnd &&
          splitLocal % _beatSize === 0 &&
          !mandatoryAll.includes(splitLocal)
        ) {
          splitGlobals.add(barGStart + splitLocal);
        }
      }

      if (chunkEnd < noteEnd) {
        splitGlobals.add(chunkEnd);
      }
      traverse = chunkEnd;
    }

    const sortedSplits = [...splitGlobals].sort((a, b) => a - b);

    if (sortedSplits.length === 0) {
      result.push(note);
      globalPos = noteEnd;
      continue;
    }

    let currentStart = noteStart;
    const splitPoints = [...sortedSplits, noteEnd];
    let segIndex = 0;
    const segments: ScoreNote[] = [];

    for (const segEnd of splitPoints) {
      if (segEnd <= currentStart) continue;
      const segDur = segEnd - currentStart;
      const segDuration = findExactDuration(segDur);
      if (!segDuration) {
        segments.length = 0;
        break;
      }
      const isLastSeg = segEnd >= noteEnd;
      const needsTie = !isLastSeg || (note.tie ?? false);
      segments.push({
        ...note,
        duration: segDuration,
        tie: needsTie,
        tuplet: undefined as unknown as TupletType,
        tupletSpan: undefined,
        tupletNoteDur: undefined,
        id: segIndex === 0 ? note.id : `${note.id}_s${segIndex}`,
      });
      segIndex++;
      currentStart = segEnd;
    }

    if (segments.length === 0) {
      result.push(note);
    } else {
      for (const s of segments) result.push(s);
    }

    globalPos = noteEnd;
  }

  return result;
}

// ────────────────────────────────────────────────────────────────
// Pitch -> ABC conversion
// ────────────────────────────────────────────────────────────────

function pitchToAbc(pitch: string, octave: number, accidentalPrefix: string): string {
  if (pitch === 'rest') return 'z';
  let s = accidentalPrefix;

  if (octave <= 2) {
    s += pitch + ',' + ','.repeat(3 - octave);
  } else if (octave === 3) {
    s += pitch + ',';
  } else if (octave === 4) {
    s += pitch;
  } else if (octave === 5) {
    s += pitch.toLowerCase();
  } else if (octave >= 6) {
    s += pitch.toLowerCase() + "'".repeat(octave - 5);
  }
  return s;
}

// ────────────────────────────────────────────────────────────────
// Last-measure tie merge
// ────────────────────────────────────────────────────────────────

function mergeTiedNotesInLastMeasure(
  notes: ScoreNote[],
  timeSignature: string,
  pickupSixteenths = 0,
): ScoreNote[] {
  if (notes.length === 0) return notes;

  const B = getSixteenthsPerBar(timeSignature);
  const total = sumScoreNotesSixteenths(notes);
  const barLengths = computeBarLengthsFromTotal(total, B, pickupSixteenths);
  if (barLengths.length === 0) return notes;

  const lastBarLen = barLengths[barLengths.length - 1];
  const lastMeasureStartGlobal = total - lastBarLen;

  let cum = 0;
  let lastMeasureStartIdx = 0;
  let tupletRemaining = 0;
  let tupletSpanAcc = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    let dur = 0;

    if (note.tuplet && tupletRemaining === 0) {
      tupletRemaining = parseInt(note.tuplet, 10);
      tupletSpanAcc = getTupletActualSixteenths(note.tuplet, note.tupletSpan || note.duration);
    }
    if (tupletRemaining > 0) {
      tupletRemaining--;
      if (tupletRemaining === 0) dur = tupletSpanAcc;
    } else {
      dur = durationToSixteenths(note.duration);
    }

    if (cum >= lastMeasureStartGlobal) {
      lastMeasureStartIdx = i;
      break;
    }
    cum += dur;
  }

  const beforeLast = notes.slice(0, lastMeasureStartIdx);
  const lastMeasure = notes.slice(lastMeasureStartIdx);

  const merged: ScoreNote[] = [];
  let i = 0;
  while (i < lastMeasure.length) {
    const note = lastMeasure[i];

    if (note.tuplet) {
      merged.push(note);
      i++;
      continue;
    }

    if (note.pitch === 'rest') {
      let totalDur = durationToSixteenths(note.duration);
      let j = i + 1;
      while (j < lastMeasure.length) {
        const next = lastMeasure[j];
        if (!next.tuplet && next.pitch === 'rest') {
          totalDur += durationToSixteenths(next.duration);
          j++;
        } else {
          break;
        }
      }
      const mergedDur = findExactDuration(totalDur) ?? sixteenthsToDuration(totalDur);
      merged.push({ ...note, duration: mergedDur, id: note.id });
      i = j;
      continue;
    }

    let totalDur = durationToSixteenths(note.duration);
    let j = i + 1;

    while (j < lastMeasure.length) {
      const next = lastMeasure[j];
      if (
        !next.tuplet &&
        next.pitch === note.pitch &&
        next.octave === note.octave &&
        next.accidental === note.accidental
      ) {
        totalDur += durationToSixteenths(next.duration);
        j++;
      } else {
        break;
      }
    }

    if (j > i + 1) {
      const mergedDur = findExactDuration(totalDur) ?? sixteenthsToDuration(totalDur);
      const lastTie = lastMeasure[j - 1].tie ?? false;
      merged.push({ ...note, duration: mergedDur, tie: lastTie });
      i = j;
    } else {
      merged.push(note);
      i++;
    }
  }

  return [...beforeLast, ...merged];
}

// ────────────────────────────────────────────────────────────────
// Rest decomposition
// ────────────────────────────────────────────────────────────────

function generateRestAbc(
  durationSixteenths: number,
  timeSignature: string,
  barPosition: number,
): string[] {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSignature);

  if (barPosition === 0 && durationSixteenths === sixteenthsPerBar) {
    return ['Z'];
  }

  const result: string[] = [];
  let remaining = durationSixteenths;
  let pos = barPosition;

  if (isCompoundMeter(timeSignature)) {
    const units = [12, 6, 2, 1];
    while (remaining > 0) {
      let fitted = false;
      for (const u of units) {
        if (u <= remaining) {
          result.push(u === 1 ? 'z' : `z${u}`);
          remaining -= u;
          fitted = true;
          break;
        }
      }
      if (!fitted) break;
    }
  } else {
    const [, bottomStr] = timeSignature.split('/');
    const bottom = parseInt(bottomStr, 10) || 4;
    const beatSize = 16 / bottom;
    const units = [16, 8, 4, 2, 1];

    while (remaining > 0) {
      const posInBeat = pos % beatSize;
      let fitted = false;
      for (const u of units) {
        if (u > remaining) continue;
        if (posInBeat !== 0 && u > beatSize - posInBeat) continue;
        result.push(u === 1 ? 'z' : `z${u}`);
        remaining -= u;
        pos += u;
        fitted = true;
        break;
      }
      if (!fitted) break;
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────
// Notes -> ABC string (핵심 파이프라인)
// ────────────────────────────────────────────────────────────────

function generateNotesAbc(
  notes: ScoreNote[],
  timeSignature: string,
  keySignature: string = 'C',
  pickupSixteenths = 0,
): string {
  if (notes.length === 0) return '|]';

  const spelledNotes = applyEnharmonicSpelling(notes, keySignature);
  const splitNotes = splitAtBeatBoundaries(spelledNotes, timeSignature, pickupSixteenths);
  const mergedNotes = mergeTiedNotesInLastMeasure(splitNotes, timeSignature, pickupSixteenths);

  // 끊어진 붙임줄 정리 — tie 뒤에 쉼표·다른 음이 오면 tie 제거
  const processedNotes = mergedNotes.map((note, idx) => {
    if (!note.tie || note.pitch === 'rest') return note;
    const next = mergedNotes[idx + 1];
    if (
      !next ||
      next.pitch === 'rest' ||
      next.pitch !== note.pitch ||
      next.octave !== note.octave ||
      next.accidental !== note.accidental
    ) {
      return { ...note, tie: false };
    }
    return note;
  });

  const sixteenthsPerBar = getSixteenthsPerBar(timeSignature);
  const totalProc = sumScoreNotesSixteenths(processedNotes);
  const barLengths = computeBarLengthsFromTotal(totalProc, sixteenthsPerBar, pickupSixteenths);
  let barIdx = 0;
  const currentBarCap = () => barLengths[barIdx] ?? sixteenthsPerBar;

  const beamBreaks = getBeamBreakPoints(timeSignature);
  let currentBarSixteenths = 0;
  let abcNotes = '';
  let tupletRemaining = 0;
  let currentTupletNoteDur = 0;
  let currentTupletSpanSixteenths = 0;

  let measureAccState = new Map<string, string>();

  let measureNoteBuffer: { note: ScoreNote; dur: number }[] = [];
  let measureAbcBuffer = '';

  function flushMeasure() {
    abcNotes += measureAbcBuffer;
    measureNoteBuffer = [];
    measureAbcBuffer = '';
  }

  processedNotes.forEach((note) => {
    if (note.tuplet && tupletRemaining === 0) {
      const p = parseInt(note.tuplet, 10);
      const spanDur = note.tupletSpan || note.duration;
      const isDotted = (spanDur as string).includes('.');
      let q: number;
      switch (note.tuplet) {
        case '2': q = 3; break;
        case '3': q = 2; break;
        case '4': q = 6; break;
        case '5': q = isDotted ? 6 : 4; break;
        case '6': q = 4; break;
        case '7': q = isDotted ? 6 : 4; break;
        case '8': q = 6; break;
        default:  q = 2;
      }
      if (measureAbcBuffer.length > 0 && !measureAbcBuffer.endsWith(' ')) {
        measureAbcBuffer += ' ';
      }
      measureAbcBuffer += `(${p}:${q}:${p}`;
      tupletRemaining = p;
      currentTupletNoteDur = note.tupletNoteDur ||
        getTupletNoteDuration(note.tuplet, note.tupletSpan || note.duration);
      currentTupletSpanSixteenths = getTupletActualSixteenths(
        note.tuplet, note.tupletSpan || note.duration,
      );
    }

    // 쉼표 처리
    if (note.pitch === 'rest' && tupletRemaining === 0) {
      if (measureAbcBuffer.length > 0 && !measureAbcBuffer.endsWith(' ')) {
        measureAbcBuffer += ' ';
      }
      const restDur = durationToSixteenths(note.duration);
      const restAbcs = generateRestAbc(restDur, timeSignature, currentBarSixteenths);
      for (const r of restAbcs) {
        measureAbcBuffer += r + ' ';
      }
      measureNoteBuffer.push({ note, dur: restDur });
      currentBarSixteenths += restDur;

      if (currentBarSixteenths >= currentBarCap()) {
        flushMeasure();
        abcNotes += '| ';
        currentBarSixteenths = 0;
        measureAccState = new Map();
        barIdx++;
      }
      return;
    }

    let accPrefix = '';
    if (note.pitch !== 'rest') {
      accPrefix = resolveAbcAccidental(
        note.pitch, note.octave, note.accidental,
        keySignature, measureAccState,
      );
    }

    const abcPitch = pitchToAbc(note.pitch, note.octave, accPrefix);

    let dur16ths: number;
    if (tupletRemaining > 0) {
      dur16ths = currentTupletNoteDur;
    } else {
      dur16ths = durationToSixteenths(note.duration);
    }
    const durStr = dur16ths === 1 ? '' : dur16ths.toString();

    // ── 빔 사전 분리: non-beamable이거나 새 빔 그룹 시작이면 앞에 공백 ──
    if (tupletRemaining <= 0) {
      const isBeamable = dur16ths <= 3;
      if (measureAbcBuffer.length > 0 && !measureAbcBuffer.endsWith(' ')) {
        if (!isBeamable || beamBreaks.some(bp => bp === currentBarSixteenths)) {
          measureAbcBuffer += ' ';
        }
      }
    }

    measureAbcBuffer += abcPitch + durStr;
    if (note.tie) measureAbcBuffer += '-';

    measureNoteBuffer.push({ note, dur: dur16ths });

    if (tupletRemaining > 0) {
      tupletRemaining--;
      if (tupletRemaining === 0) {
        currentBarSixteenths += currentTupletSpanSixteenths;
        if (currentBarSixteenths >= currentBarCap()) {
          flushMeasure();
          abcNotes += '| ';
          currentBarSixteenths = 0;
          measureAccState = new Map();
          barIdx++;
        }
      }
      if (tupletRemaining > 0) {
        // 잇단음표 내부: beam 연결 유지
      } else {
        measureAbcBuffer += ' ';
      }
    } else {
      currentBarSixteenths += dur16ths;

      // ── 빔 사후 분리: beamBreaks 기반 그룹 경계에서만 끊기 ──
      const isBeamable = dur16ths <= 3;
      const atBarEnd = currentBarSixteenths >= currentBarCap();

      if (!isBeamable || atBarEnd || beamBreaks.some(bp => bp === currentBarSixteenths)) {
        measureAbcBuffer += ' ';
      }
    }

    if (currentBarSixteenths >= currentBarCap()) {
      flushMeasure();
      abcNotes += '| ';
      currentBarSixteenths = 0;
      measureAccState = new Map();
      barIdx++;
    }
  });

  if (measureAbcBuffer) {
    flushMeasure();
  }

  if (!abcNotes.endsWith('| ')) {
    abcNotes += '|]';
  } else {
    abcNotes = abcNotes.slice(0, -2) + ' |]';
  }
  return abcNotes.trim();
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

export function getMeasureCount(state: ScoreState): number {
  const body = generateNotesAbc(
    state.notes,
    state.timeSignature,
    state.keySignature,
    state.pickupSixteenths ?? 0,
  );
  return (body.match(/\|/g) || []).length;
}

function applyPickupFill(notes: ScoreNote[], timeSignature: string, pickupSixteenths: number): ScoreNote[] {
  if (pickupSixteenths <= 0 || notes.length === 0) return notes;
  const B = getSixteenthsPerBar(timeSignature);
  const P = pickupSixteenths;
  const totalSixteenths = sumScoreNotesSixteenths(notes);
  const lengths = computeBarLengthsFromTotal(totalSixteenths, B, P);
  const lastLen = lengths[lengths.length - 1] ?? 0;
  let needLast = lastLen;
  if (P > 0 && totalSixteenths % B === 0 && totalSixteenths > P) {
    needLast = B - P;
  }
  if (lastLen < needLast) {
    const diff = needLast - lastLen;
    const fillDur = findExactDuration(diff);
    if (fillDur) {
      return [...notes, { pitch: 'rest', octave: 4, accidental: '', duration: fillDur, id: '__pickup_fill__' }];
    }
  }
  return notes;
}

function countMeasures(abcBody: string): number {
  return (abcBody.match(/\|/g) || []).length;
}

function padWithFullRests(abcBody: string, targetMeasures: number): string {
  const current = countMeasures(abcBody);
  if (current >= targetMeasures) return abcBody;
  const diff = targetMeasures - current;
  const withoutEnd = abcBody.endsWith('|]')
    ? abcBody.slice(0, -2)
    : abcBody;
  const padding = Array(diff).fill('Z').join(' | ');
  return withoutEnd + '| ' + padding + ' |]';
}

export function generateAbc(state: ScoreState): string {
  const useGrandStaff = state.useGrandStaff ?? false;
  const bassNotes = state.bassNotes ?? [];
  const pickupSixteenths = state.pickupSixteenths ?? 0;

  const notesToProcess = applyPickupFill(state.notes, state.timeSignature, pickupSixteenths);
  const bassNotesToProcess = applyPickupFill(bassNotes, state.timeSignature, pickupSixteenths);

  let trebleBody = generateNotesAbc(
    notesToProcess,
    state.timeSignature,
    state.keySignature,
    pickupSixteenths,
  );
  const measureCount = countMeasures(trebleBody);

  const directives: string[] = ['%%barsperstaff 4'];
  const shouldStretch = measureCount > 0 && measureCount % 4 === 0;
  directives.push(`%%stretchlast ${shouldStretch ? 'true' : 'false'}`);
  if (useGrandStaff) directives.push('%%staves {V1 V2}');

  const header = [
    `X: 1`,
    `T: ${state.title || 'Score'}`,
    `M: ${state.timeSignature}`,
    `L: 1/16`,
    `Q: 1/4=${state.tempo}`,
    ...directives,
    `K: ${state.keySignature}`,
  ].join('\n');

  if (!useGrandStaff) {
    return header + '\n' + trebleBody;
  }

  let bassBody = generateNotesAbc(
    bassNotesToProcess,
    state.timeSignature,
    state.keySignature,
    pickupSixteenths,
  );

  const trebleMeasures = countMeasures(trebleBody);
  const bassMeasures = countMeasures(bassBody);
  if (trebleMeasures > bassMeasures) {
    bassBody = padWithFullRests(bassBody, trebleMeasures);
  } else if (bassMeasures > trebleMeasures) {
    trebleBody = padWithFullRests(trebleBody, bassMeasures);
  }

  return header + '\nV:V1 clef=treble\n' + trebleBody + '\nV:V2 clef=bass\n' + bassBody;
}
