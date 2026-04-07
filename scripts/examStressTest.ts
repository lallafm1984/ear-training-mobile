// ─────────────────────────────────────────────────────────────
// 모의시험 스트레스 테스트 — 각 프리셋 100회 문제 생성 분석
// 실행: npx tsx scripts/examStressTest.ts
// ─────────────────────────────────────────────────────────────

import { EXAM_PRESETS } from '../src/lib/examPresets';
import { generateChoiceQuestion, type ChoiceQuestion } from '../src/lib/questionGenerator';
import { generateAbc } from '../src/lib/scoreUtils/abc';
import { generatePracticeScore, type PracticeScore } from '../src/lib/practiceScoreGenerator';
import type { ExamPreset, ExamSection } from '../src/types/exam';
import type { ContentCategory, ContentDifficulty } from '../src/types/content';

const ITERATIONS = 100;

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

interface QuestionResult {
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  isChoice: boolean;
  // 객관식
  correctAnswer?: string;
  choices?: string[];
  abcLength?: number;
  // 기보형
  noteCount?: number;
  bassNoteCount?: number;
  abcNotation?: string;
  // 에러
  error?: string;
}

interface SectionStats {
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  totalGenerated: number;
  errors: string[];
  // 객관식 분석
  answerDistribution: Record<string, number>;
  choiceCountDistribution: Record<number, number>;
  abcLengths: number[];
  emptyAbcCount: number;
  // 기보형 분석
  noteCounts: number[];
  bassNoteCounts: number[];
  emptyNoteCount: number;
  // 중복 분석
  duplicateAnswers: number; // 연속 동일 정답
  duplicateAbcCount: number; // 동일 ABC 문자열
}

interface PresetReport {
  presetId: string;
  presetName: string;
  iterations: number;
  totalQuestions: number;
  totalErrors: number;
  sectionStats: SectionStats[];
  issues: string[];
}

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

