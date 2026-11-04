/**
 * 콘텐츠 QA 규칙 테스트 — 청음 시험 출제 관행 기준
 *
 * 2026-11 콘텐츠 QA에서 발견·수정한 문제가 재발하지 않도록 생성 결과를 규칙으로 고정한다.
 *  · 선율/2성부: 삼전음·증2도·7도·9도 이상 도약 없음(쉼표 건너뛰기 포함), 같은 음 3회 반복 없음,
 *    첫 음은 으뜸3화음 구성음, 마지막 음은 으뜸음, A5 상한, 붙임줄은 같은 음으로만 이어짐
 *  · 리듬: 첫 박 쉼표 없음, 마디 길이 정확, 쉼표 1개 이상, 6/8에서는 셋잇단 대신 둘잇단(L5+), 점쉼표는 복합박자에서만
 *  · 저음 L1: 종지 직전 베이스는 으뜸음이 아니고 종지 도약은 완전5도 이하
 *  · 객관식: 화성진행 화음이 조표 기준 철자로 표기되어 임시표 전달로 다른 화음이 되지 않음,
 *    조성 문제 기준음 A♮·이끔음 ♮ 명시, 음정 문제의 같은 음이름 임시표 전달 방지, 속7·반감7 번역 키
 */
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ko', languageTag: 'ko-KR' }],
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

import { generatePracticeScore } from '../lib/practiceScoreGenerator';
import { generateChoiceQuestion, keySignatureAlterations } from '../lib/questionGenerator';
import { applyFinalSanity, isBadMelodicStep } from '../lib/scoreGenerator/finalSanity';
import { pickCadenceTonicOctave } from '../lib/scoreGenerator/melodyEngine';
import {
  durationToSixteenths,
  getTupletActualSixteenths,
  getSixteenthsPerBar,
  getScaleDegrees,
  noteToMidiWithKey,
  makeNote,
  makeRest,
} from '../lib/scoreUtils';
import type { ScoreNote } from '../lib/scoreUtils';
import koContent from '../i18n/locales/ko/content.json';
import enContent from '../i18n/locales/en/content.json';
import jaContent from '../i18n/locales/ja/content.json';

// ── 공통 헬퍼 ──────────────────────────────────────────────────
// 시간 단위: 틱 = 16분음표 × 3 (셋잇단을 정수로 다루기 위해)
type Ev = { note: ScoreNote; midi: number; start: number; dur: number; onset: boolean };

function expand(notes: ScoreNote[], key: string): Ev[] {
  const evs: Ev[] = [];
  let pos = 0;
  let tRem = 0;
  let tDur = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.tuplet && tRem === 0) {
      const count = parseInt(n.tuplet, 10);
      tDur = Math.round(
        (getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration) * 3) / count,
      );
      tRem = count;
    }
    let dur: number;
    if (tRem > 0) {
      dur = tDur;
      tRem--;
    } else {
      dur = durationToSixteenths(n.duration) * 3;
    }
    const prev = notes[i - 1];
    const tied =
      !!prev &&
      !!prev.tie &&
      prev.pitch === n.pitch &&
      prev.octave === n.octave &&
      prev.accidental === n.accidental;
    evs.push({
      note: n,
      midi: n.pitch === 'rest' ? -1 : noteToMidiWithKey(n, key),
      start: pos,
      dur,
      onset: n.pitch !== 'rest' && !tied,
    });
    pos += dur;
  }
  return evs;
}

