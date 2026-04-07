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
  0: '완전1도 (P1)',
  1: '단2도 (m2)',
  2: '장2도 (M2)',
  3: '단3도 (m3)',
  4: '장3도 (M3)',
  5: '완전4도 (P4)',
  6: '증4도 (A4)',
  7: '완전5도 (P5)',
  8: '단6도 (m6)',
  9: '장6도 (M6)',
  10: '단7도 (m7)',
  11: '장7도 (M7)',
  12: '완전8도 (P8)',
};

/** 유사 음정 맵 — 오답 생성 시 우선 배치 */
const SIMILAR_INTERVALS: Record<number, number[]> = {
  0: [1, 2],        // P1 ↔ m2, M2
  1: [2, 0],        // m2 ↔ M2, P1
  2: [1, 3],        // M2 ↔ m2, m3
  3: [4, 2],        // m3 ↔ M3, M2
  4: [3, 5],        // M3 ↔ m3, P4
  5: [7, 4, 6],     // P4 ↔ P5, M3, A4
  6: [5, 7],        // A4 ↔ P4, P5
  7: [5, 6, 8],     // P5 ↔ P4, A4, m6
  8: [9, 7],        // m6 ↔ M6, P5
  9: [8, 10],       // M6 ↔ m6, m7
  10: [11, 9],      // m7 ↔ M7, M6
  11: [10, 12],     // M7 ↔ m7, P8
  12: [11, 10],     // P8 ↔ M7, m7
};

/** 난이도별 포함 음정 (반음 수 기준, 누적 풀 — 구별 난이도 순) */
const INTERVAL_POOLS: Record<IntervalDifficulty, number[]> = {
  interval_1: [3, 4, 5, 7, 12],                             // 기본: m3·M3·P4·P5·P8
  interval_2: [2, 3, 4, 5, 7, 8, 9, 12],                    // + M2·m6·M6
  interval_3: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],        // + m2·m7·M7
  interval_4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // + P1·A4 (전체)
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
  'A,', '^A,', 'B,',                                    // A3~B3  (idx 0~2)
  'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G',    // C4~G#4 (idx 3~11)
  'A', '^A', 'B',                                        // A4~B4  (idx 12~14)
  'c', '^c', 'd', '^d', 'e',                            // C5~E5  (idx 15~19)
];

/** 온음계 근음 인덱스 (C, D, E, F, G, A, B만) */
const DIATONIC_INDICES = [0, 2, 3, 5, 7, 8, 10, 12, 14];

interface RootRange { min: number; max: number }
const ROOT_RANGES: Record<IntervalDifficulty, RootRange> = {
  interval_1: { min: 3, max: 10 },  // C4~G4
  interval_2: { min: 0, max: 12 },  // A3~A4
  interval_3: { min: 0, max: 14 },  // A3~B4
  interval_4: { min: 0, max: 14 },  // A3~B4
};

/** 쉬운 음정 가중치 (기본 1.0) */
const INTERVAL_WEIGHTS: Partial<Record<number, number>> = {
  0: 0.4,   // P1 — 동음, 자명함
  12: 0.5,  // P8 — 옥타브, 매우 쉬움
};

/** 직전 출제 음정 기록 (연속 중복 방지, 최대 2개) */
let recentIntervals: number[] = [];

/** 가중치 기반 랜덤 선택 */
function weightedPick(pool: number[]): number {
  const weights = pool.map(i => INTERVAL_WEIGHTS[i] ?? 1.0);
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
  const available = pool.filter(i => !recentIntervals.includes(i));
  const picked = weightedPick(available.length >= 2 ? available : pool);
  recentIntervals.push(picked);
  if (recentIntervals.length > 2) recentIntervals.shift();
  return picked;
}

