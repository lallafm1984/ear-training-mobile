/**
 * 2성부 악보 벌크 테스트 — 100개 샘플 QA
 * 4/4 C장조 고급1(advanced_1) + 베이스4단계(bass_4)
 *
 * 실행: npx tsx scripts/bulkTest100.ts
 */

import { generateScore, type GeneratorOptions } from '../src/lib/scoreGenerator';
import {
  nnToMidi,
  getScaleDegrees,
  getBassBaseOctave,
  noteToMidiWithKey,
  getStrongBeatOffsets,
  CHORD_TONES,
  type PitchName,
} from '../src/lib/scoreUtils';

// ── 설정 ──
const SAMPLES = 100;
const OPTS: GeneratorOptions = {
  keySignature: 'C',
  timeSignature: '4/4',
  difficulty: 'advanced_1',
  measures: 8,
  useGrandStaff: true,
  bassDifficulty: 'bass_4',
};

// ── 분석 결과 구조체 ──
interface SampleAnalysis {
  id: number;
  trebleNoteCount: number;
  bassNoteCount: number;
  // 화성 진행
  progressionDegrees: number[];  // 마디별 베이스 루트 음계도
  progressionStr: string;
  // 수직 협화
  strongBeatConsonance: number;  // 강박 협화율 (%)
  weakBeatConsonance: number;
  dissonantPositions: string[];
  // 성부 간격
  minSpacing: number;  // 최소 간격 (반음)
  maxSpacing: number;
  spacingViolations: number;  // 간격 < 3반음
  // 성부 교차
  voiceCrossings: number;
  // 병행 5/8도
  parallel5ths: number;
  parallel8ves: number;
  // 베이스 다양성
  bassUniqueRoots: number;
  bassLeapCount: number;
  bassStepCount: number;
  bassRepeatCount: number;  // 연속 동음
  // 트레블 다양성
  trebleRange: number;  // 반음 범위
  trebleLeapCount: number;
  // 리듬
  bassRhythmPatterns: number;  // 고유 리듬 패턴 수
  // 종지
  endsOnTonic: boolean;
  penultimateDominant: boolean;
  // 에러
  errors: string[];
}

// ── MIDI helpers ──
const CONSONANT_INTERVALS = new Set([0, 3, 4, 5, 7, 8, 9, 12]); // P1, m3, M3, P4, P5, m6, M6, P8
const PERFECT_INTERVALS = new Set([0, 7, 12]); // P1, P5, P8

function durationToSixteenths(dur: string): number {
  const map: Record<string, number> = {
    '16': 1, '8': 2, '8.': 3, '4': 4, '4.': 6, '2': 8, '2.': 12, '1': 16,
  };
  return map[dur] || 1;
}

function pitchToMidi(pitch: string, octave: number): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
  };
  const base = pitch.charAt(0).toUpperCase();
  let midi = (octave + 1) * 12 + (noteMap[base] || 0);
  if (pitch.includes('#') || pitch.includes('♯')) midi++;
  if (pitch.includes('b') || pitch.includes('♭')) midi--;
  return midi;
}