function melodicIssues(notes: ScoreNote[], key: string): string[] {
  const issues: string[] = [];
  const ons = expand(notes, key).filter((e) => e.onset);
  const scale = getScaleDegrees(key);
  if (ons.length === 0) return ['noNotes'];
  if (![0, 2, 4].includes(scale.indexOf(ons[0].note.pitch))) issues.push('firstNotChordTone');
  if (scale.indexOf(ons[ons.length - 1].note.pitch) !== 0) issues.push('lastNotTonic');
  let run = 1;
  for (let i = 1; i < ons.length; i++) {
    const a = ons[i - 1];
    const b = ons[i];
    if (isBadMelodicStep(a.note, b.note, a.midi, b.midi)) {
      issues.push(`badLeap:${a.midi}->${b.midi}`);
    }
    run = a.midi === b.midi ? run + 1 : 1;
    if (run === 3) issues.push('repeat3');
  }
  for (const e of ons) if (e.midi > 81) issues.push(`aboveA5:${e.midi}`);
  // 붙임줄: 같은 음으로만 이어짐
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n.tie) continue;
    const m = notes[i + 1];
    if (
      !m ||
      m.pitch !== n.pitch ||
      m.octave !== n.octave ||
      m.accidental !== n.accidental ||
      n.pitch === 'rest'
    ) {
      issues.push('brokenTie');
    }
  }
  return issues;
}

function barIssues(notes: ScoreNote[], ts: string): string[] {
  const issues: string[] = [];
  const barLen = getSixteenthsPerBar(ts) * 3;
  const evs = expand(notes, 'C');
  let total = 0;
  for (const e of evs) {
    if ((e.start % barLen) + e.dur > barLen) issues.push('crossBar');
    total = e.start + e.dur;
  }
  if (total % barLen !== 0) issues.push('incompleteBar');
  return issues;
}

const KEYS = ['C', 'G', 'F', 'D', 'Bb', 'Am', 'Em', 'Dm'];
const N = 12;

// ── 최종 안전망 단위 동작 ──────────────────────────────────────
describe('finalSanity', () => {
  const n = (p: string, o: number, d = '4') => makeNote(p as never, o, d as never);
  const base = {
    useGrandStaff: false,
    scale: getScaleDegrees('C'),
    baseOctave: 4,
    keySignature: 'C',
    timeSignature: '4/4',
    sixteenthsPerBar: 16,
  };

  it('isBadMelodicStep: 삼전음·7도·9도·증2도는 금지, 3도·5도·옥타브는 허용', () => {
    expect(isBadMelodicStep(n('C', 4), n('F', 4, '4'), 60, 66)).toBe(true); // 삼전음
    expect(isBadMelodicStep(n('C', 4), n('B', 4), 60, 71)).toBe(true); // 장7도
    expect(isBadMelodicStep(n('C', 4), n('D', 5), 60, 74)).toBe(true); // 9도
    expect(isBadMelodicStep(n('F', 4), n('G', 4), 65, 68)).toBe(true); // 증2도 F→G♯
    expect(isBadMelodicStep(n('C', 4), n('E', 4), 60, 63)).toBe(false); // 단3도 C→E♭
    expect(isBadMelodicStep(n('C', 4), n('C', 5), 60, 72)).toBe(false); // 옥타브
    expect(isBadMelodicStep(n('C', 4), n('G', 4), 60, 67)).toBe(false); // 완전5도
  });

  it('쉼표를 건너뛰는 삼전음 도약을 고치고 종지음은 유지한다', () => {
    const treble = [n('F', 4), makeRest('4'), n('B', 4), n('C', 5)];
    const report = applyFinalSanity({ ...base, treble, bass: [] });
    expect(report.leapFixes).toBeGreaterThanOrEqual(1);
    expect(melodicIssues(treble, 'C').filter((i) => i.startsWith('badLeap'))).toEqual([]);
    expect(treble[3]).toMatchObject({ pitch: 'C', octave: 5 });
    expect(treble[1].pitch).toBe('rest');
  });

  it('같은 음 3회 반복을 2회로 줄인다', () => {
    const treble = [n('G', 4), n('G', 4), n('G', 4), n('C', 5)];
    const report = applyFinalSanity({ ...base, treble, bass: [] });
    expect(report.repeatFixes).toBeGreaterThanOrEqual(1);
    expect(melodicIssues(treble, 'C')).not.toContain('repeat3');
    expect(treble[3]).toMatchObject({ pitch: 'C', octave: 5 });
  });

  it('2성부 강박 불협화를 베이스와 협화하는 음으로 바꾼다', () => {
    const treble = [n('F', 5, '2'), n('E', 5, '2')];
    const bass = [n('E', 3, '1')];
    const report = applyFinalSanity({ ...base, useGrandStaff: true, treble, bass });
    expect(report.dissonanceFixes).toBe(1);
    const pc = (((noteToMidiWithKey(treble[0], 'C') - 52) % 12) + 12) % 12;
    expect([1, 2, 5, 6, 10, 11]).not.toContain(pc);
    expect(treble[1]).toMatchObject({ pitch: 'E', octave: 5 }); // 종지음 유지
  });

  it('연속 공격점 사이 병행 8도를 제거한다', () => {
    const treble = [n('G', 4), n('A', 4), n('B', 4, '2')];
    const bass = [n('G', 2), n('A', 2), n('G', 2, '2')];
    const report = applyFinalSanity({ ...base, useGrandStaff: true, treble, bass });
    expect(report.parallelFixes).toBe(1);
    const t1 = noteToMidiWithKey(treble[1], 'C');
    expect((((t1 - 45) % 12) + 12) % 12).not.toBe(0);
    expect(treble[2]).toMatchObject({ pitch: 'B', octave: 4 });
  });
});

