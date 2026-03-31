// ────────────────────────────────────────────────────────────────
// Two-Voice Bass Generator — L1/L2/L3 (temp/ear_training_bass_prompt_v4.md)
// ────────────────────────────────────────────────────────────────

import type { BassLevel, BassNote, BassPatternDef, TwoVoiceBassOptions } from './types';
import { getScaleInfo, BASS_DURATION_MAP, MEASURE_TOTAL, BASS_RANGE } from './scales';
import { getPatternById, selectRandomPattern } from './bassPatterns';
import {
  generateProgression,
  CHORD_TONES,
  nnToMidi,
  getMidiInterval,
  getScaleDegrees,
  getBassBaseOctave,
  PitchName,
} from '../scoreUtils';

// ────────────────────────────────────────────────────────────────
// Internal context passed through generation functions
// ────────────────────────────────────────────────────────────────

interface BassGenContext {
  scale: PitchName[];
  baseOctave: number;
  keySignature: string;
}

function buildContext(key: string, mode: 'major' | 'harmonic_minor'): BassGenContext {
  const keySignature = mode === 'harmonic_minor'
    ? (key.endsWith('m') ? key : key + 'm')
    : key;
  const scale = getScaleDegrees(keySignature);
  const baseOctave = getBassBaseOctave(scale);
  return { scale, baseOctave, keySignature };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function noteNumToMidi(noteNum: number, ctx: BassGenContext): number {
  return nnToMidi(noteNum, ctx.scale, ctx.baseOctave, ctx.keySignature);
}

function getSemitoneInterval(from: number, to: number, ctx: BassGenContext): number {
  return getMidiInterval(from, to, ctx.scale, ctx.baseOctave, ctx.keySignature);
}

function isInRange(noteNum: number, level: BassLevel, ctx: BassGenContext): boolean {
  const midi = noteNumToMidi(noteNum, ctx);
  const range = BASS_RANGE[level];
  return midi >= range.low && midi <= range.high;
}

function clampToRange(noteNum: number, level: BassLevel, ctx: BassGenContext): number {
  if (isInRange(noteNum, level, ctx)) return noteNum;
  // 옥타브 단위 시프트 시도
  for (const shift of [-7, 7, -14, 14]) {
    if (isInRange(noteNum + shift, level, ctx)) return noteNum + shift;
  }
  // 옥타브 시프트 실패 시 가장 가까운 범위 내 nn 탐색
  for (let d = 1; d <= 14; d++) {
    if (isInRange(noteNum - d, level, ctx)) return noteNum - d;
    if (isInRange(noteNum + d, level, ctx)) return noteNum + d;
  }
  return noteNum;
}

function getScaleInterval(from: number, to: number): number {
  return Math.abs(to - from);
}

/**
 * 베이스 선율 도약 규칙: 3도 이내(음계도 차이 1~2)가 기본, 도약 시에는 4도(차이 3)만.
 * 즉 인접 음 nn 차이는 최대 3(5도·옥타브 등 금지).
 */
const MAX_BASS_SCALE_STEP = 3;

/**
 * Forbidden leap for Level 3 (and sanity for all levels).
 * Span cap: MAX_BASS_SCALE_STEP; also 7th/9th+, tritone, aug5 when applicable.
 */
function isForbiddenLeap(fromNN: number, toNN: number, ctx: BassGenContext): boolean {
  const interval = Math.abs(toNN - fromNN);
  if (interval <= 1) return false;
  if (interval > MAX_BASS_SCALE_STEP) return true;

  const semitones = getSemitoneInterval(fromNN, toNN, ctx);
  if (semitones === 6) return true;  // tritone
  if (semitones === 8) return true;  // augmented 5th
  return false;
}

/**
 * Augmented 2nd check (harmonic minor: degree 5 -> degree 6 ascending).
 * Uses scale degree indices directly since nnToMidi uses natural minor
 * and can't detect the raised 7th.
 */
/** 현재 마디 코드 근음(구조도)에 가장 가까운 허용 nn (옥타브 시프트) */
function nearestChordRootNn(rootDeg: number, nearNN: number, ctx: BassGenContext): number {
  let best = rootDeg;
  let bestDist = Infinity;
  for (const off of [-21, -14, -7, 0, 7, 14, 21]) {
    const nn = rootDeg + off;
    if (!isInRange(nn, 2, ctx)) continue;
    const d = Math.abs(nn - nearNN);
    if (d < bestDist) {
      bestDist = d;
      best = nn;
    }
  }
  return clampToRange(best, 2, ctx);
}

function isAugmentedSecond(fromNN: number, toNN: number, _ctx: BassGenContext): boolean {
  const degFrom = ((fromNN % 7) + 7) % 7;
  const degTo = ((toNN % 7) + 7) % 7;
  // Ascending: degree 5 -> degree 6 (6th -> raised 7th in harmonic minor)
  if (degFrom === 5 && degTo === 6 && toNN > fromNN) return true;
  // Descending: degree 6 -> degree 5 (raised 7th -> 6th)
  if (degFrom === 6 && degTo === 5 && toNN < fromNN) return true;
  return false;
}

/**
 * 증2도 회피: 같은 방향으로 2도 건너뛰거나, 반대 방향으로 1도 이동.
 * prevNN에 머무는(같은음 반복) 대신 항상 이동을 보장한다.
 */
function resolveAugSecond(
  prevNN: number, currentNN: number, level: BassLevel, ctx: BassGenContext,
): number {
  const dir = currentNN > prevNN ? 1 : -1;
  // Option 1: 같은 방향 2도 건너뛰기 (예: deg5→deg0′, deg6→deg4)
  const skipNN = prevNN + dir * 2;
  if (isInRange(skipNN, level, ctx) && !isAugmentedSecond(prevNN, skipNN, ctx)) {
    return skipNN;
  }
  // Option 2: 반대 방향 1도
  const revNN = prevNN - dir;
  if (isInRange(revNN, level, ctx)) {
    return revNN;
  }
  // Option 3: 같은 방향 3도 (4도 도약)
  const skip3 = prevNN + dir * 3;
  if (isInRange(skip3, level, ctx) && !isForbiddenLeap(prevNN, skip3, ctx)) {
    return skip3;
  }
  return prevNN;
}

// ────────────────────────────────────────────────────────────────
// Half cadence helpers (반종지)
// ────────────────────────────────────────────────────────────────

/** 반종지 마디 인덱스: 4마디 프레이즈 경계마다 V (마지막 마디 제외) */
function getHalfCadenceBars(measures: number): number[] {
  if (measures < 8) return [];
  const bars: number[] = [];
  for (let i = 3; i < measures - 1; i += 4) {
    bars.push(i);
  }
  return bars;
}

/** 가장 가까운 딸림음(V, 음계도 4) 찾기 */
function nearestDominant(from: number, level: BassLevel, ctx: BassGenContext): number {
  const candidates = [-10, -3, 4, 11, 18];
  let best = 4;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (isInRange(c, level, ctx)) {
      const d = Math.abs(from - c);
      if (d < bestDist) { bestDist = d; best = c; }
    }
  }
  return best;
}

