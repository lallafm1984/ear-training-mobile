/**
 * 임시표 맥락 분석 — 1성부/2성부 각 50샘플
 * 임시표 앞뒤 음과 음정 관계를 추출하여 불협화 원인 파악
 *
 * 실행: npx tsx scripts/analyzeAccidentals.ts
 */
import { generateScore, type GeneratorOptions } from '../src/lib/scoreGenerator';
import { noteToMidiWithKey, durationToSixteenths, type ScoreNote } from '../src/lib/scoreUtils';

const SAMPLES = 50;

interface AccContext {
  sampleId: number;
  noteIdx: number;
  bar: number;
  beatPos: string;
  prevPitch: string;
  prevMidi: number;
  accPitch: string;
  accMidi: number;
  accidental: string;
  nextPitch: string;
  nextMidi: number;
  intervalFromPrev: number;  // semitones
  intervalToNext: number;
  resolutionDir: string;     // 해결 방향
  issue: string;
}

function pitchStr(n: ScoreNote): string {
  if (n.pitch === 'rest') return 'rest';
  return `${n.pitch}${n.accidental || ''}${n.octave}`;
}

function analyzeAccidentals(
  label: string,
  opts: GeneratorOptions,
): AccContext[] {
  const contexts: AccContext[] = [];

  for (let s = 0; s < SAMPLES; s++) {
    const score = generateScore(opts);
    const notes = score.trebleNotes;
    const key = opts.keySignature;

    let pos = 0;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const dur = n.tupletNoteDur ?? durationToSixteenths(n.duration);

      if (n.accidental && n.pitch !== 'rest') {
        const bar = Math.floor(pos / 16);
        const beatPos = `${Math.floor((pos % 16) / 4) + 1}박`;

        // 앞뒤 피치음 찾기
        let prev: ScoreNote | null = null;
        for (let j = i - 1; j >= 0; j--) {
          if (notes[j].pitch !== 'rest') { prev = notes[j]; break; }
        }
        let next: ScoreNote | null = null;
        for (let j = i + 1; j < notes.length; j++) {
          if (notes[j].pitch !== 'rest') { next = notes[j]; break; }
        }

        const accMidi = noteToMidiWithKey(n, key);
        const prevMidi = prev ? noteToMidiWithKey(prev, key) : -1;
        const nextMidi = next ? noteToMidiWithKey(next, key) : -1;

        const ivPrev = prevMidi > 0 ? accMidi - prevMidi : 0;
        const ivNext = nextMidi > 0 ? nextMidi - accMidi : 0;

        // 문제 판별
        const issues: string[] = [];
        const absPrev = Math.abs(ivPrev);
        const absNext = Math.abs(ivNext);

        // 삼전음 (6반음)
        if (absPrev === 6) issues.push('삼전음(prev)');
        if (absNext === 6) issues.push('삼전음(next)');
        // 단2도 (1반음) - 불협화
        if (absPrev === 1) issues.push('단2도(prev)');
        if (absNext === 1 && ivNext !== 0) {
          // 반음 해결은 정상 — 방향 확인
        }
        // 장7도 (11반음)
        if (absPrev === 11) issues.push('장7도(prev)');
        if (absNext === 11) issues.push('장7도(next)');
        // 해결 없이 도약 (>3반음)
        if (absNext > 3) issues.push(`해결도약(${absNext}st)`);
        // 큰 도약 진입 (>5반음)
        if (absPrev > 5) issues.push(`큰진입도약(${absPrev}st)`);
        // 같은 방향 연속 (진입·탈출 같은 방향 + 큰 도약)
        if (ivPrev > 0 && ivNext > 0 && absPrev >= 3 && absNext >= 3) issues.push('같은방향연속도약');
        if (ivPrev < 0 && ivNext < 0 && absPrev >= 3 && absNext >= 3) issues.push('같은방향연속도약');

        const resDir = ivNext > 0 ? '상행' : ivNext < 0 ? '하행' : '동음';

        contexts.push({
          sampleId: s + 1,
          noteIdx: i,
          bar: bar + 1,
          beatPos,
          prevPitch: prev ? pitchStr(prev) : '-',
          prevMidi,
          accPitch: pitchStr(n),
          accMidi,
          accidental: n.accidental,
          nextPitch: next ? pitchStr(next) : '-',
          nextMidi,
          intervalFromPrev: ivPrev,
          intervalToNext: ivNext,
          resolutionDir: resDir,
          issue: issues.length > 0 ? issues.join(', ') : '정상',
        });
      }
      pos += dur;
    }
  }
  return contexts;
}

