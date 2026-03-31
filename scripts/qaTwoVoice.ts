/**
 * 2성부 QA 분석 스크립트
 *
 * generateScore()로 생성된 ScoreNote 데이터를 직접 분석하여
 * 강박 협화도, 병진행, 음역, 리듬 복잡도를 검증합니다.
 *
 * 실행: npx tsx scripts/qaTwoVoice.ts [옵션]
 *   --bass bass_3       베이스 단계 (기본: bass_3)
 *   --diff beginner_1   특정 난이도만
 *   --time 4/4          박자 (기본: 4/4)
 *   --key C             조성 (기본: C)
 *   --measures 8        마디 수 (기본: 8)
 */

import { generateScore, type Difficulty, type BassDifficulty, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState, noteToMidiWithKey, durationToSixteenths, getSixteenthsPerBar, DISSONANT_PC, IMPERFECT_CONSONANT_PC } from '../src/lib/scoreUtils';
import type { ScoreNote } from '../src/lib/scoreUtils';

// ── 상수 ──

const ALL_DIFFICULTIES: Difficulty[] = [
  'beginner_1', 'beginner_2', 'beginner_3',
  'intermediate_1', 'intermediate_2', 'intermediate_3',
  'advanced_1', 'advanced_2', 'advanced_3',
];

const DIFF_LABELS: Record<Difficulty, string> = {
  beginner_1: '초급1', beginner_2: '초급2', beginner_3: '초급3',
  intermediate_1: '중급1', intermediate_2: '중급2', intermediate_3: '중급3',
  advanced_1: '고급1', advanced_2: '고급2', advanced_3: '고급3',
};

const PERFECT_CONSONANT_PC = new Set([0, 7, 5]); // unison, P5, P4 (P4 treated as consonant here)

// 강박 위치 (16분음표 기준)
function getStrongBeatOffsets(timeSig: string): number[] {
  switch (timeSig) {
    case '4/4': return [0, 8];         // 1, 3박
    case '3/4': return [0];            // 1박
    case '2/4': return [0];            // 1박
    case '6/8': return [0, 6];         // 1, 4박 (compound)
    case '9/8': return [0, 6, 12];     // 1, 4, 7박
    case '12/8': return [0, 6, 12, 18]; // 1, 4, 7, 10박
    case '5/4': return [0, 8];         // 1, (3+2 or 2+3)
    case '7/8': return [0];            // 1박
    default: return [0];
  }
}

// ── 분석 함수 ──

interface ConsonanceReport {
  totalStrongBeats: number;
  consonant: number;        // 완전/불완전 협화
  dissonant: number;        // 불협화
  perfectConsonant: number; // 완전 협화 (unison, P5, P4)
  imperfectConsonant: number; // 불완전 협화 (3, 6도)
  dissonantDetails: { bar: number; beat: number; trebleMidi: number; bassMidi: number; interval: number; pc: number }[];
}

function analyzeConsonance(
  trebleNotes: ScoreNote[],
  bassNotes: ScoreNote[],
  keySignature: string,
  timeSig: string,
  measures: number,
): ConsonanceReport {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSig);
  const strongOffsets = getStrongBeatOffsets(timeSig);

  // 트레블/베이스를 (bar, position) → midi 맵으로 변환
  const trebleMap = buildSoundingMap(trebleNotes, keySignature, sixteenthsPerBar, measures);
  const bassMap = buildSoundingMap(bassNotes, keySignature, sixteenthsPerBar, measures);

  const report: ConsonanceReport = {
    totalStrongBeats: 0,
    consonant: 0,
    dissonant: 0,
    perfectConsonant: 0,
    imperfectConsonant: 0,
    dissonantDetails: [],
  };

  for (let bar = 0; bar < measures; bar++) {
    for (const offset of strongOffsets) {
      const trebleMidi = trebleMap.get(bar * sixteenthsPerBar + offset);
      const bassMidi = bassMap.get(bar * sixteenthsPerBar + offset);

      if (trebleMidi === undefined || bassMidi === undefined) continue;
      if (trebleMidi < 0 || bassMidi < 0) continue; // rest

      report.totalStrongBeats++;
      const interval = Math.abs(trebleMidi - bassMidi);
      const pc = interval % 12;

      if (DISSONANT_PC.has(pc)) {
        report.dissonant++;
        report.dissonantDetails.push({ bar: bar + 1, beat: offset / 4 + 1, trebleMidi, bassMidi, interval, pc });
      } else if (PERFECT_CONSONANT_PC.has(pc)) {
        report.consonant++;
        report.perfectConsonant++;
      } else if (IMPERFECT_CONSONANT_PC.has(pc)) {
        report.consonant++;
        report.imperfectConsonant++;
      } else {
        report.consonant++; // 기타 (tritone 제외한 나머지)
      }
    }
  }

  return report;
}

