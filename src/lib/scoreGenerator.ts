import {
  ScoreNote, NoteDuration, PitchName, Accidental,
  getSixteenthsPerBar,
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

const SCALE_DEGREES: Record<string, PitchName[]> = {
  'C':   ['C','D','E','F','G','A','B'],
  'G':   ['G','A','B','C','D','E','F'],
  'D':   ['D','E','F','G','A','B','C'],
  'A':   ['A','B','C','D','E','F','G'],
  'F':   ['F','G','A','B','C','D','E'],
  'Bb':  ['B','C','D','E','F','G','A'],
  'Eb':  ['E','F','G','A','B','C','D'],
  'Am':  ['A','B','C','D','E','F','G'],
  'Em':  ['E','F','G','A','B','C','D'],
  'Bm':  ['B','C','D','E','F','G','A'],
  'F#m': ['F','G','A','B','C','D','E'],
  'Dm':  ['D','E','F','G','A','B','C'],
  'Gm':  ['G','A','B','C','D','E','F'],
  'Cm':  ['C','D','E','F','G','A','B'],
};

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

const SIXTEENTHS_TO_DUR: Record<number, NoteDuration> = {
  16: '1', 12: '2.', 8: '2', 6: '4.', 4: '4', 3: '8.', 2: '8', 1: '16',
};

const CHROMATIC_RESOLUTION: Record<string, PitchName> = {
  'C': 'D', 'D': 'E', 'E': 'F', 'F': 'G', 'G': 'A', 'A': 'B', 'B': 'C',
};

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
  tieProb: number;              // 붙임줄 확률
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
    chromaticBudget: [0, 1], chromaticProb: 0.05,
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
    chromaticBudget: [1, 2], chromaticProb: 0.09,
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
    chromaticBudget: [1, 3], chromaticProb: 0.12,
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
    chromaticBudget: [3, 5], chromaticProb: 0.18,
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
    chromaticBudget: [3, 5], chromaticProb: 0.22,
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
    chromaticBudget: [5, 8], chromaticProb: 0.28,
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

function makeNote(
  pitch: PitchName, octave: number, dur: NoteDuration,
  accidental: Accidental = '', tie = false,
): ScoreNote {
  return { id: uid(), pitch, octave, accidental, duration: dur, tie };
}

function makeRest(dur: NoteDuration): ScoreNote {
  return makeNote('rest' as PitchName, 4, dur);
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

function fillRhythm(total: number, pool: number[], lastDur?: number): number[] {
  const sorted = [...pool].sort((a, b) => b - a);
  const result: number[] = [];
  let rem = total;
  while (rem > 0) {
    let avail = sorted.filter(d => d <= rem);

    // 점 4분음표(6) 연속 방지
    const prevDur = result.length > 0 ? result[result.length - 1] : lastDur;
    if (prevDur === 6) {
      avail = avail.filter(d => d !== 6);
    }

    if (avail.length === 0) {
      let fallback = Object.keys(SIXTEENTHS_TO_DUR).map(Number)
        .filter(d => d <= rem).sort((a, b) => b - a);

      const prevDurFallback = result.length > 0 ? result[result.length - 1] : lastDur;
      if (prevDurFallback === 6) {
        fallback = fallback.filter(d => d !== 6);
      }

      if (fallback.length) { result.push(fallback[0]); rem -= fallback[0]; }
      else { result.push(rem); break; }
    } else {
      const d = rand(avail);
      result.push(d); rem -= d;
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
  if (measures >= 2) { result[measures - 2] = 4; result[measures - 1] = 0; }
  return result;
}

// ── 셋잇단음표 삽입 ──
function tryInsertTriplet(
  notes: ScoreNote[],
  pitchFn: () => { pitch: PitchName; octave: number },
  maxRemaining: number,
  prob: number,
): boolean {
  if (maxRemaining < 4 || Math.random() > prob) return false;
  for (let k = 0; k < 3; k++) {
    const { pitch, octave } = pitchFn();
    notes.push({
      id: uid(), pitch, octave, accidental: '' as Accidental,
      duration: '8', tie: false,
      ...(k === 0 ? { tuplet: '3' as const, tupletSpan: '4' as NoteDuration, tupletNoteDur: 2 } : {}),
    });
  }
  return true;
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
): { treble: ScoreNote[]; bass: ScoreNote[] } {
  const tonicPitch = scale[0];
  const bassNote   = noteNumToNote(0, scale, bassBase);
  const bassOctave = Math.max(2, Math.min(4, bassNote.octave));

  const canUsePatternB = sixteenthsPerBar >= 16 && !!SIXTEENTHS_TO_DUR[12] && !!SIXTEENTHS_TO_DUR[4];
  const usePatternB    = canUsePatternB && Math.random() < 0.5;

  const noteSixteenths = usePatternB ? 12 : 8;
  const restSixteenths = sixteenthsPerBar - noteSixteenths;

  const noteDur = SIXTEENTHS_TO_DUR[noteSixteenths] || '2';
  const restDur = SIXTEENTHS_TO_DUR[restSixteenths] || '2';

  const treble: ScoreNote[] = [
    makeNote(tonicPitch, trebleBase, noteDur),
    makeRest(restDur),
  ];
  const bass: ScoreNote[] = useGrandStaff ? [
    makeNote(bassNote.pitch, bassOctave, noteDur),
    makeRest(restDur),
  ] : [];

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
      if (bn.pitch === ('rest' as PitchName)) {
        bassRestAt.add(`${Math.floor(bpos / sixteenthsPerBar)}_${bpos % sixteenthsPerBar}`);
      }
      bpos += bdur;
    }
  }

  const isRest = (idx: number) => treble[idx]?.pitch === ('rest' as PitchName);

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
    treble[c.noteIdx] = makeRest(treble[c.noteIdx].duration);
  }
}

// ────────────────────────────────────────────────────────────────
// Main generator
// ────────────────────────────────────────────────────────────────

export function generateScore(opts: GeneratorOptions): GeneratedScore {
  const { keySignature, timeSignature, difficulty, measures, useGrandStaff } = opts;
  const scale             = SCALE_DEGREES[keySignature] || SCALE_DEGREES['C'];
  const sixteenthsPerBar  = getSixteenthsPerBar(timeSignature);
  const pool              = DURATION_POOL[difficulty];
  const progression       = generateProgression(measures);
  const lvl               = difficultyLevel(difficulty);
  const params            = LEVEL_PARAMS[difficulty];

  // 임시표/셋잇단 예산
  let accidentalBudget = params.chromaticBudget[0] +
    Math.floor(Math.random() * (params.chromaticBudget[1] - params.chromaticBudget[0] + 1));
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
    const tones  = CHORD_TONES[progression[bar]];
    const rhythm = fillRhythm(sixteenthsPerBar, pool, lastTrebleDur);
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
        const inserted = tryInsertTriplet(trebleNotes, () => {
          const newNn = Math.max(-2, Math.min(9, nn + rand([1,-1,2,-2])));
          return noteNumToNote(newNn, scale, TREBLE_BASE);
        }, dur, params.tripletProb);
        if (inserted) { tripletBudget--; barPos += dur; continue; }
      }

      const { pitch, octave } = noteNumToNote(nn, scale, TREBLE_BASE);

      // ── 임시표(반음계) 삽입 ──
      if (accidentalBudget > 0 && i < rhythm.length - 1 && Math.random() < params.chromaticProb) {
        if (scale.includes(pitch)) {
          const acc: Accidental = lvl >= 5 ? (Math.random() < 0.5 ? '#' : 'b') : '#';
          trebleNotes.push(makeNote(pitch, octave, durLabel, acc));
          if (acc === '#') {
            pendingResolution = CHROMATIC_RESOLUTION[pitch];
          } else {
            pendingResolution = pitch; // b인 경우 같은 음으로 해결
          }
          accidentalBudget--;
          barPos += dur; continue;
        }
      }

      // ── 붙임줄(Tie) 삽입 ──
      if (Math.random() < params.tieProb && i > 0 && i < rhythm.length - 1 && barPos > 0) {
        trebleNotes.push(makeNote(pitch, octave, durLabel, '', true));
        barPos += dur; continue;
      }

      trebleNotes.push(makeNote(pitch, octave, durLabel));
      barPos += dur;
    }

    // ── 베이스 생성 ──
    if (useGrandStaff) {
      if (lvl >= 7) {
        generateArpeggioBass(bassNotes, sixteenthsPerBar, progression[bar], scale);
      } else if (lvl >= 4 && params.bassIndependence > 0.3) {
        generateIndependentBass(bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale, params);
      } else {
        generateBasicBass(bassNotes, rhythm, sixteenthsPerBar, progression[bar], scale);
      }
    }
  }

  // ── 종지 마디 ──
  const cadence = generateCadenceMeasure(
    scale, TREBLE_BASE, BASS_BASE, sixteenthsPerBar, useGrandStaff,
  );
  trebleNotes.push(...cadence.treble);
  bassNotes.push(...cadence.bass);

  // ── 후처리: 내부 쉼표 ──
  applyInternalRests(trebleNotes, bassNotes, difficulty, measures, sixteenthsPerBar, useGrandStaff);

  return { trebleNotes, bassNotes };
}