// ────────────────────────────────────────────────────────────────
// Harmonic structure generation
// ────────────────────────────────────────────────────────────────

function generateBassStructure(measures: 4 | 8 | 12 | 16, isMinor: boolean): number[] {
  return generateProgression(measures, isMinor);
}

/** I / IV / V 근음 (0 / 3 / 4) — ear_training_bass_prompt_v4.md L1 “60% 이상” */
function isPrimaryBassRootDegree(noteNum: number): boolean {
  const d = ((noteNum % 7) + 7) % 7;
  return d === 0 || d === 3 || d === 4;
}

/**
 * Adjust interior bars so at least 60% of measures use I/IV/V roots,
 * without breaking L1 max-leap (5th) between adjacent bars.
 */
/**
 * 인접 마디 |Δ|≤3. `upTo` = 마지막으로 수정할 인덱스(포함).
 */
function fixL1AdjacentSpansUpTo(
  notes: BassNote[],
  ctx: BassGenContext,
  upTo: number,
): void {
  const maxPass = notes.length + 2;
  for (let pass = 0; pass < maxPass; pass++) {
    let changed = false;
    for (let i = 1; i <= upTo && i < notes.length; i++) {
      const prev = notes[i - 1].noteNum;
      let nn = notes[i].noteNum;
      if (getScaleInterval(prev, nn) <= MAX_BASS_SCALE_STEP) continue;
      const sign = nn > prev ? 1 : -1;
      let best = prev + sign * MAX_BASS_SCALE_STEP;
      if (!isInRange(best, 1, ctx)) best = prev - sign * MAX_BASS_SCALE_STEP;
      if (!isInRange(best, 1, ctx)) best = clampToRange(nn, 1, ctx);
      notes[i].noteNum = best;
      changed = true;
    }
    if (!changed) break;
  }
}

