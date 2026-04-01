/**
 * 2성부 첫 음 검증 — 30샘플
 * 실행: npx tsx scripts/checkFirstNote2v.ts
 */
import { generateTwoVoiceStack } from '../src/lib/twoVoice/twoVoiceStack';
import { generateProgression } from '../src/lib/scoreUtils';

const SAMPLES = 30;
const results: string[] = [];

for (let i = 0; i < SAMPLES; i++) {
  const prog = generateProgression(9, false);
  const stack = generateTwoVoiceStack({
    keySignature: 'C', mode: 'major', timeSig: '4/4',
    measures: 9, tvMeasures: 8, bassLevel: 2, melodyLevel: 5,
    progression: prog, trebleBaseOctave: 4, melodyNnMin: 0, melodyNnMax: 12,
  });
  const first = stack.trebleScoreNotes[0];
  const bassFirst = stack.bassScoreNotes[0];
  results.push(`#${String(i+1).padStart(2)}: 멜로디=${first.pitch}${first.octave} (acc=${first.accidental||'없음'})  베이스=${bassFirst.pitch}${bassFirst.octave}`);
}

const pitchCounts: Record<string, number> = {};
for (const r of results) {
  const m = r.match(/멜로디=([A-G])(\d)/);
  if (m) {
    const key = m[1] + m[2];
    pitchCounts[key] = (pitchCounts[key] || 0) + 1;
  }
}

console.log('=== 2성부 첫 음 검증 (30샘플) ===\n');
results.forEach(r => console.log(r));
console.log('\n--- 첫 음 분포 ---');
const sorted = Object.entries(pitchCounts).sort((a,b) => b[1] - a[1]);
for (const [pitch, count] of sorted) {
  const bar = '█'.repeat(count);
  console.log(`  ${pitch.padEnd(4)} ${String(count).padStart(2)}회 (${(count/SAMPLES*100).toFixed(1)}%) ${bar}`);
}
console.log(`\n  C4(도) 시작: ${((pitchCounts['C4']||0)/SAMPLES*100).toFixed(1)}%`);
console.log(`  C5(높은도) 시작: ${((pitchCounts['C5']||0)/SAMPLES*100).toFixed(1)}%`);
console.log(`  도(C4+C5) 합계: ${(((pitchCounts['C4']||0)+(pitchCounts['C5']||0))/SAMPLES*100).toFixed(1)}%`);
