// ────────────────────────────────────────────────────────────────
// Melody generation engine — internal helpers for generateScore
// ────────────────────────────────────────────────────────────────

import type { ScoreNote, NoteDuration, PitchName, Accidental, TupletType } from '../scoreUtils';
import {
  getSixteenthsPerBar, durationToSixteenths, getTupletActualSixteenths,
  noteToMidiWithKey, getKeySigAlteration, getKeySignatureAccidentalCount,
  getScaleDegrees, SIXTEENTHS_TO_DUR, splitAtBeatBoundaries,
  nnToMidi, getMidiInterval, isForbiddenMelodicInterval,
  PITCH_ORDER, getBassBaseOctave, CHORD_TONES,
  uid, makeNote, makeRest, noteNumToNote, scaleNoteToNn,
  buildTrebleAttackMidiMap, passesBassSpacing,
  chordToneBnnCandidates, snapToChordTone,
  generateProgression, getStrongBeatOffsets,
} from '../scoreUtils';
import type { BassLevel } from '../twoVoice';
import type { Difficulty, BassDifficulty, GeneratorOptions } from './types';
import { difficultyLevel, DURATION_POOL, BASS_LEVEL_PARAMS } from './types';
import type { BassLevelParams } from './types';

// ────────────────────────────────────────────────────────────────
// 단조 화성 지원
// ────────────────────────────────────────────────────────────────

export function isMinorKey(keySignature: string): boolean {
  return keySignature.endsWith('m');
}

/**
 * 단조에서 올린 7음(leading tone)의 임시표를 결정.
 * 화성단음계: 7음을 반음 올림 → 이끔음(leading tone) 생성.
 * 예: Am에서 G→G#, Dm에서 C→C#, Gm에서 F→F#
 */
export function getMinorLeadingToneAccidental(keySignature: string, seventhDegree: PitchName): Accidental {
  const keyAlt = getKeySigAlteration(keySignature, seventhDegree);
  // 조표에서 이미 b가 붙은 음이면 내추럴로 올림, 아니면 #
  if (keyAlt === 'b') return 'n';
  return '#';
}

// BASS_DIFF_LABELS, BASS_DIFF_DESC, BassLevelParams, BASS_LEVEL_PARAMS → types.ts에서 import

// ────────────────────────────────────────────────────────────────
// New two-voice bass integration helpers
// ────────────────────────────────────────────────────────────────

export function mapBassDifficultyToLevel(bd: BassDifficulty): BassLevel {
  const map: Record<BassDifficulty, BassLevel> = { bass_1: 1, bass_2: 2, bass_3: 3, bass_4: 4 };
  return map[bd];
}

/**
 * Build attack MIDI map for bass ScoreNotes within a bar.
 * Maps 16th-note offset → MIDI value for each bass note attack in the bar.
 */
export function buildBassAttackMidiMap(
  bassNotes: ScoreNote[],
  barStartSixteenths: number,
  barLengthSixteenths: number,
  keySignature: string,
): Map<number, number> {
  const map = new Map<number, number>();
  let off = 0;
  for (const n of bassNotes) {
    const dur = durationToSixteenths(n.duration);
    if (off >= barStartSixteenths && off < barStartSixteenths + barLengthSixteenths) {
      if (n.pitch !== 'rest') {
        map.set(off - barStartSixteenths, noteToMidiWithKey(n, keySignature));
      }
    }
    off += dur;
  }
  return map;
}


// ────────────────────────────────────────────────────────────────
// 난이도별 파라미터 테이블 (문서 기반)
// ────────────────────────────────────────────────────────────────

