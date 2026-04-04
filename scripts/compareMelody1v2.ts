/**
 * 1성부 vs 2성부 멜로디 비교 분석 — 각 50개 샘플
 * 4/4 C장조 8마디, melodyLevel 5 (intermediate_2)
 *
 * 실행: npx tsx scripts/compareMelody1v2.ts
 */

import { generateMelody, type MelodyGeneratorOptions } from '../src/lib/twoVoice/melodyGenerator';
import { generateTwoVoiceStack, type TwoVoiceStackInput } from '../src/lib/twoVoice/twoVoiceStack';
import {
  generateProgression,
  getScaleDegrees,
  getBassBaseOctave,
  noteToMidiWithKey,
  durationToSixteenths,
  isForbiddenMelodicInterval,
  PITCH_ORDER,
  type ScoreNote,
  type PitchName,
} from '../src/lib/scoreUtils';
import type { TimeSignature } from '../src/lib/twoVoice/types';

// ── 설정 ──
const SAMPLES = 50;
const KEY = 'C';
const TIME_SIG: TimeSignature = '4/4';
const MEASURES = 9; // 8 body + 1 cadence
const MELODY_LEVEL = 5;
const TREBLE_BASE = 4;
const MODE: 'major' = 'major';

// ── 분석 메트릭 ──
interface MelodyAnalysis {
  noteCount: number;
  restCount: number;
  pitchRange: number;       // semitones
  minMidi: number;
  maxMidi: number;
  avgMidi: number;
  stepwiseRatio: number;    // 순차진행 비율
  leapRatio: number;        // 도약(3도 이상) 비율
  largeLeapCount: number;   // 4도 이상 도약 횟수
  maxLeapSemitones: number; // 최대 도약 (반음)
  directionChanges: number; // 진행방향 변경 횟수
  contourScore: number;     // 윤곽 다양성 (방향변경/총진행)
  consecutiveSameMax: number; // 최대 연속 동일음
  uniquePitches: number;    // 사용된 고유 음 수
  tieCount: number;
  accidentalCount: number;
  intervalDistribution: Record<number, number>; // 음정별 빈도
  forbiddenIntervals: number;
  // 화음톤 관련
  chordToneOnBeatRatio: number; // 강박 화음톤 비율
}

