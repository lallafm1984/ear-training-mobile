// ────────────────────────────────────────────────────────────────
// finalSanity — 최종 선율·대위 안전망
//
// 모든 후처리(쉼표 삽입·박자 분할·반복음·대사관계·종지 강제·임시표 정리)가 끝난 뒤
// 한 번 더 검사해, 청음 시험 출제 관행에 어긋나는 결과를 "최소 변경"으로 고친다.
//  · 선율: 삼전음(6)·증2도·7도(10·11)·9도 이상 도약 — 쉼표를 건너뛰는 도약도 포함
//          (쉼표 뒤의 음도 귀에는 직전 음에서 도약한 것으로 들린다)
//  · 선율: 같은 음 3회 이상 연속
//  · 2성부: 강박 불협화, 연속 공격점 사이의 병행 8도·5도 (한 성부만 새로 공격해도 검사)
// 교체 후보는 온음계 음만 사용하고, 현재 선율 음역 안에서 원음과 가장 가까운 음을 고른다.
// 종지음(마지막 실음)은 바꾸지 않고, 첫 음은 으뜸3화음 구성음만 허용한다.
// ────────────────────────────────────────────────────────────────

import type { ScoreNote, PitchName, Accidental } from '../scoreUtils';
import {
  durationToSixteenths,
  getTupletActualSixteenths,
  noteToMidiWithKey,
  makeNote,
  noteNumToNote,
  getStrongBeatOffsets,
  MIN_TREBLE_BASS_SEMITONES,
} from '../scoreUtils';

export interface FinalSanityOptions {
  treble: ScoreNote[];
  /** 수직 검사용 베이스 (1성부는 내부 화성 베이스를 넘긴다; 비어 있으면 수직 검사 생략) */
  bass: ScoreNote[];
  useGrandStaff: boolean;
  scale: PitchName[];
  baseOctave: number;
  keySignature: string;
  timeSignature: string;
  sixteenthsPerBar: number;
}

export interface FinalSanityReport {
  dissonanceFixes: number;
  parallelFixes: number;
  leapFixes: number;
  repeatFixes: number;
  rangeFixes: number;
  unresolved: number;
}

interface Ev {
  idx: number;
  start: number;
  dur: number;
  midi: number; // 쉼표 = -1
  onset: boolean; // 새 공격 (타이로 이어진 뒷음은 false)
}

/** 2성부 강박에서 피하는 음정류: m2·M2·P4·삼전음·m7·M7 */
const STRONG_DISSONANT_PC = new Set([1, 2, 5, 6, 10, 11]);
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const TREBLE_FLOOR_MIDI = 55; // G3
const TREBLE_CEIL_MIDI = 81; // A5
const MAX_ITER = 16;

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const letterPos = (n: ScoreNote) => (LETTER_INDEX[n.pitch] ?? 0) + 7 * n.octave;
const sameSpelling = (a: ScoreNote, b: ScoreNote) =>
  a.pitch === b.pitch && a.octave === b.octave && a.accidental === b.accidental;

/**
 * 두 실음 사이의 선율 진행이 청음 시험에서 피하는 도약인지.
 * 삼전음(6)·7도(10·11)·9도 이상(>12)·증2도(3반음 + 인접 음이름). 옥타브(12)는 허용.
 */
export function isBadMelodicStep(
  a: ScoreNote,
  b: ScoreNote,
  midiA: number,
  midiB: number,
): boolean {
  const d = Math.abs(midiB - midiA);
  if (d === 6 || d === 10 || d === 11 || d > 12) return true;
  if (d === 3 && Math.abs(letterPos(b) - letterPos(a)) === 1) return true;
  return false;
}

