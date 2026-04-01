/**
 * 2성부 큰보표 중급2단계 첫 음 검증 — 100샘플
 * 실행: npx tsx scripts/checkFirstNote100.ts
 */
import { generateScore, type GeneratorOptions } from '../src/lib/scoreGenerator';

const SAMPLES = 100;
const opts: GeneratorOptions = {
  keySignature: 'C',
  timeSignature: '4/4',
  difficulty: 'intermediate_2',
  bassDifficulty: 'bass_2',
  measures: 8,
  useGrandStaff: true,
};

const lines: string[] = [];
const trebleFirstCounts: Record<string, number> = {};
const bassFirstCounts: Record<string, number> = {};

for (let i = 0; i < SAMPLES; i++) {
  const score = generateScore(opts);
  const t = score.trebleNotes[0];
  const b = score.bassNotes[0];
  const tKey = `${t.pitch}${t.octave}${t.accidental ? '(' + t.accidental + ')' : ''}`;
  const bKey = `${b.pitch}${b.octave}${b.accidental ? '(' + b.accidental + ')' : ''}`;
  trebleFirstCounts[tKey] = (trebleFirstCounts[tKey] || 0) + 1;
  bassFirstCounts[bKey] = (bassFirstCounts[bKey] || 0) + 1;
  lines.push(`#${String(i + 1).padStart(3)}: 트레블=${tKey.padEnd(8)} 베이스=${bKey}`);
}

console.log('=== 2성부 큰보표 C장조 4/4 중급2단계 첫 음 검증 (100샘플) ===\n');
lines.forEach(l => console.log(l));

function printDist(label: string, counts: Record<string, number>) {
  console.log(`\n--- ${label} 첫 음 분포 ---`);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [pitch, count] of sorted) {
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`  ${pitch.padEnd(10)} ${String(count).padStart(3)}회 (${(count / SAMPLES * 100).toFixed(1)}%) ${bar}`);
  }
}

printDist('트레블(멜로디)', trebleFirstCounts);
printDist('베이스', bassFirstCounts);

// 도(C) 시작 통계
const cCount = Object.entries(trebleFirstCounts)
  .filter(([k]) => k.startsWith('C'))
  .reduce((s, [, v]) => s + v, 0);
console.log(`\n트레블 도(C) 시작 합계: ${cCount}회 (${(cCount / SAMPLES * 100).toFixed(1)}%)`);
