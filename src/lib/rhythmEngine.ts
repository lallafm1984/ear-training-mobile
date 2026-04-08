import { fillRhythm } from './trebleRhythmFill';
import { getSixteenthsPerBar, SIXTEENTHS_TO_DURATION, SIXTEENTHS_TO_DUR } from './scoreUtils';
import type { ScoreNote, NoteDuration } from './scoreUtils';

function uid(): string {
  return Math.random().toString(36).substr(2, 9);
}

function makeRhythmNote(dur16ths: number, isRest: boolean = false, pitch: string = 'B'): ScoreNote {
  const durStr = SIXTEENTHS_TO_DUR[dur16ths] || '4';
  return {
    id: uid(),
    pitch: isRest ? 'rest' : pitch as any,
    octave: 4,
    accidental: '',
    duration: durStr,
    tie: false,
  };
}

/**
 * Returns triplets replacing a quarter note (duration 4).
 */
function makeTriplets(pitch: string = 'B'): ScoreNote[] {
  return [
    { id: uid(), pitch: pitch as any, octave: 4, accidental: '', duration: '8', tuplet: '3', tupletSpan: '4', tupletNoteDur: 2 },
    { id: uid(), pitch: pitch as any, octave: 4, accidental: '', duration: '8', tupletNoteDur: 1 },
    { id: uid(), pitch: pitch as any, octave: 4, accidental: '', duration: '8', tupletNoteDur: 1 },
  ];
}

/**
 * Ensures the duration array contains at least one target element, or applies triplet.
 * Returns array of ScoreNotes.
 */
function generateRhythmBar(level: number, timeSignature: string, forceElement: boolean, initialWasRest: boolean = false, pitch: string = 'B'): ScoreNote[] {
  const B = getSixteenthsPerBar(timeSignature);
  let durList: number[] = [];

  while (true) {
    if (level === 1) {
      // Level 1: Half, Quarter, Quarter Rest. No whole notes, no syncopation.
      durList = fillRhythm(B, [8, 4], { timeSignature });
      break;
    } else if (level === 2) {
      // Level 2: 8th note & Rests. Pool [8, 4, 4, 2].
      durList = fillRhythm(B, [8, 4, 4, 2], { timeSignature });
      if (!forceElement) break;
      // We want to force at least one 8th note or rest. We consider 2 as 8th note.
      if (durList.includes(2)) break;
    } else if (level === 3) {
      // Level 3: Dotted notes & Syncopation.
      durList = fillRhythm(B, [6, 4, 4, 2], { timeSignature, dottedProb: 0.8, syncopationProb: 0.8 });
      if (!forceElement) break;
      if (durList.includes(6) || durList.includes(3)) break;
      if (isSyncopated(durList, timeSignature)) break;
    } else if (level === 4) {
      // Level 4: 16th notes.
      durList = fillRhythm(B, [4, 4, 2, 1, 1], { timeSignature });
      if (!forceElement) break;
      if (durList.includes(1)) break;
    } else if (level === 5) {
      // Level 5: Triplets. Base pool [6, 4, 4, 2].
      durList = fillRhythm(B, [6, 4, 4, 2], { timeSignature, dottedProb: 0.5 });
      // We will inject triplet during ScoreNote conversion. Wait, we must ensure there's a '4' or two '2's to replace.
      // Easiest is to replace a '4'. So we ensure there is at least one '4'.
      if (!forceElement) break;
      if (durList.includes(4)) break;
    } else if (level >= 6) {
      // Level 6: Mix of 2~5 (excluding very long notes like 16, 12, potentially 8 unless syncopated).
      // Pool [6, 4, 4, 2, 1].
      durList = fillRhythm(B, [6, 4, 4, 2, 1], { timeSignature, dottedProb: 0.5, syncopationProb: 0.4 });
      if (!forceElement) break;
      // Force mix: just ensure not too simple. E.g. don't allow just [4, 4, 4, 4].
      if (durList.includes(1) || durList.includes(6) || isSyncopated(durList, timeSignature)) break;
    }
  }

  // Convert to ScoreNote[]
  const notes: ScoreNote[] = [];
  const allowRestsL2Plus = level >= 2;
  // Decide if we should inject triplet for Level 5 or Level 6 Mix
  let hasInjectedTriplet = false;
  const shouldInjectTriplet = (level === 5 && forceElement) || (level >= 6 && Math.random() < 0.4);

  // 박 크기 계산 (쉼표가 박 경계를 넘지 않도록 제한하기 위함)
  const [, bottomStr] = timeSignature.split('/');
  const beatSize = 16 / (parseInt(bottomStr, 10) || 4);

  // 정박 위치에 있는 4분음표 인덱스 중 하나를 강제 4분 쉼표로 지정
  {
    let tempPos = 0;
    const eligible: number[] = [];
    for (let i = 0; i < durList.length; i++) {
      if (durList[i] === 4 && tempPos % beatSize === 0) eligible.push(i);
      tempPos += durList[i];
    }
    // 트리플렛 주입 대상(첫 번째 dur=4)은 제외
    const tripletTargetIdx = shouldInjectTriplet ? durList.indexOf(4) : -1;
    const filtered = eligible.filter(i => i !== tripletTargetIdx);
    if (filtered.length > 0) {
      const forcedIdx = filtered[Math.floor(Math.random() * filtered.length)];
      durList = durList.slice(); // 원본 보호
      // 마커로 음수 사용: -4 = 강제 4분 쉼표
      (durList as number[])[forcedIdx] = -4;
    }
  }

  let wasRest = initialWasRest;
  let pos = 0; // 마디 내 16분음표 위치 추적

  for (let i = 0; i < durList.length; i++) {
    const dur = durList[i];

    // 강제 4분 쉼표 (직전이 쉼표면 음표로 대체하여 연속 쉼표 방지)
    if (dur === -4) {
      const forceAsRest = !wasRest;
      notes.push(makeRhythmNote(4, forceAsRest, pitch));
      wasRest = forceAsRest;
      pos += 4;
      continue;
    }

    if (shouldInjectTriplet && !hasInjectedTriplet && dur === 4) {
      notes.push(...makeTriplets(pitch));
      hasInjectedTriplet = true;
      wasRest = false;
      pos += 4;
      continue;
    }

    // 쉼표가 박 경계를 넘으면 ABC 변환 시 분할되어 연속 쉼표가 됨 → 허용 안 함
    const posInBeat = pos % beatSize;
    const fitsInBeat = posInBeat === 0 || dur <= (beatSize - posInBeat);

    // Introduce rests (8분 쉼표만 확률적으로 추가)
    let isRest = false;
    if (!wasRest && fitsInBeat && allowRestsL2Plus && dur === 2) {
      if (Math.random() < 0.15) {
        isRest = true;
      }
    }

    notes.push(makeRhythmNote(dur, isRest, pitch));
    wasRest = isRest;
    pos += dur;
  }

  return notes;
}

