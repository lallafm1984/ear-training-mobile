/**
 * 2성부 QA 배치: 특정 조건으로 N회 반복 생성 후 협화도/병진행 종합 분석
 */
import { generateScore, type Difficulty, type BassDifficulty, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState, noteToMidiWithKey, durationToSixteenths, getSixteenthsPerBar, DISSONANT_PC, IMPERFECT_CONSONANT_PC } from '../src/lib/scoreUtils';
import type { ScoreNote } from '../src/lib/scoreUtils';

const DIFF_LABELS: Record<string, string> = {
  intermediate_1: '중급1', intermediate_2: '중급2', intermediate_3: '중급3',
  advanced_1: '고급1', advanced_2: '고급2', advanced_3: '고급3',
};

function getStrongBeatOffsets(ts: string): number[] {
  switch (ts) {
    case '4/4': return [0, 8];
    case '3/4': return [0];
    case '6/8': return [0, 6];
    default: return [0];
  }
}

interface RunResult {
  diff: string;
  run: number;
  consonanceRate: number;
  dissonantCount: number;
  dissonantDetails: string[];
  parallel5: number;
  parallel8: number;
  abc: string;
}

function analyze(treble: ScoreNote[], bass: ScoreNote[], key: string, ts: string, measures: number): {
  consonanceRate: number; dissonantCount: number; dissonantDetails: string[];
  parallel5: number; parallel8: number;
} {
  const spb = getSixteenthsPerBar(ts);
  const strong = getStrongBeatOffsets(ts);

  // build sounding maps
  function buildMap(notes: ScoreNote[]): Map<number, number> {
    const m = new Map<number, number>(); let pos = 0;
    for (const n of notes) {
      const dur = durationToSixteenths(n.duration);
      if (n.pitch !== 'rest') {
        const midi = noteToMidiWithKey(n, key);
        for (let p = pos; p < pos + dur; p++) m.set(p, midi);
      }
      pos += dur;
    }
    return m;
  }
  const tMap = buildMap(treble), bMap = buildMap(bass);
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const mn = (m: number) => `${names[m%12]}${Math.floor(m/12)-1}`;
  const pcName: Record<number,string> = {0:'P1/P8',1:'m2',2:'M2',3:'m3',4:'M3',5:'P4',6:'TT',7:'P5',8:'m6',9:'M6',10:'m7',11:'M7'};

  let total = 0, consonant = 0, dissonantCount = 0;
  const dissonantDetails: string[] = [];

  // strong beat consonance
  for (let bar = 0; bar < measures; bar++) {
    for (const off of strong) {
      const absPos = bar * spb + off;
      const tMidi = tMap.get(absPos), bMidi = bMap.get(absPos);
      if (tMidi === undefined || bMidi === undefined) continue;
      total++;
      const pc = ((tMidi - bMidi) % 12 + 12) % 12;
      if (DISSONANT_PC.has(pc)) {
        dissonantCount++;
        dissonantDetails.push(`마디${bar+1} 박${off/4+1}: ${mn(tMidi)} vs ${mn(bMidi)} = ${pcName[pc]}`);
      } else { consonant++; }
    }
  }

  // parallel detection at strong beats
  const beatPairs: { tMidi: number; bMidi: number }[] = [];
  for (let bar = 0; bar < measures; bar++) {
    for (const off of strong) {
      const absPos = bar * spb + off;
      const t = tMap.get(absPos), b = bMap.get(absPos);
      if (t !== undefined && b !== undefined) beatPairs.push({ tMidi: t, bMidi: b });
    }
  }
  let p5 = 0, p8 = 0;
  for (let i = 1; i < beatPairs.length; i++) {
    const prev = beatPairs[i-1], cur = beatPairs[i];
    const prevPc = ((prev.tMidi - prev.bMidi) % 12 + 12) % 12;
    const curPc = ((cur.tMidi - cur.bMidi) % 12 + 12) % 12;
    const tDir = cur.tMidi - prev.tMidi, bDir = cur.bMidi - prev.bMidi;
    const same = (tDir > 0 && bDir > 0) || (tDir < 0 && bDir < 0);
    if (same && tDir !== 0 && prevPc === curPc) {
      if (curPc === 7) p5++;
      if (curPc === 0) p8++;
    }
  }

  return {
    consonanceRate: total > 0 ? Math.round(consonant / total * 100) : 100,
    dissonantCount, dissonantDetails, parallel5: p5, parallel8: p8,
  };
}