// ── 종지 옥타브 ─────────────────────────────────────────────────
describe('종지 으뜸음 옥타브', () => {
  it('직전 음에 가장 가까운 옥타브를 고른다 (7도·8도 이상 도약 방지)', () => {
    expect(pickCadenceTonicOctave('C', 4, 'C', 79, 55, 81)).toBe(5); // G5 → C5
    expect(pickCadenceTonicOctave('C', 4, 'C', 62, 55, 81)).toBe(4); // D4 → C4
    expect(pickCadenceTonicOctave('F', 4, 'F', 67, 67, 81)).toBe(5); // G4, 하한 67 → F5
    expect(pickCadenceTonicOctave('C', 4, 'C', undefined, 55, 81)).toBe(4); // 정보 없음 → 기본
  });
});

// ── 생성 선율 규칙 ──────────────────────────────────────────────
describe('선율 생성 (파트 연습 L1~L9)', () => {
  const diffs = [
    'beginner_1',
    'beginner_2',
    'beginner_3',
    'intermediate_1',
    'intermediate_2',
    'intermediate_3',
    'advanced_1',
    'advanced_2',
    'advanced_3',
  ];
  it('금지 도약·3회 반복·음역·붙임줄·첫음/종지음 규칙을 지킨다', () => {
    const found: string[] = [];
    for (const d of diffs) {
      for (let i = 0; i < N; i++) {
        const key = KEYS[i % KEYS.length];
        const ts = ['4/4', '3/4', '6/8', '2/4'][i % 4];
        const s = generatePracticeScore('melody', d as never, {
          keySignature: key,
          timeSignature: ts,
        });
        const issues = [...melodicIssues(s.trebleNotes, key), ...barIssues(s.trebleNotes, ts)];
        for (const is of issues) found.push(`${d}/${key} ${ts}: ${is}`);
      }
    }
    expect(found).toEqual([]);
  });
});