/**
 * 마지막 마디 으뜸음과 직전 마디 사이 |Δ|≤3 이 되도록 직전 근음을 조정.
 * (항상 noteNum=0만 쓰면 이전 마디가 높은 옥타브일 때 5도 이상 벌어질 수 있음)
 */
function fixL1CadenceLeap(
  notes: BassNote[],
  ctx: BassGenContext,
): void {
  if (notes.length < 2) return;
  const li = notes.length - 1;
  const pi = li - 1;
  const prevBeforePen = pi > 0 ? notes[pi - 1].noteNum : notes[pi].noteNum;

  const tonicCandidates: number[] = [];
  for (let k = -4; k <= 4; k++) {
    const t = k * 7;
    if (!isInRange(t, 1, ctx)) continue;
    if (((t % 7) + 7) % 7 !== 0) continue;
    tonicCandidates.push(t);
  }
  tonicCandidates.sort((a, b) => Math.abs(a) - Math.abs(b));

  for (const t of tonicCandidates) {
    for (let s = 1; s <= MAX_BASS_SCALE_STEP; s++) {
      for (const sg of [-1, 1] as const) {
        const newPen = t - sg * s;
        if (Math.abs(t - newPen) > MAX_BASS_SCALE_STEP) continue;
        if (!isInRange(newPen, 1, ctx)) continue;
        if (pi > 0 && getScaleInterval(prevBeforePen, newPen) > MAX_BASS_SCALE_STEP) continue;
        notes[pi].noteNum = newPen;
        notes[li].noteNum = t;
        return;
      }
    }
  }
}

