// ────────────────────────────────────────────────────────────────
// Two-Voice Bass Generator — Module Entry Point
// ────────────────────────────────────────────────────────────────

export type {
  BassLevel,
  TimeSignature,
  ScaleMode,
  BassDirectionPattern,
  TwoVoiceBassOptions,
  BassNote,
  BassPatternDef,
  ValidationResult,
  Violation,
} from './types';

export { generateTwoVoiceBass } from './bassGenerator';
export { validateBass } from './validator';

export {
  validateStrongBeatConsonance,
  detectParallelPerfect,
  detectHiddenPerfect,
  checkContraryMotionRatio,
  validateNonHarmonicTones,
  validateVoiceSpacing,
  validateFinalInterval,
  applyCounterpointCorrections,
} from './counterpoint';

export {
  STRONG_BEAT_MAP,
  BASS_DURATION_MAP,
  MEASURE_TOTAL,
  BASS_RANGE,
  getScaleInfo,
} from './scales';

export { ALL_BASS_PATTERNS, getApplicablePatterns, getPatternById, selectRandomPattern } from './bassPatterns';

// ────────────────────────────────────────────────────────────────
// Generate + Validate + Retry loop
// ────────────────────────────────────────────────────────────────

import type { TwoVoiceBassOptions, BassNote } from './types';
import { generateTwoVoiceBass } from './bassGenerator';
import { validateBass } from './validator';

/**
 * Generate a bass line with automatic validation and retry.
 * Runs up to `maxRetries + 1` attempts, returning the result
 * with the fewest violations if none pass cleanly.
 */
export function generateBassWithRetry(
  opts: TwoVoiceBassOptions,
  maxRetries = 3,
): BassNote[] {
  let bestResult: { bass: BassNote[]; violations: number } | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    const bass = generateTwoVoiceBass(opts);
    const validation = validateBass(opts, bass);

    if (validation.passed) return bass;

    if (!bestResult || validation.violationCount < bestResult.violations) {
      bestResult = { bass, violations: validation.violationCount };
    }
  }

  return bestResult!.bass;
}
