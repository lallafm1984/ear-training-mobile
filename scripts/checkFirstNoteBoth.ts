/**
 * 1성부 vs 2성부 generateScore 첫 음 비교
 * 실행: npx tsx scripts/checkFirstNoteBoth.ts
 */
import { generateScore, type GeneratorOptions } from '../src/lib/scoreGenerator';

const SAMPLES = 30;

function test(label: string, opts: GeneratorOptions) {
  const pitchCounts: Record<string, number> = {};
  const lines: string[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const score = generateScore(opts);
    const first = score.trebleNotes[0];
    const key = `${first.pitch}${first.octave}`;
    pitchCounts[key] = (pitchCounts[key] || 0) + 1;
    const bassInfo = score.bassNotes.length > 0
      ? `베이스=${score.bassNotes[0].pitch}${score.bassNotes[0].octave}`
      : '베이스=없음';
    lines.push(`#${String(i+1).padStart(2)}: 멜로디=${first.pitch}${first.octave} (acc=${first.accidental||'없음'})  ${bassInfo}`);
  }

  console.log(`\n=== ${label} (${SAMPLES}샘플) ===\n`);
  lines.forEach(l => console.log(l));
  console.log('\n--- 첫 음 분포 ---');
  const sorted = Object.entries(pitchCounts).sort((a,b) => b[1] - a[1]);
  for (const [pitch, count] of sorted) {
    const bar = '█'.repeat(count);
    console.log(`  ${pitch.padEnd(4)} ${String(count).padStart(2)}회 (${(count/SAMPLES*100).toFixed(1)}%) ${bar}`);
  }
  console.log(`  도(C) 합계: ${(Object.entries(pitchCounts).filter(([k]) => k.startsWith('C')).reduce((s,[,v]) => s+v, 0) / SAMPLES * 100).toFixed(1)}%`);
}

// 1성부
test('1성부 (useGrandStaff=false)', {
  keySignature: 'C',
  timeSignature: '4/4',
  difficulty: 'intermediate_2',
  measures: 8,
  useGrandStaff: false,
});

// 2성부
test('2성부 (useGrandStaff=true, bass_2)', {
  keySignature: 'C',
  timeSignature: '4/4',
  difficulty: 'intermediate_2',
  bassDifficulty: 'bass_2',
  measures: 8,
  useGrandStaff: true,
});
