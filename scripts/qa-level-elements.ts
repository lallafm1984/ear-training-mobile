/**
 * QA 스크립트: 각 난이도별 특성 요소가 최소 2마디 이상 나오는지 검증
 *
 * 실행: npx ts-node scripts/qa-level-elements.ts
 */

import { generateScore } from '../src/lib/scoreGenerator';
import { buildGeneratorOptions } from '../src/lib/trackConfig';
import type { ScoreNote } from '../src/lib/scoreUtils';
import { durationToSixteenths, getSixteenthsPerBar } from '../src/lib/scoreUtils';

const TRIALS = 100; // 레벨당 시행 횟수
const MIN_BARS = 2;

// ── 마디별 음표 분리 ──
function splitIntoMeasures(notes: ScoreNote[], sixteenthsPerBar: number): ScoreNote[][] {
  const measures: ScoreNote[][] = [];
  let current: ScoreNote[] = [];
  let pos = 0;
  for (const n of notes) {
    current.push(n);
    pos += n.tupletNoteDur ?? durationToSixteenths(n.duration);
    if (pos >= sixteenthsPerBar) {
      measures.push(current);
      current = [];
      pos -= sixteenthsPerBar;
    }
  }
  if (current.length > 0) measures.push(current);
  return measures;
}

// ── 마디에 해당 요소가 있는지 감지 ──

function hasEighthNote(notes: ScoreNote[]): boolean {
  return notes.some(n => n.pitch !== 'rest' && n.duration === '8');
}

function hasDottedQuarter(notes: ScoreNote[]): boolean {
  // 점4분은 L5+에서 4분+8분 타이로 분할되므로, 실제 '4.' 또는 4분+8분 타이 패턴 감지
  if (notes.some(n => n.duration === '4.')) return true;
  for (let i = 0; i < notes.length - 1; i++) {
    if (notes[i].tie && notes[i].duration === '4' && notes[i + 1].duration === '8' &&
        notes[i].pitch === notes[i + 1].pitch && notes[i].octave === notes[i + 1].octave) {
      return true;
    }
  }
  return false;
}

function hasSyncopation(notes: ScoreNote[], sixteenthsPerBar: number): boolean {
  const beatSize = 4; // 4/4 기준
  let pos = 0;
  const durations: { pos: number; dur16: number; isRest: boolean; tie: boolean }[] = [];
  for (const n of notes) {
    const dur16 = n.tupletNoteDur ?? durationToSixteenths(n.duration);
    durations.push({ pos, dur16, isRest: n.pitch === 'rest', tie: !!n.tie });
    pos += dur16;
  }
  for (let i = 0; i < durations.length; i++) {
    const d = durations[i];
    // 패턴 A: 강박에 8분쉼표
    if (d.pos > 0 && d.pos % beatSize === 0 && d.isRest && d.dur16 === 2) return true;
    // 패턴 B: 약박→강박 타이
    if (d.tie && d.pos % beatSize !== 0) {
      const nextBeat = Math.ceil((d.pos + 1) / beatSize) * beatSize;
      if (d.pos + d.dur16 >= nextBeat) return true;
    }
    // 패턴 C: 8분+4분+8분 (정박에서 시작, 엇박에 4분)
    if (i + 2 < durations.length && d.pos % beatSize === 0 && d.dur16 === 2) {
      const next = durations[i + 1];
      const next2 = durations[i + 2];
      if (next.dur16 === 4 && next2.dur16 === 2 && !next.isRest) return true;
    }
  }
  return false;
}

function hasTie(notes: ScoreNote[]): boolean {
  return notes.some(n => n.tie === true && n.pitch !== 'rest');
}

function hasSixteenthNote(notes: ScoreNote[]): boolean {
  return notes.some(n => n.pitch !== 'rest' && n.duration === '16');
}

function hasDottedEighth(notes: ScoreNote[]): boolean {
  return notes.some(n => n.pitch !== 'rest' && (n.duration === '8.' ||
    // 점8분이 타이로 분할된 경우: 8분+16분 타이
    (n.tie && n.duration === '8')));
}

function hasTriplet(notes: ScoreNote[]): boolean {
  return notes.some(n => n.tuplet === '3');
}

