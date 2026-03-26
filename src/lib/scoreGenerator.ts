import {
  ScoreNote, NoteDuration, PitchName, Accidental,
  getSixteenthsPerBar,
  durationToSixteenths,
  getTupletActualSixteenths,
  noteToMidiWithKey,
  getKeySigAlteration,
  getKeySignatureAccidentalCount,
  getScaleDegrees,
  SIXTEENTHS_TO_DUR,
  splitAtBeatBoundaries,
} from './scoreUtils';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

/**
 * 9단계 난이도 체계:
 *   초급 1~3 (beginner_1/2/3)  → 문서 Level 1~3
 *   중급 1~3 (intermediate_1/2/3) → 문서 Level 3~4 사이, Level 4, Level 4~5 사이
 *   고급 1~3 (advanced_1/2/3) → 문서 Level 5, Level 5~6 사이, Level 6
 */
export type Difficulty =
  | 'beginner_1' | 'beginner_2' | 'beginner_3'
  | 'intermediate_1' | 'intermediate_2' | 'intermediate_3'
  | 'advanced_1' | 'advanced_2' | 'advanced_3';

export type BassDifficulty = 'bass_1' | 'bass_2' | 'bass_3' | 'bass_4' | 'bass_5' | 'bass_6' | 'bass_7' | 'bass_8' | 'bass_9';

/** 상위 카테고리 */
export type DifficultyCategory = 'beginner' | 'intermediate' | 'advanced';

export function getDifficultyCategory(d: Difficulty): DifficultyCategory {
  if (d.startsWith('beginner')) return 'beginner';
  if (d.startsWith('intermediate')) return 'intermediate';
  return 'advanced';
}

/** 난이도를 내부 수치 레벨(1~9)로 변환 */
function difficultyLevel(d: Difficulty): number {
  const map: Record<Difficulty, number> = {
    beginner_1: 1, beginner_2: 2, beginner_3: 3,
    intermediate_1: 4, intermediate_2: 5, intermediate_3: 6,
    advanced_1: 7, advanced_2: 8, advanced_3: 9,
  };
  return map[d];
}

export interface GeneratorOptions {
  keySignature: string;
  timeSignature: string;
  difficulty: Difficulty;
  bassDifficulty?: BassDifficulty;
  measures: number;
  useGrandStaff: boolean;
}

export interface GeneratedScore {
  trebleNotes: ScoreNote[];
  bassNotes: ScoreNote[];
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const PITCH_ORDER: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];


const CHORD_TONES: Record<number, number[]> = {
  0: [0, 2, 4], 1: [1, 3, 5], 2: [2, 4, 6],
  3: [3, 5, 0], 4: [4, 6, 1], 5: [5, 0, 2], 6: [6, 1, 3],
};

/**
 * 9단계별 리듬 풀 (16분음표 단위) — 누적 도입
 *   L1: 온(16)·2분(8)·4분(4)
 *   L2: + 점2분(12) / 쉼표 도입
 *   L3: + 8분(2) / 8분쉼표
 *   L4: + 점4분(6)
 *   L5: 붙임줄 당김음 (음가 풀 동일, tieProb·syncopationProb 활성)
 *   L6: + 16분(1) / 16분쉼표
 *   L7: + 점8분(3)
 *   L8: 임시표 도입 (음가 풀 동일)
 *   L9: 셋잇단 도입
 */
const DURATION_POOL: Record<Difficulty, number[]> = {
  // L1: 온·2분
  beginner_1:     [16, 8],
  // L2: 4분·점2분 (쉼표 포함)
  beginner_2:     [12, 8, 4],
  // L3: + 8분 (온음표 제외)
  beginner_3:     [12, 8, 4, 2],
  // L4: 점4분 중심
  intermediate_1: [8, 6, 4, 2],
  // L5: 붙임줄 당김음 (풀 동일)
  intermediate_2: [8, 6, 4, 2],
  // L6: + 16분
  intermediate_3: [12, 8, 6, 4, 2, 1],
  // L7: + 점8분
  advanced_1:     [12, 8, 6, 4, 3, 2, 1],
  // L8: 임시표 (풀 동일)
  advanced_2:     [12, 8, 6, 4, 3, 2, 1],
  // L9: 셋잇단
  advanced_3:     [12, 8, 6, 4, 3, 2, 1],
};


const CHROMATIC_RESOLUTION: Record<string, PitchName> = {
  'C': 'D', 'D': 'E', 'E': 'F', 'F': 'G', 'G': 'A', 'A': 'B', 'B': 'C',
};

// ────────────────────────────────────────────────────────────────
// Bass difficulty labels & params
// ────────────────────────────────────────────────────────────────

export const BASS_DIFF_LABELS: Record<BassDifficulty, string> = {
  bass_1: '1단계', bass_2: '2단계', bass_3: '3단계',
  bass_4: '4단계', bass_5: '5단계', bass_6: '6단계',
  bass_7: '7단계', bass_8: '8단계', bass_9: '9단계',
};

export const BASS_DIFF_DESC: Record<BassDifficulty, string> = {
  bass_1: '지속음 — 한 음만 유지',
  bass_2: '근음 정박 — I, IV, V도 근음',
  bass_3: '순차 진행 — 계단식 움직임',
  bass_4: '기본 반주 — 4분음표 리듬',
  bass_5: '도약 진행 — 4, 5도 도약',
  bass_6: '8분음표 분할 — 리듬 세분화',
  bass_7: '전위 화음 — 3음, 5음 베이스',
  bass_8: '싱코페이션 — 엇박 진행',
  bass_9: '대위적 독립 — 독립 선율',
};

interface BassLevelParams {
  mode:
    | 'pedal'          // 1단: 지속음
    | 'root_beat'      // 2단: 근음 정박
    | 'directed_step'  // 3단: 방향 고정 순차
    | 'alternating'    // 4단: 쿵-짝 (근음↔5음)
    | 'leap'           // 5단: 도약 진행
    | 'arpeggio'       // 6단: 분산화음 (근-3-5-3)
    | 'inversion'      // 7단: 전위 화음 (내려가는 베이스 라인)
    | 'syncopated'     // 8단: 싱코페이션 (강박 쉼표)
    | 'contrary';      // 9단: 반진행 (트레블 반대 방향)
  durationPool: number[];
  minDur: number;
}

const BASS_LEVEL_PARAMS: Record<BassDifficulty, BassLevelParams> = {
  bass_1: { mode: 'pedal',         durationPool: [16, 8], minDur: 8 },
  bass_2: { mode: 'root_beat',     durationPool: [4],     minDur: 4 },
  bass_3: { mode: 'directed_step', durationPool: [4],     minDur: 4 },
  bass_4: { mode: 'alternating',   durationPool: [4],     minDur: 4 },
  bass_5: { mode: 'leap',          durationPool: [4],     minDur: 4 },
  bass_6: { mode: 'arpeggio',      durationPool: [2],     minDur: 2 },
  bass_7: { mode: 'inversion',     durationPool: [4, 2],  minDur: 2 },
  bass_8: { mode: 'syncopated',    durationPool: [4, 2],  minDur: 2 },
  bass_9: { mode: 'contrary',      durationPool: [4, 2],  minDur: 2 },
};

/** 낮은음자리표 §4: 두 성부 최소 간격 — 단 10도(= 15반음) */
const MIN_TREBLE_BASS_SEMITONES = 15;

