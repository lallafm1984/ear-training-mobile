// ─────────────────────────────────────────────────────────────
// 객관식 문제 생성기 (음정 / 화성 / 화성 진행 / 조성 / 음계·선법)
// ─────────────────────────────────────────────────────────────

import i18n from '../i18n';
import type {
  ContentCategory,
  ContentDifficulty,
  IntervalDifficulty,
  ChordDifficulty,
  KeyDifficulty,
  ProgressionDifficulty,
  ScaleDifficulty,
} from '../types/content';
import { generateScaleQuestion } from './scaleQuestions';
import { realizeProgression } from './progressionVoicing';

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
  /** 정답 해설 (한두 문장, 현재 언어) */
  explanation: string;
  /**
   * 보기별 비교 청취용 ABC. 정답과 같은 근음·조성·배치로 각 보기를 연주한 소리라서
   * "내가 고른 소리"와 "정답 소리"를 번갈아 들을 수 있다. 키 = 보기 텍스트.
   */
  choiceAbc: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// 음정 (Interval) 데이터
// ─────────────────────────────────────────────────────────────

/** 음정 이름 (한국어) */
const INTERVAL_NAMES: Record<number, string> = {
  0: '완전1도 (P1)',
  1: '단2도 (m2)',
  2: '장2도 (M2)',
  3: '단3도 (m3)',
  4: '장3도 (M3)',
  5: '완전4도 (P4)',
  6: '증4도/감5도 (A4/d5)',
  7: '완전5도 (P5)',
  8: '단6도 (m6)',
  9: '장6도 (M6)',
  10: '단7도 (m7)',
  11: '장7도 (M7)',
  12: '완전8도 (P8)',
};

/** 유사 음정 맵 — 오답 생성 시 우선 배치 */
const SIMILAR_INTERVALS: Record<number, number[]> = {
  0: [1, 2], // P1 ↔ m2, M2
  1: [2, 0], // m2 ↔ M2, P1
  2: [1, 3], // M2 ↔ m2, m3
  3: [4, 2], // m3 ↔ M3, M2
  4: [3, 5], // M3 ↔ m3, P4
  5: [7, 4, 6], // P4 ↔ P5, M3, A4
  6: [5, 7], // A4 ↔ P4, P5
  7: [5, 6, 8], // P5 ↔ P4, A4, m6
  8: [9, 7], // m6 ↔ M6, P5
  9: [8, 10], // M6 ↔ m6, m7
  10: [11, 9], // m7 ↔ M7, M6
  11: [10, 12], // M7 ↔ m7, P8
  12: [11, 10], // P8 ↔ M7, m7
};

/** 난이도별 포함 음정 (반음 수 기준, 누적 풀 — 구별 난이도 순) */
const INTERVAL_POOLS: Record<IntervalDifficulty, number[]> = {
  interval_1: [3, 4, 5, 7, 12], // 기본: m3·M3·P4·P5·P8
  interval_2: [2, 3, 4, 5, 7, 8, 9, 12], // + M2·m6·M6
  interval_3: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12], // + m2·m7·M7
  interval_4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // + P1·A4 (전체)
};

/** 연주 방향 */
type IntervalDirection = 'ascending' | 'descending';

/** 난이도별 연주 방향 */
const DIRECTION_POOLS: Record<IntervalDifficulty, IntervalDirection[]> = {
  interval_1: ['ascending', 'descending'],
  interval_2: ['ascending', 'descending'],
  interval_3: ['ascending', 'descending'],
  interval_4: ['ascending', 'descending'],
};

/** 반음계 음 테이블 (A3 ~ E5) */
const ABC_NOTE_TABLE = [
  'A,',
  '^A,',
  'B,', // A3~B3  (idx 0~2)
  'C',
  '^C',
  'D',
  '^D',
  'E',
  'F',
  '^F',
  'G',
  '^G', // C4~G#4 (idx 3~11)
  'A',
  '^A',
  'B', // A4~B4  (idx 12~14)
  'c',
  '^c',
  'd',
  '^d',
  'e', // C5~E5  (idx 15~19)
];

/** 온음계 근음 인덱스 (C, D, E, F, G, A, B만) */
const DIATONIC_INDICES = [0, 2, 3, 5, 7, 8, 10, 12, 14];

interface RootRange {
  min: number;
  max: number;
}
const ROOT_RANGES: Record<IntervalDifficulty, RootRange> = {
  interval_1: { min: 3, max: 10 }, // C4~G4
  interval_2: { min: 0, max: 12 }, // A3~A4
  interval_3: { min: 0, max: 14 }, // A3~B4
  interval_4: { min: 0, max: 14 }, // A3~B4
};

/** 쉬운 음정 가중치 (기본 1.0) */
const INTERVAL_WEIGHTS: Partial<Record<number, number>> = {
  0: 0.4, // P1 — 동음, 자명함
  12: 0.5, // P8 — 옥타브, 매우 쉬움
};

/** 직전 출제 음정 기록 (연속 중복 방지, 최대 2개) */
const recentIntervals: number[] = [];

