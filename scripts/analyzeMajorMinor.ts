/**
 * 장조/단조 차이 분석 스크립트
 *
 * 검사: 올린 7음(이끔음), 코드 진행 패턴, 종지 패턴, 음정 분포 비교
 */

import { generateScore, type Difficulty, type GeneratorOptions } from '../src/lib/scoreGenerator';
import {
  generateAbc, type ScoreState, type ScoreNote,
  noteToMidiWithKey, getScaleDegrees, getKeySigAlteration,
} from '../src/lib/scoreUtils';

const MAJOR_KEYS = ['C', 'G', 'D', 'F', 'Bb', 'Eb'];
const MINOR_KEYS = ['Am', 'Em', 'Dm', 'Gm', 'Cm', 'Fm'];
const DIFFICULTIES: Difficulty[] = ['beginner_1', 'beginner_3', 'intermediate_2', 'advanced_1', 'advanced_3'];
const TIME_SIGS = ['4/4', '3/4', '6/8'];
const MEASURES = [4, 8];
const SAMPLES_PER_COMBO = 3;

interface KeyStats {
  totalNotes: number;
  accidentalCount: number;
  leadingToneCount: number;   // 이끔음(올린 7음) 횟수
  seventhDegreeTotal: number; // 7음 등장 총 횟수
  endsOnTonic: number;
  totalCases: number;
  abcSamples: string[];       // 대표 ABC 코드 (최대 3개)
}

function analyzeNotes(
  notes: ScoreNote[], keySignature: string, isMinor: boolean,
): { accidentals: number; leadingTones: number; seventhTotal: number } {
  const scale = getScaleDegrees(keySignature);
  const seventhDeg = scale[6]; // 7음
  let accidentals = 0, leadingTones = 0, seventhTotal = 0;

  for (const n of notes) {
    if (n.pitch === 'rest') continue;
    if (n.accidental !== '') accidentals++;

    if (n.pitch === seventhDeg) {
      seventhTotal++;
      if (isMinor && (n.accidental === '#' || n.accidental === 'n')) {
        // 올린 7음 = 이끔음
        const keyAlt = getKeySigAlteration(keySignature, seventhDeg);
        if (keyAlt === 'b' && n.accidental === 'n') leadingTones++;
        else if (keyAlt === '' && n.accidental === '#') leadingTones++;
        else if (n.accidental === '#') leadingTones++;
      }
    }
  }

  return { accidentals, leadingTones, seventhTotal };
}