function buildSoundingMap(
  notes: ScoreNote[],
  keySignature: string,
  sixteenthsPerBar: number,
  measures: number,
): Map<number, number> {
  const map = new Map<number, number>();
  let pos = 0;

  for (const n of notes) {
    const dur = durationToSixteenths(n.duration);
    if (n.pitch === 'rest') {
      for (let p = pos; p < pos + dur; p++) map.set(p, -1);
    } else {
      const midi = noteToMidiWithKey(n, keySignature);
      for (let p = pos; p < pos + dur; p++) map.set(p, midi);
    }
    pos += dur;
  }

  return map;
}

// ── 병진행 검사 ──

interface ParallelReport {
  parallel5ths: number;
  parallel8ths: number;
  hidden5ths: number;
  hidden8ths: number;
  details: string[];
}

function analyzeParallels(
  trebleNotes: ScoreNote[],
  bassNotes: ScoreNote[],
  keySignature: string,
  timeSig: string,
  measures: number,
): ParallelReport {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSig);
  const strongOffsets = getStrongBeatOffsets(timeSig);

  const trebleMap = buildSoundingMap(trebleNotes, keySignature, sixteenthsPerBar, measures);
  const bassMap = buildSoundingMap(bassNotes, keySignature, sixteenthsPerBar, measures);

  const report: ParallelReport = { parallel5ths: 0, parallel8ths: 0, hidden5ths: 0, hidden8ths: 0, details: [] };

  // 강박 간 연속 이동 검사
  const beatPositions: number[] = [];
  for (let bar = 0; bar < measures; bar++) {
    for (const offset of strongOffsets) {
      beatPositions.push(bar * sixteenthsPerBar + offset);
    }
  }

  for (let i = 1; i < beatPositions.length; i++) {
    const prevPos = beatPositions[i - 1];
    const currPos = beatPositions[i];

    const prevT = trebleMap.get(prevPos);
    const currT = trebleMap.get(currPos);
    const prevB = bassMap.get(prevPos);
    const currB = bassMap.get(currPos);

    if (prevT === undefined || currT === undefined || prevB === undefined || currB === undefined) continue;
    if (prevT < 0 || currT < 0 || prevB < 0 || currB < 0) continue;

    const prevInterval = Math.abs(prevT - prevB) % 12;
    const currInterval = Math.abs(currT - currB) % 12;

    const trebleMotion = currT - prevT;
    const bassMotion = currB - prevB;
    const sameDirection = (trebleMotion > 0 && bassMotion > 0) || (trebleMotion < 0 && bassMotion < 0);

    // 연속 완전 5도 / 완전 8도
    if (prevInterval === 7 && currInterval === 7 && sameDirection) {
      report.parallel5ths++;
      report.details.push(`병행5도: beat ${i} → ${i + 1}`);
    }
    if (prevInterval === 0 && currInterval === 0 && sameDirection && trebleMotion !== 0) {
      report.parallel8ths++;
      report.details.push(`병행8도: beat ${i} → ${i + 1}`);
    }

    // 숨은 5/8도 (같은 방향 이동 → 완전음정 도달)
    if (sameDirection && currInterval === 7 && prevInterval !== 7) {
      report.hidden5ths++;
    }
    if (sameDirection && currInterval === 0 && prevInterval !== 0 && trebleMotion !== 0) {
      report.hidden8ths++;
    }
  }

  return report;
}

// ── 리듬 복잡도 ──

interface RhythmReport {
  totalNotes: number;
  uniqueDurations: string[];
  shortestDuration: string;
  hasTies: boolean;
  hasTuplets: boolean;
  hasRests: boolean;
  hasDottedNotes: boolean;
  avgNotesPerBar: number;
}

