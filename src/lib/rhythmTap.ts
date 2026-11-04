// ─────────────────────────────────────────────────────────────
// 리듬 탭 — 패턴 생성·예상 타점 계산·탭 타이밍 채점 (순수 함수)
// ─────────────────────────────────────────────────────────────

import { generateRhythmDictation } from './rhythmEngine';
import { durationToSixteenths, generateAbc } from './scoreUtils';
import type { ScoreNote } from './scoreUtils';
import type { RhythmTapDifficulty } from '../types/content';

export interface RhythmTapLevelConfig {
  /** rhythmEngine 레벨 (1: 4분·2분, 2: 8분·쉼표, 3: 점음표·당김음, 4: 16분음표) */
  engineLevel: number;
  measures: number;
  tempo: number;
  timeSignature: string;
}

export const RHYTHM_TAP_LEVELS: Record<RhythmTapDifficulty, RhythmTapLevelConfig> = {
  tap_1: { engineLevel: 1, measures: 1, tempo: 80, timeSignature: '4/4' },
  tap_2: { engineLevel: 2, measures: 1, tempo: 84, timeSignature: '4/4' },
  tap_3: { engineLevel: 3, measures: 2, tempo: 84, timeSignature: '4/4' },
  tap_4: { engineLevel: 4, measures: 2, tempo: 88, timeSignature: '4/4' },
  // 5·6단계: 박자 확장. 3/4는 점음표·당김음 레벨, 6/8은 ♪ 단위 클릭(3개 묶음 강박)으로 카운트한다
  tap_5: { engineLevel: 3, measures: 2, tempo: 84, timeSignature: '3/4' },
  tap_6: { engineLevel: 3, measures: 2, tempo: 92, timeSignature: '6/8' },
};

/** 복합박자(6/8·9/8·12/8)면 ♪ 3개마다 강박 — 탭 화면의 박 점 강조와 클릭 트랙 강박 주기에 쓴다 */
export function accentEveryFor(timeSignature: string): number {
  const { top, bottom } = parseTimeSignature(timeSignature);
  return bottom === 8 && top % 3 === 0 ? 3 : top;
}

/** 탭 단계에서 미리 들려주는 카운트인 마디 수 */
export const RHYTHM_TAP_COUNT_IN_BARS = 1;

export interface RhythmTapQuestion {
  id: string;
  difficulty: RhythmTapDifficulty;
  notes: ScoreNote[];
  /** 악보 표시·정답 듣기용 ABC */
  abc: string;
  tempo: number;
  timeSignature: string;
  measures: number;
  beatsPerBar: number;
  beatMs: number;
  /** 패턴 시작 기준 예상 타점(ms) — 쉼표·붙임줄 이어짐은 제외 */
  onsetsMs: number[];
  /** 패턴 전체 길이(ms) */
  totalMs: number;
  /** 허용 오차(ms) */
  toleranceMs: number;
}