function buildEvents(notes: ScoreNote[], keySignature: string): Ev[] {
  const evs: Ev[] = [];
  let pos = 0;
  let tupletRemain = 0;
  let tupletDur = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.tuplet && tupletRemain === 0) {
      const count = parseInt(n.tuplet, 10) || 3;
      const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
      tupletDur = span / count;
      tupletRemain = count;
    }
    let dur: number;
    if (tupletRemain > 0) {
      dur = tupletDur;
      tupletRemain--;
    } else {
      dur = durationToSixteenths(n.duration);
    }
    const prev = notes[i - 1];
    const isRest = n.pitch === 'rest';
    const tiedFromPrev =
      !!prev && !!prev.tie && prev.pitch !== 'rest' && !isRest && sameSpelling(prev, n);
    evs.push({
      idx: i,
      start: pos,
      dur,
      midi: isRest ? -1 : noteToMidiWithKey(n, keySignature),
      onset: !isRest && !tiedFromPrev,
    });
    pos += dur;
  }
  return evs;
}

/**
 * 최종 안전망 적용. treble 배열을 제자리에서 수정하고 수정 횟수를 돌려준다.
 */
export function applyFinalSanity(o: FinalSanityOptions): FinalSanityReport {
  const { treble, bass, scale, baseOctave, keySignature, sixteenthsPerBar } = o;
  const report: FinalSanityReport = {
    dissonanceFixes: 0,
    parallelFixes: 0,
    leapFixes: 0,
    repeatFixes: 0,
    rangeFixes: 0,
    unresolved: 0,
  };
  if (treble.length === 0) return report;

  const strongOffsets = getStrongBeatOffsets(o.timeSignature);
  const compound = /^(6|9|12)\/8$/.test(o.timeSignature);
  const beatSize = compound ? 6 : 16 / (parseInt(o.timeSignature.split('/')[1], 10) || 4);
  const hasBass = bass.length > 0;

  let tEvs = buildEvents(treble, keySignature);
  const bEvs = buildEvents(bass, keySignature);
  const refresh = () => {
    tEvs = buildEvents(treble, keySignature);
  };

  const totalLen = () => {
    const last = tEvs[tEvs.length - 1];
    return last.start + last.dur;
  };
  const bassAt = (t: number): number => {
    const e = bEvs.find((x) => x.midi > 0 && x.start <= t && x.start + x.dur > t);
    return e ? e.midi : -1;
  };
  const trebleAt = (t: number): Ev | undefined =>
    tEvs.find((x) => x.midi > 0 && x.start <= t && x.start + x.dur > t);
  const onsets = () => tEvs.filter((e) => e.onset);
  const onsetBefore = (idx: number): Ev | undefined => {
    let r: Ev | undefined;
    for (const e of tEvs) {
      if (e.idx >= idx) break;
      if (e.onset) r = e;
    }
    return r;
  };
  const onsetAfter = (idx: number): Ev | undefined => tEvs.find((e) => e.idx > idx && e.onset);
  const attackTimes = (): number[] => {
    const set = new Set<number>();
    for (const e of tEvs) if (e.onset) set.add(e.start);
    for (const e of bEvs) if (e.onset) set.add(e.start);
    return [...set].sort((a, b) => a - b);
  };
  const prevAttackTime = (t: number): number | null => {
    let r: number | null = null;
    for (const a of attackTimes()) {
      if (a >= t) break;
      r = a;
    }
    return r;
  };
  const nextAttackTime = (t: number): number | null => {
    for (const a of attackTimes()) if (a > t) return a;
    return null;
  };

  /** idx가 속한 타이 묶음(같은 음으로 이어진 연속 음표들)의 인덱스 목록 */
  const groupOf = (idx: number): number[] => {
    let s = idx;
    while (
      s > 0 &&
      treble[s - 1].tie &&
      treble[s - 1].pitch !== 'rest' &&
      sameSpelling(treble[s - 1], treble[s])
    ) {
      s--;
    }
    let e = idx;
    while (e < treble.length - 1 && treble[e].tie && sameSpelling(treble[e], treble[e + 1])) e++;
    const g: number[] = [];
    for (let k = s; k <= e; k++) g.push(k);
    return g;
  };
  const groupEnd = (g: number[]) => {
    const last = tEvs[g[g.length - 1]];
    return last.start + last.dur;
  };

  let lastPitchedIdx = -1;
  for (let i = treble.length - 1; i >= 0; i--) {
    if (treble[i].pitch !== 'rest') {
      lastPitchedIdx = i;
      break;
    }
  }
  const firstPitchedIdx = treble.findIndex((n) => n.pitch !== 'rest');
  const isFinalNote = (idx: number) => groupOf(idx).includes(lastPitchedIdx);

  const pitchedMidis = tEvs.filter((e) => e.midi > 0).map((e) => e.midi);
  const minMidi = Math.max(TREBLE_FLOOR_MIDI, Math.min(...pitchedMidis));
  const maxMidi = Math.min(TREBLE_CEIL_MIDI, Math.max(...pitchedMidis));

  type Cand = { pitch: PitchName; octave: number; midi: number; score: number[] };

  /**
   * idx(타이 묶음 전체)를 대신할 온음계 음을 찾는다. 없으면 null.
   * relaxed: 병행 완전음정·약박 불협화 순차 규칙·반음계 해결 규칙을 풀고 찾는 최후 수단
   * (금지 도약·강박 불협화·음역은 여전히 지킨다)
   */
  const findReplacement = (idx: number, widen: boolean, relaxed = false): Cand | null => {
    const g = groupOf(idx);
    const gStart = tEvs[g[0]];
    const gEnd = groupEnd(g);
    const orig = gStart.midi;
    const prev = onsetBefore(g[0]);
    const next = onsetAfter(g[g.length - 1]);
    const prev2 = prev ? onsetBefore(prev.idx) : undefined;
    const next2 = next ? onsetAfter(next.idx) : undefined;
    const isFirst = g[0] === firstPitchedIdx;
    const lo = widen ? Math.max(TREBLE_FLOOR_MIDI, minMidi - 4) : minMidi;
    const hi = widen
      ? Math.min(TREBLE_CEIL_MIDI, maxMidi + 4)
      : Math.min(TREBLE_CEIL_MIDI, maxMidi);

    // 수직 검사 지점: 묶음 시작 + 묶음 지속 중 베이스 공격·강박
    const checkTimes: number[] = [gStart.start];
    if (hasBass) {
      for (const be of bEvs) {
        if (be.midi > 0 && be.start > gStart.start && be.start < gEnd) checkTimes.push(be.start);
      }
      for (let t = Math.ceil(gStart.start / beatSize) * beatSize; t < gEnd; t += beatSize) {
        if (strongOffsets.has(t % sixteenthsPerBar) && !checkTimes.includes(t)) checkTimes.push(t);
      }
    }

    const cands: Cand[] = [];
    for (let nn = -21; nn <= 21; nn++) {
      const { pitch, octave } = noteNumToNote(nn, scale, baseOctave);
      const note = makeNote(pitch as PitchName, octave, treble[g[0]].duration);
      const midi = noteToMidiWithKey(note, keySignature);
      if (midi < lo || midi > hi || midi === orig) continue;
      if (isFirst && ![0, 2, 4].includes(scale.indexOf(pitch as PitchName))) continue;

      if (prev) {
        if (isBadMelodicStep(treble[prev.idx], note, prev.midi, midi)) continue;
        if (midi === prev.midi && !!prev2 && prev2.midi === midi) continue;
        // 직전 음이 임시표(반음계음)이면 순차 해결을 유지
        if (!relaxed && treble[prev.idx].accidental && Math.abs(midi - prev.midi) > 2) continue;
      }
      if (next) {
        if (isBadMelodicStep(note, treble[next.idx], midi, next.midi)) continue;
        if (midi === next.midi && !!next2 && next2.midi === midi) continue;
      }
      if (prev && next && midi === prev.midi && midi === next.midi) continue;

      let weakDiss = 0;
      if (hasBass) {
        let ok = true;
        for (const t of checkTimes) {
          const bm = bassAt(t);
          if (bm < 0) continue;
          if (o.useGrandStaff && midi - bm < MIN_TREBLE_BASS_SEMITONES) {
            ok = false;
            break;
          }
          const pc = mod12(midi - bm);
          if (!STRONG_DISSONANT_PC.has(pc)) continue;
          if (strongOffsets.has(t % sixteenthsPerBar)) {
            ok = false;
            break;
          }
          // 약박 불협화는 순차로 들어오고 순차로 나갈 때(경과·보조음)만
          const stepIn = !prev || Math.abs(midi - prev.midi) <= 2;
          const stepOut = !next || Math.abs(midi - next.midi) <= 2;
          if (!relaxed && !(stepIn && stepOut)) {
            ok = false;
            break;
          }
          weakDiss = 1;
        }
        if (!ok) continue;

        // 병행 완전음정: 직전·직후 공격점의 수직 음정과 비교
        if (o.useGrandStaff && !relaxed) {
          const bmHere = bassAt(gStart.start);
          if (bmHere > 0) {
            const pc = mod12(midi - bmHere);
            if (pc === 0 || pc === 7) {
              const tp = prevAttackTime(gStart.start);
              if (tp !== null) {
                const tv = trebleAt(tp);
                const bv = bassAt(tp);
                if (tv && bv > 0 && tv.midi !== midi && bv !== bmHere) {
                  if (
                    mod12(tv.midi - bv) === pc &&
                    Math.sign(midi - tv.midi) === Math.sign(bmHere - bv)
                  ) {
                    continue;
                  }
                }
              }
              const tn = nextAttackTime(gStart.start);
              if (tn !== null) {
                const tvMidi = tn < gEnd ? midi : trebleAt(tn)?.midi;
                const bv = bassAt(tn);
                if (tvMidi !== undefined && bv > 0 && tvMidi !== midi && bv !== bmHere) {
                  if (
                    mod12(tvMidi - bv) === pc &&
                    Math.sign(tvMidi - midi) === Math.sign(bv - bmHere)
                  ) {
                    continue;
                  }
                }
              }
            }
          }
        }
      }

      const stepFromPrev = prev ? (Math.abs(midi - prev.midi) <= 2 ? 0 : 1) : 0;
      cands.push({
        pitch: pitch as PitchName,
        octave,
        midi,
        score: [Math.abs(midi - orig), weakDiss, stepFromPrev],
      });
    }
    if (cands.length === 0) return null;
    cands.sort((a, b) => {
      for (let k = 0; k < a.score.length; k++) {
        if (a.score[k] !== b.score[k]) return a.score[k] - b.score[k];
      }
      return 0;
    });
    return cands[0];
  };

  const tryFix = (idx: number, allowRelaxed = false): boolean => {
    if (isFinalNote(idx)) return false;
    const cand =
      findReplacement(idx, false) ??
      findReplacement(idx, true) ??
      (allowRelaxed
        ? (findReplacement(idx, false, true) ?? findReplacement(idx, true, true))
        : null);
    if (!cand) return false;
    for (const k of groupOf(idx)) {
      treble[k] = {
        ...treble[k],
        pitch: cand.pitch,
        octave: cand.octave,
        accidental: '' as Accidental,
      };
    }
    refresh();
    return true;
  };

  /** 강박 불협화 (2성부). 한 번의 순회에서 발견되는 모든 지점을 고친다. */
  const passDissonance = (): number => {
    if (!o.useGrandStaff || !hasBass) return 0;
    let fixes = 0;
    const total = totalLen();
    for (let t = 0; t < total; t += beatSize) {
      if (!strongOffsets.has(t % sixteenthsPerBar)) continue;
      const tv = trebleAt(t);
      const bv = bassAt(t);
      if (!tv || bv < 0) continue;
      if (!STRONG_DISSONANT_PC.has(mod12(tv.midi - bv))) continue;
      if (tryFix(tv.idx) || tryFix(tv.idx, true)) fixes++;
      else report.unresolved++;
    }
    return fixes;
  };

  /** 병행 8도·5도 (2성부). 하나 고치면 타임라인이 바뀌므로 즉시 반환. */
  const passParallels = (): number => {
    if (!o.useGrandStaff || !hasBass) return 0;
    let prevPair: { tv: Ev; bv: number } | null = null;
    for (const t of attackTimes()) {
      const tv = trebleAt(t);
      const bv = bassAt(t);
      if (!tv || bv < 0) {
        prevPair = null;
        continue;
      }
      if (prevPair) {
        const pc = mod12(tv.midi - bv);
        const ppc = mod12(prevPair.tv.midi - prevPair.bv);
        const tMove = tv.midi - prevPair.tv.midi;
        const bMove = bv - prevPair.bv;
        const bothPerfect = (pc === 0 && ppc === 0) || (pc === 7 && ppc === 7);
        if (bothPerfect && tMove !== 0 && bMove !== 0 && Math.sign(tMove) === Math.sign(bMove)) {
          const target = isFinalNote(tv.idx) ? prevPair.tv.idx : tv.idx;
          if (tryFix(target)) return 1;
          report.unresolved++;
        }
      }
      prevPair = { tv, bv };
    }
    return 0;
  };

  /** 금지 도약 (쉼표 건너뛰기 포함). 하나 고치면 즉시 반환. */
  const passLeaps = (): number => {
    const ons = onsets();
    for (let k = 1; k < ons.length; k++) {
      const a = ons[k - 1];
      const b = ons[k];
      if (!isBadMelodicStep(treble[a.idx], treble[b.idx], a.midi, b.midi)) continue;
      const fixed = isFinalNote(b.idx)
        ? tryFix(a.idx) || tryFix(a.idx, true)
        : tryFix(b.idx) || tryFix(a.idx) || tryFix(b.idx, true) || tryFix(a.idx, true);
      if (fixed) return 1;
      report.unresolved++;
    }
    return 0;
  };

  /** 같은 음 3회 이상 연속. 하나 고치면 즉시 반환. */
  const passRepeats = (): number => {
    const ons = onsets();
    let run = 1;
    for (let k = 1; k < ons.length; k++) {
      run = ons[k].midi === ons[k - 1].midi ? run + 1 : 1;
      if (run < 3) continue;
      const target = isFinalNote(ons[k].idx) ? ons[k - 1].idx : ons[k].idx;
      // 마지막 반복음은 수직 화성 때문에 대체할 수 없는 경우가 있다.
      // 같은 세 음의 앞쪽도 검사하되 종지음·성부 진행 제약은 그대로 지킨다.
      const targets = [...new Set([target, ons[k - 1].idx, ons[k - 2].idx])];
      if (targets.some((idx) => tryFix(idx))) return 1;
      report.unresolved++;
      run = 1;
    }
    return 0;
  };

  /** 음역 밖(A5 초과·G3 미만) 음. 후처리(반복음 보정 등)가 만든 초과분을 되돌린다. */
  const passRange = (): number => {
    for (const e of onsets()) {
      if (e.midi <= TREBLE_CEIL_MIDI && e.midi >= TREBLE_FLOOR_MIDI) continue;
      if (tryFix(e.idx) || tryFix(e.idx, true)) return 1;
      report.unresolved++;
    }
    return 0;
  };

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const g = passRange();
    const d = passDissonance();
    const p = passParallels();
    const l = passLeaps();
    const r = passRepeats();
    report.dissonanceFixes += d;
    report.parallelFixes += p;
    report.leapFixes += l;
    report.repeatFixes += r;
    report.rangeFixes += g;
    if (g + d + p + l + r === 0) break;
  }
  return report;
}
