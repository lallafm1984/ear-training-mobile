// ────────────────────────────────────────────────────────────────
// Key signature & scale utilities
// ────────────────────────────────────────────────────────────────

import type { PitchName, Accidental } from './types';

const PITCH_NAMES_ORDER: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * 조표에서 음계 구성음(7도)을 자동 생성.
 */
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

/**
 * 렌더러용 ABC 표기 음계 생성 (1옥타브 8음: 7도 + 상위 으뜸음).
 */
export function generateAbcScaleNotes(keySignature: string): string[] {
  const scale = getScaleDegrees(keySignature);
  const isMinor = keySignature.endsWith('m');
  const rootIdx = PITCH_NAMES_ORDER.indexOf(scale[0]);

  const lowThreshold = isMinor ? 3 : 5;
  let octave = rootIdx >= lowThreshold ? 3 : 4;

  let seventhPrefix = '';
  if (isMinor) {
    const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    const FLAT_KEYS: Record<string, number> = {
      'Dm': 1, 'Gm': 2, 'Cm': 3, 'Fm': 4, 'Bbm': 5, 'Ebm': 6, 'Abm': 7
    };
    const numFlats = FLAT_KEYS[keySignature] || 0;
    const flattedNotes = FLAT_ORDER.slice(0, numFlats);
    const seventhDegree = scale[6];
    seventhPrefix = flattedNotes.includes(seventhDegree) ? '=' : '^';
  }

  const result: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const pitch = scale[i % 7];
    if (i > 0) {
      const prev = scale[(i - 1) % 7];
      if (PITCH_NAMES_ORDER.indexOf(pitch) <= PITCH_NAMES_ORDER.indexOf(prev)) {
        octave++;
      }
    }
    const prefix = (isMinor && i === 6) ? seventhPrefix : '';
    if (octave <= 3) {
      result.push(prefix + pitch + ','.repeat(4 - octave));
    } else if (octave === 4) {
      result.push(prefix + pitch);
    } else {
      result.push(prefix + pitch.toLowerCase() + "'".repeat(octave - 5));
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────
// Key signature & accidental engine
// ────────────────────────────────────────────────────────────────

/**
 * 조표별 기본 변화음 맵 (샤프 추가 순서: F C G D A E B / 플랫 추가 순서: B E A D G C F)
 */
export const KEY_SIG_MAP: Record<string, Record<string, string>> = {
  // ── 샤프계 장조 ──────────────────────────────────────────────
  'C':  {},
  'G':  { F: '#' },
  'D':  { F: '#', C: '#' },
  'A':  { F: '#', C: '#', G: '#' },
  'E':  { F: '#', C: '#', G: '#', D: '#' },
  'B':  { F: '#', C: '#', G: '#', D: '#', A: '#' },
  'F#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
  'C#': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },
  // ── 플랫계 장조 ──────────────────────────────────────────────
  'F':  { B: 'b' },
  'Bb': { B: 'b', E: 'b' },
  'Eb': { B: 'b', E: 'b', A: 'b' },
  'Ab': { B: 'b', E: 'b', A: 'b', D: 'b' },
  'Db': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b' },
  'Gb': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b' },
  'Cb': { B: 'b', E: 'b', A: 'b', D: 'b', G: 'b', C: 'b', F: 'b' },
  // ── 샤프계 단조 ───────────────────
  'Am':  {},
  'Em':  { F: '#' },
  'Bm':  { F: '#', C: '#' },
  'F#m': { F: '#', C: '#', G: '#' },
  'C#m': { F: '#', C: '#', G: '#', D: '#' },
  'G#m': { F: '#', C: '#', G: '#', D: '#', A: '#' },
  'D#m': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' },
  'A#m': { F: '#', C: '#', G: '#', D: '#', A: '#', E: '#', B: '#' },
  // ── 플랫계 단조 ───────────────────
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

/**
 * 음표에 대해 실제 출력해야 할 ABC 임시표 접두사를 결정.
 */
export function resolveAbcAccidental(
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
