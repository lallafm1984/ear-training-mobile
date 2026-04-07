import { generateScore } from '../src/lib/scoreGenerator';
import { generateRhythmDictation } from '../src/lib/rhythmEngine';
import { generateChoiceQuestion } from '../src/lib/questionGenerator';
import { 
  MAJOR_KEY_SIGNATURES, 
  MINOR_KEY_SIGNATURES, 
  ALL_TIME_SIGNATURES 
} from '../src/types';
import { Difficulty, BassDifficulty } from '../src/lib/scoreGenerator/types';
import * as fs from 'fs';
import * as path from 'path';

const ALL_KEYS = [...MAJOR_KEY_SIGNATURES, ...MINOR_KEY_SIGNATURES];
const ALL_TIME_SIGS = ALL_TIME_SIGNATURES;
const MELODY_DIFFS: Difficulty[] = [
  'beginner_1', 'beginner_2', 'beginner_3',
  'intermediate_1', 'intermediate_2', 'intermediate_3',
  'advanced_1', 'advanced_2', 'advanced_3'
];
const BASS_DIFFS: BassDifficulty[] = ['bass_1', 'bass_2', 'bass_3', 'bass_4'];

const ITERATIONS = 100;
const REPORT_FILE = path.join(__dirname, '..', 'bulk_test_report.md');

interface TestResult {
  category: string;
  variable: string;
  value: string;
  success: number;
  error: number;
  duplicates: number;
  avgNoteCount: number;
  details: string[];
}

const results: TestResult[] = [];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function runMelodyTests() {
  console.log('Testing Melody...');
  
  // 1. By Difficulty
  for (const diff of MELODY_DIFFS) {
    const res: TestResult = { category: 'melody', variable: 'difficulty', value: diff, success: 0, error: 0, duplicates: 0, avgNoteCount: 0, details: [] };
    const seen = new Set<string>();
    let totalNotes = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const score = generateScore({
          keySignature: rand(ALL_KEYS),
          timeSignature: rand(ALL_TIME_SIGS),
          difficulty: diff,
          measures: 4,
          useGrandStaff: false
        });
        res.success++;
        const s = JSON.stringify(score.trebleNotes);
        if (seen.has(s)) res.duplicates++;
        seen.add(s);
        totalNotes += score.trebleNotes.length;
      } catch (e: any) {
        res.error++;
        res.details.push(e.message);
      }
    }
    res.avgNoteCount = totalNotes / (res.success || 1);
    results.push(res);
  }

  // 2. By Key (using intermediate_1 as representative)
  for (const key of ALL_KEYS) {
    const res: TestResult = { category: 'melody', variable: 'key', value: key, success: 0, error: 0, duplicates: 0, avgNoteCount: 0, details: [] };
    for (let i = 0; i < ITERATIONS; i++) {
      try {
        generateScore({
          keySignature: key,
          timeSignature: rand(ALL_TIME_SIGS),
          difficulty: 'intermediate_1',
          measures: 4,
          useGrandStaff: false
        });
        res.success++;
      } catch (e: any) {
        res.error++;
        res.details.push(e.message);
      }
    }
    results.push(res);
  }
}

async function runRhythmTests() {
  console.log('Testing Rhythm...');
  for (let level = 1; level <= 6; level++) {
    const res: TestResult = { category: 'rhythm', variable: 'level', value: `Level ${level}`, success: 0, error: 0, duplicates: 0, avgNoteCount: 0, details: [] };
    const seen = new Set<string>();
    let totalNotes = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const notes = generateRhythmDictation(level, 4, rand(ALL_TIME_SIGS));
        res.success++;
        const s = JSON.stringify(notes);
        if (seen.has(s)) res.duplicates++;
        seen.add(s);
        totalNotes += notes.length;
      } catch (e: any) {
        res.error++;
        res.details.push(e.message);
      }
    }
    res.avgNoteCount = totalNotes / (res.success || 1);
    results.push(res);
  }
}

async function runTwoVoiceTests() {
  console.log('Testing Two-Voice...');
  for (const bDiff of BASS_DIFFS) {
    const res: TestResult = { category: 'twoVoice', variable: 'bassDifficulty', value: bDiff, success: 0, error: 0, duplicates: 0, avgNoteCount: 0, details: [] };
    const seen = new Set<string>();
    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const score = generateScore({
          keySignature: rand(ALL_KEYS),
          timeSignature: rand(ALL_TIME_SIGS),
          difficulty: 'intermediate_2',
          bassDifficulty: bDiff,
          measures: 4,
          useGrandStaff: true
        });
        res.success++;
        const s = JSON.stringify(score.trebleNotes) + JSON.stringify(score.bassNotes);
        if (seen.has(s)) res.duplicates++;
        seen.add(s);
      } catch (e: any) {
        res.error++;
        res.details.push(e.message);
      }
    }
    results.push(res);
  }
}

async function runChoiceTests() {
  console.log('Testing Choice (Interval/Chord/Key)...');
  const categories = ['interval', 'chord', 'key'] as const;
  for (const cat of categories) {
    const maxL = cat === 'key' ? 3 : 4;
    for (let l = 1; l <= maxL; l++) {
      const diff = `${cat}_${l}`;
      const res: TestResult = { category: cat, variable: 'level', value: diff, success: 0, error: 0, duplicates: 0, avgNoteCount: 0, details: [] };
      const seen = new Set<string>();
      for (let i = 0; i < ITERATIONS; i++) {
        try {
          const q = generateChoiceQuestion(cat, diff as any);
          res.success++;
          if (seen.has(q.correctAnswer + q.abcNotation)) res.duplicates++;
          seen.add(q.correctAnswer + q.abcNotation);
        } catch (e: any) {
          res.error++;
          res.details.push(e.message);
        }
      }
      results.push(res);
    }
  }
}

function generateReport() {
  let md = '# Bulk Test Ear Training Report\n\n';
  md += `Test ran at: ${new Date().toLocaleString()}\n`;
  md += `Iterations per condition: ${ITERATIONS}\n\n`;

  const cats = Array.from(new Set(results.map(r => r.category)));
  for (const cat of cats) {
    md += `## Category: ${cat}\n\n`;
    md += `| Variable | Value | Success | Error | Duplicates | Avg Notes |\n`;
    md += `| --- | --- | --- | --- | --- | --- |\n`;
    const catResults = results.filter(r => r.category === cat);
    for (const r of catResults) {
      md += `| ${r.variable} | ${r.value} | ${r.success} | ${r.error} | ${r.duplicates} | ${r.avgNoteCount.toFixed(1)} |\n`;
    }
    md += '\n';
  }

  const allErrors = results.flatMap(r => r.details);
  if (allErrors.length > 0) {
    md += `## Error Details\n\n`;
    const uniqueErrors = Array.from(new Set(allErrors));
    for (const err of uniqueErrors) {
      md += `- ${err}\n`;
    }
  }

  fs.writeFileSync(REPORT_FILE, md);
  console.log(`Report generated: ${REPORT_FILE}`);
}

async function main() {
  await runMelodyTests();
  await runRhythmTests();
  await runTwoVoiceTests();
  await runChoiceTests();
  generateReport();
}

main();