function initSectionStats(section: ExamSection): SectionStats {
  return {
    contentType: section.contentType,
    difficulty: section.difficulty,
    totalGenerated: 0,
    errors: [],
    answerDistribution: {},
    choiceCountDistribution: {},
    abcLengths: [],
    emptyAbcCount: 0,
    noteCounts: [],
    bassNoteCounts: [],
    emptyNoteCount: 0,
    duplicateAnswers: 0,
    duplicateAbcCount: 0,
  };
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function min(arr: number[]): number {
  return arr.length > 0 ? Math.min(...arr) : 0;
}

function max(arr: number[]): number {
  return arr.length > 0 ? Math.max(...arr) : 0;
}

// ─────────────────────────────────────────────────────────────
// 단일 프리셋 테스트
// ─────────────────────────────────────────────────────────────

function testPreset(preset: ExamPreset): PresetReport {
  const issues: string[] = [];
  const sectionStatsMap: Map<string, SectionStats> = new Map();

  // 섹션별 통계 초기화
  preset.sections.forEach((section, sIdx) => {
    const key = `${sIdx}_${section.contentType}_${section.difficulty}`;
    sectionStatsMap.set(key, initSectionStats(section));
  });

  let totalErrors = 0;
  const totalQuestionsPerIter = preset.sections.reduce((s, sec) => s + sec.questionCount, 0);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    preset.sections.forEach((section, sIdx) => {
      const key = `${sIdx}_${section.contentType}_${section.difficulty}`;
      const stats = sectionStatsMap.get(key)!;
      const isChoice = ['interval', 'chord', 'key'].includes(section.contentType);

      const prevAnswers: string[] = [];
      const prevAbcs: string[] = [];

      for (let q = 0; q < section.questionCount; q++) {
        stats.totalGenerated++;

        try {
          if (isChoice) {
            const cq = generateChoiceQuestion(section.contentType, section.difficulty);

            // 정답 분포
            stats.answerDistribution[cq.correctAnswer] = (stats.answerDistribution[cq.correctAnswer] || 0) + 1;

            // 보기 수 분포
            const cc = cq.choices.length;
            stats.choiceCountDistribution[cc] = (stats.choiceCountDistribution[cc] || 0) + 1;

            // ABC 길이
            const abcLen = cq.abcNotation.length;
            stats.abcLengths.push(abcLen);
            if (abcLen === 0) stats.emptyAbcCount++;

            // 중복 체크
            if (prevAnswers.length > 0 && prevAnswers[prevAnswers.length - 1] === cq.correctAnswer) {
              stats.duplicateAnswers++;
            }
            if (prevAbcs.length > 0 && prevAbcs[prevAbcs.length - 1] === cq.abcNotation) {
              stats.duplicateAbcCount++;
            }

            prevAnswers.push(cq.correctAnswer);
            prevAbcs.push(cq.abcNotation);

            // 보기에 정답 포함 여부 검증
            if (!cq.choices.includes(cq.correctAnswer)) {
              stats.errors.push(`[iter ${iter}] 보기에 정답 "${cq.correctAnswer}" 없음`);
              totalErrors++;
            }

            // 중복 보기 검증
            const uniqueChoices = new Set(cq.choices);
            if (uniqueChoices.size !== cq.choices.length) {
              stats.errors.push(`[iter ${iter}] 중복 보기 발견: ${JSON.stringify(cq.choices)}`);
              totalErrors++;
            }
          } else {
            // 기보형 문항
            const score = generatePracticeScore(section.contentType, section.difficulty);
            const abc = generateAbc({
              title: '',
              keySignature: score.keySignature,
              timeSignature: score.timeSignature,
              tempo: 90,
              notes: score.trebleNotes,
              bassNotes: score.useGrandStaff ? score.bassNotes : undefined,
              useGrandStaff: score.useGrandStaff,
              disableTies: score.disableTies,
            });

            stats.noteCounts.push(score.trebleNotes.length);
            stats.bassNoteCounts.push(score.bassNotes.length);

            if (score.trebleNotes.length === 0) {
              stats.emptyNoteCount++;
              stats.errors.push(`[iter ${iter}] 빈 trebleNotes 생성됨`);
              totalErrors++;
            }

            if (abc.length === 0) {
              stats.emptyAbcCount++;
              stats.errors.push(`[iter ${iter}] 빈 ABC 문자열 생성됨`);
              totalErrors++;
            }

            stats.abcLengths.push(abc.length);

            // 2성부인데 bass가 비어있는지
            if (score.useGrandStaff && score.bassNotes.length === 0) {
              stats.errors.push(`[iter ${iter}] 2성부인데 bassNotes 비어있음`);
              totalErrors++;
            }

            // 중복 ABC 체크
            if (prevAbcs.length > 0 && prevAbcs[prevAbcs.length - 1] === abc) {
              stats.duplicateAbcCount++;
            }
            prevAbcs.push(abc);
          }
        } catch (err: any) {
          stats.errors.push(`[iter ${iter}] 생성 에러: ${err.message}`);
          totalErrors++;
        }
      }
    });
  }

  // ── 분석 & 이슈 도출 ──
  for (const [key, stats] of sectionStatsMap) {
    const label = `${stats.contentType}(${stats.difficulty})`;
    const isChoice = ['interval', 'chord', 'key'].includes(stats.contentType);

    // 에러율
    if (stats.errors.length > 0) {
      const errorRate = (stats.errors.length / stats.totalGenerated * 100).toFixed(1);
      issues.push(`[에러] ${label}: ${stats.errors.length}건 에러 (${errorRate}%) — ${stats.errors.slice(0, 3).join('; ')}`);
    }

    // 빈 ABC
    if (stats.emptyAbcCount > 0) {
      issues.push(`[치명] ${label}: 빈 ABC ${stats.emptyAbcCount}건 — 재생 불가`);
    }

    // 빈 노트
    if (stats.emptyNoteCount > 0) {
      issues.push(`[치명] ${label}: 빈 노트 ${stats.emptyNoteCount}건`);
    }

    if (isChoice) {
      // 정답 편중
      const answers = Object.entries(stats.answerDistribution);
      const totalAnswers = answers.reduce((s, [, c]) => s + c, 0);
      const maxFreq = Math.max(...answers.map(([, c]) => c));
      const maxAnswer = answers.find(([, c]) => c === maxFreq)?.[0];
      const maxPct = (maxFreq / totalAnswers * 100).toFixed(1);
      const uniqueAnswerCount = answers.length;

      if (parseFloat(maxPct) > 40 && uniqueAnswerCount > 2) {
        issues.push(`[편중] ${label}: "${maxAnswer}" ${maxPct}% 출현 (${uniqueAnswerCount}개 정답 중)`);
      }

      // 정답 다양성 부족
      if (isChoice && uniqueAnswerCount <= 2 && stats.contentType !== 'key') {
        issues.push(`[다양성] ${label}: 정답 종류가 ${uniqueAnswerCount}개뿐 — 문제 다양성 부족`);
      }

      // 연속 동일 정답
      const dupRate = (stats.duplicateAnswers / stats.totalGenerated * 100).toFixed(1);
      if (parseFloat(dupRate) > 30) {
        issues.push(`[연속중복] ${label}: 연속 동일 정답 ${dupRate}%`);
      }

      // 보기 수 이상
      for (const [cnt, freq] of Object.entries(stats.choiceCountDistribution)) {
        if (parseInt(cnt) < 2) {
          issues.push(`[보기부족] ${label}: 보기 ${cnt}개 문항 ${freq}건`);
        }
      }
    } else {
      // 노트 수 분석
      const avgNotes = avg(stats.noteCounts).toFixed(1);
      const minNotes = min(stats.noteCounts);
      const maxNotes = max(stats.noteCounts);

      if (minNotes < 4) {
        issues.push(`[노트부족] ${label}: 최소 노트 수 ${minNotes}개 — 너무 짧을 수 있음`);
      }

      // ABC 중복률
      const dupAbcRate = (stats.duplicateAbcCount / stats.totalGenerated * 100).toFixed(1);
      if (parseFloat(dupAbcRate) > 10) {
        issues.push(`[ABC중복] ${label}: 연속 동일 ABC ${dupAbcRate}%`);
      }
    }
  }

  return {
    presetId: preset.id,
    presetName: preset.name,
    iterations: ITERATIONS,
    totalQuestions: totalQuestionsPerIter * ITERATIONS,
    totalErrors,
    sectionStats: Array.from(sectionStatsMap.values()),
    issues,
  };
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  모의시험 스트레스 테스트 — 각 프리셋 100회');
  console.log('═══════════════════════════════════════════════════════════\n');

  const allIssues: string[] = [];

  for (const preset of EXAM_PRESETS) {
    console.log(`\n▶ 테스트 중: ${preset.name} (${preset.id})`);
    console.log(`  섹션: ${preset.sections.map(s => `${s.contentType}(${s.difficulty})×${s.questionCount}`).join(', ')}`);

    const startTime = Date.now();
    const report = testPreset(preset);
    const elapsed = Date.now() - startTime;

    console.log(`  소요: ${elapsed}ms | 총 문항: ${report.totalQuestions} | 에러: ${report.totalErrors}`);

    // 섹션별 상세
    for (const stats of report.sectionStats) {
      const label = `${stats.contentType}(${stats.difficulty})`;
      const isChoice = ['interval', 'chord', 'key'].includes(stats.contentType);

      if (isChoice) {
        const answers = Object.entries(stats.answerDistribution)
          .sort(([, a], [, b]) => b - a);
        const top5 = answers.slice(0, 5).map(([k, v]) => `${k}:${v}`).join(', ');
        const uniqueCount = answers.length;
        const avgAbc = avg(stats.abcLengths).toFixed(0);
        console.log(`  📊 ${label}: 정답 ${uniqueCount}종류 | ABC평균=${avgAbc}자 | 빈ABC=${stats.emptyAbcCount} | 중복정답=${stats.duplicateAnswers}`);
        console.log(`     상위5: ${top5}`);

        // 보기 수 분포
        const choiceDist = Object.entries(stats.choiceCountDistribution)
          .map(([k, v]) => `${k}개:${v}건`).join(', ');
        console.log(`     보기수: ${choiceDist}`);
      } else {
        const avgN = avg(stats.noteCounts).toFixed(1);
        const minN = min(stats.noteCounts);
        const maxN = max(stats.noteCounts);
        const avgAbc = avg(stats.abcLengths).toFixed(0);
        const avgBass = avg(stats.bassNoteCounts).toFixed(1);
        console.log(`  🎵 ${label}: 노트=${minN}~${maxN}(avg ${avgN}) | bass avg=${avgBass} | ABC평균=${avgAbc}자 | 빈ABC=${stats.emptyAbcCount}`);
      }
    }

    // 이슈
    if (report.issues.length > 0) {
      console.log(`\n  ⚠️ 발견된 이슈 (${report.issues.length}건):`);
      report.issues.forEach(i => console.log(`    ${i}`));
      allIssues.push(...report.issues.map(i => `[${preset.name}] ${i}`));
    } else {
      console.log(`  ✅ 이슈 없음`);
    }
  }

  // ── 종합 요약 ──
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  종합 이슈 요약');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (allIssues.length === 0) {
    console.log('✅ 모든 프리셋에서 이슈가 발견되지 않았습니다.');
  } else {
    const critical = allIssues.filter(i => i.includes('[치명]'));
    const biased = allIssues.filter(i => i.includes('[편중]'));
    const errors = allIssues.filter(i => i.includes('[에러]'));
    const diversity = allIssues.filter(i => i.includes('[다양성]'));
    const duplicates = allIssues.filter(i => i.includes('[연속중복]') || i.includes('[ABC중복]'));
    const choiceIssues = allIssues.filter(i => i.includes('[보기부족]'));
    const noteIssues = allIssues.filter(i => i.includes('[노트부족]'));

    if (critical.length > 0) {
      console.log(`🔴 치명적 이슈 (${critical.length}건):`);
      critical.forEach(i => console.log(`  ${i}`));
    }
    if (errors.length > 0) {
      console.log(`\n🟠 에러 (${errors.length}건):`);
      errors.forEach(i => console.log(`  ${i}`));
    }
    if (biased.length > 0) {
      console.log(`\n🟡 정답 편중 (${biased.length}건):`);
      biased.forEach(i => console.log(`  ${i}`));
    }
    if (diversity.length > 0) {
      console.log(`\n🟡 다양성 부족 (${diversity.length}건):`);
      diversity.forEach(i => console.log(`  ${i}`));
    }
    if (duplicates.length > 0) {
      console.log(`\n🟡 중복 (${duplicates.length}건):`);
      duplicates.forEach(i => console.log(`  ${i}`));
    }
    if (choiceIssues.length > 0) {
      console.log(`\n🟡 보기 부족 (${choiceIssues.length}건):`);
      choiceIssues.forEach(i => console.log(`  ${i}`));
    }
    if (noteIssues.length > 0) {
      console.log(`\n🟡 노트 부족 (${noteIssues.length}건):`);
      noteIssues.forEach(i => console.log(`  ${i}`));
    }

    console.log(`\n총 ${allIssues.length}건의 이슈 발견`);
  }
}

main();