function analyzeRhythm(trebleNotes: ScoreNote[], measures: number): RhythmReport {
  const durations = new Set<string>();
  let hasTies = false;
  let hasTuplets = false;
  let hasRests = false;
  let hasDottedNotes = false;

  for (const n of trebleNotes) {
    durations.add(n.duration);
    if (n.tie) hasTies = true;
    if (n.tuplet) hasTuplets = true;
    if (n.pitch === 'rest') hasRests = true;
    if (n.duration.includes('.')) hasDottedNotes = true;
  }

  const durOrder = ['16', '8.', '8', '4.', '4', '2.', '2', '1.', '1'];
  const uniqueDurations = [...durations].sort((a, b) => durOrder.indexOf(a) - durOrder.indexOf(b));
  const shortest = uniqueDurations[0] || '4';

  return {
    totalNotes: trebleNotes.length,
    uniqueDurations,
    shortestDuration: shortest,
    hasTies,
    hasTuplets,
    hasRests,
    hasDottedNotes,
    avgNotesPerBar: trebleNotes.length / Math.max(1, measures),
  };
}

// ── 음역 분석 ──

interface RangeReport {
  trebleMin: number;
  trebleMax: number;
  trebleRange: number;
  bassMin: number;
  bassMax: number;
  bassRange: number;
  minSpacing: number;  // 최소 성부 간격 (반음)
  maxSpacing: number;
}

function analyzeRange(
  trebleNotes: ScoreNote[],
  bassNotes: ScoreNote[],
  keySignature: string,
): RangeReport {
  let tMin = 999, tMax = -999, bMin = 999, bMax = -999;
  let minSpacing = 999, maxSpacing = -999;

  const trebleMidis: number[] = [];
  const bassMidis: number[] = [];

  for (const n of trebleNotes) {
    if (n.pitch === 'rest') continue;
    const midi = noteToMidiWithKey(n, keySignature);
    trebleMidis.push(midi);
    tMin = Math.min(tMin, midi);
    tMax = Math.max(tMax, midi);
  }

  for (const n of bassNotes) {
    if (n.pitch === 'rest') continue;
    const midi = noteToMidiWithKey(n, keySignature);
    bassMidis.push(midi);
    bMin = Math.min(bMin, midi);
    bMax = Math.max(bMax, midi);
  }

  // 성부 간격: 동시 발음 기준 (간단히 인덱스 매칭은 부정확하므로 전체 범위로 대체)
  minSpacing = tMin - bMax;
  maxSpacing = tMax - bMin;

  return {
    trebleMin: tMin,
    trebleMax: tMax,
    trebleRange: tMax - tMin,
    bassMin: bMin,
    bassMax: bMax,
    bassRange: bMax - bMin,
    minSpacing,
    maxSpacing,
  };
}

function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

function pcToIntervalName(pc: number): string {
  const names: Record<number, string> = {
    0: 'P1/P8', 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4',
    6: 'TT', 7: 'P5', 8: 'm6', 9: 'M6', 10: 'm7', 11: 'M7',
  };
  return names[pc] || `pc${pc}`;
}

// ── CLI ──

interface ParsedArgs {
  bass: BassDifficulty;
  diff?: Difficulty;
  time: string;
  key: string;
  measures: number;
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2);
  const result: ParsedArgs = {
    bass: 'bass_3',
    time: '4/4',
    key: 'C',
    measures: 8,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--bass': result.bass = argv[++i] as BassDifficulty; break;
      case '--diff': result.diff = argv[++i] as Difficulty; break;
      case '--time': result.time = argv[++i]; break;
      case '--key': result.key = argv[++i]; break;
      case '--measures': result.measures = parseInt(argv[++i], 10); break;
    }
  }
  return result;
}

// ── 메인 ──