export function rhythmTapLevelNumber(difficulty: RhythmTapDifficulty): number {
  const m = difficulty.match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

function parseTimeSignature(ts: string): { top: number; bottom: number } {
  const [t, b] = ts.split('/');
  return { top: parseInt(t, 10) || 4, bottom: parseInt(b, 10) || 4 };
}

/** 박 길이(ms): (60000 / tempo) × (4 / 분모) */
export function beatMsFor(tempo: number, timeSignature: string): number {
  const { bottom } = parseTimeSignature(timeSignature);
  return (60000 / tempo) * (4 / bottom);
}

/**
 * 음표 목록에서 예상 타점을 계산한다.
 * - 쉼표는 타점이 아니다. 붙임줄로 이어진 음표(tie=true)는 새 타점이 아니다.
 * - 잇단음표는 첫 음의 tuplet/tupletSpan으로 그룹 길이를 균등 분할한다.
 */
export function computeOnsets(
  notes: ScoreNote[],
  tempo: number,
  timeSignature: string,
): { onsetsMs: number[]; totalMs: number } {
  const sixteenthMs =
    beatMsFor(tempo, timeSignature) / (16 / parseTimeSignature(timeSignature).bottom);
  const onsets: number[] = [];
  let pos = 0; // 16분음표 단위
  let tupletRemaining = 0;
  let tupletUnit = 0;

  notes.forEach((note) => {
    let len: number;
    if (tupletRemaining > 0) {
      len = tupletUnit;
      tupletRemaining -= 1;
    } else if (note.tuplet && note.tupletSpan) {
      const count = parseInt(note.tuplet, 10) || 3;
      tupletUnit = durationToSixteenths(note.tupletSpan) / count;
      tupletRemaining = count - 1;
      len = tupletUnit;
    } else {
      len = durationToSixteenths(note.duration);
    }

    if (note.pitch !== 'rest' && !note.tie) {
      onsets.push(Math.round(pos * sixteenthMs));
    }
    pos += len;
  });

  return { onsetsMs: onsets, totalMs: Math.round(pos * sixteenthMs) };
}

/**
 * 허용 오차: 박의 25%를 기본으로 하되, 가장 짧은 타점 간격의 45%를 넘지 않게 한다 (90~220ms).
 */
export function toleranceFor(onsetsMs: number[], beatMs: number): number {
  let minGap = Infinity;
  for (let i = 1; i < onsetsMs.length; i++) {
    minGap = Math.min(minGap, onsetsMs[i] - onsetsMs[i - 1]);
  }
  const base = beatMs * 0.25;
  const gapLimit = Number.isFinite(minGap) ? minGap * 0.45 : base;
  return Math.round(Math.max(90, Math.min(220, base, gapLimit)));
}

export function buildRhythmTapQuestionFromNotes(
  difficulty: RhythmTapDifficulty,
  notes: ScoreNote[],
  config: RhythmTapLevelConfig = RHYTHM_TAP_LEVELS[difficulty],
): RhythmTapQuestion {
  const { top } = parseTimeSignature(config.timeSignature);
  const beatMs = beatMsFor(config.tempo, config.timeSignature);
  // 허용 오차의 기준 박은 '느껴지는 박' — 복합박자는 ♪ 셋을 묶은 점4분음표
  const feltBeatMs = beatMs * accentEveryFor(config.timeSignature);
  const { onsetsMs, totalMs } = computeOnsets(notes, config.tempo, config.timeSignature);
  const abc = generateAbc({
    title: '',
    keySignature: 'C',
    timeSignature: config.timeSignature,
    tempo: config.tempo,
    notes,
    useGrandStaff: false,
    disableTies: true,
    barsPerStaff: config.measures,
  });
  return {
    id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    difficulty,
    notes,
    abc,
    tempo: config.tempo,
    timeSignature: config.timeSignature,
    measures: config.measures,
    beatsPerBar: top,
    beatMs,
    onsetsMs,
    totalMs,
    toleranceMs: toleranceFor(onsetsMs, feltBeatMs),
  };
}

/** 첫 음이 쉼표면 첫 번째 음표와 자리를 바꿔 첫 박에 타점을 둔다 (마디 길이는 그대로) */
export function ensureStartsWithNote(notes: ScoreNote[]): ScoreNote[] {
  if (notes.length === 0 || notes[0].pitch !== 'rest') return notes;
  const j = notes.findIndex((n) => n.pitch !== 'rest');
  if (j < 0) return notes;
  const result = [...notes];
  [result[0], result[j]] = [result[j], result[0]];
  return result;
}

/** 난이도에 맞는 리듬 탭 문제 1개 생성 (클라이언트 동적 생성) */
export function generateRhythmTapQuestion(difficulty: RhythmTapDifficulty): RhythmTapQuestion {
  const config = RHYTHM_TAP_LEVELS[difficulty];
  let notes: ScoreNote[] = [];
  // 타점이 2개 미만이거나 쉼표로 시작하는 패턴은 다시 뽑는다 (첫 박에 탭이 있어야 따라 치기 쉽다)
  for (let attempt = 0; attempt < 8; attempt++) {
    notes = generateRhythmDictation(config.engineLevel, config.measures, config.timeSignature, 'B');
    const { onsetsMs } = computeOnsets(notes, config.tempo, config.timeSignature);
    if (onsetsMs.length >= 2 && onsetsMs[0] === 0) break;
  }
  return buildRhythmTapQuestionFromNotes(difficulty, ensureStartsWithNote(notes), config);
}

// ─────────────────────────────────────────────────────────────
// 채점
// ─────────────────────────────────────────────────────────────

export type TapStatus = 'perfect' | 'early' | 'late' | 'miss';

export interface TapMatch {
  expectedMs: number;
  tapMs: number | null;
  deltaMs: number | null;
  status: TapStatus;
}

export interface TapGrade {
  /** 0~100 */
  score: number;
  matched: number;
  expected: number;
  /** 어느 타점에도 붙지 않은 탭 수 */
  extra: number;
  matches: TapMatch[];
  extraTapsMs: number[];
}

/** 'perfect' 판정 범위: 허용 오차의 45% */
export const PERFECT_RATIO = 0.45;
/** 빠르거나 늦게 맞춘 탭의 점수 비율 */
export const PARTIAL_CREDIT = 0.6;

/**
 * 예상 타점(ms)과 탭 시각(ms, 같은 기준)으로 채점한다.
 * 타점마다 허용 오차 안에서 가장 가까운 미사용 탭을 짝짓는다.
 */
export function gradeTaps(onsetsMs: number[], tapsMs: number[], toleranceMs: number): TapGrade {
  const used = new Set<number>();
  const matches: TapMatch[] = [];
  let credit = 0;

  onsetsMs.forEach((expected) => {
    let bestIdx = -1;
    let bestDelta = Infinity;
    tapsMs.forEach((tap, i) => {
      if (used.has(i)) return;
      const delta = tap - expected;
      if (Math.abs(delta) <= toleranceMs && Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta;
        bestIdx = i;
      }
    });

    if (bestIdx < 0) {
      matches.push({ expectedMs: expected, tapMs: null, deltaMs: null, status: 'miss' });
      return;
    }
    used.add(bestIdx);
    const perfect = Math.abs(bestDelta) <= toleranceMs * PERFECT_RATIO;
    const status: TapStatus = perfect ? 'perfect' : bestDelta < 0 ? 'early' : 'late';
    credit += perfect ? 1 : PARTIAL_CREDIT;
    matches.push({ expectedMs: expected, tapMs: tapsMs[bestIdx], deltaMs: bestDelta, status });
  });

  const extraTapsMs = tapsMs.filter((_, i) => !used.has(i));
  const expected = onsetsMs.length;
  const matched = matches.filter((m) => m.status !== 'miss').length;
  if (expected === 0) {
    return { score: 0, matched: 0, expected: 0, extra: extraTapsMs.length, matches, extraTapsMs };
  }
  const raw = (credit / expected) * 100 - extraTapsMs.length * (50 / expected);
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  return { score, matched, expected, extra: extraTapsMs.length, matches, extraTapsMs };
}

/** 세션 평균 점수 → 자기 평가(1~5) */
export function tapScoreToRating(avgScore: number): number {
  if (avgScore >= 90) return 5;
  if (avgScore >= 75) return 4;
  if (avgScore >= 55) return 3;
  if (avgScore >= 35) return 2;
  return 1;
}

/** 점수 → 'easy' | 'normal' | 'hard' (스킬 프로필 평가용) */
export function tapScoreToEvaluation(avgScore: number): 'easy' | 'normal' | 'hard' {
  if (avgScore >= 85) return 'easy';
  if (avgScore >= 55) return 'normal';
  return 'hard';
}
