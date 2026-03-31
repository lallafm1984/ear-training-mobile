/**
 * 2성부 ABC 자동생성 검증 스크립트
 *
 * twoVoice 모듈(베이스 + 멜로디 + 대위법 보정)을 직접 테스트합니다.
 *
 * 조합:
 *   - 베이스 단계: bass_1 / bass_2 / bass_3
 *   - 멜로디 단계: 9단계 (beginner_1 ~ advanced_3)
 *   - 박자: 4/4, 3/4, 6/8 (기본 샘플) / 전체 8가지 (--all)
 *   - 조성: 장·단조 대표 8개 (기본) / 전 24개 (--all)
 *   - 마디 수: 4, 8
 *
 * 실행: npx tsx scripts/generateTwoVoiceAbc.ts [옵션]
 *   --all             전체 조합
 *   --bass bass_2     특정 베이스 단계만
 *   --diff beginner_1 특정 멜로디 단계만
 *   --time 4/4        특정 박자만
 *   --key C           특정 조성만
 *   --measures 4      특정 마디 수만
 *   --out <path>      출력 파일 (기본: temp/two-voice-abc-output.txt)
 *   --json            JSON 형태 출력
 */

import { generateScore, type Difficulty, type BassDifficulty, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState, getSixteenthsPerBar } from '../src/lib/scoreUtils';
import * as fs from 'fs';
import * as path from 'path';

// ── 상수 ──

const ALL_TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '12/8', '9/8', '5/4', '7/8'];
const SAMPLE_TIME_SIGNATURES = ['4/4', '3/4', '6/8'];

const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];
const SAMPLE_KEYS = ['C', 'G', 'F', 'D', 'Bb', 'Am', 'Em', 'Dm'];

const ALL_DIFFICULTIES: Difficulty[] = [
  'beginner_1', 'beginner_2', 'beginner_3',
  'intermediate_1', 'intermediate_2', 'intermediate_3',
  'advanced_1', 'advanced_2', 'advanced_3',
];

const ALL_BASS_DIFFICULTIES: BassDifficulty[] = ['bass_1', 'bass_2', 'bass_3'];

const MEASURE_OPTIONS = [4, 8];

const DIFF_LABELS: Record<Difficulty, string> = {
  beginner_1: '초급1', beginner_2: '초급2', beginner_3: '초급3',
  intermediate_1: '중급1', intermediate_2: '중급2', intermediate_3: '중급3',
  advanced_1: '고급1', advanced_2: '고급2', advanced_3: '고급3',
};

const BASS_LABELS: Record<BassDifficulty, string> = {
  bass_1: '베이스1(지속음)',
  bass_2: '베이스2(순차진행)',
  bass_3: '베이스3(순차+도약)',
};

// ── 검증 ──

interface ValidationResult {
  pass: boolean;
  errors: string[];
  warnings: string[];
}

function validateAbc(abc: string, opts: GeneratorOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) 헤더 확인
  if (!abc.includes('X: 1')) errors.push('헤더 X: 1 누락');
  if (!abc.includes(`M: ${opts.timeSignature}`)) errors.push(`박자 M: ${opts.timeSignature} 불일치`);
  if (!abc.includes(`K: ${opts.keySignature}`)) errors.push(`조성 K: ${opts.keySignature} 불일치`);
  if (!abc.includes('L: 1/16')) errors.push('기본 단위 L: 1/16 누락');

  // 2) 종지선
  if (!abc.includes('|]')) warnings.push('종지선 |] 없음');

  // 3) 음표 존재 확인
  if (!/[a-gA-G]/.test(abc)) errors.push('음표가 전혀 없음');

  // 4) 큰보표 구조 확인 (2성부 전용)
  if (!abc.includes('%%staves {V1 V2}')) errors.push('큰보표 %%staves {V1 V2} 누락');
  if (!abc.includes('V:V1 clef=treble')) errors.push('V1 treble clef 누락');
  if (!abc.includes('V:V2 clef=bass')) errors.push('V2 bass clef 누락');

  // 5) 트레블 파트 마디 박자 검증
  const sixteenthsPerBar = getSixteenthsPerBar(opts.timeSignature);
  const trebleErrors = validateVoiceBarDurations(abc, sixteenthsPerBar, 'V1');
  const bassErrors = validateVoiceBarDurations(abc, sixteenthsPerBar, 'V2');
  errors.push(...trebleErrors.map(e => `[트레블] ${e}`));
  errors.push(...bassErrors.map(e => `[베이스] ${e}`));

  return { pass: errors.length === 0, errors, warnings };
}