function enforceBassL1PrimaryRootShare(
  notes: BassNote[],
  measures: number,
  mode: 'major' | 'harmonic_minor',
  ctx: BassGenContext,
): void {
  const countPrimary = () => notes.filter(n => isPrimaryBassRootDegree(n.noteNum)).length;
  let primary = countPrimary();
  const target = Math.ceil(0.6 * measures);
  if (primary >= target) return;

  const adjustable: number[] = [];
  for (let m = 0; m < measures; m++) {
    if (m === 0 || m === measures - 1) continue;
    if (mode === 'harmonic_minor' && m === measures - 2) continue;
    if (!isPrimaryBassRootDegree(notes[m].noteNum)) adjustable.push(m);
  }
  for (let i = adjustable.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [adjustable[i], adjustable[j]] = [adjustable[j], adjustable[i]];
  }

  const degs = [0, 3, 4];
  for (const m of adjustable) {
    if (primary >= target) break;
    const prev = notes[m - 1].noteNum;
    const next = notes[m + 1].noteNum;
    const order = [...degs].sort(() => Math.random() - 0.5);
    for (const deg of order) {
      let nn = deg;
      nn = clampToRange(nn, 1, ctx);
      if (getScaleInterval(prev, nn) > MAX_BASS_SCALE_STEP) continue;
      if (getScaleInterval(nn, next) > MAX_BASS_SCALE_STEP) continue;
      notes[m] = { ...notes[m], noteNum: nn };
      primary++;
      break;
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Level 1: One note per bar (sustained)
// ────────────────────────────────────────────────────────────────

function generateBassLevel1(opts: TwoVoiceBassOptions, structure: number[], ctx: BassGenContext): BassNote[] {
  const { timeSig, measures, mode } = opts;
  const duration = BASS_DURATION_MAP[timeSig].level1;
  const notes: BassNote[] = [];

  for (let m = 0; m < measures; m++) {
    let noteNum: number;

    if (m === 0 || m === measures - 1) {
      noteNum = 0; // tonic
    } else {
      noteNum = structure[m];
      if (mode === 'harmonic_minor' && m === measures - 2) {
        noteNum = 4; // V degree
      }
    }

    noteNum = clampToRange(noteNum, 1, ctx);

    // L1: 인접 마디 nn 차이 ≤ 3 (3도 이내 또는 4도 도약 한 번)
    if (notes.length > 0) {
      const prev = notes[notes.length - 1].noteNum;
      if (getScaleInterval(prev, noteNum) > MAX_BASS_SCALE_STEP) {
        for (const alt of [noteNum + 7, noteNum - 7]) {
          if (isInRange(alt, 1, ctx) && getScaleInterval(prev, alt) <= MAX_BASS_SCALE_STEP) {
            noteNum = alt;
            break;
          }
        }
      }
    }

    notes.push({ noteNum, duration, measure: m, beatPosition: 0 });
  }

  enforceBassL1PrimaryRootShare(notes, measures, mode, ctx);
  fixL1AdjacentSpansUpTo(notes, ctx, notes.length - 1);
  fixL1CadenceLeap(notes, ctx);
  fixL1AdjacentSpansUpTo(notes, ctx, notes.length - 2);

  return notes;
}

// ────────────────────────────────────────────────────────────────
// Level 2: Stepwise motion only
// ────────────────────────────────────────────────────────────────

function generateBassLevel2(
  opts: TwoVoiceBassOptions,
  structure: number[],
  pattern: BassPatternDef,
  ctx: BassGenContext,
): BassNote[] {
  const { timeSig, measures, mode } = opts;
  const durationInfo = BASS_DURATION_MAP[timeSig];
  const noteDuration = durationInfo.level2;
  const notesPerBar = durationInfo.notesPerBar.level2;
  const measureTotal = MEASURE_TOTAL[timeSig];
  const totalNotes = measures * notesPerBar;

  const notes: BassNote[] = [];
  let currentNN = 0;

  // ── Sweep 방식: 한 방향으로 끝까지 간 뒤 경계에서 반전 ──
  // 초기 방향은 패턴의 첫 non-hold contour에서 결정
  let direction: 1 | -1 = -1; // default: descending
  for (const c of pattern.contour) {
    if (c === 'asc') { direction = 1; break; }
    if (c === 'desc') { direction = -1; break; }
  }

  // 첫 마디 두 번째 음에서 도약할지 결정 (패턴 다양성)
  const useInitialLeap = Math.random() < 0.5;

  // ── 반종지 목표 (8마디 이상: 4마디 프레이즈 경계에서 V) ──
  const halfCadenceNotes = getHalfCadenceBars(measures).map(b => b * notesPerBar);

  // 가장 가까운 으뜸음 찾기
  function nearestTonic(from: number): number {
    const candidates = [0, 7, -7, 14, -14];
    let best = 0;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (isInRange(c, 2, ctx)) {
        const d = Math.abs(from - c);
        if (d < bestDist) { bestDist = d; best = c; }
      }
    }
    return best;
  }

  for (let m = 0; m < measures; m++) {
    for (let n = 0; n < notesPerBar; n++) {
      const beatPos = n * noteDuration;
      const noteIndex = m * notesPerBar + n;
      const isFirst = noteIndex === 0;
      const isLast = noteIndex === totalNotes - 1;
      const notesRemaining = totalNotes - noteIndex - 1;
      let didLeap = false;

      if (isFirst) {
        currentNN = 0;
      } else if (noteIndex === 1 && useInitialLeap) {
        // ── 첫 마디 도약: IV(3·-4) / V(4·-3) 근음으로 점프 ──
        const leapTargets = [3, 4, -3, -4]
          .filter(t => isInRange(t, 2, ctx));
        if (leapTargets.length > 0) {
          currentNN = rand(leapTargets);
          // 도약 후 sweep 방향: 도약 방향과 같은 쪽으로 계속 진행
          direction = currentNN > 0 ? 1 : -1;
          didLeap = true;
        } else {
          // 도약 불가 시 순차 진행
          const nextNN = currentNN + direction;
          currentNN = isInRange(nextNN, 2, ctx) ? nextNN : currentNN - direction;
        }
      } else {
        // ── 프레이즈 목표: 반종지(V) 또는 종지(I) ──
        const targetTonic = nearestTonic(currentNN);
        const nextHCIdx = halfCadenceNotes.find(idx => idx >= noteIndex);
        let phraseTarget: number;
        let notesToTarget: number;

        if (nextHCIdx !== undefined) {
          phraseTarget = nearestDominant(currentNN, 2, ctx);
          notesToTarget = nextHCIdx - noteIndex;
        } else {
          phraseTarget = targetTonic;
          notesToTarget = notesRemaining;
        }

        const distToTarget = Math.abs(currentNN - phraseTarget);
        const dirToTarget = phraseTarget > currentNN ? 1 : phraseTarget < currentNN ? -1 : 0;

        if (isLast) {
          currentNN = targetTonic;
        } else if (notesToTarget === 0) {
          // 반종지 착지: V
          currentNN = phraseTarget;
        } else if (notesToTarget <= distToTarget + 1) {
          // 프레이즈 목표 접근 (+1 여유: 순차 제한으로 인한 도착 지연 방지)
          currentNN = currentNN + (dirToTarget || direction);
        } else {
          // ── 핵심: 현재 방향으로 한 칸 이동, 경계 도달 시 반전 ──
          const nextNN = currentNN + direction;
          if (isInRange(nextNN, 2, ctx)) {
            currentNN = nextNN;
          } else {
            // 경계 도달 → 방향 반전
            direction = -direction as 1 | -1;
            const reversed = currentNN + direction;
            currentNN = isInRange(reversed, 2, ctx) ? reversed : currentNN;
          }
        }
      }

      // 도약한 음은 순차 제한 건너뜀
      if (!didLeap) {
        // Harmonic minor: 증2도(6→#7) 회피
        if (mode === 'harmonic_minor' && notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          if (isAugmentedSecond(prevNN, currentNN, ctx)) {
            currentNN = resolveAugSecond(prevNN, currentNN, 2, ctx);
          }
        }

        // 연속 반음 3개 제한
        if (notes.length >= 2) {
          const prev1NN = notes[notes.length - 2].noteNum;
          const prev2NN = notes[notes.length - 1].noteNum;
          const semi1 = getSemitoneInterval(prev1NN, prev2NN, ctx) === 1;
          const semi2 = getSemitoneInterval(prev2NN, currentNN, ctx) === 1;
          if (semi1 && semi2) {
            currentNN = notes[notes.length - 1].noteNum;
          }
        }

        // 순차 보장: 이전 음과의 간격 ≤ 1
        if (notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          const interval = Math.abs(currentNN - prevNN);
          if (interval > 1) {
            const dir = currentNN > prevNN ? 1 : -1;
            currentNN = prevNN + dir;
          }
          if (mode === 'harmonic_minor' && isAugmentedSecond(prevNN, currentNN, ctx)) {
            currentNN = resolveAugSecond(prevNN, currentNN, 2, ctx);
          }
        }
      }

      // 마지막 음: 남은 박자 채우기
      if (isLast) {
        const usedDuration = n * noteDuration;
        notes.push({
          noteNum: currentNN,
          duration: measureTotal - usedDuration,
          measure: m,
          beatPosition: beatPos,
        });
        continue;
      }

      notes.push({ noteNum: currentNN, duration: noteDuration, measure: m, beatPosition: beatPos });
    }
  }

  return notes;
}

// ────────────────────────────────────────────────────────────────
// Level 3: Stepwise + leap mixed + occasional 5th (중급)
// ────────────────────────────────────────────────────────────────

/** 5도 도약 허용 최대 음계도 차이 (완전5도 = 4칸) */
const MAX_L3_SCALE_STEP = 4;

function isForbiddenLeapL3(fromNN: number, toNN: number, ctx: BassGenContext): boolean {
  const interval = Math.abs(toNN - fromNN);
  if (interval <= 1) return false;
  if (interval > MAX_L3_SCALE_STEP) return true;
  const semitones = getSemitoneInterval(fromNN, toNN, ctx);
  if (semitones === 6) return true;  // tritone (증4도)
  if (semitones === 8) return true;  // augmented 5th
  return false;
}

/** 최근 음들의 같은 방향 연속 이동 횟수 (방향 무관, 실제 음 기준) */
function countConsecutiveSameDirection(notes: BassNote[]): number {
  if (notes.length < 2) return 0;
  const lastDiff = notes[notes.length - 1].noteNum - notes[notes.length - 2].noteNum;
  if (lastDiff === 0) return 0;
  const lastDir = lastDiff > 0 ? 1 : -1;
  let count = 1;
  for (let i = notes.length - 2; i >= 1; i--) {
    const diff = notes[i].noteNum - notes[i - 1].noteNum;
    if (diff === 0) break;
    const dir = diff > 0 ? 1 : -1;
    if (dir === lastDir) count++;
    else break;
  }
  return count;
}

function generateBassLevel3(
  opts: TwoVoiceBassOptions,
  structure: number[],
  pattern: BassPatternDef,
  ctx: BassGenContext,
): BassNote[] {
  const { timeSig, measures, mode } = opts;
  const durationInfo = BASS_DURATION_MAP[timeSig];
  const noteDuration = durationInfo.level2;
  const notesPerBar = durationInfo.notesPerBar.level3;
  const measureTotal = MEASURE_TOTAL[timeSig];
  const totalNotes = measures * notesPerBar;
  const notes: BassNote[] = [];

  let currentNN = 0;
  let sameDirCount = 0;   // 같은 방향 연속 이동 카운터
  let lastMoveDir = 0;    // 직전 이동 방향 (1=상행, -1=하행, 0=동음)

  // ── Sweep 방향 ──
  let direction: 1 | -1 = -1;
  for (const c of pattern.contour) {
    if (c === 'asc') { direction = 1; break; }
    if (c === 'desc') { direction = -1; break; }
  }

  // ── 4마디당 일반 도약(3도/4도) 1회 위치 + 5도 도약 최대 1회 위치 결정 ──
  const leapPositions = new Set<number>();
  const fifthLeapPositions = new Set<number>();
  const groupSize = 4 * notesPerBar;

  for (let g = 0; g * groupSize < totalNotes; g++) {
    const groupStart = g * groupSize;
    const groupEnd = Math.min(groupStart + groupSize, totalNotes);
    const candidates: number[] = [];
    for (let idx = groupStart + 1; idx < groupEnd - 1; idx++) {
      candidates.push(idx);
    }
    if (candidates.length > 0) {
      // 5도 도약 위치 (4마디당 0~1회, 확률 ~60%)
      if (Math.random() < 0.6) {
        const fifthIdx = rand(candidates);
        fifthLeapPositions.add(fifthIdx);
        const remaining = candidates.filter(c => c !== fifthIdx);
        if (remaining.length > 0) {
          leapPositions.add(rand(remaining));
        }
      } else {
        leapPositions.add(rand(candidates));
      }
    }
  }

  function nearestTonic(from: number): number {
    const candidates = [0, 7, -7, 14, -14];
    let best = 0;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (isInRange(c, 3, ctx)) {
        const d = Math.abs(from - c);
        if (d < bestDist) { bestDist = d; best = c; }
      }
    }
    return best;
  }

  // ── 반종지 목표 (8마디 이상: 4마디 프레이즈 경계에서 V) ──
  const halfCadenceNotes = getHalfCadenceBars(measures).map(b => b * notesPerBar);

  for (let m = 0; m < measures; m++) {
    for (let n = 0; n < notesPerBar; n++) {
      const beatPos = n * noteDuration;
      const noteIndex = m * notesPerBar + n;
      const isFirstNote = noteIndex === 0;
      const isLastNote = noteIndex === totalNotes - 1;
      const notesRemaining = totalNotes - noteIndex - 1;
      let didLeap = false;

      if (isFirstNote) {
        currentNN = 0;
      } else if (isLastNote) {
        currentNN = nearestTonic(currentNN);
      } else {
        const targetTonic = nearestTonic(currentNN);

        // ── 프레이즈 목표: 반종지(V) 또는 종지(I) ──
        const nextHCIdx = halfCadenceNotes.find(idx => idx >= noteIndex);
        let phraseTarget: number;
        let notesToTarget: number;

        if (nextHCIdx !== undefined) {
          phraseTarget = nearestDominant(currentNN, 3, ctx);
          notesToTarget = nextHCIdx - noteIndex;
        } else {
          phraseTarget = targetTonic;
          notesToTarget = notesRemaining;
        }

        const distToTarget = Math.abs(currentNN - phraseTarget);
        const dirToTarget = phraseTarget > currentNN ? 1 : phraseTarget < currentNN ? -1 : 0;

        // 반종지 착지/접근은 방향 제한보다 우선 (같은 방향 연장 아닐 때만)
        const isHalfCadenceUrgent = nextHCIdx !== undefined && notesToTarget <= 2;
        const hcApproachConflicts = sameDirCount >= 3 && dirToTarget !== 0 && dirToTarget === lastMoveDir;

        if (notesToTarget === 0 && nextHCIdx !== undefined && !hcApproachConflicts) {
          // ── 반종지 착지: V ──
          currentNN = phraseTarget;
        } else if (isHalfCadenceUrgent && notesToTarget <= distToTarget && !hcApproachConflicts) {
          // ── 반종지 긴급 접근 (2음 이내, 같은방향 초과 아닐 때) ──
          currentNN = currentNN + (dirToTarget || direction);
        } else if (sameDirCount >= 3) {
          // ── 3음 초과 같은 방향 → 강제 반대 방향 ──
          const revDir = (lastMoveDir !== 0 ? -lastMoveDir : -direction) as 1 | -1;
          const revNN = currentNN + revDir;
          if (isInRange(revNN, 3, ctx)) {
            currentNN = revNN;
            direction = revDir;
          } else {
            // 반전 불가 → 도약으로 방향 전환
            const leapNN = currentNN + revDir * 2;
            if (isInRange(leapNN, 3, ctx)) {
              currentNN = leapNN;
              direction = revDir;
              didLeap = true;
            }
          }
        } else if (notesToTarget <= distToTarget) {
          // 프레이즈 목표 접근 (반종지 V 또는 종지 I)
          currentNN = currentNN + (dirToTarget || direction);
        } else if (fifthLeapPositions.has(noteIndex)) {
          // ── 5도 도약 (음계도 4칸) ──
          const leapSize = 4;
          const tryLeap = (size: number, checkFn: typeof isForbiddenLeap): number | null => {
            for (const dir of [direction, -direction as 1 | -1]) {
              const nn = currentNN + dir * size;
              if (!checkFn(currentNN, nn, ctx) && isInRange(nn, 3, ctx)) {
                // 으뜸음에서 너무 멀면 거부 (종지 복귀 시 긴 같은방향 방지)
                const tonicDist = Math.abs(nn - nearestTonic(nn));
                if (tonicDist <= 3) return nn;
              }
            }
            return null;
          };
          const nextNN = tryLeap(leapSize, isForbiddenLeapL3)
            ?? tryLeap(3, isForbiddenLeap)
            ?? tryLeap(2, isForbiddenLeap)
            ?? currentNN + direction;
          currentNN = nextNN;
          didLeap = true;
          direction = -direction as 1 | -1;
        } else if (leapPositions.has(noteIndex)) {
          // ── 3도/4도 도약 (음계도 2~3칸) ──
          const leapSize = Math.random() < 0.6 ? 2 : 3;
          let nextNN = currentNN + direction * leapSize;
          if (isForbiddenLeap(currentNN, nextNN, ctx) || !isInRange(nextNN, 3, ctx)) {
            nextNN = currentNN - direction * leapSize;
            if (isForbiddenLeap(currentNN, nextNN, ctx) || !isInRange(nextNN, 3, ctx)) {
              nextNN = currentNN + direction;
            }
          }
          currentNN = nextNN;
          didLeap = true;
        } else {
          // ── Sweep 순차 (±1) ──
          // 프레이즈 목표로부터 3도 초과 시 방향 반전 (너무 멀리 벗어나지 않도록)
          if (distToTarget >= 3 && dirToTarget !== 0 && direction !== dirToTarget) {
            direction = dirToTarget as 1 | -1;
          }
          const nextNN = currentNN + direction;
          if (isInRange(nextNN, 3, ctx)) {
            currentNN = nextNN;
          } else {
            direction = -direction as 1 | -1;
            const reversed = currentNN + direction;
            currentNN = isInRange(reversed, 3, ctx) ? reversed : currentNN;
          }
        }
      }

      if (!didLeap) {
        if (mode === 'harmonic_minor' && notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          if (isAugmentedSecond(prevNN, currentNN, ctx)) {
            currentNN = resolveAugSecond(prevNN, currentNN, 3, ctx);
          }
        }
        if (notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          const interval = Math.abs(currentNN - prevNN);
          if (interval > 1) {
            const dir = currentNN > prevNN ? 1 : -1;
            currentNN = prevNN + dir;
          }
          if (mode === 'harmonic_minor' && isAugmentedSecond(prevNN, currentNN, ctx)) {
            currentNN = resolveAugSecond(prevNN, currentNN, 3, ctx);
          }
        }
      }

      if (isLastNote) {
        const usedDuration = n * noteDuration;
        notes.push({
          noteNum: currentNN,
          duration: measureTotal - usedDuration,
          measure: m,
          beatPosition: beatPos,
        });
        continue;
      }

      notes.push({ noteNum: currentNN, duration: noteDuration, measure: m, beatPosition: beatPos });

      // ── 같은 방향 연속 이동 추적 ──
      if (notes.length >= 2) {
        const diff = notes[notes.length - 1].noteNum - notes[notes.length - 2].noteNum;
        const moveDir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
        if (moveDir !== 0 && moveDir === lastMoveDir) {
          sameDirCount++;
        } else if (moveDir !== 0) {
          sameDirCount = 1;
          lastMoveDir = moveDir;
        } else {
          sameDirCount = 0;
          lastMoveDir = 0;
        }
      }
    }
  }

  if (mode === 'harmonic_minor') {
    const scaleInfo = getScaleInfo(opts.key, mode);
    applyLeadingToneResolution(notes, scaleInfo.leadingToneIndex);
  }

  // ── 같은 방향 연속 이동 후처리 보정 (최대 3회) ──
  fixConsecutiveSameDirection(notes, 3, ctx);

  return notes;
}

// ────────────────────────────────────────────────────────────────
// Post-processing: consecutive same-direction fix
// ────────────────────────────────────────────────────────────────

/**
 * 같은 방향 연속 이동이 maxMoves를 초과하면 중간 음을 보정.
 * 위반 지점의 음을 직전 음과 동일하게(유지) 설정하여 방향 체인을 끊는다.
 */
function fixConsecutiveSameDirection(
  notes: BassNote[], maxMoves: number, _ctx: BassGenContext,
): void {
  for (let pass = 0; pass < 3; pass++) {
    let fixed = false;
    let count = 0;
    let lastDir = 0;
    for (let i = 1; i < notes.length; i++) {
      const diff = notes[i].noteNum - notes[i - 1].noteNum;
      const dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
      if (dir !== 0 && dir === lastDir) {
        count++;
        if (count > maxMoves) {
          // 위반 지점: 이 음을 직전 음과 같게 만들어 체인 차단
          notes[i].noteNum = notes[i - 1].noteNum;
          count = 0;
          lastDir = 0;
          fixed = true;
        }
      } else if (dir !== 0) {
        count = 1;
        lastDir = dir;
      } else {
        count = 0;
        lastDir = 0;
      }
    }
    if (!fixed) break;
  }
}

// ────────────────────────────────────────────────────────────────
// Leading tone resolution helper (harmonic minor)
// ────────────────────────────────────────────────────────────────

function applyLeadingToneResolution(notes: BassNote[], leadingToneIndex: number): void {
  for (let i = 0; i < notes.length - 1; i++) {
    const deg = ((notes[i].noteNum % 7) + 7) % 7;
    if (deg === leadingToneIndex) {
      const nextDeg = ((notes[i + 1].noteNum % 7) + 7) % 7;
      if (nextDeg !== 0) {
        const octBlock = Math.floor(notes[i].noteNum / 7);
        notes[i + 1].noteNum = (octBlock + 1) * 7; // tonic one step up
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────

export function generateTwoVoiceBass(opts: TwoVoiceBassOptions): BassNote[] {
  const { bassLevel, measures, bassDirection, mode } = opts;
  const isMinor = mode === 'harmonic_minor';
  const ctx = buildContext(opts.key, mode);

  // Step 1: Generate harmonic structure
  const structure = generateBassStructure(measures, isMinor);

  // Step 2: Resolve pattern (if applicable for L2/L3)
  let pattern: BassPatternDef | undefined;
  if (bassLevel >= 2) {
    if (bassDirection) {
      pattern = getPatternById(bassDirection);
      if (!pattern) {
        pattern = selectRandomPattern(measures, bassLevel);
      }
    } else {
      pattern = selectRandomPattern(measures, bassLevel);
    }
  }

  // Step 3: Generate bass notes per level
  let bassNotes: BassNote[];
  switch (bassLevel) {
    case 1:
      bassNotes = generateBassLevel1(opts, structure, ctx);
      break;
    case 2:
      bassNotes = generateBassLevel2(opts, structure, pattern!, ctx);
      break;
    case 3:
      bassNotes = generateBassLevel3(opts, structure, pattern!, ctx);
      break;
    default:
      throw new Error(`Invalid bass level: ${bassLevel}`);
  }

  // Step 4: Validate measure durations (self-check)
  validateDurations(bassNotes, opts);

  return bassNotes;
}

// ────────────────────────────────────────────────────────────────
// Internal duration validation
// ────────────────────────────────────────────────────────────────

function validateDurations(notes: BassNote[], opts: TwoVoiceBassOptions): void {
  const expectedTotal = MEASURE_TOTAL[opts.timeSig];
  const byMeasure = new Map<number, number>();

  for (const n of notes) {
    byMeasure.set(n.measure, (byMeasure.get(n.measure) || 0) + n.duration);
  }

  for (let m = 0; m < opts.measures; m++) {
    const total = byMeasure.get(m) || 0;
    if (total !== expectedTotal) {
      const measureNotes = notes.filter(n => n.measure === m);
      if (measureNotes.length > 0) {
        const last = measureNotes[measureNotes.length - 1];
        const others = measureNotes.slice(0, -1);
        const othersTotal = others.reduce((s, n) => s + n.duration, 0);
        last.duration = expectedTotal - othersTotal;
      }
    }
  }
}
