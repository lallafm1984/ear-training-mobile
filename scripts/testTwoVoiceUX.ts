/**
 * 2성부 받아쓰기 UX 테스트 스크립트 v2
 * 난이도 4 × 박자 5 × 조성 14 × 30회 = 8,400회 생성 후 사용자 관점 분석
 *
 * 실행: npx tsx scripts/testTwoVoiceUX.ts
 */

import { generateScore } from '../src/lib/scoreGenerator';
import { durationToSixteenths, getSixteenthsPerBar } from '../src/lib/scoreUtils/duration';
import { pitchToMidi } from '../src/lib/scoreUtils/midi';
import type { Difficulty, BassDifficulty } from '../src/lib/scoreGenerator/types';
import type { ScoreNote } from '../src/lib/scoreUtils/types';

// ── 설정 ──
const TRIALS = 30;
const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '9/8'] as const;
const BASS_LEVELS: { bass: BassDifficulty; melody: Difficulty; label: string }[] = [
  { bass: 'bass_1', melody: 'beginner_3',      label: '1단계·기본베이스' },
  { bass: 'bass_2', melody: 'intermediate_1',   label: '2단계·리듬변화' },
  { bass: 'bass_3', melody: 'intermediate_3',   label: '3단계·대위법' },
  { bass: 'bass_4', melody: 'advanced_1',       label: '4단계·복잡성부' },
];
// 장조 8개 + 단조 6개 = 14개 대표 조성
const KEY_SIGS = [
  'C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb',       // 장조
  'Am', 'Em', 'Bm', 'Dm', 'Gm', 'Cm',              // 단조
];

// ── 헬퍼 ──
function sumSixteenths(notes: ScoreNote[]): number {
  let sum = 0;
  for (const n of notes) {
    if (n.tuplet) {
      sum += durationToSixteenths(n.tupletSpan ?? '4');
    } else {
      sum += durationToSixteenths(n.duration);
    }
  }
  return sum;
}

function getNoteRange(notes: ScoreNote[]): { min: number; max: number; span: number } {
  const midis = notes.filter(n => n.pitch !== 'rest').map(n => pitchToMidi(n));
  if (midis.length === 0) return { min: 0, max: 0, span: 0 };
  const min = Math.min(...midis);
  const max = Math.max(...midis);
  return { min, max, span: max - min };
}

function maxConsecutiveRepeat(notes: ScoreNote[]): number {
  let max = 1, cur = 1;
  const realNotes = notes.filter(n => n.pitch !== 'rest');
  for (let i = 1; i < realNotes.length; i++) {
    if (realNotes[i].pitch === realNotes[i-1].pitch &&
        realNotes[i].octave === realNotes[i-1].octave &&
        realNotes[i].accidental === realNotes[i-1].accidental) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 1;
    }
  }
  return max;
}

function minVoiceGap(treble: ScoreNote[], bass: ScoreNote[]): number {
  const trebleMidis = treble.filter(n => n.pitch !== 'rest').map(n => pitchToMidi(n));
  const bassMidis = bass.filter(n => n.pitch !== 'rest').map(n => pitchToMidi(n));
  if (trebleMidis.length === 0 || bassMidis.length === 0) return 99;
  return Math.min(...trebleMidis) - Math.max(...bassMidis);
}

function countStrongBeatDissonance(treble: ScoreNote[], bass: ScoreNote[], ts: string): number {
  const DISSONANT_PC = new Set([1, 2, 5, 6, 10, 11]);
  function buildAttackMap(notes: ScoreNote[]): Map<number, number> {
    const map = new Map<number, number>();
    let pos = 0;
    for (const n of notes) {
      if (n.pitch !== 'rest') map.set(pos, pitchToMidi(n));
      pos += n.tuplet ? durationToSixteenths(n.tupletSpan ?? '4') : durationToSixteenths(n.duration);
    }
    return map;
  }
  const tMap = buildAttackMap(treble);
  const bMap = buildAttackMap(bass);
  let count = 0;
  const barLen = getSixteenthsPerBar(ts);
  for (let bar = 0; bar < 4; bar++) {
    const offset = bar * barLen;
    const tMidi = tMap.get(offset);
    const bMidi = bMap.get(offset);
    if (tMidi !== undefined && bMidi !== undefined) {
      const pc = ((tMidi - bMidi) % 12 + 12) % 12;
      if (DISSONANT_PC.has(pc)) count++;
    }
  }
  return count;
}

