// ────────────────────────────────────────────────────────────────
// Two-Voice Bass Generator — Bass Generation Engine (L1/L2/L3)
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
 * Forbidden leap for Level 3.
 * Forbidden: 7th (6 degrees), 9th+, augmented 4th/5th.
 */
function isForbiddenLeap(fromNN: number, toNN: number, ctx: BassGenContext): boolean {
  const interval = Math.abs(toNN - fromNN);
  if (interval <= 1) return false;
  if (interval === 6) return true;  // 7th
  if (interval > 7) return true;    // 9th+

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

    // L1 rule: max leap of 5th (4 scale degrees) between adjacent bars
    if (notes.length > 0) {
      const prev = notes[notes.length - 1].noteNum;
      if (getScaleInterval(prev, noteNum) > 4) {
        for (const alt of [noteNum + 7, noteNum - 7]) {
          if (isInRange(alt, 1, ctx) && getScaleInterval(prev, alt) <= 4) {
            noteNum = alt;
            break;
          }
        }
      }
    }

    notes.push({ noteNum, duration, measure: m, beatPosition: 0 });
  }

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
  const scaleInfo = getScaleInfo(opts.key, mode);
  const durationInfo = BASS_DURATION_MAP[timeSig];
  const noteDuration = durationInfo.level2;
  const notesPerBar = durationInfo.notesPerBar.level2;
  const measureTotal = MEASURE_TOTAL[timeSig];
  const totalNotes = measures * notesPerBar;

  // Find the nearest tonic (0, 7, -7) that is reachable by stepwise motion
  // from where we'll approximately be, to use as the ending target.
  // We generate forward following contour, but plan the last few notes
  // to arrive at tonic stepwise.

  const notes: BassNote[] = [];
  let currentNN = 0;

  // Pre-compute: find nearest tonic for ending
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
    const contourDir = pattern.contour[m];

    for (let n = 0; n < notesPerBar; n++) {
      const beatPos = n * noteDuration;
      const noteIndex = m * notesPerBar + n;
      const isFirst = noteIndex === 0;
      const isLast = noteIndex === totalNotes - 1;
      const notesRemaining = totalNotes - noteIndex - 1;

      if (isFirst) {
        currentNN = 0;
      } else {
        // Calculate target tonic and distance
        const targetTonic = nearestTonic(currentNN);
        const distToTonic = Math.abs(currentNN - targetTonic);
        const dirToTonic = targetTonic > currentNN ? 1 : targetTonic < currentNN ? -1 : 0;

        if (isLast) {
          // Must arrive at tonic: step toward it (should be 1 step away if planned correctly)
          currentNN = currentNN + dirToTonic;
          // Force to tonic if within 1 step
          if (Math.abs(currentNN - targetTonic) <= 0) {
            currentNN = targetTonic;
          } else {
            currentNN = targetTonic; // Force - validated later
          }
        } else if (notesRemaining <= distToTonic) {
          // Must start heading toward tonic to arrive stepwise
          currentNN = currentNN + dirToTonic;
        } else {
          // Normal stepwise motion following contour
          const step = contourDir === 'asc' ? 1 : contourDir === 'desc' ? -1 : 0;
          const nextNN = currentNN + step;

          if (isInRange(nextNN, 2, ctx)) {
            currentNN = nextNN;
          } else {
            const reversed = currentNN - step;
            currentNN = isInRange(reversed, 2, ctx) ? reversed : clampToRange(currentNN, 2, ctx);
          }
        }

        // Harmonic minor L2: no augmented 2nd (6->#7 forbidden)
        if (mode === 'harmonic_minor' && notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          if (isAugmentedSecond(prevNN, currentNN, ctx)) {
            // Skip the leading tone: reverse direction instead
            const dir = currentNN > prevNN ? 1 : -1;
            currentNN = prevNN - dir; // go opposite
            if (!isInRange(currentNN, 2, ctx)) {
              currentNN = prevNN; // hold as last resort
            }
          }
        }

        // Check consecutive semitone limit (max 2)
        if (notes.length >= 2) {
          const prev1NN = notes[notes.length - 2].noteNum;
          const prev2NN = notes[notes.length - 1].noteNum;
          const semi1 = getSemitoneInterval(prev1NN, prev2NN, ctx) === 1;
          const semi2 = getSemitoneInterval(prev2NN, currentNN, ctx) === 1;
          if (semi1 && semi2) {
            // Reverse to avoid 3 consecutive semitones, but stay stepwise
            currentNN = notes[notes.length - 1].noteNum; // hold
          }
        }

        // Final stepwise guarantee: ensure interval from previous note is <= 1
        if (notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          const interval = Math.abs(currentNN - prevNN);
          if (interval > 1) {
            // Force stepwise: move 1 step toward target
            const dir = currentNN > prevNN ? 1 : -1;
            currentNN = prevNN + dir;
          }
          // Re-check aug2nd after stepwise enforcement
          if (mode === 'harmonic_minor' && isAugmentedSecond(prevNN, currentNN, ctx)) {
            currentNN = prevNN; // hold to avoid aug2nd
          }
        }
      }

      // Last note gets remaining duration to fill the bar
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

  // L2: do NOT apply leading tone resolution — L2 avoids #7 entirely
  // (per rules: "#7음은 종지부에서 순차 해결" but aug2nd is forbidden in L2)

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
  const notes: BassNote[] = [];

  let currentNN = 0;
  let consecutiveSameDirectionLeaps = 0;
  let lastLeapDirection = 0;
  let totalSteps = 0;
  let totalLeaps = 0;

  for (let m = 0; m < measures; m++) {
    const contourDir = pattern.contour[m];

    for (let n = 0; n < notesPerBar; n++) {
      const beatPos = n * noteDuration;
      const isFirstNote = m === 0 && n === 0;
      const isLastNote = m === measures - 1 && n === notesPerBar - 1;

      if (isFirstNote) {
        currentNN = 0;
      } else if (isLastNote) {
        const candidates = [0, 7, -7];
        let bestTonic = 0;
        let bestDist = Infinity;
        for (const c of candidates) {
          if (isInRange(c, 3, ctx)) {
            const d = Math.abs(currentNN - c);
            if (d < bestDist) { bestDist = d; bestTonic = c; }
          }
        }
        currentNN = bestTonic;
      } else {
        const totalMoves = totalSteps + totalLeaps;
        const currentLeapRatio = totalMoves > 0 ? totalLeaps / totalMoves : 0;

        // Target: 30-50% leaps
        let shouldLeap: boolean;
        if (currentLeapRatio < 0.3 && totalMoves > 2) {
          shouldLeap = Math.random() < 0.6;
        } else if (currentLeapRatio > 0.5) {
          shouldLeap = Math.random() < 0.2;
        } else {
          shouldLeap = Math.random() < 0.4;
        }

        const direction = contourDir === 'asc' ? 1 : contourDir === 'desc' ? -1 :
          (Math.random() < 0.5 ? 1 : -1);

        let nextNN: number;

        if (shouldLeap) {
          if (direction === lastLeapDirection && consecutiveSameDirectionLeaps >= 2) {
            nextNN = currentNN + direction;
            totalSteps++;
          } else {
            const leapSize = rand([2, 3, 4, 5, 7]);
            nextNN = currentNN + direction * leapSize;

            if (isForbiddenLeap(currentNN, nextNN, ctx)) {
              nextNN = currentNN + direction;
              totalSteps++;
            } else {
              totalLeaps++;
              if (direction === lastLeapDirection) {
                consecutiveSameDirectionLeaps++;
              } else {
                consecutiveSameDirectionLeaps = 1;
                lastLeapDirection = direction;
              }
            }
          }
        } else {
          nextNN = currentNN + direction;
          totalSteps++;
          consecutiveSameDirectionLeaps = 0;
        }

        // Range check
        if (!isInRange(nextNN, 3, ctx)) {
          const opposite = currentNN - (nextNN - currentNN);
          nextNN = isInRange(opposite, 3, ctx) ? opposite : clampToRange(nextNN, 3, ctx);
        }

        // Harmonic minor augmented 2nd: only ascending allowed
        if (mode === 'harmonic_minor' && notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          if (isAugmentedSecond(prevNN, nextNN, ctx) && nextNN < prevNN) {
            nextNN = prevNN - 2;
            if (!isInRange(nextNN, 3, ctx)) nextNN = prevNN;
          }
        }

        // Compensation after large leap (4th+)
        if (notes.length > 0) {
          const prevNN = notes[notes.length - 1].noteNum;
          const leapSize = Math.abs(currentNN - prevNN);
          if (leapSize >= 3 && !isFirstNote) {
            const leapDir = currentNN > prevNN ? 1 : -1;
            const nextDir = nextNN > currentNN ? 1 : -1;
            if (nextDir === leapDir) {
              const compensated = currentNN - leapDir;
              if (isInRange(compensated, 3, ctx)) nextNN = compensated;
            }
          }
        }

        currentNN = nextNN;
      }

      // Last note gets remaining duration
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
