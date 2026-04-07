// ────────────────────────────────────────────────────────────────
// Unified Melody Generator (통합 멜로디 생성기)
// 1성부(단일 보표) / 2성부(큰보표) 공용.
// bassNotes가 주어지면 2성부(강박 협화 강제), 없으면 1성부(독립 선율).
// Spec: temp/ear_training_melody_prompt_v4.md — 레벨 1–9, 강박 협화, 화성단조 처리
// ────────────────────────────────────────────────────────────────

import type { ScoreNote, PitchName, NoteDuration, Accidental } from '../scoreUtils';
import {
  getScaleDegrees,
  getSixteenthsPerBar,
  noteNumToNote,
  nnToMidi,
  noteToMidiWithKey,
  durationToSixteenths,
  makeNote,
  makeRest,
  DISSONANT_PC,
  IMPERFECT_CONSONANT_PC,
  CHORD_TONES,
  PITCH_ORDER,
  isForbiddenMelodicInterval,
  getKeySigAlteration,
  SIXTEENTHS_TO_DUR,
  sixteenthsToDuration,
  getTupletNoteDuration,
  uid,
} from '../scoreUtils';
import type { TimeSignature } from './types';
import { strongBeatOffsetsSixteenths0 } from './meter';
import { fillRhythm } from '../trebleRhythmFill';
import {
  getDurationPoolForMelodyLevel,
  getTrebleRhythmParamsForMelodyLevel,
  getDurationPoolForPartPractice,
  getRhythmParamsForPartPractice,
} from '../melodyRhythmLevel';
import { getMelodyMotionParams, inferChordDegreeFromBassMidi } from './melodyScoreParity';
import { applyMelodyAccidentals } from './chromaticAccidental';

// ────────────────────────────────────────────────────────────────
// Public interface
// ────────────────────────────────────────────────────────────────

/** @deprecated Use MelodyGeneratorOptions instead */
export type TwoVoiceMelodyOptions = MelodyGeneratorOptions;