function countParallelFifthsOctaves(treble: ScoreNote[], bass: ScoreNote[], ts: string): number {
  function buildTimeline(notes: ScoreNote[]): { start: number; end: number; midi: number }[] {
    const tl: { start: number; end: number; midi: number }[] = [];
    let pos = 0;
    for (const n of notes) {
      const dur = n.tuplet ? durationToSixteenths(n.tupletSpan ?? '4') : durationToSixteenths(n.duration);
      if (n.pitch !== 'rest') tl.push({ start: pos, end: pos + dur, midi: pitchToMidi(n) });
      pos += dur;
    }
    return tl;
  }
  const tTL = buildTimeline(treble);
  const bTL = buildTimeline(bass);
  const barLen = getSixteenthsPerBar(ts);
  const totalLen = barLen * 4;
  const [topStr, botStr] = ts.split('/');
  const top = parseInt(topStr, 10);
  const bot = parseInt(botStr, 10);
  const beatUnit = (bot === 8 && top % 3 === 0 && top >= 6) ? 6 : 4;

  type BeatPair = { tMidi: number; bMidi: number };
  const pairs: BeatPair[] = [];
  for (let pos = 0; pos < totalLen; pos += beatUnit) {
    const tE = tTL.find(e => e.start <= pos && e.end > pos);
    const bE = bTL.find(e => e.start <= pos && e.end > pos);
    if (tE && bE) pairs.push({ tMidi: tE.midi, bMidi: bE.midi });
  }

  let count = 0;
  for (let i = 1; i < pairs.length; i++) {
    const prevPc = ((pairs[i-1].tMidi - pairs[i-1].bMidi) % 12 + 12) % 12;
    const curPc = ((pairs[i].tMidi - pairs[i].bMidi) % 12 + 12) % 12;
    if ((prevPc === 7 && curPc === 7) || (prevPc === 0 && curPc === 0)) {
      const tDir = pairs[i].tMidi - pairs[i-1].tMidi;
      const bDir = pairs[i].bMidi - pairs[i-1].bMidi;
      if (tDir !== 0 && ((tDir > 0 && bDir > 0) || (tDir < 0 && bDir < 0))) count++;
    }
  }
  return count;
}

interface TrialResult {
  bass: BassDifficulty;
  ts: string;
  key: string;
  trebleCount: number;
  bassCount: number;
  trebleSixteenths: number;
  bassSixteenths: number;
  expectedSixteenths: number;
  trebleRange: { min: number; max: number; span: number };
  bassRange: { min: number; max: number; span: number };
  voiceGap: number;
  trebleRests: number;
  trebleTies: number;
  trebleTuplets: number;
  trebleDurations: string[];
  bassDurations: string[];
  trebleAccidentals: number;
  trebleMaxRepeat: number;
  bassMaxRepeat: number;
  strongBeatDissonance: number;
  parallelFifths: number;
}

function pct(n: number, total: number): string {
  return `${(n/total*100).toFixed(0)}%`;
}

