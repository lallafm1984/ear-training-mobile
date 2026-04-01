/**
 * 동일 조건으로 N개 악보를 생성하여 분석하는 스크립트.
 * 실행: npx tsx scripts/generateBulkTest.ts
 */
import { generateScore, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState, getSixteenthsPerBar } from '../src/lib/scoreUtils';
import * as fs from 'fs';

// CLI args: [count] [key] [bassDiff] [timeSig] [difficulty]
const args = process.argv.slice(2);
const COUNT = parseInt(args[0] || '100', 10);
const KEY = args[1] || 'C';
const BASS_DIFF = (args[2] || 'bass_3') as 'bass_1' | 'bass_2' | 'bass_3' | 'bass_4';
const TIME_SIG = args[3] || '4/4';
const DIFFICULTY = (args[4] || 'advanced_1') as 'advanced_1';
const MEASURES_OPTIONS = [4, 8];

interface Result {
  id: number;
  measures: number;
  abc: string;
  error?: string;
}

function main() {
  const results: Result[] = [];

  for (let i = 0; i < COUNT; i++) {
    const measures = MEASURES_OPTIONS[i % 2] as 4 | 8;
    try {
      const opts: GeneratorOptions = {
        keySignature: KEY,
        timeSignature: TIME_SIG,
        difficulty: DIFFICULTY,
        measures,
        useGrandStaff: true,
        bassDifficulty: BASS_DIFF,
      };
      const generated = generateScore(opts);
      const state: ScoreState = {
        title: `Bulk_${i + 1}`,
        keySignature: KEY,
        timeSignature: TIME_SIG,
        tempo: 120,
        notes: generated.trebleNotes,
        bassNotes: generated.bassNotes,
        useGrandStaff: true,
      };
      const abc = generateAbc(state);
      results.push({ id: i + 1, measures, abc });
    } catch (e: any) {
      results.push({ id: i + 1, measures, abc: '', error: e.message });
    }
  }

  // 출력
  const lines: string[] = [];
  lines.push(`=== Bulk Test: ${COUNT}개 | ${TIME_SIG} | ${KEY} | ${DIFFICULTY} | ${BASS_DIFF} ===\n`);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    lines.push(`생성 오류: ${errors.length}건`);
    errors.forEach(e => lines.push(`  #${e.id}: ${e.error}`));
    lines.push('');
  }

  for (const r of results) {
    lines.push(`── #${r.id} (${r.measures}마디) ──`);
    lines.push(r.abc || `(오류: ${r.error})`);
    lines.push('');
  }

  const outPath = `temp/bulk-${KEY}-${BASS_DIFF}-${TIME_SIG.replace('/','-')}.txt`;
  fs.mkdirSync('temp', { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`완료: ${COUNT}개 생성, 오류 ${errors.length}건 → ${outPath}`);
}

main();
