// ────────────────────────────────────────────────────────────────
// Note construction utilities
// ────────────────────────────────────────────────────────────────

import type { PitchName, Accidental, NoteDuration, ScoreNote } from './types';

export const PITCH_ORDER: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function uid(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function makeNote(
  pitch: PitchName, octave: number, dur: NoteDuration,
  accidental: Accidental = '', tie = false,
): ScoreNote {
  return { id: uid(), pitch, octave, accidental, duration: dur, tie };
}

export function makeRest(dur: NoteDuration): ScoreNote {
  return makeNote('rest', 4, dur);
}

export function noteNumToNote(
  noteNum: number, scale: PitchName[], baseOctave: number,
): { pitch: PitchName; octave: number } {
  const deg = ((noteNum % 7) + 7) % 7;
  const octOff = Math.floor(noteNum / 7);
  const pitch = scale[deg];
  const rootIdx = PITCH_ORDER.indexOf(scale[0]);
  const pitchIdx = PITCH_ORDER.indexOf(pitch);
  const wrap = pitchIdx < rootIdx ? 1 : 0;
  return { pitch, octave: baseOctave + octOff + wrap };
}

/** nn 역산: pitch+octave → nn (noteNumToNote의 역함수) */
export function scaleNoteToNn(
  pitch: PitchName, octave: number, scale: PitchName[], baseOctave: number,
): number {
  const rootIdx = PITCH_ORDER.indexOf(scale[0]);
  const pitchIdx = PITCH_ORDER.indexOf(pitch);
  const degIdx = scale.indexOf(pitch);
  if (degIdx < 0) return 0;
  const wrap = pitchIdx < rootIdx ? 1 : 0;
  const octaveOffset = octave - baseOctave - wrap;
  return octaveOffset * 7 + degIdx;
}
