import * as fs from 'fs';
import * as path from 'path';
import { generateRhythmDictation } from '../src/lib/rhythmEngine';
import { generateAbc } from '../src/lib/scoreUtils/abc';

const OUT_FILE = path.join(__dirname, '..', 'rhythm_test_scores.md');
const TIME_SIGS = ['4/4', '3/4'];
const COUNT_PER = 20;

function run() {
  let md = '# Rhythm Dictation Test Scores\n\n';
  md += `각 난이도(1~6) × 박자(${TIME_SIGS.join(', ')})별 ${COUNT_PER}개씩 생성\n\n`;

  for (let level = 1; level <= 6; level++) {
    md += `## Level ${level}\n\n`;
    for (const timeSig of TIME_SIGS) {
      md += `### ${timeSig}\n\n`;
      for (let i = 1; i <= COUNT_PER; i++) {
        const notes = generateRhythmDictation(level, 4, timeSig);
        const abc = generateAbc({
          title: `L${level}-${timeSig}-${i}`,
          keySignature: 'C',
          timeSignature: timeSig,
          notes: notes,
          tempo: 80,
          disableTies: true,
        });
        md += `**Test ${i}**\n\`\`\`abc\n${abc}\n\`\`\`\n\n`;
      }
    }
  }

  fs.writeFileSync(OUT_FILE, md, 'utf8');
  console.log(`Generated ${6 * TIME_SIGS.length * COUNT_PER} test scores to ${OUT_FILE}`);
}

run();