// ── 메인 테스트 ──
function runTests() {
  const results: TrialResult[] = [];
  const errors: { bass: string; ts: string; key: string; error: string }[] = [];
  let totalRuns = 0;
  let totalErrors = 0;

  const totalExpected = BASS_LEVELS.length * TIME_SIGNATURES.length * KEY_SIGS.length * TRIALS;
  console.log(`테스트 시작: ${BASS_LEVELS.length}난이도 × ${TIME_SIGNATURES.length}박자 × ${KEY_SIGS.length}조성 × ${TRIALS}회 = ${totalExpected}회`);

  for (const level of BASS_LEVELS) {
    for (const ts of TIME_SIGNATURES) {
      for (const key of KEY_SIGS) {
        for (let t = 0; t < TRIALS; t++) {
          totalRuns++;
          try {
            const result = generateScore({
              keySignature: key,
              timeSignature: ts,
              difficulty: level.melody,
              bassDifficulty: level.bass,
              measures: 4,
              useGrandStaff: true,
            });
            const sixteenthsPerBar = getSixteenthsPerBar(ts);
            const expectedSixteenths = sixteenthsPerBar * 4;
            results.push({
              bass: level.bass, ts, key,
              trebleCount: result.trebleNotes.length,
              bassCount: result.bassNotes.length,
              trebleSixteenths: sumSixteenths(result.trebleNotes),
              bassSixteenths: sumSixteenths(result.bassNotes),
              expectedSixteenths,
              trebleRange: getNoteRange(result.trebleNotes),
              bassRange: getNoteRange(result.bassNotes),
              voiceGap: minVoiceGap(result.trebleNotes, result.bassNotes),
              trebleRests: result.trebleNotes.filter(n => n.pitch === 'rest').length,
              trebleTies: result.trebleNotes.filter(n => n.tie).length,
              trebleTuplets: result.trebleNotes.filter(n => n.tuplet).length,
              trebleDurations: [...new Set(result.trebleNotes.map(n => n.duration))].sort(),
              bassDurations: [...new Set(result.bassNotes.map(n => n.duration))].sort(),
              trebleAccidentals: result.trebleNotes.filter(n => n.accidental && n.accidental !== '').length,
              trebleMaxRepeat: maxConsecutiveRepeat(result.trebleNotes),
              bassMaxRepeat: maxConsecutiveRepeat(result.bassNotes),
              strongBeatDissonance: countStrongBeatDissonance(result.trebleNotes, result.bassNotes, ts),
              parallelFifths: countParallelFifthsOctaves(result.trebleNotes, result.bassNotes, ts),
            });
          } catch (e: any) {
            totalErrors++;
            errors.push({ bass: level.bass, ts, key, error: e.message ?? String(e) });
          }
        }
      }
    }
  }

  // ── 출력 ──
  console.log('='.repeat(90));
  console.log('2성부 받아쓰기 UX 테스트 결과 (난이도 × 박자 × 조성)');
  console.log(`총 실행: ${totalRuns} | 성공: ${totalRuns - totalErrors} | 에러: ${totalErrors}`);
  console.log('='.repeat(90));

  // 1. 에러 요약
  if (errors.length > 0) {
    console.log('\n[에러 목록]');
    const errorGroups: Record<string, number> = {};
    for (const e of errors) {
      const k = `[${e.bass}][${e.ts}][${e.key}] ${e.error.slice(0, 60)}`;
      errorGroups[k] = (errorGroups[k] || 0) + 1;
    }
    for (const [msg, count] of Object.entries(errorGroups).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${count}회: ${msg}`);
    }
  }

  // 2. 난이도별 × 박자별 요약 (조성 통합)
  for (const level of BASS_LEVELS) {
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`[${level.label}] (${level.bass} / melody=${level.melody})`);
    console.log('─'.repeat(90));

    for (const ts of TIME_SIGNATURES) {
      const subset = results.filter(r => r.bass === level.bass && r.ts === ts);
      const errCount = errors.filter(e => e.bass === level.bass && e.ts === ts).length;
      if (subset.length === 0) { console.log(`  [${ts}] 모두 에러 (${errCount}회)`); continue; }

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const issues: string[] = [];

      const trebleLenBad = subset.filter(r => r.trebleSixteenths !== r.expectedSixteenths);
      const bassLenBad = subset.filter(r => r.bassSixteenths !== r.expectedSixteenths);
      if (trebleLenBad.length > 0) issues.push(`트레블길이불일치 ${trebleLenBad.length}회`);
      if (bassLenBad.length > 0) issues.push(`베이스길이불일치 ${bassLenBad.length}회`);
      const crossing = subset.filter(r => r.voiceGap < 0);
      if (crossing.length > 0) issues.push(`성부교차 ${crossing.length}회`);
      const tooClose = subset.filter(r => r.voiceGap >= 0 && r.voiceGap < 12);
      if (tooClose.length > 0) issues.push(`간격<1옥 ${pct(tooClose.length, subset.length)}`);
      const maxRep = Math.max(...subset.map(r => r.trebleMaxRepeat));
      if (maxRep >= 5) issues.push(`같은음${maxRep}연속`);
      const diss = subset.reduce((s, r) => s + r.strongBeatDissonance, 0);
      if (diss > 0) issues.push(`강박불협${diss}회`);
      const para = subset.reduce((s, r) => s + r.parallelFifths, 0);
      if (para > 0) issues.push(`평행5/8=${para}회`);

      const avgTN = avg(subset.map(r => r.trebleCount)).toFixed(1);
      const avgBN = avg(subset.map(r => r.bassCount)).toFixed(1);
      const avgGap = avg(subset.map(r => r.voiceGap)).toFixed(1);
      const avgAcc = avg(subset.map(r => r.trebleAccidentals)).toFixed(1);

      console.log(`  [${ts}] ${subset.length}성공/${errCount}에러 | T=${avgTN} B=${avgBN} gap=${avgGap}st acc=${avgAcc} | ${issues.length === 0 ? 'OK' : issues.join(', ')}`);
    }
  }

  // 3. 조성별 문제 분석 (핵심)
  console.log(`\n${'='.repeat(90)}`);
  console.log('[조성별 문제 분석]');
  console.log('='.repeat(90));

  const isMinor = (k: string) => k.includes('m');
  const keyIssues: { key: string; issues: string[] }[] = [];

  for (const key of KEY_SIGS) {
    const subset = results.filter(r => r.key === key);
    const errCount = errors.filter(e => e.key === key).length;
    if (subset.length === 0) { keyIssues.push({ key, issues: [`모두에러(${errCount})`] }); continue; }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const issues: string[] = [];

    // 에러율
    if (errCount > 0) issues.push(`에러 ${errCount}회`);

    // 길이 불일치
    const lenBad = subset.filter(r => r.trebleSixteenths !== r.expectedSixteenths || r.bassSixteenths !== r.expectedSixteenths);
    if (lenBad.length > 0) issues.push(`길이불일치 ${lenBad.length}/${subset.length}`);

    // 성부 교차
    const cross = subset.filter(r => r.voiceGap < 0);
    if (cross.length > 0) issues.push(`성부교차 ${cross.length}회`);

    // 성부 간격
    const tooClose = subset.filter(r => r.voiceGap >= 0 && r.voiceGap < 12);
    const closeRate = tooClose.length / subset.length;
    if (closeRate > 0.3) issues.push(`간격<1옥 ${pct(tooClose.length, subset.length)}`);

    // 음역
    const avgSpan = avg(subset.map(r => r.trebleRange.span));
    if (avgSpan < 5) issues.push(`음역좁음(${avgSpan.toFixed(0)}st)`);
    if (avgSpan > 22) issues.push(`음역넓음(${avgSpan.toFixed(0)}st)`);

    // 같은 음 반복
    const maxRep = Math.max(...subset.map(r => r.trebleMaxRepeat));
    if (maxRep >= 5) issues.push(`같은음${maxRep}연속`);

    // 강박 불협화
    const diss = subset.reduce((s, r) => s + r.strongBeatDissonance, 0);
    const dissRate = diss / subset.length;
    if (dissRate > 0.1) issues.push(`강박불협 ${diss}회(${(dissRate*100).toFixed(0)}%)`);

    // 평행5/8도
    const para = subset.reduce((s, r) => s + r.parallelFifths, 0);
    const paraRate = para / subset.length;
    if (paraRate > 0.1) issues.push(`평행5/8 ${para}회(${(paraRate*100).toFixed(0)}%)`);

    // 임시표 비율
    const avgAcc = avg(subset.map(r => r.trebleAccidentals));
    if (isMinor(key) && avgAcc > 3) issues.push(`임시표과다(평균${avgAcc.toFixed(1)})`);

    // 입력 부담
    const avgTotal = avg(subset.map(r => r.trebleCount + r.bassCount));
    const maxTotal = Math.max(...subset.map(r => r.trebleCount + r.bassCount));

    const avgGap = avg(subset.map(r => r.voiceGap));
    const avgTN = avg(subset.map(r => r.trebleCount));
    const avgBN = avg(subset.map(r => r.bassCount));

    const status = issues.length === 0 ? 'OK' : `문제${issues.length}`;
    console.log(`  ${key.padEnd(4)} (${isMinor(key) ? '단조' : '장조'}): ${subset.length}건 | T=${avgTN.toFixed(1)} B=${avgBN.toFixed(1)} gap=${avgGap.toFixed(0)}st span=${avgSpan.toFixed(0)}st acc=${avgAcc.toFixed(1)} | ${status}`);
    if (issues.length > 0) {
      console.log(`         ${issues.join(', ')}`);
    }
    keyIssues.push({ key, issues });
  }

  // 4. 조성×난이도 교차 분석 (문제 많은 조합만)
  console.log(`\n${'='.repeat(90)}`);
  console.log('[조성 × 난이도 교차 문제]');
  console.log('='.repeat(90));

  const problemCombos: { key: string; bass: string; issues: string[]; count: number }[] = [];
  for (const key of KEY_SIGS) {
    for (const level of BASS_LEVELS) {
      const subset = results.filter(r => r.key === key && r.bass === level.bass);
      if (subset.length === 0) continue;
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const issues: string[] = [];

      const cross = subset.filter(r => r.voiceGap < 0);
      if (cross.length > 0) issues.push(`교차${cross.length}`);
      const tooClose = subset.filter(r => r.voiceGap >= 0 && r.voiceGap < 12);
      if (tooClose.length / subset.length > 0.5) issues.push(`간격<1옥${pct(tooClose.length, subset.length)}`);
      const diss = subset.reduce((s, r) => s + r.strongBeatDissonance, 0);
      if (diss > 2) issues.push(`불협${diss}`);
      const para = subset.reduce((s, r) => s + r.parallelFifths, 0);
      if (para > 3) issues.push(`평행${para}`);
      const maxRep = Math.max(...subset.map(r => r.trebleMaxRepeat));
      if (maxRep >= 5) issues.push(`반복${maxRep}연속`);
      const lenBad = subset.filter(r => r.trebleSixteenths !== r.expectedSixteenths || r.bassSixteenths !== r.expectedSixteenths);
      if (lenBad.length > 0) issues.push(`길이${lenBad.length}`);

      if (issues.length > 0) {
        problemCombos.push({ key, bass: level.label, issues, count: subset.length });
      }
    }
  }
  problemCombos.sort((a, b) => b.issues.length - a.issues.length);
  for (const c of problemCombos.slice(0, 30)) {
    console.log(`  ${c.key.padEnd(4)} × ${c.bass}: ${c.issues.join(', ')}`);
  }
  if (problemCombos.length === 0) console.log('  문제 없음');

  // 5. 장조 vs 단조 비교
  console.log(`\n${'='.repeat(90)}`);
  console.log('[장조 vs 단조 비교]');
  console.log('='.repeat(90));
  for (const mode of ['major', 'minor'] as const) {
    const subset = results.filter(r => mode === 'minor' ? isMinor(r.key) : !isMinor(r.key));
    if (subset.length === 0) continue;
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const cross = subset.filter(r => r.voiceGap < 0).length;
    const close = subset.filter(r => r.voiceGap >= 0 && r.voiceGap < 12).length;
    const diss = subset.reduce((s, r) => s + r.strongBeatDissonance, 0);
    const para = subset.reduce((s, r) => s + r.parallelFifths, 0);
    const avgGap = avg(subset.map(r => r.voiceGap));
    const avgAcc = avg(subset.map(r => r.trebleAccidentals));
    const avgSpan = avg(subset.map(r => r.trebleRange.span));
    const errCount = errors.filter(e => mode === 'minor' ? isMinor(e.key) : !isMinor(e.key)).length;
    console.log(`  ${mode === 'major' ? '장조' : '단조'} (${subset.length}건): 에러${errCount} 교차${cross} 간격<1옥${pct(close,subset.length)} gap평균=${avgGap.toFixed(0)}st 불협${diss} 평행${para} 임시표${avgAcc.toFixed(1)} 음역${avgSpan.toFixed(0)}st`);
  }

  // 6. 글로벌 요약
  console.log(`\n${'='.repeat(90)}`);
  console.log('[글로벌 요약]');
  console.log('='.repeat(90));
  if (totalErrors > 0) console.log(`  생성 실패: ${totalErrors}/${totalRuns} (${(totalErrors/totalRuns*100).toFixed(1)}%)`);
  const lenBad = results.filter(r => r.trebleSixteenths !== r.expectedSixteenths || r.bassSixteenths !== r.expectedSixteenths);
  if (lenBad.length > 0) console.log(`  길이 불일치: ${lenBad.length}/${results.length}`);

  console.log('\n[난이도별 입력 부담]');
  for (const level of BASS_LEVELS) {
    const subset = results.filter(r => r.bass === level.bass);
    if (subset.length === 0) continue;
    const avg = subset.reduce((s, r) => s + r.trebleCount + r.bassCount, 0) / subset.length;
    const max = Math.max(...subset.map(r => r.trebleCount + r.bassCount));
    console.log(`  ${level.label}: 평균 ${avg.toFixed(1)}개, 최대 ${max}개`);
  }

  console.log('\n[대위법 품질]');
  console.log(`  강박 불협화: ${results.reduce((s, r) => s + r.strongBeatDissonance, 0)}회 (${results.length}건)`);
  console.log(`  평행5/8도: ${results.reduce((s, r) => s + r.parallelFifths, 0)}회 (${results.length}건)`);

  console.log('\n테스트 완료.');
}

runTests();