function main() {
  const diffs: Difficulty[] = [
    'intermediate_1','intermediate_2','intermediate_3',
    'advanced_1','advanced_2','advanced_3',
  ];
  const N = 10;
  const ts = '4/4', key = 'C', measures = 8;
  const bass: BassDifficulty = 'bass_3';

  console.log('');
  console.log('═'.repeat(80));
  console.log(`  2성부 QA 배치: ${ts} | ${key} | ${bass} | ${measures}마디 | 각 ${N}회`);
  console.log('═'.repeat(80));

  const allResults: RunResult[] = [];
  let totalDissonant = 0, totalParallel = 0, totalBeats = 0;

  for (const diff of diffs) {
    let diffDiss = 0, diffP5 = 0, diffP8 = 0, diffTotal = 0;

    for (let run = 1; run <= N; run++) {
      const opts: GeneratorOptions = {
        keySignature: key, timeSignature: ts, difficulty: diff,
        measures, useGrandStaff: true, bassDifficulty: bass,
      };
      try {
        const gen = generateScore(opts);
        const state: ScoreState = {
          title: `${diff}_${run}`, keySignature: key, timeSignature: ts,
          tempo: 120, notes: gen.trebleNotes, bassNotes: gen.bassNotes, useGrandStaff: true,
        };
        const abc = generateAbc(state);
        const a = analyze(gen.trebleNotes, gen.bassNotes, key, ts, measures);

        allResults.push({
          diff, run, consonanceRate: a.consonanceRate,
          dissonantCount: a.dissonantCount, dissonantDetails: a.dissonantDetails,
          parallel5: a.parallel5, parallel8: a.parallel8, abc,
        });

        diffDiss += a.dissonantCount;
        diffP5 += a.parallel5; diffP8 += a.parallel8;
        diffTotal++;
        totalDissonant += a.dissonantCount;
        totalParallel += a.parallel5 + a.parallel8;
      } catch (e: any) {
        console.log(`  ERROR [${diff} #${run}]: ${e.message}`);
      }
    }

    const okCount = allResults.filter(r => r.diff === diff && r.dissonantCount === 0 && r.parallel5 === 0 && r.parallel8 === 0).length;
    const avgRate = allResults.filter(r => r.diff === diff).reduce((s, r) => s + r.consonanceRate, 0) / diffTotal;
    console.log(`\n── ${DIFF_LABELS[diff]} (${diff}) ── ${okCount}/${N} OK | 평균 협화율 ${avgRate.toFixed(1)}% | 불협화 ${diffDiss}건 | 병행5도 ${diffP5} 병행8도 ${diffP8}`);

    // 실패 상세
    for (const r of allResults.filter(r => r.diff === diff && (r.dissonantCount > 0 || r.parallel5 > 0 || r.parallel8 > 0))) {
      console.log(`  NG #${r.run}: 협화율 ${r.consonanceRate}% | 불협화 ${r.dissonantCount} | 병행5 ${r.parallel5} 병행8 ${r.parallel8}`);
      for (const d of r.dissonantDetails) console.log(`    ✗ ${d}`);
    }
  }

  // 종합
  const totalRuns = allResults.length;
  const okRuns = allResults.filter(r => r.dissonantCount === 0 && r.parallel5 === 0 && r.parallel8 === 0).length;
  const avgAll = allResults.reduce((s, r) => s + r.consonanceRate, 0) / totalRuns;

  console.log('');
  console.log('═'.repeat(80));
  console.log(`  종합: ${totalRuns}건 중 ${okRuns}건 완벽 (${Math.round(okRuns/totalRuns*100)}%)`);
  console.log(`  평균 강박 협화율: ${avgAll.toFixed(1)}%`);
  console.log(`  총 불협화: ${totalDissonant}건 | 총 병행5/8도: ${totalParallel}건`);
  console.log('═'.repeat(80));

  // NG 케이스 ABC 출력
  const ngResults = allResults.filter(r => r.dissonantCount > 0);
  if (ngResults.length > 0) {
    console.log('\n── 불협화 발생 ABC (최대 5건) ──');
    for (const r of ngResults.slice(0, 5)) {
      console.log(`\n[${DIFF_LABELS[r.diff]} #${r.run}] 불협화 ${r.dissonantCount}건`);
      for (const d of r.dissonantDetails) console.log(`  ✗ ${d}`);
      console.log(r.abc);
    }
  }

  console.log('');
  if (totalDissonant > 0 || totalParallel > 0) process.exit(1);
}

main();