/**
 * Basic heuristic to detect syncopation: 
 * e.g., a note starts on off-beat and extends across a beat boundary.
 */
function isSyncopated(durations: number[], timeSignature: string): boolean {
  const [, bottomStr] = timeSignature.split('/');
  const beatSize = 16 / (parseInt(bottomStr, 10) || 4);
  let pos = 0;
  for (const d of durations) {
    const noteEnd = pos + d;
    const isOffBeat = (pos % beatSize) !== 0;
    const crossesBeat = Math.floor(noteEnd / beatSize) > Math.floor(pos / beatSize);
    if (isOffBeat && crossesBeat && noteEnd % beatSize !== 0) {
      // Exception for dotted rhythms which cross beats but aren't always seen as classical syncopation context depending on definition, but for ear training rhythmic variations, it counts.
      return true;
    }
    pos += d;
  }
  return false;
}

/** duration 문자열 → 16분음표 수 역방향 맵 */
const DUR_TO_SIXTEENTHS: Record<string, number> = {
  '1.': 24, '1': 16, '2.': 12, '2': 8, '4.': 6, '4': 4, '8.': 3, '8': 2, '16': 1,
};

function noteToSixteenths(note: ScoreNote): number {
  if (note.tupletNoteDur != null) return note.tupletNoteDur;
  return DUR_TO_SIXTEENTHS[note.duration] ?? 4;
}

/**
 * 후처리: 각 마디에 쉼표가 없으면 정박 위치의 4분음표 하나를 4분 쉼표로 교체.
 * 앞뒤 쉼표가 없는 위치만 후보로 삼아 연속 쉼표를 방지한다.
 */
function ensureRestPerMeasure(notes: ScoreNote[], timeSignature: string): ScoreNote[] {
  const B = getSixteenthsPerBar(timeSignature);
  const [, bottomStr] = timeSignature.split('/');
  const beatSize = 16 / (parseInt(bottomStr, 10) || 4);

  const result = notes.slice();

  // 마디별 인덱스 범위 수집
  const measures: Array<{ start: number; end: number }> = [];
  let measureStart = 0;
  let posInMeasure = 0;
  for (let i = 0; i < result.length; i++) {
    posInMeasure += noteToSixteenths(result[i]);
    if (posInMeasure >= B) {
      measures.push({ start: measureStart, end: i + 1 });
      measureStart = i + 1;
      posInMeasure = 0;
    }
  }
  if (measureStart < result.length) {
    measures.push({ start: measureStart, end: result.length });
  }

  for (const { start, end } of measures) {
    const hasRest = result.slice(start, end).some(n => n.pitch === 'rest');
    if (hasRest) continue;

    // 후보: 정박 위치의 4분음표 중 앞뒤 음표가 쉼표가 아닌 것
    let localPos = 0;
    const candidates: number[] = [];
    for (let j = start; j < end; j++) {
      const n = result[j];
      if (
        n.pitch !== 'rest' &&
        n.tuplet == null &&
        localPos % beatSize === 0
      ) {
        const prevIsRest = j > 0 && result[j - 1].pitch === 'rest';
        const nextIsRest = j < result.length - 1 && result[j + 1].pitch === 'rest';
        if (!prevIsRest && !nextIsRest) candidates.push(j);
      }
      localPos += noteToSixteenths(n);
    }

    if (candidates.length > 0) {
      const targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
      result[targetIdx] = { ...result[targetIdx], pitch: 'rest' as any };
    }
  }

  return result;
}

/**
 * Main generator entry point for rhythm dictation tests.
 */
export function generateRhythmDictation(level: number, measures: number, timeSignature: string = '4/4', pitch: string = 'B'): ScoreNote[] {
  // We want to force the specific rhythmic element in AT LEAST two measures.
  const requiredCount = Math.min(2, measures);
  const enforcedIndices = new Set<number>();
  while (enforcedIndices.size < requiredCount) {
    enforcedIndices.add(Math.floor(Math.random() * measures));
  }

  const result: ScoreNote[] = [];
  let prevIsRest = false;
  for (let i = 0; i < measures; i++) {
    const forceElement = enforcedIndices.has(i);
    const barNotes = generateRhythmBar(level, timeSignature, forceElement, prevIsRest, pitch);
    if (barNotes.length > 0) {
      prevIsRest = barNotes[barNotes.length - 1].pitch === 'rest';
    }
    result.push(...barNotes);
  }

  return ensureRestPerMeasure(result, timeSignature);
}
