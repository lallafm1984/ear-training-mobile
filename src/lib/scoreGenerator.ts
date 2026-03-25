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

/** 오른손(V1) 음역대 하한선 — C3 (MIDI 48). 이보다 낮으면 옥타브 올림 */
const V1_MIN_MIDI = 48;
/** 양손 최소 간격 (반음). 베이스 MIDI < 트레블 MIDI - 이 값 이어야 교차 아님 */
const MIN_VOICE_GAP = 2;

const CHORD_TONES: Record<number, number[]> = {
  0: [0, 2, 4], 1: [1, 3, 5], 2: [2, 4, 6],
  3: [3, 5, 0], 4: [4, 6, 1], 5: [5, 0, 2], 6: [6, 1, 3],
};

/**
 * 9단계별 리듬 풀 (16분음표 단위)
 * 문서 기반:
 *   L1: 온(16), 2분(8), 4분(4) — 4/4 고정, BPM 60~72
 *   L2: + 8분(2), 점2분(12) — BPM 66~80
 *   L3: + 점4분(6), 8분 쉼표 — BPM 72~92 (예고 입시)
 *   L4(중급1): L3와 동일 + 당김음 확률 증가
 *   L5(중급2): + 16분(1), 점8분(3), 4분 셋잇단 — BPM 80~108 (음대 입시)
 *   L6(중급3): L5 확장 + 역점음, alla breve
 *   L7(고급1): + 32분 패시지, 8분 셋잇단, 불규칙박자 — BPM 88~120
 *   L8(고급2): L7 확장 + 헤미올라, 겹점음표
 *   L9(고급3): 모든 음가 + 5연음, 다중리듬 — BPM 96~144
 */
const DURATION_POOL: Record<Difficulty, number[]> = {
  // 초급 1: 온·2분·4분 — 기본 박 단위만
  beginner_1:     [16, 8, 4],
  // 초급 2: + 8분(쌍묶음), 점2분 — 세분화 시작
  beginner_2:     [16, 12, 8, 4, 2],
  // 초급 3: + 점4분(6/8 핵심), 복합박자 도입 (예고 입시)
  beginner_3:     [12, 8, 6, 4, 2],
  // 중급 1: 초급3 기반 + 당김음 확률 증가
  intermediate_1: [8, 6, 4, 2],
  // 중급 2: + 16분(1), 점8분(3), 셋잇단 (음대 입시)
  intermediate_2: [8, 6, 4, 3, 2, 1],
  // 중급 3: L5 확장 — 역점음, alla breve 포함
  intermediate_3: [8, 6, 4, 3, 2, 1],
  // 고급 1: + 불규칙박자, 8분 셋잇단, 32분 패시지
  advanced_1:     [4, 3, 2, 1],
  // 고급 2: + 헤미올라, 겹점음표
  advanced_2:     [4, 3, 2, 1],
  // 고급 3: 모든 음가 (서울대·한예종 수준)
  advanced_3:     [4, 3, 2, 1],
};

const CHROMATIC_RESOLUTION: Record<string, PitchName> = {
  'C': 'D', 'D': 'E', 'E': 'F', 'F': 'G', 'G': 'A', 'A': 'B', 'B': 'C',
};

/**
 * 한 마디 트레블: offset(16분) → MIDI (지속 구간 포함).
 * 트레블 2분음표가 유지되는 동안 베이스 8분음표가 교차하는 것도 감지하기 위해
 * 음표의 지속 구간 전체를 맵에 기록한다.
 */
