import { fillRhythm } from './trebleRhythmFill';
import { getSixteenthsPerBar, SIXTEENTHS_TO_DUR } from './scoreUtils';
import type { ScoreNote, PitchName } from './scoreUtils';

function uid(): string {
  return Math.random().toString(36).substr(2, 9);
}

function makeRhythmNote(
  dur16ths: number,
  isRest: boolean = false,
  pitch: PitchName = 'B',
): ScoreNote {
  const durStr = SIXTEENTHS_TO_DUR[dur16ths] || '4';
  return {
    id: uid(),
    pitch: isRest ? 'rest' : pitch,
    octave: 4,
    accidental: '',
    duration: durStr,
    tie: false,
  };
}

/**
 * Returns triplets replacing a quarter note (duration 4).
 */
function makeTriplets(pitch: PitchName = 'B'): ScoreNote[] {
  return [
    {
      id: uid(),
      pitch,
      octave: 4,
      accidental: '',
      duration: '8',
      tuplet: '3',
      tupletSpan: '4',
      tupletNoteDur: 2,
    },
    { id: uid(), pitch, octave: 4, accidental: '', duration: '8', tupletNoteDur: 1 },
    { id: uid(), pitch, octave: 4, accidental: '', duration: '8', tupletNoteDur: 1 },
  ];
}

/**
 * 둘잇단음표(duplet): 복합박자(6/8·9/8·12/8)에서 한 박(점4분, 6)을 둘로 나눈다.
 * 복합박자의 박은 이미 셋(8분×3)으로 나뉘므로, 단순박자의 셋잇단에 대응하는 관용 표기는
 * "박을 둘로 나누는" 둘잇단이다. tupletNoteDur: [2, 4] — 합계 6(점4분 span), 첫 음 2 = 8분음표 표기.
 */
function makeDuplets(pitch: PitchName = 'B'): ScoreNote[] {
  return [
    {
      id: uid(),
      pitch,
      octave: 4,
      accidental: '',
      duration: '8',
      tuplet: '2',
      tupletSpan: '4.',
      tupletNoteDur: 2,
    },
    { id: uid(), pitch, octave: 4, accidental: '', duration: '8', tupletNoteDur: 4 },
  ];
}

/** 복합박자(6/8, 9/8, 12/8) 판별 */
function isCompound(timeSignature: string): boolean {
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);
  return bottom === 8 && top % 3 === 0 && top >= 6;
}

