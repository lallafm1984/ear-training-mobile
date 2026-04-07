// ────────────────────────────────────────────────────────────────
// BassNote[] → ScoreNote[] (grand staff bass staff)
// ────────────────────────────────────────────────────────────────

import type { BassNote } from './types';
import type { PitchName, NoteDuration, ScoreNote } from '../scoreUtils';
import { noteNumToNote, makeNote, SIXTEENTHS_TO_DUR } from '../scoreUtils';

/** 분할 가능한 음가 (큰 것부터, greedy 분할용) */
const SPLIT_DURATIONS: [number, NoteDuration][] = [
  [16, '1'], [12, '2.'], [8, '2'], [6, '4.'], [4, '4'], [3, '8.'], [2, '8'], [1, '16'],
];

/**
 * Convert engine bass output to score notes (L:1/8 duration → ABC duration).
 * 단일 NoteDuration으로 표현 불가한 길이(예: 9/8 L1의 18 sixteenths)는
 * 타이로 연결된 여러 음표로 분할합니다.
 */
export function bassLineToScoreNotes(
  bassLine: BassNote[],
  scale: PitchName[],
  bassBase: number,
  _keySignature: string,
): ScoreNote[] {
  const result: ScoreNote[] = [];
  for (const bn of bassLine) {
    const sixteenths = bn.duration * 2;
    const { pitch, octave } = noteNumToNote(bn.noteNum, scale, bassBase);
    const oct = Math.max(2, Math.min(4, octave));

    const durLabel = SIXTEENTHS_TO_DUR[sixteenths];
    if (durLabel) {
      result.push(makeNote(pitch, oct, durLabel as NoteDuration));
    } else {
      // 분할+타이: 큰 음가부터 greedy하게 채움
      let remaining = sixteenths;
      let isFirst = true;
      while (remaining > 0) {
        const entry = SPLIT_DURATIONS.find(([s]) => s <= remaining);
        if (!entry) break;
        const [s, dur] = entry;
        const note = makeNote(pitch, oct, dur);
        if (!isFirst) note.tie = true;
        result.push(note);
        remaining -= s;
        isFirst = false;
      }
    }
  }
  return result;
}