function hasAccidental(notes: ScoreNote[]): boolean {
  return notes.some(n => n.accidental === '#' || n.accidental === 'b' || n.accidental === 'n');
}

// ── 레벨별 감지 함수 매핑 ──
type DetectorFn = (notes: ScoreNote[], sixteenthsPerBar: number) => boolean;

const LEVEL_DETECTORS: Record<number, { name: string; detect: DetectorFn }> = {
  1: { name: '2분/4분 (기본)', detect: () => true }, // 기본 요소, 항상 통과
  2: { name: '8분음표', detect: (n) => hasEighthNote(n) },
  3: { name: '점4분음표', detect: (n) => hasDottedQuarter(n) },
  4: { name: '당김음', detect: (n, s) => hasSyncopation(n, s) },
  5: { name: '붙임줄', detect: (n) => hasTie(n) },
  6: { name: '16분음표', detect: (n) => hasSixteenthNote(n) },
  7: { name: '점8분음표', detect: (n) => hasDottedEighth(n) },
  8: { name: '셋잇단음표', detect: (n) => hasTriplet(n) },
  9: { name: '임시표', detect: (n) => hasAccidental(n) },
};

// ── 메인 ──
function run() {
  console.log(`\n=== 난이도별 특성 요소 QA (${TRIALS}회 시행, 최소 ${MIN_BARS}마디) ===\n`);

  let totalPass = 0;
  let totalFail = 0;

  for (let level = 1; level <= 9; level++) {
    const { name, detect } = LEVEL_DETECTORS[level];
    let passCount = 0;
    let failCount = 0;
    const failDetails: string[] = [];

    for (let trial = 0; trial < TRIALS; trial++) {
      try {
        const trackOpts = buildGeneratorOptions('partPractice', level);
        const result = generateScore({
          keySignature: trackOpts.keySignature,
          timeSignature: trackOpts.timeSignature,
          difficulty: trackOpts.difficulty,
          measures: trackOpts.measures,
          useGrandStaff: false,
          practiceMode: 'part' as const,
          partPracticeLevel: level,
        });

        const sixteenthsPerBar = getSixteenthsPerBar(trackOpts.timeSignature);
        const measures = splitIntoMeasures(result.trebleNotes, sixteenthsPerBar);

        // 종지 마디 제외
        const melodyMeasures = measures.slice(0, -1);

        let barsWithElement = 0;
        for (const m of melodyMeasures) {
          if (detect(m, sixteenthsPerBar)) barsWithElement++;
        }

        if (barsWithElement >= MIN_BARS || level === 1) {
          passCount++;
        } else {
          failCount++;
          if (failDetails.length < 3) {
            const durStr = melodyMeasures.map((m, i) => {
              const has = detect(m, sixteenthsPerBar);
              const notes = m.map(n => {
                let s = n.pitch === 'rest' ? 'r' : `${n.pitch}${n.octave}`;
                s += n.duration;
                if (n.accidental) s = n.accidental + s;
                if (n.tie) s += '-';
                if (n.tuplet) s += `(${n.tuplet})`;
                return s;
              }).join(' ');
              return `  M${i + 1}${has ? '✓' : '✗'}: [${notes}]`;
            }).join('\n');
            failDetails.push(`  Trial ${trial + 1}: ${barsWithElement}/${melodyMeasures.length}마디\n${durStr}`);
          }
        }
      } catch (e: any) {
        failCount++;
        if (failDetails.length < 3) {
          failDetails.push(`  Trial ${trial + 1}: ERROR - ${e.message}`);
        }
      }
    }

    const rate = ((passCount / TRIALS) * 100).toFixed(1);
    const status = failCount === 0 ? '✅ PASS' : `❌ FAIL (${failCount}/${TRIALS})`;
    console.log(`L${level} [${name}]: ${status} — 성공률 ${rate}%`);
    if (failDetails.length > 0) {
      console.log(failDetails.join('\n'));
    }

    totalPass += passCount;
    totalFail += failCount;
  }

  console.log(`\n=== 총 결과: ${totalPass} pass / ${totalFail} fail ===\n`);
  process.exit(totalFail > 0 ? 1 : 0);
}

run();