describe('2성부 생성 (저음 L1~L4)', () => {
  it('트레블 선율 규칙을 지키고 베이스 L1 종지는 V/IV→I 성격이다', () => {
    const found: string[] = [];
    for (const d of ['bass_1', 'bass_2', 'bass_3', 'bass_4']) {
      for (let i = 0; i < N; i++) {
        const key = KEYS[i % KEYS.length];
        const ts = ['4/4', '3/4', '6/8'][i % 3];
        const s = generatePracticeScore('twoVoice', d as never, {
          keySignature: key,
          timeSignature: ts,
        });
        const issues = melodicIssues(s.trebleNotes, key).filter((x) => !x.startsWith('firstNot'));
        for (const is of issues) found.push(`${d}/${key} ${ts}: ${is}`);
        const bassPitched = s.bassNotes.filter((x) => x.pitch !== 'rest');
        const last = bassPitched[bassPitched.length - 1];
        const pen = bassPitched[bassPitched.length - 2];
        const scale = getScaleDegrees(key);
        if (scale.indexOf(last.pitch) !== 0) found.push(`${d}/${key}: bassLastNotTonic`);
        if (d === 'bass_1' && pen) {
          if (scale.indexOf(pen.pitch) === 0) found.push(`${d}/${key}: bassPenIsTonic`);
          const leap = Math.abs(noteToMidiWithKey(last, key) - noteToMidiWithKey(pen, key));
          if (leap > 7) found.push(`${d}/${key}: bassCadenceLeap${leap}`);
        }
        for (let k = 0; k < s.bassNotes.length; k++) {
          const b = s.bassNotes[k];
          const m = s.bassNotes[k + 1];
          if (b.tie && (!m || m.pitch !== b.pitch || m.octave !== b.octave)) {
            found.push(`${d}/${key}: bassBrokenTie`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });
});

// ── 리듬 받아쓰기 ────────────────────────────────────────────────
describe('리듬 받아쓰기 생성', () => {
  it('첫 박 쉼표 없음·마디 길이 정확·쉼표 1개 이상·6/8은 둘잇단만(L5+)·점쉼표는 복합박자만', () => {
    const found: string[] = [];
    for (let r = 1; r <= 6; r++) {
      const d = `rhythm_${r}`;
      for (const ts of ['4/4', '3/4', '2/4', '6/8']) {
        for (let i = 0; i < 6; i++) {
          const s = generatePracticeScore('rhythm', d as never, { timeSignature: ts });
          const notes = s.trebleNotes;
          const tag = `${d}@${ts}`;
          if (notes[0].pitch === 'rest') found.push(`${tag}: startsWithRest`);
          for (const is of barIssues(notes, ts)) found.push(`${tag}: ${is}`);
          if (!notes.some((x) => x.pitch === 'rest')) found.push(`${tag}: noRest`);
          // 복합박자: 셋잇단 금지(박이 이미 셋으로 나뉨) — 잇단음표 레벨(L5+)은 둘잇단(2:3)으로, L1~L4는 잇단음표 없음
          if (ts === '6/8' && notes.some((x) => x.tuplet && x.tuplet !== '2')) {
            found.push(`${tag}: tripletInCompound`);
          }
          if (ts === '6/8' && r <= 4 && notes.some((x) => x.tuplet))
            found.push(`${tag}: tupletBelowL5`);
          if (ts === '6/8' && r === 5 && !notes.some((x) => x.tuplet === '2')) {
            found.push(`${tag}: noDupletL5`);
          }
          if (ts !== '6/8' && notes.some((x) => x.pitch === 'rest' && x.duration.endsWith('.'))) {
            found.push(`${tag}: dottedRestInSimple`);
          }
          if (
            r === 1 &&
            ts !== '6/8' &&
            notes.some((x) => ['8', '8.', '16'].includes(x.duration))
          ) {
            found.push(`${tag}: L1hasEighth`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });
});

// ── 객관식: 조표 기준 ABC 표기 ───────────────────────────────────
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** abcjs 규칙(같은 마디·같은 옥타브 임시표 전달)으로 ABC 본문의 음을 MIDI pc 목록으로 해석 */
function parseAbcBody(
  body: string,
  keyAlt: Record<string, number>,
): { chords: number[][]; melody: number[] } {
  const chords: number[][] = [];
  const melody: number[] = [];
  for (const bar of body.split('|')) {
    const state = new Map<string, number>();
    const re = /(\[)|(\])|(\^+|_+|=)?([A-Ga-g])([,']*)/g;
    let m: RegExpExecArray | null;
    let cur: number[] | null = null;
    while ((m = re.exec(bar))) {
      if (m[1]) {
        cur = [];
        continue;
      }
      if (m[2]) {
        if (cur) chords.push(cur);
        cur = null;
        continue;
      }
      const acc = m[3];
      const letter = m[4].toUpperCase();
      let oct = m[4] === letter ? 4 : 5;
      for (const c of m[5]) oct += c === ',' ? -1 : 1;
      const stateKey = `${letter}${oct}`;
      let alt = state.get(stateKey) ?? keyAlt[letter];
      if (acc) {
        alt = acc === '=' ? 0 : acc.startsWith('^') ? acc.length : -acc.length;
        state.set(stateKey, alt);
      }
      const pc = (((LETTER_PC[letter] + alt) % 12) + 12) % 12;
      if (cur) cur.push(pc);
      else melody.push(pc);
    }
  }
  return { chords, melody };
}

/**
 * ABC → 화음(피치 클래스 배열)·선율 목록. `V:` 성부가 여럿이면(큰보표 화성진행) 같은 순번의
 * 화음을 성부끼리 합쳐 하나의 화음으로 본다.
 */
function abcPitchClasses(abc: string): { chords: number[][]; melody: number[] } {
  const keyLine = abc.match(/K:(\S+)/);
  const keyAlt = keySignatureAlterations(keyLine ? keyLine[1] : 'C');
  const voices: string[][] = [];
  const plain: string[] = [];
  let cur: string[] | null = null;
  for (const line of abc.split('\n')) {
    if (/^V:/.test(line)) {
      cur = [];
      voices.push(cur);
      continue;
    }
    if (/^[A-Z]:/.test(line)) continue;
    (cur ?? plain).push(line);
  }
  const parsed = (voices.length > 0 ? voices : [plain]).map((ls) =>
    parseAbcBody(ls.join(' ').replace(/"[^"]*"/g, ''), keyAlt),
  );
  const count = Math.max(...parsed.map((p) => p.chords.length));
  const chords: number[][] = [];
  for (let i = 0; i < count; i++) chords.push(parsed.flatMap((p) => p.chords[i] ?? []));
  return { chords, melody: parsed[0].melody };
}

function isTriad(pcs: number[]): boolean {
  const set = [...new Set(pcs)].sort((a, b) => a - b);
  if (set.length !== 3) return false;
  for (const root of set) {
    const rel = set
      .map((p) => (p - root + 12) % 12)
      .sort((a, b) => a - b)
      .join(',');
    if (rel === '0,4,7' || rel === '0,3,7') return true;
  }
  return false;
}

describe('객관식 ABC 표기', () => {
  it('keySignatureAlterations: 조표별 변화 음이름', () => {
    expect(keySignatureAlterations('C')).toEqual({ C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 });
    expect(keySignatureAlterations('Bb')).toMatchObject({ B: -1, E: -1, A: 0 });
    expect(keySignatureAlterations('Dm')).toMatchObject({ B: -1, E: 0 });
    expect(keySignatureAlterations('G#m')).toMatchObject({ F: 1, C: 1, G: 1, D: 1, A: 1, E: 0 });
    expect(keySignatureAlterations('Bbm')).toMatchObject({
      B: -1,
      E: -1,
      A: -1,
      D: -1,
      G: -1,
      C: 0,
    });
    expect(keySignatureAlterations('F#')).toMatchObject({
      F: 1,
      C: 1,
      G: 1,
      D: 1,
      A: 1,
      E: 1,
      B: 0,
    });
  });

  it('화성진행: 모든 화음이 실제로 장·단3화음으로 울린다 (♭조 임시표 전달 오류 없음)', () => {
    const bad: string[] = [];
    for (const d of ['progression_1', 'progression_2', 'progression_3', 'progression_4']) {
      for (let i = 0; i < 15; i++) {
        const q = generateChoiceQuestion('progression', d as never);
        const all = [q.abcNotation, ...Object.values(q.choiceAbc ?? {})];
        for (const abc of all) {
          const { chords } = abcPitchClasses(abc);
          if (chords.length < 2) bad.push(`${d}: noChords ${abc}`);
          for (const c of chords)
            if (!isTriad(c))
              bad.push(`${d}: notTriad ${c.join('.')} in ${abc.replace(/\n/g, ' ')}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('화성진행: ♭조에서 ♯ 철자를 쓰지 않는다 (B♭장조 IV = E♭ G B♭)', () => {
    let seen = 0;
    for (let i = 0; i < 60 && seen < 3; i++) {
      const q = generateChoiceQuestion('progression', 'progression_3');
      const all = [q.abcNotation, ...Object.values(q.choiceAbc ?? {})];
      for (const abc of all) {
        if (!/K:(Bb|F)\n/.test(abc)) continue;
        seen++;
        expect(abc).not.toMatch(/\^[AD]/);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('조성: 기준음은 항상 A♮이고 선율은 조성 음계(단조는 화성 단음계) 안에 있다', () => {
    const MAJ = [0, 2, 4, 5, 7, 9, 11];
    const HMIN = [0, 2, 3, 5, 7, 8, 11];
    const bad: string[] = [];
    for (let i = 0; i < 60; i++) {
      const q = generateChoiceQuestion('key', 'key_3');
      const abc = q.abcNotation;
      const keyName = abc.match(/K:(\S+)/)![1];
      const km = keyName.match(/^([A-G])([#b]?)(m?)$/)!;
      const tonic =
        (((LETTER_PC[km[1]] + (km[2] === '#' ? 1 : km[2] === 'b' ? -1 : 0)) % 12) + 12) % 12;
      const scale = (km[3] ? HMIN : MAJ).map((x) => (x + tonic) % 12);
      const { melody } = abcPitchClasses(abc);
      if (melody[0] !== 9) bad.push(`${keyName}: refNotA(${melody[0]})`);
      for (const pc of melody.slice(1))
        if (!scale.includes(pc))
          bad.push(`${keyName}: outOfScale ${pc} ${abc.replace(/\n/g, ' ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('음정: 같은 음이름·옥타브에 임시표가 있으면 두 번째 음에 ♮/임시표를 명시한다', () => {
    const bad: string[] = [];
    for (const d of ['interval_3', 'interval_4']) {
      for (let i = 0; i < 40; i++) {
        const q = generateChoiceQuestion('interval', d as never);
        const body = q.abcNotation
          .split('\n')
          .filter((l) => !/^[A-Z]:/.test(l))
          .join(' ');
        const toks = [...body.matchAll(/(\^+|_+|=)?([A-Ga-g])([,']*)\d*/g)].map((m) => ({
          acc: m[1] ?? '',
          name: m[2] + m[3],
        }));
        for (let k = 1; k < toks.length; k++) {
          if (toks[k].name === toks[k - 1].name && toks[k - 1].acc && !toks[k].acc) {
            bad.push(`${d}: ${q.abcNotation.replace(/\n/g, ' ')}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('화음: 속7·반감7 번역 키가 3개 언어에 모두 있다', () => {
    for (const c of [koContent, enContent, jaContent] as never[]) {
      const content = c as {
        chord: Record<string, string>;
        explain: { chord: Record<string, string> };
      };
      expect(content.chord.dom7).toBeTruthy();
      expect(content.chord.halfdim7).toBeTruthy();
      expect(content.explain.chord.dom7).toBeTruthy();
      expect(content.explain.chord.halfdim7).toBeTruthy();
    }
  });
});