function analyzeSample(id: number): SampleAnalysis {
  const errors: string[] = [];
  let score;
  try {
    score = generateScore(OPTS);
  } catch (e: any) {
    return {
      id, trebleNoteCount: 0, bassNoteCount: 0,
      progressionDegrees: [], progressionStr: 'ERROR',
      strongBeatConsonance: 0, weakBeatConsonance: 0, dissonantPositions: [],
      minSpacing: 0, maxSpacing: 0, spacingViolations: 0,
      voiceCrossings: 0, parallel5ths: 0, parallel8ves: 0,
      bassUniqueRoots: 0, bassLeapCount: 0, bassStepCount: 0, bassRepeatCount: 0,
      trebleRange: 0, trebleLeapCount: 0, bassRhythmPatterns: 0,
      endsOnTonic: false, penultimateDominant: false,
      errors: [`Generation failed: ${e.message}`],
    };
  }

  const treble = score.trebleNotes || [];
  const bass = score.bassNotes || [];
  const keySignature = OPTS.keySignature;

  // ── 베이스 루트 분석 (마디별) ──
  const measuresCount = OPTS.measures;
  const progressionDegrees: number[] = [];
  const bassPerMeasure: typeof bass[] = [];
  for (let m = 0; m < measuresCount; m++) {
    const barBass = bass.filter((n: any) => {
      const notePos = bass.indexOf(n);
      // 간단한 마디 귀속: 16분음표 누적 위치 기준
      return true; // 아래에서 개별 처리
    });
    bassPerMeasure.push([]);
  }

  // 베이스 음표를 마디별로 분류
  let bassPos = 0;
  let currentMeasure = 0;
  const sixteenthsPerBar = 16; // 4/4
  for (const n of bass) {
    if (n.pitch === 'rest') {
      bassPos += durationToSixteenths(n.duration);
      if (bassPos >= (currentMeasure + 1) * sixteenthsPerBar) {
        currentMeasure = Math.floor(bassPos / sixteenthsPerBar);
      }
      continue;
    }
    const m = Math.min(Math.floor(bassPos / sixteenthsPerBar), measuresCount - 1);
    if (!bassPerMeasure[m]) bassPerMeasure[m] = [];
    bassPerMeasure[m].push(n);
    bassPos += durationToSixteenths(n.duration);
    currentMeasure = Math.floor(bassPos / sixteenthsPerBar);
  }

  // 마디 첫 음의 음계도 추출
  const scale = getScaleDegrees(keySignature);
  for (let m = 0; m < measuresCount; m++) {
    const barNotes = bassPerMeasure[m] || [];
    if (barNotes.length > 0 && barNotes[0].pitch !== 'rest') {
      const midi = noteToMidiWithKey(barNotes[0], keySignature);
      // C기준 음계도 매핑
      const pc = ((midi % 12) + 12) % 12;
      const degMap: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
      progressionDegrees.push(degMap[pc] ?? -1);
    } else {
      progressionDegrees.push(-1);
    }
  }

  const degNames = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const progressionStr = progressionDegrees.map(d => d >= 0 ? degNames[d] : '?').join('–');

  // ── 수직 협화 분석 ──
  const strongBeats = getStrongBeatOffsets(OPTS.timeSignature);
  let strongConsonant = 0, strongTotal = 0;
  let weakConsonant = 0, weakTotal = 0;
  const dissonantPositions: string[] = [];

  // 트레블/베이스 attack 맵 구축
  const trebleMidis: { pos: number; midi: number; dur: number }[] = [];
  const bassMidis: { pos: number; midi: number; dur: number }[] = [];

  let tPos = 0;
  for (const n of treble) {
    const dur = durationToSixteenths(n.duration);
    if (n.pitch !== 'rest') {
      trebleMidis.push({ pos: tPos, midi: noteToMidiWithKey(n, keySignature), dur });
    }
    tPos += dur;
  }

  let bPos = 0;
  for (const n of bass) {
    const dur = durationToSixteenths(n.duration);
    if (n.pitch !== 'rest') {
      bassMidis.push({ pos: bPos, midi: noteToMidiWithKey(n, keySignature), dur });
    }
    bPos += dur;
  }

  // 간격/협화 분석
  let minSpacing = Infinity, maxSpacing = -Infinity;
  let spacingViolations = 0, voiceCrossings = 0;
  let parallel5ths = 0, parallel8ves = 0;

  // 각 16분음표 위치에서 울리는 트레블/베이스 MIDI
  const totalSixteenths = measuresCount * sixteenthsPerBar;

  function soundingAt(events: typeof trebleMidis, pos: number): number | null {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].pos <= pos && events[i].pos + events[i].dur > pos) {
        return events[i].midi;
      }
    }
    return null;
  }

  let prevInterval: number | null = null;
  for (let pos = 0; pos < totalSixteenths; pos++) {
    const tMidi = soundingAt(trebleMidis, pos);
    const bMidi = soundingAt(bassMidis, pos);
    if (tMidi === null || bMidi === null) { prevInterval = null; continue; }

    const spacing = tMidi - bMidi;
    const interval = Math.abs(spacing) % 12;
    const isConsonant = CONSONANT_INTERVALS.has(interval);

    if (spacing < 0) voiceCrossings++;
    if (spacing >= 0 && spacing < 3) spacingViolations++;
    if (spacing >= 0) {
      minSpacing = Math.min(minSpacing, spacing);
      maxSpacing = Math.max(maxSpacing, spacing);
    }

    const barPos = pos % sixteenthsPerBar;
    const isStrong = strongBeats.has(barPos);

    if (isStrong) {
      strongTotal++;
      if (isConsonant) strongConsonant++;
      else dissonantPositions.push(`m${Math.floor(pos / sixteenthsPerBar) + 1}b${barPos}`);
    } else {
      weakTotal++;
      if (isConsonant) weakConsonant++;
    }

    // 병행 5/8도 체크
    if (prevInterval !== null) {
      const isPerfect = PERFECT_INTERVALS.has(interval);
      const wasPerfect = PERFECT_INTERVALS.has(Math.abs(prevInterval) % 12);
      if (isPerfect && wasPerfect && interval === (Math.abs(prevInterval) % 12) && interval !== 0) {
        if (interval === 7) parallel5ths++;
        if (interval === 0 || interval === 12) parallel8ves++;
      }
    }
    prevInterval = interval;
  }

  // ── 베이스 선율 분석 ──
  let bassLeapCount = 0, bassStepCount = 0, bassRepeatCount = 0;
  const bassRoots = new Set<number>();
  const bassRhythmSet = new Set<string>();

  for (let m = 0; m < measuresCount; m++) {
    const barNotes = bassPerMeasure[m] || [];
    if (barNotes.length > 0 && barNotes[0].pitch !== 'rest') {
      bassRoots.add(noteToMidiWithKey(barNotes[0], keySignature) % 12);
    }
    const rhythmKey = barNotes.map((n: any) => n.duration).join(',');
    bassRhythmSet.add(rhythmKey);
  }

  for (let i = 1; i < bassMidis.length; i++) {
    const interval = Math.abs(bassMidis[i].midi - bassMidis[i - 1].midi);
    if (interval === 0) bassRepeatCount++;
    else if (interval <= 2) bassStepCount++;
    else bassLeapCount++;
  }

  // ── 트레블 분석 ──
  let trebleMin = Infinity, trebleMax = -Infinity;
  let trebleLeapCount = 0;
  for (let i = 0; i < trebleMidis.length; i++) {
    trebleMin = Math.min(trebleMin, trebleMidis[i].midi);
    trebleMax = Math.max(trebleMax, trebleMidis[i].midi);
    if (i > 0) {
      const interval = Math.abs(trebleMidis[i].midi - trebleMidis[i - 1].midi);
      if (interval > 4) trebleLeapCount++;
    }
  }

  // ── 종지 분석 ──
  const endsOnTonic = progressionDegrees[measuresCount - 1] === 0;
  const penultimateDominant = measuresCount >= 2 && progressionDegrees[measuresCount - 2] === 4;

  // ── 에러 판정 ──
  if (!endsOnTonic) errors.push('마지막 마디가 I도가 아님');
  if (!penultimateDominant) errors.push('종지 전 V도 아님');
  if (strongTotal > 0 && strongConsonant / strongTotal < 0.7) {
    errors.push(`강박 협화율 ${(strongConsonant / strongTotal * 100).toFixed(0)}% < 70%`);
  }
  if (voiceCrossings > 2) errors.push(`성부 교차 ${voiceCrossings}회`);
  if (bassRepeatCount > bassMidis.length * 0.3) errors.push(`베이스 동음 반복 과다`);

  return {
    id,
    trebleNoteCount: treble.filter((n: any) => n.pitch !== 'rest').length,
    bassNoteCount: bass.filter((n: any) => n.pitch !== 'rest').length,
    progressionDegrees,
    progressionStr,
    strongBeatConsonance: strongTotal > 0 ? Math.round(strongConsonant / strongTotal * 100) : 100,
    weakBeatConsonance: weakTotal > 0 ? Math.round(weakConsonant / weakTotal * 100) : 100,
    dissonantPositions: dissonantPositions.slice(0, 5),
    minSpacing: minSpacing === Infinity ? 0 : minSpacing,
    maxSpacing: maxSpacing === -Infinity ? 0 : maxSpacing,
    spacingViolations,
    voiceCrossings,
    parallel5ths,
    parallel8ves,
    bassUniqueRoots: bassRoots.size,
    bassLeapCount,
    bassStepCount,
    bassRepeatCount,
    trebleRange: trebleMax - trebleMin,
    trebleLeapCount,
    bassRhythmPatterns: bassRhythmSet.size,
    endsOnTonic,
    penultimateDominant,
    errors,
  };
}

