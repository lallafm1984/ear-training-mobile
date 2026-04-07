import { generateScore } from '../src/lib/scoreGenerator';
import { buildGeneratorOptions } from '../src/lib/trackConfig';
import type { ScoreNote } from '../src/lib/scoreUtils';
import { durationToSixteenths } from '../src/lib/scoreUtils';

const N = 500;

function noteStr(n: ScoreNote): string {
  let s = n.pitch === "rest" ? "r" : n.pitch + String(n.octave ?? "");
  if (n.accidental) s = n.accidental + s;
  s += n.duration;
  if (n.tie) s += "~";
  if (n.tuplet) s += "[" + n.tuplet + "]";
  return s;
}

function detectSyncopation(notes: ScoreNote[]): boolean {
  const bs = 4; let pos = 0;
  const it: { pos: number; d: number; r: boolean; t: boolean }[] = [];
  for (const n of notes) {
    const d = n.tupletNoteDur ?? durationToSixteenths(n.duration);
    it.push({ pos, d, r: n.pitch === "rest", t: !!n.tie }); pos += d;
  }
  for (let i = 0; i < it.length; i++) {
    const x = it[i];
    if (x.pos > 0 && x.pos % bs === 0 && x.r && x.d === 2) return true;
    if (x.t && x.pos % bs !== 0) { const nb = Math.ceil((x.pos+1)/bs)*bs; if (x.pos+x.d >= nb) return true; }
    if (i+2 < it.length && x.pos % bs === 0 && x.d === 2) { const a=it[i+1],b=it[i+2]; if (a.d===4&&b.d===2&&!a.r) return true; }
  }
  return false;
}

// L5 deep analysis
console.log("\n=== L5 (intermediate_2: tie) DEEP ANALYSIS N=" + N + " ===");
let l5pass=0, l5fail=0;
const l5failSamples: string[] = [];
const l5noteTieCount: number[] = [];
const l5noTiePatterns: string[] = [];

for (let t = 0; t < N; t++) {
  const to = buildGeneratorOptions("partPractice", 5);
  const r = generateScore({ keySignature: to.keySignature, timeSignature: to.timeSignature, difficulty: to.difficulty, measures: to.measures, useGrandStaff: false, practiceMode: "part", partPracticeLevel: 5 });
  const notes = r.trebleNotes;
  const tieNotes = notes.filter(n => n.tie === true && n.pitch !== "rest");
  l5noteTieCount.push(tieNotes.length);
  if (tieNotes.length === 0) {
    l5fail++;
    if (l5failSamples.length < 3) l5failSamples.push("Trial" + (t+1) + ": " + notes.slice(0,20).map(noteStr).join(" "));
  } else { l5pass++; }
}

const l5avg = l5noteTieCount.reduce((a,b)=>a+b,0)/N;
const l5zeros = l5noteTieCount.filter(x=>x===0).length;
const l5ones  = l5noteTieCount.filter(x=>x===1).length;
const l5twos  = l5noteTieCount.filter(x=>x>=2).length;
console.log("Pass: " + l5pass + "/" + N + " (" + (l5pass/N*100).toFixed(1) + "%)");
console.log("Fail (0 ties): " + l5fail + "/" + N + " (" + (l5fail/N*100).toFixed(1) + "%)");
console.log("Avg tie-notes per score: " + l5avg.toFixed(2));
console.log("Dist: 0=" + l5zeros + " 1=" + l5ones + " >=2=" + l5twos);
if (l5failSamples.length > 0) { console.log("Fail samples:"); l5failSamples.forEach(s => console.log("  " + s)); }

// L9 deep analysis
console.log("\n=== L9 (advanced_3: accidental) DEEP ANALYSIS N=" + N + " ===");
let l9pass=0, l9fail=0, l9acc0=0, l9acc1=0, l9acc2plus=0;
const l9failSamples: string[] = [];
const l9accCounts: number[] = [];

for (let t = 0; t < N; t++) {
  const to = buildGeneratorOptions("partPractice", 9);
  const r = generateScore({ keySignature: to.keySignature, timeSignature: to.timeSignature, difficulty: to.difficulty, measures: to.measures, useGrandStaff: false, practiceMode: "part", partPracticeLevel: 9 });
  const notes = r.trebleNotes;
  const accNotes = notes.filter(n => n.accidental === "#" || n.accidental === "b" || n.accidental === "n");
  const ac = accNotes.length;
  l9accCounts.push(ac);
  if (ac < 2) {
    l9fail++;
    if (l9failSamples.length < 5) l9failSamples.push("Trial" + (t+1) + " acc=" + ac + ": " + notes.slice(0,20).map(noteStr).join(" "));
    if (ac === 0) l9acc0++;
    else l9acc1++;
  } else { l9pass++; if (ac >= 2) l9acc2plus++; }
}

const l9avg = l9accCounts.reduce((a,b)=>a+b,0)/N;
console.log("Pass (acc>=2): " + l9pass + "/" + N + " (" + (l9pass/N*100).toFixed(1) + "%)");
console.log("Fail: " + l9fail + "/" + N + " (" + (l9fail/N*100).toFixed(1) + "%)");
console.log("  acc=0: " + l9acc0 + "  acc=1: " + l9acc1);
console.log("Avg accidentals per score: " + l9avg.toFixed(2));
console.log("Acc count distribution: " + [...new Set(l9accCounts)].sort((a,b)=>a-b).map(v => v+"="+l9accCounts.filter(x=>x===v).length).join("  "));
if (l9failSamples.length > 0) { console.log("Fail samples:"); l9failSamples.forEach(s => console.log("  " + s)); }
