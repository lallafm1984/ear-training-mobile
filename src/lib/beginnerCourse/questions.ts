// ─────────────────────────────────────────────────────────────
// 귀 열기 코스 — 미니 문제 생성기
//
// 기존 객관식 생성기보다 훨씬 작은 식별 단위를 다룬다. 모든 문제는 2~3지선다이고
// 보기마다 "그 보기의 소리"를 같이 만들어 정답과 비교해 들을 수 있게 한다.
// 텍스트는 i18n 키로 돌려주고 화면에서 번역한다.
// ─────────────────────────────────────────────────────────────

import type { BeginnerQuestionKind } from './config';

export interface BeginnerChoice {
  id: string;
  /** beginner 네임스페이스의 번역 키 */
  labelKey: string;
  /** 리듬 카드처럼 글자 대신 보여줄 기호 (선택) */
  glyph?: string;
  /** 이 보기의 소리 */
  abc: string;
}

export interface BeginnerQuestion {
  id: string;
  kind: BeginnerQuestionKind;
  /** 문제 지시문 번역 키 */
  promptKey: string;
  abc: string;
  choices: BeginnerChoice[];
  correctId: string;
  /** 정답 해설 번역 키 */
  explanationKey: string;
}

// ─────────────────────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────────────────────

/** C4(=0) 부터 반음 단위 ABC 음 이름 (C4 ~ E5) */
const NOTE_TABLE = [
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
];

/** 온음계 음 (C4 D4 E4 F4 G4 A4 B4 C5) — 반음 인덱스 */
const DIATONIC = [0, 2, 4, 5, 7, 9, 11, 12];

