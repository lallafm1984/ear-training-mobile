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
  for (const shift of [-7, 7, -14, 14]) {
    if (isInRange(noteNum + shift, level, ctx)) return noteNum + shift;
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
        // 종지 접근: 남은 음 수 ≤ 으뜸음까지 거리 → 으뜸음 향해 복귀
        const targetTonic = nearestTonic(currentNN);
        const distToTonic = Math.abs(currentNN - targetTonic);
        const dirToTonic = targetTonic > currentNN ? 1 : targetTonic < currentNN ? -1 : 0;

        if (isLast) {
          currentNN = targetTonic;
        } else if (notesRemaining <= distToTonic) {
          // 으뜸음으로 순차 복귀
          currentNN = currentNN + dirToTonic;
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
            const dir = currentNN > prevNN ? 1 : -1;
            currentNN = prevNN - dir;
            if (!isInRange(currentNN, 2, ctx)) {
              currentNN = prevNN;
            }
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
            currentNN = prevNN;
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
// Level 3: Stepwise + leap mixed
// ────────────────────────────────────────────────────────────────

function generateBassLevel3(
  opts: TwoVoiceBassOptions,
  structure: number[],
  pattern: BassPatternDef,
  ctx: BassGenContext,
): BassNote[] {
  const { timeSig, measures, mode } = opts;
  const scaleInfo = getScaleInfo(opts.key, mode);
  const durationInfo = BASS_DURATION_MAP[timeSig];
  const noteDuration = durationInfo.level2;
  const notesPerBar = durationInfo.notesPerBar.level3;
  const measureTotal = MEASURE_TOTAL[timeSig];
  const totalNotes = measures * notesPerBar;
  const notes: BassNote[] = [];

  let currentNN = 0;

  // ── Sweep 방향 (L2와 동일): 한 방향으로 끝까지 간 뒤 경계에서 반전 ──
  let direction: 1 | -1 = -1;
  for (const c of pattern.contour) {
    if (c === 'asc') { direction = 1; break; }
    if (c === 'desc') { direction = -1; break; }
  }

  // ── 4마디당 도약 1회 위치 미리 결정 ──
  const leapPositions = new Set<number>();
  const groupSize = 4 * notesPerBar;
  for (let g = 0; g * groupSize < totalNotes; g++) {
    const groupStart = g * groupSize;
    const groupEnd = Math.min(groupStart + groupSize, totalNotes);
    const candidates: number[] = [];
    for (let idx = groupStart + 1; idx < groupEnd - 1; idx++) {
      candidates.push(idx);
    }
    if (candidates.length > 0) {
      leapPositions.add(rand(candidates));
    }
  }

  // 가장 가까운 으뜸음 찾기
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
        const distToTonic = Math.abs(currentNN - targetTonic);
        const dirToTonic = targetTonic > currentNN ? 1 : targetTonic < currentNN ? -1 : 0;

        if (notesRemaining <= distToTonic) {
          // 으뜸음으로 순차 복귀
          currentNN = currentNN + dirToTonic;
        } else if (leapPositions.has(noteIndex)) {
          // ── 4도 도약 (음계도 3칸) ──
          const leapSize = 3;
          let nextNN = currentNN + direction * leapSize;

          if (isForbiddenLeap(currentNN, nextNN, ctx) || !isInRange(nextNN, 3, ctx)) {
            nextNN = currentNN - direction * leapSize;
            if (isForbiddenLeap(currentNN, nextNN, ctx) || !isInRange(nextNN, 3, ctx)) {
              nextNN = currentNN + direction; // fallback 순차
            }
          }
          currentNN = nextNN;
          didLeap = true;
        } else {
          // ── Sweep 순차 (±1), 경계에서 반전 (L2와 동일) ──
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
        // Harmonic minor: 증2도 회피 (하행만 금지)
        if (mode === 'harmonic_minor' && notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          if (isAugmentedSecond(prevNN, currentNN, ctx) && currentNN < prevNN) {
            currentNN = prevNN - 2;
            if (!isInRange(currentNN, 3, ctx)) currentNN = prevNN;
          }
        }

        // 순차 보장: 이전 음과의 간격 ≤ 1 (도약 위치가 아닌 경우)
        if (notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          const interval = Math.abs(currentNN - prevNN);
          if (interval > 1) {
            const dir = currentNN > prevNN ? 1 : -1;
            currentNN = prevNN + dir;
          }
          if (mode === 'harmonic_minor' && isAugmentedSecond(prevNN, currentNN, ctx)) {
            currentNN = prevNN;
          }
        }
      }

      // 마지막 음: 남은 박자 채우기
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
    }
  }

  if (mode === 'harmonic_minor') {
    applyLeadingToneResolution(notes, scaleInfo.leadingToneIndex);
  }

  return notes;
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
