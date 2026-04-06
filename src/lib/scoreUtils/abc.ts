// ────────────────────────────────────────────────────────────────
// ABC notation generation & beat boundary splitting
// ────────────────────────────────────────────────────────────────

import type { NoteDuration, TupletType, ScoreNote, ScoreState } from './types';
import {
  durationToSixteenths, getSixteenthsPerBar, SIXTEENTHS_TO_DURATION, SIXTEENTHS_TO_DUR,
  sixteenthsToDuration, getTupletNoteDuration, getTupletActualSixteenths,
  getBeamGroupSixteenths, isCompoundMeter, getBeamBreakPoints,
  findExactDuration, sumScoreNotesSixteenths,
  computeBarLengthsFromTotal, barGlobalStarts, getBarIndexAndLocal,
} from './duration';
import { resolveAbcAccidental } from './keySignature';
import { applyEnharmonicSpelling } from './midi';

function getMandatoryBoundaries(timeSignature: string): number[] {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSignature);
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);

  if (timeSignature === '4/4' || timeSignature === 'C') {
    return [8]; // 마디 중앙만 필수
  }

  // 3/4: 3박 시작점만 필수 — 1박(홀수 박)에서 시작하는 점4분 허용, 2박+3박 합치기만 금지
  if (timeSignature === '3/4') {
    return [8];
  }

  // 2박자(2/4, 2/2 등): 필수 경계 없음 — 마디 전체를 채우는 음가 허용
  if (top === 2) {
    return [];
  }

  if (isCompoundMeter(timeSignature)) {
    const points: number[] = [];
    for (let i = 6; i < sixteenthsPerBar; i += 6) points.push(i);
    return points;
  }

  // 홑박자: 각 박 경계
  const beatSize = 16 / bottom;
  const points: number[] = [];
  for (let i = beatSize; i < sixteenthsPerBar; i += beatSize) points.push(i);
  return points;
}