/** 박 크기(16분음표 수): 단순박자 = 분모 기준, 복합박자 = 점4분(6) */
function beatSixteenths(timeSignature: string): number {
  if (isCompound(timeSignature)) return 6;
  const [, bottomStr] = timeSignature.split('/');
  return 16 / (parseInt(bottomStr, 10) || 4);
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 레벨·박자별 음가 풀 (16분음표 단위). 복합박자는 점4분(6)을 박으로 쓰는 전용 풀. */
function durationPoolFor(level: number, compound: boolean): number[] {
  if (compound) {
    if (level === 1) return [6, 4, 2]; // 점4분·4분·8분 (8분이 기본 단위)
    if (level === 2) return [6, 4, 2, 2];
    if (level === 3) return [6, 4, 2, 2, 3, 1]; // 점8분+16분이 복합박자의 점음표 요소
    if (level === 4) return [6, 4, 2, 1, 1];
    if (level === 5) return [6, 4, 2, 2]; // 박머리 점4분(6) → 둘잇단 주입 대상 (복합박자의 셋잇단 대응)
    return [6, 4, 2, 3, 1, 1];
  }
  if (level === 1) return [8, 4, 4]; // 2분·4분 (4분 비중 ↑ — 2분음표만 이어지는 마디 완화)
  if (level === 2) return [8, 4, 4, 2]; // + 8분
  if (level === 3) return [6, 4, 4, 2]; // + 점4분·당김음
  if (level === 4) return [4, 4, 2, 1, 1]; // + 16분
  if (level === 5) return [6, 4, 4, 2]; // + 셋잇단 (변환 시 4분 → 셋잇단 주입)
  return [6, 4, 4, 2, 1]; // 종합
}

/**
 * 잇단음표로 바꿀 음표 인덱스. 단순박자: 첫 4분음표(→셋잇단). 복합박자: 박머리의 첫 점4분(→둘잇단).
 * 없으면 -1.
 */
function findTupletTargetIdx(durList: number[], compound: boolean): number {
  if (!compound) return durList.indexOf(4);
  let pos = 0;
  for (let i = 0; i < durList.length; i++) {
    if (durList[i] === 6 && pos % 6 === 0) return i;
    pos += durList[i];
  }
  return -1;
}

/** 이 마디가 레벨 고유 요소를 포함하는지 */
function hasLevelElement(
  level: number,
  durList: number[],
  timeSignature: string,
  compound: boolean,
): boolean {
  if (level === 1) return true;
  if (level === 2) return durList.includes(2);
  if (level === 3) {
    if (compound) return durList.includes(3);
    return durList.includes(6) || durList.includes(3) || isSyncopated(durList, timeSignature);
  }
  if (level === 4) return durList.includes(1);
  if (level === 5) {
    // 잇단음표 주입 대상: 단순박자 4분(→셋잇단) / 복합박자 박머리 점4분(→둘잇단)
    return findTupletTargetIdx(durList, compound) >= 0;
  }
  // 종합: 너무 단순한 마디([4,4,4,4] 등) 방지
  return (
    durList.includes(1) ||
    durList.includes(3) ||
    (!compound && durList.includes(6)) ||
    isSyncopated(durList, timeSignature)
  );
}

interface BarGenOptions {
  /** 곡 전체에서의 마디 인덱스 (0 = 첫 마디: 첫 박 쉼표 금지) */
  barIndex: number;
  /** 이 마디에 박 단위 쉼표(4분/점4분 쉼표)를 넣을지 */
  wantBeatRest: boolean;
}

/**
 * 한 마디 리듬 생성. forceElement면 레벨 고유 요소가 포함될 때까지 재시도.
 * 쉼표 규칙(청음 시험 기준):
 *  - 첫 마디 첫 박에는 쉼표를 두지 않는다 (리듬 받아쓰기는 음표로 시작)
 *  - 쉼표는 4분(복합박자: 점4분·4분)·8분 쉼표만 사용 — 점4분 쉼표(단순박자)·2분 쉼표 금지
 *  - 연속 쉼표 금지
 */
function generateRhythmBar(
  level: number,
  timeSignature: string,
  forceElement: boolean,
  initialWasRest: boolean,
  pitch: PitchName,
  barOpts: BarGenOptions,
): ScoreNote[] {
  const B = getSixteenthsPerBar(timeSignature);
  const compound = isCompound(timeSignature);
  const pool = durationPoolFor(level, compound);
  const fillOpts =
    level === 3
      ? { timeSignature, dottedProb: 0.8, syncopationProb: compound ? 0 : 0.8 }
      : level === 5
        ? { timeSignature, dottedProb: 0.5 }
        : level >= 6
          ? { timeSignature, dottedProb: 0.5, syncopationProb: compound ? 0 : 0.4 }
          : { timeSignature };

  let durList: number[] = fillRhythm(B, pool, fillOpts);
  if (forceElement) {
    for (let retry = 0; retry < 40; retry++) {
      if (hasLevelElement(level, durList, timeSignature, compound)) break;
      durList = fillRhythm(B, pool, fillOpts);
    }
  }

  // Convert to ScoreNote[]
  const notes: ScoreNote[] = [];
  const allowRestsL2Plus = level >= 2;
  // 잇단음표 주입: L5(강제 마디) / L6+(40%)
  //  - 단순박자: 4분음표 → 셋잇단(8분×3)
  //  - 복합박자: 박머리 점4분 → 둘잇단(8분×2). 복합박자의 박은 이미 셋으로 나뉘므로
  //    셋잇단이 아니라 "박을 둘로 나누는" 둘잇단이 관용 표기다.
  let hasInjectedTuplet = false;
  const shouldInjectTuplet = (level === 5 && forceElement) || (level >= 6 && Math.random() < 0.4);
  const tupletTargetIdx = shouldInjectTuplet ? findTupletTargetIdx(durList, compound) : -1;

  const beatSize = beatSixteenths(timeSignature);

  // 박 단위 쉼표 위치 결정 (wantBeatRest일 때 1개)
  let forcedRestIdx = -1;
  if (barOpts.wantBeatRest) {
    let tempPos = 0;
    const eligible: { i: number; pos: number }[] = [];
    for (let i = 0; i < durList.length; i++) {
      const d = durList[i];
      const onBeat = tempPos % beatSize === 0;
      // 후보: 박머리의 4분(단순) / 점4분·4분(복합), 복합박자 8분 위치의 4분, 어디든 8분
      const ok = (d === 4 && (onBeat || compound)) || (compound && d === 6 && onBeat) || d === 2;
      const firstDownbeat = barOpts.barIndex === 0 && tempPos === 0;
      if (ok && !firstDownbeat && i !== tupletTargetIdx) eligible.push({ i, pos: tempPos });
      tempPos += d;
    }
    let candidates = eligible;
    // 마디 첫 박 쉼표는 드물게(30%)만 허용
    if (candidates.some((e) => e.pos !== 0) && Math.random() >= 0.3) {
      candidates = candidates.filter((e) => e.pos !== 0);
    }
    // 4분(이상) 쉼표 우선(70%), 나머지는 8분 쉼표
    const beatPool = candidates.filter((e) => durList[e.i] >= 4);
    const pick =
      beatPool.length > 0 && Math.random() < 0.7
        ? rand(beatPool)
        : candidates.length > 0
          ? rand(candidates)
          : undefined;
    if (pick) forcedRestIdx = pick.i;
  }

  let wasRest = initialWasRest;
  let pos = 0; // 마디 내 16분음표 위치 추적

  for (let i = 0; i < durList.length; i++) {
    const dur = durList[i];

    // 박 단위 쉼표 (직전이 쉼표면 음표로 대체하여 연속 쉼표 방지)
    if (i === forcedRestIdx) {
      const asRest = !wasRest;
      notes.push(makeRhythmNote(dur, asRest, pitch));
      wasRest = asRest;
      pos += dur;
      continue;
    }

    if (i === tupletTargetIdx && !hasInjectedTuplet) {
      notes.push(...(compound ? makeDuplets(pitch) : makeTriplets(pitch)));
      hasInjectedTuplet = true;
      wasRest = false;
      pos += dur;
      continue;
    }

    // 쉼표가 박 경계를 넘으면 ABC 변환 시 분할되어 연속 쉼표가 됨 → 허용 안 함
    const simpleBeat = 16 / (parseInt(timeSignature.split('/')[1], 10) || 4);
    const posInBeat = pos % simpleBeat;
    const fitsInBeat = posInBeat === 0 || dur <= simpleBeat - posInBeat;
    const firstDownbeat = barOpts.barIndex === 0 && pos === 0;

    // 8분 쉼표 확률 삽입 (L2+, 첫 마디 첫 박 제외)
    let isRest = false;
    if (!wasRest && fitsInBeat && allowRestsL2Plus && dur === 2 && !firstDownbeat) {
      if (Math.random() < 0.12) {
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
  const beatSize = beatSixteenths(timeSignature);
  let pos = 0;
  for (const d of durations) {
    const noteEnd = pos + d;
    const isOffBeat = pos % beatSize !== 0;
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
  '1.': 24,
  '1': 16,
  '2.': 12,
  '2': 8,
  '4.': 6,
  '4': 4,
  '8.': 3,
  '8': 2,
  '16': 1,
};

function noteToSixteenths(note: ScoreNote): number {
  if (note.tupletNoteDur != null) return note.tupletNoteDur;
  return DUR_TO_SIXTEENTHS[note.duration] ?? 4;
}

/**
 * 후처리: 곡 전체에 쉼표가 하나도 없으면 음표 하나를 쉼표로 교체.
 * 후보는 박머리의 4분음표(복합박자는 점4분 포함) 또는 8분음표. 첫 음표·셋잇단·앞뒤 쉼표 인접은 제외.
 * (예전에는 "마디마다 쉼표"를 강제해 점4분·2분까지 쉼표로 바꿨다 → 점4분 쉼표·과다 쉼표 문제)
 */
function ensureMinRests(notes: ScoreNote[], timeSignature: string): ScoreNote[] {
  if (notes.some((n) => n.pitch === 'rest')) return notes;
  const result = notes.slice();
  const B = getSixteenthsPerBar(timeSignature);
  const compound = isCompound(timeSignature);
  const beatSize = beatSixteenths(timeSignature);

  let pos = 0;
  const candidates: number[] = [];
  for (let j = 0; j < result.length; j++) {
    const n = result[j];
    const d = noteToSixteenths(n);
    const localPos = pos % B;
    const onBeat = localPos % beatSize === 0;
    const ok =
      j > 0 &&
      n.pitch !== 'rest' &&
      n.tuplet == null &&
      n.tupletNoteDur == null &&
      (d === 2 || (d === 4 && (onBeat || compound)) || (compound && d === 6 && onBeat));
    if (ok) candidates.push(j);
    pos += d;
  }

  if (candidates.length > 0) {
    const beatCands = candidates.filter((j) => noteToSixteenths(result[j]) >= 4);
    const targetIdx = beatCands.length > 0 ? rand(beatCands) : rand(candidates);
    result[targetIdx] = { ...result[targetIdx], pitch: 'rest' };
  }

  return result;
}

/**
 * Main generator entry point for rhythm dictation tests.
 */
export function generateRhythmDictation(
  level: number,
  measures: number,
  timeSignature: string = '4/4',
  pitch: PitchName = 'B',
): ScoreNote[] {
  // We want to force the specific rhythmic element in AT LEAST two measures.
  const requiredCount = Math.min(2, measures);
  const enforcedIndices = new Set<number>();
  while (enforcedIndices.size < requiredCount) {
    enforcedIndices.add(Math.floor(Math.random() * measures));
  }

  // 쉼표 마디: 전체의 약 절반(최소 1마디). 예전처럼 마디마다 쉼표를 강제하지 않는다.
  const restBarCount = Math.max(1, Math.round(measures * 0.5));
  const restBars = new Set<number>();
  while (restBars.size < restBarCount) {
    restBars.add(Math.floor(Math.random() * measures));
  }

  const result: ScoreNote[] = [];
  let prevIsRest = false;
  for (let i = 0; i < measures; i++) {
    const forceElement = enforcedIndices.has(i);
    const barNotes = generateRhythmBar(level, timeSignature, forceElement, prevIsRest, pitch, {
      barIndex: i,
      wantBeatRest: restBars.has(i),
    });
    if (barNotes.length > 0) {
      prevIsRest = barNotes[barNotes.length - 1].pitch === 'rest';
    }
    result.push(...barNotes);
  }

  return ensureMinRests(result, timeSignature);
}
