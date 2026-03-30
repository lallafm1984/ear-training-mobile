/**
 * 내부 테스트용 ABC 자동생성 검증 프로세서
 *
 * 조합:
 *   - 박자: 4/4, 3/4, 2/4, 6/8, 12/8, 9/8, 5/4, 7/8
 *   - 조성: 장조 12 + 단조 12 = 24개
 *   - 난이도: 9단계 (beginner_1 ~ advanced_3)
 *   - 큰보표: off / bass_1 / bass_2 / bass_3
 *   - 마디 수: 4, 8
 *
 * 실행: npx tsx scripts/generateTestAbc.ts [옵션]
 *   --all           전체 조합 (기본: 대표 샘플링)
 *   --time 4/4      특정 박자만
 *   --key C         특정 조성만
 *   --diff beginner_1  특정 난이도만
 *   --measures 4    특정 마디 수만
 *   --grand         큰보표 조합만
 *   --out <path>    출력 파일 (기본: temp/test-abc-output.txt)
 *   --json          JSON 형태 출력
 */

import { generateScore, type Difficulty, type BassDifficulty, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { generateAbc, type ScoreState, getSixteenthsPerBar } from '../src/lib/scoreUtils';
import * as fs from 'fs';
import * as path from 'path';

// ── 상수 ──

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '12/8', '9/8', '5/4', '7/8'];

const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

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
  bass_1: '베이스1(지속음)', bass_2: '베이스2(2분)', bass_3: '베이스3(2분+4분)',
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

  // 1) 기본 헤더 확인
  if (!abc.includes('X: 1')) errors.push('헤더 X: 1 누락');
  if (!abc.includes(`M: ${opts.timeSignature}`)) errors.push(`박자 M: ${opts.timeSignature} 불일치`);
  if (!abc.includes(`K: ${opts.keySignature}`)) errors.push(`조성 K: ${opts.keySignature} 불일치`);
  if (!abc.includes('L: 1/16')) errors.push('기본 단위 L: 1/16 누락');

  // 2) 마디선 개수로 마디 수 검증
  const bodyLines = abc.split('\n').filter(l => !l.startsWith('X:') && !l.startsWith('T:') && !l.startsWith('M:') && !l.startsWith('L:') && !l.startsWith('Q:') && !l.startsWith('K:') && !l.startsWith('%%') && !l.startsWith('V:'));
  const trebleBody = opts.useGrandStaff
    ? abc.split('\n').filter(l => !l.startsWith('V:V2') && !l.startsWith('X:') && !l.startsWith('T:') && !l.startsWith('M:') && !l.startsWith('L:') && !l.startsWith('Q:') && !l.startsWith('K:') && !l.startsWith('%%'))
        .filter((l, i, arr) => {
          // V:V1 뒤 ~ V:V2 전까지만
          // 간단하게 V1 clef=treble 줄 직후의 줄들
          return false; // 복잡한 파싱 대신 아래에서 다른 방식으로 검증
        })
    : bodyLines;

  // 3) 종지선 확인
  if (!abc.includes('|]')) warnings.push('종지선 |] 없음');

  // 4) 빈 내용 확인
  const notePattern = /[a-gA-G]/;
  if (!notePattern.test(abc)) errors.push('음표가 전혀 없음');

  // 5) 큰보표 검증
  if (opts.useGrandStaff) {
    if (!abc.includes('%%staves {V1 V2}')) errors.push('큰보표 staves 지시자 누락');
    if (!abc.includes('V:V1 clef=treble')) errors.push('V1 treble clef 누락');
    if (!abc.includes('V:V2 clef=bass')) errors.push('V2 bass clef 누락');
  }

  // 6) 마디 내 박자 합계 검증 (트레블 파트)
  const sixteenthsPerBar = getSixteenthsPerBar(opts.timeSignature);
  const barErrors = validateBarDurations(abc, sixteenthsPerBar, opts.useGrandStaff);
  errors.push(...barErrors);

  return {
    pass: errors.length === 0,
    errors,
    warnings,
  };
}