function buildTrebleMidiMap(
  barSlice: ScoreNote[], keySignature: string, barLength: number,
): Map<number, number> {
  const map = new Map<number, number>();
  let off = 0;
  let i = 0;
  while (i < barSlice.length) {
    const n = barSlice[i];
    if (n.tuplet) {
      const p = parseInt(n.tuplet, 10);
      const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
      for (let k = 0; k < p && i + k < barSlice.length; k++) {
        const tn = barSlice[i + k];
        if (tn.pitch !== 'rest') {
          const midi = noteToMidiWithKey(tn, keySignature);
          const nStart = off + Math.floor(k * span / p);
          const nEnd = off + Math.floor((k + 1) * span / p);
          for (let pos = nStart; pos < nEnd && pos < barLength; pos++) {
            map.set(pos, midi);
          }
        }
      }
      off += span;
      i += p;
    } else {
      const dur = durationToSixteenths(n.duration);
      if (n.pitch !== 'rest') {
        const midi = noteToMidiWithKey(n, keySignature);
        for (let pos = off; pos < off + dur && pos < barLength; pos++) {
          map.set(pos, midi);
        }
      }
      off += dur;
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
  if (lvl >= 5) return r < 0.5 ? '#' : 'b';
  return '#';
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
  // ── 초급 1: 완전 기초 (BPM 60~72) ──
  beginner_1: {
    maxInterval: 3, stepwiseProb: 0.90, maxLeap: 3,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0, restProb: 0, dottedProb: 0,
    contraryMotionRatio: 0.30, bassIndependence: 0,
    voiceCrossingMax: 0, consonanceRatio: 1.0,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── 초급 2: 8분음표 도입 (BPM 66~80) ──
  beginner_2: {
    maxInterval: 5, stepwiseProb: 0.80, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.05, restProb: 0.05, dottedProb: 0,
    contraryMotionRatio: 0.30, bassIndependence: 0,
    voiceCrossingMax: 0, consonanceRatio: 1.0,
    cadenceType: ['perfect'],
    maxTraps: 0,
  },
  // ── 초급 3: 복합박자·기초 당김음 (BPM 72~92) — 예고 입시 수준 ──
  beginner_3: {
    maxInterval: 8, stepwiseProb: 0.70, maxLeap: 8,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.10, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.10, restProb: 0.10, dottedProb: 0.15,
    contraryMotionRatio: 0.50, bassIndependence: 0.3,
    voiceCrossingMax: 0, consonanceRatio: 0.90,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── 중급 1: 독립성 태동 — 예고 입시 + α ──
  intermediate_1: {
    maxInterval: 8, stepwiseProb: 0.65, maxLeap: 8,
    chromaticBudget: [0, 1], chromaticProb: 0.072,
    syncopationProb: 0.15, tripletBudget: [0, 1], tripletProb: 0.15,
    tieProb: 0.15, restProb: 0.12, dottedProb: 0.20,
    contraryMotionRatio: 0.55, bassIndependence: 0.45,
    voiceCrossingMax: 0, consonanceRatio: 0.85,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── 중급 2: 16분음표·복잡한 분할 (BPM 80~108) — 음대 입시 수준 ──
  intermediate_2: {
    maxInterval: 6, stepwiseProb: 0.60, maxLeap: 8,
    chromaticBudget: [1, 2], chromaticProb: 0.10,
    syncopationProb: 0.20, tripletBudget: [0, 2], tripletProb: 0.20,
    tieProb: 0.20, restProb: 0.15, dottedProb: 0.25,
    contraryMotionRatio: 0.60, bassIndependence: 0.6,
    voiceCrossingMax: 1, consonanceRatio: 0.80,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── 중급 3: 음대 입시 강화 ──
  intermediate_3: {
    maxInterval: 8, stepwiseProb: 0.55, maxLeap: 8,
    chromaticBudget: [1, 3], chromaticProb: 0.13,
    syncopationProb: 0.25, tripletBudget: [1, 2], tripletProb: 0.25,
    tieProb: 0.25, restProb: 0.18, dottedProb: 0.30,
    contraryMotionRatio: 0.60, bassIndependence: 0.7,
    voiceCrossingMax: 1, consonanceRatio: 0.78,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64'],
    maxTraps: 2,
  },
  // ── 고급 1: 고급 리듬 (BPM 88~120) — 음대 작곡과 수준 ──
  advanced_1: {
    maxInterval: 8, stepwiseProb: 0.50, maxLeap: 9,
    chromaticBudget: [3, 5], chromaticProb: 0.19,
    syncopationProb: 0.35, tripletBudget: [1, 3], tripletProb: 0.30,
    tieProb: 0.30, restProb: 0.20, dottedProb: 0.35,
    contraryMotionRatio: 0.65, bassIndependence: 0.8,
    voiceCrossingMax: 2, consonanceRatio: 0.75,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64', 'phrygian'],
    maxTraps: 3,
  },
  // ── 고급 2: 완전 독립성 — 서울대·한예종 전단계 ──
  advanced_2: {
    maxInterval: 10, stepwiseProb: 0.45, maxLeap: 10,
    chromaticBudget: [3, 5], chromaticProb: 0.23,
    syncopationProb: 0.38, tripletBudget: [1, 3], tripletProb: 0.30,
    tieProb: 0.30, restProb: 0.22, dottedProb: 0.35,
    contraryMotionRatio: 0.70, bassIndependence: 0.9,
    voiceCrossingMax: 3, consonanceRatio: 0.72,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64', 'phrygian'],
    maxTraps: 3,
  },
  // ── 고급 3: 실전 변칙 극복 (BPM 96~144) — 서울대·한예종 수준 ──
  advanced_3: {
    maxInterval: 10, stepwiseProb: 0.40, maxLeap: 12,
    chromaticBudget: [5, 8], chromaticProb: 0.29,
    syncopationProb: 0.40, tripletBudget: [2, 4], tripletProb: 0.35,
    tieProb: 0.30, restProb: 0.25, dottedProb: 0.35,
    contraryMotionRatio: 0.70, bassIndependence: 1.0,
    voiceCrossingMax: 4, consonanceRatio: 0.70,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64', 'phrygian'],
    maxTraps: 4,
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

function makeNote(
  pitch: PitchName, octave: number, dur: NoteDuration,
  accidental: Accidental = '', tie = false,
): ScoreNote {
  return { id: uid(), pitch, octave, accidental, duration: dur, tie };
}

function makeRest(dur: NoteDuration): ScoreNote {
  return makeNote('rest', 4, dur);
}

/** V1 하한선 가드레일: MIDI가 V1_MIN_MIDI 미만이면 옥타브 올림 */
function clampTrebleFloor(
  pitch: PitchName, octave: number, accidental: Accidental, keySignature: string,
): number {
  if (pitch === 'rest') return octave;
  const test: ScoreNote = { id: '', pitch, octave, accidental, duration: '4' };
  const midi = noteToMidiWithKey(test, keySignature);
  if (midi >= 0 && midi < V1_MIN_MIDI) {
    return octave + Math.ceil((V1_MIN_MIDI - midi) / 12);
  }
  return octave;
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

  if (bottom === 8 && top % 3 === 0 && top >= 6) {
    const pts: number[] = [];
    for (let i = 6; i < barLength; i += 6) pts.push(i);
    return pts;
  }

  if (top === 4 && bottom === 4) {
    return [8];
  }

  if (top === 3 && bottom === 4) {
    return [8];
  }

  if (top === 2) {
    return [];
  }

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
function fillRhythm(
  total: number,
  pool: number[],
  opts?: {
    timeSignature?: string;
    lastDur?: number;
    syncopationProb?: number;
  },
): number[] {
  const sorted = [...pool].sort((a, b) => b - a);
  const result: number[] = [];
  let rem = total;
  let pos = 0;
  const lastDur = opts?.lastDur;
  const syncopationProb = opts?.syncopationProb ?? 0;
  const timeSignature = opts?.timeSignature;

  const boundaries = timeSignature
    ? getBarMandatoryBoundaries(timeSignature, total)
    : [];
  const beatSize = (() => {
    if (!timeSignature) return 4;
    const [, bs] = timeSignature.split('/');
    return 16 / (parseInt(bs, 10) || 4);
  })();

  const allBeatBounds: number[] = [];
  if (timeSignature) {
    for (let i = beatSize; i < total; i += beatSize) allBeatBounds.push(i);
  }

  let syncopationUsed = false;

  while (rem > 0) {
    // ── 당김음 패턴 삽입 (지침서 §3.1) ──
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

    let avail = sorted.filter(d => d <= rem);

    const prevDur = result.length > 0 ? result[result.length - 1] : lastDur;
    if (prevDur === 6) {
      avail = avail.filter(d => d !== 6);
    }

    // ── 박 경계를 넘는 음가 필터링 (지침서 §1.1, §1.2) ──
    if (boundaries.length > 0) {
      const onBeat = pos % beatSize === 0;
      avail = avail.filter(d => {
        const noteEnd = pos + d;
        for (const b of boundaries) {
          if (pos < b && noteEnd > b) return false;
        }
        if (!onBeat) {
          for (const b of allBeatBounds) {
            if (pos < b && noteEnd > b) return false;
          }
        }
        return true;
      });
    }

    if (avail.length === 0) {
      let fallback = Object.keys(SIXTEENTHS_TO_DUR).map(Number)
        .filter(d => d <= rem).sort((a, b) => b - a);

      const prevDurFallback = result.length > 0 ? result[result.length - 1] : lastDur;
      if (prevDurFallback === 6) {
        fallback = fallback.filter(d => d !== 6);
      }

      if (boundaries.length > 0) {
        const onBeat = pos % beatSize === 0;
        fallback = fallback.filter(d => {
          const noteEnd = pos + d;
          for (const b of boundaries) {
            if (pos < b && noteEnd > b) return false;
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
    noteToMidiWithKey(bassMelody, keySignature) >= noteToMidiWithKey(trebleMelody, keySignature) - MIN_VOICE_GAP &&
    bassOctave > 2
  ) {
    bassOctave--;
    bassMelody = makeNote(bassDeg.pitch, bassOctave, noteDur);
  }

  const treble: ScoreNote[] = [trebleMelody];
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

  // 쉼표 예산: 레벨에 따라 증가
  const maxBudget = lvl <= 2 ? 0 : lvl <= 4 ? 2 : lvl <= 6 ? 3 : 4;
  const budget = Math.random() < (1 - params.restProb) ? 0 : Math.min(maxBudget, Math.floor(Math.random() * (maxBudget + 1)));
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

  if (lvl <= 3) {
    // 초급: 4분음표만, 약박 위치
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
  if (measures < 1) throw new Error('measures must be >= 1');
  if (!timeSignature || !timeSignature.includes('/')) throw new Error(`Invalid timeSignature: ${timeSignature}`);

  const scale             = getScaleDegrees(keySignature);
  const sixteenthsPerBar  = getSixteenthsPerBar(timeSignature);
  const pool              = DURATION_POOL[difficulty];
  const progression       = generateProgression(measures);
  const lvl               = difficultyLevel(difficulty);
  const params            = LEVEL_PARAMS[difficulty];

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

  let nn              = rand([0, 2, 4]);
  let prevDir         = 0;
  let prevInterval    = 0;
  let pendingResolution: PitchName | null = null;

  let lastTrebleDur: number | undefined;
  for (let bar = 0; bar < measures - 1; bar++) {
    const trebleBarStart = trebleNotes.length;
    const tones  = CHORD_TONES[progression[bar]];
    const rhythm = fillRhythm(sixteenthsPerBar, pool, {
      timeSignature, lastDur: lastTrebleDur, syncopationProb: params.syncopationProb,
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
        const rn = noteNumToNote(nn, scale, TREBLE_BASE);
        const rnOct = clampTrebleFloor(rn.pitch, rn.octave, '' as Accidental, keySignature);
        trebleNotes.push(makeNote(rn.pitch, rnOct, durLabel));
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
          interval = rand([1, -1]);
        } else {
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
        const rangeMin = lvl <= 2 ? -2 : lvl <= 4 ? -3 : lvl <= 6 ? -4 : -5;
        const rangeMax = lvl <= 2 ? 7 : lvl <= 4 ? 9 : lvl <= 6 ? 11 : 14;
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
      if (tripletBudget > 0 && dur === 4 && lvl >= 4) {
        const tripResult = tryInsertTriplet(trebleNotes, (k) => {
          nn = Math.max(-2, Math.min(9, nn + rand([1,-1,2,-2])));
          const raw = noteNumToNote(nn, scale, TREBLE_BASE);
          return { pitch: raw.pitch, octave: clampTrebleFloor(raw.pitch, raw.octave, '' as Accidental, keySignature) };
        }, dur, params.tripletProb);
        if (tripResult.inserted) { tripletBudget--; barPos += dur; continue; }
      }

      let { pitch, octave } = noteNumToNote(nn, scale, TREBLE_BASE);
      octave = clampTrebleFloor(pitch, octave, '' as Accidental, keySignature);

      // ── 임시표(반음계) 삽입 — 조표·난이도에 맞게 #/b/n 분배 (조표만으로는 표기 안 되는 중복 방지) ──
      if (accidentalBudget > 0 && i < rhythm.length - 1 && Math.random() < chromaticProbEffective) {
        if (scale.includes(pitch)) {
          const acc = pickChromaticAccidental(keySignature, pitch, difficulty);
          const accMidi = noteToMidiWithKey(makeNote(pitch, octave, durLabel, acc), keySignature);
          if (accMidi >= V1_MIN_MIDI) {
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
      const trebleAttackMap = buildTrebleMidiMap(barTrebleSlice, keySignature, sixteenthsPerBar);
      if (lvl >= 7) {
        generateArpeggioBass(
          bassNotes, sixteenthsPerBar, progression[bar], scale, keySignature, trebleAttackMap,
        );
      } else if (lvl >= 4 && params.bassIndependence > 0.3) {
        generateIndependentBass(
          bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale, params,
          keySignature, trebleAttackMap, timeSignature,
        );
      } else {
        generateBasicBass(
          bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale, keySignature, trebleAttackMap, timeSignature,
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

  return { trebleNotes, bassNotes };
}

/**
 * 베이스-트레블 교차 방지.
 * 베이스 음표의 지속 구간 내 어느 시점이든 트레블 MIDI - MIN_VOICE_GAP 이상이면
 * 옥타브 하강 → 대체 화음톤 순으로 해결한다.
 */
function resolveBassClash(
  note: ScoreNote, bnn: number, oct: number, durLabel: NoteDuration,
  bassOff: number, bassDurSixteenths: number,
  scale: PitchName[], bassBase: number,
  keySignature: string, trebleMap: Map<number, number>,
): ScoreNote {
  let minTreble = Infinity;
  for (let pos = bassOff; pos < bassOff + bassDurSixteenths; pos++) {
    const t = trebleMap.get(pos);
    if (t !== undefined && t >= 0 && t < minTreble) minTreble = t;
  }
  if (minTreble === Infinity) return note;

  const bassMidi = noteToMidiWithKey(note, keySignature);
  if (bassMidi < minTreble - MIN_VOICE_GAP) return note;

  let newOct = oct;
  let resolved = note;
  while (newOct > 1) {
    newOct--;
    resolved = makeNote(note.pitch as PitchName, newOct, durLabel);
    if (noteToMidiWithKey(resolved, keySignature) < minTreble - MIN_VOICE_GAP) {
      return resolved;
    }
  }

  let b2 = (bnn + 2) % 7;
  if (b2 > 4) b2 -= 7;
  const alt = noteNumToNote(b2, scale, bassBase);
  let altOct = Math.max(2, Math.min(3, alt.octave));
  resolved = makeNote(alt.pitch, altOct, durLabel);
  if (noteToMidiWithKey(resolved, keySignature) >= minTreble - MIN_VOICE_GAP && altOct > 1) {
    resolved = makeNote(alt.pitch, altOct - 1, durLabel);
  }
  return resolved;
}

// ── 초급 베이스: 화음톤 기반 ─────────────────────────────────
function generateBasicBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature?: string,
) {
  const BASS_BASE   = 3;
  const bTones      = CHORD_TONES[chordRoot];
  const trebleShort = trebleRhythm.some(d => d <= 2);
  const bassPool    = trebleShort ? [16, 8] : [8, 4];
  const bassRhythm  = fillRhythm(sixteenthsPerBar, bassPool, { timeSignature });

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
    note = resolveBassClash(note, bnn, oct, durLabel, bassOff, dur, scale, BASS_BASE, keySignature, trebleAttackMap);
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
) {
  const BASS_BASE   = 3;
  const bTones      = CHORD_TONES[chordRoot];

  let bassPool: number[];
  if (params.bassIndependence >= 0.6) {
    bassPool = [8, 6, 4, 2];
  } else {
    const trebleShort = trebleRhythm.some(d => d <= 2);
    bassPool = trebleShort ? [8, 4] : [8, 6, 4];
  }

  const bassRhythm = fillRhythm(sixteenthsPerBar, bassPool, { timeSignature });

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

  let bassOff = 0;
  for (let j = 0; j < bassRhythm.length; j++) {
    const dur      = bassRhythm[j];
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    if (j > 0) {
      if (Math.random() < 0.4) {
        bnn += rand([1, -1]);
      } else {
        bnn = rand(bTones);
      }
      if (bnn > 4) bnn -= 7;
    }
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, bnn, oct, durLabel, bassOff, dur, scale, BASS_BASE, keySignature, trebleAttackMap);
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
    note = resolveBassClash(note, bnn, oct, '8', bassOff, 2, scale, BASS_BASE, keySignature, trebleAttackMap);
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
    note = resolveBassClash(note, bnn, oct, '16', bassOff, 1, scale, BASS_BASE, keySignature, trebleAttackMap);
    bassNotes.push(note);
  }
}