// ── 실행 ──
console.log(`=== 2성부 벌크 QA: ${SAMPLES}개 | 4/4 C장조 | advanced_1 + bass_4 ===\n`);

const results: SampleAnalysis[] = [];
const startTime = performance.now();

for (let i = 0; i < SAMPLES; i++) {
  results.push(analyzeSample(i + 1));
}

const elapsed = performance.now() - startTime;

// ── 통계 집계 ──
const valid = results.filter(r => r.errors.length === 0);
const errorSamples = results.filter(r => r.errors.length > 0);

// 진행 패턴 분포
const progCounts = new Map<string, number>();
for (const r of results) {
  progCounts.set(r.progressionStr, (progCounts.get(r.progressionStr) || 0) + 1);
}

// 수치 통계 함수
function stats(arr: number[]) {
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / arr.length * 10) / 10,
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

// ── 출력 ──
console.log('── 1. 생성 성공률 ──');
console.log(`  성공: ${valid.length}/${SAMPLES} (${(valid.length / SAMPLES * 100).toFixed(0)}%)`);
console.log(`  소요시간: ${elapsed.toFixed(0)}ms (평균 ${(elapsed / SAMPLES).toFixed(1)}ms/sample)`);

console.log('\n── 2. 화성 진행 다양성 ──');
console.log(`  고유 진행 패턴: ${progCounts.size}종`);
const sortedProgs = [...progCounts.entries()].sort((a, b) => b[1] - a[1]);
for (const [prog, count] of sortedProgs.slice(0, 15)) {
  console.log(`    ${prog}  ×${count}`);
}
if (sortedProgs.length > 15) console.log(`    ... 외 ${sortedProgs.length - 15}종`);

