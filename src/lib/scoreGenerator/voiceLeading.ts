// ────────────────────────────────────────────────────────────────
// Voice leading analysis utilities
// ────────────────────────────────────────────────────────────────

import type { ScoreNote } from '../scoreUtils';
import { durationToSixteenths, getSixteenthsPerBar, noteToMidiWithKey, getTupletActualSixteenths } from '../scoreUtils';

// ────────────────────────────────────────────────────────────────
// ★ 최종 검토: 자동 생성 악보의 화성·성부 진행·마디 정합성 검증 및 보정
// ────────────────────────────────────────────────────────────────

/**
 * 트레블·베이스 공격점(attack) 타임라인 구축.
 * 반환: { offset: 16분음표 위치, noteIdx: 원본 배열 인덱스, midi: MIDI 값 }[]
 */
export function buildAttackTimeline(
  notes: ScoreNote[],
  keySignature: string,
): { offset: number; noteIdx: number; midi: number }[] {
  const tl: { offset: number; noteIdx: number; midi: number }[] = [];
  let off = 0;
  let i = 0;
  while (i < notes.length) {
    const n = notes[i];
    if (n.tuplet) {
      const p = parseInt(n.tuplet, 10);
      const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
      if (n.pitch !== 'rest') {
        tl.push({ offset: off, noteIdx: i, midi: noteToMidiWithKey(n, keySignature) });
      }
      off += span;
      i += p;
    } else {
      const dur = durationToSixteenths(n.duration);
      if (n.pitch !== 'rest') {
        tl.push({ offset: off, noteIdx: i, midi: noteToMidiWithKey(n, keySignature) });
      }
      off += dur;
      i += 1;
    }
  }
  return tl;
}

/**
 * 두 MIDI 값의 음정(반음 수)으로 협화/불협화 판별.
 * 협화: 유니즌(0), 단3(3), 장3(4), 완전4(5), 완전5(7),
 *       단6(8), 장6(9), 옥타브(12) 및 그 복합음정(+12, +24…)
 */
export function isConsonantInterval(semitones: number): boolean {
  const mod = ((semitones % 12) + 12) % 12;
  return [0, 3, 4, 5, 7, 8, 9].includes(mod);
}

/**
 * 병행 완전음정(5도/옥타브) 검사.
 * 연속 두 공격점에서 동일 완전음정(0,7)이 같은 방향으로 진행하면 위반.
 */
export function isParallelPerfect(
  prevTrebleMidi: number, prevBassMidi: number,
  currTrebleMidi: number, currBassMidi: number,
): boolean {
  const prevInt = ((prevTrebleMidi - prevBassMidi) % 12 + 12) % 12;
  const currInt = ((currTrebleMidi - currBassMidi) % 12 + 12) % 12;
  // 둘 다 완전 유니즌(0) 또는 완전5도(7)
  if (prevInt !== 0 && prevInt !== 7) return false;
  if (currInt !== 0 && currInt !== 7) return false;
  // 같은 방향으로 진행해야 병행
  const trebleDir = Math.sign(currTrebleMidi - prevTrebleMidi);
  const bassDir   = Math.sign(currBassMidi - prevBassMidi);
  return trebleDir !== 0 && trebleDir === bassDir;
}

/**
 * 마디별 음표 그룹으로 분할 (16분음표 단위 기준).
 */
export function splitNotesIntoMeasures(
  notes: ScoreNote[],
  sixteenthsPerBar: number,
): ScoreNote[][] {
  const measures: ScoreNote[][] = [];
  let currentMeasure: ScoreNote[] = [];
  let posInBar = 0;

  let i = 0;
  while (i < notes.length) {
    const n = notes[i];
    if (n.tuplet) {
      const p = parseInt(n.tuplet, 10);
      const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
      for (let k = 0; k < p && i + k < notes.length; k++) {
        currentMeasure.push(notes[i + k]);
      }
      posInBar += span;
      i += p;
    } else {
      const dur = durationToSixteenths(n.duration);
      currentMeasure.push(n);
      posInBar += dur;
      i += 1;
    }
    if (posInBar >= sixteenthsPerBar) {
      measures.push(currentMeasure);
      currentMeasure = [];
      posInBar = 0;
    }
  }
  if (currentMeasure.length > 0) measures.push(currentMeasure);
  return measures;
}

/**
 * ★ reviewAndFixScore — 자동 생성 악보의 최종 검토 및 보정
 *
 * 검증 항목:
 *  1. 마디 음가 합계 정합성 (각 마디의 16분음표 합이 박자와 일치)
 *  2. 병행 완전5도/옥타브 제거 (2성부)
 *  3. 수직 화성 협화도 검증 (consonanceRatio 기준)
 *  4. 선율 윤곽: 증음정(augmented 2nd = 3반음) 제거
 *  5. 마디 경계 성부 진행 매끄러움 (7반음 초과 도약 보정)
 *  6. 종지 마디 확인 (으뜸음으로 종결)
 */
