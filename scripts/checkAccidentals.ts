import { generateScore, type GeneratorOptions, type Difficulty } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState } from '../src/lib/scoreUtils';

const SAMPLES = 20;
const diffs: Difficulty[] = ['advanced_2', 'advanced_3'];

for (const diff of diffs) {
  let totalAccidentals = 0;
  const details: string[] = [];
  
  for (let i = 0; i < SAMPLES; i++) {
    const opts: GeneratorOptions = {
      keySignature: 'C',
      timeSignature: '4/4',
      difficulty: diff,
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

    // Extract treble lines
    const lines = abc.split('\n');
    const trebleSegments: string[] = [];
    let inTreble = false;
    for (const line of lines) {
      if (line.startsWith('V:V1')) { inTreble = true; continue; }
      if (line.startsWith('V:V2')) { inTreble = false; continue; }
      if (inTreble) trebleSegments.push(line);
    }
    const trebleBody = trebleSegments.join(' ');
    
    // Count accidentals (excluding clef=bass false positives)
    const accMatches = trebleBody.match(/[_^=][A-Ga-g]/g) || [];
    const realAcc = accMatches.filter(m => m !== '=b' && m !== '=t');
    totalAccidentals += realAcc.length;
    if (realAcc.length > 0) {
      details.push(`#${i+1}: ${realAcc.length}개 - ${realAcc.join(', ')}`);
    }
  }
  
  console.log(`\n=== ${diff} 임시표 통계 ===`);
  console.log(`샘플: ${SAMPLES}개`);
  console.log(`총 임시표: ${totalAccidentals}개 (평균 ${(totalAccidentals/SAMPLES).toFixed(1)}개/곡)`);
  if (details.length > 0) {
    console.log(`상세:`);
    details.forEach(d => console.log(`  ${d}`));
  } else {
    console.log(`임시표 없음!`);
  }
}