// 최다 패턴 비율
const topProgRatio = sortedProgs[0][1] / SAMPLES * 100;
console.log(`  최다 패턴 비율: ${topProgRatio.toFixed(0)}% ${topProgRatio > 30 ? '⚠ 편중' : '✓ 양호'}`);

// 마디별 음계도 분포
console.log('\n  마디별 음계도 분포:');
const degNames = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
for (let m = 0; m < OPTS.measures; m++) {
  const degCount = new Map<number, number>();
  for (const r of results) {
    const d = r.progressionDegrees[m];
    degCount.set(d, (degCount.get(d) || 0) + 1);
  }
  const parts = [...degCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d, c]) => `${d >= 0 ? degNames[d] : '?'}:${c}`)
    .join(' ');
  console.log(`    m${m + 1}: ${parts}`);
}

console.log('\n── 3. 수직 협화 ──');
const strongCons = results.map(r => r.strongBeatConsonance);
const weakCons = results.map(r => r.weakBeatConsonance);
const sStats = stats(strongCons);
const wStats = stats(weakCons);
console.log(`  강박 협화율: avg=${sStats.avg}% min=${sStats.min}% max=${sStats.max}%`);
console.log(`  약박 협화율: avg=${wStats.avg}% min=${wStats.min}% max=${wStats.max}%`);
const lowConsonance = results.filter(r => r.strongBeatConsonance < 70).length;
console.log(`  강박 협화율 < 70%: ${lowConsonance}개 ${lowConsonance > 10 ? '⚠' : '✓'}`);

console.log('\n── 4. 성부 간격 ──');
const minSp = stats(results.map(r => r.minSpacing));
const maxSp = stats(results.map(r => r.maxSpacing));
const spViol = stats(results.map(r => r.spacingViolations));
console.log(`  최소 간격: avg=${minSp.avg} min=${minSp.min} max=${minSp.max} (반음)`);
console.log(`  최대 간격: avg=${maxSp.avg} min=${maxSp.min} max=${maxSp.max} (반음)`);
console.log(`  간격 위반(<3반음): avg=${spViol.avg} max=${spViol.max} ${spViol.avg > 5 ? '⚠' : '✓'}`);

console.log('\n── 5. 성부 교차 / 병행 5·8도 ──');
const crossings = stats(results.map(r => r.voiceCrossings));
const p5 = stats(results.map(r => r.parallel5ths));
const p8 = stats(results.map(r => r.parallel8ves));
console.log(`  성부 교차: avg=${crossings.avg} max=${crossings.max} ${crossings.avg > 3 ? '⚠' : '✓'}`);
console.log(`  병행 5도: avg=${p5.avg} max=${p5.max} ${p5.avg > 2 ? '⚠' : '✓'}`);
console.log(`  병행 8도: avg=${p8.avg} max=${p8.max} ${p8.avg > 2 ? '⚠' : '✓'}`);

