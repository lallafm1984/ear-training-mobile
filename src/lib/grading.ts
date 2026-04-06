import { durationToSixteenths } from './scoreUtils';
import type { ScoreNote, NoteDuration } from './scoreUtils';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface NormalizedNote {
  pitch: string;           // "C4", "F#4", "rest"
  totalDuration: number;   // 16th note units
  sourceIndices: number[]; // original ScoreNote indices
}

export type NoteGradeType = 'correct' | 'partial' | 'wrong' | 'missing' | 'extra';

export interface NoteGrade {
  grade: NoteGradeType;
  answerSourceIndices: number[];
  userSourceIndices: number[];
}

export interface GradingResult {
  grades: NoteGrade[];
  accuracy: number;       // 0.0 ~ 1.0
  selfRating: number;     // 1 ~ 5
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  missingCount: number;
  extraCount: number;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function pitchString(note: ScoreNote): string {
  if (note.pitch === 'rest') return 'rest';
  const acc = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
  return `${note.pitch}${acc}${note.octave}`;
}

// ──────────────────────────────────────────────
// normalizeNotes
// ──────────────────────────────────────────────

export function normalizeNotes(notes: ScoreNote[]): NormalizedNote[] {
  const result: NormalizedNote[] = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const pitch = pitchString(note);
    const dur = durationToSixteenths(note.duration);

    // Check if this note is tied to the previous one (same pitch)
    if (
      note.tie &&
      result.length > 0 &&
      result[result.length - 1].pitch === pitch
    ) {
      // Merge into previous
      const prev = result[result.length - 1];
      prev.totalDuration += dur;
      prev.sourceIndices.push(i);
    } else {
      result.push({
        pitch,
        totalDuration: dur,
        sourceIndices: [i],
      });
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// gradeNotes
// ──────────────────────────────────────────────

export function gradeNotes(
  answerNotes: ScoreNote[],
  userNotes: ScoreNote[],
): GradingResult {
  const answerNorm = normalizeNotes(answerNotes);
  const userNorm = normalizeNotes(userNotes);

  const grades: NoteGrade[] = [];
  const maxLen = Math.max(answerNorm.length, userNorm.length);

  for (let i = 0; i < maxLen; i++) {
    const a = answerNorm[i];
    const u = userNorm[i];

    if (!u) {
      // User is missing this note
      grades.push({
        grade: 'missing',
        answerSourceIndices: a.sourceIndices,
        userSourceIndices: [],
      });
    } else if (!a) {
      // User has extra note
      grades.push({
        grade: 'extra',
        answerSourceIndices: [],
        userSourceIndices: u.sourceIndices,
      });
    } else {
      const pitchMatch = a.pitch === u.pitch;
      const durMatch = a.totalDuration === u.totalDuration;

      let grade: NoteGradeType;
      if (pitchMatch && durMatch) {
        grade = 'correct';
      } else if (pitchMatch || durMatch) {
        grade = 'partial';
      } else {
        grade = 'wrong';
      }

      grades.push({
        grade,
        answerSourceIndices: a.sourceIndices,
        userSourceIndices: u.sourceIndices,
      });
    }
  }

  const correctCount = grades.filter((g) => g.grade === 'correct').length;
  const partialCount = grades.filter((g) => g.grade === 'partial').length;
  const wrongCount = grades.filter((g) => g.grade === 'wrong').length;
  const missingCount = grades.filter((g) => g.grade === 'missing').length;
  const extraCount = grades.filter((g) => g.grade === 'extra').length;

  const accuracy =
    answerNorm.length === 0
      ? 0
      : (correctCount + partialCount * 0.5) / answerNorm.length;

  let selfRating: number;
  if (accuracy >= 0.9) selfRating = 5;
  else if (accuracy >= 0.7) selfRating = 4;
  else if (accuracy >= 0.5) selfRating = 3;
  else if (accuracy >= 0.3) selfRating = 2;
  else selfRating = 1;

  return {
    grades,
    accuracy,
    selfRating,
    correctCount,
    partialCount,
    wrongCount,
    missingCount,
    extraCount,
  };
}