function pick<T>(arr: readonly T[]): T {
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

function pickDistinct<T>(arr: readonly T[], count: number, exclude: T[] = []): T[] {
  return shuffle(arr.filter((x) => !exclude.includes(x))).slice(0, count);
}

function generateId(): string {
  return `bq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function abcHeader(key = 'C', unit = '1/4'): string {
  return `X:1\nM:4/4\nL:${unit}\nK:${key}\n`;
}

/** 연속 출제 방지용 최근 정답 기록 (종류별) */
const recent: Partial<Record<BeginnerQuestionKind, string[]>> = {};
function remember(kind: BeginnerQuestionKind, id: string) {
  const list = (recent[kind] ??= []);
  list.push(id);
  if (list.length > 2) list.shift();
}
function avoidRecent<T extends string>(kind: BeginnerQuestionKind, pool: readonly T[]): T {
  const blocked = recent[kind] ?? [];
  const available = pool.filter((p) => !blocked.includes(p));
  return pick(available.length >= 2 ? available : pool);
}

// ─────────────────────────────────────────────────────────────
// Day 1: 올라감 / 내려감 / 같음
// ─────────────────────────────────────────────────────────────

type Direction = 'up' | 'down' | 'same';

function twoNotesAbc(first: number, second: number): string {
  return `${abcHeader()}${NOTE_TABLE[first]}2 ${NOTE_TABLE[second]}2 |]`;
}

function generatePitchDirection(): BeginnerQuestion {
  const direction = avoidRecent<Direction>('pitchDirection', ['up', 'down', 'same']);
  remember('pitchDirection', direction);

  // 첫 음은 C4~G4 온음계, 두 번째 음은 2~5 온음계 칸 떨어진 음 (충분히 들리게)
  const firstDeg = pick([0, 1, 2, 3, 4]);
  const step = pick([2, 3, 4, 5]);
  const upDeg = Math.min(firstDeg + step, DIATONIC.length - 1);
  const downDeg = Math.max(firstDeg - step, 0);
  const first = DIATONIC[firstDeg];

  // 내려가는 문제인데 아래 여유가 없으면 첫 음을 높여서 시작
  const base = direction === 'down' && downDeg === firstDeg ? DIATONIC[firstDeg + step] : first;
  const baseDeg = DIATONIC.indexOf(base);
  const secondByDir: Record<Direction, number> = {
    up: DIATONIC[Math.min(baseDeg + step, DIATONIC.length - 1)],
    down: DIATONIC[Math.max(baseDeg - step, 0)],
    same: base,
  };

  const choices: BeginnerChoice[] = (['up', 'down', 'same'] as Direction[]).map((d) => ({
    id: d,
    labelKey: `choices.direction.${d}`,
    abc: twoNotesAbc(base, secondByDir[d]),
  }));
  void upDeg;

  return {
    id: generateId(),
    kind: 'pitchDirection',
    promptKey: 'prompts.pitchDirection',
    abc: twoNotesAbc(base, secondByDir[direction]),
    choices,
    correctId: direction,
    explanationKey: `explain.direction.${direction}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Day 2: 긴 소리 / 짧은 소리 / 쉼
// ─────────────────────────────────────────────────────────────

const LONG_SHORT_PATTERNS: Record<string, { body: string; glyph: string }> = {
  long_long: { body: 'B2 B2', glyph: '𝅗𝅥 𝅗𝅥' },
  short_short_long: { body: 'B B B2', glyph: '♩ ♩ 𝅗𝅥' },
  long_short_short: { body: 'B2 B B', glyph: '𝅗𝅥 ♩ ♩' },
  sound_rest_sound_rest: { body: 'B z B z', glyph: '♩ 𝄽 ♩ 𝄽' },
  short_x4: { body: 'B B B B', glyph: '♩ ♩ ♩ ♩' },
};

function rhythmAbc(body: string): string {
  return `${abcHeader()}${body} |]`;
}

function generateLongShort(): BeginnerQuestion {
  const ids = Object.keys(LONG_SHORT_PATTERNS);
  const correct = avoidRecent('longShort', ids);
  remember('longShort', correct);
  const wrongs = pickDistinct(ids, 2, [correct]);

  const choices = shuffle([correct, ...wrongs]).map((id) => ({
    id,
    labelKey: `choices.longShort.${id}`,
    glyph: LONG_SHORT_PATTERNS[id].glyph,
    abc: rhythmAbc(LONG_SHORT_PATTERNS[id].body),
  }));

  return {
    id: generateId(),
    kind: 'longShort',
    promptKey: 'prompts.longShort',
    abc: rhythmAbc(LONG_SHORT_PATTERNS[correct].body),
    choices,
    correctId: correct,
    explanationKey: `explain.longShort.${correct}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Day 3: 가까운 도약 / 넓은 도약 → 음정 이름
// ─────────────────────────────────────────────────────────────

const NEAR_INTERVALS = [3, 4]; // m3, M3
const WIDE_INTERVALS = [7, 12]; // P5, P8

function intervalAbc(root: number, semitones: number): string {
  const maxRoot = NOTE_TABLE.length - 1 - semitones;
  const safeRoot = Math.max(0, Math.min(root, maxRoot));
  return `${abcHeader()}${NOTE_TABLE[safeRoot]}2 ${NOTE_TABLE[safeRoot + semitones]}2 |]`;
}

function generateLeapSize(): BeginnerQuestion {
  const size = avoidRecent<'near' | 'wide'>('leapSize', ['near', 'wide']);
  remember('leapSize', size);
  const root = pick([0, 2, 4, 5]);
  const nearInterval = pick(NEAR_INTERVALS);
  const wideInterval = pick(WIDE_INTERVALS);

  const choices: BeginnerChoice[] = [
    { id: 'near', labelKey: 'choices.leapSize.near', abc: intervalAbc(root, nearInterval) },
    { id: 'wide', labelKey: 'choices.leapSize.wide', abc: intervalAbc(root, wideInterval) },
  ];

  return {
    id: generateId(),
    kind: 'leapSize',
    promptKey: 'prompts.leapSize',
    abc: intervalAbc(root, size === 'near' ? nearInterval : wideInterval),
    choices,
    correctId: size,
    explanationKey: `explain.leapSize.${size}`,
  };
}

const LEAP_NAMES: Record<string, number> = { m3: 3, M3: 4, P5: 7 };

function generateLeapName(): BeginnerQuestion {
  const ids = Object.keys(LEAP_NAMES);
  const correct = avoidRecent('leapName', ids);
  remember('leapName', correct);
  const root = pick([0, 2, 5, 7]);

  const choices: BeginnerChoice[] = ids.map((id) => ({
    id,
    labelKey: `choices.leapName.${id}`,
    abc: intervalAbc(root, LEAP_NAMES[id]),
  }));

  return {
    id: generateId(),
    kind: 'leapName',
    promptKey: 'prompts.leapName',
    abc: intervalAbc(root, LEAP_NAMES[correct]),
    choices,
    correctId: correct,
    explanationKey: `explain.leapName.${correct}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Day 4: 장조 / 단조
// ─────────────────────────────────────────────────────────────

const MAJOR_MELODIES = [
  'C D E G | E D C2',
  'C E G c | G E C2',
  'G E C D | E C C2',
  'C D E F | G2 E C',
  'E G c G | E D C2',
];
const MINOR_MELODIES = [
  'A, B, C E | C B, A,2',
  'A, C E A | E C A,2',
  'E C A, B, | C A, A,2',
  'A, B, C D | E2 C A,',
  'C E A E | C B, A,2',
];

function generateMajorMinor(): BeginnerQuestion {
  const mode = avoidRecent<'major' | 'minor'>('majorMinor', ['major', 'minor']);
  remember('majorMinor', mode);
  const idx = Math.floor(Math.random() * MAJOR_MELODIES.length);
  // 같은 번호의 선율 윤곽을 장조/단조로 들려주어 색깔 차이에 집중하게 한다.
  const majorAbc = `${abcHeader('C')}${MAJOR_MELODIES[idx]} |]`;
  const minorAbc = `${abcHeader('Am')}${MINOR_MELODIES[idx]} |]`;

  const choices: BeginnerChoice[] = [
    { id: 'major', labelKey: 'choices.mode.major', abc: majorAbc },
    { id: 'minor', labelKey: 'choices.mode.minor', abc: minorAbc },
  ];

  return {
    id: generateId(),
    kind: 'majorMinor',
    promptKey: 'prompts.majorMinor',
    abc: mode === 'major' ? majorAbc : minorAbc,
    choices,
    correctId: mode,
    explanationKey: `explain.mode.${mode}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Day 5: 리듬 카드 고르기 (한 마디)
// ─────────────────────────────────────────────────────────────

const RHYTHM_CARDS: Record<string, { body: string; glyph: string }> = {
  q4: { body: 'B B B B', glyph: '♩ ♩ ♩ ♩' },
  h_q_q: { body: 'B2 B B', glyph: '𝅗𝅥 ♩ ♩' },
  q_q_h: { body: 'B B B2', glyph: '♩ ♩ 𝅗𝅥' },
  q_ee_q_q: { body: 'B B/2B/2 B B', glyph: '♩ ♪♪ ♩ ♩' },
  q_rest_q_q: { body: 'B z B B', glyph: '♩ 𝄽 ♩ ♩' },
  q_q_rest_q: { body: 'B B z B', glyph: '♩ ♩ 𝄽 ♩' },
  ee_q_h: { body: 'B/2B/2 B B2', glyph: '♪♪ ♩ 𝅗𝅥' },
  h_h: { body: 'B2 B2', glyph: '𝅗𝅥 𝅗𝅥' },
};

function generateRhythmPattern(): BeginnerQuestion {
  const ids = Object.keys(RHYTHM_CARDS);
  const correct = avoidRecent('rhythmPattern', ids);
  remember('rhythmPattern', correct);
  const wrongs = pickDistinct(ids, 2, [correct]);

  const choices = shuffle([correct, ...wrongs]).map((id) => ({
    id,
    labelKey: `choices.rhythm.${id}`,
    glyph: RHYTHM_CARDS[id].glyph,
    abc: rhythmAbc(RHYTHM_CARDS[id].body),
  }));

  return {
    id: generateId(),
    kind: 'rhythmPattern',
    promptKey: 'prompts.rhythmPattern',
    abc: rhythmAbc(RHYTHM_CARDS[correct].body),
    choices,
    correctId: correct,
    explanationKey: 'explain.rhythmPattern',
  };
}

// ─────────────────────────────────────────────────────────────
// Day 6: 첫 선율 — 3음 계이름 고르기
// ─────────────────────────────────────────────────────────────

/** 계이름 인덱스 (0=도 … 4=솔) 시퀀스. 모두 도에서 시작한다. */
const MELODY_PATTERNS: Record<string, number[]> = {
  do_re_mi: [0, 1, 2],
  do_mi_sol: [0, 2, 4],
  do_re_do: [0, 1, 0],
  do_mi_re: [0, 2, 1],
  do_sol_mi: [0, 4, 2],
  do_fa_sol: [0, 3, 4],
  do_mi_do: [0, 2, 0],
  do_sol_sol: [0, 4, 4],
  do_re_mi_fa: [0, 1, 2, 3],
  do_mi_sol_mi: [0, 2, 4, 2],
  do_re_mi_re: [0, 1, 2, 1],
};

function melodyAbc(degrees: number[]): string {
  const notes = degrees.map((d) => NOTE_TABLE[DIATONIC[d]]);
  const rest = 4 - notes.length;
  return `${abcHeader()}${notes.join(' ')}${rest > 0 ? ` z${rest > 1 ? rest : ''}` : ''} |]`;
}

function generateFirstMelody(): BeginnerQuestion {
  const ids = Object.keys(MELODY_PATTERNS);
  const correct = avoidRecent('firstMelody', ids);
  remember('firstMelody', correct);
  const sameLength = ids.filter(
    (id) => id !== correct && MELODY_PATTERNS[id].length === MELODY_PATTERNS[correct].length,
  );
  const wrongs = pickDistinct(sameLength, 2);

  const choices = shuffle([correct, ...wrongs]).map((id) => ({
    id,
    labelKey: `choices.melody.${id}`,
    abc: melodyAbc(MELODY_PATTERNS[id]),
  }));

  return {
    id: generateId(),
    kind: 'firstMelody',
    promptKey: 'prompts.firstMelody',
    abc: melodyAbc(MELODY_PATTERNS[correct]),
    choices,
    correctId: correct,
    explanationKey: 'explain.firstMelody',
  };
}

// ─────────────────────────────────────────────────────────────
// 통합 API
// ─────────────────────────────────────────────────────────────

export function generateBeginnerQuestion(kind: BeginnerQuestionKind): BeginnerQuestion {
  switch (kind) {
    case 'pitchDirection':
      return generatePitchDirection();
    case 'longShort':
      return generateLongShort();
    case 'leapSize':
      return generateLeapSize();
    case 'leapName':
      return generateLeapName();
    case 'majorMinor':
      return generateMajorMinor();
    case 'rhythmPattern':
      return generateRhythmPattern();
    case 'firstMelody':
      return generateFirstMelody();
  }
}

/** 레슨의 문제 종류 목록을 순환하며 count개 문제를 만든다. */
export function generateBeginnerLessonQuestions(
  kinds: BeginnerQuestionKind[],
  count: number,
): BeginnerQuestion[] {
  return Array.from({ length: count }, (_, i) => generateBeginnerQuestion(kinds[i % kinds.length]));
}
