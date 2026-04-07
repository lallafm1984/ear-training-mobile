// ────────────────────────────────────────────────────────────────
// Bass & two-voice shared utilities
// ────────────────────────────────────────────────────────────────

import type { PitchName, ScoreNote } from './types';
import { durationToSixteenths, getTupletActualSixteenths } from './duration';
import { noteToMidiWithKey } from './midi';
import { PITCH_ORDER } from './noteFactory';

/** 루트가 높은 조(G,A,B)에서 wrap 편향 보정용 베이스 옥타브 계산 */
export function getBassBaseOctave(scale: PitchName[]): number {
  const rootIdx = PITCH_ORDER.indexOf(scale[0]);
  return rootIdx >= 4 ? 2 : 3;
}

export const CHORD_TONES: Record<number, number[]> = {
  0: [0, 2, 4], 1: [1, 3, 5], 2: [2, 4, 6],
  3: [3, 5, 0], 4: [4, 6, 1], 5: [5, 0, 2], 6: [6, 1, 3],
};

/** 불협화 pitch-class 간격: m2, M2, P4, tritone, m7, M7 */
export const DISSONANT_PC = new Set([1, 2, 5, 6, 10, 11]);

/** 불완전 협화음 pitch-class 간격: m3, M3, m6, M6 */
export const IMPERFECT_CONSONANT_PC = new Set([3, 4, 8, 9]);

/** 낮은음자리표 §4: 두 성부 최소 간격 — 단 10도(= 15반음) */
export const MIN_TREBLE_BASS_SEMITONES = 15;

/** 한 마디 트레블: 음 시작 offset(16분) → MIDI (조표 반영, 성부 동일 건반 회피용) */
export function buildTrebleAttackMidiMap(barSlice: ScoreNote[], keySignature: string): Map<number, number> {
  const map = new Map<number, number>();
  let off = 0;
  let i = 0;
  while (i < barSlice.length) {
    const n = barSlice[i];
    if (n.tuplet) {
      const p = parseInt(n.tuplet, 10);
      const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
      if (n.pitch !== 'rest') {
        map.set(off, noteToMidiWithKey(n, keySignature));
      }
      off += span;
      i += p;
    } else {
      if (n.pitch !== 'rest') {
        map.set(off, noteToMidiWithKey(n, keySignature));
      }
      off += durationToSixteenths(n.duration);
      i += 1;
    }
  }
  return map;
}

/** 트레블과 동시에 같은 건반이 아니고, §4 간격(단 10도 이상)을 만족하는지 */
export function passesBassSpacing(
  note: ScoreNote,
  bassOff: number,
  trebleAttackMap: Map<number, number>,
  keySignature: string,
): boolean {
  const clashMidi = trebleAttackMap.get(bassOff);
  if (clashMidi === undefined) return true;
  const bassMidi = noteToMidiWithKey(note, keySignature);
  if (bassMidi === clashMidi) return false;
  return clashMidi - bassMidi >= MIN_TREBLE_BASS_SEMITONES;
}

/** 현재 bnn과 같은 옥타브 블록에서 화음 구성음 후보 */
export function chordToneBnnCandidates(n: number, bTones: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of bTones) {
    for (const base of [
      Math.floor(n / 7) * 7 + t,
      Math.floor(n / 7) * 7 + t - 7,
      Math.floor(n / 7) * 7 + t + 7,
    ]) {
      const c = Math.max(-5, Math.min(4, base));
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return out;
}

/** 가장 가까운 화음 구성음으로 snap */
export function snapToChordTone(nn: number, bTones: number[]): number {
  let best = nn, bestDist = Infinity;
  for (const t of bTones) {
    for (const base of [
      Math.floor(nn / 7) * 7 + t,
      Math.floor(nn / 7) * 7 + t - 7,
      Math.floor(nn / 7) * 7 + t + 7,
    ]) {
      if (base < -5 || base > 4) continue;
      const d = Math.abs(base - nn);
      if (d < bestDist) { bestDist = d; best = base; }
    }
  }
  return Math.max(-5, Math.min(4, best));
}
