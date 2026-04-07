// ────────────────────────────────────────────────────────────────
// scoreUtils barrel — 모든 유틸리티를 단일 진입점으로 제공
// ────────────────────────────────────────────────────────────────

export * from './types';
export {
  durationToSixteenths, SIXTEENTHS_TO_DURATION, SIXTEENTHS_TO_DUR,
  sixteenthsToDuration, getSixteenthsPerBar,
  computeBarLengthsFromTotal, barGlobalStarts, getBarIndexAndLocal,
  getTupletNoteDuration, getTupletActualSixteenths, getValidTupletTypesForDuration,
  getBeamGroupSixteenths, getBeamBreakPoints,
  findExactDuration, sumScoreNotesSixteenths,
} from './duration';
// isCompoundMeter는 twoVoice/meter.ts와 이름 충돌 방지를 위해 barrel에서 제외
// 직접 사용 시 import { isCompoundMeter } from './scoreUtils/duration'
export * from './keySignature';
export * from './midi';
export * from './noteFactory';
export * from './bassUtils';
export * from './harmony';
export * from './abc';
