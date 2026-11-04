// ────────────────────────────────────────────────────────────────
// MIDI conversion & enharmonic spelling
// ────────────────────────────────────────────────────────────────

import type { PitchName, Accidental, ScoreNote } from './types';
import { getKeySigAlteration, KEY_SIG_MAP } from './keySignature';

/** MIDI 음높이 계산용 반음 오프셋 */
export const PITCH_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function pitchToMidi(note: ScoreNote): number {
  if (note.pitch === 'rest') return -1;
  const base = PITCH_SEMITONES[note.pitch] ?? 0;
  const accVal = note.accidental === '#' ? 1 : note.accidental === 'b' ? -1 : 0;
  return (note.octave + 1) * 12 + base + accVal;
}

// ── nn → MIDI 변환 (선율 규칙용) ──────────────────────────────
const PITCH_ORDER_UTILS: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** nn(스케일 디그리 인덱스) → MIDI 번호 변환 (조표 반영) */
export function nnToMidi(
  nn: number,
  scale: PitchName[],
  baseOctave: number,
  keySignature: string,
): number {
  const deg = ((nn % 7) + 7) % 7;
  const octOff = Math.floor(nn / 7);
  const pitch = scale[deg];
  const rootIdx = PITCH_ORDER_UTILS.indexOf(scale[0]);
  const pitchIdx = PITCH_ORDER_UTILS.indexOf(pitch);
  const wrap = pitchIdx < rootIdx ? 1 : 0;
  const octave = baseOctave + octOff + wrap;

  const base = PITCH_SEMITONES[pitch] ?? 0;
  const ka = getKeySigAlteration(keySignature, pitch);
  let accVal = 0;
  if (ka === '#') accVal = 1;
  else if (ka === 'b') accVal = -1;
  return (octave + 1) * 12 + base + accVal;
}

/** 두 nn 사이의 반음(semitone) 거리 (절대값) */
export function getMidiInterval(
  nn1: number,
  nn2: number,
  scale: PitchName[],
  baseOctave: number,
  keySignature: string,
): number {
  return Math.abs(
    nnToMidi(nn1, scale, baseOctave, keySignature) - nnToMidi(nn2, scale, baseOctave, keySignature),
  );
}

/**
 * 금지 음정 여부 판별.
 */
export function isForbiddenMelodicInterval(semitoneDist: number, nnDist: number): boolean {
  if (semitoneDist === 6 && nnDist >= 3 && nnDist <= 4) return true;
  if (semitoneDist === 3 && nnDist === 1) return true;
  return false;
}

/**
 * 조표를 반영한 실제 MIDI 음높이 (건반 비교·성부 충돌 검사용).
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

// ────────────────────────────────────────────────────────────────
// Enharmonic spelling
// ────────────────────────────────────────────────────────────────

const SHARP_KEYS = new Set([
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'Em',
  'Bm',
  'F#m',
  'C#m',
  'G#m',
  'D#m',
  'A#m',
]);
const FLAT_KEYS = new Set([
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'Cb',
  'Dm',
  'Gm',
  'Cm',
  'Fm',
  'Bbm',
  'Ebm',
  'Abm',
]);

function getKeySigType(keySignature: string): 'sharp' | 'flat' | 'none' {
  if (SHARP_KEYS.has(keySignature)) return 'sharp';
  if (FLAT_KEYS.has(keySignature)) return 'flat';
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

/**
 * 이명동음 선택 전처리.
 */
export function applyEnharmonicSpelling(notes: ScoreNote[], keySignature: string): ScoreNote[] {
  const keySigType = getKeySigType(keySignature);
  // 화성단음계 이끔음(올린 7음) 글자 — 조성 음이므로 이명동음 변환 대상에서 제외
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const isMinor = keySignature.endsWith('m');
  const rootLetterIdx = LETTERS.indexOf(keySignature[0]);
  const leadingLetter = isMinor && rootLetterIdx >= 0 ? LETTERS[(rootLetterIdx + 6) % 7] : null;

  return notes.map((note, i) => {
    if (note.pitch === 'rest') return note;
    if (note.accidental !== '#' && note.accidental !== 'b') return note;

    const keySigMap = KEY_SIG_MAP[keySignature] || {};
    if (keySigMap[note.pitch] === note.accidental) return note;
    if (leadingLetter && note.pitch === leadingLetter && note.accidental === '#') return note;

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

    // 반음계 임시표 표기 규칙(청음 시험 관행): 상행 해결 → #(아래 글자 올림), 하행 해결 → b(위 글자 내림).
    // 예) C장조 G#→A, A♭→G / G장조에서도 A♭→G (조표가 #이어도 하행은 b로 적는다)
    // 해결 방향을 알 수 없으면 조표 성격을 따르고, 그것도 없으면 원래 표기를 유지한다.
    let preferFlat: boolean;
    if (direction === 'down') {
      preferFlat = true;
    } else if (direction === 'up') {
      preferFlat = false;
    } else if (keySigType === 'flat') {
      preferFlat = true;
    } else if (keySigType === 'sharp') {
      preferFlat = false;
    } else {
      preferFlat = note.accidental === 'b';
    }

    return normalizeEnharmonic(note, preferFlat);
  });
}
