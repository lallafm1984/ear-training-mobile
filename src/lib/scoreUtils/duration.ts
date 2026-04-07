// ────────────────────────────────────────────────────────────────
// Duration utilities
// ────────────────────────────────────────────────────────────────

import type { NoteDuration, TupletType } from './types';

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

// ────────────────────────────────────────────────────────────────
// Bar length helpers
// ────────────────────────────────────────────────────────────────

/**
 * 총 길이와 못갖춘마디(P)로 각 마디의 16분음표 길이를 구한다.
 */
export function computeBarLengthsFromTotal(
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

export function barGlobalStarts(barLengths: number[]): number[] {
  const s: number[] = [];
  let acc = 0;
  for (let i = 0; i < barLengths.length; i++) {
    s.push(acc);
    acc += barLengths[i];
  }
  return s;
}

export function getBarIndexAndLocal(globalPos: number, barLengths: number[]): { bi: number; local: number } {
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

/**
 * 잇단음표 법칙에 따라 개별 음표의 시각적 길이(16분음표 단위)를 계산합니다.
 */
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

/**
 * 잇단음표의 실제 차지하는 시간(16분음표 기준)을 계산합니다.
 */
export function getTupletActualSixteenths(tupletType: TupletType, spanDuration: NoteDuration): number {
  return durationToSixteenths(spanDuration);
}

/**
 * 해당 음표 길이(span)에 적용 가능한 잇단음표 종류를 반환합니다.
 */
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

/**
 * 박자표에 따른 beam(꼬리 묶음) 그룹 크기를 16분음표 단위로 반환.
 */
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
export function isCompoundMeter(timeSignature: string): boolean {
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);
  return bottom === 8 && top % 3 === 0 && top >= 6;
}

/**
 * 마디 내에서 beam이 끊어져야 하는 위치들을 16분음표 단위로 반환.
 */
export function getBeamBreakPoints(timeSignature: string): number[] {
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

/** 16분음표 수에 정확히 대응하는 NoteDuration을 찾는다. */
export function findExactDuration(sixteenths: number): NoteDuration | null {
  for (const [s, d] of SIXTEENTHS_TO_DURATION) {
    if (s === sixteenths) return d;
  }
  return null;
}

/** 음표 스트림 총 길이(16분음표). 잇단음표는 span 기준. */
export function sumScoreNotesSixteenths(notes: { duration: NoteDuration; tuplet?: TupletType; tupletSpan?: NoteDuration }[]): number {
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
