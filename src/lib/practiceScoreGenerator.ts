// ─────────────────────────────────────────────────────────────
// 기보형 연습 악보 생성 (공유 모듈)
// NotationPracticeScreen, MockExamScreen 등에서 사용
// ─────────────────────────────────────────────────────────────

import { generateScore } from './scoreGenerator';
import type { Difficulty, BassDifficulty } from './scoreGenerator';
import type { ScoreNote } from './scoreUtils/types';
import { generateRhythmDictation } from './rhythmEngine';
import { buildGeneratorOptions } from './trackConfig';
import type { ContentCategory, ContentDifficulty } from '../types/content';

export interface PracticeScore {
  trebleNotes: ScoreNote[];
  bassNotes: ScoreNote[];
  keySignature: string;
  timeSignature: string;
  useGrandStaff: boolean;
  barsPerStaff?: number;
  disableTies?: boolean;
}

export interface PracticeScoreSettings {
  timeSignature?: string;
  keySignature?: string;
  tempo?: number;
  rhythmPitch?: string;
}

export function melodyDifficultyToLevel(difficulty: ContentDifficulty): number {
  const map: Record<string, number> = {
    beginner_1: 1, beginner_2: 2, beginner_3: 3,
    intermediate_1: 4, intermediate_2: 5, intermediate_3: 6,
    advanced_1: 7, advanced_2: 8, advanced_3: 9,
  };
  return map[difficulty] ?? 1;
}

export function rhythmDifficultyToLevel(difficulty: ContentDifficulty): number {
  const map: Record<string, number> = {
    rhythm_1: 1, rhythm_2: 2, rhythm_3: 4,
    rhythm_4: 6, rhythm_5: 8, rhythm_6: 8,
  };
  return map[difficulty] ?? 1;
}

export function generatePracticeScore(
  category: ContentCategory,
  difficulty: ContentDifficulty,
  settings?: PracticeScoreSettings,
): PracticeScore {
  if (category === 'melody') {
    const level = melodyDifficultyToLevel(difficulty);
    const trackOpts = buildGeneratorOptions('partPractice', level);
    const keySignature = settings?.keySignature ?? trackOpts.keySignature;
    const timeSignature = settings?.timeSignature ?? trackOpts.timeSignature;
    const result = generateScore({
      keySignature,
      timeSignature,
      difficulty: trackOpts.difficulty,
      measures: trackOpts.measures,
      useGrandStaff: false,
      practiceMode: 'part',
      partPracticeLevel: level,
    });
    return {
      trebleNotes: result.trebleNotes,
      bassNotes: [],
      keySignature,
      timeSignature,
      useGrandStaff: false,
      barsPerStaff: level <= 2 ? 4 : level >= 4 ? 2 : undefined,
      disableTies: level <= 5,
    };
  }

  if (category === 'rhythm') {
    const levelMatch = difficulty.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    const timeSig = settings?.timeSignature ?? '4/4';
    const rhythmPitch = settings?.rhythmPitch ?? 'B';

    const rhythmNotes = generateRhythmDictation(level, 4, timeSig, rhythmPitch);

    return {
      trebleNotes: rhythmNotes,
      bassNotes: [],
      keySignature: 'C',
      timeSignature: timeSig,
      useGrandStaff: false,
      barsPerStaff: 4,
      disableTies: true,
    };
  }

  // twoVoice
  const diffMap: Record<string, Difficulty> = {
    bass_1: 'beginner_3', bass_2: 'intermediate_1',
    bass_3: 'intermediate_3', bass_4: 'advanced_1',
  };
  const bassDiffMap: Record<string, BassDifficulty> = {
    bass_1: 'bass_1', bass_2: 'bass_2', bass_3: 'bass_3', bass_4: 'bass_4',
  };
  const keySignature = settings?.keySignature ?? 'C';
  const timeSignature = settings?.timeSignature ?? '4/4';
  const result = generateScore({
    keySignature,
    timeSignature,
    difficulty: diffMap[difficulty] ?? 'beginner_3',
    bassDifficulty: bassDiffMap[difficulty] ?? 'bass_1',
    measures: 4,
    useGrandStaff: true,
  });
  return {
    trebleNotes: result.trebleNotes,
    bassNotes: result.bassNotes,
    keySignature,
    timeSignature,
    useGrandStaff: true,
    barsPerStaff: 2,
  };
}
