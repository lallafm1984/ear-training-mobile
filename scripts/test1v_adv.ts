import { generateScore } from '../src/lib/scoreGenerator';
import { noteToMidiWithKey } from '../src/lib/scoreUtils';

const SAMPLES = 50;
let total = 0, problems = 0;

for (let s = 0; s < SAMPLES; s++) {
  const score = generateScore({
    keySignature: 'C', timeSignature: '4/4',
    difficulty: 'advanced_2', measures: 8, useGrandStaff: false,
  });
  const notes = score.trebleNotes;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.accidental || n.pitch === 'rest') continue;
    total++;
    const midi = noteToMidiWithKey(n, 'C');
    let prevM = -1, nextM = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (notes[j].pitch !== 'rest') { prevM = noteToMidiWithKey(notes[j], 'C'); break; }
    }
    for (let j = i + 1; j < notes.length; j++) {
      if (notes[j].pitch !== 'rest') { nextM = noteToMidiWithKey(notes[j], 'C'); break; }
    }
    const issues: string[] = [];
    if (prevM > 0) {
      const d = Math.abs(midi - prevM);
      if (d === 1) issues.push('m2_entry');
      if (d === 6) issues.push('tritone_entry');
      if (d > 7) issues.push('big_leap_entry');
    }
    if (nextM > 0) {
      const d = Math.abs(midi - nextM);
      if (d > 3) issues.push('no_resolution');
      if (d === 6) issues.push('tritone_exit');
    }
    if (issues.length > 0) problems++;
  }
}
console.log(`1성부 고급2 (C장조 4/4, useGrandStaff=false): ${total}건 중 문제 ${problems}건 (${total > 0 ? (problems / total * 100).toFixed(1) : '0'}%)`);