/** 각 마디의 16분음표 합계를 검증 */
function validateBarDurations(abc: string, sixteenthsPerBar: number, isGrandStaff: boolean): string[] {
  const errors: string[] = [];

  // 트레블 파트만 추출
  let trebleBody: string;
  if (isGrandStaff) {
    const lines = abc.split('\n');
    const trebleLines: string[] = [];
    let inTreble = false;
    for (const line of lines) {
      if (line.startsWith('V:V1')) { inTreble = true; continue; }
      if (line.startsWith('V:V2')) { inTreble = false; continue; }
      if (inTreble) trebleLines.push(line);
    }
    trebleBody = trebleLines.join(' ');
  } else {
    const lines = abc.split('\n');
    trebleBody = lines.filter(l =>
      !l.startsWith('X:') && !l.startsWith('T:') && !l.startsWith('M:') &&
      !l.startsWith('L:') && !l.startsWith('Q:') && !l.startsWith('K:') &&
      !l.startsWith('%%')
    ).join(' ');
  }

  // |] 를 | 로 변환
  trebleBody = trebleBody.replace(/\|\]/g, '|');
  const bars = trebleBody.split('|').map(b => b.trim()).filter(b => b.length > 0);

  for (let i = 0; i < bars.length; i++) {
    const barContent = bars[i];
    const total = countBarSixteenths(barContent);
    if (total >= 0 && total !== sixteenthsPerBar) {
      // 마지막 마디 또는 첫 마디(못갖춘마디)는 짧을 수 있음
      if (i === 0 || i === bars.length - 1) {
        if (total > sixteenthsPerBar) {
          errors.push(`마디 ${i + 1}: 박자 초과 (${total}/${sixteenthsPerBar} 16분음표)`);
        }
      } else if (total !== sixteenthsPerBar) {
        // 중간 마디는 정확해야 함 (단, 파싱 오류가 아닌 경우만)
        if (total > 0 && Math.abs(total - sixteenthsPerBar) > 1) {
          errors.push(`마디 ${i + 1}: 박자 불일치 (${total}/${sixteenthsPerBar} 16분음표)`);
        }
      }
    }
  }

  return errors;
}

