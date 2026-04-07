/** QA script: melody difficulty verification
 * Run: npx ts-node scripts/qa-melody-difficulty.ts
 */

import { generateScore } from '../src/lib/scoreGenerator';
import { buildGeneratorOptions } from '../src/lib/trackConfig';
import type { ScoreNote } from '../src/lib/scoreUtils';
import { durationToSixteenths } from '../src/lib/scoreUtils';
function melodyDifficultyToLevel(difficulty: string): number {
  const map: Record<string, number> = {
    beginner_1: 1, beginner_2: 2, beginner_3: 3,
    intermediate_1: 4, intermediate_2: 5, intermediate_3: 6,
    advanced_1: 7, advanced_2: 8, advanced_3: 9,
  };
  return map[difficulty] ?? 1;
}

const DIFFICULTIES = ['beginner_1','beginner_2','beginner_3','intermediate_1','intermediate_2','intermediate_3','advanced_1','advanced_2','advanced_3'] as const;

const N = 100;

function noteStr(n: ScoreNote): string {
  let s = n.pitch === 'rest' ? 'r' : n.pitch + String(n.octave ?? '');
  if (n.accidental) s = n.accidental + s;
  s += n.duration;
  if (n.tie) s += '~';
  if (n.tuplet) s += '[' + n.tuplet + ']';
  return s;
}
function detectSyncopation(notes: ScoreNote[]): boolean {
  const beatSize = 4; let pos = 0;
  const items: { pos: number; dur16: number; isRest: boolean; tie: boolean }[] = [];
  for (const n of notes) {
    const dur16 = n.tupletNoteDur ?? durationToSixteenths(n.duration);
    items.push({ pos, dur16, isRest: n.pitch === "rest", tie: !!n.tie });
    pos += dur16;
  }
  for (let i = 0; i < items.length; i++) {
    const d = items[i];
    if (d.pos > 0 && d.pos % beatSize === 0 && d.isRest && d.dur16 === 2) return true;
    if (d.tie && d.pos % beatSize !== 0) {
      const nextBeat = Math.ceil((d.pos + 1) / beatSize) * beatSize;
      if (d.pos + d.dur16 >= nextBeat) return true;
    }
    if (i + 2 < items.length && d.pos % beatSize === 0 && d.dur16 === 2) {
      const next = items[i + 1]; const next2 = items[i + 2];
      if (next.dur16 === 4 && next2.dur16 === 2 && !next.isRest) return true;
    }
  }
  return false;
}

interface QAResult { pass: boolean; issues: string[]; stats: Record<string, number | boolean>; }

function checkLevel(diff: string, notes: ScoreNote[]): QAResult {
  const lv = melodyDifficultyToLevel(diff);
  const iss: string[] = [];
  const nr = notes.filter(n => n.pitch !== "rest");
  const tri = notes.some(n => n.tuplet === "3");
  const tie = notes.some(n => n.tie === true && n.pitch !== "rest");
  const acc = notes.filter(n => n.accidental === "#" || n.accidental === "b" || n.accidental === "n").length;
  const d4  = notes.some(n => n.duration === "4.");
  const d4t = d4 || notes.some((n, i) => n.tie && n.duration === "4" && i + 1 < notes.length && notes[i+1].duration === "8" && n.pitch === notes[i+1].pitch);
  const d8  = nr.some(n => n.duration === "8." || (n.tie && n.duration === "8"));
  const s16 = nr.some(n => n.duration === "16");
  const s8  = nr.some(n => n.duration === "8" && !n.tuplet);
  const fn  = notes.find(n => n.pitch !== "rest");
  const st: Record<string, number | boolean> = { totalNotes: notes.length, nonRest: nr.length, tri, tie, acc, d4t, d8, s16, s8 };
  if (lv === 1) { if (s8) iss.push("L1-FORBIDDEN-8th"); if (tri) iss.push("L1-FORBIDDEN-triplet"); if (tie) iss.push("L1-FORBIDDEN-tie"); if (d4) iss.push("L1-FORBIDDEN-dotted4"); if (s16) iss.push("L1-FORBIDDEN-16th"); if (acc > 0) iss.push("L1-FORBIDDEN-accidental:" + acc); }
  if (lv === 2) { if (!s8) iss.push("L2-MISSING-8th"); if (tri) iss.push("L2-FORBIDDEN-triplet"); if (tie) iss.push("L2-FORBIDDEN-tie"); if (d4) iss.push("L2-FORBIDDEN-dotted4"); if (s16) iss.push("L2-FORBIDDEN-16th"); if (acc > 0) iss.push("L2-FORBIDDEN-accidental:" + acc); }
  if (lv === 3) { if (!d4t) iss.push("L3-MISSING-dotted4"); if (tri) iss.push("L3-FORBIDDEN-triplet"); if (acc > 0) iss.push("L3-FORBIDDEN-accidental:" + acc); }
  if (lv === 4) { const syn = detectSyncopation(notes); st.syn = syn; if (!syn) iss.push("L4-MISSING-syncopation"); if (tri) iss.push("L4-FORBIDDEN-triplet"); if (acc > 0) iss.push("L4-FORBIDDEN-accidental:" + acc); }
  if (lv === 5) { if (!tie) iss.push("L5-MISSING-tie"); if (tri) iss.push("L5-FORBIDDEN-triplet"); if (acc > 0) iss.push("L5-FORBIDDEN-accidental:" + acc); }
  if (lv === 6) { if (!s16) iss.push("L6-MISSING-16th"); if (tri) iss.push("L6-FORBIDDEN-triplet"); if (acc > 0) iss.push("L6-FORBIDDEN-accidental:" + acc); }
  if (lv === 7) { if (!d8) iss.push("L7-MISSING-dotted8"); if (tri) iss.push("L7-FORBIDDEN-triplet"); if (acc > 0) iss.push("L7-FORBIDDEN-accidental:" + acc); }
  if (lv === 8) { if (!tri) iss.push("L8-MISSING-triplet"); if (fn?.tuplet) iss.push("L8-VIOLATION-firstNoteTriplet"); if (acc > 0) iss.push("L8-FORBIDDEN-accidental:" + acc); }
  if (lv === 9) { if (acc < 2) iss.push("L9-MISSING-accidental:" + acc + "(need>=2)"); if (tri) iss.push("L9-FORBIDDEN-triplet"); }
  return { pass: iss.length === 0, issues: iss, stats: st };
}

