// ─────────────────────────────────────────────────────────────
// 3분 레벨 테스트 — 문항 생성 (기존 객관식 생성기 + 귀 열기 코스 리듬 카드)
// ─────────────────────────────────────────────────────────────

import { generateChoiceQuestion } from '../questionGenerator';
import { generateBeginnerQuestion } from '../beginnerCourse';
import type { LevelTestStep } from './engine';
import type { ContentCategory, ContentDifficulty } from '../../types/content';
import type { LevelTestArea } from './config';

export interface LevelTestChoice {
  id: string;
  /** 이미 현재 언어로 번역된 라벨 (객관식 생성기) */
  label?: string;
  /** beginner 네임스페이스 i18n 키 (리듬 카드) */
  labelKey?: string;
  glyph?: string;
}

export interface LevelTestQuestion {
  id: string;
  area: LevelTestArea;
  category: ContentCategory;
  difficulty: ContentDifficulty;
  prompt?: string;
  /** beginner 네임스페이스 i18n 키 */
  promptKey?: string;
  abc: string;
  choices: LevelTestChoice[];
  correctId: string;
}

export function buildLevelTestQuestion(step: LevelTestStep): LevelTestQuestion {
  if (step.area === 'rhythm') {
    const q = generateBeginnerQuestion('rhythmPattern');
    return {
      id: q.id,
      area: step.area,
      category: step.category,
      difficulty: step.difficulty,
      promptKey: q.promptKey,
      abc: q.abc,
      choices: q.choices.map((c) => ({ id: c.id, labelKey: c.labelKey, glyph: c.glyph })),
      correctId: q.correctId,
    };
  }

  const q = generateChoiceQuestion(step.category, step.difficulty);
  return {
    id: q.id,
    area: step.area,
    category: step.category,
    difficulty: step.difficulty,
    prompt: q.prompt,
    abc: q.abcNotation,
    choices: q.choices.map((text) => ({ id: text, label: text })),
    correctId: q.correctAnswer,
  };
}
