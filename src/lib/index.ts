// ─────────────────────────────────────────────────────────────
// Lib barrel – 핵심 비즈니스 로직 모듈을 단일 진입점으로 제공
// ─────────────────────────────────────────────────────────────

// Supabase 클라이언트 & DB 타입
export { supabase } from './supabase';
export type { Profile } from './supabase';

// 악보 유틸리티
export * from './scoreUtils';

// 악보 생성 엔진
export {
  generateScore,
  getDifficultyCategory,
  BASS_DIFF_LABELS,
  BASS_DIFF_DESC,
} from './scoreGenerator';
export type {
  Difficulty,
  BassDifficulty,
  DifficultyCategory,
  GeneratorOptions,
  GeneratedScore,
} from './scoreGenerator';

// 멜로디 리듬 레벨
export {
  getDurationPoolForMelodyLevel,
  getTrebleRhythmParamsForMelodyLevel,
  getDurationPoolForPartPractice,
  getRhythmParamsForPartPractice,
} from './melodyRhythmLevel';
export type { TrebleRhythmParams } from './melodyRhythmLevel';

// 트레블 리듬 채우기
export { fillRhythm, variateSixteenthNoteRuns } from './trebleRhythmFill';

// 2성부 생성 모듈
export * from './twoVoice';

// 콘텐츠 카테고리 설정
export * from './contentConfig';

// 객관식 문제 생성기
export { generateChoiceQuestion, generateChoiceQuestions } from './questionGenerator';
export type { ChoiceQuestion } from './questionGenerator';

// 모의시험 프리셋
export { EXAM_PRESETS } from './examPresets';