function printReport(label: string, contexts: AccContext[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${label} — 임시표 ${contexts.length}건 (${SAMPLES}샘플)`);
  console.log(`${'═'.repeat(70)}`);

  // 문제 통계
  const issueCount: Record<string, number> = {};
  let problemCount = 0;
  for (const c of contexts) {
    if (c.issue !== '정상') {
      problemCount++;
      for (const iss of c.issue.split(', ')) {
        issueCount[iss] = (issueCount[iss] || 0) + 1;
      }
    }
  }

  console.log(`\n  문제 있는 임시표: ${problemCount}/${contexts.length} (${(problemCount/contexts.length*100).toFixed(1)}%)`);
  console.log(`\n  문제 유형 분포:`);
  const sortedIssues = Object.entries(issueCount).sort((a, b) => b[1] - a[1]);
  for (const [iss, cnt] of sortedIssues) {
    console.log(`    ${iss.padEnd(25)} ${cnt}건 (${(cnt/contexts.length*100).toFixed(1)}%)`);
  }

  // 해결 방향 분포
  const resDist: Record<string, number> = {};
  for (const c of contexts) {
    resDist[c.resolutionDir] = (resDist[c.resolutionDir] || 0) + 1;
  }
  console.log(`\n  해결 방향:`);
  for (const [dir, cnt] of Object.entries(resDist)) {
    console.log(`    ${dir.padEnd(10)} ${cnt}건 (${(cnt/contexts.length*100).toFixed(1)}%)`);
  }

  // 임시표 종류
  const accDist: Record<string, number> = {};
  for (const c of contexts) {
    accDist[c.accidental] = (accDist[c.accidental] || 0) + 1;
  }
  console.log(`\n  임시표 종류:`);
  for (const [acc, cnt] of Object.entries(accDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${acc.padEnd(5)} ${cnt}건 (${(cnt/contexts.length*100).toFixed(1)}%)`);
  }

  // 진입·탈출 음정 분포
  const entryDist: Record<number, number> = {};
  const exitDist: Record<number, number> = {};
  for (const c of contexts) {
    const ae = Math.abs(c.intervalFromPrev);
    const ax = Math.abs(c.intervalToNext);
    entryDist[ae] = (entryDist[ae] || 0) + 1;
    exitDist[ax] = (exitDist[ax] || 0) + 1;
  }
  console.log(`\n  진입 음정 (|prev→acc|):`);
  for (const [st, cnt] of Object.entries(entryDist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`    ${st.padStart(2)}st: ${cnt}건`);
  }
  console.log(`\n  탈출 음정 (|acc→next|):`);
  for (const [st, cnt] of Object.entries(exitDist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`    ${st.padStart(2)}st: ${cnt}건`);
  }

  // 문제 있는 케이스 상세 (최대 20건)
  const problems = contexts.filter(c => c.issue !== '정상');
  if (problems.length > 0) {
    console.log(`\n  ── 문제 케이스 상세 (최대 20건) ──`);
    for (const c of problems.slice(0, 20)) {
      console.log(`    샘플#${c.sampleId} 마디${c.bar} ${c.beatPos}: ${c.prevPitch} → [${c.accPitch}] → ${c.nextPitch}  (${c.intervalFromPrev > 0 ? '+' : ''}${c.intervalFromPrev}st → ${c.intervalToNext > 0 ? '+' : ''}${c.intervalToNext}st)  ⚠ ${c.issue}`);
    }
  }
}

// ── 1성부 ──
const ctx1 = analyzeAccidentals('1성부', {
  keySignature: 'C',
  timeSignature: '4/4',
  difficulty: 'intermediate_2', // level 5
  measures: 8,
  useGrandStaff: false,
});
printReport('1성부 (C장조 4/4 중급2, useGrandStaff=false)', ctx1);

// ── 2성부 ──
const ctx2 = analyzeAccidentals('2성부', {
  keySignature: 'C',
  timeSignature: '4/4',
  difficulty: 'advanced_2', // level 8 — 임시표가 나오는 최소 레벨
  bassDifficulty: 'bass_2',
  measures: 8,
  useGrandStaff: true,
});
printReport('2성부 (C장조 4/4 고급2+bass_2, useGrandStaff=true)', ctx2);

console.log('\n완료.');