/** 특정 성부(V1/V2)의 마디별 박자 합계 검증 */
function validateVoiceBarDurations(abc: string, sixteenthsPerBar: number, voice: 'V1' | 'V2'): string[] {
  const lines = abc.split('\n');
  const voiceLines: string[] = [];
  let inVoice = false;

  for (const line of lines) {
    if (line.startsWith(`V:${voice}`)) { inVoice = true; continue; }
    if (line.startsWith('V:') && !line.startsWith(`V:${voice}`)) { inVoice = false; continue; }
    if (inVoice) voiceLines.push(line);
  }

  let body = voiceLines.join(' ').replace(/\|\]/g, '|');
  const bars = body.split('|').map(b => b.trim()).filter(b => b.length > 0);

  const errors: string[] = [];
  for (let i = 0; i < bars.length; i++) {
    const total = countBarSixteenths(bars[i]);
    if (total < 0) continue; // 잇단음표 포함 — 스킵
    if (total === sixteenthsPerBar) continue;
    // 첫/마지막 마디는 못갖춘마디 허용
    if ((i === 0 || i === bars.length - 1) && total <= sixteenthsPerBar) continue;
    if (Math.abs(total - sixteenthsPerBar) > 1) {
      errors.push(`마디 ${i + 1}: 박자 불일치 (${total}/${sixteenthsPerBar} 16분음표)`);
    }
  }
  return errors;
}