export function splitAtBeatBoundaries(
  notes: ScoreNote[],
  timeSignature: string,
  pickupSixteenths = 0,
): ScoreNote[] {
  const B = getSixteenthsPerBar(timeSignature);
  const total = sumScoreNotesSixteenths(notes);
  const barLengths = computeBarLengthsFromTotal(total, B, pickupSixteenths);
  if (barLengths.length === 0) return notes;

  const mandatoryAll = getMandatoryBoundaries(timeSignature);

  // 점음표용: 모든 박 경계 (§1.2 — 점음표는 박 경계를 가리면 안 됨)
  const [, _btm] = timeSignature.split('/');
  const _beatSize = isCompoundMeter(timeSignature) ? 6 : 16 / (parseInt(_btm, 10) || 4);
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

      // 필수 경계 (모든 음표 공통)
      // 마디 전체를 채우는 음표(locStart=0, locEnd=barLen)는 면제 (3/4 점2분 등)
      if (!(locStart === 0 && locEnd === barLen)) {
        const mandInBar = mandatoryAll.filter(
          (b) => b < barLen && b > locStart && b < locEnd,
        );
        for (const b of mandInBar) {
          splitGlobals.add(barGStart + b);
        }
      }

      // 박 사이 시작: 모든 박 경계에서 분할 (§1 당김음 규칙 + §1.2 점음표)
      // 박 중간에서 시작해 다음 박으로 넘어가는 음은 붙임줄로 분할
      if (locStart % _beatSize !== 0) {
        const offBeatBounds = allBeatBounds.filter(
          (b) => b < barLen && b > locStart && b < locEnd,
        );
        for (const b of offBeatBounds) {
          splitGlobals.add(barGStart + b);
        }
      }

      // 정박 시작 점음표 분할 (§1.2 확장): 단순박자에서 한 박을 초과하는 점음표는
      // 박 경계에서 분할 — 4/4의 ♩.(6)→♩+♪, 3/4의 ♩.(6)→♩+♪ 등
      // ♩♩(half=8): 8%beatSize=0 이므로 조건 불충족 → 분할 안 됨
      if (locStart % _beatSize === 0) {
        const segLen = locEnd - locStart;
        if (segLen > _beatSize && segLen % _beatSize !== 0) {
          const onBeatDottedSplits = allBeatBounds.filter(
            (b) => b < barLen && b > locStart && b < locEnd,
          );
          for (const b of onBeatDottedSplits) {
            splitGlobals.add(barGStart + b);
          }
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

/**
 * 음높이를 ABC 표기로 변환.
 * - 대문자 = C4~B4 옥타브
 * - 소문자 = c5~b5 옥타브
 * - 콤마(,) = 옥타브 아래, 어포스트로피(') = 옥타브 위
 *
 * accidentalPrefix는 외부에서 resolveAbcAccidental로 결정하여 전달.
 */
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

/**
 * 마지막 마디 내 연속된 동일 음표를 하나로 합산.
 * splitAtBeatBoundaries가 마지막 마디의 박 경계에서 분할한 조각들을 원본 음가로 복원.
 * (붙임줄·타이로 연결된 동일 음만 합산)
 * 연속 쉼표도 길이를 합쳐 한 덩어리로 두어, ABC에 z가 잇달아 나오는 것을 막는다.
 *
 * 예) 4/4에서 점2분음표 → C8- C4 ⟹ C12 (점2분)
 */
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

  // 마지막 마디에서 연속된 동일 음 합산 (붙임줄 여부 무관)
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

    // 연속된 동일 음 탐색 (pitch + octave + accidental 일치)
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
// Intra-measure tied note merge
// ────────────────────────────────────────────────────────────────

/**
 * 마디 내 붙임줄(타이)로 연결된 동일 음을 하나의 음표로 합산.
 *
 * - 합산 후 음가가 표준 음가(SIXTEENTHS_TO_DUR)에 존재해야 함
 * - 합산 음표가 필수 박 경계(mandatory boundary)를 넘으면 병합 중단
 * - 음표 시작이 박 위(on-beat)이면 일반 박 경계를 넘어도 허용 (점음표 복원)
 * - 음표 시작이 박 사이(off-beat)이면 다음 박 경계를 넘으면 병합 중단 (엇박 보존)
 *
 * 예) 4/4에서 g4- g2 → g6 (점4분), g1- g1 → g2 (8분, 박 내 동일 위치)
 */
function mergeAdjacentTiedNotes(
  notes: ScoreNote[],
  timeSignature: string,
  pickupSixteenths = 0,
): ScoreNote[] {
  const B = getSixteenthsPerBar(timeSignature);
  const total = sumScoreNotesSixteenths(notes);
  const barLengths = computeBarLengthsFromTotal(total, B, pickupSixteenths);

  const beatSize = isCompoundMeter(timeSignature)
    ? 6
    : 16 / (parseInt(timeSignature.split('/')[1] ?? '4', 10) || 4);
  const mandatoryBounds = getMandatoryBoundaries(timeSignature);
  const allBeatBoundsInBar: number[] = [];
  for (let b = beatSize; b < B; b += beatSize) allBeatBoundsInBar.push(b);

  const result: ScoreNote[] = [];
  let globalPos = 0;
  let tupletRemaining = 0;
  let tupletSpanSixteenths = 0;
  let i = 0;

  while (i < notes.length) {
    const note = notes[i];

    if (note.tuplet && tupletRemaining === 0) {
      tupletRemaining = parseInt(note.tuplet, 10);
      tupletSpanSixteenths = getTupletActualSixteenths(note.tuplet, note.tupletSpan || note.duration);
    }
    if (tupletRemaining > 0) {
      result.push(note);
      tupletRemaining--;
      if (tupletRemaining === 0) globalPos += tupletSpanSixteenths;
      i++;
      continue;
    }

    const dur = durationToSixteenths(note.duration);

    // 붙임줄이 있고 쉼표가 아닐 때만 합산 시도
    if (note.tie && note.pitch !== 'rest' && i + 1 < notes.length) {
      const { bi, local: localPos } = getBarIndexAndLocal(globalPos, barLengths);
      const barLen = barLengths[bi] ?? B;
      const offBeat = localPos % beatSize !== 0;

      let accDur = dur;
      let lastTie: boolean = note.tie;
      let j = i + 1;

      while (j < notes.length && lastTie) {
        const next = notes[j];
        if (
          next.tuplet ||
          next.pitch !== note.pitch ||
          next.octave !== note.octave ||
          next.accidental !== note.accidental
        ) break;

        const nextDur = durationToSixteenths(next.duration);
        const totalDur = accDur + nextDur;
        const candidateDur = SIXTEENTHS_TO_DUR[totalDur];
        // 점음표로 합산되면 박자 위치가 불명확해져 귀 훈련에 불리 → 병합 중단
        if (!candidateDur || candidateDur.endsWith('.')) break;

        const mergeEnd = localPos + totalDur;
        if (mergeEnd > barLen) break;
        if (mandatoryBounds.some(mb => localPos < mb && mergeEnd > mb)) break;
        // 엇박 시작: 다음 박 경계를 넘으면 싱코페이션 → 병합 중단
        if (offBeat && allBeatBoundsInBar.some(bb => localPos < bb && mergeEnd > bb)) break;

        accDur = totalDur;
        lastTie = next.tie ?? false;
        j++;
      }

      if (j > i + 1) {
        result.push({ ...note, duration: SIXTEENTHS_TO_DUR[accDur], tie: lastTie });
        globalPos += accDur;
        i = j;
        continue;
      }
    }

    result.push(note);
    globalPos += dur;
    i++;
  }

  return result;
}

// ────────────────────────────────────────────────────────────────
// Rest decomposition
// ────────────────────────────────────────────────────────────────

/**
 * 쉼표 ABC 문자열 배열을 생성. 점쉼표 금지 규칙 적용.
 *
 * - 온마디 쉼표(barPosition=0, dur=bar): ['Z']
 * - 홑박자: 점쉼표 금지, 박 경계에서 분리 (사용 단위: 16,8,4,2,1)
 * - 겹박자: 점4분쉼표 허용, 점8분쉼표 금지 (사용 단위: 12,6,2,1) (§4)
 */
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
    // 겹박자: 점4분쉼표(6)만 허용, 점8분쉼표(3) 금지 → 8분+16분으로 분할 (§4)
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
    // 홑박자: 점쉼표 금지, 박 경계 넘지 않도록 분리
    const [, bottomStr] = timeSignature.split('/');
    const bottom = parseInt(bottomStr, 10) || 4;
    const beatSize = 16 / bottom;
    const units = [16, 8, 4, 2, 1]; // 점음표 제외

    while (remaining > 0) {
      const posInBeat = pos % beatSize;
      let fitted = false;
      for (const u of units) {
        if (u > remaining) continue;
        // 박 경계에 있으면 어느 크기든 OK (음표는 모두 2^n)
        // 박 중간이면 현재 박 안에 들어맞아야 함
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

/**
 * ScoreNote 배열을 ABC 문자열로 변환.
 *
 * 파이프라인:
 * 1. 박 가시성 규칙 적용 (splitAtBeatBoundaries)
 * 1.5. 엇박 아닌 붙임줄 합산 (mergeAdjacentTiedNotes)
 * 2. 임시표 자동 적용 (resolveAbcAccidental — 마디 내 상태 추적)
 * 3. beam 그룹 결정 (공백 배치)
 * 4. 온마디 쉼표 처리 (Z)
 */
function generateNotesAbc(
  notes: ScoreNote[],
  timeSignature: string,
  keySignature: string = 'C',
  pickupSixteenths = 0,
  disableTies = false,
): string {
  if (notes.length === 0) return '|]';

  // 0단계: 이명동음 선택
  const spelledNotes = applyEnharmonicSpelling(notes, keySignature);

  // 1단계: 박 가시성 규칙 — 필수 경계에서 음표 분할
  // disableTies(중급 2단계 미만)이면 분할 없이 그대로 사용
  const splitNotes = disableTies
    ? spelledNotes
    : splitAtBeatBoundaries(spelledNotes, timeSignature, pickupSixteenths);

  // 1.5단계: 엇박 아닌 붙임줄 합산 — 점음표 복원, 박 내 동일 음 병합 (엇박 타이 보존)
  const mergedAdjacentNotes = mergeAdjacentTiedNotes(splitNotes, timeSignature, pickupSixteenths);

  // 2단계: 마지막 마디 붙임줄 음표 합산 (박 분할 조각 → 원본 음가 복원)
  const mergedNotes = mergeTiedNotesInLastMeasure(mergedAdjacentNotes, timeSignature, pickupSixteenths);

  // 3단계: 끊어진 붙임줄 정리 — tie 뒤에 쉼표·다른 음이 오면 tie 제거
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
  const beamGroupSize = getBeamGroupSixteenths(timeSignature);
  let currentBarSixteenths = 0;
  let abcNotes = '';
  let tupletRemaining = 0;
  let currentTupletNoteDur = 0;
  let currentTupletSpanSixteenths = 0;

  // 임시표 상태 추적 (마디 단위 리셋)
  let measureAccState = new Map<string, string>();

  // 마디 내 음표들을 모아서 온마디 쉼표 판별
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
      // 잇단음표는 인접 음표와 beam 분리 (표준 조판 규칙)
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

    // 쉼표: generateRestAbc로 분해 출력 (잇단음표 내부 쉼표는 일반 처리)
    if (note.pitch === 'rest' && tupletRemaining === 0) {
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

    // 임시표 결정
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

    measureAbcBuffer += abcPitch + durStr;
    if (note.tie) measureAbcBuffer += '-';

    // 마디 버퍼에 추가
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
        // 잇단음표 내부: beam 연결 유지 (공백 없음)
      } else {
        measureAbcBuffer += ' ';
      }
    } else {
      currentBarSixteenths += dur16ths;

      // beam 그룹 경계 판별 (향상된 로직)
      const isBeamable = dur16ths <= 3; // 8분음표 이하만 beam 가능
      const isAtBeamBreak = beamBreaks.some(bp => currentBarSixteenths === bp);
      const isAtBeatBoundary = currentBarSixteenths % beamGroupSize === 0;
      const atBarEnd = currentBarSixteenths >= currentBarCap();

      if (!isBeamable || isAtBeamBreak || isAtBeatBoundary || atBarEnd) {
        measureAbcBuffer += ' ';
      }
    }

    // 마디 끝 처리
    if (currentBarSixteenths >= currentBarCap()) {
      flushMeasure();
      abcNotes += '| ';
      currentBarSixteenths = 0;
      measureAccState = new Map();
      barIdx++;
    }
  });

  // 마지막 마디 flush
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

/**
 * Returns the number of measures in the score (based on treble part).
 */
export function getMeasureCount(state: ScoreState): number {
  const body = generateNotesAbc(
    state.notes,
    state.timeSignature,
    state.keySignature,
    state.pickupSixteenths ?? 0,
  );
  return (body.match(/\|/g) || []).length;
}

/**
 * ABC format uses specific ASCII characters to represent notes.
 * L:1/16 is used as the base length.
 *
 * 파이프라인:
 * 1. 헤더 생성 (X:, T:, M:, L:, Q:, K:)
 * 2. 보표 구성 (%%staves, %%barsperstaff)
 * 3. Voice별 ABC 생성 (임시표, 박 가시성, beam 그룹 모두 적용)
 */
/** 못갖춘마디 보상: 약동 상쇄(total가 한 마디의 정수배)일 때 마지막 마디가 (bar - pickup)가 되도록 쉼표 추가 */
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

/** ABC 본문의 마디 수를 구한다 (| 개수) */
function countMeasures(abcBody: string): number {
  return (abcBody.match(/\|/g) || []).length;
}

/**
 * ABC 본문에 전마디 쉼표(Z)를 추가하여 목표 마디 수에 맞춘다.
 * 큰보표에서 두 보표의 마디 수를 일치시키는 데 사용.
 */
function padWithFullRests(abcBody: string, targetMeasures: number): string {
  const current = countMeasures(abcBody);
  if (current >= targetMeasures) return abcBody;
  const diff = targetMeasures - current;
  // '|]' 앞에 부족한 마디만큼 전마디 쉼표 삽입
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
    state.disableTies ?? false,
  );
  const measureCount = countMeasures(trebleBody);

  const directives: string[] = [];
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
    state.disableTies ?? false,
  );

  // 큰보표: 두 보표의 마디 수를 일치시켜 정렬 보장
  if (useGrandStaff) {
    const trebleMeasures = countMeasures(trebleBody);
    const bassMeasures = countMeasures(bassBody);
    if (trebleMeasures > bassMeasures) {
      bassBody = padWithFullRests(bassBody, trebleMeasures);
    } else if (bassMeasures > trebleMeasures) {
      trebleBody = padWithFullRests(trebleBody, bassMeasures);
    }
  }

  // ── 마디 단위로 쪼개기 ──
  const extractMeasures = (body: string) => {
    let cleanBody = body.trim();
    let endsWithEndBar = false;
    if (cleanBody.endsWith('|]')) {
      cleanBody = cleanBody.slice(0, -2) + '|';
      endsWithEndBar = true;
    }
    const arr = cleanBody.split('|').map(m => m.trim()).filter(m => m.length > 0);
    return { arr, endsWithEndBar };
  };

  const tData = extractMeasures(trebleBody);
  const tArr = tData.arr;
  const bData = useGrandStaff ? extractMeasures(bassBody) : { arr: [], endsWithEndBar: false };
  const bArr = bData.arr;
  const numM = tArr.length;

  let finalAbc = header;

  const bps = state.barsPerStaff;
  let mIdx = 0;
  while (mIdx < numM) {
    const remain = numM - mIdx;
    let take: number;

    if (bps !== undefined && bps > 0) {
      take = Math.min(bps, remain);
    } else {
      take = Math.min(2, remain);

      // ── 동적 개행(Word Wrap) 로직 ──
      // 남은 마디가 3개 이상이면 밀도를 검사하여 3마디 또는 4마디를 한 줄에 표시할 수 있는지 판단
      if (remain >= 3) {
        // 알파벳(음표)과 쉼표(Z, z) 문자의 개수를 세어 밀도를 대략 측정
        const countNotes = (ms: string[]) => ms.join('').replace(/[^a-gA-GzZ]/g, '').length;

        let bestTake = 2; // 기본 2마디
        for (let cand = 4; cand >= 3; cand--) {
          if (remain >= cand) {
            const notesT = countNotes(tArr.slice(mIdx, mIdx + cand));
            const notesB = useGrandStaff ? countNotes(bArr.slice(mIdx, mIdx + cand)) : 0;
            const maxNotes = Math.max(notesT, notesB);

            // 4마디 허용치 = 최대 22개, 3마디 허용치 = 최대 16개 (너무 촘촘해지지 않도록 조절)
            const threshold = cand === 4 ? 22 : 16;
            if (maxNotes <= threshold) {
              bestTake = cand;
              break;
            }
          }
        }
        take = bestTake;
      }
    }

    if (useGrandStaff) {
      finalAbc += '\nV:V1 clef=treble\n';
      finalAbc += tArr.slice(mIdx, mIdx + take).join(' | ') + ((mIdx + take === numM && tData.endsWithEndBar) ? ' |]' : ' |');
      finalAbc += '\nV:V2 clef=bass\n';
      finalAbc += bArr.slice(mIdx, mIdx + take).join(' | ') + ((mIdx + take === numM && bData.endsWithEndBar) ? ' |]' : ' |');
    } else {
      finalAbc += '\n';
      finalAbc += tArr.slice(mIdx, mIdx + take).join(' | ') + ((mIdx + take === numM && tData.endsWithEndBar) ? ' |]' : ' |');
    }

    mIdx += take;
  }

  return finalAbc;
}