interface FD { trial: number; issues: string[]; notes: string; stats: Record<string, number | boolean>; }

function run(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  const ts2 = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rl: string[] = [], sr: string[] = [];
  let tp = 0, tf = 0;
  const cl: number[] = [];

  console.log("\n=== Melody Difficulty QA (N=" + N + ") ===\n");
  rl.push("# Melody Difficulty QA Report");
  rl.push("Trials: " + N + "/level  Total: " + N * 9);
  rl.push("");

  for (const diff of DIFFICULTIES) {
    const lv = melodyDifficultyToLevel(diff);
    let pc = 0, fc = 0;
    const fds: FD[] = [];
    const ic: Record<string, number> = {};

    for (let t = 0; t < N; t++) {
      try {
        const to = buildGeneratorOptions("partPractice", lv);
        const r = generateScore({
          keySignature: to.keySignature, timeSignature: to.timeSignature,
          difficulty: to.difficulty, measures: to.measures,
          useGrandStaff: false, practiceMode: "part", partPracticeLevel: lv,
        });
        const qa = checkLevel(diff, r.trebleNotes);
        if (qa.pass) { pc++; } else {
          fc++;
          for (const i of qa.issues) ic[i] = (ic[i] ?? 0) + 1;
          if (fds.length < 5) fds.push({ trial: t + 1, issues: qa.issues, notes: r.trebleNotes.slice(0, 20).map(noteStr).join(" "), stats: qa.stats });
        }
      } catch (e: unknown) {
        fc++;
        const m = e instanceof Error ? e.message : String(e);
        const em = "ERR:" + m.slice(0, 60);
        ic[em] = (ic[em] ?? 0) + 1;
        if (fds.length < 5) fds.push({ trial: t + 1, issues: [em], notes: "", stats: {} });
      }
    }

    const pr = (pc / N * 100).toFixed(1);
    const crit = fc / N >= 0.10;
    const tag = fc === 0 ? "PASS" : crit ? "CRITICAL" : "WARN";
    tp += pc; tf += fc; if (crit) cl.push(lv);

    console.log("[" + tag + "] L" + lv + " " + diff + " -> " + pr + "% (" + pc + "/" + N + ")");
    sr.push("| L" + lv + " | " + diff + " | " + pr + "% | " + fc + " | " + tag + " |");
    rl.push("## L" + lv + ": " + diff);
    rl.push("- PassRate: **" + pr + "%** (" + pc + "/" + N + ")  Fail: " + fc);

    if (fc > 0) {
      rl.push(""); rl.push("### Failure Patterns");
      for (const [iss, cnt] of Object.entries(ic).sort((a, b) => b[1] - a[1])) {
        const pct = (cnt / N * 100).toFixed(1);
        console.log("  [" + cnt + "/" + pct + "%] " + iss);
        rl.push("- " + iss + ": " + cnt + " (" + pct + "%)");
      }
      if (fds.length > 0) {
        rl.push(""); rl.push("### Sample Failures (up to 3)");
        for (const fd of fds.slice(0, 3)) {
          rl.push("- Trial " + fd.trial + ": " + fd.issues.join(" | "));
          rl.push("  notes: " + fd.notes);
          const sk = ["tri","tie","acc","d4t","d8","s16","s8","syn"];
          rl.push("  stats: " + sk.filter(k => fd.stats[k] !== undefined).map(k => k + "=" + fd.stats[k]).join(" "));
        }
      }
    }
    rl.push("");
  }

  const or = (tp / (N * 9) * 100).toFixed(1);
  console.log("-".repeat(60));
  console.log("TOTAL: " + tp + " PASS / " + tf + " FAIL (" + or + "%)");
  if (cl.length > 0) console.log("[!] CRITICAL (>=10% fail): L" + cl.join(", L"));

  const sb = ["## Summary", "",
    "| Level | Difficulty | PassRate | Fail | Status |",
    "|-------|------------|----------|------|--------|",
    ...sr, "",
    "TOTAL: " + tp + " PASS / " + tf + " FAIL (" + or + "%)", "",
  ];
  rl.splice(3, 0, ...sb);

  const rp = "D:/Projects/YulProject_1/ear-training-mobile/.omc/scientist/reports/" + ts2 + "_qa-melody-difficulty.md";
  fs.writeFileSync(rp, rl.join("\n"), "utf-8");
  console.log("[REPORT] " + rp);
  process.exit(tf > 0 ? 1 : 0);
}

run();