function countBarSixteenths(bar: string): number {
  if (/\(\d/.test(bar)) return -1; // 잇단음표 포함
  let total = 0;
  const noteRegex = /(?:[_^=]*[a-gA-G][',]*|[zZ])(\d+)?/g;
  let match;
  while ((match = noteRegex.exec(bar)) !== null) {
    total += match[1] ? parseInt(match[1], 10) : 1;
  }
  return total;
}

// ── 테스트 케이스 빌더 ──

interface TestCase {
  id: string;
  timeSignature: string;
  keySignature: string;
  difficulty: Difficulty;
  measures: number;
  bassDifficulty: BassDifficulty;
}

interface TestResult {
  testCase: TestCase;
  abc: string;
  validation: ValidationResult;
  error?: string;
}

function buildTestCases(args: ParsedArgs): TestCase[] {
  const cases: TestCase[] = [];
  let id = 0;

  const times = args.time ? [args.time] : (args.all ? ALL_TIME_SIGNATURES : SAMPLE_TIME_SIGNATURES);
  const keys = args.key ? [args.key] : (args.all ? ALL_KEYS : SAMPLE_KEYS);
  const diffs = args.diff ? [args.diff as Difficulty] : ALL_DIFFICULTIES;
  const measures = args.measures ? [args.measures] : MEASURE_OPTIONS;
  const basses = args.bass ? [args.bass as BassDifficulty] : ALL_BASS_DIFFICULTIES;

  for (const ts of times) {
    for (const ks of keys) {
      for (const diff of diffs) {
        for (const m of measures) {
          for (const bd of basses) {
            cases.push({
              id: `TV-${String(++id).padStart(4, '0')}`,
              timeSignature: ts,
              keySignature: ks,
              difficulty: diff,
              measures: m,
              bassDifficulty: bd,
            });
          }
        }
      }
    }
  }

  return cases;
}

function runTestCase(tc: TestCase): TestResult {
  try {
    const opts: GeneratorOptions = {
      keySignature: tc.keySignature,
      timeSignature: tc.timeSignature,
      difficulty: tc.difficulty,
      measures: tc.measures,
      useGrandStaff: true,
      bassDifficulty: tc.bassDifficulty,
    };

    const generated = generateScore(opts);

    const state: ScoreState = {
      title: `2성부_${tc.id}`,
      keySignature: tc.keySignature,
      timeSignature: tc.timeSignature,
      tempo: 120,
      notes: generated.trebleNotes,
      bassNotes: generated.bassNotes,
      useGrandStaff: true,
    };

    const abc = generateAbc(state);
    const validation = validateAbc(abc, opts);

    return { testCase: tc, abc, validation };
  } catch (e: any) {
    return {
      testCase: tc,
      abc: '',
      validation: { pass: false, errors: [`생성 오류: ${e.message}`], warnings: [] },
      error: e.message,
    };
  }
}

// ── CLI 인자 파싱 ──

interface ParsedArgs {
  all: boolean;
  bass?: string;
  diff?: string;
  time?: string;
  key?: string;
  measures?: number;
  out: string;
  json: boolean;
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2);
  const result: ParsedArgs = {
    all: false,
    out: 'temp/two-voice-abc-output.txt',
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--all':      result.all = true; break;
      case '--json':     result.json = true; break;
      case '--bass':     result.bass = argv[++i]; break;
      case '--diff':     result.diff = argv[++i]; break;
      case '--time':     result.time = argv[++i]; break;
      case '--key':      result.key = argv[++i]; break;
      case '--measures': result.measures = parseInt(argv[++i], 10); break;
      case '--out':      result.out = argv[++i]; break;
    }
  }

  if (result.json && result.out === 'temp/two-voice-abc-output.txt') {
    result.out = 'temp/two-voice-abc-output.json';
  }

  return result;
}

// ── 리포트 포맷 ──

function formatTextReport(results: TestResult[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const passed = results.filter(r => r.validation.pass).length;
  const failed = results.filter(r => !r.validation.pass).length;
  const warned = results.filter(r => r.validation.warnings.length > 0).length;

  lines.push('═'.repeat(80));
  lines.push('  2성부 ABC 자동생성 검증 리포트');
  lines.push(`  생성일: ${now}`);
  lines.push(`  총 ${results.length}건 | PASS: ${passed} | FAIL: ${failed} | 경고: ${warned}`);
  lines.push('═'.repeat(80));
  lines.push('');

  // FAIL 목록
  const failedResults = results.filter(r => !r.validation.pass);
  if (failedResults.length > 0) {
    lines.push('── FAIL 목록 ──');
    for (const r of failedResults) {
      const tc = r.testCase;
      lines.push(`  FAIL [${tc.id}] ${tc.timeSignature} | ${tc.keySignature} | ${DIFF_LABELS[tc.difficulty]} | ${tc.measures}마디 | ${BASS_LABELS[tc.bassDifficulty]}`);
      for (const e of r.validation.errors) {
        lines.push(`    ✗ ${e}`);
      }
    }
    lines.push('');
  }

  // 경고 목록
  const warnedResults = results.filter(r => r.validation.warnings.length > 0);
  if (warnedResults.length > 0) {
    lines.push('── 경고 목록 ──');
    for (const r of warnedResults) {
      const tc = r.testCase;
      lines.push(`  WARN [${tc.id}] ${tc.timeSignature} | ${tc.keySignature} | ${DIFF_LABELS[tc.difficulty]}`);
      for (const w of r.validation.warnings) {
        lines.push(`    ⚠ ${w}`);
      }
    }
    lines.push('');
  }

  // 베이스 단계별 통계
  lines.push('── 베이스 단계별 통계 ──');
  for (const bd of ALL_BASS_DIFFICULTIES) {
    const sub = results.filter(r => r.testCase.bassDifficulty === bd);
    if (sub.length === 0) continue;
    const p = sub.filter(r => r.validation.pass).length;
    const f = sub.length - p;
    const bar = '█'.repeat(Math.round(p / sub.length * 20));
    lines.push(`  ${BASS_LABELS[bd].padEnd(22)} ${p.toString().padStart(4)}/${sub.length.toString().padStart(4)} ${bar}${f > 0 ? ` (${f} FAIL)` : ''}`);
  }
  lines.push('');

  // 멜로디 단계별 통계
  lines.push('── 멜로디 단계별 통계 ──');
  for (const diff of ALL_DIFFICULTIES) {
    const sub = results.filter(r => r.testCase.difficulty === diff);
    if (sub.length === 0) continue;
    const p = sub.filter(r => r.validation.pass).length;
    const f = sub.length - p;
    const bar = '█'.repeat(Math.round(p / sub.length * 20));
    lines.push(`  ${DIFF_LABELS[diff].padEnd(6)} ${p.toString().padStart(4)}/${sub.length.toString().padStart(4)} ${bar}${f > 0 ? ` (${f} FAIL)` : ''}`);
  }
  lines.push('');

  // 박자별 통계
  lines.push('── 박자별 통계 ──');
  const timeSigsPresent = [...new Set(results.map(r => r.testCase.timeSignature))];
  for (const ts of ALL_TIME_SIGNATURES.filter(t => timeSigsPresent.includes(t))) {
    const sub = results.filter(r => r.testCase.timeSignature === ts);
    const p = sub.filter(r => r.validation.pass).length;
    const f = sub.length - p;
    lines.push(`  ${ts.padEnd(6)} ${p.toString().padStart(4)}/${sub.length.toString().padStart(4)} ${f > 0 ? `(${f} FAIL)` : 'OK'}`);
  }
  lines.push('');

  // 조성 타입별 통계
  const majorResults = results.filter(r => !r.testCase.keySignature.endsWith('m'));
  const minorResults = results.filter(r => r.testCase.keySignature.endsWith('m'));
  if (majorResults.length > 0 || minorResults.length > 0) {
    lines.push('── 장·단조 통계 ──');
    if (majorResults.length > 0) {
      const p = majorResults.filter(r => r.validation.pass).length;
      lines.push(`  장조  ${p.toString().padStart(4)}/${majorResults.length.toString().padStart(4)}${majorResults.length - p > 0 ? ` (${majorResults.length - p} FAIL)` : ' OK'}`);
    }
    if (minorResults.length > 0) {
      const p = minorResults.filter(r => r.validation.pass).length;
      lines.push(`  단조  ${p.toString().padStart(4)}/${minorResults.length.toString().padStart(4)}${minorResults.length - p > 0 ? ` (${minorResults.length - p} FAIL)` : ' OK'}`);
    }
    lines.push('');
  }

  // ABC 상세 출력 (베이스 단계 → 멜로디 단계 → 박자 순)
  lines.push('═'.repeat(80));
  lines.push('  ABC 코드 상세');
  lines.push('═'.repeat(80));
  lines.push('');

  const sorted = [...results].sort((a, b) => {
    const ba = ALL_BASS_DIFFICULTIES.indexOf(a.testCase.bassDifficulty);
    const bb = ALL_BASS_DIFFICULTIES.indexOf(b.testCase.bassDifficulty);
    if (ba !== bb) return ba - bb;
    const da = ALL_DIFFICULTIES.indexOf(a.testCase.difficulty);
    const db = ALL_DIFFICULTIES.indexOf(b.testCase.difficulty);
    if (da !== db) return da - db;
    return a.testCase.timeSignature.localeCompare(b.testCase.timeSignature);
  });

  for (const r of sorted) {
    const tc = r.testCase;
    const status = r.validation.pass ? 'PASS' : 'FAIL';
    lines.push(`── [${status}] ${tc.id}: ${tc.timeSignature} | ${tc.keySignature} | ${DIFF_LABELS[tc.difficulty]} | ${tc.measures}마디 | ${BASS_LABELS[tc.bassDifficulty]} ──`);
    if (r.validation.errors.length > 0) {
      lines.push(`오류: ${r.validation.errors.join(', ')}`);
    }
    if (r.validation.warnings.length > 0) {
      lines.push(`경고: ${r.validation.warnings.join(', ')}`);
    }
    lines.push('');
    lines.push(r.abc || '(생성 실패)');
    lines.push('');
  }

  return lines.join('\n');
}

function formatJsonReport(results: TestResult[]): string {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter(r => r.validation.pass).length,
      failed: results.filter(r => !r.validation.pass).length,
    },
    results: results.map(r => ({
      id: r.testCase.id,
      config: {
        timeSignature: r.testCase.timeSignature,
        keySignature: r.testCase.keySignature,
        difficulty: r.testCase.difficulty,
        measures: r.testCase.measures,
        bassDifficulty: r.testCase.bassDifficulty,
      },
      pass: r.validation.pass,
      errors: r.validation.errors,
      warnings: r.validation.warnings,
      abc: r.abc,
    })),
  }, null, 2);
}

