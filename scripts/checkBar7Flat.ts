import { generateScore, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState } from '../src/lib/scoreUtils';

const SAMPLES = 30;
let flatCount = 0;
const details: string[] = [];

for (let i = 0; i < SAMPLES; i++) {
  const opts: GeneratorOptions = {
    keySignature: 'C',
    timeSignature: '4/4',
    difficulty: 'advanced_3',
    measures: 8,
    useGrandStaff: true,
    bassDifficulty: 'bass_3',
  };
  const generated = generateScore(opts);
  const state: ScoreState = {
    title: `Test_${i}`,
    keySignature: 'C',
    timeSignature: '4/4',
    tempo: 120,
    notes: generated.trebleNotes,
    bassNotes: generated.bassNotes,
    useGrandStaff: true,
  };
  const abc = generateAbc(state);

  // Extract treble lines only
  const lines = abc.split('\n');
  const trebleSegments: string[] = [];
  let inTreble = false;
  for (const line of lines) {
    if (line.startsWith('V:V1')) { inTreble = true; continue; }
    if (line.startsWith('V:V2')) { inTreble = false; continue; }
    if (inTreble) trebleSegments.push(line);
  }
  const trebleBody = trebleSegments.join(' ');
  
  // Split by bar lines
  const bars = trebleBody.replace(/\|\]/g, '|').split('|').map(b => b.trim()).filter(b => b.length > 0);
  
  if (bars.length >= 7) {
    const bar7 = bars[6]; // 0-indexed, so bar 7 = index 6
    // Find last note in bar 7
    const noteRegex = /[_^=]*[a-gA-G][',]*/g;
    const matches = [...bar7.matchAll(noteRegex)];
    if (matches.length > 0) {
      const lastNote = matches[matches.length - 1][0];
      const hasFlat = lastNote.startsWith('_');
      if (hasFlat) flatCount++;
      details.push(`#${i+1}: bar7="${bar7}" lastNote="${lastNote}" flat=${hasFlat}`);
    }
  }
}

console.log(`\n=== 7마디 마지막 음 플랫 비율 ===`);
console.log(`샘플: ${SAMPLES}개`);
console.log(`플랫: ${flatCount}개 (${(flatCount/SAMPLES*100).toFixed(1)}%)`);
console.log(`\n상세:`);
details.forEach(d => console.log(d));