function analyzeMelody(notes: ScoreNote[], keySignature: string, progression: number[]): MelodyAnalysis {
  const pitched = notes.filter(n => n.pitch !== 'rest');
  const midis = pitched.map(n => noteToMidiWithKey(n, keySignature));

  const noteCount = pitched.length;
  const restCount = notes.filter(n => n.pitch === 'rest').length;
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const pitchRange = maxMidi - minMidi;
  const avgMidi = midis.reduce((a, b) => a + b, 0) / midis.length;

  // 음정 분석
  let stepwise = 0;
  let leaps = 0;
  let largeLeaps = 0;
  let maxLeapSemi = 0;
  let dirChanges = 0;
  let prevDir = 0;
  let consecutiveSame = 1;
  let consecutiveSameMax = 1;
  let forbidden = 0;
  const intervalDist: Record<number, number> = {};

  for (let i = 1; i < midis.length; i++) {
    const semi = Math.abs(midis[i] - midis[i - 1]);
    intervalDist[semi] = (intervalDist[semi] || 0) + 1;

    if (semi <= 2) stepwise++;
    else leaps++;
    if (semi >= 5) largeLeaps++;
    if (semi > maxLeapSemi) maxLeapSemi = semi;

    const dir = midis[i] > midis[i - 1] ? 1 : midis[i] < midis[i - 1] ? -1 : 0;
    if (dir !== 0 && dir !== prevDir && prevDir !== 0) dirChanges++;
    if (dir !== 0) prevDir = dir;

    if (midis[i] === midis[i - 1]) {
      consecutiveSame++;
      if (consecutiveSame > consecutiveSameMax) consecutiveSameMax = consecutiveSame;
    } else {
      consecutiveSame = 1;
    }

    // nn 거리 추정 (대략적)
    const nnDist = Math.round(semi / 2); // 근사
    if (isForbiddenMelodicInterval(semi, nnDist)) forbidden++;
  }

  const totalMoves = midis.length - 1;
  const stepwiseRatio = totalMoves > 0 ? stepwise / totalMoves : 0;
  const leapRatio = totalMoves > 0 ? leaps / totalMoves : 0;
  const contourScore = totalMoves > 0 ? dirChanges / totalMoves : 0;

  const uniquePitches = new Set(midis).size;
  const tieCount = notes.filter(n => n.tie).length;
  const accidentalCount = notes.filter(n => n.accidental).length;

  // 강박 화음톤 비율 (4/4 기준: 0, 8 sixteenths)
  const CHORD_TONES_MAP: Record<number, number[]> = {
    0: [0, 2, 4], 1: [1, 3, 5], 2: [2, 4, 6], 3: [3, 5, 0],
    4: [4, 6, 1], 5: [5, 0, 2], 6: [6, 1, 3],
  };
  const scale = getScaleDegrees(keySignature);
  let onBeatTotal = 0;
  let onBeatChordTone = 0;
  let pos = 0;
  const sixteenthsPerBar = 16; // 4/4
  for (const n of notes) {
    const dur = n.tupletNoteDur ?? durationToSixteenths(n.duration);
    const barOffset = pos % sixteenthsPerBar;
    const bar = Math.floor(pos / sixteenthsPerBar);
    if (barOffset === 0 || barOffset === 8) { // 강박
      if (n.pitch !== 'rest') {
        onBeatTotal++;
        const deg = scale.indexOf(n.pitch as PitchName);
        const chordDeg = (progression[bar] ?? 0) % 7;
        const tones = CHORD_TONES_MAP[chordDeg] || [0, 2, 4];
        if (deg >= 0 && tones.includes(deg)) onBeatChordTone++;
      }
    }
    pos += dur;
  }
  const chordToneOnBeatRatio = onBeatTotal > 0 ? onBeatChordTone / onBeatTotal : 0;

  return {
    noteCount, restCount, pitchRange, minMidi, maxMidi, avgMidi,
    stepwiseRatio, leapRatio, largeLeapCount: largeLeaps, maxLeapSemitones: maxLeapSemi,
    directionChanges: dirChanges, contourScore, consecutiveSameMax,
    uniquePitches, tieCount, accidentalCount, intervalDistribution: intervalDist,
    forbiddenIntervals: forbidden, chordToneOnBeatRatio,
  };
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

// ── 메인 ──
function main() {
  const oneVoiceResults: MelodyAnalysis[] = [];
  const twoVoiceResults: MelodyAnalysis[] = [];

  console.log('=== 1성부 vs 2성부 멜로디 비교 분석 ===');
  console.log(`설정: ${KEY} ${MODE} ${TIME_SIG} ${MEASURES}마디(종지 포함) melodyLevel=${MELODY_LEVEL}`);
  console.log(`샘플 수: 각 ${SAMPLES}개\n`);

  // ── 1성부 생성 ──
  console.log('1성부 생성 중...');
  for (let i = 0; i < SAMPLES; i++) {
    const progression = generateProgression(MEASURES, false);
    const opts: MelodyGeneratorOptions = {
      key: KEY,
      mode: MODE,
      timeSig: TIME_SIG,
      measures: MEASURES,
      melodyLevel: MELODY_LEVEL,
      progression,
      trebleBaseOctave: TREBLE_BASE,
      melodyNnMin: 0,
      melodyNnMax: 12,
      // bassNotes 생략 → 1성부
    };
    const notes = generateMelody(opts);
    oneVoiceResults.push(analyzeMelody(notes, KEY, progression));
  }

  // ── 2성부 생성 ──
  console.log('2성부 생성 중...');
  for (let i = 0; i < SAMPLES; i++) {
    const progression = generateProgression(MEASURES, false);
    const input: TwoVoiceStackInput = {
      keySignature: KEY,
      mode: MODE,
      timeSig: TIME_SIG,
      measures: MEASURES,
      tvMeasures: 8,
      bassLevel: 2,
      melodyLevel: MELODY_LEVEL,
      progression,
      trebleBaseOctave: TREBLE_BASE,
      melodyNnMin: 0,
      melodyNnMax: 12,
    };
    const stack = generateTwoVoiceStack(input);
    twoVoiceResults.push(analyzeMelody(stack.trebleScoreNotes, KEY, progression));
  }

  // ── 비교 출력 ──
  function summarize(label: string, results: MelodyAnalysis[]) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${label} (${results.length}개 샘플)`);
    console.log(`${'─'.repeat(60)}`);

    const field = (name: string, extractor: (r: MelodyAnalysis) => number, format?: (v: number) => string) => {
      const vals = results.map(extractor);
      const fmt = format || ((v: number) => v.toFixed(2));
      console.log(`  ${name.padEnd(28)} 평균=${fmt(avg(vals))}  σ=${fmt(stddev(vals))}  min=${fmt(Math.min(...vals))}  max=${fmt(Math.max(...vals))}`);
    };

    field('음표 수', r => r.noteCount, v => v.toFixed(0));
    field('쉼표 수', r => r.restCount, v => v.toFixed(0));
    field('음역 (반음)', r => r.pitchRange, v => v.toFixed(1));
    field('최저 MIDI', r => r.minMidi, v => v.toFixed(0));
    field('최고 MIDI', r => r.maxMidi, v => v.toFixed(0));
    field('평균 MIDI', r => r.avgMidi, v => v.toFixed(1));
    field('고유 음고 수', r => r.uniquePitches, v => v.toFixed(1));
    field('순차진행 비율', r => r.stepwiseRatio, pct);
    field('도약 비율', r => r.leapRatio, pct);
    field('큰 도약(≥4도) 횟수', r => r.largeLeapCount, v => v.toFixed(1));
    field('최대 도약 (반음)', r => r.maxLeapSemitones, v => v.toFixed(1));
    field('방향전환 횟수', r => r.directionChanges, v => v.toFixed(1));
    field('윤곽 다양성', r => r.contourScore, v => v.toFixed(3));
    field('최대 연속 동일음', r => r.consecutiveSameMax, v => v.toFixed(1));
    field('타이 수', r => r.tieCount, v => v.toFixed(1));
    field('임시표 수', r => r.accidentalCount, v => v.toFixed(1));
    field('금지음정 위반', r => r.forbiddenIntervals, v => v.toFixed(1));
    field('강박 화음톤 비율', r => r.chordToneOnBeatRatio, pct);

    // 음정 분포 종합
    const allIntervals: Record<number, number> = {};
    for (const r of results) {
      for (const [k, v] of Object.entries(r.intervalDistribution)) {
        allIntervals[Number(k)] = (allIntervals[Number(k)] || 0) + v;
      }
    }
    const totalIntervals = Object.values(allIntervals).reduce((a, b) => a + b, 0);
    console.log(`\n  음정 분포 (반음):`);
    const sorted = Object.entries(allIntervals).sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [semi, count] of sorted) {
      const bar = '█'.repeat(Math.round((count / totalIntervals) * 60));
      console.log(`    ${semi.padStart(2)}반음: ${pct(count / totalIntervals).padStart(6)} ${bar}  (${count}회)`);
    }
  }

  summarize('1성부 (베이스 없음)', oneVoiceResults);
  summarize('2성부 (베이스 있음)', twoVoiceResults);

  // ── 핵심 차이 요약 ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  핵심 비교 요약');
  console.log(`${'═'.repeat(60)}`);

  const metrics = [
    { name: '음표 수', ext: (r: MelodyAnalysis) => r.noteCount },
    { name: '음역 (반음)', ext: (r: MelodyAnalysis) => r.pitchRange },
    { name: '순차진행 비율', ext: (r: MelodyAnalysis) => r.stepwiseRatio, fmt: pct },
    { name: '도약 비율', ext: (r: MelodyAnalysis) => r.leapRatio, fmt: pct },
    { name: '최대 도약', ext: (r: MelodyAnalysis) => r.maxLeapSemitones },
    { name: '윤곽 다양성', ext: (r: MelodyAnalysis) => r.contourScore },
    { name: '고유 음고 수', ext: (r: MelodyAnalysis) => r.uniquePitches },
    { name: '강박 화음톤', ext: (r: MelodyAnalysis) => r.chordToneOnBeatRatio, fmt: pct },
    { name: '최대 연속동일음', ext: (r: MelodyAnalysis) => r.consecutiveSameMax },
    { name: '타이', ext: (r: MelodyAnalysis) => r.tieCount },
    { name: '임시표', ext: (r: MelodyAnalysis) => r.accidentalCount },
    { name: '금지음정', ext: (r: MelodyAnalysis) => r.forbiddenIntervals },
  ];

  console.log(`  ${'메트릭'.padEnd(20)} ${'1성부'.padStart(10)} ${'2성부'.padStart(10)} ${'차이'.padStart(10)}`);
  console.log(`  ${'─'.repeat(52)}`);
  for (const m of metrics) {
    const v1 = avg(oneVoiceResults.map(m.ext));
    const v2 = avg(twoVoiceResults.map(m.ext));
    const diff = v2 - v1;
    const fmt = m.fmt || ((v: number) => v.toFixed(2));
    const sign = diff > 0 ? '+' : '';
    console.log(`  ${m.name.padEnd(20)} ${fmt(v1).padStart(10)} ${fmt(v2).padStart(10)} ${(sign + fmt(diff)).padStart(10)}`);
  }

  console.log(`\n완료.`);
}

main();