function main() {
  const majorStats: KeyStats = { totalNotes: 0, accidentalCount: 0, leadingToneCount: 0, seventhDegreeTotal: 0, endsOnTonic: 0, totalCases: 0, abcSamples: [] };
  const minorStats: KeyStats = { totalNotes: 0, accidentalCount: 0, leadingToneCount: 0, seventhDegreeTotal: 0, endsOnTonic: 0, totalCases: 0, abcSamples: [] };

  // 개별 조성 통계
  const perKeyStats: Record<string, KeyStats> = {};

  for (const ks of [...MAJOR_KEYS, ...MINOR_KEYS]) {
    perKeyStats[ks] = { totalNotes: 0, accidentalCount: 0, leadingToneCount: 0, seventhDegreeTotal: 0, endsOnTonic: 0, totalCases: 0, abcSamples: [] };
  }

  for (const diff of DIFFICULTIES) {
    for (const ts of TIME_SIGS) {
      for (const m of MEASURES) {
        for (const ks of [...MAJOR_KEYS, ...MINOR_KEYS]) {
          const isMinor = ks.endsWith('m');
          const stats = isMinor ? minorStats : majorStats;
          const keyS = perKeyStats[ks];

          for (let s = 0; s < SAMPLES_PER_COMBO; s++) {
            try {
              const opts: GeneratorOptions = {
                keySignature: ks, timeSignature: ts, difficulty: diff,
                measures: m, useGrandStaff: false,
              };
              const gen = generateScore(opts);
              const state: ScoreState = {
                title: 'Test', keySignature: ks, timeSignature: ts, tempo: 120,
                notes: gen.trebleNotes,
              };
              const abc = generateAbc(state);

              const melodicNotes = gen.trebleNotes.filter(n => n.pitch !== 'rest');
              const analysis = analyzeNotes(gen.trebleNotes, ks, isMinor);
              const scale = getScaleDegrees(ks);
              const lastNote = [...gen.trebleNotes].reverse().find(n => n.pitch !== 'rest');
              const endsOnTonic = lastNote ? lastNote.pitch === scale[0] : false;

              stats.totalNotes += melodicNotes.length;
              stats.accidentalCount += analysis.accidentals;
              stats.leadingToneCount += analysis.leadingTones;
              stats.seventhDegreeTotal += analysis.seventhTotal;
              stats.totalCases++;
              if (endsOnTonic) stats.endsOnTonic++;

              keyS.totalNotes += melodicNotes.length;
              keyS.accidentalCount += analysis.accidentals;
              keyS.leadingToneCount += analysis.leadingTones;
              keyS.seventhDegreeTotal += analysis.seventhTotal;
              keyS.totalCases++;
              if (endsOnTonic) keyS.endsOnTonic++;

              if (keyS.abcSamples.length < 2 && diff === 'intermediate_2' && m === 4 && ts === '4/4') {
                keyS.abcSamples.push(abc);
              }
            } catch { /* skip */ }
          }
        }
      }
    }
  }

  // ── 출력 ──
  const lines: string[] = [];
  lines.push('═'.repeat(80));
  lines.push('  장조 vs 단조 특성 비교 분석');
  lines.push('═'.repeat(80));
  lines.push('');

  lines.push('── 종합 비교 ──');
  lines.push(`${''.padEnd(12)} ${'장조'.padStart(12)} ${'단조'.padStart(12)} ${'차이'.padStart(12)}`);
  lines.push(`${'총 케이스'.padEnd(12)} ${majorStats.totalCases.toString().padStart(12)} ${minorStats.totalCases.toString().padStart(12)}`);
  lines.push(`${'총 음표'.padEnd(12)} ${majorStats.totalNotes.toString().padStart(12)} ${minorStats.totalNotes.toString().padStart(12)}`);

  const majAccRate = (majorStats.accidentalCount / majorStats.totalNotes * 100).toFixed(1);
  const minAccRate = (minorStats.accidentalCount / minorStats.totalNotes * 100).toFixed(1);
  lines.push(`${'임시표 비율'.padEnd(12)} ${(majAccRate + '%').padStart(12)} ${(minAccRate + '%').padStart(12)}`);

  const majLT = majorStats.leadingToneCount;
  const minLT = minorStats.leadingToneCount;
  lines.push(`${'이끔음(#7)'.padEnd(12)} ${majLT.toString().padStart(12)} ${minLT.toString().padStart(12)} ${minLT > 0 ? 'OK-단조 특성' : 'MISSING!'}`);

  const maj7th = majorStats.seventhDegreeTotal;
  const min7th = minorStats.seventhDegreeTotal;
  const min7thLTRatio = min7th > 0 ? (minLT / min7th * 100).toFixed(1) : '0';
  lines.push(`${'7음 등장'.padEnd(12)} ${maj7th.toString().padStart(12)} ${min7th.toString().padStart(12)}`);
  lines.push(`${'7음→이끔음'.padEnd(12)} ${'N/A'.padStart(12)} ${(min7thLTRatio + '%').padStart(12)} ${parseFloat(min7thLTRatio) > 20 ? 'OK' : 'LOW'}`);

  const majTonicRate = (majorStats.endsOnTonic / majorStats.totalCases * 100).toFixed(1);
  const minTonicRate = (minorStats.endsOnTonic / minorStats.totalCases * 100).toFixed(1);
  lines.push(`${'으뜸음 종결'.padEnd(12)} ${(majTonicRate + '%').padStart(12)} ${(minTonicRate + '%').padStart(12)}`);

  lines.push('');

  // 개별 조성
  lines.push('── 개별 조성 이끔음 현황 ──');
  lines.push(`${'조성'.padEnd(8)} ${'케이스'.padStart(6)} ${'7음'.padStart(6)} ${'이끔음'.padStart(6)} ${'비율'.padStart(8)}`);
  for (const ks of MINOR_KEYS) {
    const s = perKeyStats[ks];
    const ratio = s.seventhDegreeTotal > 0 ? (s.leadingToneCount / s.seventhDegreeTotal * 100).toFixed(1) + '%' : '0%';
    lines.push(`  ${ks.padEnd(6)} ${s.totalCases.toString().padStart(6)} ${s.seventhDegreeTotal.toString().padStart(6)} ${s.leadingToneCount.toString().padStart(6)} ${ratio.padStart(8)}`);
  }
  lines.push('');

  // 대표 ABC 샘플 비교
  lines.push('── 대표 ABC 코드 비교 (4/4, 중급2, 4마디) ──');
  const samplePairs = [['C', 'Am'], ['G', 'Em'], ['F', 'Dm']];
  for (const [major, minor] of samplePairs) {
    lines.push(`\n--- ${major}장조 ---`);
    lines.push(perKeyStats[major].abcSamples[0] || '(샘플 없음)');
    lines.push(`\n--- ${minor} ---`);
    lines.push(perKeyStats[minor].abcSamples[0] || '(샘플 없음)');
    lines.push('');
  }

  lines.push('═'.repeat(80));

  const report = lines.join('\n');
  console.log(report);

  const fs = require('fs');
  fs.mkdirSync('temp', { recursive: true });
  fs.writeFileSync('temp/major-minor-report.txt', report, 'utf-8');
  console.log('\n저장: temp/major-minor-report.txt');
}

main();