/** 유사 음정 우선 오답 생성 */
function buildWrongChoices(correct: number, pool: number[]): string[] {
  const wrongs: string[] = [];
  const usedIntervals = new Set<number>([correct]);

  // ① 유사 음정 우선 (풀 내외 무관)
  for (const sim of (SIMILAR_INTERVALS[correct] ?? [])) {
    if (wrongs.length >= 3) break;
    if (usedIntervals.has(sim)) continue;
    usedIntervals.add(sim);
    wrongs.push(INTERVAL_NAMES[sim]);
  }

  // ② 풀 내 나머지
  for (const i of shuffle(pool.filter(i => !usedIntervals.has(i)))) {
    if (wrongs.length >= 3) break;
    usedIntervals.add(i);
    wrongs.push(INTERVAL_NAMES[i]);
  }

  // ③ 전체에서 보충
  if (wrongs.length < 3) {
    const remaining = Object.keys(INTERVAL_NAMES)
      .map(Number)
      .filter(i => !usedIntervals.has(i));
    for (const i of shuffle(remaining)) {
      if (wrongs.length >= 3) break;
      wrongs.push(INTERVAL_NAMES[i]);
    }
  }

  return wrongs.slice(0, 3);
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
    const candidates = DIATONIC_INDICES.filter(i => i >= range.min && i <= maxRoot);
    rootIdx = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    rootIdx = range.min + Math.floor(Math.random() * Math.max(1, maxRoot - range.min + 1));
  }

  const topIdx = rootIdx + interval;
  const rootNote = ABC_NOTE_TABLE[rootIdx];
  const topNote = ABC_NOTE_TABLE[Math.min(topIdx, ABC_NOTE_TABLE.length - 1)];

  // ABC notation: 방향 + 음 사이 쉼표 삽입
  const [first, second] = direction === 'ascending'
    ? [rootNote, topNote]
    : [topNote, rootNote];
  const abc = `X:1\nM:4/4\nL:1/4\nK:C\n${first} z ${second} z |]`;

  const correctAnswer = INTERVAL_NAMES[interval];
  const wrongs = buildWrongChoices(interval, pool);

  return {
    id: generateId(),
    contentType: 'interval',
    difficulty,
    correctAnswer,
    choices: shuffle([correctAnswer, ...wrongs]),
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
  major:    { name: '장3화음 (Major)',    intervals: [0, 4, 7] },
  minor:    { name: '단3화음 (minor)',    intervals: [0, 3, 7] },
  aug:      { name: '증3화음 (Aug)',      intervals: [0, 4, 8] },
  dim:      { name: '감3화음 (dim)',      intervals: [0, 3, 6] },
  dom7:     { name: '속7화음 (dom7)',     intervals: [0, 4, 7, 10] },
  maj7:     { name: '장7화음 (M7)',       intervals: [0, 4, 7, 11] },
  min7:     { name: '단7화음 (m7)',       intervals: [0, 3, 7, 10] },
  dim7:     { name: '감7화음 (dim7)',     intervals: [0, 3, 6, 9] },
  maj_inv1: { name: '장3화음 제1전위',    intervals: [0, 3, 8] },
  min_inv1: { name: '단3화음 제1전위',    intervals: [0, 4, 9] },
};

/** 유사 화음 맵 — 오답 우선 배치 */
const SIMILAR_CHORDS: Record<string, string[]> = {
  major:    ['minor', 'aug', 'maj_inv1'],
  minor:    ['major', 'dim', 'min_inv1'],
  aug:      ['major', 'maj7'],
  dim:      ['minor', 'dim7'],
  dom7:     ['maj7', 'min7'],
  maj7:     ['dom7', 'min7'],
  min7:     ['dom7', 'dim7'],
  dim7:     ['dim', 'min7'],
  maj_inv1: ['min_inv1', 'major'],
  min_inv1: ['maj_inv1', 'minor'],
};

/** 누적 풀 */
const CHORD_POOLS: Record<ChordDifficulty, string[]> = {
  chord_1: ['major', 'minor', 'dom7', 'aug'],
  chord_2: ['major', 'minor', 'dom7', 'aug', 'dim'],
  chord_3: ['major', 'minor', 'dom7', 'aug', 'dim', 'maj7', 'min7'],
  chord_4: ['major', 'minor', 'dom7', 'aug', 'dim', 'maj7', 'min7', 'dim7', 'maj_inv1', 'min_inv1'],
};

/** 제시 방식 */
type ChordPresentation = 'block' | 'arpeggio_up' | 'arpeggio_down';

const CHORD_PRESENTATIONS: Record<ChordDifficulty, ChordPresentation[]> = {
  chord_1: ['block'],
  chord_2: ['block', 'arpeggio_up'],
  chord_3: ['block', 'arpeggio_up', 'arpeggio_down'],
  chord_4: ['block', 'arpeggio_up', 'arpeggio_down'],
};

/** 배치 */
type ChordVoicing = 'close' | 'open';

const CHORD_VOICINGS: Record<ChordDifficulty, ChordVoicing[]> = {
  chord_1: ['close'],
  chord_2: ['close'],
  chord_3: ['close'],
  chord_4: ['close', 'open'],
};

/** 개방 배치: 3도음(인덱스 1)을 옥타브 위로 */
function openVoicing(intervals: number[]): number[] {
  if (intervals.length < 3) return intervals;
  return [intervals[0], ...intervals.slice(2), intervals[1] + 12].sort((a, b) => a - b);
}

