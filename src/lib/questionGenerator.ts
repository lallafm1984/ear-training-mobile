// ─────────────────────────────────────────────────────────────
// 객관식 문제 생성기 (음정 / 화성 / 조성)
// ─────────────────────────────────────────────────────────────

import type {
  ContentCategory,
  ContentDifficulty,
  IntervalDifficulty,
  ChordDifficulty,
  KeyDifficulty,
} from '../types/content';

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

export interface ChoiceQuestion {
  id: string;
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  /** 정답 텍스트 */
  correctAnswer: string;
  /** 보기 목록 (정답 포함, 셔플됨) */
  choices: string[];
  /** ABC notation 형태의 오디오 데이터 (재생용) */
  abcNotation: string;
  /** 문제 설명 텍스트 */
  prompt: string;
}

// ─────────────────────────────────────────────────────────────
// 음정 (Interval) 데이터
// ─────────────────────────────────────────────────────────────

/** 음정 이름 (한국어) */
const INTERVAL_NAMES: Record<number, string> = {
  0: '완전 1도 (P1)',
  1: '단 2도 (m2)',
  2: '장 2도 (M2)',
  3: '단 3도 (m3)',
  4: '장 3도 (M3)',
  5: '완전 4도 (P4)',
  6: '증 4도 / 감 5도 (TT)',
  7: '완전 5도 (P5)',
  8: '단 6도 (m6)',
  9: '장 6도 (M6)',
  10: '단 7도 (m7)',
  11: '장 7도 (M7)',
  12: '완전 8도 (P8)',
};

/** 난이도별 포함 음정 (반음 수 기준) */
const INTERVAL_POOLS: Record<IntervalDifficulty, number[]> = {
  interval_1: [0, 5, 7, 12],              // 완전음정 (1·4·5·8도)
  interval_2: [3, 4, 8, 9],               // 장/단 3도, 6도
  interval_3: [1, 2, 10, 11],             // 장/단 2도, 7도
  interval_4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // 전체 + 증감
};

/** ABC 음이름 배열 (C4 기준 한 옥타브 위까지) */
const ABC_NOTES = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B', 'c'];

function generateIntervalQuestion(difficulty: IntervalDifficulty): ChoiceQuestion {
  const pool = INTERVAL_POOLS[difficulty];
  const interval = pool[Math.floor(Math.random() * pool.length)];

  // 근음: C4 ~ G4 범위 (인덱스 0~7)
  const rootIdx = Math.floor(Math.random() * 7);
  const topIdx = rootIdx + interval;

  const rootNote = ABC_NOTES[Math.min(rootIdx, ABC_NOTES.length - 1)];
  const topNote = topIdx < ABC_NOTES.length
    ? ABC_NOTES[topIdx]
    : ABC_NOTES[topIdx % 13]?.toLowerCase() ?? 'c';

  // ABC notation: 두 음을 순차 재생
  const abc = `X:1\nM:4/4\nL:1/2\nK:C\n${rootNote} ${topNote} |]`;

  const correctAnswer = INTERVAL_NAMES[interval];

  // 오답 보기 생성 (풀 내에서 선택)
  const wrongPool = pool.filter(i => i !== interval);
  const wrongs = shuffle(wrongPool).slice(0, 3).map(i => INTERVAL_NAMES[i]);

  // 보기가 부족하면 전체에서 추가
  while (wrongs.length < 3) {
    const remaining = Object.keys(INTERVAL_NAMES)
      .map(Number)
      .filter(i => i !== interval && !wrongs.includes(INTERVAL_NAMES[i]));
    if (remaining.length === 0) break;
    wrongs.push(INTERVAL_NAMES[remaining[Math.floor(Math.random() * remaining.length)]]);
  }

  return {
    id: generateId(),
    contentType: 'interval',
    difficulty,
    correctAnswer,
    choices: shuffle([correctAnswer, ...wrongs.slice(0, 3)]),
    abcNotation: abc,
    prompt: '두 음을 듣고 음정을 맞추세요.',
  };
}

// ─────────────────────────────────────────────────────────────
// 화성 (Chord) 데이터
// ─────────────────────────────────────────────────────────────

interface ChordTemplate {
  name: string;
  /** 반음 간격 (근음 기준) */
  intervals: number[];
}

const CHORD_TEMPLATES: Record<string, ChordTemplate> = {
  major:    { name: '장 3화음 (Major)',    intervals: [0, 4, 7] },
  minor:    { name: '단 3화음 (minor)',    intervals: [0, 3, 7] },
  aug:      { name: '증 3화음 (Aug)',      intervals: [0, 4, 8] },
  dim:      { name: '감 3화음 (dim)',      intervals: [0, 3, 6] },
  dom7:     { name: '속 7화음 (dom7)',     intervals: [0, 4, 7, 10] },
  maj7:     { name: '장 7화음 (M7)',       intervals: [0, 4, 7, 11] },
  min7:     { name: '단 7화음 (m7)',       intervals: [0, 3, 7, 10] },
  dim7:     { name: '감 7화음 (dim7)',     intervals: [0, 3, 6, 9] },
  maj_inv1: { name: '장 3화음 제1전위',    intervals: [0, 3, 8] },  // 1st inversion
  min_inv1: { name: '단 3화음 제1전위',    intervals: [0, 4, 9] },
};