/** ABC 마디 내용에서 16분음표 합계를 대략 계산 (간이 파서) */
function countBarSixteenths(bar: string): number {
  // 잇단음표 (N:M:R) 패턴은 복잡하므로 -1 반환하여 스킵
  if (/\(\d/.test(bar)) return -1;

  let total = 0;
  // ABC L:1/16 기준: 음표 뒤의 숫자가 16분음표 수
  // 예: C16 = 온음표, C8 = 2분, C4 = 4분, C2 = 8분, C = C1 = 16분
  const noteRegex = /(?:[_^=]*[a-gA-G][',]*|[zZ])(\d+)?/g;
  let match;
  while ((match = noteRegex.exec(bar)) !== null) {
    const durStr = match[1];
    const dur = durStr ? parseInt(durStr, 10) : 1;
    total += dur;
  }
  return total;
}

// ── 생성 엔진 ──

interface TestCase {
  id: string;
  timeSignature: string;
  keySignature: string;
  difficulty: Difficulty;
  measures: number;
  useGrandStaff: boolean;
  bassDifficulty?: BassDifficulty;
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

  const times = args.time ? [args.time] : TIME_SIGNATURES;
  const keys = args.key ? [args.key] : ALL_KEYS;
  const diffs = args.diff ? [args.diff as Difficulty] : ALL_DIFFICULTIES;
  const measures = args.measures ? [args.measures] : MEASURE_OPTIONS;

  if (args.grandOnly) {
    // 큰보표 조합만
    for (const ts of times) {
      for (const ks of keys) {
        for (const diff of diffs) {
          for (const m of measures) {
            for (const bd of ALL_BASS_DIFFICULTIES) {
              cases.push({
                id: `TC-${++id}`,
                timeSignature: ts, keySignature: ks, difficulty: diff,
                measures: m, useGrandStaff: true, bassDifficulty: bd,
              });
            }
          }
        }
      }
    }
  } else if (args.all) {
    // 전체 조합
    for (const ts of times) {
      for (const ks of keys) {
        for (const diff of diffs) {
          for (const m of measures) {
            // 단선율
            cases.push({
              id: `TC-${++id}`,
              timeSignature: ts, keySignature: ks, difficulty: diff,
              measures: m, useGrandStaff: false,
            });
            // 큰보표
            for (const bd of ALL_BASS_DIFFICULTIES) {
              cases.push({
                id: `TC-${++id}`,
                timeSignature: ts, keySignature: ks, difficulty: diff,
                measures: m, useGrandStaff: true, bassDifficulty: bd,
              });
            }
          }
        }
      }
    }
  } else {
    // 대표 샘플링: 각 난이도별로 대표 조성·박자 조합
    const sampleKeys = ['C', 'G', 'F', 'D', 'Bb', 'Am', 'Em', 'Dm'];
    const sampleTimes = args.time ? [args.time] : ['4/4', '3/4', '6/8'];
    const sampleMeasures = args.measures ? [args.measures] : [4, 8];

    for (const ts of sampleTimes) {
      for (const ks of sampleKeys) {
        for (const diff of diffs) {
          for (const m of sampleMeasures) {
            // 단선율
            cases.push({
              id: `TC-${++id}`,
              timeSignature: ts, keySignature: ks, difficulty: diff,
              measures: m, useGrandStaff: false,
            });
            // 큰보표 (대표 1개: bass_2)
            cases.push({
              id: `TC-${++id}`,
              timeSignature: ts, keySignature: ks, difficulty: diff,
              measures: m, useGrandStaff: true, bassDifficulty: 'bass_2',
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
      useGrandStaff: tc.useGrandStaff,
      bassDifficulty: tc.bassDifficulty,
    };

    const generated = generateScore(opts);

    const state: ScoreState = {
      title: `Test_${tc.id}`,
      keySignature: tc.keySignature,
      timeSignature: tc.timeSignature,
      tempo: 120,
      notes: generated.trebleNotes,
      bassNotes: tc.useGrandStaff ? generated.bassNotes : undefined,
      useGrandStaff: tc.useGrandStaff,
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
  grandOnly: boolean;
  time?: string;
  key?: string;
  diff?: string;
  measures?: number;
  out: string;
  json: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    all: false,
    grandOnly: false,
    out: 'temp/test-abc-output.txt',
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all': result.all = true; break;
      case '--grand': result.grandOnly = true; break;
      case '--json': result.json = true; break;
      case '--time': result.time = args[++i]; break;
      case '--key': result.key = args[++i]; break;
      case '--diff': result.diff = args[++i]; break;
      case '--measures': result.measures = parseInt(args[++i], 10); break;
      case '--out': result.out = args[++i]; break;
    }
  }

  if (result.json && result.out === 'temp/test-abc-output.txt') {
    result.out = 'temp/test-abc-output.json';
  }

  return result;
}

// ── 출력 포맷 ──

function formatTextReport(results: TestResult[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const passed = results.filter(r => r.validation.pass).length;
  const failed = results.filter(r => !r.validation.pass).length;
  const warned = results.filter(r => r.validation.warnings.length > 0).length;

  lines.push('═'.repeat(80));
  lines.push(`  ABC 자동생성 검증 리포트`);
  lines.push(`  생성일: ${now}`);
  lines.push(`  총 ${results.length}건 | PASS: ${passed} | FAIL: ${failed} | 경고: ${warned}`);
  lines.push('═'.repeat(80));
  lines.push('');

  // 실패 요약
  if (failed > 0) {
    lines.push('── FAIL 목록 ──');
    for (const r of results.filter(r => !r.validation.pass)) {
      const tc = r.testCase;
      const label = `[${tc.id}] ${tc.timeSignature} | ${tc.keySignature} | ${DIFF_LABELS[tc.difficulty]} | ${tc.measures}마디${tc.useGrandStaff ? ` | ${BASS_LABELS[tc.bassDifficulty!]}` : ''}`;
      lines.push(`  FAIL ${label}`);
      for (const e of r.validation.errors) {
        lines.push(`    ✗ ${e}`);
      }
    }
    lines.push('');
  }

  // 경고 요약
  if (warned > 0) {
    lines.push('── 경고 목록 ──');
    for (const r of results.filter(r => r.validation.warnings.length > 0)) {
      const tc = r.testCase;
      const label = `[${tc.id}] ${tc.timeSignature} | ${tc.keySignature} | ${DIFF_LABELS[tc.difficulty]}`;
      lines.push(`  WARN ${label}`);
      for (const w of r.validation.warnings) {
        lines.push(`    ⚠ ${w}`);
      }
    }
    lines.push('');
  }

  // 난이도별 통계
  lines.push('── 난이도별 통계 ──');
  for (const diff of ALL_DIFFICULTIES) {
    const diffResults = results.filter(r => r.testCase.difficulty === diff);
    const p = diffResults.filter(r => r.validation.pass).length;
    const f = diffResults.filter(r => !r.validation.pass).length;
    const bar = '█'.repeat(Math.round(p / Math.max(1, diffResults.length) * 20));
    lines.push(`  ${DIFF_LABELS[diff].padEnd(6)} ${p.toString().padStart(4)}/${diffResults.length.toString().padStart(4)} ${bar} ${f > 0 ? `(${f} FAIL)` : ''}`);
  }
  lines.push('');

  // 박자별 통계
  lines.push('── 박자별 통계 ──');
  for (const ts of TIME_SIGNATURES) {
    const tsResults = results.filter(r => r.testCase.timeSignature === ts);
    if (tsResults.length === 0) continue;
    const p = tsResults.filter(r => r.validation.pass).length;
    const f = tsResults.filter(r => !r.validation.pass).length;
    lines.push(`  ${ts.padEnd(6)} ${p.toString().padStart(4)}/${tsResults.length.toString().padStart(4)} ${f > 0 ? `(${f} FAIL)` : 'OK'}`);
  }
  lines.push('');

  // 큰보표 통계
  const grandResults = results.filter(r => r.testCase.useGrandStaff);
  if (grandResults.length > 0) {
    lines.push('── 큰보표 통계 ──');
    for (const bd of ALL_BASS_DIFFICULTIES) {
      const bdResults = grandResults.filter(r => r.testCase.bassDifficulty === bd);
      if (bdResults.length === 0) continue;
      const p = bdResults.filter(r => r.validation.pass).length;
      const f = bdResults.filter(r => !r.validation.pass).length;
      lines.push(`  ${BASS_LABELS[bd].padEnd(20)} ${p.toString().padStart(4)}/${bdResults.length.toString().padStart(4)} ${f > 0 ? `(${f} FAIL)` : 'OK'}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(80));
  lines.push('  ABC 코드 상세');
  lines.push('═'.repeat(80));
  lines.push('');

  // 모든 ABC 코드 출력 (난이도 → 박자 → 조성 순 정렬)
  const sorted = [...results].sort((a, b) => {
    const da = ALL_DIFFICULTIES.indexOf(a.testCase.difficulty);
    const db = ALL_DIFFICULTIES.indexOf(b.testCase.difficulty);
    if (da !== db) return da - db;
    const ta = TIME_SIGNATURES.indexOf(a.testCase.timeSignature);
    const tb = TIME_SIGNATURES.indexOf(b.testCase.timeSignature);
    if (ta !== tb) return ta - tb;
    return a.testCase.keySignature.localeCompare(b.testCase.keySignature);
  });

  for (const r of sorted) {
    const tc = r.testCase;
    const status = r.validation.pass ? 'PASS' : 'FAIL';
    const grandLabel = tc.useGrandStaff ? ` | 큰보표: ${BASS_LABELS[tc.bassDifficulty!]}` : '';
    lines.push(`── [${status}] ${tc.id}: ${tc.timeSignature} | ${tc.keySignature} | ${DIFF_LABELS[tc.difficulty]} | ${tc.measures}마디${grandLabel} ──`);
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
        grandStaff: r.testCase.useGrandStaff,
        bassDifficulty: r.testCase.bassDifficulty || null,
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

  console.log(`\n🎵 ABC 자동생성 검증 시작 (${cases.length}건)\n`);

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
      console.log(`  FAIL [${tc.id}] ${tc.timeSignature} ${tc.keySignature} ${tc.difficulty} ${tc.measures}m${tc.useGrandStaff ? ' grand' : ''}`);
      for (const e of r.validation.errors) {
        console.log(`    -> ${e}`);
      }
    }

    // 진행률 표시 (100건마다)
    if ((i + 1) % 100 === 0 || i === cases.length - 1) {
      const pct = Math.round(((i + 1) / cases.length) * 100);
      process.stdout.write(`\r  진행: ${i + 1}/${cases.length} (${pct}%) | PASS: ${passCount} | FAIL: ${failCount}`);
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

  // 실패 시 exit code 1
  if (failCount > 0) process.exit(1);
}

main();