/** 한 마디 트레블: 음 시작 offset(16분) → MIDI (조표 반영, 성부 동일 건반 회피용) */
function buildTrebleAttackMidiMap(barSlice: ScoreNote[], keySignature: string): Map<number, number> {
  const map = new Map<number, number>();
  let off = 0;
  let i = 0;
  while (i < barSlice.length) {
    const n = barSlice[i];
    if (n.tuplet) {
      const p = parseInt(n.tuplet, 10);
      const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
      if (n.pitch !== 'rest') {
        map.set(off, noteToMidiWithKey(n, keySignature));
      }
      off += span;
      i += p;
    } else {
      if (n.pitch !== 'rest') {
        map.set(off, noteToMidiWithKey(n, keySignature));
      }
      off += durationToSixteenths(n.duration);
      i += 1;
    }
  }
  return map;
}

/**
 * 조성·난이도에 맞게 임시표 종류 선택.
 * 샤프/플랫이 많은 조에서는 조표로 이미 반영된 음에 대해 #만 덧붙이면 ABC에 표시가 안 되므로,
 * 제자리(n)·반대 방향(b/♭ 등)을 섞어 임시표가 보이도록 한다.
 */
function pickChromaticAccidental(keySignature: string, pitch: PitchName, difficulty: Difficulty): Accidental {
  const keyAlt = getKeySigAlteration(keySignature, pitch);
  const lvl = difficultyLevel(difficulty);
  const r = Math.random();
  if (keyAlt === '#') {
    return r < 0.55 ? 'n' : 'b';
  }
  if (keyAlt === 'b') {
    return r < 0.55 ? 'n' : '#';
  }
  // 피아노 반음 경계 — E#=F, B#=C, Cb=B, Fb=E는 독립 건반이 없어 혼란을 유발
  // 자연 반음 위치(E-F, B-C): 위 방향은 #금지, 아래 방향은 b금지
  const canSharp = pitch !== 'E' && pitch !== 'B';
  const canFlat  = pitch !== 'C' && pitch !== 'F';
  if (lvl >= 5) {
    if (canSharp && canFlat) return r < 0.5 ? '#' : 'b';
    if (canSharp) return '#';
    if (canFlat)  return 'b';
    return 'n';
  }
  // lvl < 5: 샤프 우선, E/B는 플랫으로 대체
  return canSharp ? '#' : 'b';
}

// ────────────────────────────────────────────────────────────────
// 난이도별 파라미터 테이블 (문서 기반)
// ────────────────────────────────────────────────────────────────

interface LevelParams {
  // 선율
  maxInterval: number;          // 최대 음정 (도 단위)
  stepwiseProb: number;         // 순차진행 확률
  maxLeap: number;              // 허용 도약 (도)
  chromaticBudget: [number, number]; // 반음계 임시표 [min, max]
  chromaticProb: number;        // 노트당 임시표 확률
  // 리듬
  syncopationProb: number;      // 당김음 확률
  tripletBudget: [number, number]; // 셋잇단 [min, max]
  tripletProb: number;          // 셋잇단 삽입 확률
  /** 붙임줄(같은 음·타이): 직전 음과 높이가 같을 때만 적용 */
  tieProb: number;
  restProb: number;             // 쉼표 확률
  dottedProb: number;           // 점음표 확률
  // 2성부
  contraryMotionRatio: number;  // 반진행 비율
  bassIndependence: number;     // 베이스 리듬 독립도 (0~1)
  voiceCrossingMax: number;     // 성부 교차 최대 횟수
  consonanceRatio: number;      // 협화음 비율
  // 종지
  cadenceType: string[];        // 사용 가능한 종지 유형
  // 함정
  maxTraps: number;             // 연습 1회당 최대 함정 수
}