const CHORD_POOLS: Record<ChordDifficulty, string[]> = {
  chord_1: ['major', 'minor'],
  chord_2: ['major', 'minor', 'aug', 'dim'],
  chord_3: ['major', 'minor', 'dom7', 'maj7', 'min7'],
  chord_4: ['major', 'minor', 'aug', 'dim', 'dom7', 'maj7', 'min7', 'dim7', 'maj_inv1', 'min_inv1'],
};

/** 화음을 ABC notation으로 변환 */
function chordToAbc(rootIdx: number, intervals: number[]): string {
  const allNotes = [
    'C,', '^C,', 'D,', '^D,', 'E,', 'F,', '^F,', 'G,', '^G,', 'A,', '^A,', 'B,',
    'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
    'c', '^c', 'd', '^d', 'e', 'f', '^f', 'g', '^g', 'a', '^a', 'b',
  ];
  const noteStr = intervals
    .map(i => allNotes[Math.min(rootIdx + i, allNotes.length - 1)])
    .join('');
  return `X:1\nM:4/4\nL:1\nK:C\n[${noteStr}] |]`;
}

function generateChordQuestion(difficulty: ChordDifficulty): ChoiceQuestion {
  const pool = CHORD_POOLS[difficulty];
  const chordKey = pool[Math.floor(Math.random() * pool.length)];
  const chord = CHORD_TEMPLATES[chordKey];

  // 근음: C3 ~ A3 (인덱스 12~21 in allNotes, mapped to 0~9)
  const rootIdx = 12 + Math.floor(Math.random() * 8);
  const abc = chordToAbc(rootIdx, chord.intervals);

  const wrongPool = pool.filter(k => k !== chordKey);
  const wrongs = shuffle(wrongPool).slice(0, 3).map(k => CHORD_TEMPLATES[k].name);

  while (wrongs.length < 3) {
    const allKeys = Object.keys(CHORD_TEMPLATES).filter(
      k => k !== chordKey && !wrongs.includes(CHORD_TEMPLATES[k].name)
    );
    if (allKeys.length === 0) break;
    wrongs.push(CHORD_TEMPLATES[allKeys[Math.floor(Math.random() * allKeys.length)]].name);
  }

  return {
    id: generateId(),
    contentType: 'chord',
    difficulty,
    correctAnswer: chord.name,
    choices: shuffle([chord.name, ...wrongs.slice(0, 3)]),
    abcNotation: abc,
    prompt: '화음을 듣고 종류를 맞추세요.',
  };
}

// ─────────────────────────────────────────────────────────────
// 조성 (Key) 데이터
// ─────────────────────────────────────────────────────────────

interface KeyTemplate {
  name: string;
  /** ABC notation 조표 */
  abcKey: string;
  /** 스케일 음표 (상행) */
  scaleNotes: string;
}