/** 전체 음 테이블 (C3 ~ B5) */
const CHORD_NOTE_TABLE = [
  'C,', '^C,', 'D,', '^D,', 'E,', 'F,', '^F,', 'G,', '^G,', 'A,', '^A,', 'B,',
  'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
  'c', '^c', 'd', '^d', 'e', 'f', '^f', 'g', '^g', 'a', '^a', 'b',
];

/** 온음계 근음 인덱스 (C4, D4, E4, F4, G4) */
const CHORD_DIATONIC_ROOTS = [12, 14, 16, 17, 19];

/** 근음 범위 */
const CHORD_ROOT_RANGES: Record<ChordDifficulty, { min: number; max: number }> = {
  chord_1: { min: 12, max: 19 },  // C4~G4
  chord_2: { min: 12, max: 19 },  // C4~G4
  chord_3: { min: 9, max: 21 },   // A3~A4
  chord_4: { min: 9, max: 21 },   // A3~A4
};

/** 직전 출제 화음 기록 (연속 중복 방지) */
let recentChords: string[] = [];

/** 화음 ABC notation 생성 */
function chordToAbc(
  rootIdx: number,
  intervals: number[],
  presentation: ChordPresentation,
): string {
  const notes = intervals.map(i =>
    CHORD_NOTE_TABLE[Math.min(rootIdx + i, CHORD_NOTE_TABLE.length - 1)],
  );

  if (presentation === 'block') {
    return `X:1\nM:4/4\nL:1\nK:C\n[${notes.join('')}] |]`;
  }
  const ordered = presentation === 'arpeggio_down' ? [...notes].reverse() : notes;
  return `X:1\nM:4/4\nL:1/4\nK:C\n${ordered.join(' ')} |]`;
}

/** 유사 화음 우선 오답 생성 */
function buildChordWrongChoices(correctKey: string, pool: string[]): string[] {
  const wrongs: string[] = [];
  const used = new Set<string>([correctKey]);

  // ① 유사 화음 우선 (풀 내외 무관)
  for (const sim of (SIMILAR_CHORDS[correctKey] ?? [])) {
    if (wrongs.length >= 3) break;
    if (used.has(sim)) continue;
    used.add(sim);
    wrongs.push(CHORD_TEMPLATES[sim].name);
  }

  // ② 풀 내 나머지
  for (const k of shuffle(pool.filter(k => !used.has(k)))) {
    if (wrongs.length >= 3) break;
    used.add(k);
    wrongs.push(CHORD_TEMPLATES[k].name);
  }

  // ③ 전체에서 보충
  if (wrongs.length < 3) {
    for (const k of shuffle(Object.keys(CHORD_TEMPLATES).filter(k => !used.has(k)))) {
      if (wrongs.length >= 3) break;
      wrongs.push(CHORD_TEMPLATES[k].name);
    }
  }

  return wrongs.slice(0, 3);
}