// ── 초급 베이스: 화음톤 기반 ─────────────────────────────────
function generateBasicBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[],
) {
  const BASS_BASE   = 3;
  const bTones      = CHORD_TONES[chordRoot];
  const trebleShort = trebleRhythm.some(d => d <= 2);
  const bassPool    = trebleShort ? [16, 8] : [8, 4];
  const bassRhythm  = fillRhythm(sixteenthsPerBar, bassPool);

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

  for (let j = 0; j < bassRhythm.length; j++) {
    const dur      = bassRhythm[j];
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    if (j > 0) { bnn = rand(bTones); if (bnn > 4) bnn -= 7; }
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    bassNotes.push(makeNote(pitch, Math.max(2, Math.min(4, octave)), durLabel));
  }
}

// ── 중급 베이스: 독립적 리듬 프로필 ─────────────────────────
function generateIndependentBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[], params: LevelParams,
) {
  const BASS_BASE   = 3;
  const bTones      = CHORD_TONES[chordRoot];

  // 독립도에 따라 리듬 풀 결정
  let bassPool: number[];
  if (params.bassIndependence >= 0.6) {
    // 높은 독립도: 별도 리듬
    bassPool = [8, 6, 4, 2];
  } else {
    // 트레블과 유사하되 약간 다름
    const trebleShort = trebleRhythm.some(d => d <= 2);
    bassPool = trebleShort ? [8, 4] : [8, 6, 4];
  }

  const bassRhythm = fillRhythm(sixteenthsPerBar, bassPool);

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

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
    bassNotes.push(makeNote(pitch, Math.max(2, Math.min(4, octave)), durLabel));
  }
}

// ── 고급 베이스: 분산화음(아르페지오) / 워킹베이스 ────────────
function generateArpeggioBass(
  bassNotes: ScoreNote[],
  sixteenthsPerBar: number,
  chordRoot: number,
  scale: PitchName[],
) {
  const BASS_BASE = 3;
  const bTones    = CHORD_TONES[chordRoot];

  const pattern = [bTones[0], bTones[2], bTones[1], bTones[2]];

  const totalEighths = Math.floor(sixteenthsPerBar / 2);
  const leftover     = sixteenthsPerBar % 2;

  for (let j = 0; j < totalEighths; j++) {
    let bnn = pattern[j % pattern.length];
    if (bnn > 4) bnn -= 7;
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    bassNotes.push(makeNote(pitch, Math.max(2, Math.min(4, octave)), '8'));
  }

  if (leftover > 0) {
    let bnn = pattern[totalEighths % pattern.length];
    if (bnn > 4) bnn -= 7;
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    bassNotes.push(makeNote(pitch, Math.max(2, Math.min(4, octave)), '16'));
  }
}