// ── 메인 ──

function main() {
  const args = parseArgs();
  const cases = buildTestCases(args);

  console.log(`\n2성부 ABC 자동생성 검증 시작 (${cases.length}건)\n`);
  if (args.all) {
    console.log(`  모드: 전체 조합 (${ALL_TIME_SIGNATURES.length}박자 × ${ALL_KEYS.length}조성 × 9난이도 × 3베이스 × 2마디수)`);
  } else {
    console.log(`  모드: 대표 샘플 (${SAMPLE_TIME_SIGNATURES.length}박자 × ${SAMPLE_KEYS.length}조성 × 9난이도 × 3베이스 × 2마디수)`);
  }
  console.log('');

  const startTime = Date.now();
  const results: TestResult[] = [];
  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < cases.length; i++) {
    const r = runTestCase(cases[i]);
    results.push(r);

    if (r.validation.pass) {
      passCount++;
    } else {
      failCount++;
      const tc = r.testCase;
      console.log(`  FAIL [${tc.id}] ${tc.timeSignature} ${tc.keySignature} ${DIFF_LABELS[tc.difficulty]} ${tc.measures}m ${tc.bassDifficulty}`);
      for (const e of r.validation.errors) {
        console.log(`    -> ${e}`);
      }
    }

    // 진행률 표시 (50건마다)
    if ((i + 1) % 50 === 0 || i === cases.length - 1) {
      const pct = Math.round(((i + 1) / cases.length) * 100);
      process.stdout.write(`\r  진행: ${i + 1}/${cases.length} (${pct}%) | PASS: ${passCount} | FAIL: ${failCount}  `);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n  완료: ${elapsed}초 소요\n`);

  // 출력 파일 저장
  const outDir = path.dirname(args.out);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const report = args.json ? formatJsonReport(results) : formatTextReport(results);
  fs.writeFileSync(args.out, report, 'utf-8');
  console.log(`  결과 저장: ${args.out}`);
  console.log(`  PASS: ${passCount} / FAIL: ${failCount} / 총: ${results.length}\n`);

  if (failCount > 0) process.exit(1);
}

main();