console.log('\n── 6. 베이스 선율 ──');
const bRoots = stats(results.map(r => r.bassUniqueRoots));
const bLeaps = stats(results.map(r => r.bassLeapCount));
const bSteps = stats(results.map(r => r.bassStepCount));
const bRepeats = stats(results.map(r => r.bassRepeatCount));
const bRhythm = stats(results.map(r => r.bassRhythmPatterns));
console.log(`  마디 첫 박 고유 루트: avg=${bRoots.avg} min=${bRoots.min} max=${bRoots.max}`);
console.log(`  도약 음정: avg=${bLeaps.avg} ${bLeaps.avg < 2 ? '⚠ 부족' : '✓'}`);
console.log(`  순차 진행: avg=${bSteps.avg}`);
console.log(`  동음 반복: avg=${bRepeats.avg} max=${bRepeats.max} ${bRepeats.avg > 5 ? '⚠ 과다' : '✓'}`);
console.log(`  리듬 패턴 종류: avg=${bRhythm.avg} min=${bRhythm.min} max=${bRhythm.max}`);

console.log('\n── 7. 트레블 선율 ──');
const tRange = stats(results.map(r => r.trebleRange));
const tLeaps = stats(results.map(r => r.trebleLeapCount));
const tNotes = stats(results.map(r => r.trebleNoteCount));
console.log(`  음역 범위: avg=${tRange.avg} min=${tRange.min} max=${tRange.max} (반음)`);
console.log(`  도약 횟수: avg=${tLeaps.avg}`);
console.log(`  음표 수: avg=${tNotes.avg}`);

console.log('\n── 8. 종지 ──');
const tonicEnd = results.filter(r => r.endsOnTonic).length;
const domPen = results.filter(r => r.penultimateDominant).length;
console.log(`  마지막 마디 I도: ${tonicEnd}/${SAMPLES} (${(tonicEnd / SAMPLES * 100).toFixed(0)}%)`);
console.log(`  종지 전 V도: ${domPen}/${SAMPLES} (${(domPen / SAMPLES * 100).toFixed(0)}%)`);

console.log('\n── 9. 에러 요약 ──');
if (errorSamples.length === 0) {
  console.log('  에러 없음 ✓');
} else {
  const errorCounts = new Map<string, number>();
  for (const r of errorSamples) {
    for (const e of r.errors) {
      errorCounts.set(e, (errorCounts.get(e) || 0) + 1);
    }
  }
  for (const [err, count] of [...errorCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${err}: ${count}개`);
  }
  // 에러 샘플 상세 (최대 5개)
  console.log('\n  에러 샘플 상세 (최대 5개):');
  for (const r of errorSamples.slice(0, 5)) {
    console.log(`    #${r.id}: ${r.errors.join(', ')} | 진행: ${r.progressionStr}`);
  }
}

// ── 종합 판정 ──
console.log('\n══════════════════════════════════════════');
const issues: string[] = [];
if (valid.length < 90) issues.push(`성공률 ${valid.length}% < 90%`);
if (progCounts.size < 8) issues.push(`진행 다양성 ${progCounts.size}종 < 8종`);
if (topProgRatio > 30) issues.push(`최다 패턴 편중 ${topProgRatio.toFixed(0)}%`);
if (sStats.avg < 70) issues.push(`강박 협화율 avg ${sStats.avg}% < 70%`);
if (crossings.avg > 3) issues.push(`성부 교차 avg ${crossings.avg}`);
if (bRepeats.avg > 5) issues.push(`베이스 동음 반복 과다 avg ${bRepeats.avg}`);
if (bRoots.avg < 3) issues.push(`베이스 루트 다양성 부족 avg ${bRoots.avg}`);
if (tonicEnd < 95) issues.push(`종지 I도 미달 ${tonicEnd}%`);

if (issues.length === 0) {
  console.log('종합: PASS ✓ — 전체적으로 양호');
} else {
  console.log(`종합: ${issues.length}건 주의사항`);
  for (const i of issues) console.log(`  ⚠ ${i}`);
}
console.log('══════════════════════════════════════════');