/** 가중치 기반 랜덤 선택 */
function weightedPick(pool: number[]): number {
  const weights = pool.map((i) => INTERVAL_WEIGHTS[i] ?? 1.0);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** 연속 중복 방지 + 가중치 적용 음정 선택 */
function pickInterval(pool: number[]): number {
  const available = pool.filter((i) => !recentIntervals.includes(i));
  const picked = weightedPick(available.length >= 2 ? available : pool);
  recentIntervals.push(picked);
  if (recentIntervals.length > 2) recentIntervals.shift();
  return picked;
}

/** 유사 음정 우선 오답 생성 (반음 수 반환) */
function buildWrongIntervals(correct: number, pool: number[]): number[] {
  const wrongs: number[] = [];
  const usedIntervals = new Set<number>([correct]);

  // ① 유사 음정 우선 (풀 내외 무관)
  for (const sim of SIMILAR_INTERVALS[correct] ?? []) {
    if (wrongs.length >= 3) break;
    if (usedIntervals.has(sim)) continue;
    usedIntervals.add(sim);
    wrongs.push(sim);
  }

  // ② 풀 내 나머지
  for (const i of shuffle(pool.filter((i) => !usedIntervals.has(i)))) {
    if (wrongs.length >= 3) break;
    usedIntervals.add(i);
    wrongs.push(i);
  }

  // ③ 전체에서 보충
  if (wrongs.length < 3) {
    const remaining = Object.keys(INTERVAL_NAMES)
      .map(Number)
      .filter((i) => !usedIntervals.has(i));
    for (const i of shuffle(remaining)) {
      if (wrongs.length >= 3) break;
      wrongs.push(i);
    }
  }

  return wrongs.slice(0, 3);
}

/** ABC 음 표기 분해: 임시표 / 음이름 / 옥타브 기호 */
function abcNoteParts(n: string): { acc: string; letter: string; oct: string } {
  const m = /^([\^_=]*)([A-Ga-g])([,']*)$/.exec(n);
  if (!m) return { acc: '', letter: n, oct: '' };
  return { acc: m[1], letter: m[2], oct: m[3] };
}

/**
 * 같은 마디 안에서 abcjs는 임시표를 같은 음이름·옥타브의 뒤 음에 이월한다.
 * 예) `^D z D z` 는 D♯–D♯(동음)으로 연주됨. 두 번째 음이 임시표 없는 같은 음이면 제자리표(=)를 명시한다.
 */
function withExplicitNatural(first: string, second: string): string {
  const a = abcNoteParts(first);
  const b = abcNoteParts(second);
  if (a.letter === b.letter && a.oct === b.oct && a.acc !== '' && b.acc === '') {
    return '=' + second;
  }
  return second;
}

/** 두 음 ABC. 보기 비교용으로 다른 음정을 같은 근음에서 연주할 때 표 범위를 넘으면 근음을 내린다. */
function intervalToAbc(rootIdx: number, interval: number, direction: IntervalDirection): string {
  const maxRoot = ABC_NOTE_TABLE.length - 1 - interval;
  const safeRoot = Math.max(0, Math.min(rootIdx, maxRoot));
  const rootNote = ABC_NOTE_TABLE[safeRoot];
  const topNote = ABC_NOTE_TABLE[safeRoot + interval];
  const [first, second] = direction === 'ascending' ? [rootNote, topNote] : [topNote, rootNote];
  return `X:1\nM:4/4\nL:1/4\nK:C\n${first} z ${withExplicitNatural(first, second)} z |]`;
}

function generateIntervalQuestion(difficulty: IntervalDifficulty): ChoiceQuestion {
  const pool = INTERVAL_POOLS[difficulty];
  const interval = pickInterval(pool);

  // 연주 방향 결정
  const directions = DIRECTION_POOLS[difficulty];
  const direction = directions[Math.floor(Math.random() * directions.length)];

  // 근음 선택: 1~2단계는 온음계만, 3~4단계는 반음계 포함
  const range = ROOT_RANGES[difficulty];
  const maxRoot = Math.min(range.max, ABC_NOTE_TABLE.length - 1 - interval);
  const useDiatonic = difficulty === 'interval_1' || difficulty === 'interval_2';

  let rootIdx: number;
  if (useDiatonic) {
    const candidates = DIATONIC_INDICES.filter((i) => i >= range.min && i <= maxRoot);
    rootIdx = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    rootIdx = range.min + Math.floor(Math.random() * Math.max(1, maxRoot - range.min + 1));
  }

  const abc = intervalToAbc(rootIdx, interval, direction);

  const correctAnswer = i18n.t('content:interval.' + interval);
  const wrongIntervals = buildWrongIntervals(interval, pool);
  const choiceAbc: Record<string, string> = {};
  for (const n of [interval, ...wrongIntervals]) {
    choiceAbc[i18n.t('content:interval.' + n)] = intervalToAbc(rootIdx, n, direction);
  }

  return {
    id: generateId(),
    contentType: 'interval',
    difficulty,
    correctAnswer,
    choices: shuffle([
      correctAnswer,
      ...wrongIntervals.map((n) => i18n.t('content:interval.' + n)),
    ]),
    abcNotation: abc,
    prompt: i18n.t('practice:choice.intervalPrompt'),
    explanation: i18n.t('content:explain.interval.' + interval),
    choiceAbc,
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
  major: { name: '장3화음 (Major)', intervals: [0, 4, 7] },
  minor: { name: '단3화음 (minor)', intervals: [0, 3, 7] },
  aug: { name: '증3화음 (Aug)', intervals: [0, 4, 8] },
  dim: { name: '감3화음 (dim)', intervals: [0, 3, 6] },
  maj7: { name: '장7화음 (M7)', intervals: [0, 4, 7, 11] },
  min7: { name: '단7화음 (m7)', intervals: [0, 3, 7, 10] },
  dom7: { name: '속7화음 (Dom7)', intervals: [0, 4, 7, 10] },
  dim7: { name: '감7화음 (dim7)', intervals: [0, 3, 6, 9] },
  halfdim7: { name: '반감7화음 (m7♭5)', intervals: [0, 3, 6, 10] },
  maj_inv1: { name: '장3화음 제1전위', intervals: [0, 3, 8] },
  min_inv1: { name: '단3화음 제1전위', intervals: [0, 4, 9] },
};

/** 유사 화음 맵 — 오답 우선 배치 */
const SIMILAR_CHORDS: Record<string, string[]> = {
  major: ['minor', 'aug'],
  minor: ['major', 'dim'],
  aug: ['major', 'maj7'],
  dim: ['minor', 'halfdim7'],
  maj7: ['dom7', 'min7'],
  min7: ['dom7', 'halfdim7'],
  dom7: ['maj7', 'min7'],
  dim7: ['halfdim7', 'dim'],
  halfdim7: ['min7', 'dim7'],
  maj_inv1: ['min_inv1', 'major'],
  min_inv1: ['maj_inv1', 'minor'],
};

/** 누적 풀 */
const CHORD_POOLS: Record<ChordDifficulty, string[]> = {
  chord_2: ['major', 'minor', 'aug', 'dim'],
  chord_3: ['major', 'minor', 'aug', 'dim', 'maj7', 'min7', 'dom7'],
  chord_4: ['major', 'minor', 'aug', 'dim', 'maj7', 'min7', 'dom7', 'dim7', 'halfdim7'],
};

/** 제시 방식 */
type ChordPresentation = 'block' | 'arpeggio_up' | 'arpeggio_down';

const CHORD_PRESENTATIONS: Record<ChordDifficulty, ChordPresentation[]> = {
  chord_2: ['block'],
  chord_3: ['block'],
  chord_4: ['block'],
};

/** 배치 */
type ChordVoicing = 'close' | 'open';

const CHORD_VOICINGS: Record<ChordDifficulty, ChordVoicing[]> = {
  chord_2: ['close'],
  chord_3: ['close', 'open'],
  chord_4: ['close', 'open'],
};

/** 개방 배치: 3도음(인덱스 1)을 옥타브 위로 */
function openVoicing(intervals: number[]): number[] {
  if (intervals.length < 3) return intervals;
  return [intervals[0], ...intervals.slice(2), intervals[1] + 12].sort((a, b) => a - b);
}

/** 전체 음 테이블 (C3 ~ B5) */
const CHORD_NOTE_TABLE = [
  'C,',
  '^C,',
  'D,',
  '^D,',
  'E,',
  'F,',
  '^F,',
  'G,',
  '^G,',
  'A,',
  '^A,',
  'B,',
  'C',
  '^C',
  'D',
  '^D',
  'E',
  'F',
  '^F',
  'G',
  '^G',
  'A',
  '^A',
  'B',
  'c',
  '^c',
  'd',
  '^d',
  'e',
  'f',
  '^f',
  'g',
  '^g',
  'a',
  '^a',
  'b',
];

/** 온음계 근음 인덱스 (C4, D4, E4, F4, G4, A4, B4) */
const CHORD_DIATONIC_ROOTS = [12, 14, 16, 17, 19, 21, 23];

/** 근음 범위 */
const CHORD_ROOT_RANGES: Record<ChordDifficulty, { min: number; max: number }> = {
  chord_2: { min: 12, max: 23 }, // C4~B4
  chord_3: { min: 9, max: 21 }, // A3~A4
  chord_4: { min: 9, max: 21 }, // A3~A4
};

/** 직전 출제 화음 기록 (연속 중복 방지) */
const recentChords: string[] = [];

/** 화음 ABC notation 생성 */
function chordToAbc(rootIdx: number, intervals: number[], presentation: ChordPresentation): string {
  const notes = intervals.map(
    (i) => CHORD_NOTE_TABLE[Math.min(rootIdx + i, CHORD_NOTE_TABLE.length - 1)],
  );

  if (presentation === 'block') {
    return `X:1\nM:4/4\nL:1\nK:C\n[${notes.join('')}] |]`;
  }
  const ordered = presentation === 'arpeggio_down' ? [...notes].reverse() : notes;
  return `X:1\nM:4/4\nL:1/4\nK:C\n${ordered.join(' ')} |]`;
}

/** 유사 화음 우선 오답 생성 (화음 키 반환) */
function buildChordWrongKeys(correctKey: string, pool: string[]): string[] {
  const wrongs: string[] = [];
  const used = new Set<string>([correctKey]);

  // ① 유사 화음 우선 (풀 내외 무관)
  for (const sim of SIMILAR_CHORDS[correctKey] ?? []) {
    if (wrongs.length >= 3) break;
    if (used.has(sim)) continue;
    used.add(sim);
    wrongs.push(sim);
  }

  // ② 풀 내 나머지
  for (const k of shuffle(pool.filter((k) => !used.has(k)))) {
    if (wrongs.length >= 3) break;
    used.add(k);
    wrongs.push(k);
  }

  // ③ 전체에서 보충
  if (wrongs.length < 3) {
    for (const k of shuffle(Object.keys(CHORD_TEMPLATES).filter((k) => !used.has(k)))) {
      if (wrongs.length >= 3) break;
      wrongs.push(k);
    }
  }

  return wrongs.slice(0, 3);
}

/** 같은 근음·배치·제시 방식으로 특정 화음을 연주하는 ABC (비교 청취용) */
function chordKeyToAbc(
  chordKey: string,
  rootIdx: number,
  voicing: ChordVoicing,
  presentation: ChordPresentation,
): string {
  const base = CHORD_TEMPLATES[chordKey].intervals;
  const intervals = voicing === 'open' ? openVoicing(base) : base;
  const maxRoot = CHORD_NOTE_TABLE.length - 1 - Math.max(...intervals);
  return chordToAbc(Math.max(0, Math.min(rootIdx, maxRoot)), intervals, presentation);
}

function generateChordQuestion(difficulty: ChordDifficulty): ChoiceQuestion {
  const pool = CHORD_POOLS[difficulty];

  // 연속 중복 방지 선택 (직전 1개는 반드시 제외, 직전 2개까지 가능하면 제외)
  const excludeLast1 = pool.filter((k) => k !== recentChords[recentChords.length - 1]);
  const excludeLast2 = pool.filter((k) => !recentChords.includes(k));
  const pickPool =
    excludeLast2.length >= 2 ? excludeLast2 : excludeLast1.length >= 1 ? excludeLast1 : pool;
  const chordKey = pickPool[Math.floor(Math.random() * pickPool.length)];
  recentChords.push(chordKey);
  if (recentChords.length > 2) recentChords.shift();

  const chord = CHORD_TEMPLATES[chordKey];

  // 제시 방식 결정
  const presentations = CHORD_PRESENTATIONS[difficulty];
  const presentation = presentations[Math.floor(Math.random() * presentations.length)];

  // 배치 결정
  const voicings = CHORD_VOICINGS[difficulty];
  const voicing = voicings[Math.floor(Math.random() * voicings.length)];
  const intervals = voicing === 'open' ? openVoicing(chord.intervals) : chord.intervals;

  // 근음: 1~2단계 온음계, 3~4단계 반음계 포함
  const range = CHORD_ROOT_RANGES[difficulty];
  const maxInterval = Math.max(...intervals);
  const maxRoot = Math.min(range.max, CHORD_NOTE_TABLE.length - 1 - maxInterval);
  const useDiatonic = difficulty === 'chord_2';

  let rootIdx: number;
  if (useDiatonic) {
    const candidates = CHORD_DIATONIC_ROOTS.filter((i) => i >= range.min && i <= maxRoot);
    rootIdx =
      candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : range.min;
  } else {
    rootIdx = range.min + Math.floor(Math.random() * Math.max(1, maxRoot - range.min + 1));
  }

  const abc = chordToAbc(rootIdx, intervals, presentation);
  const correctAnswer = i18n.t('content:chord.' + chordKey);
  const wrongKeys = buildChordWrongKeys(chordKey, pool);
  const choiceAbc: Record<string, string> = {};
  for (const k of [chordKey, ...wrongKeys]) {
    choiceAbc[i18n.t('content:chord.' + k)] = chordKeyToAbc(k, rootIdx, voicing, presentation);
  }

  return {
    id: generateId(),
    contentType: 'chord',
    difficulty,
    correctAnswer,
    choices: shuffle([correctAnswer, ...wrongKeys.map((k) => i18n.t('content:chord.' + k))]),
    abcNotation: abc,
    prompt: i18n.t('practice:choice.chordPrompt'),
    explanation: i18n.t('content:explain.chord.' + chordKey),
    choiceAbc,
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
  A_minor: { name: 'A단조 (A minor)', abcKey: 'Am', scaleNotes: 'A, B, C D | E F ^G A |]' },
  // 2단계: ♯♭ 1~3개
  G_major: { name: 'G장조 (G Major)', abcKey: 'G', scaleNotes: 'G, A, B, C | D E ^F G |]' },
  E_minor: { name: 'E단조 (E minor)', abcKey: 'Em', scaleNotes: 'E, F, G, A, | B, C ^D E |]' },
  F_major: { name: 'F장조 (F Major)', abcKey: 'F', scaleNotes: 'F, G, A, _B, | C D E F |]' },
  D_minor: { name: 'D단조 (D minor)', abcKey: 'Dm', scaleNotes: 'D, E, F, G, | A, _B, ^C D |]' },
  D_major: { name: 'D장조 (D Major)', abcKey: 'D', scaleNotes: 'D, E, ^F, G, | A, B, ^C D |]' },
  B_minor: { name: 'B단조 (B minor)', abcKey: 'Bm', scaleNotes: 'B, C D E | F G ^A B |]' },
  Bb_major: { name: 'B♭장조 (B♭ Major)', abcKey: 'Bb', scaleNotes: '_B, C D _E | F G A _B |]' },
  G_minor: { name: 'G단조 (G minor)', abcKey: 'Gm', scaleNotes: 'G, A, _B, C | D _E ^F G |]' },
  A_major: { name: 'A장조 (A Major)', abcKey: 'A', scaleNotes: 'A, B, ^C D | E ^F ^G A |]' },
  Fsh_minor: {
    name: 'F♯단조 (F♯ minor)',
    abcKey: 'F#m',
    scaleNotes: '^F, ^G, A, B, | ^C D ^E ^F |]',
  },
  Eb_major: {
    name: 'E♭장조 (E♭ Major)',
    abcKey: 'Eb',
    scaleNotes: '_E, F, G, _A, | _B, C D _E |]',
  },
  C_minor: { name: 'C단조 (C minor)', abcKey: 'Cm', scaleNotes: 'C, D, _E, F, | G, _A, =B, C |]' },
  // 3단계: 추가 조성
  E_major: { name: 'E장조 (E Major)', abcKey: 'E', scaleNotes: 'E, ^F, ^G, A, | B, ^C ^D E |]' },
  Csh_minor: {
    name: 'C♯단조 (C♯ minor)',
    abcKey: 'C#m',
    scaleNotes: '^C, ^D, E, ^F, | ^G, A, ^B, ^C |]',
  },
  Ab_major: { name: 'A♭장조 (A♭ Major)', abcKey: 'Ab', scaleNotes: '_A, _B, C _D | _E F G _A |]' },
  F_minor: { name: 'F단조 (F minor)', abcKey: 'Fm', scaleNotes: 'F, G, _A, _B, | C _D =E F |]' },
  B_major: { name: 'B장조 (B Major)', abcKey: 'B', scaleNotes: 'B, ^C ^D E | ^F ^G ^A B |]' },
  Gsh_minor: {
    name: 'G♯단조 (G♯ minor)',
    abcKey: 'G#m',
    scaleNotes: '^G, ^A, B, ^C | ^D E ^^F ^G |]',
  },
  Db_major: {
    name: 'D♭장조 (D♭ Major)',
    abcKey: 'Db',
    scaleNotes: '_D, _E, F, _G, | _A, _B, C _D |]',
  },
  Bb_minor: { name: 'B♭단조 (B♭ minor)', abcKey: 'Bbm', scaleNotes: '_B, C _D _E | F _G =A _B |]' },
  Gb_major: {
    name: 'G♭장조 (G♭ Major)',
    abcKey: 'Gb',
    scaleNotes: '_G, _A, _B, _C | _D _E F _G |]',
  },
  Eb_minor: {
    name: 'E♭단조 (E♭ minor)',
    abcKey: 'Ebm',
    scaleNotes: '_E, F, _G, _A, | _B, _C =D _E |]',
  },
};

const KEY_POOLS: Record<KeyDifficulty, string[]> = {
  key_1: ['C_major', 'A_minor'],
  key_2: [
    'C_major',
    'A_minor',
    'G_major',
    'E_minor',
    'F_major',
    'D_minor',
    'D_major',
    'B_minor',
    'Bb_major',
    'G_minor',
  ],
  key_3: Object.keys(KEY_TEMPLATES),
};

/** scaleNotes 문자열에서 개별 음표 배열 추출 (8음: 토닉~옥타브) */
function parseScale(scaleNotes: string): string[] {
  return scaleNotes
    .replace(/\|\]/g, '')
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((n) => n.length > 0);
}

/**
 * 조성 판별용 멜로디 패턴 10가지
 * s[0]=토닉, s[1]=2도, s[2]=3도, s[3]=4도,
 * s[4]=5도, s[5]=6도, s[6]=7도, s[7]=옥타브
 * 모든 패턴은 M:4/4, L:1/4 기준 2마디(8박)
 */
const KEY_MELODY_PATTERNS: ((s: string[]) => string)[] = [
  // 1. 상행 스케일
  (s) => `${s[0]} ${s[1]} ${s[2]} ${s[3]} | ${s[4]} ${s[5]} ${s[6]} ${s[7]} |]`,
  // 2. 하행 스케일
  (s) => `${s[7]} ${s[6]} ${s[5]} ${s[4]} | ${s[3]} ${s[2]} ${s[1]} ${s[0]} |]`,
  // 3. 아르페지오 왕복 (도 미 솔 도' | 라 파 레 도)
  (s) => `${s[0]} ${s[2]} ${s[4]} ${s[7]} | ${s[5]} ${s[3]} ${s[1]} ${s[0]} |]`,
  // 4. 순차 상행 + 도약 하행 종지 (도 레 미 파 | 솔― 미 도)
  (s) => `${s[0]} ${s[1]} ${s[2]} ${s[3]} | ${s[4]}2 ${s[2]} ${s[0]} |]`,
  // 5. 5도 하행 종지 (솔 파 미 레 | 도― --)
  (s) => `${s[4]} ${s[3]} ${s[2]} ${s[1]} | ${s[0]}2 z2 |]`,
  // 6. 도약+이끔음 강조 (도 미 솔 라 | 솔 미 시 도')
  (s) => `${s[0]} ${s[2]} ${s[4]} ${s[5]} | ${s[4]} ${s[2]} ${s[6]} ${s[7]} |]`,
  // 7. 완전종지 접근형 (도― 파 솔 | 라 시 도'―)
  (s) => `${s[0]}2 ${s[3]} ${s[4]} | ${s[5]} ${s[6]} ${s[7]}2 |]`,
  // 8. 분산화음 하행 (도 솔 미 도' | 솔 미 도―)
  (s) => `${s[0]} ${s[4]} ${s[2]} ${s[7]} | ${s[4]} ${s[2]} ${s[0]}2 |]`,
  // 9. 상행 도약 + 순차 하행 (도 솔 라 시 | 도' 라 파 도)
  (s) => `${s[0]} ${s[4]} ${s[5]} ${s[6]} | ${s[7]} ${s[5]} ${s[3]} ${s[0]} |]`,
  // 10. 동기 반복형 (도 레 미 도 | 미 파 솔―)
  (s) => `${s[0]} ${s[1]} ${s[2]} ${s[0]} | ${s[2]} ${s[3]} ${s[4]}2 |]`,
];

/** 나란한조(관계조) 매핑: 같은 조표를 공유하는 장↔단 */
const RELATIVE_KEYS: Record<string, string> = {
  C_major: 'A_minor',
  A_minor: 'C_major',
  G_major: 'E_minor',
  E_minor: 'G_major',
  F_major: 'D_minor',
  D_minor: 'F_major',
  D_major: 'B_minor',
  B_minor: 'D_major',
  Bb_major: 'G_minor',
  G_minor: 'Bb_major',
  A_major: 'Fsh_minor',
  Fsh_minor: 'A_major',
  Eb_major: 'C_minor',
  C_minor: 'Eb_major',
  E_major: 'Csh_minor',
  Csh_minor: 'E_major',
  Ab_major: 'F_minor',
  F_minor: 'Ab_major',
  B_major: 'Gsh_minor',
  Gsh_minor: 'B_major',
  Db_major: 'Bb_minor',
  Bb_minor: 'Db_major',
  Gb_major: 'Eb_minor',
  Eb_minor: 'Gb_major',
};

/** 직전 출제 조성 기록 (연속 중복 방지) */
const recentKeys: string[] = [];
/** 직전 출제 패턴 기록 (연속 동일 패턴 방지) */
const recentPatterns: number[] = [];

function generateKeyQuestion(difficulty: KeyDifficulty): ChoiceQuestion {
  const pool = KEY_POOLS[difficulty];

  // 연속 중복 방지
  let available: string[];
  if (pool.length <= 3) {
    // 소규모 풀: 3연속 동일 조성 방지
    const last2 = recentKeys.slice(-2);
    const blocked = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
    available = blocked ? pool.filter((k) => k !== blocked) : pool;
  } else {
    // 대규모 풀: 직전 2개 제외
    available = pool.filter((k) => !recentKeys.includes(k));
    if (available.length < 2) available = pool;
  }
  const keyId = available[Math.floor(Math.random() * available.length)];
  recentKeys.push(keyId);
  if (recentKeys.length > 2) recentKeys.shift();

  // 랜덤 멜로디 패턴 선택 (3연속 동일 패턴 방지)
  const last2Pat = recentPatterns.slice(-2);
  const patBlocked = last2Pat.length === 2 && last2Pat[0] === last2Pat[1] ? last2Pat[0] : null;
  const patPool =
    patBlocked !== null
      ? Array.from({ length: KEY_MELODY_PATTERNS.length }, (_, i) => i).filter(
          (i) => i !== patBlocked,
        )
      : Array.from({ length: KEY_MELODY_PATTERNS.length }, (_, i) => i);
  const patternIdx = patPool[Math.floor(Math.random() * patPool.length)];
  recentPatterns.push(patternIdx);
  if (recentPatterns.length > 2) recentPatterns.shift();

  const pattern = KEY_MELODY_PATTERNS[patternIdx];
  // 같은 멜로디 패턴을 다른 조성으로 연주한 소리 (비교 청취용)
  // 청음 시험처럼 기준음 A(라, 440Hz)를 먼저 들려준 뒤 멜로디를 재생한다.
  // A♭이 조표에 있는 조에서는 제자리표(=)로 A 자연음을 명시한다.
  const keyToAbc = (id: string) => {
    const k = KEY_TEMPLATES[id];
    // 조표에서 A가 변화되는 조(B♭단조·B장조·G♯단조 등)는 기준음을 반드시 A♮로 표기
    const refA = keySignatureAlterations(k.abcKey).A !== 0 ? '=A' : 'A';
    return `X:1\nM:4/4\nL:1/4\nK:${k.abcKey}\n"^A"${refA}2 z2 | ${pattern(parseScale(k.scaleNotes))}`;
  };

  const abc = keyToAbc(keyId);

  const correctAnswer = i18n.t('content:key.' + keyId);
  const relativeKeyId = RELATIVE_KEYS[keyId];
  const explanation = i18n.t(
    keyId.endsWith('_major') ? 'content:explain.keyMajor' : 'content:explain.keyMinor',
    {
      name: correctAnswer,
      relative: relativeKeyId ? i18n.t('content:key.' + relativeKeyId) : '',
    },
  );

  // key_1: 2지선다 (장/단조 판별에 집중)
  if (difficulty === 'key_1') {
    const otherKeyId = pool.find((k) => k !== keyId)!;
    return {
      id: generateId(),
      contentType: 'key',
      difficulty,
      correctAnswer,
      choices: shuffle([correctAnswer, i18n.t('content:key.' + otherKeyId)]),
      abcNotation: abc,
      prompt: i18n.t('practice:choice.keyModePrompt'),
      explanation,
      choiceAbc: {
        [correctAnswer]: abc,
        [i18n.t('content:key.' + otherKeyId)]: keyToAbc(otherKeyId),
      },
    };
  }

  // key_2/key_3: 나란한조 우선 오답 생성
  const wrongKeyIds: string[] = [];
  const usedKeys = new Set<string>([keyId]);

  // ① 나란한조를 반드시 첫 번째 오답으로
  if (relativeKeyId && !usedKeys.has(relativeKeyId)) {
    usedKeys.add(relativeKeyId);
    wrongKeyIds.push(relativeKeyId);
  }

  // ② 풀 내 나머지에서 채움
  for (const k of shuffle(pool.filter((k) => !usedKeys.has(k)))) {
    if (wrongKeyIds.length >= 3) break;
    usedKeys.add(k);
    wrongKeyIds.push(k);
  }

  // ③ 풀 외부에서 보충 (풀이 작을 때)
  if (wrongKeyIds.length < 3) {
    const outside = Object.keys(KEY_TEMPLATES).filter((k) => !usedKeys.has(k));
    for (const k of shuffle(outside)) {
      if (wrongKeyIds.length >= 3) break;
      wrongKeyIds.push(k);
    }
  }

  const wrongs = wrongKeyIds.slice(0, 3);
  const choiceAbc: Record<string, string> = {};
  for (const k of [keyId, ...wrongs]) {
    choiceAbc[i18n.t('content:key.' + k)] = keyToAbc(k);
  }

  return {
    id: generateId(),
    contentType: 'key',
    difficulty,
    correctAnswer,
    choices: shuffle([correctAnswer, ...wrongs.map((k) => i18n.t('content:key.' + k))]),
    abcNotation: abc,
    prompt: i18n.t('practice:choice.keyPrompt'),
    explanation,
    choiceAbc,
  };
}

// ─────────────────────────────────────────────────────────────
// 화성 진행 / 종지 데이터
// ─────────────────────────────────────────────────────────────

type ProgressionKind = 'progression' | 'cadence';
type ProgressionMode = 'major' | 'minor';

interface ProgressionTemplate {
  id: string;
  answerKey: string;
  kind: ProgressionKind;
  roman: string[];
  mode: ProgressionMode;
  similar: string[];
}

interface ProgressionKey {
  abcKey: string;
  tonicMidi: number;
}

const MAJOR_PROGRESSION_KEYS: ProgressionKey[] = [
  { abcKey: 'C', tonicMidi: 60 },
  { abcKey: 'G', tonicMidi: 55 },
  { abcKey: 'F', tonicMidi: 53 },
  { abcKey: 'D', tonicMidi: 50 },
  { abcKey: 'Bb', tonicMidi: 58 },
];

const MINOR_PROGRESSION_KEYS: ProgressionKey[] = [
  { abcKey: 'Am', tonicMidi: 57 },
  { abcKey: 'Dm', tonicMidi: 50 },
  { abcKey: 'Em', tonicMidi: 52 },
];

const PROGRESSION_TEMPLATES: ProgressionTemplate[] = [
  {
    id: 'basic_i_v_i',
    answerKey: 'I-V-I',
    kind: 'progression',
    roman: ['I', 'V', 'I'],
    mode: 'major',
    similar: ['I-IV-I', 'IV-V-I', 'I-ii-V'],
  },
  {
    id: 'basic_i_iv_i',
    answerKey: 'I-IV-I',
    kind: 'progression',
    roman: ['I', 'IV', 'I'],
    mode: 'major',
    similar: ['I-V-I', 'IV-V-I', 'vi-IV-V'],
  },
  {
    id: 'basic_i_iv_v_i',
    answerKey: 'I-IV-V-I',
    kind: 'progression',
    roman: ['I', 'IV', 'V', 'I'],
    mode: 'major',
    similar: ['I-vi-IV-V', 'I-vi-ii-V', 'I-IV-ii-V'],
  },
  {
    id: 'basic_i_vi_iv_v',
    answerKey: 'I-vi-IV-V',
    kind: 'progression',
    roman: ['I', 'vi', 'IV', 'V'],
    mode: 'major',
    similar: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-ii-V'],
  },
  {
    id: 'practical_ii_v_i',
    answerKey: 'ii-V-I',
    kind: 'progression',
    roman: ['ii', 'V', 'I'],
    mode: 'major',
    similar: ['IV-V-I', 'I-ii-V', 'vi-IV-V'],
  },
  {
    id: 'practical_iv_v_i',
    answerKey: 'IV-V-I',
    kind: 'progression',
    roman: ['IV', 'V', 'I'],
    mode: 'major',
    similar: ['ii-V-I', 'I-ii-V', 'I-IV-I'],
  },
  {
    id: 'practical_i_ii_v',
    answerKey: 'I-ii-V',
    kind: 'progression',
    roman: ['I', 'ii', 'V'],
    mode: 'major',
    similar: ['ii-V-I', 'IV-V-I', 'I-V-I'],
  },
  {
    id: 'practical_vi_iv_v',
    answerKey: 'vi-IV-V',
    kind: 'progression',
    roman: ['vi', 'IV', 'V'],
    mode: 'major',
    similar: ['I-ii-V', 'IV-V-I', 'I-IV-I'],
  },
  {
    id: 'practical_i_vi_ii_v',
    answerKey: 'I-vi-ii-V',
    kind: 'progression',
    roman: ['I', 'vi', 'ii', 'V'],
    mode: 'major',
    similar: ['I-vi-IV-V', 'I-IV-ii-V', 'I-V-vi-IV'],
  },
  {
    id: 'practical_i_v_vi_iv',
    answerKey: 'I-V-vi-IV',
    kind: 'progression',
    roman: ['I', 'V', 'vi', 'IV'],
    mode: 'major',
    similar: ['I-vi-IV-V', 'I-IV-V-I', 'I-vi-ii-V'],
  },
  {
    id: 'practical_i_iv_ii_v',
    answerKey: 'I-IV-ii-V',
    kind: 'progression',
    roman: ['I', 'IV', 'ii', 'V'],
    mode: 'major',
    similar: ['I-vi-ii-V', 'I-IV-V-I', 'I-V-vi-IV'],
  },
  {
    id: 'minor_i_iv_v_i',
    answerKey: 'i-iv-V-i',
    kind: 'progression',
    roman: ['i', 'iv', 'V', 'i'],
    mode: 'minor',
    similar: ['i-VI-iv-V', 'ii-V-I', 'I-IV-V-I'],
  },
  {
    id: 'minor_i_vi_iv_v',
    answerKey: 'i-VI-iv-V',
    kind: 'progression',
    roman: ['i', 'VI', 'iv', 'V'],
    mode: 'minor',
    similar: ['i-iv-V-i', 'I-vi-IV-V', 'I-V-vi-IV'],
  },
];

const CADENCE_TEMPLATES: ProgressionTemplate[] = [
  {
    id: 'cadence_authentic',
    answerKey: 'authentic',
    kind: 'cadence',
    roman: ['V', 'I'],
    mode: 'major',
    similar: ['half', 'plagal', 'deceptive'],
  },
  {
    id: 'cadence_half_i_v',
    answerKey: 'half',
    kind: 'cadence',
    roman: ['I', 'V'],
    mode: 'major',
    similar: ['authentic', 'deceptive', 'plagal'],
  },
  {
    id: 'cadence_half_iv_v',
    answerKey: 'half',
    kind: 'cadence',
    roman: ['IV', 'V'],
    mode: 'major',
    similar: ['authentic', 'deceptive', 'plagal'],
  },
  {
    id: 'cadence_plagal',
    answerKey: 'plagal',
    kind: 'cadence',
    roman: ['IV', 'I'],
    mode: 'major',
    similar: ['authentic', 'half', 'deceptive'],
  },
  {
    id: 'cadence_deceptive',
    answerKey: 'deceptive',
    kind: 'cadence',
    roman: ['V', 'vi'],
    mode: 'major',
    similar: ['authentic', 'half', 'plagal'],
  },
];

const PROGRESSION_POOLS: Record<ProgressionDifficulty, ProgressionTemplate[]> = {
  progression_1: PROGRESSION_TEMPLATES.slice(0, 4),
  progression_2: CADENCE_TEMPLATES,
  progression_3: PROGRESSION_TEMPLATES.slice(4),
  progression_4: [
    ...PROGRESSION_TEMPLATES.slice(2),
    ...CADENCE_TEMPLATES.map((template) => ({
      ...template,
      roman:
        template.answerKey === 'authentic'
          ? ['I', 'IV', 'V', 'I']
          : template.answerKey === 'half'
            ? ['I', 'vi', 'IV', 'V']
            : template.answerKey === 'plagal'
              ? ['I', 'V', 'IV', 'I']
              : ['I', 'IV', 'V', 'vi'],
    })),
  ],
};

const MAJOR_ROMAN_INTERVALS: Record<string, number[]> = {
  I: [0, 4, 7],
  ii: [2, 5, 9],
  IV: [5, 9, 12],
  V: [7, 11, 14],
  vi: [9, 12, 16],
};

const MINOR_ROMAN_INTERVALS: Record<string, number[]> = {
  i: [0, 3, 7],
  iv: [5, 8, 12],
  V: [7, 11, 14],
  VI: [8, 12, 15],
};

const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const ROMAN_DEGREE: Record<string, number> = {
  I: 0,
  i: 0,
  ii: 1,
  II: 1,
  iii: 2,
  III: 2,
  IV: 3,
  iv: 3,
  V: 4,
  v: 4,
  vi: 5,
  VI: 5,
  vii: 6,
  VII: 6,
};

/**
 * ABC 조표(K: 값, 예 'Bb' · 'G#m') → 음이름별 조표 변화량(-1 ♭ / 0 / +1 ♯).
 * 임시표 표기 여부를 조표 기준으로 판단할 때 사용한다.
 */
export function keySignatureAlterations(abcKey: string): Record<string, number> {
  const out: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  const m = abcKey.match(/^([A-G])([#b]?)(m?)$/);
  if (!m) return out;
  const [, letter, acc, minor] = m;
  let pc = LETTER_PC[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
  if (minor) pc += 3; // 나란한조(장조) 기준으로 조표 개수 계산
  pc = ((pc % 12) + 12) % 12;
  const sharpsByPc: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: 7 };
  const flatsByPc: Record<number, number> = { 5: -1, 10: -2, 3: -3, 8: -4, 1: -5, 6: -6, 11: -7 };
  const count =
    acc === 'b' ? (flatsByPc[pc] ?? sharpsByPc[pc] ?? 0) : (sharpsByPc[pc] ?? flatsByPc[pc] ?? 0);
  for (let i = 0; i < count; i++) out[SHARP_ORDER[i]] = 1;
  for (let i = 0; i < -count; i++) out[FLAT_ORDER[i]] = -1;
  return out;
}

/**
 * MIDI + 음이름(letter)으로 ABC 음표를 만든다. 조표와 "마디 안 임시표 상태"를 보고
 * 필요한 경우에만 ♯/♭/♮를 붙인다 (ABC/abcjs는 같은 마디·같은 옥타브의 임시표가 뒤 음에 전달된다).
 * 예전처럼 항상 ♯로 적으면 B♭장조의 E♭이 D♯로 보이고, 같은 마디의 뒤 D가 D♯로 울리는 문제가 있었다.
 */
function spellAbcNote(
  midi: number,
  letter: string,
  keyAlt: Record<string, number>,
  barState: Map<string, number>,
): string {
  const natural = LETTER_PC[letter];
  let alt = (((midi - natural) % 12) + 12) % 12;
  if (alt > 6) alt -= 12;
  const naturalMidi = midi - alt;
  const octave = Math.floor(naturalMidi / 12) - 1;
  const stateKey = `${letter}${octave}`;
  const current = barState.get(stateKey) ?? keyAlt[letter] ?? 0;
  let acc = '';
  if (alt !== current) {
    acc = alt === 0 ? '=' : alt > 0 ? '^'.repeat(alt) : '_'.repeat(-alt);
    barState.set(stateKey, alt);
  }
  const body =
    octave <= 4
      ? `${letter}${','.repeat(4 - octave)}`
      : `${letter.toLowerCase()}${"'".repeat(octave - 5)}`;
  return acc + body;
}

function romanIntervals(roman: string, template: ProgressionTemplate): number[] {
  const intervals =
    template.mode === 'minor' ? MINOR_ROMAN_INTERVALS[roman] : MAJOR_ROMAN_INTERVALS[roman];
  return intervals ?? MAJOR_ROMAN_INTERVALS.I;
}

/**
 * 성부 하나의 MIDI 음을 화음 구성음(근음·3음·5음)의 올바른 음이름으로 ABC 표기한다.
 * 3도 쌓기: 근음 음이름에서 2글자씩 건너뛴 음이름 (조표에 맞는 철자)
 */
function spellChordVoice(
  midi: number,
  intervals: number[],
  degree: number,
  key: ProgressionKey,
  keyAlt: Record<string, number>,
  barState: Map<string, number>,
): string {
  const tonicLetterIdx = LETTER_NAMES.indexOf(key.abcKey[0]);
  const pc = ((midi % 12) + 12) % 12;
  let member = intervals.findIndex((iv) => (((key.tonicMidi + iv) % 12) + 12) % 12 === pc);
  if (member < 0) member = 0;
  const letter = LETTER_NAMES[(tonicLetterIdx + degree + 2 * member) % 7];
  return spellAbcNote(midi, letter, keyAlt, barState);
}

/**
 * 로마숫자 진행 → 4성부 큰보표 ABC (위 보표 S·A, 아래 보표 T·B, 반음표 단위).
 * 성부 배치는 progressionVoicing(병행 5·8도 금지, 이끔음 상행, 정격종지 소프라노 1̂)이 정한다.
 * 마디 나누기: 2개 → 한 마디, 3개 → 2+1(마지막 온음표), 4개 → 2+2
 */
function renderProgressionAbc(template: ProgressionTemplate, key: ProgressionKey): string {
  const keyAlt = keySignatureAlterations(key.abcKey);
  const romans = template.roman;
  const chords = romans.map((roman) => romanIntervals(roman, template));
  const n = romans.length;
  const endsOnTonic = n >= 2 && (ROMAN_DEGREE[romans[n - 1]] ?? 0) === 0;
  const dominantBefore = n >= 2 && (ROMAN_DEGREE[romans[n - 2]] ?? 0) === 4;
  const voiced = realizeProgression({
    chords,
    tonicMidi: key.tonicMidi,
    minor: template.mode === 'minor',
    sopranoEndsOnTonic: endsOnTonic && dominantBefore, // 완전 정격종지(PAC)
  });

  const barGroups: number[][] =
    n <= 2 ? [romans.map((_, i) => i)] : [[0, 1], romans.slice(2).map((_, i) => i + 2)];
  const upper: string[] = [];
  const lower: string[] = [];
  for (const group of barGroups) {
    const upperState = new Map<string, number>();
    const lowerState = new Map<string, number>();
    const dur = group.length === 1 ? '2' : '';
    upper.push(
      group
        .map((i) => {
          const degree = ROMAN_DEGREE[romans[i]] ?? 0;
          const alto = spellChordVoice(voiced[i].alto, chords[i], degree, key, keyAlt, upperState);
          const sop = spellChordVoice(
            voiced[i].soprano,
            chords[i],
            degree,
            key,
            keyAlt,
            upperState,
          );
          return `[${alto}${sop}]${dur}`;
        })
        .join(' '),
    );
    lower.push(
      group
        .map((i) => {
          const degree = ROMAN_DEGREE[romans[i]] ?? 0;
          const bass = spellChordVoice(voiced[i].bass, chords[i], degree, key, keyAlt, lowerState);
          const tenor = spellChordVoice(
            voiced[i].tenor,
            chords[i],
            degree,
            key,
            keyAlt,
            lowerState,
          );
          return `[${bass}${tenor}]${dur}`;
        })
        .join(' '),
    );
  }
  return [
    'X:1',
    'M:4/4',
    'L:1/2',
    `K:${key.abcKey}`,
    'V:V1 clef=treble',
    `${upper.join(' | ')} |]`,
    'V:V2 clef=bass',
    `${lower.join(' | ')} |]`,
  ].join('\n');
}

const recentProgressions: string[] = [];

function pickProgressionTemplate(pool: ProgressionTemplate[]): ProgressionTemplate {
  const available = pool.filter((template) => !recentProgressions.includes(template.id));
  const pickPool = available.length >= 2 ? available : pool;
  const picked = pickPool[Math.floor(Math.random() * pickPool.length)];
  recentProgressions.push(picked.id);
  if (recentProgressions.length > 2) recentProgressions.shift();
  return picked;
}

function pickProgressionKey(mode: ProgressionMode): ProgressionKey {
  const pool = mode === 'minor' ? MINOR_PROGRESSION_KEYS : MAJOR_PROGRESSION_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function progressionAnswerLabel(kind: ProgressionKind, answerKey: string): string {
  const namespace = kind === 'cadence' ? 'cadence' : 'progression';
  return i18n.t(`content:${namespace}.${answerKey}`);
}

function isCompatibleProgressionChoice(
  template: ProgressionTemplate,
  candidate: ProgressionTemplate,
): boolean {
  if (candidate.kind !== template.kind || candidate.answerKey === template.answerKey) {
    return false;
  }
  return template.kind !== 'progression' || candidate.roman.length === template.roman.length;
}

/** 오답 템플릿 생성. 각 오답은 정답과 같은 조성으로 연주할 수 있는 템플릿으로 반환한다. */
function buildProgressionWrongTemplates(
  template: ProgressionTemplate,
  pool: ProgressionTemplate[],
): ProgressionTemplate[] {
  const wrongs: ProgressionTemplate[] = [];
  const usedAnswerKeys = new Set<string>([template.answerKey]);
  const fallbackPool = template.kind === 'cadence' ? CADENCE_TEMPLATES : PROGRESSION_TEMPLATES;
  const answerUniverse = [...pool, ...fallbackPool];
  const sameShapePool = pool.filter((candidate) =>
    isCompatibleProgressionChoice(template, candidate),
  );

  for (const similarKey of template.similar) {
    if (wrongs.length >= 3) break;
    if (usedAnswerKeys.has(similarKey)) continue;
    const candidate = answerUniverse.find(
      (c) => c.answerKey === similarKey && isCompatibleProgressionChoice(template, c),
    );
    if (!candidate) continue;
    usedAnswerKeys.add(similarKey);
    wrongs.push(candidate);
  }

  for (const candidate of shuffle(
    sameShapePool.filter((candidate) => !usedAnswerKeys.has(candidate.answerKey)),
  )) {
    if (wrongs.length >= 3) break;
    usedAnswerKeys.add(candidate.answerKey);
    wrongs.push(candidate);
  }

  for (const candidate of shuffle(
    fallbackPool.filter(
      (candidate) =>
        !usedAnswerKeys.has(candidate.answerKey) &&
        isCompatibleProgressionChoice(template, candidate),
    ),
  )) {
    if (wrongs.length >= 3) break;
    usedAnswerKeys.add(candidate.answerKey);
    wrongs.push(candidate);
  }

  return wrongs.slice(0, 3);
}

/** 오답 템플릿을 정답과 같은 조성으로 연주한다. 장/단 모드가 다르면 같은 으뜸음의 해당 모드로 바꾼다. */
function keyForTemplate(template: ProgressionTemplate, key: ProgressionKey): ProgressionKey {
  const wantsMinor = template.mode === 'minor';
  const isMinorKey = key.abcKey.endsWith('m');
  if (wantsMinor === isMinorKey) return key;
  return wantsMinor
    ? { abcKey: `${key.abcKey}m`, tonicMidi: key.tonicMidi }
    : { abcKey: key.abcKey.slice(0, -1), tonicMidi: key.tonicMidi };
}

function generateProgressionQuestion(difficulty: ProgressionDifficulty): ChoiceQuestion {
  const pool = PROGRESSION_POOLS[difficulty];
  if (!pool) {
    throw new Error(`Invalid progression difficulty: ${difficulty}`);
  }

  const template = pickProgressionTemplate(pool);
  const key = pickProgressionKey(template.mode);
  const correctAnswer = progressionAnswerLabel(template.kind, template.answerKey);
  const wrongTemplates = buildProgressionWrongTemplates(template, pool);
  // 성부 배치에 무작위성이 있으므로 정답 악보는 한 번만 만들어 재생·비교 모두에 쓴다
  const choiceAbc: Record<string, string> = {};
  for (const t of [template, ...wrongTemplates]) {
    choiceAbc[progressionAnswerLabel(t.kind, t.answerKey)] = renderProgressionAbc(
      t,
      keyForTemplate(t, key),
    );
  }
  const abcNotation = choiceAbc[correctAnswer];

  return {
    id: generateId(),
    contentType: 'progression',
    difficulty,
    correctAnswer,
    choices: shuffle([
      correctAnswer,
      ...wrongTemplates.map((t) => progressionAnswerLabel(t.kind, t.answerKey)),
    ]),
    abcNotation,
    prompt:
      template.kind === 'cadence'
        ? i18n.t('practice:choice.cadencePrompt')
        : i18n.t('practice:choice.progressionPrompt'),
    explanation: i18n.t(
      `content:explain.${template.kind === 'cadence' ? 'cadence' : 'progression'}.${template.answerKey}`,
    ),
    choiceAbc,
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
    case 'progression':
      return generateProgressionQuestion(difficulty as ProgressionDifficulty);
    case 'key':
      return generateKeyQuestion(difficulty as KeyDifficulty);
    case 'scale':
      return generateScaleQuestion(difficulty as ScaleDifficulty);
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
  return Array.from({ length: count }, () => generateChoiceQuestion(category, difficulty));
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
