import type {
  NoteDuration, Accidental, PitchName,
} from '../../lib';
import type {
  Difficulty, DifficultyCategory, BassDifficulty,
} from '../../lib';

// ── 음표 길이 ──
export const DURATIONS: { value: NoteDuration; label: string }[] = [
  { value: '1', label: '온' },
  { value: '2', label: '2분' },
  { value: '4', label: '4분' },
  { value: '8', label: '8분' },
  { value: '16', label: '16분' },
];

// ── 변화표 ──
export const ACCIDENTALS: { value: Accidental; label: string }[] = [
  { value: '', label: '없음' },
  { value: '#', label: '♯' },
  { value: 'b', label: '♭' },
  { value: 'n', label: '♮' },
];

// ── 음이름 ──
export const PITCHES: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const PITCH_LABELS: Record<string, string> = {
  C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시',
};

export const PITCH_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  C: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  D: { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' },
  E: { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' },
  F: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  G: { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' },
  A: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  B: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
};

// ── 난이도 라벨 ──
export const DIFF_LABELS: Record<Difficulty, string> = {
  beginner_1: '초급 1', beginner_2: '초급 2', beginner_3: '초급 3',
  intermediate_1: '중급 1', intermediate_2: '중급 2', intermediate_3: '중급 3',
  advanced_1: '고급 1', advanced_2: '고급 2', advanced_3: '고급 3',
};

export const DIFF_DESC: Record<Difficulty, string> = {
  beginner_1: '온음표 · 2분음표',
  beginner_2: '4분음표 · 점2분음표 · 쉼표',
  beginner_3: '8분음표 · 8분쉼표',
  intermediate_1: '점4분음표',
  intermediate_2: '붙임줄 · 당김음',
  intermediate_3: '16분음표 · 16분쉼표',
  advanced_1: '점8분음표',
  advanced_2: '임시표 (♯ · ♭ · ♮)',
  advanced_3: '셋잇단음표',
};

export const DIFF_CATEGORY_LABELS: Record<DifficultyCategory, string> = {
  beginner: '초급', intermediate: '중급', advanced: '고급',
};

export const DIFF_CATEGORY_COLORS: Record<DifficultyCategory, { bg: string; text: string; activeBg: string }> = {
  beginner: { bg: '#ecfdf5', text: '#065f46', activeBg: '#10b981' },
  intermediate: { bg: '#fef9c3', text: '#854d0e', activeBg: '#f59e0b' },
  advanced: { bg: '#fee2e2', text: '#991b1b', activeBg: '#ef4444' },
};

export const ALL_DIFFICULTIES: Difficulty[] = [
  'beginner_1', 'beginner_2', 'beginner_3',
  'intermediate_1', 'intermediate_2', 'intermediate_3',
  'advanced_1', 'advanced_2', 'advanced_3',
];

export const ALL_BASS_DIFFICULTIES: BassDifficulty[] = [
  'bass_1', 'bass_2', 'bass_3', 'bass_4',
];

// ── 조성 데이터 (types에서 재공급) ──
export { MAJOR_KEY_SIGNATURES as MAJOR_KEYS, MINOR_KEY_SIGNATURES as MINOR_KEYS, ALL_TIME_SIGNATURES as TIME_SIGNATURES } from '../../types';

export const KEY_ACCIDENTAL: Record<string, string> = {
  'C': '', 'G': '♯', 'D': '♯♯', 'A': '♯♯♯', 'E': '4♯', 'B': '5♯', 'F#': '6♯',
  'F': '♭', 'Bb': '♭♭', 'Eb': '♭♭♭', 'Ab': '4♭', 'Db': '5♭',
  'Am': '', 'Em': '♯', 'Bm': '♯♯', 'F#m': '♯♯♯', 'C#m': '4♯', 'G#m': '5♯',
  'Dm': '♭', 'Gm': '♭♭', 'Cm': '♭♭♭', 'Fm': '4♭', 'Bbm': '5♭', 'Ebm': '6♭',
};