export interface MelodyGeneratorOptions {
  key: string;              // e.g. 'C', 'Am', 'Dm'
  mode: 'major' | 'harmonic_minor';
  timeSig: TimeSignature;
  measures: number;         // total measures including cadence (4, 8, 12, 16)
  melodyLevel: number;      // 1-9
  progression: number[];    // chord progression (scale degree indices)
  /** Pre-generated bass (excluding cadence bar). 없으면 1성부 모드. */
  bassNotes?: ScoreNote[];
  /** Treble staff octave base (default 4). Pass scoreGenerator's TREBLE_BASE for alignment. */
  trebleBaseOctave?: number;
  /**
   * Min/max scale-degree offset (nn) — must match scoreGenerator treble bounds so the
   * melody stays in treble register (avoids B₃-style dips when nnLow was symmetric).
   */
  melodyNnMin?: number;
  melodyNnMax?: number;
  /** 부분연습 레벨 (1~9) — 설정 시 해당 레벨 전용 duration pool/rhythm params 사용 */
  partPracticeLevel?: number;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const TREBLE_BASE = 4;

/** Level-specific melody constraints (음역·쉼표는 v4 패턴, 선율·도약·스냅은 1성부 LEVEL_PARAMS 정렬) */
interface LevelConstraints {
  stepwiseRatio: number;
  maxLeap: number;
  maxInterval: number;
  chordSnapStrong: number;
  chordSnapWeak: number;
  allowRests: boolean;
  rangeOctaves: number;
}

/** 음역·쉼표 허용만 레벨별 (리듬 v4); stepwise/maxLeap 등은 getMelodyMotionParams로 덮어씀 */
const LEVEL_RANGE_REST: Record<number, Pick<LevelConstraints, 'allowRests' | 'rangeOctaves'>> = {
  1: { allowRests: false, rangeOctaves: 1 },
  2: { allowRests: true,  rangeOctaves: 1 },
  3: { allowRests: true,  rangeOctaves: 1 },
  4: { allowRests: true,  rangeOctaves: 1 },
  5: { allowRests: true,  rangeOctaves: 1.5 },
  6: { allowRests: true,  rangeOctaves: 1.5 },
  7: { allowRests: true,  rangeOctaves: 1.5 },
  8: { allowRests: true,  rangeOctaves: 1.5 },
  9: { allowRests: true,  rangeOctaves: 2 },
};

function buildLevelConstraints(level: number): LevelConstraints {
  const k = Math.min(Math.max(level, 1), 9);
  const motion = getMelodyMotionParams(k);
  const rr = LEVEL_RANGE_REST[k];
  return {
    stepwiseRatio: motion.stepwiseProb,
    maxLeap: motion.maxLeap,
    maxInterval: motion.maxInterval,
    chordSnapStrong: motion.chordSnapStrong,
    chordSnapWeak: motion.chordSnapWeak,
    allowRests: rr.allowRests,
    rangeOctaves: rr.rangeOctaves,
  };
}

// ────────────────────────────────────────────────────────────────
// Internal context
// ────────────────────────────────────────────────────────────────

interface MelodyGenContext {
  scale: PitchName[];
  baseOctave: number;
  keySignature: string;
  mode: 'major' | 'harmonic_minor';
  timeSig: TimeSignature;
  constraints: LevelConstraints;
  level: number;
  /** Range limits in nn */
  nnLow: number;
  nnHigh: number;
  /** 베이스가 존재하면 true (2성부), 없으면 false (1성부) */
  hasBass: boolean;
  /** 프레이즈 정점 계획 (lvl>=4, 4마디 프레이즈 단위) */
  phrasePeaks: { bar: number; peakNn: number }[];
}

function buildContext(opts: MelodyGeneratorOptions): MelodyGenContext {
  const keySignature = opts.mode === 'harmonic_minor'
    ? (opts.key.endsWith('m') ? opts.key : opts.key + 'm')
    : opts.key;
  const scale = getScaleDegrees(keySignature);
  const baseOctave = opts.trebleBaseOctave ?? TREBLE_BASE;
  let constraints = buildLevelConstraints(opts.melodyLevel);

  // 부분연습: 선율 파라미터를 간소화 (순차진행 위주, 도약 제한)
  if (opts.partPracticeLevel) {
    constraints = {
      ...constraints,
      stepwiseRatio: 0.80,
      maxLeap: 4,
      maxInterval: 4,
    };
  }

  // Range: center around tonic at treble base octave (nn=0 = root at baseOctave)
  const rangeHalf = Math.ceil(constraints.rangeOctaves * 7);
  let nnLow = -rangeHalf;
  let nnHigh = rangeHalf;
  if (opts.melodyNnMin !== undefined) nnLow = Math.max(nnLow, opts.melodyNnMin);
  if (opts.melodyNnMax !== undefined) nnHigh = Math.min(nnHigh, opts.melodyNnMax);
  if (nnLow > nnHigh) nnLow = nnHigh;

  const hasBass = !!opts.bassNotes && opts.bassNotes.length > 0;
  const level = opts.melodyLevel;
  const effectiveMax = nnHigh;

  // ── 단일 정점 사전 계획 (4마디 프레이즈 단위, lvl>=4) ──
  const PHRASE_LEN = 4;
  const phrasePeaks: { bar: number; peakNn: number }[] = [];
  if (level >= 4) {
    const loopBars = opts.measures - 1; // 종지 마디 제외
    const phraseCount = Math.ceil(loopBars / PHRASE_LEN);
    for (let p = 0; p < phraseCount; p++) {
      const pStart = p * PHRASE_LEN;
      const pEnd = Math.min(pStart + PHRASE_LEN - 1, loopBars - 1);
      const peakBar = pEnd > pStart
        ? pStart + 1 + Math.floor(Math.random() * Math.max(1, pEnd - pStart))
        : pStart;
      const peakNn = Math.min(
        effectiveMax,
        Math.floor(effectiveMax * 0.75) + Math.floor(Math.random() * Math.ceil(effectiveMax * 0.25 + 1)),
      );
      phrasePeaks.push({ bar: Math.min(peakBar, pEnd), peakNn });
    }
  }

  return {
    scale, baseOctave, keySignature, mode: opts.mode,
    timeSig: opts.timeSig, constraints, level,
    nnLow, nnHigh,
    hasBass, phrasePeaks,
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function nnToMidiCtx(nn: number, ctx: MelodyGenContext): number {
  return nnToMidi(nn, ctx.scale, ctx.baseOctave, ctx.keySignature);
}

function isInRange(nn: number, ctx: MelodyGenContext): boolean {
  return nn >= ctx.nnLow && nn <= ctx.nnHigh;
}

function clampNN(nn: number, ctx: MelodyGenContext): number {
  return Math.max(ctx.nnLow, Math.min(ctx.nnHigh, nn));
}

// ────────────────────────────────────────────────────────────────
// Consonance checks
// ────────────────────────────────────────────────────────────────

function pitchClassInterval(trebleMidi: number, bassMidi: number): number {
  return ((trebleMidi - bassMidi) % 12 + 12) % 12;
}

function isConsonant(trebleMidi: number, bassMidi: number): boolean {
  const pc = pitchClassInterval(trebleMidi, bassMidi);
  return !DISSONANT_PC.has(pc);
}

function isImperfectConsonant(trebleMidi: number, bassMidi: number): boolean {
  const pc = pitchClassInterval(trebleMidi, bassMidi);
  return IMPERFECT_CONSONANT_PC.has(pc);
}

// ────────────────────────────────────────────────────────────────
// Bass analysis: build sounding MIDI map per bar
// ────────────────────────────────────────────────────────────────

/**
 * For each bar, builds a map: 16th-note position -> sounding bass MIDI.
 * This accounts for sustained notes spanning multiple 16th positions.
 */
function buildBassSoundingMap(
  bassNotes: ScoreNote[],
  barCount: number,
  sixteenthsPerBar: number,
  keySignature: string,
): Map<number, number>[] {
  const maps: Map<number, number>[] = [];
  let noteIdx = 0;

  for (let bar = 0; bar < barCount; bar++) {
    const map = new Map<number, number>();
    let pos = 0;

    while (pos < sixteenthsPerBar && noteIdx < bassNotes.length) {
      const bn = bassNotes[noteIdx];
      const dur = durationToSixteenths(bn.duration);
      const midi = bn.pitch !== 'rest' ? noteToMidiWithKey(bn, keySignature) : -1;

      // Fill all 16th positions this note occupies within the current bar
      const endPos = Math.min(pos + dur, sixteenthsPerBar);
      for (let p = pos; p < endPos; p++) {
        if (midi >= 0) map.set(p, midi);
      }

      pos += dur;
      noteIdx++;

      // If we've filled the bar, move to next
      if (pos >= sixteenthsPerBar) break;
    }

    maps.push(map);
  }

  return maps;
}

// ────────────────────────────────────────────────────────────────
// Rhythm helpers (1성부 scoreGenerator와 동일한 박·셋잇단 조건)
// ────────────────────────────────────────────────────────────────

/** 16분음표 단위 박 길이 — generateScore treble와 동일 */
function trebleBeatSizeSixteenths(timeSig: string): number {
  const [topStr, botStr] = timeSig.split('/');
  const top = parseInt(topStr, 10);
  const bot = parseInt(botStr, 10);
  if (bot === 8 && top % 3 === 0 && top >= 6) return 6;
  if (bot === 8 && (top === 5 || top === 7)) return Math.ceil(top / 2) * 2;
  if (bot === 4 && (top === 5 || top === 7)) return Math.ceil(top / 2) * 4;
  if (bot === 8) return 4;
  return 16 / (bot || 4);
}

function lastNonRestMelody(notes: ScoreNote[]): ScoreNote | null {
  for (let k = notes.length - 1; k >= 0; k--) {
    if (notes[k].pitch !== 'rest') return notes[k];
  }
  return null;
}

function samePitchHeightForTie(
  a: ScoreNote,
  pitch: PitchName,
  octave: number,
  accidental: Accidental,
): boolean {
  return a.pitch === pitch && a.octave === octave && (a.accidental || '') === (accidental || '');
}

// ────────────────────────────────────────────────────────────────
// Pitch selection
// ────────────────────────────────────────────────────────────────

/**
 * Find consonant pitch candidates for a strong beat.
 * Prefers imperfect consonance (3rd, 6th), falls back to perfect consonance.
 */
function selectConsonantPitch(
  bassMidi: number,
  prevNN: number,
  chordDegree: number,
  ctx: MelodyGenContext,
): number {
  const tones = CHORD_TONES[((chordDegree % 7) + 7) % 7] || [0, 2, 4];

  // Build candidate NNs from chord tones in multiple octaves
  const candidates: { nn: number; midi: number; score: number }[] = [];

  for (const tone of tones) {
    // Check several octave transpositions
    for (let octOff = -2; octOff <= 2; octOff++) {
      const nn = tone + octOff * 7;
      if (!isInRange(nn, ctx)) continue;
      const midi = nnToMidiCtx(nn, ctx);
      if (midi <= bassMidi) continue; // treble must be above bass

      const imperfect = isImperfectConsonant(midi, bassMidi);
      const consonant = isConsonant(midi, bassMidi);
      if (!consonant) continue;

      // Scoring: prefer imperfect consonance, closer to previous pitch, in middle range
      const stepDist = Math.abs(nn - prevNN);
      let score = 0;
      score += imperfect ? 20 : 5;                          // prefer imperfect consonance
      score -= stepDist * 2;                                 // prefer proximity to prev
      score -= Math.abs(nn) * 0.5;                           // prefer central range

      candidates.push({ nn, midi, score });
    }
  }

  if (candidates.length === 0) {
    // Fallback: try all scale degrees
    for (let nn = ctx.nnLow; nn <= ctx.nnHigh; nn++) {
      const midi = nnToMidiCtx(nn, ctx);
      if (midi <= bassMidi) continue;
      if (isConsonant(midi, bassMidi)) {
        candidates.push({ nn, midi, score: -Math.abs(nn - prevNN) });
      }
    }
  }

  if (candidates.length === 0) {
    // Last resort: try shifting prevNN ±1~4 to find consonance
    for (const shift of [1, -1, 2, -2, 3, -3, 4, -4]) {
      const cnn = prevNN + shift;
      if (!isInRange(cnn, ctx)) continue;
      const cMidi = nnToMidiCtx(cnn, ctx);
      if (cMidi <= bassMidi) continue;
      if (isConsonant(cMidi, bassMidi)) {
        candidates.push({ nn: cnn, midi: cMidi, score: -Math.abs(shift) });
        break;
      }
    }
    if (candidates.length === 0) return prevNN;
  }

  // Sort by score descending, pick from top candidates with some randomness
  candidates.sort((a, b) => b.score - a.score);
  const topN = Math.min(3, candidates.length);
  return candidates[Math.floor(Math.random() * topN)].nn;
}

/**
 * 1성부 약박 화음톤 스냅과 유사: 현재 nn을 마디 화음(근·3·5) 중 가까운 음으로.
 */
function snapNnTowardChordTones(
  nn: number,
  prevNN: number,
  chordDegree: number,
  ctx: MelodyGenContext,
): number {
  const tones = CHORD_TONES[((chordDegree % 7) + 7) % 7] || [0, 2, 4];
  let best = nn;
  let bestAdj = Infinity;
  const block = Math.floor(nn / 7);
  for (const t of tones) {
    for (const base of [block * 7 + t, (block - 1) * 7 + t, (block + 1) * 7 + t]) {
      if (!isInRange(base, ctx)) continue;
      const d = Math.abs(base - nn);
      const repeats = base === prevNN ? 4.5 : 0;
      const interval = nn - prevNN;
      const stepTo = base - nn;
      const goesBack = interval !== 0 && Math.sign(stepTo) !== Math.sign(interval) ? 2 : 0;
      const adj = d + repeats + goesBack;
      if (adj < bestAdj) {
        bestAdj = adj;
        best = base;
      }
    }
  }
  return clampNN(best, ctx);
}

/**
 * 약박: scoreGenerator와 같이 stepwiseProb·min(maxLeap,maxInterval) 도약 후 약박 화음 스냅.
 */
function selectWeakBeatPitch(
  bassMidi: number,
  prevNN: number,
  ctx: MelodyGenContext,
  stepwiseCount: number,
  totalCount: number,
  chordDegree: number,
): number {
  const currentRatio = totalCount > 0 ? stepwiseCount / totalCount : 1;
  const needMoreSteps = currentRatio < ctx.constraints.stepwiseRatio;
  const shouldStep = needMoreSteps || Math.random() < ctx.constraints.stepwiseRatio;

  let nn: number;

  if (shouldStep) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    nn = prevNN + dir;
    if (!isInRange(nn, ctx)) nn = prevNN - dir;
    if (!isInRange(nn, ctx)) nn = prevNN;
  } else {
    const cap = Math.min(ctx.constraints.maxLeap, ctx.constraints.maxInterval);
    const leapOptions: number[] = [];
    for (let l = 2; l <= cap; l++) {
      leapOptions.push(l, -l);
    }
    if (leapOptions.length > 0) {
      nn = prevNN + leapOptions[Math.floor(Math.random() * leapOptions.length)];
    } else {
      nn = prevNN + (Math.random() < 0.5 ? 1 : -1);
    }
    nn = clampNN(nn, ctx);
    const semiDist = Math.abs(nnToMidiCtx(nn, ctx) - nnToMidiCtx(prevNN, ctx));
    const nnDist = Math.abs(nn - prevNN);
    if (isForbiddenMelodicInterval(semiDist, nnDist)) {
      nn = prevNN + (nn > prevNN ? -1 : 1);
      nn = clampNN(nn, ctx);
    }
  }

  const rangeSpan = ctx.nnHigh - ctx.nnLow;
  const rangeFactor = rangeSpan <= 8 ? 0.6 : 1.0;
  const snapChance = ctx.constraints.chordSnapWeak * rangeFactor;
  if (Math.random() < snapChance) {
    nn = snapNnTowardChordTones(nn, prevNN, chordDegree, ctx);
  }

  return nn;
}

// ────────────────────────────────────────────────────────────────
// 1-voice pitch selection (no bass constraint)
// ────────────────────────────────────────────────────────────────

/**
 * 1성부 모드: 베이스 없이 순수 interval 기반 음 선택.
 * scoreGenerator.ts의 인라인 로직을 함수로 추출.
 */
function selectPitchWithoutBass(
  prevNN: number,
  ctx: MelodyGenContext,
  prevDir: number,
  prevInterval: number,
  consecutiveSameDir: number,
  chordDegree: number,
  barPos: number,
  beatSize: number,
): number {
  let interval: number;

  // 음역 경계 우선
  if (prevNN >= ctx.nnHigh) {
    interval = rand([-1, -2]);
  } else if (prevNN <= ctx.nnLow) {
    interval = rand([1, 2]);
  } else if (Math.abs(prevInterval) >= 3) {
    // 도약 후 반대방향 순차진행
    if (ctx.level >= 7) {
      interval = prevDir > 0 ? rand([-1, -2]) : rand([1, 2]);
    } else {
      interval = prevDir > 0 ? -1 : 1;
    }
  } else if (consecutiveSameDir >= 3 && prevDir !== 0) {
    // 윤곽 다양성: 같은 방향 3회 연속 후 반대 방향 강제
    interval = prevDir > 0 ? rand([-1, -2]) : rand([1, 2]);
  } else if (Math.random() < ctx.constraints.stepwiseRatio) {
    interval = rand([1, -1]);
  } else {
    const maxLeap = ctx.constraints.maxLeap;
    const leapOptions: number[] = [];
    for (let l = 2; l <= Math.min(maxLeap, ctx.constraints.maxInterval); l++) {
      leapOptions.push(l, -l);
    }
    interval = leapOptions.length > 0 ? rand(leapOptions) : rand([1, -1]);
  }

  let nn = prevNN + interval;
  nn = clampNN(nn, ctx);

  // 화음톤 스냅
  const isDownbeat = barPos % beatSize === 0;
  const rangeFactor = (ctx.nnHigh - ctx.nnLow) <= 8 ? 0.6 : 1.0;
  const oddMeterFactor = /^[57]\/8$/.test(ctx.timeSig) ? 0.55 : 1.0;
  const snapChance = (isDownbeat
    ? ctx.constraints.chordSnapStrong
    : ctx.constraints.chordSnapWeak) * rangeFactor;
  if (Math.random() < snapChance) {
    nn = snapNnTowardChordTones(nn, prevNN, chordDegree, ctx);
    nn = clampNN(nn, ctx);
  }

  return nn;
}


// ────────────────────────────────────────────────────────────────
// 1-voice tendency resolution (lvl 4+)
// ────────────────────────────────────────────────────────────────

function applyTendencyResolution(
  nn: number, prevNn: number, isCadenceContext: boolean,
): number {
  const prevDeg = ((prevNn % 7) + 7) % 7;
  if (prevDeg === 6) {
    const target = prevNn + 1;
    if (isCadenceContext || Math.random() < 0.85) return target;
  }
  if (prevDeg === 3) {
    if (Math.random() < 0.60) return prevNn - 1;
  }
  return nn;
}

// ────────────────────────────────────────────────────────────────
// 1-voice phrase peak enforcement (lvl 4+)
// ────────────────────────────────────────────────────────────────

function enforcePeakNote(
  nn: number, bar: number, barPos: number,
  peak: { bar: number; peakNn: number },
): number {
  const atPeak = bar === peak.bar && barPos === 0;
  if (atPeak) {
    return Math.max(nn, peak.peakNn);
  }
  if (nn >= peak.peakNn) {
    return peak.peakNn - 1 - Math.floor(Math.random() * 2);
  }
  return nn;
}

// ────────────────────────────────────────────────────────────────
// 1-voice triad chain validation (lvl 7+)
// ────────────────────────────────────────────────────────────────

function isTriadSubset(degrees: number[]): boolean {
  const triads = [
    [0, 2, 4], [1, 3, 5], [2, 4, 6],
    [0, 3, 5], [1, 4, 6], [0, 2, 5], [1, 3, 6],
  ];
  const degSet = new Set(degrees.map(d => ((d % 7) + 7) % 7));
  return triads.some(t => {
    const ts = new Set(t);
    for (const d of degSet) {
      if (!ts.has(d)) return false;
    }
    return true;
  });
}

function checkConsecutiveLeapTriad(
  nn: number, prevNn: number, interval: number,
  leapNotes: number[],
): { nn: number; isTriadChain: boolean; leapNotes: number[] } {
  const isLeap = Math.abs(interval) >= 2;
  if (!isLeap) {
    return { nn, isTriadChain: false, leapNotes: [nn] };
  }
  const newLeap = leapNotes.length === 0 ? [prevNn, nn] : [...leapNotes, nn];
  if (newLeap.length >= 3) {
    if (isTriadSubset(newLeap)) {
      return { nn, isTriadChain: true, leapNotes: newLeap };
    }
    const step = interval > 0 ? 1 : -1;
    return { nn: prevNn + step, isTriadChain: false, leapNotes: [prevNn + step] };
  }
  return { nn, isTriadChain: false, leapNotes: newLeap };
}

// ────────────────────────────────────────────────────────────────
// Harmonic minor special handling
// ────────────────────────────────────────────────────────────────

/**
 * Check if moving from nnFrom to nnTo creates an augmented 2nd
 * (scale degree 5 -> 6 or 6 -> 5 in harmonic minor).
 */
function isAugmentedSecondMelody(nnFrom: number, nnTo: number): boolean {
  const degFrom = ((nnFrom % 7) + 7) % 7;
  const degTo = ((nnTo % 7) + 7) % 7;
  if (degFrom === 5 && degTo === 6 && nnTo > nnFrom) return true;
  if (degFrom === 6 && degTo === 5 && nnTo < nnFrom) return true;
  return false;
}

/**
 * In harmonic minor, raised 7th (#7) should resolve to tonic.
 * Returns true if the nn is scale degree 6 (0-indexed = the 7th degree).
 */
function isRaisedSeventh(nn: number): boolean {
  return ((nn % 7) + 7) % 7 === 6;
}

// ────────────────────────────────────────────────────────────────
// NoteNum -> ScoreNote conversion
// ────────────────────────────────────────────────────────────────

function nnToScoreNote(
  nn: number,
  dur: NoteDuration,
  ctx: MelodyGenContext,
  accidental: Accidental = '',
  tie: boolean = false,
): ScoreNote {
  const { pitch, octave } = noteNumToNote(nn, ctx.scale, ctx.baseOctave);

  // Determine accidental from key signature
  let acc = accidental;
  if (!acc) {
    const keySigAlt = getKeySigAlteration(ctx.keySignature, pitch);
    // For harmonic minor raised 7th, we may need explicit accidental
    if (ctx.mode === 'harmonic_minor' && isRaisedSeventh(nn)) {
      // The raised 7th needs a sharp/natural depending on the key
      // The scale already encodes this in the key signature handling
      // but we might need an explicit accidental if the key sig doesn't include it
      acc = '' as Accidental; // let the engraving engine handle via key sig
    }
  }

  return makeNote(pitch, octave, dur, acc, tie);
}

// ────────────────────────────────────────────────────────────────
// Post-processing: gap-fill, consecutive same pitch, etc.
// ────────────────────────────────────────────────────────────────

/**
 * Apply gap-fill rule: after a leap of 4th or larger,
 * the next note should move by step in the opposite direction.
 */
function applyGapFill(
  melodyNNs: number[],
  ctx: MelodyGenContext,
): void {
  for (let i = 1; i < melodyNNs.length - 1; i++) {
    const prev = melodyNNs[i - 1];
    const curr = melodyNNs[i];
    const leapSize = Math.abs(curr - prev);

    if (leapSize >= 3) { // 4th or larger (3 scale degrees = 4th)
      const leapDir = curr > prev ? 1 : -1;
      const next = melodyNNs[i + 1];
      const nextDir = next > curr ? 1 : -1;

      // If next continues in same direction as leap, correct it
      if (nextDir === leapDir && Math.abs(next - curr) > 1) {
        const corrected = curr - leapDir; // step in opposite direction
        if (isInRange(corrected, ctx)) {
          melodyNNs[i + 1] = corrected;
        }
      }
    }
  }
}

/**
 * Ensure no more than 2 consecutive same pitches.
 */
function limitConsecutiveSame(melodyNNs: number[], ctx: MelodyGenContext): void {
  for (let i = 2; i < melodyNNs.length; i++) {
    if (melodyNNs[i] === melodyNNs[i - 1] && melodyNNs[i] === melodyNNs[i - 2]) {
      // Move by step
      const dir = Math.random() < 0.5 ? 1 : -1;
      const nn = melodyNNs[i] + dir;
      melodyNNs[i] = isInRange(nn, ctx) ? nn : melodyNNs[i] - dir;
    }
  }
}

/**
 * In harmonic minor, ensure raised 7th (#7) resolves to tonic.
 */
function resolveLeadingTones(melodyNNs: number[], ctx: MelodyGenContext): void {
  if (ctx.mode !== 'harmonic_minor') return;
  for (let i = 0; i < melodyNNs.length - 1; i++) {
    if (isRaisedSeventh(melodyNNs[i])) {
      const nextDeg = ((melodyNNs[i + 1] % 7) + 7) % 7;
      if (nextDeg !== 0) {
        // Force resolution to tonic (one step up)
        const octBlock = Math.floor(melodyNNs[i] / 7);
        melodyNNs[i + 1] = (octBlock + 1) * 7; // tonic
        if (!isInRange(melodyNNs[i + 1], ctx)) {
          melodyNNs[i + 1] = octBlock * 7; // tonic below
        }
      }
    }
  }
}

/**
 * Avoid augmented 2nd in harmonic minor (degree 5 -> 6).
 */
function avoidAugmentedSeconds(melodyNNs: number[], ctx: MelodyGenContext): void {
  if (ctx.mode !== 'harmonic_minor') return;
  for (let i = 0; i < melodyNNs.length - 1; i++) {
    if (isAugmentedSecondMelody(melodyNNs[i], melodyNNs[i + 1])) {
      // Skip over the problematic interval: use degree 4 or 0 instead
      const curr = melodyNNs[i];
      const currDeg = ((curr % 7) + 7) % 7;
      if (currDeg === 5) {
        // Going up from degree 5 to 6 is aug2nd; go to degree 4 instead (step down)
        melodyNNs[i + 1] = curr - 1;
      } else if (currDeg === 6) {
        // Going down from degree 6 to 5; go to degree 0 (tonic) instead
        const octBlock = Math.floor(curr / 7);
        melodyNNs[i + 1] = (octBlock + 1) * 7;
      }
      if (!isInRange(melodyNNs[i + 1], ctx)) {
        melodyNNs[i + 1] = clampNN(melodyNNs[i + 1], ctx);
      }
    }
  }
}

/**
 * Validate forbidden melodic intervals and fix them.
 */
function fixForbiddenIntervals(melodyNNs: number[], ctx: MelodyGenContext): void {
  for (let i = 0; i < melodyNNs.length - 1; i++) {
    const nn1 = melodyNNs[i];
    const nn2 = melodyNNs[i + 1];
    const semiDist = Math.abs(nnToMidiCtx(nn1, ctx) - nnToMidiCtx(nn2, ctx));
    const nnDist = Math.abs(nn1 - nn2);

    if (isForbiddenMelodicInterval(semiDist, nnDist)) {
      // Adjust by moving the second note one step closer
      const dir = nn2 > nn1 ? -1 : 1;
      melodyNNs[i + 1] = nn2 + dir;
      if (!isInRange(melodyNNs[i + 1], ctx)) {
        melodyNNs[i + 1] = clampNN(melodyNNs[i + 1], ctx);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Main generation function
// ────────────────────────────────────────────────────────────────

interface BarRhythmCell {
  dur16: number;
  /** 한 리듬 칸: 단일 음 또는 셋잇단 3음 */
  nns: number[];
}

/** @deprecated Use generateMelody instead */
export const generateTwoVoiceMelody = generateMelody;

export function generateMelody(opts: MelodyGeneratorOptions): ScoreNote[] {
  const ctx = buildContext(opts);
  const { timeSig, measures, melodyLevel, progression } = opts;
  const bassNotes = opts.bassNotes ?? [];

  const sixteenthsPerBar = getSixteenthsPerBar(timeSig);
  const barCount = measures - 1; // exclude cadence bar
  const strong16 = strongBeatOffsetsSixteenths0(timeSig);

  const bassMaps = ctx.hasBass
    ? buildBassSoundingMap(bassNotes, barCount, sixteenthsPerBar, ctx.keySignature)
    : null;

  const allNotes: ScoreNote[] = [];

  const pool = opts.partPracticeLevel
    ? getDurationPoolForPartPractice(opts.partPracticeLevel)
    : getDurationPoolForMelodyLevel(melodyLevel);
  const rhythmParams = opts.partPracticeLevel
    ? getRhythmParamsForPartPractice(opts.partPracticeLevel)
    : getTrebleRhythmParamsForMelodyLevel(melodyLevel);
  let tripletBudget = rhythmParams.tripletBudget[0] +
    Math.floor(
      Math.random() * (rhythmParams.tripletBudget[1] - rhythmParams.tripletBudget[0] + 1),
    );
  let lastTrebleDur: number | undefined;
  const beatSize = trebleBeatSizeSixteenths(timeSig);
  const tieProbEff = rhythmParams.tieProb * (/^[57]\/8$/.test(timeSig) ? 0.5 : 1.0);
  const oddMeterFactor = /^[57]\/8$/.test(timeSig) ? 0.55 : 1.0;

  // ── 특성 요소 최소 2마디, 최대 3마디 보장 ──
  const MIN_CHAR_BARS = 2;
  const MAX_CHAR_BARS = 3;
  type CharType = 'dur' | 'tie' | 'syncopation' | 'triplet' | 'none';
  let charType: CharType = 'none';
  let charDur16 = 0;
  if (opts.partPracticeLevel) {
    switch (opts.partPracticeLevel) {
      case 2: charType = 'dur'; charDur16 = 2; break;  // 8분
      case 3: charType = 'dur'; charDur16 = 6; break;  // 점4분
      case 4: charType = 'syncopation'; break;          // 당김음
      case 5: charType = 'tie'; break;                  // 붙임줄
      case 6: charType = 'dur'; charDur16 = 1; break;  // 16분
      case 7: charType = 'dur'; charDur16 = 3; break;  // 점8분
      case 8: charType = 'triplet'; break;              // 셋잇단
    }
  } else {
    switch (melodyLevel) {
      case 2: charType = 'dur'; charDur16 = 2; break;  // 8분
      case 3: charType = 'dur'; charDur16 = 6; break;  // 점4분
      case 4: charType = 'syncopation'; break;          // 당김음
      case 5: charType = 'tie'; break;                  // 붙임줄
      case 6: charType = 'dur'; charDur16 = 1; break;  // 16분
      case 7: charType = 'dur'; charDur16 = 3; break;  // 점8분
      case 8: charType = 'triplet'; break;              // 셋잇단
    }
  }
  let charBarCount = 0;

  let prevNN = 0;
  let stepwiseCount = 0;
  let totalMoves = 0;
  let isFirstNote = true;

  // ── 1성부 전용 상태 ──
  let prevDir = 0;
  let prevInterval = 0;
  let consecutiveSameDir = 0;
  let prevFinalNn = -1;
  let consecutiveSame = 0;
  let consecutiveLeapNotes: number[] = [];

  const PHRASE_LEN = 4;

  for (let bar = 0; bar < barCount; bar++) {
    const bassMap = bassMaps ? (bassMaps[bar] || new Map<number, number>()) : new Map<number, number>();
    const bassStartMidi = ctx.hasBass
      ? (() => {
          const a = bassMap.get(0);
          if (a !== undefined) return a;
          for (const v of bassMap.values()) return v;
          return 48;
        })()
      : 0;
    const chordDegree = ctx.hasBass
      ? inferChordDegreeFromBassMidi(bassStartMidi, ctx.scale, ctx.keySignature, progression[bar] ?? 0)
      : ((progression[bar] ?? 0) % 7 + 7) % 7;

    // 중급3(lvl6) 이상: 마디당 최대 음표 수 제한으로 과밀 방지
    // 4/4(16) → 7개, 3/4(12) → 5개, 6/8(12) → 5개, 비례 계산
    const maxNotesForBar = melodyLevel >= 6
      ? Math.max(4, Math.floor(sixteenthsPerBar * 0.44))
      : undefined;

    // ── 특성 요소 강제/억제 판단 ──
    const barsRemaining = barCount - bar; // 현재 마디 포함
    const charsNeeded = MIN_CHAR_BARS - charBarCount;
    const mustForce = charType !== 'none' && charsNeeded > 0 && charsNeeded >= barsRemaining;
    const mustSuppress = charType !== 'none' && charBarCount >= MAX_CHAR_BARS;

    // 강제 시 확률 부스트 & 풀 가중치 조정, 억제 시 확률 0
    let effectivePool = pool;
    let effectiveSyncProb = rhythmParams.syncopationProb;
    let effectiveDottedProb = rhythmParams.dottedProb;

    if (mustSuppress) {
      if (charType === 'dur') {
        effectivePool = pool.filter(d => d !== charDur16);
        if (effectivePool.length === 0) effectivePool = pool;
        if (charDur16 === 6 || charDur16 === 3) effectiveDottedProb = 0;
      } else if (charType === 'syncopation') {
        effectiveSyncProb = 0;
      }
    } else if (mustForce) {
      if (charType === 'dur') {
        effectivePool = [...pool, charDur16, charDur16, charDur16, charDur16];
        if (charDur16 === 6 || charDur16 === 3) {
          effectiveDottedProb = Math.max(rhythmParams.dottedProb, 0.95);
        }
      }
      // syncopation/tie: 후처리에서 mustForce로 보장하므로 fillRhythm 부스트 불필요
    }

    let rhythm = fillRhythm(sixteenthsPerBar, effectivePool, {
      timeSignature: timeSig,
      lastDur: lastTrebleDur,
      syncopationProb: effectiveSyncProb,
      dottedProb: effectiveDottedProb,
      allowTies: melodyLevel >= 5,
      maxNotes: maxNotesForBar,
    });

    // 강제 모드에서 duration 기반 요소가 아직 없으면 재시도
    if (mustForce && charType === 'dur' && !rhythm.includes(charDur16)) {
      for (let retry = 0; retry < 10; retry++) {
        rhythm = fillRhythm(sixteenthsPerBar, effectivePool, {
          timeSignature: timeSig,
          lastDur: lastTrebleDur,
          syncopationProb: effectiveSyncProb,
          dottedProb: 1.0,
          allowTies: melodyLevel >= 5,
          maxNotes: maxNotesForBar,
        });
        if (rhythm.includes(charDur16)) break;
      }
    }

    if (rhythm.length > 0) {
      lastTrebleDur = rhythm[rhythm.length - 1];
    }

    // ── 이 마디에 특성 요소가 있는지 추적 ──
    let barHasChar = false;
    if (charType === 'dur') {
      barHasChar = rhythm.includes(charDur16);
    }
    // syncopation은 후처리에서 패턴 A/B로 생성하므로 여기서는 감지하지 않음

    const barCells: BarRhythmCell[] = [];
    let barPos = 0;

    for (let i = 0; i < rhythm.length; i++) {
      const dur = rhythm[i];
      const bassMidi = ctx.hasBass ? (bassMap.get(barPos) ?? bassMap.get(0) ?? 48) : 0;
      const isStrongBeat = strong16.has(barPos);

      let nn: number;

      if (isFirstNote) {
        // 시작: 으뜸3화음 위주
        const startCandidates = [0, 2, 4, 5, 7].filter(n => n >= ctx.nnLow && n <= ctx.nnHigh);
        nn = startCandidates.length > 0 ? rand(startCandidates) : 0;
        if (ctx.hasBass && !isConsonant(nnToMidiCtx(nn, ctx), bassMidi)) {
          nn = selectConsonantPitch(bassMidi, 0, chordDegree, ctx);
        }
      } else if (bar === barCount - 1 && i === rhythm.length - 1) {
        // 마지막 음: approach note
        const approachCandidates = [1, -1, 6];
        let bestApproach = 1;
        let bestDist = Infinity;
        for (const c of approachCandidates) {
          for (let octOff = -1; octOff <= 1; octOff++) {
            const cnn = c + octOff * 7;
            if (!isInRange(cnn, ctx)) continue;
            if (ctx.hasBass && !isConsonant(nnToMidiCtx(cnn, ctx), bassMidi)) continue;
            const dist = Math.abs(cnn - prevNN);
            if (dist < bestDist) {
              bestDist = dist;
              bestApproach = cnn;
            }
          }
        }
        nn = bestApproach;
      } else if (ctx.hasBass) {
        // ── 2성부 모드: 베이스 협화 기반 ──
        if (isStrongBeat) {
          nn = selectConsonantPitch(bassMidi, prevNN, chordDegree, ctx);
          const oddWeak = timeSig === '9/8' || timeSig === '12/8' ? 0.92 : 1;
          if (Math.random() < ctx.constraints.chordSnapStrong * 0.35 * oddWeak) {
            nn = snapNnTowardChordTones(nn, prevNN, chordDegree, ctx);
            if (!isConsonant(nnToMidiCtx(nn, ctx), bassMidi)) {
              nn = selectConsonantPitch(bassMidi, prevNN, chordDegree, ctx);
            }
          }
        } else {
          nn = selectWeakBeatPitch(bassMidi, prevNN, ctx, stepwiseCount, totalMoves, chordDegree);
        }
      } else {
        // ── 1성부 모드: interval 기반 ──
        nn = selectPitchWithoutBass(prevNN, ctx, prevDir, prevInterval, consecutiveSameDir, chordDegree, barPos, beatSize);

        // 금지 음정 보정
        const semiDist = Math.abs(nnToMidiCtx(nn, ctx) - nnToMidiCtx(prevNN, ctx));
        const nnDist = Math.abs(nn - prevNN);
        if (isForbiddenMelodicInterval(semiDist, nnDist)) {
          const dir = nn > prevNN ? 1 : -1;
          nn = prevNN + dir;
          nn = clampNN(nn, ctx);
        }

        // 트라이어드 체인 검증 (lvl 7+)
        if (ctx.level >= 7) {
          const leapResult = checkConsecutiveLeapTriad(nn, prevNN, nn - prevNN, consecutiveLeapNotes);
          nn = leapResult.nn;
          consecutiveLeapNotes = leapResult.leapNotes;
        } else {
          if (Math.abs(nn - prevNN) >= 2) {
            if (consecutiveLeapNotes.length === 0) consecutiveLeapNotes = [prevNN, nn];
            else consecutiveLeapNotes.push(nn);
          } else {
            consecutiveLeapNotes = [nn];
          }
        }

        // 경향음 해결 (lvl 4+)
        if (ctx.level >= 4) {
          const isCadence = bar === barCount - 2 && i >= rhythm.length - 2;
          nn = applyTendencyResolution(nn, prevNN, isCadence);
          nn = clampNN(nn, ctx);
        }
      }

      if (!isFirstNote) {
        totalMoves++;
        if (Math.abs(nn - prevNN) <= 1) stepwiseCount++;
      } else {
        isFirstNote = false;
      }

      // maxLeap 제한
      let leapSize = Math.abs(nn - prevNN);
      if (leapSize > ctx.constraints.maxLeap) {
        const dir = nn > prevNN ? 1 : -1;
        nn = prevNN + dir * ctx.constraints.maxLeap;
        nn = clampNN(nn, ctx);
        if (ctx.hasBass && isStrongBeat && !isConsonant(nnToMidiCtx(nn, ctx), bassMidi)) {
          for (const shift of [1, -1, 2, -2, 3, -3]) {
            const cand = nn + shift;
            if (!isInRange(cand, ctx)) continue;
            if (Math.abs(cand - prevNN) > ctx.constraints.maxLeap + 1) continue;
            if (isConsonant(nnToMidiCtx(cand, ctx), bassMidi)) { nn = cand; break; }
          }
        }
      }

      // ── 정점 강제 (lvl 4+) ──
      if (ctx.phrasePeaks.length > 0 && !isFirstNote) {
        const phraseIdx = Math.min(Math.floor(bar / PHRASE_LEN), ctx.phrasePeaks.length - 1);
        nn = enforcePeakNote(nn, bar, barPos, ctx.phrasePeaks[phraseIdx]);
        nn = clampNN(nn, ctx);
      }

      // ── 연속 반복음 방지 ──
      if (!isFirstNote) {
        if (nn === prevFinalNn) {
          consecutiveSame++;
          if (consecutiveSame >= 1) {
            const nudge = prevDir > 0 ? -1 : 1;
            nn = clampNN(nn + nudge, ctx);
            if (nn === prevFinalNn) {
              nn = clampNN(nn - nudge * 2, ctx);
            }
            consecutiveSame = 0;
          }
        } else {
          consecutiveSame = 0;
        }
        prevFinalNn = nn;

        // 방향 추적
        const newDir = nn > prevNN ? 1 : nn < prevNN ? -1 : 0;
        prevInterval = nn - prevNN;
        if (newDir !== 0 && newDir === prevDir) consecutiveSameDir++;
        else if (newDir !== 0) consecutiveSameDir = 1;
        prevDir = newDir !== 0 ? newDir : prevDir;
        if (nn >= ctx.nnHigh) prevDir = -1;
        if (nn <= ctx.nnLow) prevDir = 1;
      }

      // 셋잇단 (charType=triplet 시 마디당 1개 제한 → budget 분배)
      const forceTriplet = mustForce && charType === 'triplet' && !barHasChar;
      const suppressTriplet = mustSuppress && charType === 'triplet';
      const barTripletLimit = charType === 'triplet' && barHasChar; // 이미 이 마디에 셋잇단 있음
      const useTriplet =
        !suppressTriplet &&
        !barTripletLimit &&
        !(bar === 0 && barPos === 0) &&
        tripletBudget > 0 &&
        dur === 4 &&
        melodyLevel >= 8 &&
        barPos % (beatSize * 2) === 0 &&
        (forceTriplet || Math.random() < rhythmParams.tripletProb);

      if (useTriplet) {
        const tripNNs = generateTripletNotes(nn, prevNN, ctx);
        barCells.push({ dur16: 4, nns: [...tripNNs] });
        tripletBudget--;
        if (charType === 'triplet') barHasChar = true;
        prevNN = tripNNs[2];
        prevFinalNn = tripNNs[2];
        for (let t = 0; t < 2; t++) {
          totalMoves++;
          if (Math.abs(tripNNs[t + 1] - tripNNs[t]) <= 1) stepwiseCount++;
        }
      } else {
        barCells.push({ dur16: dur, nns: [nn] });
        prevNN = nn;
      }

      barPos += dur;
    }

    // ── 마디별 후처리 ──
    const flatBar = barCells.flatMap(c => c.nns);
    if (flatBar.length > 1) {
      limitConsecutiveSame(flatBar, ctx);
      if (ctx.mode === 'harmonic_minor') {
        avoidAugmentedSeconds(flatBar, ctx);
      }
      fixForbiddenIntervals(flatBar, ctx);
      let w = 0;
      for (const cell of barCells) {
        for (let j = 0; j < cell.nns.length; j++) {
          cell.nns[j] = flatBar[w++];
        }
      }
    }

    // ── ScoreNote 변환 ──
    let cellIdx = 0;
    let emitBarPos = 0;
    for (const cell of barCells) {
      const durLabel = SIXTEENTHS_TO_DUR[cell.dur16] || '4';

      if (cell.nns.length === 3) {
        const spanDur = '4' as NoteDuration;
        const spanSixteenths = durationToSixteenths(spanDur); // 4
        const tnd = getTupletNoteDuration('3', spanDur);       // 2 (written eighth)
        const innerDur = sixteenthsToDuration(tnd);
        const first = nnToScoreNote(cell.nns[0], innerDur, ctx);
        first.tuplet = '3';
        first.tupletSpan = spanDur;
        first.tupletNoteDur = tnd;
        const rem = spanSixteenths - tnd;              // 2
        const perRem = Math.floor(rem / 2);            // 1
        const second = nnToScoreNote(cell.nns[1], innerDur, ctx);
        second.tupletNoteDur = perRem;
        const third = nnToScoreNote(cell.nns[2], innerDur, ctx);
        third.tupletNoteDur = rem - perRem;
        allNotes.push(first);
        allNotes.push(second);
        allNotes.push(third);
      } else {
        const nn = cell.nns[0];
        const { pitch, octave } = noteNumToNote(nn, ctx.scale, ctx.baseOctave);

        // 타이 삽입
        const prevMel = lastNonRestMelody(allNotes);
        const forceTie = mustForce && charType === 'tie' && !barHasChar;
        const suppressTie = mustSuppress && charType === 'tie';
        if (
          !suppressTie &&
          prevMel &&
          samePitchHeightForTie(prevMel, pitch, octave, '' as Accidental) &&
          (forceTie || Math.random() < tieProbEff) &&
          cellIdx > 0 &&
          cellIdx < barCells.length - 1 &&
          emitBarPos > 0
        ) {
          prevMel.tie = true;
          if (charType === 'tie') barHasChar = true;
        }
        allNotes.push(nnToScoreNote(nn, durLabel, ctx));
      }
      emitBarPos += cell.dur16;
      cellIdx++;
    }

    // ── 당김음: 강박 8분쉼표(A) 또는 약박→강박 타이(B) 패턴 ──
    const SYNC_PROB = 0.45; // 당김음 후처리 확률 (fillRhythm 대신 직접 생성)
    if (charType === 'syncopation' && !barHasChar && !mustSuppress &&
        (mustForce || Math.random() < SYNC_PROB)) {
      const barNoteCount = barCells.reduce((s, c) => s + (c.nns.length === 3 ? 3 : 1), 0);
      const barStartIdx = allNotes.length - barNoteCount;
      // 마디 내 음표 위치 매핑
      type NoteWithPos = { idx: number; pos: number; dur16: number };
      const barNotePositions: NoteWithPos[] = [];
      let nPos = 0;
      for (let si = barStartIdx; si < allNotes.length; si++) {
        const n = allNotes[si];
        const d16 = n.tupletNoteDur ?? durationToSixteenths(n.duration);
        barNotePositions.push({ idx: si, pos: nPos, dur16: d16 });
        nPos += d16;
      }
      // 패턴 A 후보: 강박(beat 2+)에 있는 4분음표(dur=4), 쉼표/셋잇단 제외
      let patternACandidates = barNotePositions.filter(p =>
        p.pos > 0 && p.pos % beatSize === 0 && p.dur16 === 4 &&
        allNotes[p.idx].pitch !== 'rest' && !allNotes[p.idx].tuplet
      );
      // 패턴 B 후보: 약박(강박 직전 halfBeat)에 있는 4분음표(dur=4)
      const halfBeat = Math.max(1, Math.floor(beatSize / 2));
      let patternBCandidates = barNotePositions.filter(p =>
        p.pos > 0 && (p.pos + halfBeat) % beatSize === 0 && p.dur16 === 4 &&
        allNotes[p.idx].pitch !== 'rest' && !allNotes[p.idx].tuplet &&
        p.idx > 0 // 첫 음 제외
      );
      // mustForce fallback: 후보 없으면 pos 0 포함 + 8분음표(dur=2)도 Pattern A 허용
      if (mustForce && patternACandidates.length === 0 && patternBCandidates.length === 0) {
        patternACandidates = barNotePositions.filter(p =>
          p.pos > 0 && p.pos % beatSize === 0 && p.dur16 >= 2 &&
          allNotes[p.idx].pitch !== 'rest' && !allNotes[p.idx].tuplet
        );
        // 여전히 없으면 pos 0도 허용
        if (patternACandidates.length === 0) {
          patternACandidates = barNotePositions.filter(p =>
            p.pos % beatSize === 0 && p.dur16 >= 2 &&
            allNotes[p.idx].pitch !== 'rest' && !allNotes[p.idx].tuplet
          );
        }
      }
      // 패턴 C 후보: 강박에서 시작하는 연속 4분음표 2개 → 8분+4분+8분
      const patternCCandidates: { idx1: number; idx2: number; pos: number }[] = [];
      for (let pi = 0; pi < barNotePositions.length - 1; pi++) {
        const p1 = barNotePositions[pi];
        const p2 = barNotePositions[pi + 1];
        if (p1.pos % beatSize === 0 && p1.dur16 === 4 && p2.dur16 === 4 &&
            allNotes[p1.idx].pitch !== 'rest' && allNotes[p2.idx].pitch !== 'rest' &&
            !allNotes[p1.idx].tuplet && !allNotes[p2.idx].tuplet) {
          patternCCandidates.push({ idx1: p1.idx, idx2: p2.idx, pos: p1.pos });
        }
      }

      const canA = patternACandidates.length > 0;
      const canB = patternBCandidates.length > 0;
      const canC = patternCCandidates.length > 0;
      if (canA || canB || canC) {
        // 가능한 패턴 중 랜덤 선택
        const available: string[] = [];
        if (canA) available.push('A');
        if (canB) available.push('B');
        if (canC) available.push('C');
        const chosen = available[Math.floor(Math.random() * available.length)];

        if (chosen === 'A') {
          // 패턴 A: 강박 음표 → 8분쉼표 + 나머지 (4분→8분쉼표+8분, 8분→8분쉼표)
          const pick = patternACandidates[Math.floor(Math.random() * patternACandidates.length)];
          const orig = allNotes[pick.idx];
          if (pick.dur16 >= 4) {
            allNotes[pick.idx] = makeRest('8' as NoteDuration);
            allNotes.splice(pick.idx + 1, 0, { ...orig, duration: '8' as NoteDuration, tie: false });
          } else {
            allNotes[pick.idx] = makeRest(orig.duration);
          }
          barHasChar = true;
        } else if (chosen === 'B') {
          // 패턴 B: 약박 4분 → 8분 + 8분(타이, 강박으로 넘어감)
          const pick = patternBCandidates[Math.floor(Math.random() * patternBCandidates.length)];
          const orig = allNotes[pick.idx];
          allNotes[pick.idx] = { ...orig, duration: '8' as NoteDuration };
          allNotes.splice(pick.idx + 1, 0, { ...orig, id: uid(), duration: '8' as NoteDuration, tie: false });
          allNotes[pick.idx].tie = true;
          barHasChar = true;
        } else {
          // 패턴 C: 연속 4분 2개 → 8분 + 4분 + 8분 (정박-엇박-정박)
          const pick = patternCCandidates[Math.floor(Math.random() * patternCCandidates.length)];
          const orig1 = allNotes[pick.idx1];
          const orig2 = allNotes[pick.idx2];
          // [4분, 4분] → [8분, 4분, 8분] (총 8 = 2+4+2)
          allNotes[pick.idx1] = { ...orig1, duration: '8' as NoteDuration };
          allNotes[pick.idx2] = { ...orig2, duration: '8' as NoteDuration };
          // 가운데 4분음표 삽입 (첫 음표 피치 사용)
          allNotes.splice(pick.idx1 + 1, 0, { ...orig1, id: uid(), duration: '4' as NoteDuration });
          barHasChar = true;
        }
      }
    }

    // ── 타이: 음표 분할로 생성 (최소 미달 시 항상, 그 외 tieProb 확률) ──
    const tieAlways = charBarCount < MIN_CHAR_BARS; // 최소 2마디 미달이면 항상 시도
    if (charType === 'tie' && !barHasChar && !mustSuppress &&
        (tieAlways || Math.random() < rhythmParams.tieProb)) {
      const barNoteCount = barCells.reduce((s, c) => s + (c.nns.length === 3 ? 3 : 1), 0);
      const barStartIdx = allNotes.length - barNoteCount;
      const barEndIdx = allNotes.length;
      // 분할 가능한 후보: 4분(dur=4) 이상, 쉼표/셋잇단 제외, 첫 음표 제외
      const splitCandidates: number[] = [];
      for (let si = barStartIdx; si < barEndIdx; si++) {
        const n = allNotes[si];
        if (n.pitch === 'rest' || n.tuplet) continue;
        if (si === 0) continue; // 첫 음표는 분할 금지 (답안 초기 상태 오염 방지)
        const dur16 = durationToSixteenths(n.duration);
        if (dur16 >= 4) splitCandidates.push(si);
      }
      if (splitCandidates.length > 0) {
        const pickIdx = splitCandidates[Math.floor(Math.random() * splitCandidates.length)];
        const orig = allNotes[pickIdx];
        const origDur16 = durationToSixteenths(orig.duration);
        // 박 단위 분할: 점4분(6)→4분+8분, 4분(4)→8분+8분
        const firstDur16 = origDur16 === 6 ? 4 : Math.floor(origDur16 / 2);
        const halfDur16 = firstDur16;
        const remainDur16 = origDur16 - firstDur16;
        const halfDurLabel = SIXTEENTHS_TO_DUR[halfDur16];
        const remainDurLabel = SIXTEENTHS_TO_DUR[remainDur16];
        if (halfDurLabel && remainDurLabel) {
          const origTie = orig.tie;
          allNotes[pickIdx] = { ...orig, duration: halfDurLabel, tie: true };
          const secondNote: ScoreNote = {
            ...orig, id: uid(), duration: remainDurLabel, tie: origTie,
          };
          allNotes.splice(pickIdx + 1, 0, secondNote);
          barHasChar = true;
        }
      }
    }

    if (barHasChar) charBarCount++;
  }

  // ── 전체 후처리 ──
  const allPitchedNNs = extractPitchedNNs(allNotes, ctx);
  if (allPitchedNNs.length > 2) {
    applyGapFill(allPitchedNNs, ctx);
    if (ctx.mode === 'harmonic_minor') {
      resolveLeadingTones(allPitchedNNs, ctx);
    }
    fixForbiddenIntervals(allPitchedNNs, ctx);
    writePitchedNNsBack(allNotes, allPitchedNNs, ctx);
  }

  // ── 임시표 삽입 (고급 3단계 · 임시표)에서만 삽입 ──
  const applyAccidentals = opts.partPracticeLevel
    ? opts.partPracticeLevel === 9
    : ctx.level >= 9;
  if (applyAccidentals) {
    const bassMapsForAccidentals = bassMaps ?? [];
    applyMelodyAccidentals(
      allNotes, bassMapsForAccidentals, ctx.keySignature, ctx.mode,
      ctx.level, sixteenthsPerBar, strong16,
    );
  }

  // ── L5(붙임줄) 이상: 점4분(4.)→4분+8분 타이, 2분(2)→4분+4분 타이로 분할 ──
  const splitLevel = opts.partPracticeLevel ?? melodyLevel;
  if (splitLevel >= 5) {
    for (let i = allNotes.length - 1; i >= 0; i--) {
      const n = allNotes[i];
      if (n.pitch === 'rest' || n.tuplet) continue;
      const dur16 = durationToSixteenths(n.duration);
      let firstDur = 0;
      let secondDur = 0;
      if (dur16 === 6) { firstDur = 4; secondDur = 2; }      // 점4분 → 4분+8분
      else if (dur16 === 8) { firstDur = 4; secondDur = 4; }  // 2분 → 4분+4분
      else continue;
      const firstLabel = SIXTEENTHS_TO_DUR[firstDur];
      const secondLabel = SIXTEENTHS_TO_DUR[secondDur];
      if (!firstLabel || !secondLabel) continue;
      const origTie = n.tie;
      allNotes[i] = { ...n, duration: firstLabel, tie: true };
      allNotes.splice(i + 1, 0, { ...n, id: uid(), duration: secondLabel, tie: origTie });
    }
  }

  return allNotes;
}

// ────────────────────────────────────────────────────────────────
// Triplet helper (Level 9)
// ────────────────────────────────────────────────────────────────

function generateTripletNotes(
  startNN: number,
  prevNN: number,
  ctx: MelodyGenContext,
): [number, number, number] {
  // Generate 3 stepwise notes forming a passing figure
  const dir = Math.random() < 0.5 ? 1 : -1;
  const n1 = startNN;
  let n2 = clampNN(n1 + dir, ctx);
  let n3 = clampNN(n2 + dir, ctx);
  // If we can't move stepwise, oscillate
  if (n2 === n1) {
    n2 = clampNN(n1 - dir, ctx);
    n3 = n1;
  }
  return [n1, n2, n3];
}

// ────────────────────────────────────────────────────────────────
// NN extraction / write-back for global post-processing
// ────────────────────────────────────────────────────────────────

function extractPitchedNNs(notes: ScoreNote[], ctx: MelodyGenContext): number[] {
  const nns: number[] = [];
  for (const n of notes) {
    if (n.pitch !== 'rest') {
      // Reverse-compute nn from pitch+octave
      const rootIdx = PITCH_ORDER.indexOf(ctx.scale[0]);
      const pitchIdx = PITCH_ORDER.indexOf(n.pitch);
      const degIdx = ctx.scale.indexOf(n.pitch);
      if (degIdx < 0) {
        nns.push(0); // fallback
        continue;
      }
      const wrap = pitchIdx < rootIdx ? 1 : 0;
      const octOff = n.octave - ctx.baseOctave - wrap;
      nns.push(octOff * 7 + degIdx);
    }
  }
  return nns;
}

function writePitchedNNsBack(
  notes: ScoreNote[],
  nns: number[],
  ctx: MelodyGenContext,
): void {
  let j = 0;
  for (let i = 0; i < notes.length && j < nns.length; i++) {
    if (notes[i].pitch !== 'rest') {
      const { pitch, octave } = noteNumToNote(nns[j], ctx.scale, ctx.baseOctave);
      notes[i].pitch = pitch;
      notes[i].octave = octave;
      j++;
    }
  }
}