function main() {
  const args = parseArgs();
  const diffs = args.diff ? [args.diff] : ALL_DIFFICULTIES;

  console.log('');
  console.log('═'.repeat(80));
  console.log(`  2성부 QA 분석: ${args.time} | ${args.key} | ${args.bass} | ${args.measures}마디`);
  console.log('═'.repeat(80));

  let totalDissonant = 0;
  let totalStrongBeats = 0;
  let totalParallel = 0;

  for (const diff of diffs) {
    const opts: GeneratorOptions = {
      keySignature: args.key,
      timeSignature: args.time,
      difficulty: diff,
      measures: args.measures,
      useGrandStaff: true,
      bassDifficulty: args.bass,
    };

    let trebleNotes: ScoreNote[];
    let bassNotes: ScoreNote[];
    let abc: string;

    try {
      const generated = generateScore(opts);
      trebleNotes = generated.trebleNotes;
      bassNotes = generated.bassNotes;

      const state: ScoreState = {
        title: `QA_${diff}`,
        keySignature: args.key,
        timeSignature: args.time,
        tempo: 120,
        notes: trebleNotes,
        bassNotes,
        useGrandStaff: true,
      };
      abc = generateAbc(state);
    } catch (e: any) {
      console.log(`\n── ${DIFF_LABELS[diff]} ── ERROR: ${e.message}`);
      continue;
    }

    const consonance = analyzeConsonance(trebleNotes, bassNotes, args.key, args.time, args.measures);
    const parallels = analyzeParallels(trebleNotes, bassNotes, args.key, args.time, args.measures);
    const rhythm = analyzeRhythm(trebleNotes, args.measures);
    const range = analyzeRange(trebleNotes, bassNotes, args.key);

    totalDissonant += consonance.dissonant;
    totalStrongBeats += consonance.totalStrongBeats;
    totalParallel += parallels.parallel5ths + parallels.parallel8ths;

    const consonanceRate = consonance.totalStrongBeats > 0
      ? Math.round((consonance.consonant / consonance.totalStrongBeats) * 100)
      : 100;
    const statusIcon = consonance.dissonant === 0 && parallels.parallel5ths === 0 && parallels.parallel8ths === 0
      ? 'OK' : 'NG';

    console.log('');
    console.log(`── [${statusIcon}] ${DIFF_LABELS[diff]} (${diff}) ──`);

    // 협화도
    console.log(`  강박 협화도: ${consonanceRate}% (${consonance.consonant}/${consonance.totalStrongBeats})`);
    console.log(`    완전협화(P1/P5/P4): ${consonance.perfectConsonant} | 불완전협화(3/6도): ${consonance.imperfectConsonant} | 불협화: ${consonance.dissonant}`);
    if (consonance.dissonantDetails.length > 0) {
      for (const d of consonance.dissonantDetails) {
        console.log(`    ✗ 마디${d.bar} 박${d.beat}: ${midiToName(d.trebleMidi)}(트) vs ${midiToName(d.bassMidi)}(베) = ${pcToIntervalName(d.pc)} (${d.interval}반음)`);
      }
    }

    // 병진행
    if (parallels.parallel5ths > 0 || parallels.parallel8ths > 0) {
      console.log(`  병진행: 병행5도 ${parallels.parallel5ths} | 병행8도 ${parallels.parallel8ths} | 숨은5도 ${parallels.hidden5ths} | 숨은8도 ${parallels.hidden8ths}`);
      for (const d of parallels.details) {
        console.log(`    ✗ ${d}`);
      }
    } else {
      console.log(`  병진행: 없음 (숨은5도 ${parallels.hidden5ths} | 숨은8도 ${parallels.hidden8ths})`);
    }

    // 리듬
    console.log(`  리듬: 음표 ${rhythm.totalNotes}개 (${rhythm.avgNotesPerBar.toFixed(1)}/마디) | 음가: ${rhythm.uniqueDurations.join(', ')} | 최단: ${rhythm.shortestDuration}`);
    const features: string[] = [];
    if (rhythm.hasTies) features.push('붙임줄');
    if (rhythm.hasTuplets) features.push('잇단음표');
    if (rhythm.hasRests) features.push('쉼표');
    if (rhythm.hasDottedNotes) features.push('점음표');
    if (features.length > 0) console.log(`    요소: ${features.join(', ')}`);

    // 음역
    console.log(`  음역: 트레블 ${midiToName(range.trebleMin)}~${midiToName(range.trebleMax)} (${range.trebleRange}반음) | 베이스 ${midiToName(range.bassMin)}~${midiToName(range.bassMax)} (${range.bassRange}반음)`);

    // ABC
    console.log(`  ──── ABC ────`);
    console.log(abc);
  }

  // 종합
  console.log('');
  console.log('═'.repeat(80));
  const overallRate = totalStrongBeats > 0 ? Math.round(((totalStrongBeats - totalDissonant) / totalStrongBeats) * 100) : 100;
  console.log(`  종합: 강박 협화율 ${overallRate}% | 불협화 ${totalDissonant}건 | 병행5/8도 ${totalParallel}건`);
  if (totalDissonant === 0 && totalParallel === 0) {
    console.log('  결과: ALL PASS');
  } else {
    console.log(`  결과: ${totalDissonant + totalParallel}건 이슈 발견`);
  }
  console.log('═'.repeat(80));
  console.log('');

  if (totalDissonant > 0 || totalParallel > 0) process.exit(1);
}

main();