function generateChordQuestion(difficulty: ChordDifficulty): ChoiceQuestion {
  const pool = CHORD_POOLS[difficulty];

  // 연속 중복 방지 선택 (직전 1개는 반드시 제외, 직전 2개까지 가능하면 제외)
  const excludeLast1 = pool.filter(k => k !== recentChords[recentChords.length - 1]);
  const excludeLast2 = pool.filter(k => !recentChords.includes(k));
  const pickPool = excludeLast2.length >= 2 ? excludeLast2
    : excludeLast1.length >= 1 ? excludeLast1
    : pool;
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
  const useDiatonic = difficulty === 'chord_1' || difficulty === 'chord_2';

  let rootIdx: number;
  if (useDiatonic) {
    const candidates = CHORD_DIATONIC_ROOTS.filter(i => i >= range.min && i <= maxRoot);
    rootIdx = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : range.min;
  } else {
    rootIdx = range.min + Math.floor(Math.random() * Math.max(1, maxRoot - range.min + 1));
  }

  const abc = chordToAbc(rootIdx, intervals, presentation);
  const wrongs = buildChordWrongChoices(chordKey, pool);

  return {
    id: generateId(),
    contentType: 'chord',
    difficulty,
    correctAnswer: chord.name,
    choices: shuffle([chord.name, ...wrongs]),
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

/** scaleNotes 문자열에서 개별 음표 배열 추출 (8음: 토닉~옥타브) */
function parseScale(scaleNotes: string): string[] {
  return scaleNotes
    .replace(/\|\]/g, '')
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(n => n.length > 0);
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
  C_major: 'A_minor',      A_minor: 'C_major',
  G_major: 'E_minor',      E_minor: 'G_major',
  F_major: 'D_minor',      D_minor: 'F_major',
  D_major: 'B_minor',      B_minor: 'D_major',
  Bb_major: 'G_minor',     G_minor: 'Bb_major',
  A_major: 'Fsh_minor',    Fsh_minor: 'A_major',
  Eb_major: 'C_minor',     C_minor: 'Eb_major',
  E_major: 'Csh_minor',    Csh_minor: 'E_major',
  Ab_major: 'F_minor',     F_minor: 'Ab_major',
  B_major: 'Gsh_minor',    Gsh_minor: 'B_major',
  Db_major: 'Bb_minor',    Bb_minor: 'Db_major',
  Gb_major: 'Eb_minor',    Eb_minor: 'Gb_major',
};

/** 직전 출제 조성 기록 (연속 중복 방지) */
let recentKeys: string[] = [];
/** 직전 출제 패턴 기록 (연속 동일 패턴 방지) */
let recentPatterns: number[] = [];

function generateKeyQuestion(difficulty: KeyDifficulty): ChoiceQuestion {
  const pool = KEY_POOLS[difficulty];

  // 연속 중복 방지
  let available: string[];
  if (pool.length <= 3) {
    // 소규모 풀: 3연속 동일 조성 방지
    const last2 = recentKeys.slice(-2);
    const blocked = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
    available = blocked ? pool.filter(k => k !== blocked) : pool;
  } else {
    // 대규모 풀: 직전 2개 제외
    available = pool.filter(k => !recentKeys.includes(k));
    if (available.length < 2) available = pool;
  }
  const keyId = available[Math.floor(Math.random() * available.length)];
  recentKeys.push(keyId);
  if (recentKeys.length > 2) recentKeys.shift();

  const key = KEY_TEMPLATES[keyId];

  // 랜덤 멜로디 패턴 선택 (3연속 동일 패턴 방지)
  const scale = parseScale(key.scaleNotes);
  const last2Pat = recentPatterns.slice(-2);
  const patBlocked = last2Pat.length === 2 && last2Pat[0] === last2Pat[1] ? last2Pat[0] : null;
  const patPool = patBlocked !== null
    ? Array.from({ length: KEY_MELODY_PATTERNS.length }, (_, i) => i).filter(i => i !== patBlocked)
    : Array.from({ length: KEY_MELODY_PATTERNS.length }, (_, i) => i);
  const patternIdx = patPool[Math.floor(Math.random() * patPool.length)];
  recentPatterns.push(patternIdx);
  if (recentPatterns.length > 2) recentPatterns.shift();

  const melodyBody = KEY_MELODY_PATTERNS[patternIdx](scale);

  const abc = `X:1\nM:4/4\nL:1/4\nK:${key.abcKey}\n${melodyBody}`;

  // key_1: 2지선다 (장/단조 판별에 집중)
  if (difficulty === 'key_1') {
    const otherKeyId = pool.find(k => k !== keyId)!;
    return {
      id: generateId(),
      contentType: 'key',
      difficulty,
      correctAnswer: key.name,
      choices: shuffle([key.name, KEY_TEMPLATES[otherKeyId].name]),
      abcNotation: abc,
      prompt: '멜로디를 듣고 장조/단조를 맞추세요.',
    };
  }

  // key_2/key_3: 나란한조 우선 오답 생성
  const wrongs: string[] = [];
  const usedKeys = new Set<string>([keyId]);

  // ① 나란한조를 반드시 첫 번째 오답으로
  const relativeKeyId = RELATIVE_KEYS[keyId];
  if (relativeKeyId && !usedKeys.has(relativeKeyId)) {
    usedKeys.add(relativeKeyId);
    wrongs.push(KEY_TEMPLATES[relativeKeyId].name);
  }

  // ② 풀 내 나머지에서 채움
  for (const k of shuffle(pool.filter(k => !usedKeys.has(k)))) {
    if (wrongs.length >= 3) break;
    usedKeys.add(k);
    wrongs.push(KEY_TEMPLATES[k].name);
  }

  // ③ 풀 외부에서 보충 (풀이 작을 때)
  if (wrongs.length < 3) {
    const outside = Object.keys(KEY_TEMPLATES).filter(k => !usedKeys.has(k));
    for (const k of shuffle(outside)) {
      if (wrongs.length >= 3) break;
      wrongs.push(KEY_TEMPLATES[k].name);
    }
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