export interface LevelParams {
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

export const LEVEL_PARAMS: Record<Difficulty, LevelParams> = {
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
    maxInterval: 5, stepwiseProb: 0.75, maxLeap: 5,
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
    maxInterval: 5, stepwiseProb: 0.70, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.30, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.30, restProb: 0.15, dottedProb: 0.22,
    contraryMotionRatio: 0.50, bassIndependence: 0.45,
    voiceCrossingMax: 0, consonanceRatio: 0.88,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── L6: 16분·16분쉼표 ──
  intermediate_3: {
    maxInterval: 5, stepwiseProb: 0.65, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.26, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.20, restProb: 0.20, dottedProb: 0.22,
    contraryMotionRatio: 0.55, bassIndependence: 0.55,
    voiceCrossingMax: 1, consonanceRatio: 0.85,
    cadenceType: ['perfect', 'half', 'plagal'],
    maxTraps: 1,
  },
  // ── L7: 점8분 ──
  advanced_1: {
    maxInterval: 5, stepwiseProb: 0.60, maxLeap: 5,
    chromaticBudget: [0, 0], chromaticProb: 0,
    syncopationProb: 0.22, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.38,
    contraryMotionRatio: 0.60, bassIndependence: 0.65,
    voiceCrossingMax: 1, consonanceRatio: 0.82,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── L8: 임시표 ──
  advanced_2: {
    maxInterval: 5, stepwiseProb: 0.55, maxLeap: 5,
    chromaticBudget: [2, 4], chromaticProb: 0.15,
    syncopationProb: 0.22, tripletBudget: [0, 0], tripletProb: 0,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.30,
    contraryMotionRatio: 0.65, bassIndependence: 0.75,
    voiceCrossingMax: 2, consonanceRatio: 0.80,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive'],
    maxTraps: 2,
  },
  // ── L9: 셋잇단 ──
  advanced_3: {
    maxInterval: 5, stepwiseProb: 0.50, maxLeap: 5,
    chromaticBudget: [2, 4], chromaticProb: 0.15,
    syncopationProb: 0.26, tripletBudget: [1, 3], tripletProb: 0.50,
    tieProb: 0.25, restProb: 0.20, dottedProb: 0.30,
    contraryMotionRatio: 0.65, bassIndependence: 0.85,
    voiceCrossingMax: 2, consonanceRatio: 0.78,
    cadenceType: ['perfect', 'half', 'plagal', 'deceptive', 'cadential64'],
    maxTraps: 3,
  },
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

export function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// uid, makeNote → imported from scoreUtils

/** 직전 으뜸 성부 음(쉼표 제외) — 붙임줄(같은 음) 여부 판별용 */
export function lastNonRestMelody(notes: ScoreNote[]): ScoreNote | null {
  for (let k = notes.length - 1; k >= 0; k--) {
    if (notes[k].pitch !== 'rest') return notes[k];
  }
  return null;
}

export function samePitchHeight(a: ScoreNote, pitch: PitchName, octave: number, accidental: Accidental): boolean {
  return a.pitch === pitch && a.octave === octave && a.accidental === accidental;
}

// makeRest, noteNumToNote → imported from scoreUtils
// fillRhythm → ./trebleRhythmFill

// generateProgression → imported from scoreUtils

// ── 셋잇단음표 삽입 ──
export function tryInsertTriplet(
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
      // tupletNoteDur: [2, 1, 1] — 합계 4 (4분음표 span)
      ...(k === 0
        ? { tuplet: '3' as const, tupletSpan: '4' as NoteDuration, tupletNoteDur: 2 }
        : { tupletNoteDur: 1 }),
    });
  }
  return { inserted: true };
}

// ────────────────────────────────────────────────────────────────
// ★ 후처리: 연속 동일음 3회 이상 제거 (안전망)
// ────────────────────────────────────────────────────────────────
// ★ 후처리: 임시표 정리 — 대위법 보정 후 깨진 임시표 제거
// ────────────────────────────────────────────────────────────────
/**
 * 대위법·강박 보정 등의 후처리에서 음이 이동하면 임시표의 해결 관계가 깨질 수 있다.
 * 1) 해결 없는 임시표 (다음 음과 >3반음) → 임시표 제거
 * 2) 인접 동일 임시표 (같은 음·같은 임시표 연속) → 두 번째 임시표 제거
 * 3) 진입 단2도 (직전 음과 1반음) → 임시표 제거
 * 4) 진입 큰도약 (직전 음과 >7반음) → 임시표 제거
 * 5) 삼전음 (직전 또는 다음 음과 6반음) → 임시표 제거
 */
