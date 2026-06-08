import type { ContentCategory } from '../types/content';
import type { ScoreNote } from './scoreUtils';

export function isNotationCategory(category: ContentCategory): boolean {
  return category === 'melody' ||
    category === 'barMelody' ||
    category === 'rhythm' ||
    category === 'twoVoice';
}

export function isMelodyInputCategory(category: ContentCategory): boolean {
  return category === 'melody' ||
    category === 'barMelody' ||
    category === 'twoVoice';
}

export function shouldUseFirstNoteHint(category: ContentCategory): boolean {
  return category === 'melody' || category === 'twoVoice';
}

export function getMelodyAnswerNotesForGrading(
  category: ContentCategory,
  notes: ScoreNote[],
): ScoreNote[] {
  return shouldUseFirstNoteHint(category) ? notes.slice(1) : notes;
}

export function getMelodyUserNotesForGrading(
  category: ContentCategory,
  notes: ScoreNote[],
): ScoreNote[] {
  return shouldUseFirstNoteHint(category) ? notes.slice(1) : notes;
}

export function getMelodyUserSourceIndexOffset(category: ContentCategory): number {
  return shouldUseFirstNoteHint(category) ? 1 : 0;
}
