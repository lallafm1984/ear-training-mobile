// ─────────────────────────────────────────────────────────────
// 음계·선법 듣기 문제 생성 (객관식)
// ─────────────────────────────────────────────────────────────

import i18n from '../i18n';
import type { ScaleDifficulty } from '../types/content';
import type { ChoiceQuestion } from './questionGenerator';

export type ScaleId =
  | 'major'
  | 'natural_minor'
  | 'harmonic_minor'
  | 'melodic_minor'
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'major_pentatonic'
  | 'minor_pentatonic'
  | 'whole_tone'
  | 'blues';

interface ScaleTemplate {
  /** 근음 기준 반음 간격 (상행, 옥타브 포함) */
  steps: number[];
  /** 각 음의 계이름 글자 오프셋 (근음 글자 기준, 7 = 옥타브 위 같은 글자) */
  letters: number[];
}

export const SCALE_TEMPLATES: Record<ScaleId, ScaleTemplate> = {
  major: { steps: [0, 2, 4, 5, 7, 9, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  natural_minor: { steps: [0, 2, 3, 5, 7, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  harmonic_minor: { steps: [0, 2, 3, 5, 7, 8, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  melodic_minor: { steps: [0, 2, 3, 5, 7, 9, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  ionian: { steps: [0, 2, 4, 5, 7, 9, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  dorian: { steps: [0, 2, 3, 5, 7, 9, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  phrygian: { steps: [0, 1, 3, 5, 7, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  lydian: { steps: [0, 2, 4, 6, 7, 9, 11, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  mixolydian: { steps: [0, 2, 4, 5, 7, 9, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  aeolian: { steps: [0, 2, 3, 5, 7, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  locrian: { steps: [0, 1, 3, 5, 6, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
  major_pentatonic: { steps: [0, 2, 4, 7, 9, 12], letters: [0, 1, 2, 4, 5, 7] },
  minor_pentatonic: { steps: [0, 3, 5, 7, 10, 12], letters: [0, 2, 3, 4, 6, 7] },
  whole_tone: { steps: [0, 2, 4, 6, 8, 10, 12], letters: [0, 1, 2, 3, 4, 5, 7] },
  blues: { steps: [0, 3, 5, 6, 7, 10, 12], letters: [0, 2, 3, 4, 4, 6, 7] },
};

export const SCALE_POOLS: Record<ScaleDifficulty, ScaleId[]> = {
  scale_1: ['major', 'natural_minor'],
  scale_2: ['major', 'natural_minor', 'harmonic_minor', 'melodic_minor'],
  scale_3: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
  scale_4: [
    'ionian',
    'dorian',
    'phrygian',
    'lydian',
    'mixolydian',
    'aeolian',
    'locrian',
    'harmonic_minor',
    'melodic_minor',
    'major_pentatonic',
    'minor_pentatonic',
    'whole_tone',
    'blues',
  ],
};

/** 보기 수 (1단계는 장/단 2지선다) */
export const SCALE_CHOICE_COUNT: Record<ScaleDifficulty, number> = {
  scale_1: 2,
  scale_2: 4,
  scale_3: 4,
  scale_4: 4,
};

/** 헷갈리기 쉬운 음계 (오답 보기 우선순위) */
const SIMILAR_SCALES: Record<ScaleId, ScaleId[]> = {
  major: ['lydian', 'mixolydian', 'major_pentatonic', 'melodic_minor'],
  natural_minor: ['dorian', 'phrygian', 'harmonic_minor', 'minor_pentatonic'],
  harmonic_minor: ['natural_minor', 'melodic_minor', 'phrygian', 'aeolian'],
  melodic_minor: ['harmonic_minor', 'major', 'dorian', 'ionian'],
  ionian: ['lydian', 'mixolydian', 'major_pentatonic', 'melodic_minor'],
  dorian: ['aeolian', 'mixolydian', 'minor_pentatonic', 'melodic_minor'],
  phrygian: ['aeolian', 'locrian', 'harmonic_minor', 'dorian'],
  lydian: ['ionian', 'mixolydian', 'whole_tone', 'major_pentatonic'],
  mixolydian: ['ionian', 'dorian', 'lydian', 'major_pentatonic'],
  aeolian: ['dorian', 'phrygian', 'harmonic_minor', 'minor_pentatonic'],
  locrian: ['phrygian', 'aeolian', 'blues', 'whole_tone'],
  major_pentatonic: ['minor_pentatonic', 'ionian', 'mixolydian', 'lydian'],
  minor_pentatonic: ['blues', 'major_pentatonic', 'aeolian', 'dorian'],
  whole_tone: ['lydian', 'major_pentatonic', 'blues', 'locrian'],
  blues: ['minor_pentatonic', 'locrian', 'dorian', 'whole_tone'],
};

// ─────────────────────────────────────────────────────────────
// 근음·기보
// ─────────────────────────────────────────────────────────────

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 근음 MIDI → 글자·임시표 (조표가 적은 쪽으로 철자 선택) */
const ROOT_SPELLINGS: Record<number, { letter: number; acc: number }> = {
  60: { letter: 0, acc: 0 }, // C
  61: { letter: 1, acc: -1 }, // Db
  62: { letter: 1, acc: 0 }, // D
  63: { letter: 2, acc: -1 }, // Eb
  64: { letter: 2, acc: 0 }, // E
  65: { letter: 3, acc: 0 }, // F
  66: { letter: 3, acc: 1 }, // F#
  67: { letter: 4, acc: 0 }, // G
};

/** 1단계는 흰건반 근음만 (깨끗한 기보), 그 외는 C4~G4 전체 */
const ROOT_POOLS: Record<ScaleDifficulty, number[]> = {
  scale_1: [60, 62, 64, 65, 67],
  scale_2: [60, 61, 62, 63, 64, 65, 66, 67],
  scale_3: [60, 61, 62, 63, 64, 65, 66, 67],
  scale_4: [60, 61, 62, 63, 64, 65, 66, 67],
};

function accidentalMark(acc: number): string {
  if (acc >= 2) return '^^';
  if (acc === 1) return '^';
  if (acc === 0) return '=';
  if (acc === -1) return '_';
  return '__';
}

/** 글자 인덱스(근음 기준 누적)와 옥타브 → ABC 음이름 (C4 = C, C5 = c) */
function abcPitchName(letterIdx: number, octave: number): string {
  const name = LETTERS[((letterIdx % 7) + 7) % 7];
  if (octave <= 4) return name + ','.repeat(Math.max(0, 4 - octave));
  return name.toLowerCase() + "'".repeat(Math.max(0, octave - 5));
}

/**
 * 근음 MIDI와 템플릿으로 상행 음계 ABC 본문을 만든다.
 * 임시표는 같은 글자·옥타브에 대해 상태가 바뀔 때만 명시한다(M:none이라 마디 초기화 없음).
 */
export function scaleToAbcBody(rootMidi: number, id: ScaleId): string {
  const root = ROOT_SPELLINGS[rootMidi] ?? ROOT_SPELLINGS[60];
  const tpl = SCALE_TEMPLATES[id];
  const rootOctave = Math.floor(rootMidi / 12) - 1;
  const accState = new Map<string, number>();
  const tokens: string[] = [];

  tpl.steps.forEach((step, i) => {
    const midi = rootMidi + step;
    const absLetter = root.letter + tpl.letters[i];
    const letterName = LETTERS[absLetter % 7];
    const octave = rootOctave + Math.floor(absLetter / 7);
    const naturalMidi = (octave + 1) * 12 + NATURAL_SEMITONE[letterName];
    const acc = midi - naturalMidi;
    const key = `${letterName}${octave}`;
    const current = accState.get(key) ?? 0;
    let mark = '';
    if (acc !== current) {
      mark = accidentalMark(acc);
      accState.set(key, acc);
    }
    const isLast = i === tpl.steps.length - 1;
    tokens.push(`${mark}${abcPitchName(absLetter, octave)}${isLast ? '2' : ''}`);
  });

  return tokens.join(' ');
}

export function scaleToAbc(rootMidi: number, id: ScaleId): string {
  return `X:1\nM:none\nL:1/8\nQ:1/4=100\nK:C\n${scaleToAbcBody(rootMidi, id)} |]`;
}

// ─────────────────────────────────────────────────────────────
// 문제 생성
// ─────────────────────────────────────────────────────────────

const recentScales: ScaleId[] = [];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 정답과 헷갈리는 순서로 오답 보기를 고른다 (풀 안에서만). */
export function buildScaleWrongChoices(
  correct: ScaleId,
  pool: ScaleId[],
  count: number,
): ScaleId[] {
  const candidates = pool.filter((s) => s !== correct);
  const similar = SIMILAR_SCALES[correct].filter((s) => candidates.includes(s));
  const rest = shuffle(candidates.filter((s) => !similar.includes(s)));
  // 유사 음계는 우선하되 약간 섞어 매번 같은 보기가 나오지 않게 한다
  const ordered = [...shuffle(similar.slice(0, count + 1)), ...rest];
  const unique: ScaleId[] = [];
  for (const s of ordered) {
    if (!unique.includes(s)) unique.push(s);
    if (unique.length >= count) break;
  }
  return unique;
}

export function pickScaleId(difficulty: ScaleDifficulty): ScaleId {
  const pool = SCALE_POOLS[difficulty];
  const last = recentScales[recentScales.length - 1];
  const available = pool.length > 1 && last ? pool.filter((s) => s !== last) : pool;
  const id = pick(available);
  recentScales.push(id);
  if (recentScales.length > 2) recentScales.shift();
  return id;
}

export function generateScaleQuestion(difficulty: ScaleDifficulty): ChoiceQuestion {
  const pool = SCALE_POOLS[difficulty];
  const scaleId = pickScaleId(difficulty);
  const rootMidi = pick(ROOT_POOLS[difficulty]);
  const choiceCount = Math.min(SCALE_CHOICE_COUNT[difficulty], pool.length);
  const wrong = buildScaleWrongChoices(scaleId, pool, choiceCount - 1);

  const label = (id: ScaleId) => i18n.t('content:scale.' + id);
  const choiceIds = shuffle([scaleId, ...wrong]);
  const choiceAbc: Record<string, string> = {};
  choiceIds.forEach((id) => {
    choiceAbc[label(id)] = scaleToAbc(rootMidi, id);
  });

  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    contentType: 'scale',
    difficulty,
    correctAnswer: label(scaleId),
    choices: choiceIds.map(label),
    abcNotation: scaleToAbc(rootMidi, scaleId),
    prompt: i18n.t('practice:choice.scalePrompt'),
    explanation: i18n.t('content:explain.scale.' + scaleId),
    choiceAbc,
  };
}