const KEY_TEMPLATES: Record<string, KeyTemplate> = {
  // 1단계: C장조 / A단조
  C_major: { name: 'C장조 (C Major)', abcKey: 'C', scaleNotes: 'C D E F | G A B c |]' },
  A_minor: { name: 'A단조 (A minor)', abcKey: 'Am', scaleNotes: 'A, B, C D | E F G A |]' },
  // 2단계: ♯♭ 1~3개
  G_major: { name: 'G장조 (G Major)', abcKey: 'G', scaleNotes: 'G, A, B, C | D E ^F G |]' },
  E_minor: { name: 'E단조 (E minor)', abcKey: 'Em', scaleNotes: 'E, ^F, G, A, | B, C D E |]' },
  F_major: { name: 'F장조 (F Major)', abcKey: 'F', scaleNotes: 'F, G, A, _B, | C D E F |]' },
  D_minor: { name: 'D단조 (D minor)', abcKey: 'Dm', scaleNotes: 'D, E, F, G, | A, _B, ^C D |]' },
  D_major: { name: 'D장조 (D Major)', abcKey: 'D', scaleNotes: 'D, E, ^F, G, | A, B, ^C D |]' },
  B_minor: { name: 'B단조 (B minor)', abcKey: 'Bm', scaleNotes: 'B, ^C D E | ^F G A B |]' },
  Bb_major: { name: 'B♭장조 (B♭ Major)', abcKey: 'Bb', scaleNotes: '_B, C D _E | F G A _B |]' },
  G_minor: { name: 'G단조 (G minor)', abcKey: 'Gm', scaleNotes: 'G, A, _B, C | D _E ^F G |]' },
  A_major: { name: 'A장조 (A Major)', abcKey: 'A', scaleNotes: 'A, B, ^C D | E ^F ^G A |]' },
  Fsh_minor: { name: 'F♯단조 (F♯ minor)', abcKey: 'F#m', scaleNotes: '^F, ^G, A, B, | ^C D ^E ^F |]' },
  Eb_major: { name: 'E♭장조 (E♭ Major)', abcKey: 'Eb', scaleNotes: '_E, F, G, _A, | _B, C D _E |]' },
  C_minor: { name: 'C단조 (C minor)', abcKey: 'Cm', scaleNotes: 'C, D, _E, F, | G, _A, =B, C |]' },
  // 3단계: 추가 조성
  E_major: { name: 'E장조 (E Major)', abcKey: 'E', scaleNotes: 'E, ^F, ^G, A, | B, ^C ^D E |]' },
  Csh_minor: { name: 'C♯단조 (C♯ minor)', abcKey: 'C#m', scaleNotes: '^C, ^D, E, ^F, | ^G, A, ^B, ^C |]' },
  Ab_major: { name: 'A♭장조 (A♭ Major)', abcKey: 'Ab', scaleNotes: '_A, _B, C _D | _E F G _A |]' },
  F_minor: { name: 'F단조 (F minor)', abcKey: 'Fm', scaleNotes: 'F, G, _A, _B, | C _D =E F |]' },
  B_major: { name: 'B장조 (B Major)', abcKey: 'B', scaleNotes: 'B, ^C ^D E | ^F ^G ^A B |]' },
  Gsh_minor: { name: 'G♯단조 (G♯ minor)', abcKey: 'G#m', scaleNotes: '^G, ^A, B, ^C | ^D E ^^F ^G |]' },
  Db_major: { name: 'D♭장조 (D♭ Major)', abcKey: 'Db', scaleNotes: '_D, _E, F, _G, | _A, _B, C _D |]' },
  Bb_minor: { name: 'B♭단조 (B♭ minor)', abcKey: 'Bbm', scaleNotes: '_B, C _D _E | F _G A _B |]' },
  Gb_major: { name: 'G♭장조 (G♭ Major)', abcKey: 'Gb', scaleNotes: '_G, _A, _B, _C | _D _E F _G |]' },
  Eb_minor: { name: 'E♭단조 (E♭ minor)', abcKey: 'Ebm', scaleNotes: '_E, F, _G, _A, | _B, _C D _E |]' },
};

const KEY_POOLS: Record<KeyDifficulty, string[]> = {
  key_1: ['C_major', 'A_minor'],
  key_2: ['C_major', 'A_minor', 'G_major', 'E_minor', 'F_major', 'D_minor', 'D_major', 'B_minor', 'Bb_major', 'G_minor'],
  key_3: Object.keys(KEY_TEMPLATES),
};

function generateKeyQuestion(difficulty: KeyDifficulty): ChoiceQuestion {
  const pool = KEY_POOLS[difficulty];
  const keyId = pool[Math.floor(Math.random() * pool.length)];
  const key = KEY_TEMPLATES[keyId];

  // 간단한 멜로디 (스케일 기반) ABC notation
  const abc = `X:1\nM:4/4\nL:1/4\nK:${key.abcKey}\n${key.scaleNotes}`;

  const wrongPool = pool.filter(k => k !== keyId);
  const wrongs = shuffle(wrongPool).slice(0, 3).map(k => KEY_TEMPLATES[k].name);

  while (wrongs.length < 3) {
    const allKeys = Object.keys(KEY_TEMPLATES).filter(
      k => k !== keyId && !wrongs.includes(KEY_TEMPLATES[k].name)
    );
    if (allKeys.length === 0) break;
    wrongs.push(KEY_TEMPLATES[allKeys[Math.floor(Math.random() * allKeys.length)]].name);
  }

  return {
    id: generateId(),
    contentType: 'key',
    difficulty,
    correctAnswer: key.name,
    choices: shuffle([key.name, ...wrongs.slice(0, 3)]),
    abcNotation: abc,
    prompt: '멜로디를 듣고 조성을 맞추세요.',
  };
}

// ─────────────────────────────────────────────────────────────
// 통합 생성 API
// ─────────────────────────────────────────────────────────────

/**
 * 카테고리 + 난이도에 맞는 객관식 문제 1개 생성
 */
export function generateChoiceQuestion(
  category: ContentCategory,
  difficulty: ContentDifficulty,
): ChoiceQuestion {
  switch (category) {
    case 'interval':
      return generateIntervalQuestion(difficulty as IntervalDifficulty);
    case 'chord':
      return generateChordQuestion(difficulty as ChordDifficulty);
    case 'key':
      return generateKeyQuestion(difficulty as KeyDifficulty);
    default:
      throw new Error(`Choice questions not supported for category: ${category}`);
  }
}

/**
 * 여러 문제를 배치 생성
 */
export function generateChoiceQuestions(
  category: ContentCategory,
  difficulty: ContentDifficulty,
  count: number,
): ChoiceQuestion[] {
  return Array.from({ length: count }, () =>
    generateChoiceQuestion(category, difficulty),
  );
}

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