export function cleanupBrokenAccidentals(
  notes: ScoreNote[],
  keySignature: string,
  bassNotes?: ScoreNote[],
): void {
  // §2.3 베이스 협화 검사용: 오프셋 → 베이스 MIDI 매핑
  const trebleOffsets: number[] = [];
  { let off = 0; for (const tn of notes) { trebleOffsets.push(off); off += tn.tupletNoteDur ?? durationToSixteenths(tn.duration); } }

  let bassMidiAt: ((off: number) => number) | null = null;
  if (bassNotes && bassNotes.length > 0) {
    const bassEntries: { off: number; midi: number }[] = [];
    let bOff = 0;
    for (const bn of bassNotes) {
      if (bn.pitch !== 'rest') {
        bassEntries.push({ off: bOff, midi: noteToMidiWithKey(bn, keySignature) });
      }
      bOff += bn.tupletNoteDur ?? durationToSixteenths(bn.duration);
    }
    bassMidiAt = (tOff: number) => {
      let best = 0;
      for (const e of bassEntries) {
        if (e.off <= tOff) best = e.midi; else break;
      }
      return best;
    };
  }

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.accidental) continue;
    if (n.pitch === 'rest') continue;

    // ── 인접 동일 임시표: 직전 음과 같은 음+임시표면 두 번째 제거 ──
    if (i > 0) {
      const prev = notes[i - 1];
      if (prev.pitch === n.pitch && prev.octave === n.octave &&
          prev.accidental === n.accidental) {
        notes[i] = { ...n, accidental: '' as Accidental };
        continue;
      }
    }

    const curMidi = noteToMidiWithKey(n, keySignature);

    // ── 베이스 불협화 검사: m2(1), M7(11), m9(13) → 임시표 제거 ──
    if (bassMidiAt) {
      const bassMidi = bassMidiAt(trebleOffsets[i]);
      if (bassMidi > 0) {
        const iv = ((curMidi - bassMidi) % 12 + 12) % 12;
        const absDist = Math.abs(curMidi - bassMidi);
        if (iv === 1 || iv === 11 || absDist === 13) {
          notes[i] = { ...n, accidental: '' as Accidental };
          continue;
        }
      }
    }

    // ── 직전 피치음과의 관계 검사 ──
    let prevMidi = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (notes[j].pitch !== 'rest') {
        prevMidi = noteToMidiWithKey(notes[j], keySignature);
        break;
      }
    }
    if (prevMidi > 0) {
      const entryDist = Math.abs(curMidi - prevMidi);
      // 단2도(1반음) 진입: 불협화 충돌
      if (entryDist === 1) {
        notes[i] = { ...n, accidental: '' as Accidental };
        continue;
      }
      // 큰 도약(>7반음) 진입: 부자연스러운 연결
      if (entryDist > 7) {
        notes[i] = { ...n, accidental: '' as Accidental };
        continue;
      }
      // 삼전음(6반음) 진입
      if (entryDist === 6) {
        notes[i] = { ...n, accidental: '' as Accidental };
        continue;
      }
    }

    // ── 같은방향 연속 도약: prev→acc→next 모두 같은 방향 + 양쪽 3반음 이상 ──
    if (prevMidi > 0) {
      let nextMidiForDir = -1;
      for (let j = i + 1; j < notes.length; j++) {
        if (notes[j].pitch !== 'rest') {
          nextMidiForDir = noteToMidiWithKey(notes[j], keySignature);
          break;
        }
      }
      if (nextMidiForDir > 0) {
        const entryDir = curMidi - prevMidi;
        const exitDir = nextMidiForDir - curMidi;
        // 같은 방향으로 양쪽 다 3반음 이상 도약
        if (entryDir > 0 && exitDir > 0 && Math.abs(entryDir) >= 3 && Math.abs(exitDir) >= 3) {
          notes[i] = { ...n, accidental: '' as Accidental };
          continue;
        }
        if (entryDir < 0 && exitDir < 0 && Math.abs(entryDir) >= 3 && Math.abs(exitDir) >= 3) {
          notes[i] = { ...n, accidental: '' as Accidental };
          continue;
        }
      }
    }

    // ── 다음 피치음과의 관계 검사 ──
    let nextMidi = -1;
    for (let j = i + 1; j < notes.length; j++) {
      if (notes[j].pitch !== 'rest') {
        nextMidi = noteToMidiWithKey(notes[j], keySignature);
        break;
      }
    }
    if (nextMidi > 0) {
      const exitDist = Math.abs(curMidi - nextMidi);
      // 해결 없는 임시표: >3반음 도약
      if (exitDist > 3) {
        notes[i] = { ...n, accidental: '' as Accidental };
        continue;
      }
      // 삼전음(6반음) 탈출
      if (exitDist === 6) {
        notes[i] = { ...n, accidental: '' as Accidental };
        continue;
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// ★ 후처리: 삼전음(Tritone, 6반음) 도약 보정
// ────────────────────────────────────────────────────────────────
/**
 * 인접한 두 음의 MIDI 거리가 정확히 6반음(증4도/감5도)이면
 * 두 번째 음을 ±1 스케일도 이동하여 삼전음을 회피.
 */
export function fixTritoneleaps(
  notes: ScoreNote[],
  scale: PitchName[],
  baseOctave: number,
  keySignature: string,
): void {
  for (let i = 1; i < notes.length; i++) {
    const prev = notes[i - 1];
    const cur = notes[i];
    if (prev.pitch === 'rest' || cur.pitch === 'rest') continue;
    // 타이로 연결된 음은 스킵
    if (prev.tie) continue;

    const prevMidi = noteToMidiWithKey(prev, keySignature);
    const curMidi = noteToMidiWithKey(cur, keySignature);
    if (Math.abs(curMidi - prevMidi) !== 6) continue;

    // 임시표가 있는 음은 임시표 제거로 해결 시도
    if (cur.accidental) {
      const stripped = { ...cur, accidental: '' as Accidental };
      const strippedMidi = noteToMidiWithKey(stripped, keySignature);
      if (Math.abs(strippedMidi - prevMidi) !== 6) {
        notes[i] = stripped;
        continue;
      }
    }

    // 스케일 음 ±1도 이동
    const curNn = scaleNoteToNn(cur.pitch, cur.octave, scale, baseOctave);
    if (curNn < 0) continue; // 스케일 음이 아니면 스킵

    const dir = curMidi > prevMidi ? -1 : 1; // 반대 방향으로 축소
    for (const delta of [dir, -dir]) {
      const candNn = curNn + delta;
      if (candNn < 0) continue;
      const cand = noteNumToNote(candNn, scale, baseOctave);
      const candMidi = noteToMidiWithKey(makeNote(cand.pitch, cand.octave, cur.duration), keySignature);
      if (Math.abs(candMidi - prevMidi) !== 6 && cand.octave >= 2 && cand.octave <= 6) {
        notes[i] = { ...cur, pitch: cand.pitch as PitchName, octave: cand.octave, accidental: '' as Accidental };
        break;
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
/**
 * MIDI 기준 연속 3회 이상 동일음을 인접 음계음으로 교체.
 * 타이로 연결된 음은 의도적 반복이므로 건드리지 않는다.
 */
export function fixConsecutiveRepeats(
  notes: ScoreNote[],
  scale: PitchName[],
  baseOctave: number,
  keySignature: string,
): void {
  // 종지 마디 마지막 음은 으뜸음이므로 교체 금지
  let lastMelodicIdx = -1;
  for (let k = notes.length - 1; k >= 0; k--) {
    if (notes[k].pitch !== 'rest') { lastMelodicIdx = k; break; }
  }

  const MAX_REPEAT = 2; // 최대 허용 연속 동일음 (2 = 타이 1쌍)
  let runStart = 0;
  for (let i = 1; i <= notes.length; i++) {
    const prev = notes[i - 1];
    const cur = i < notes.length ? notes[i] : null;
    const same = cur &&
      cur.pitch !== 'rest' && prev.pitch !== 'rest' &&
      noteToMidiWithKey(cur, keySignature) === noteToMidiWithKey(prev, keySignature);
    if (same) continue;

    // run: [runStart .. i-1] 모두 같은 MIDI
    const runLen = i - runStart;
    if (runLen > MAX_REPEAT) {
      // runStart+MAX_REPEAT 부터 끝까지 교체
      const baseMidi = noteToMidiWithKey(notes[runStart], keySignature);
      for (let j = runStart + MAX_REPEAT; j < i; j++) {
        const n = notes[j];
        if (n.pitch === 'rest') continue;
        // 종지음(마지막 멜로디 음)은 교체 금지
        if (j === lastMelodicIdx) continue;
        // 타이 앞 음이면 스킵 (타이 쌍은 의도적)
        if (j > 0 && notes[j - 1].tie) continue;
        // 순차 이동: 위로 1도 시도, 실패 시 아래로
        const curNn = scaleNoteToNn(n.pitch, n.octave, scale, baseOctave);
        const upNn = curNn + 1;
        const dnNn = curNn - 1;
        const up = noteNumToNote(upNn, scale, baseOctave);
        const dn = noteNumToNote(dnNn, scale, baseOctave);
        const upMidi = noteToMidiWithKey(makeNote(up.pitch, up.octave, n.duration), keySignature);
        const dnMidi = noteToMidiWithKey(makeNote(dn.pitch, dn.octave, n.duration), keySignature);
        // 이전 음과 다른 방향 우선
        const target = (upMidi !== baseMidi && up.octave <= 5) ? up
          : (dnMidi !== baseMidi && dn.octave >= 2) ? dn : up;
        notes[j] = { ...n, pitch: target.pitch as PitchName, octave: target.octave, accidental: '' as Accidental };
      }
    }
    runStart = i;
  }
}

// scaleNoteToNn → imported from scoreUtils

// ────────────────────────────────────────────────────────────────
// ★ 후처리: 단조 대사관계(False Relation / Cross-Relation) 방지
// ────────────────────────────────────────────────────────────────
/**
 * 단조에서 트레블이 올린 7음(이끔음)을 연주하는 박자에 베이스가 내린 7음(자연단음계)을
 * 동시 또는 인접 박자에서 연주하면 대사관계(cross-relation)가 발생.
 * 해당 베이스 음을 근음(1도)으로 교체하여 해결.
 */
export function fixMinorCrossRelation(
  treble: ScoreNote[], bass: ScoreNote[],
  scale: PitchName[], seventhDeg: PitchName, leadingAcc: Accidental,
  bassBase: number, keySignature: string, sixteenthsPerBar: number,
): void {
  if (!leadingAcc || bass.length === 0) return;

  // 트레블/베이스 공격점 타임라인 구축
  const trebleAttacks: { offset: number; idx: number; note: ScoreNote }[] = [];
  const bassAttacks: { offset: number; idx: number; note: ScoreNote }[] = [];
  let off = 0;
  for (let i = 0; i < treble.length; i++) {
    trebleAttacks.push({ offset: off, idx: i, note: treble[i] });
    off += durationToSixteenths(treble[i].duration);
  }
  off = 0;
  for (let i = 0; i < bass.length; i++) {
    bassAttacks.push({ offset: off, idx: i, note: bass[i] });
    off += durationToSixteenths(bass[i].duration);
  }

  // 트레블에서 올린 7음 사용 위치 수집
  const raisedOffsets = new Set<number>();
  for (const ta of trebleAttacks) {
    if (ta.note.pitch === seventhDeg && ta.note.accidental === leadingAcc) {
      raisedOffsets.add(ta.offset);
    }
  }
  if (raisedOffsets.size === 0) return;

  // 베이스에서 내린 7음(자연단음계 7음, 임시표 없음)이 동시 또는 ±1박 이내에 있으면 교체
  const tonicPitch = scale[0];
  for (const ba of bassAttacks) {
    if (ba.note.pitch !== seventhDeg || ba.note.accidental !== '') continue;
    // 동시 또는 인접 박자 확인
    const beatLen = sixteenthsPerBar >= 12 ? 6 : 4; // 복합박자 6, 단순박자 4
    const hasCrossRelation = [...raisedOffsets].some(ro => Math.abs(ro - ba.offset) <= beatLen);
    if (!hasCrossRelation) continue;
    // 근음으로 교체
    const { octave } = noteNumToNote(0, scale, bassBase);
    const oct = Math.max(2, Math.min(4, octave));
    bass[ba.idx] = { ...ba.note, pitch: tonicPitch, octave: oct };
  }
}

// ────────────────────────────────────────────────────────────────
// ★ 종지 쉼표 — 마지막 마디 하드코딩
// ────────────────────────────────────────────────────────────────
export function generateCadenceMeasure(
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

/**
 * 새 2성부: 대위 보정·후처리 후에도 종지 마지막 **실음**이 으뜸(트레블)·근음(베이스)이 되도록 복구.
 * `generateCadenceMeasure`와 같은 음높이 규칙을 쓴다.
 */
export function forceGrandStaffFinalTonic(
  treble: ScoreNote[],
  bass: ScoreNote[],
  scale: PitchName[],
  trebleBase: number,
  bassBase: number,
): void {
  const tTonic = noteNumToNote(0, scale, trebleBase);
  for (let i = treble.length - 1; i >= 0; i--) {
    if (treble[i].pitch === 'rest') continue;
    treble[i] = {
      ...treble[i],
      pitch: tTonic.pitch,
      octave: tTonic.octave,
      accidental: '' as Accidental,
    };
    break;
  }
  const bDeg = noteNumToNote(0, scale, bassBase);
  const bOct = Math.max(2, Math.min(3, bDeg.octave));
  for (let i = bass.length - 1; i >= 0; i--) {
    if (bass[i].pitch === 'rest') continue;
    bass[i] = {
      ...bass[i],
      pitch: bDeg.pitch,
      octave: bOct,
      accidental: '' as Accidental,
    };
    break;
  }
}

// ────────────────────────────────────────────────────────────────
// ★ 곡 내부 쉼표 — 후처리
// ────────────────────────────────────────────────────────────────
export function applyInternalRests(
  treble: ScoreNote[],
  bass: ScoreNote[],
  difficulty: Difficulty,
  measures: number,
  sixteenthsPerBar: number,
  useGrandStaff: boolean,
  timeSignature?: string,
): void {
  const lvl = difficultyLevel(difficulty);
  const params = LEVEL_PARAMS[difficulty];
  const beatSize = (() => {
    if (!timeSignature) return 4;
    const [, bs] = timeSignature.split('/');
    return 16 / (parseInt(bs, 10) || 4);
  })();

  // 쉼표 예산: L1=0, L2~L4=최대1, L5+=최대2
  const maxBudget = lvl === 1 ? 0 : lvl <= 4 ? 1 : 2;
  // 0~maxBudget 범위 (0이면 쉼표 없음 → ~50% 확률로 쉼표 삽입)
  const budget = maxBudget === 0 || params.restProb === 0
    ? 0
    : Math.floor(Math.random() * (maxBudget + 1));
  if (budget === 0) return;

  type NotePos = { noteIdx: number; bar: number; offset: number; dur: number };
  const sizMap: Record<NoteDuration, number> = {
    '1': 16, '1.': 24, '2': 8, '2.': 12, '4': 4, '4.': 6, '8': 2, '8.': 3, '16': 1,
  };

  const timeline: NotePos[] = [];
  let pos = 0;
  let tupletRemain = 0;
  let tupletActualTotal = 0;
  let tupletNoteIdx = 0;
  let tupletCount = 0;
  for (let i = 0; i < treble.length; i++) {
    const note = treble[i];
    let dur: number;

    if (note.tuplet) {
      // 셋잇단 그룹 시작: 실제 재생 시간으로 계산
      tupletCount = parseInt(note.tuplet, 10);
      const spanDur = note.tupletSpan || note.duration;
      tupletActualTotal = getTupletActualSixteenths(note.tuplet, spanDur);
      tupletRemain = tupletCount;
      tupletNoteIdx = 0;
    }

    if (tupletRemain > 0) {
      // 셋잇단 음표: 첫 음에 전체 실제 시간 할당, 나머지는 0
      // (inTuplet으로 후보에서 제외되므로 개별 offset 정확도 불필요)
      dur = tupletNoteIdx === 0 ? tupletActualTotal : 0;
      tupletNoteIdx++;
      tupletRemain--;
    } else {
      dur = sizMap[note.duration] ?? 4;
    }

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
    // L2: 4분음표 + 점4분음표, 약박 위치
    candidates = timeline.filter((p, idx) =>
      (p.dur === 4 || p.dur === 6) &&
      (p.offset === 4 || p.offset === 12) &&
      !isRest(p.noteIdx) &&
      !inTuplet.has(p.noteIdx) &&
      !isRest(timeline[idx - 1]?.noteIdx ?? -1) &&
      !isRest(timeline[idx + 1]?.noteIdx ?? -1)
    );
  } else {
    // 중급·고급: 4분 쉼표 + 점4분 쉼표 + 8분 쉼표 (정박만)
    const quarterCandidates = timeline.filter((p, idx) =>
      (p.dur === 4 || p.dur === 6) &&
      (p.offset === 4 || p.offset === 12) &&
      !isRest(p.noteIdx) && !inTuplet.has(p.noteIdx) &&
      !isRest(timeline[idx - 1]?.noteIdx ?? -1) &&
      !isRest(timeline[idx + 1]?.noteIdx ?? -1)
    );
    // 8분 쉼표: 정박(박 머리) 위치에서만 허용 — 엇박 8분 쉼표 방지
    const eighthCandidates = timeline.filter((p, idx) => {
      if (p.dur !== 2) return false;
      if (p.offset % beatSize !== 0) return false; // 정박만
      if (p.bar === 0 && p.offset === 0) return false; // 첫 마디 첫 박 제외
      const next = timeline[idx + 1];
      if (!next || next.dur !== 2) return false;
      return !isRest(p.noteIdx) && !inTuplet.has(p.noteIdx) &&
        !isRest(timeline[idx - 1]?.noteIdx ?? -1) && !isRest(next.noteIdx);
    });
    // 8분 쉼표 비중을 높여 실제 선택 확률 확보 (1:2)
    candidates = [...quarterCandidates, ...eighthCandidates, ...eighthCandidates];
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
// 선율 규칙 (1성부 선율 작법 가이드라인)
// ────────────────────────────────────────────────────────────────

/**
 * Rule 2: 증/감음정 금지 — 트라이톤·증2도 직접 도약 방지.
 * 금지 음정이면 nn을 ±1 조정하여 회피.
 */
export function fixForbiddenInterval(
  nn: number, prevNn: number,
  scale: PitchName[], baseOctave: number, keySignature: string,
  rangeMin: number, rangeMax: number,
): number {
  const nnDist = Math.abs(nn - prevNn);
  if (nnDist === 0) return nn;
  const semi = getMidiInterval(prevNn, nn, scale, baseOctave, keySignature);
  if (!isForbiddenMelodicInterval(semi, nnDist)) return nn;

  // nn ±1 중 금지 아닌 쪽 선택
  const dir = nn > prevNn ? 1 : -1;
  for (const delta of [dir, -dir]) {
    const cand = nn + delta;
    if (cand < rangeMin || cand > rangeMax) continue;
    const candSemi = getMidiInterval(prevNn, cand, scale, baseOctave, keySignature);
    const candNnDist = Math.abs(cand - prevNn);
    if (!isForbiddenMelodicInterval(candSemi, candNnDist)) return cand;
  }
  // 두 쪽 다 금지면 ±2 시도
  for (const delta of [dir * 2, -dir * 2]) {
    const cand = nn + delta;
    if (cand < rangeMin || cand > rangeMax) continue;
    const candSemi = getMidiInterval(prevNn, cand, scale, baseOctave, keySignature);
    const candNnDist = Math.abs(cand - prevNn);
    if (!isForbiddenMelodicInterval(candSemi, candNnDist)) return cand;
  }
  return nn; // 극히 드문 경우 그대로
}

/**
 * Rule 1: 갭-필 원칙 — 완전4도(nn 4) 이상 도약 후 반대방향 순차 강제.
 * isInTriadChain이면 예외 (Rule 3 트라이어드 진행 중).
 */
export function applyGapFill(
  nn: number, prevNn: number, prevInterval: number, prevDir: number,
  isInTriadChain: boolean,
  rangeMin: number, rangeMax: number,
): number {
  if (isInTriadChain) return nn;
  if (Math.abs(prevInterval) < 4) return nn;
  // 반대방향 순차 강제
  const target = prevNn + (prevDir > 0 ? -1 : 1);
  return Math.max(rangeMin, Math.min(rangeMax, target));
}

/** 스케일 디그리 집합이 어떤 온음계 3화음의 부분집합인지 판별 */
export function isTriadSubset(degrees: number[]): boolean {
  // 7개 온음계 3화음: I(0,2,4) ii(1,3,5) iii(2,4,6) IV(3,5,0) V(4,6,1) vi(5,0,2) vii°(6,1,3)
  const triads = [
    [0, 2, 4], [1, 3, 5], [2, 4, 6],
    [0, 3, 5], [1, 4, 6], [0, 2, 5], [1, 3, 6],
  ];
  const degSet = new Set(degrees.map(d => ((d % 7) + 7) % 7));
  return triads.some(t => {
    const ts = new Set(t);
    for (const d of degSet) {
      if (!ts.has(d)) return false;
    }
    return true;
  });
}

/**
 * Rule 3: 연속 도약 트라이어드 — 2+ 연속 도약 시 3화음 음형 검증.
 * 트라이어드 미형성 시 순차로 전환.
 */
export function checkConsecutiveLeapTriad(
  nn: number, prevNn: number, interval: number,
  leapNotes: number[],
): { nn: number; isTriadChain: boolean; leapNotes: number[] } {
  const isLeap = Math.abs(interval) >= 2;
  if (!isLeap) {
    return { nn, isTriadChain: false, leapNotes: [nn] };
  }
  // 도약 — 리프 체인에 추가
  const newLeap = leapNotes.length === 0 ? [prevNn, nn] : [...leapNotes, nn];
  if (newLeap.length >= 3) {
    // 3+ 음 (2+ 연속 도약) — 트라이어드 검증
    if (isTriadSubset(newLeap)) {
      return { nn, isTriadChain: true, leapNotes: newLeap };
    }
    // 트라이어드 아님 → 순차 강제 (도약 방향의 1도)
    const step = interval > 0 ? 1 : -1;
    return { nn: prevNn + step, isTriadChain: false, leapNotes: [prevNn + step] };
  }
  return { nn, isTriadChain: false, leapNotes: newLeap };
}

/**
 * Rule 4: 경향음 해결 — 이끔음(7도)→으뜸음, 버금딸림음(4도)→가온음.
 */
export function applyTendencyResolution(
  nn: number, prevNn: number, isCadenceContext: boolean,
): number {
  const prevDeg = ((prevNn % 7) + 7) % 7;
  // 이끔음 (스케일 7도 = deg index 6) → 으뜸음으로 상행
  if (prevDeg === 6) {
    const target = prevNn + 1;
    if (isCadenceContext || Math.random() < 0.85) return target;
  }
  // 버금딸림음 (스케일 4도 = deg index 3) → 가온음으로 하행
  if (prevDeg === 3) {
    if (Math.random() < 0.60) return prevNn - 1;
  }
  return nn;
}

/**
 * Rule 5: 단일 정점 — 4마디 프레이즈 내 최고음은 정점 위치에서만 허용.
 */
export function enforcePeakNote(
  nn: number, bar: number, barPos: number,
  peak: { bar: number; peakNn: number },
): number {
  const atPeak = bar === peak.bar && barPos === 0;
  if (atPeak) {
    // 정점 위치: peakNn 이상으로 끌어올림
    return Math.max(nn, peak.peakNn);
  }
  // 비정점 위치: peakNn 미만으로 제한 (천장 plateau 방지를 위해 랜덤 오프셋)
  if (nn >= peak.peakNn) {
    return peak.peakNn - 1 - Math.floor(Math.random() * 2);
  }
  return nn;
}