const LEVEL_PARAMS: Record<Difficulty, LevelParams> = {
  // ── L1: 온·2분·4분 ──
  beginner_1: {
    maxInterval: 3, stepwiseProb: 0.95, maxLeap: 3,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0, dottedProb: 0,
    contraryMotionRatio: 0.30, bassIndependence: 0,
    voiceCrossingMax: 0, consonanceRatio: 1.0,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── L2: 점2분·쉼표 ──
  beginner_2: {
    maxInterval: 4, stepwiseProb: 0.88, maxLeap: 4,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0.20, dottedProb: 0.35,
    contraryMotionRatio: 0.30, bassIndependence: 0,
    voiceCrossingMax: 0, consonanceRatio: 1.0,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── L3: 8분·8분쉼표 ──
  beginner_3: {
    maxInterval: 5, stepwiseProb: 0.82, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0.20, dottedProb: 0.25,
    contraryMotionRatio: 0.40, bassIndependence: 0.2,
    voiceCrossingMax: 0, consonanceRatio: 0.95,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── L4: 점4분 ──
  intermediate_1: {
    maxInterval: 6, stepwiseProb: 0.75, maxLeap: 6,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0.15, dottedProb: 0.80,
    contraryMotionRatio: 0.50, bassIndependence: 0.3,
    voiceCrossingMax: 0, consonanceRatio: 0.92,
    cadenceType: ['perfect', 'half'],
    maxTraps: 0,
  },
  // ── L5: 붙임줄 당김음 ──
  intermediate_2: {
    maxInterval: 6, stepwiseProb: 0.70, maxLeap: 7,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.25, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.30, restProb: 0.15, dottedProb: 0.15,
    contraryMotionRatio: 0.50, bassIndependence: 0.45,
    voiceCrossingMax: 0, consonanceRatio: 0.88,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── L6: 16분·16분쉼표 ──
  intermediate_3: {
    maxInterval: 7, stepwiseProb: 0.65, maxLeap: 8,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.20, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.20, restProb: 0.20, dottedProb: 0.15,
    contraryMotionRatio: 0.55, bassIndependence: 0.55,
    voiceCrossingMax: 1, consonanceRatio: 0.85,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── L7: 점8분 ──
  advanced_1: {
    maxInterval: 7, stepwiseProb: 0.60, maxLeap: 8,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.25, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.45,
    contraryMotionRatio: 0.60, bassIndependence: 0.65,
    voiceCrossingMax: 1, consonanceRatio: 0.82,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── L8: 임시표 ──
  advanced_2: {
    maxInterval: 8, stepwiseProb: 0.55, maxLeap: 9,
    chromaticBudget: [2, 4], chromaticProb: 0.15,
    syncopationProb: 0.25, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.35,
    contraryMotionRatio: 0.65, bassIndependence: 0.75,
    voiceCrossingMax: 2, consonanceRatio: 0.80,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── L9: 셋잇단 ──
  advanced_3: {
    maxInterval: 9, stepwiseProb: 0.50, maxLeap: 10,
    chromaticBudget: [2, 4], chromaticProb: 0.15,
    syncopationProb: 0.30, tripletBudget: [1, 3], tripletProb: 0.35,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.35,
    contraryMotionRatio: 0.65, bassIndependence: 0.85,
    voiceCrossingMax: 2, consonanceRatio: 0.78,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64'],
    maxTraps: 3,
  },
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uid(): string {
  return Math.random().toString(36).substr(2, 9);
}

function makeNote(
  pitch: PitchName, octave: number, dur: NoteDuration,
  accidental: Accidental = '', tie = false,
): ScoreNote {
  return { id: uid(), pitch, octave, accidental, duration: dur, tie };
}

/** 직전 으뜸 성부 음(쉼표 제외) — 붙임줄(같은 음) 여부 판별용 */
function lastNonRestMelody(notes: ScoreNote[]): ScoreNote | null {
  for (let k = notes.length - 1; k >= 0; k--) {
    if (notes[k].pitch !== 'rest') return notes[k];
  }
  return null;
}

function samePitchHeight(a: ScoreNote, pitch: PitchName, octave: number, accidental: Accidental): boolean {
  return a.pitch === pitch && a.octave === octave && a.accidental === accidental;
}

function makeRest(dur: NoteDuration): ScoreNote {
  return makeNote('rest', 4, dur);
}

function noteNumToNote(
  noteNum: number, scale: PitchName[], baseOctave: number,
): { pitch: PitchName; octave: number } {
  const deg = ((noteNum % 7) + 7) % 7;
  const octOff = Math.floor(noteNum / 7);
  const pitch = scale[deg];
  const rootIdx = PITCH_ORDER.indexOf(scale[0]);
  const pitchIdx = PITCH_ORDER.indexOf(pitch);
  const wrap = pitchIdx < rootIdx ? 1 : 0;
  return { pitch, octave: baseOctave + octOff + wrap };
}

// ── 사보 관례: 마디 내 필수 박 경계 (지침서 §1) ──────────────
/**
 * 리듬 생성 시 넘어서는 안 되는 필수 박 경계를 16분음표 단위로 반환.
 * - 4/4: 마디 중앙(3박 = 8) — 2박 끝에서 3박으로 이어지는 음표는 붙임줄 필수
 * - 3/4: 각 박 경계(4, 8) — 2박+3박을 2분음표로 묶지 않음
 * - 복합 박자(6/8 등): 점4분 단위 경계
 * - 기타 홑박자: 한 박 단위 경계
 */
function getBarMandatoryBoundaries(timeSignature: string, barLength: number): number[] {
  const [topStr, bottomStr] = timeSignature.split('/');
  const top = parseInt(topStr, 10);
  const bottom = parseInt(bottomStr, 10);

  // 복합 박자 (6/8, 9/8, 12/8): 점4분 단위 경계
  if (bottom === 8 && top % 3 === 0 && top >= 6) {
    const pts: number[] = [];
    for (let i = 6; i < barLength; i += 6) pts.push(i);
    return pts;
  }

  // 4/4: 마디 중앙만 필수 (지침서 §1.1)
  if (top === 4 && bottom === 4) {
    return [8];
  }

  // 3/4: 3박 시작점(pos 8)만 필수 — 1박(홀수 박)에서 시작하는 점4분 허용 (§1 허용 규칙)
  // 2박+3박을 합치는 것만 금지
  if (top === 3 && bottom === 4) {
    return [8];
  }

  // 2박자(2/4, 2/2 등): 필수 경계 없음 — 마디 전체를 채우는 2분음표 허용
  if (top === 2) {
    return [];
  }

  // 기타 홑박자: 각 박 경계
  const beatSize = 16 / bottom;
  const pts: number[] = [];
  for (let i = beatSize; i < barLength; i += beatSize) pts.push(i);
  return pts;
}

/**
 * 박자 경계를 존중하는 리듬 생성 (사보 관례 지침서 적용)
 *
 * - 점음표는 박 경계를 가리지 않을 때만 사용 (§1.2)
 * - 4/4에서 마디 중앙(3박) 경계를 넘는 음표 금지 (§1.1)
 * - 3/4에서 2박+3박을 하나의 2분음표로 묶지 않음 (§1.1)
 * - 당김음은 정박 시작점이 보이도록 패턴 삽입 (§3.1)
 *   → splitAtBeatBoundaries가 경계에서 붙임줄로 분할
 */
const DOTTED_SIXTEENTHS = new Set([3, 6, 12, 24]);

function fillRhythm(
  total: number,
  pool: number[],
  opts?: {
    timeSignature?: string;
    lastDur?: number;
    syncopationProb?: number;
    /** 베이스용: 최소 음가(16분음표 단위). 이 값 미만 음가는 생성 금지 */
    minDur?: number;
    /** 점음표 사용 확률 (0 = 사용 안 함, 1 = 항상 허용) */
    dottedProb?: number;
    /** 붙임줄 허용 — 중급 2단계+에서 2분음표가 박 경계를 넘어 4분+4분 타이로 표시되게 허용 */
    allowTies?: boolean;
  },
): number[] {
  const sorted = [...pool].sort((a, b) => b - a);
  const minDur = opts?.minDur ?? 0;
  const dottedProb = opts?.dottedProb ?? 1;
  const allowTies = opts?.allowTies ?? false;
  const result: number[] = [];
  let rem = total;
  let pos = 0;
  const lastDur = opts?.lastDur;
  const syncopationProb = opts?.syncopationProb ?? 0;
  const timeSignature = opts?.timeSignature;

  // 박 경계 정보 (timeSignature 제공 시에만 활성)
  const boundaries = timeSignature
    ? getBarMandatoryBoundaries(timeSignature, total)
    : [];
  const beatSize = (() => {
    if (!timeSignature) return 4;
    const [, bs] = timeSignature.split('/');
    return 16 / (parseInt(bs, 10) || 4);
  })();

  // 박 경계 목록: 박 사이에서 시작하는 음이 넘지 못하는 경계 (§1 당김음 + §1.2 점음표)
  const allBeatBounds: number[] = [];
  if (timeSignature) {
    for (let i = beatSize; i < total; i += beatSize) allBeatBounds.push(i);
  }

  let syncopationUsed = false;

  while (rem > 0) {
    // ── 당김음 패턴 삽입 (지침서 §3.1) ──
    // 정박 위치에서 halfBeat + beat + halfBeat 패턴
    // 중앙의 beat 길이 음표가 다음 박 경계를 넘으므로
    // splitAtBeatBoundaries가 붙임줄로 분할하여 정박 시작점 노출
    if (
      !syncopationUsed &&
      syncopationProb > 0 &&
      rem >= beatSize * 2 &&
      pos % beatSize === 0 &&
      pos > 0 &&
      Math.random() < syncopationProb
    ) {
      const halfBeat = Math.max(1, Math.floor(beatSize / 2));
      const syncCell = [halfBeat, beatSize, halfBeat];
      const syncTotal = syncCell.reduce((a, b) => a + b, 0);
      if (syncTotal <= rem && syncCell.every(d => SIXTEENTHS_TO_DUR[d])) {
        result.push(...syncCell);
        rem -= syncTotal;
        pos += syncTotal;
        syncopationUsed = true;
        continue;
      }
    }

    let avail = sorted.filter(d => d <= rem && d >= minDur);

    // 점4분음표(6) 연속 방지
    const prevDur = result.length > 0 ? result[result.length - 1] : lastDur;
    if (prevDur === 6) {
      avail = avail.filter(d => d !== 6);
    }

    // ── 박 경계를 넘는 음가 필터링 (지침서 §1.1, §1.2) ──
    if (boundaries.length > 0) {
      const onBeat = pos % beatSize === 0;
      avail = avail.filter(d => {
        const noteEnd = pos + d;
        // 마디 전체를 채우는 음표(pos=0, noteEnd=total)는 경계 면제 (3/4 점2분 등)
        if (pos === 0 && noteEnd === total) return true;
        // 필수 경계 체크 (모든 음가 공통)
        // — 단, 마디 첫 박(pos=0) 출발 점음표는 경계 면제 (4/4 점2분 → half-quarter 붙임줄로 표시)
        for (const b of boundaries) {
          if (pos < b && noteEnd > b) {
            if (pos === 0 && DOTTED_SIXTEENTHS.has(d)) continue;
            // allowTies: 2분음표(8)가 정박 위치에서 박 경계를 넘는 것 허용 → splitAtBeatBoundaries가 4분+4분 타이로 분할
            if (allowTies && d === 8 && onBeat) continue;
            return false;
          }
        }
        // 박 사이 시작 필터 (§1 당김음/§1.2 점음표): 박 위에서 시작하면 허용,
        // 박 사이에서 시작하여 다음 박 경계를 넘으면 금지
        if (!onBeat) {
          for (const b of allBeatBounds) {
            if (pos < b && noteEnd > b) return false;
          }
        }
        return true;
      });
    }

    // ── 점음표 확률 필터링 (dottedProb) ──
    if (dottedProb < 1) {
      const nonDotted = avail.filter(d => !DOTTED_SIXTEENTHS.has(d));
      if (nonDotted.length > 0 && Math.random() >= dottedProb) {
        avail = nonDotted;
      }
    }

    if (avail.length === 0) {
      let fallback = Object.keys(SIXTEENTHS_TO_DUR).map(Number)
        .filter(d => d <= rem && d >= minDur).sort((a, b) => b - a);

      const prevDurFallback = result.length > 0 ? result[result.length - 1] : lastDur;
      if (prevDurFallback === 6) {
        fallback = fallback.filter(d => d !== 6);
      }

      // 폴백도 경계 필터링 (당김음 + 점음표 규칙 포함)
      if (boundaries.length > 0) {
        const onBeat = pos % beatSize === 0;
        fallback = fallback.filter(d => {
          const noteEnd = pos + d;
          if (pos === 0 && noteEnd === total) return true;
          for (const b of boundaries) {
            if (pos < b && noteEnd > b) {
              if (pos === 0 && DOTTED_SIXTEENTHS.has(d)) continue;
              if (allowTies && d === 8 && onBeat) continue;
              return false;
            }
          }
          if (!onBeat) {
            for (const b of allBeatBounds) {
              if (pos < b && noteEnd > b) return false;
            }
          }
          return true;
        });
      }

      if (fallback.length) {
        result.push(fallback[0]);
        pos += fallback[0];
        rem -= fallback[0];
      } else {
        // 최소 단위(16분음표)로 채움
        result.push(1);
        pos += 1;
        rem -= 1;
      }
    } else {
      const d = rand(avail);
      result.push(d);
      pos += d;
      rem -= d;
    }
  }
  return result;
}

function generateProgression(measures: number): number[] {
  const patterns = [[0,3,4,0],[0,4,5,3],[0,3,0,4]];
  const result: number[] = [];
  while (result.length < measures) {
    for (const c of rand(patterns)) {
      if (result.length < measures) result.push(c);
    }
  }
  if (measures >= 2) {
    result[measures - 2] = 4;
    result[measures - 1] = 0;
  } else if (measures === 1) {
    result[0] = 0;
  }
  return result;
}

// ── 셋잇단음표 삽입 ──
function tryInsertTriplet(
  notes: ScoreNote[],
  pitchFn: (idx: number) => { pitch: PitchName; octave: number },
  maxRemaining: number,
  prob: number,
): { inserted: boolean; lastNn?: number } {
  if (maxRemaining < 4 || Math.random() > prob) return { inserted: false };
  for (let k = 0; k < 3; k++) {
    const { pitch, octave } = pitchFn(k);
    notes.push({
      id: uid(), pitch, octave, accidental: '' as Accidental,
      duration: '8', tie: false,
      ...(k === 0 ? { tuplet: '3' as const, tupletSpan: '4' as NoteDuration, tupletNoteDur: 2 } : {}),
    });
  }
  return { inserted: true };
}

// ────────────────────────────────────────────────────────────────
// ★ 종지 쉼표 — 마지막 마디 하드코딩
// ────────────────────────────────────────────────────────────────
function generateCadenceMeasure(
  scale: PitchName[],
  trebleBase: number,
  bassBase: number,
  sixteenthsPerBar: number,
  useGrandStaff: boolean,
  keySignature: string,
): { treble: ScoreNote[]; bass: ScoreNote[] } {
  const tonicPitch = scale[0];
  const bassDeg    = noteNumToNote(0, scale, bassBase);
  let bassOctave = Math.max(2, Math.min(3, bassDeg.octave));

  const canUsePatternB = sixteenthsPerBar >= 16 && !!SIXTEENTHS_TO_DUR[12] && !!SIXTEENTHS_TO_DUR[4];
  const usePatternB    = canUsePatternB && Math.random() < 0.5;

  const noteSixteenths = usePatternB ? 12 : Math.min(8, sixteenthsPerBar);
  const restSixteenths = sixteenthsPerBar - noteSixteenths;

  const noteDur = SIXTEENTHS_TO_DUR[noteSixteenths] || '2';

  const trebleMelody = makeNote(tonicPitch, trebleBase, noteDur);
  let bassMelody = makeNote(bassDeg.pitch, bassOctave, noteDur);
  while (
    useGrandStaff &&
    noteToMidiWithKey(trebleMelody, keySignature) === noteToMidiWithKey(bassMelody, keySignature) &&
    bassOctave > 2
  ) {
    bassOctave--;
    bassMelody = makeNote(bassDeg.pitch, bassOctave, noteDur);
  }

  // 트레블: 강박(pos 0)에서 tonic 시작 → 종결감 유지
  const treble: ScoreNote[] = [makeNote(tonicPitch, trebleBase, noteDur)];
  if (restSixteenths > 0) {
    treble.push(makeRest(SIXTEENTHS_TO_DUR[restSixteenths] || '4'));
  }

  const bass: ScoreNote[] = useGrandStaff ? [bassMelody] : [];
  if (useGrandStaff && restSixteenths > 0) {
    bass.push(makeRest(SIXTEENTHS_TO_DUR[restSixteenths] || '4'));
  }

  return { treble, bass };
}

// ────────────────────────────────────────────────────────────────
// ★ 곡 내부 쉼표 — 후처리
// ────────────────────────────────────────────────────────────────
function applyInternalRests(
  treble: ScoreNote[],
  bass: ScoreNote[],
  difficulty: Difficulty,
  measures: number,
  sixteenthsPerBar: number,
  useGrandStaff: boolean,
): void {
  const lvl = difficultyLevel(difficulty);
  const params = LEVEL_PARAMS[difficulty];

  // 쉼표 예산: L1=0, L2+=2분쉼표, L3+=8분쉼표, L6+=16분쉼표
  const maxBudget = lvl === 1 ? 0 : lvl <= 4 ? 2 : lvl <= 6 ? 3 : 4;
  // restProb > 0이면 반드시 1~maxBudget개 쉼표 삽입
  const budget = maxBudget === 0 || params.restProb === 0
    ? 0
    : Math.floor(Math.random() * maxBudget) + 1;
  if (budget === 0) return;

  type NotePos = { noteIdx: number; bar: number; offset: number; dur: number };
  const sizMap: Record<NoteDuration, number> = {
    '1': 16, '1.': 24, '2': 8, '2.': 12, '4': 4, '4.': 6, '8': 2, '8.': 3, '16': 1,
  };

  const timeline: NotePos[] = [];
  let pos = 0;
  for (let i = 0; i < treble.length; i++) {
    const dur = sizMap[treble[i].duration] ?? 4;
    timeline.push({ noteIdx: i, bar: Math.floor(pos / sixteenthsPerBar), offset: pos % sixteenthsPerBar, dur });
    pos += dur;
  }

  const inTuplet = new Set<number>();
  for (let i = 0; i < treble.length; i++) {
    const note = treble[i];
    if (note.tuplet) {
      const count = parseInt(note.tuplet, 10);
      for (let k = 0; k < count; k++) inTuplet.add(i + k);
    }
  }

  const bassRestAt = new Set<string>();
  if (useGrandStaff) {
    let bpos = 0;
    for (const bn of bass) {
      const bdur = sizMap[bn.duration] ?? 4;
      if (bn.pitch === 'rest') {
        bassRestAt.add(`${Math.floor(bpos / sixteenthsPerBar)}_${bpos % sixteenthsPerBar}`);
      }
      bpos += bdur;
    }
  }

  const isRest = (idx: number) => treble[idx]?.pitch === 'rest';

  let candidates: NotePos[] = [];

  if (lvl <= 2) {
    // L2: 4분음표만, 약박 위치
    candidates = timeline.filter((p, idx) =>
      p.dur === 4 &&
      (p.offset === 4 || p.offset === 12) &&
      !isRest(p.noteIdx) &&
      !inTuplet.has(p.noteIdx) &&
      !isRest(timeline[idx - 1]?.noteIdx ?? -1) &&
      !isRest(timeline[idx + 1]?.noteIdx ?? -1)
    );
  } else if (lvl <= 6) {
    // 중급: 4분 + 8분 쌍
    const quarterCandidates = timeline.filter((p, idx) =>
      p.dur === 4 &&
      (p.offset === 4 || p.offset === 12) &&
      !isRest(p.noteIdx) && !inTuplet.has(p.noteIdx) &&
      !isRest(timeline[idx - 1]?.noteIdx ?? -1) &&
      !isRest(timeline[idx + 1]?.noteIdx ?? -1)
    );
    const eighthCandidates = timeline.filter((p, idx) => {
      if (p.dur !== 2) return false;
      const next = timeline[idx + 1];
      if (!next || next.dur !== 2) return false;
      if (p.bar === 0 && p.offset === 0) return false;
      return !isRest(p.noteIdx) && !inTuplet.has(p.noteIdx) &&
        !isRest(timeline[idx - 1]?.noteIdx ?? -1) && !isRest(next.noteIdx);
    });
    candidates = [...quarterCandidates, ...quarterCandidates, ...quarterCandidates, ...eighthCandidates];
  } else {
    // 고급: 16분 그룹 4개
    const firstSet: NotePos[] = [];
    const secondSet: NotePos[] = [];
    timeline.forEach((p, idx) => {
      if (p.dur !== 1) return;
      const n1 = timeline[idx + 1];
      const n2 = timeline[idx + 2];
      const n3 = timeline[idx + 3];
      if (!n1 || !n2 || !n3) return;
      if (n1.dur !== 1 || n2.dur !== 1 || n3.dur !== 1) return;
      if (p.bar === 0 && p.offset === 0) return;
      if (!isRest(p.noteIdx) && !inTuplet.has(p.noteIdx) &&
          !isRest(timeline[idx - 1]?.noteIdx ?? -1) && !isRest(n1.noteIdx))
        firstSet.push(p);
      if (!isRest(n1.noteIdx) && !inTuplet.has(n1.noteIdx) &&
          !isRest(p.noteIdx) && !isRest(n2.noteIdx))
        secondSet.push(n1);
    });
    candidates = Math.random() < 0.5 ? firstSet : secondSet;
  }

  candidates = candidates.filter(p =>
    p.bar < measures - 1 &&
    !bassRestAt.has(`${p.bar}_${p.offset}`)
  );

  if (candidates.length === 0) return;

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const chosen: NotePos[] = [];
  const chosenIdx = new Set<number>();
  for (const c of shuffled) {
    if (chosen.length >= budget) break;
    const prevIdx = c.noteIdx - 1;
    const nextIdx = c.noteIdx + 1;
    if (chosenIdx.has(prevIdx) || chosenIdx.has(nextIdx)) continue;
    chosen.push(c);
    chosenIdx.add(c.noteIdx);
  }

  for (const c of chosen) {
    if (c.noteIdx > 0 && treble[c.noteIdx - 1]?.tie) {
      treble[c.noteIdx - 1] = { ...treble[c.noteIdx - 1], tie: false };
    }
    treble[c.noteIdx] = makeRest(treble[c.noteIdx].duration);
  }
}

// ────────────────────────────────────────────────────────────────
// Main generator
// ────────────────────────────────────────────────────────────────

export function generateScore(opts: GeneratorOptions): GeneratedScore {
  const { keySignature, timeSignature, difficulty, measures, useGrandStaff } = opts;
  const bassDifficulty = opts.bassDifficulty;
  let prevBassNn = 0;
  if (measures < 1) throw new Error('measures must be >= 1');
  if (!timeSignature || !timeSignature.includes('/')) throw new Error(`Invalid timeSignature: ${timeSignature}`);
  const scale             = getScaleDegrees(keySignature);
  const sixteenthsPerBar  = getSixteenthsPerBar(timeSignature);
  const pool              = DURATION_POOL[difficulty];
  const progression       = generateProgression(measures);
  const lvl               = difficultyLevel(difficulty);
  const params            = LEVEL_PARAMS[difficulty];

  /** 셋잇단음표 정박 체크용 박 단위 (16분음표 기준) */
  const beatSize = (() => {
    const [topStr, botStr] = timeSignature.split('/');
    const top = parseInt(topStr, 10);
    const bot = parseInt(botStr, 10);
    // 복합 박자(6/8, 9/8, 12/8): 점4분(6 sixteenths)이 한 박
    if (bot === 8 && top % 3 === 0 && top >= 6) return 6;
    return 16 / (bot || 4);
  })();

  // 임시표/셋잇단 예산 — 조표 밀도 + 마디 수: 짧은 곡은 보정을 약하게, 긴 곡은 같은 조에서 임시표가 마디에 고르게 쓰이도록 상향
  const keyAccCount = getKeySignatureAccidentalCount(keySignature);
  /** 1마디 근처 ~0.65, 8마디 ~1.2, 16마디 이상 상한 ~1.75 */
  const measureDensity = Math.max(
    0.62,
    Math.min(1.75, 0.48 + measures * 0.092),
  );
  const keyDensityBase = keyAccCount * 0.6 + (keyAccCount >= 5 ? 1 : 0);
  const accidentalBudgetExtra = Math.min(
    8,
    Math.floor(keyDensityBase * measureDensity),
  );
  let accidentalBudget = params.chromaticBudget[0] +
    Math.floor(Math.random() * (params.chromaticBudget[1] - params.chromaticBudget[0] + 1));
  accidentalBudget += accidentalBudgetExtra;
  const chromaticProbEffective = Math.min(
    0.48,
    params.chromaticProb
      + keyAccCount * 0.017 * measureDensity
      + (lvl >= 4 ? 0.035 * Math.min(1.25, 0.75 + measures * 0.04) : 0),
  );

  let tripletBudget = params.tripletBudget[0] +
    Math.floor(Math.random() * (params.tripletBudget[1] - params.tripletBudget[0] + 1));

  const trebleNotes: ScoreNote[] = [];
  const bassNotes:   ScoreNote[] = [];

  const TREBLE_BASE = 4;
  const BASS_BASE   = 3;

  let nn              = rand([0, 2, 4]); // 시작: 으뜸3화음 구성음
  let prevDir         = 0;
  let prevInterval    = 0;
  let pendingResolution: PitchName | null = null;

  let lastTrebleDur: number | undefined;
  for (let bar = 0; bar < measures - 1; bar++) {
    const trebleBarStart = trebleNotes.length;
    const tones  = CHORD_TONES[progression[bar]];
    const rhythm = fillRhythm(sixteenthsPerBar, pool, {
      timeSignature, lastDur: lastTrebleDur,
      syncopationProb: params.syncopationProb,
      dottedProb: params.dottedProb,
      allowTies: lvl >= 5,
    });
    if (rhythm.length > 0) {
      lastTrebleDur = rhythm[rhythm.length - 1];
    }

    let barPos = 0;
    for (let i = 0; i < rhythm.length; i++) {
      const dur      = rhythm[i];
      const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';

      // ── 반음계 해결 처리 ──
      if (lvl >= 3 && pendingResolution) {
        const rp = pendingResolution; pendingResolution = null;
        const degIdx = scale.indexOf(rp);
        if (degIdx >= 0) nn = Math.round(nn / 7) * 7 + degIdx;
        const { pitch, octave } = noteNumToNote(nn, scale, TREBLE_BASE);
        trebleNotes.push(makeNote(pitch, octave, durLabel));
        barPos += dur; prevInterval = 0; continue;
      }

      // ── 음정 선택 ──
      if (!(bar === 0 && i === 0)) {
        let interval: number;

        // 도약 후 반대방향 순차진행으로 보정 (문서 ②번 규칙)
        if (Math.abs(prevInterval) >= 3) {
          if (lvl >= 7) {
            interval = prevDir > 0 ? rand([-1,-2]) : rand([1,2]);
          } else {
            interval = prevDir > 0 ? -1 : 1;
          }
        } else if (Math.random() < params.stepwiseProb) {
          // 순차진행
          interval = rand([1, -1]);
        } else {
          // 도약
          const maxLeap = params.maxLeap;
          const leapOptions: number[] = [];
          for (let l = 2; l <= Math.min(maxLeap, params.maxInterval); l++) {
            leapOptions.push(l, -l);
          }
          interval = leapOptions.length > 0 ? rand(leapOptions) : rand([1, -1]);
        }

        const prev = nn;
        nn += interval;

        // 음역 제한: 레벨별
        const rangeMin = -2;
        const rangeMax = lvl <= 2 ? 7 : 10;
        nn = Math.max(rangeMin, Math.min(rangeMax, nn));

        // 화음톤 스냅
        const snapChance = lvl >= 7 ? 0.3 : 0.4;
        if (Math.random() < snapChance) {
          let best = nn, bestDist = Infinity;
          for (const t of tones) {
            for (const base of [
              Math.floor(nn/7)*7+t,
              Math.floor(nn/7)*7+t-7,
              Math.floor(nn/7)*7+t+7,
            ]) {
              const d = Math.abs(base - nn);
              if (d < bestDist) { bestDist = d; best = base; }
            }
          }
          nn = Math.max(rangeMin, Math.min(rangeMax, best));
        }

        prevInterval = nn - prev;
        prevDir = prevInterval > 0 ? 1 : prevInterval < 0 ? -1 : prevDir;
      }

      // ── 셋잇단음표 삽입 ──
      if (tripletBudget > 0 && dur === 4 && lvl >= 4 && barPos % beatSize === 0) {
        const tripResult = tryInsertTriplet(trebleNotes, (k) => {
          nn = Math.max(-2, Math.min(9, nn + rand([1,-1,2,-2])));
          return noteNumToNote(nn, scale, TREBLE_BASE);
        }, dur, params.tripletProb);
        if (tripResult.inserted) { tripletBudget--; barPos += dur; continue; }
      }

      const { pitch, octave } = noteNumToNote(nn, scale, TREBLE_BASE);

      // ── 임시표(반음계) 삽입 — 조표·난이도에 맞게 #/b/n 분배 (조표만으로는 표기 안 되는 중복 방지) ──
      if (accidentalBudget > 0 && i < rhythm.length - 1 && Math.random() < chromaticProbEffective) {
        if (scale.includes(pitch)) {
          const acc = pickChromaticAccidental(keySignature, pitch, difficulty);
          trebleNotes.push(makeNote(pitch, octave, durLabel, acc));
          if (acc === '#' || acc === 'n') {
            pendingResolution = CHROMATIC_RESOLUTION[pitch];
          } else {
            pendingResolution = pitch;
          }
          accidentalBudget--;
          barPos += dur; continue;
        }
      }

      // ── 붙임줄(타이): 직전 음과 높이가 같을 때 prevMel에 tie 부여 (ABC `-`는 앞→뒤 연결)
      const prevMel = lastNonRestMelody(trebleNotes);
      if (
        prevMel &&
        samePitchHeight(prevMel, pitch, octave, '' as Accidental) &&
        Math.random() < params.tieProb &&
        i > 0 &&
        i < rhythm.length - 1 &&
        barPos > 0
      ) {
        prevMel.tie = true;
        trebleNotes.push(makeNote(pitch, octave, durLabel));
        barPos += dur;
        continue;
      }

      trebleNotes.push(makeNote(pitch, octave, durLabel));
      barPos += dur;
    }

    // ── 베이스 생성 (트레블과 동시에 같은 건반 음이 나오지 않게) ──
    if (useGrandStaff) {
      const barTrebleSlice = trebleNotes.slice(trebleBarStart);
      const trebleAttackMap = buildTrebleAttackMidiMap(barTrebleSlice, keySignature);
      if (bassDifficulty) {
        prevBassNn = generateBassForBar(
          bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale,
          keySignature, trebleAttackMap, timeSignature, bassDifficulty, prevBassNn,
        );
      } else if (lvl >= 4 && params.bassIndependence > 0.3) {
        generateIndependentBass(
          bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale, params,
          keySignature, trebleAttackMap, timeSignature, pool,
        );
      } else {
        generateBasicBass(
          bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale, keySignature, trebleAttackMap, timeSignature, pool,
        );
      }
    }
  }

  // ── 종지 마디 ──
  const cadence = generateCadenceMeasure(
    scale, TREBLE_BASE, BASS_BASE, sixteenthsPerBar, useGrandStaff, keySignature,
  );
  trebleNotes.push(...cadence.treble);
  bassNotes.push(...cadence.bass);

  // ── 후처리: 내부 쉼표 ──
  applyInternalRests(trebleNotes, bassNotes, difficulty, measures, sixteenthsPerBar, useGrandStaff);

  // ── 후처리: 박자 경계 분할 (중급 2단계 이상에서만) ──
  const finalTreble = lvl >= 5
    ? splitAtBeatBoundaries(trebleNotes, timeSignature)
    : trebleNotes;
  const finalBass = useGrandStaff
    ? (lvl >= 5 ? splitAtBeatBoundaries(bassNotes, timeSignature) : bassNotes)
    : bassNotes;

  // ── 후처리: 연속 붙임줄 2회 제한 — 연속된 2개의 tie 중 마지막 제거 ──
  for (let i = 0; i < finalTreble.length - 1; i++) {
    if (finalTreble[i].tie && finalTreble[i + 1].tie) {
      finalTreble[i + 1] = { ...finalTreble[i + 1], tie: false };
    }
  }
  if (useGrandStaff) {
    for (let i = 0; i < finalBass.length - 1; i++) {
      if (finalBass[i].tie && finalBass[i + 1].tie) {
        finalBass[i + 1] = { ...finalBass[i + 1], tie: false };
      }
    }
  }

  return { trebleNotes: finalTreble, bassNotes: finalBass };
}

/** 베이스-트레블 충돌 해결: 같은 건반 음이면 옥타브 하강 → 대체 화음톤 */
function resolveBassClash(
  note: ScoreNote, bnn: number, oct: number, durLabel: NoteDuration,
  bassOff: number, scale: PitchName[], bassBase: number,
  keySignature: string, trebleAttackMap: Map<number, number>,
): ScoreNote {
  const clashMidi = trebleAttackMap.get(bassOff);
  if (clashMidi === undefined) return note;

  const bassMidi = noteToMidiWithKey(note, keySignature);

  // 동일 건반 충돌 해소
  if (bassMidi === clashMidi) {
    const lowOct = Math.max(2, oct - 1);
    let resolved = makeNote(note.pitch as PitchName, lowOct, durLabel);
    if (noteToMidiWithKey(resolved, keySignature) === clashMidi) {
      let b2 = (bnn + 2) % 7;
      if (b2 > 4) b2 -= 7;
      const alt = noteNumToNote(b2, scale, bassBase);
      resolved = makeNote(alt.pitch, Math.max(2, Math.min(4, alt.octave)), durLabel);
    }
    return resolved;
  }

  // §4 성부 간격: 단 10도(15반음) 미만이면 베이스 한 옥타브 하강
  if (clashMidi - bassMidi < MIN_TREBLE_BASS_SEMITONES && oct > 2) {
    const lowOct = oct - 1;
    const lowered = makeNote(note.pitch as PitchName, Math.max(2, lowOct), durLabel);
    if (noteToMidiWithKey(lowered, keySignature) <= clashMidi - MIN_TREBLE_BASS_SEMITONES) {
      return lowered;
    }
  }

  return note;
}

// ── 베이스 난이도별 생성 (bass_1~bass_9) ─────────────────────
function generateBassForBar(
  bassNotes: ScoreNote[],
  trebleRhythm: number[],
  sixteenthsPerBar: number,
  chordRoot: number,
  scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature: string,
  bassDifficulty: BassDifficulty,
  prevBassNn: number,
): number {
  const BASS_BASE = 3;
  const bp = BASS_LEVEL_PARAMS[bassDifficulty];
  const bTones = CHORD_TONES[chordRoot];

  // 근음·3음·5음 bnn 정규화 (베이스 음역 -5 ~ 4)
  const rootBnn  = chordRoot > 4 ? chordRoot - 7 : chordRoot;
  const thirdBnn = bTones[1] > 4 ? bTones[1] - 7 : bTones[1];
  const fifthBnn = bTones[2] > 4 ? bTones[2] - 7 : bTones[2];

  /** 가장 가까운 화음 구성음으로 snap */
  const snapToChordTone = (nn: number): number => {
    let best = nn, bestDist = Infinity;
    for (const t of bTones) {
      for (const base of [
        Math.floor(nn / 7) * 7 + t,
        Math.floor(nn / 7) * 7 + t - 7,
        Math.floor(nn / 7) * 7 + t + 7,
      ]) {
        const d = Math.abs(base - nn);
        if (d < bestDist) { bestDist = d; best = base; }
      }
    }
    return Math.max(-5, Math.min(4, best));
  };

  /** 음 하나 출력 — 충돌 해결 후 bassNotes에 추가, 실제 bnn 반환 */
  const emitNote = (nn: number, dur: number, off: number): number => {
    const n = Math.max(-5, Math.min(4, nn));
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    const { pitch, octave } = noteNumToNote(n, scale, BASS_BASE);
    const oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, n, oct, durLabel, off, scale, BASS_BASE, keySignature, trebleAttackMap);
    bassNotes.push(note);
    return n;
  };

  const bassRhythm = fillRhythm(sixteenthsPerBar, bp.durationPool, {
    timeSignature, minDur: bp.minDur,
  });

  let bnn = rootBnn;
  let bassOff = 0;

  switch (bp.mode) {

    // ── 1단: 지속음 — 마디 전체 근음 유지 ──────────────────────
    case 'pedal': {
      const durLabel = SIXTEENTHS_TO_DUR[sixteenthsPerBar] || '1';
      const { pitch, octave } = noteNumToNote(rootBnn, scale, BASS_BASE);
      const oct = Math.max(2, Math.min(3, octave));
      let note = makeNote(pitch, oct, durLabel);
      note = resolveBassClash(note, rootBnn, oct, durLabel, 0, scale, BASS_BASE, keySignature, trebleAttackMap);
      bassNotes.push(note);
      return rootBnn;
    }

    // ── 2단: 근음 정박 — 각 박마다 코드 근음 ───────────────────
    case 'root_beat': {
      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = emitNote(rootBnn, bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return bnn;
    }

    // ── 3단: 방향 고정 순차 진행 (도-시-라-솔) ──────────────────
    case 'directed_step': {
      const dir = Math.random() < 0.5 ? 1 : -1;
      bnn = rootBnn;
      for (let j = 0; j < bassRhythm.length; j++) {
        if (j > 0) {
          bnn += dir;
          if (bnn > 4)  bnn = 3;
          if (bnn < -5) bnn = -4;
        }
        bnn = emitNote(bnn, bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return bnn;
    }

    // ── 4단: 쿵-짝 (근음 ↔ 5음 교대, 5음은 루트 위) ────────────
    case 'alternating': {
      // 5음이 근음보다 아래에 있으면 한 옥타브 위로 올려서 '짝' 위치에 배치
      const hiFifth = fifthBnn <= rootBnn ? fifthBnn + 7 : fifthBnn;
      const pattern = [rootBnn, Math.min(4, hiFifth)];
      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = emitNote(pattern[j % 2], bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return bnn;
    }

    // ── 5단: 도약 진행 (4·5도 도약, C→낮은 솔 패턴) ────────────
    case 'leap': {
      // 낮은 5음 = 근음보다 아래에 위치한 5음 (한 옥타브 아래)
      const lowFifth = fifthBnn >= rootBnn ? fifthBnn - 7 : fifthBnn;
      // 근음 ↔ 낮은5음 ↔ 3음 ↔ 근음 패턴
      const leapPattern = [rootBnn, Math.max(-5, lowFifth), thirdBnn, rootBnn];
      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = emitNote(leapPattern[j % leapPattern.length], bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return bnn;
    }

    // ── 6단: 분산화음 arpeggio (근-3-5-3 반복) ─────────────────
    case 'arpeggio': {
      // 3음·5음은 근음 위로 올림
      const hi3 = thirdBnn <= rootBnn ? thirdBnn + 7 : thirdBnn;
      const hi5 = fifthBnn <= rootBnn ? fifthBnn + 7 : fifthBnn;
      const arp = [rootBnn, Math.min(4, hi3), Math.min(4, hi5), Math.min(4, hi3)];
      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = emitNote(arp[j % arp.length], bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return bnn;
    }

    // ── 7단: 전위 화음 — 3음 또는 5음이 베이스 ─────────────────
    case 'inversion': {
      // 하행 베이스 라인: 5음(높)→3음→근음  또는  3음→근음→5음(낮)
      const descLine = Math.random() < 0.5
        ? [Math.min(4, fifthBnn < rootBnn ? fifthBnn + 7 : fifthBnn), thirdBnn, rootBnn]
        : [thirdBnn, rootBnn, Math.max(-5, fifthBnn > rootBnn ? fifthBnn - 7 : fifthBnn)];
      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = emitNote(descLine[j % descLine.length], bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return bnn;
    }

    // ── 8단: 싱코페이션 — 강박 쉼표, 엇박에 음 ─────────────────
    case 'syncopated': {
      const [, bs] = timeSignature.split('/');
      const beatSize = 16 / (parseInt(bs, 10) || 4);
      let pos = 0;
      bnn = rootBnn;
      for (let j = 0; j < bassRhythm.length; j++) {
        const dur = bassRhythm[j];
        // 강박(박 경계)이고 마지막 음이 아니면 쉼표
        if (pos % beatSize === 0 && j < bassRhythm.length - 1) {
          bassNotes.push(makeRest(SIXTEENTHS_TO_DUR[dur] || '4'));
        } else {
          bnn = emitNote(j % 2 === 0 ? rootBnn : snapToChordTone(rootBnn + rand([3, -3, 4, -4])), dur, pos);
        }
        pos += dur;
      }
      bassOff = pos;
      return bnn;
    }

    // ── 9단: 반진행 — 마디 단위 반진행 + 강박 이동 보장 + 병행 완전음정 방지 ─
    case 'contrary': {
      const [, bs] = timeSignature.split('/');
      const beatSize = 16 / (parseInt(bs, 10) || 4);

      // 트레블 공격 목록 (시간순 정렬)
      const trebleAttacks = [...trebleAttackMap.entries()].sort(([a], [b]) => a - b);

      // pos에서 가장 최근 트레블 MIDI 값
      const getTrebleMidiAt = (pos: number): number | undefined => {
        let result: number | undefined;
        for (const [off, midi] of trebleAttacks) {
          if (off <= pos) result = midi;
          else break;
        }
        return result;
      };

      // bnn → MIDI 변환
      const bnnToMidi = (n: number): number => {
        const clamped = Math.max(-5, Math.min(4, n));
        const { pitch, octave } = noteNumToNote(clamped, scale, BASS_BASE);
        const oct = Math.max(2, Math.min(4, octave));
        return noteToMidiWithKey(makeNote(pitch, oct, '4'), keySignature);
      };

      // 방향 인식 화음 구성음 snap — 현재 위치 제외, 방향 강력 선호
      const snapDir = (nn: number, preferDir: number): number => {
        let best: number | undefined;
        let bestScore = Infinity;
        for (const t of bTones) {
          for (const base of [
            Math.floor(nn / 7) * 7 + t,
            Math.floor(nn / 7) * 7 + t - 7,
            Math.floor(nn / 7) * 7 + t + 7,
          ]) {
            if (base === nn || base < -5 || base > 4) continue; // 현재 위치 제외
            const d = Math.abs(base - nn);
            const wrongDir = preferDir !== 0 && Math.sign(base - nn) !== preferDir;
            const score = d + (wrongDir ? 10 : 0); // 방향 페널티 강화
            if (score < bestScore) { bestScore = score; best = base; }
          }
        }
        return Math.max(-5, Math.min(4, best ?? nn));
      };

      // 병행 완전음정(5도/8도) 검사
      const hasParallelPerfect = (
        pBMidi: number, pTMidi: number | undefined,
        cBMidi: number, cTMidi: number | undefined,
      ): boolean => {
        if (pTMidi === undefined || cTMidi === undefined) return false;
        const pInt = ((pTMidi - pBMidi) % 12 + 12) % 12;
        const cInt = ((cTMidi - cBMidi) % 12 + 12) % 12;
        if ((pInt !== 0 && pInt !== 7) || (cInt !== 0 && cInt !== 7)) return false;
        return Math.sign(cBMidi - pBMidi) !== 0 &&
          Math.sign(cBMidi - pBMidi) === Math.sign(cTMidi - pTMidi);
      };

      // 마디 전체 트레블 방향으로 반진행 방향 결정 (진동 방지)
      const globalTDir = trebleAttacks.length >= 2
        ? (trebleAttacks[trebleAttacks.length - 1][1] > trebleAttacks[0][1] ? 1 : -1) : 0;
      const bassDir = globalTDir === 0 ? (Math.random() < 0.5 ? 1 : -1) : -globalTDir;

      bnn = snapToChordTone(prevBassNn !== 0 ? prevBassNn : rootBnn);

      let pos = 0;
      let prevBMidi = bnnToMidi(bnn);
      let prevTMidi = getTrebleMidiAt(0);

      for (let j = 0; j < bassRhythm.length; j++) {
        if (j > 0) {
          if (pos % beatSize === 0) {
            // 강박: 현재 위치 제외 + 방향 강력 선호 chord tone snap → 반드시 이동 보장
            bnn = snapDir(bnn, bassDir);
          } else {
            // 약박: 순차 경과음 (passing tone)
            bnn = Math.max(-5, Math.min(4, bnn + bassDir));
          }
        }

        // 병행 완전음정 보정 — 위반 시 한 step 추가 이동
        const currTMidi = getTrebleMidiAt(pos);
        if (j > 0 && hasParallelPerfect(prevBMidi, prevTMidi, bnnToMidi(bnn), currTMidi)) {
          bnn = Math.max(-5, Math.min(4, bnn + bassDir));
        }

        bnn = emitNote(bnn, bassRhythm[j], bassOff);
        prevBMidi = bnnToMidi(bnn);
        prevTMidi = currTMidi;
        bassOff += bassRhythm[j];
        pos += bassRhythm[j];
      }
      return bnn;
    }

    default:
      return rootBnn;
  }
}

// ── 초급 베이스: 화음톤 기반 ─────────────────────────────────
function generateBasicBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature?: string,
  pool?: number[],
) {
  const BASS_BASE   = 3;
  const bTones      = CHORD_TONES[chordRoot];
  // 난이도 풀 우선, 없으면 트레블 기반 폴백
  const bassPool = pool ?? (trebleRhythm.some(d => d <= 2) ? [16, 8] : [8, 4]);
  const bassRhythm  = fillRhythm(sixteenthsPerBar, bassPool, { timeSignature, minDur: 2 });

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

  let bassOff = 0;
  for (let j = 0; j < bassRhythm.length; j++) {
    const dur      = bassRhythm[j];
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    if (j > 0) { bnn = rand(bTones); if (bnn > 4) bnn -= 7; }
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, bnn, oct, durLabel, bassOff, scale, BASS_BASE, keySignature, trebleAttackMap);
    bassNotes.push(note);
    bassOff += dur;
  }
}

// ── 중급 베이스: 독립적 리듬 프로필 ─────────────────────────
function generateIndependentBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[], params: LevelParams,
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature?: string,
  pool?: number[],
) {
  const BASS_BASE   = 3;
  const bTones      = CHORD_TONES[chordRoot];

  // 난이도 풀 우선, 없으면 독립도 기반 폴백
  let bassPool: number[];
  if (pool) {
    bassPool = pool;
  } else if (params.bassIndependence >= 0.6) {
    bassPool = [8, 6, 4, 2];
  } else {
    const trebleShort = trebleRhythm.some(d => d <= 2);
    bassPool = trebleShort ? [8, 4] : [8, 6, 4];
  }

  const bassRhythm = fillRhythm(sixteenthsPerBar, bassPool, { timeSignature, minDur: 2 });

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

  let bassOff = 0;
  for (let j = 0; j < bassRhythm.length; j++) {
    const dur      = bassRhythm[j];
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    if (j > 0) {
      // 순차진행 + 화음톤 혼합
      if (Math.random() < 0.4) {
        bnn += rand([1, -1]); // 순차
      } else {
        bnn = rand(bTones);
      }
      if (bnn > 4) bnn -= 7;
    }
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, bnn, oct, durLabel, bassOff, scale, BASS_BASE, keySignature, trebleAttackMap);
    bassNotes.push(note);
    bassOff += dur;
  }
}

// ── 고급 베이스: 분산화음(아르페지오) / 워킹베이스 ────────────
function generateArpeggioBass(
  bassNotes: ScoreNote[],
  sixteenthsPerBar: number,
  chordRoot: number,
  scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
) {
  const BASS_BASE = 3;
  const pattern = [CHORD_TONES[chordRoot][0], CHORD_TONES[chordRoot][2], CHORD_TONES[chordRoot][1], CHORD_TONES[chordRoot][2]];

  const totalEighths = Math.floor(sixteenthsPerBar / 2);
  const leftover     = sixteenthsPerBar % 2;

  let bassOff = 0;
  for (let j = 0; j < totalEighths; j++) {
    let bnn = pattern[j % pattern.length];
    if (bnn > 4) bnn -= 7;
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, '8');
    note = resolveBassClash(note, bnn, oct, '8', bassOff, scale, BASS_BASE, keySignature, trebleAttackMap);
    bassNotes.push(note);
    bassOff += 2;
  }

  if (leftover > 0) {
    let bnn = pattern[totalEighths % pattern.length];
    if (bnn > 4) bnn -= 7;
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, '16');
    note = resolveBassClash(note, bnn, oct, '16', bassOff, scale, BASS_BASE, keySignature, trebleAttackMap);
    bassNotes.push(note);
  }
}
