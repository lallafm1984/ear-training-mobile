import { useState } from 'react';
import type { Difficulty, BassDifficulty } from '../../lib';

export function useGenerationState(initialConfig: { mode: 'partPractice' | 'comprehensive'; level: number }) {
  const [genDifficulty, setGenDifficulty] = useState<Difficulty>('beginner_1');
  const [genBassDifficulty, setGenBassDifficulty] = useState<BassDifficulty>('bass_1');
  const [genMeasures, setGenMeasures] = useState(4);
  const [genTab, setGenTab] = useState<'melody' | 'grand'>('melody');
  const [genPracticeMode, setGenPracticeMode] = useState<'partPractice' | 'comprehensive'>(initialConfig.mode);
  const [genPartLevel, setGenPartLevel] = useState(initialConfig.mode === 'partPractice' ? initialConfig.level : 1);
  const [genCompLevel, setGenCompLevel] = useState(initialConfig.mode === 'comprehensive' ? initialConfig.level : 1);
  const [genHideNotes, setGenHideNotes] = useState(false);

  return {
    genDifficulty, setGenDifficulty,
    genBassDifficulty, setGenBassDifficulty,
    genMeasures, setGenMeasures,
    genTab, setGenTab,
    genPracticeMode, setGenPracticeMode,
    genPartLevel, setGenPartLevel,
    genCompLevel, setGenCompLevel,
    genHideNotes, setGenHideNotes,
  };
}

export type GenerationState = ReturnType<typeof useGenerationState>;
