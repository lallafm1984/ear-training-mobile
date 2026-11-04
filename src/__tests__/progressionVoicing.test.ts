/**
 * 화성진행·종지 4성부 성부 배치 규칙 (Milne, Fundamentals, Function, and Form 14·17·22장)
 *  · 병행 완전5도·8도·유니즌 없음, 성부 교차 없음, 상성부 간격 ≤ 옥타브, 음역 안
 *  · 모든 화음에 근음·3음 포함 (장·단이 들리도록), 이끔음 중복 없음
 *  · V→I / V→vi 에서 소프라노 이끔음은 1̂로 상행
 *  · 정격종지(V→I)로 끝나는 진행은 소프라노가 1̂로 끝난다 (완전 정격종지)
 *  · questionGenerator 가 만든 실제 ABC(큰보표 2성부)도 같은 규칙을 지킨다
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

import {
  realizeProgression,
  voiceLeadingIssues,
  mod12,
  type VoicedChord,
} from '../lib/progressionVoicing';
import {
  generateChoiceQuestion,
  keySignatureAlterations,
  parseRomanToken,
} from '../lib/questionGenerator';

const MAJOR: Record<string, number[]> = {
  I: [0, 4, 7],
  ii: [2, 5, 9],
  IV: [5, 9, 12],
  V: [7, 11, 14],
  vi: [9, 12, 16],
};
const MINOR: Record<string, number[]> = {
  i: [0, 3, 7],
  iv: [5, 8, 12],
  V: [7, 11, 14],
  VI: [8, 12, 15],
};
const MAJOR_PROGRESSIONS = [
  ['I', 'V', 'I'],
  ['I', 'IV', 'I'],
  ['I', 'IV', 'V', 'I'],
  ['I', 'vi', 'IV', 'V'],
  ['ii', 'V', 'I'],
  ['IV', 'V', 'I'],
  ['I', 'ii', 'V'],
  ['vi', 'IV', 'V'],
  ['I', 'vi', 'ii', 'V'],
  ['I', 'V', 'vi', 'IV'],
  ['I', 'IV', 'ii', 'V'],
  ['V', 'I'],
  ['I', 'V'],
  ['IV', 'V'],
  ['IV', 'I'],
  ['V', 'vi'],
  ['I', 'V', 'IV', 'I'],
  ['I', 'IV', 'V', 'vi'],
];
const MINOR_PROGRESSIONS = [
  ['i', 'iv', 'V', 'i'],
  ['i', 'VI', 'iv', 'V'],
];
const MAJOR_TONICS = [60, 55, 53, 50, 58];
const MINOR_TONICS = [57, 50, 52];

function isTonicOrSubmediant(roman: string): boolean {
  return ['I', 'i', 'vi', 'VI'].includes(roman);
}

function check(romans: string[], table: Record<string, number[]>, tonic: number, minor: boolean) {
  const chords = romans.map((r) => table[r]);
  const n = romans.length;
  const pac = n >= 2 && ['I', 'i'].includes(romans[n - 1]) && romans[n - 2] === 'V';
  const voiced = realizeProgression({ chords, tonicMidi: tonic, minor, sopranoEndsOnTonic: pac });
  expect(voiced).toHaveLength(n);
  const leadingTonePc = mod12(tonic + 11);
  const resolveIdx = romans
    .map((r, i) => (i > 0 && romans[i - 1] === 'V' && isTonicOrSubmediant(r) ? i : -1))
    .filter((i) => i >= 0);
  const issues = voiceLeadingIssues(voiced, { leadingTonePc, resolveIdx });
  expect(issues).toEqual([]);
  voiced.forEach((c, i) => {
    const pcs = new Set([c.bass, c.tenor, c.alto, c.soprano].map(mod12));
    const [root, third] = chords[i].map((iv) => mod12(tonic + iv));
    expect(mod12(c.bass)).toBe(root); // 기본 위치
    expect(pcs.has(third)).toBe(true);
    const ltCount = [c.bass, c.tenor, c.alto, c.soprano].filter(
      (p) => mod12(p) === leadingTonePc,
    ).length;
    expect(ltCount).toBeLessThanOrEqual(1);
  });
  if (pac) expect(mod12(voiced[n - 1].soprano)).toBe(mod12(tonic));
  return voiced;
}

describe('realizeProgression — 성부 진행 규칙', () => {
  it.each(MAJOR_PROGRESSIONS)('장조 %s: 병행·교차·음역·이끔음·PAC 규칙 통과', (...romans) => {
    for (const tonic of MAJOR_TONICS) {
      for (let k = 0; k < 6; k++) check(romans, MAJOR, tonic, false);
    }
  });

  it.each(MINOR_PROGRESSIONS)('단조 %s: 규칙 통과 + 6̂–♯7̂ 증2도 없음', (...romans) => {
    for (const tonic of MINOR_TONICS) {
      for (let k = 0; k < 6; k++) {
        const voiced = check(romans, MINOR, tonic, true);
        const sixth = mod12(tonic + 8);
        const lt = mod12(tonic + 11);
        for (let i = 1; i < voiced.length; i++) {
          const pv = [voiced[i - 1].tenor, voiced[i - 1].alto, voiced[i - 1].soprano];
          const cv = [voiced[i].tenor, voiced[i].alto, voiced[i].soprano];
          for (let v = 0; v < 3; v++) {
            const a = mod12(pv[v]);
            const b = mod12(cv[v]);
            expect((a === sixth && b === lt) || (a === lt && b === sixth)).toBe(false);
          }
        }
      }
    }
  });

  it('같은 난수 소스면 결정적이고, 난수가 다르면 배치가 달라질 수 있다', () => {
    const chords = ['I', 'IV', 'V', 'I'].map((r) => MAJOR[r]);
    const a = realizeProgression({ chords, tonicMidi: 60, random: () => 0 });
    const b = realizeProgression({ chords, tonicMidi: 60, random: () => 0 });
    expect(a).toEqual(b);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(JSON.stringify(realizeProgression({ chords, tonicMidi: 60 })));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('기만종지 V→vi: 소프라노 이끔음은 1̂로 상행하고 vi 는 3음을 중복할 수 있다', () => {
    let sawSopranoLt = false;
    for (let k = 0; k < 40 && !sawSopranoLt; k++) {
      const voiced = realizeProgression({ chords: [MAJOR.V, MAJOR.vi], tonicMidi: 60 });
      if (mod12(voiced[0].soprano) === 11) {
        sawSopranoLt = true;
        expect(voiced[1].soprano - voiced[0].soprano).toBe(1);
      }
      expect(voiceLeadingIssues(voiced)).toEqual([]);
    }
  });
});

// ── 실제 ABC 검증 ─────────────────────────────────────────────
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 큰보표 ABC(V:V1 S·A / V:V2 B·T) → VoicedChord[] */
function parseGrandStaff(abc: string): { chords: VoicedChord[]; tonicPc: number } {
  const keyName = abc.match(/K:(\S+)/)![1];
  const km = keyName.match(/^([A-G])([#b]?)(m?)$/)!;
  const tonicPc = mod12(LETTER_PC[km[1]] + (km[2] === '#' ? 1 : km[2] === 'b' ? -1 : 0));
  const keyAlt = keySignatureAlterations(keyName);
  const voices: string[] = [];
  let cur: string | null = null;
  for (const line of abc.split('\n')) {
    if (/^V:/.test(line)) {
      cur = '';
      voices.push(cur);
      continue;
    }
    if (/^[A-Z]:/.test(line)) continue;
    if (cur !== null) voices[voices.length - 1] += ` ${line}`;
  }
  expect(voices).toHaveLength(2);
  const perVoice = voices.map((body) => {
    const chords: number[][] = [];
    for (const bar of body.split('|')) {
      const state = new Map<string, number>();
      const re = /(\[)|(\])|(\^+|_+|=)?([A-Ga-g])([,']*)/g;
      let m: RegExpExecArray | null;
      let chord: number[] | null = null;
      while ((m = re.exec(bar))) {
        if (m[1]) {
          chord = [];
          continue;
        }
        if (m[2]) {
          if (chord) chords.push(chord.sort((x, y) => x - y));
          chord = null;
          continue;
        }
        const letter = m[4].toUpperCase();
        let oct = m[4] === letter ? 4 : 5;
        for (const c of m[5]) oct += c === ',' ? -1 : 1;
        const stateKey = `${letter}${oct}`;
        let alt = state.get(stateKey) ?? keyAlt[letter];
        if (m[3]) {
          alt = m[3] === '=' ? 0 : m[3].startsWith('^') ? m[3].length : -m[3].length;
          state.set(stateKey, alt);
        }
        const midi = 12 * (oct + 1) + LETTER_PC[letter] + alt;
        if (chord) chord.push(midi);
      }
    }
    return chords;
  });
  expect(perVoice[0]).toHaveLength(perVoice[1].length);
  const chords = perVoice[0].map((upper, i) => {
    const lower = perVoice[1][i];
    expect(upper).toHaveLength(2);
    expect(lower).toHaveLength(2);
    return { bass: lower[0], tenor: lower[1], alto: upper[0], soprano: upper[1] };
  });
  return { chords, tonicPc };
}

describe('questionGenerator 화성진행 ABC — 큰보표 성부 배치', () => {
  it.each(['progression_1', 'progression_2', 'progression_3', 'progression_4'])(
    '%s: 정답·보기 ABC 모두 병행·교차·음역 위반 없음, 화음은 3화음',
    (difficulty) => {
      for (let i = 0; i < 12; i++) {
        const q = generateChoiceQuestion('progression', difficulty as never);
        for (const abc of [q.abcNotation, ...Object.values(q.choiceAbc ?? {})]) {
          expect(abc).toContain('V:V1 clef=treble');
          expect(abc).toContain('V:V2 clef=bass');
          const { chords } = parseGrandStaff(abc);
          expect(chords.length).toBeGreaterThanOrEqual(2);
          expect(voiceLeadingIssues(chords)).toEqual([]);
          for (const c of chords) {
            const pcs = [...new Set([c.bass, c.tenor, c.alto, c.soprano].map(mod12))];
            expect(pcs.length).toBeGreaterThanOrEqual(2);
            const root = mod12(c.bass);
            const rel = pcs.map((p) => mod12(p - root)).sort((a, b) => a - b);
            // 근음·3음 (+5음) — 장·단3화음의 부분집합
            expect(['0,3', '0,4', '0,3,7', '0,4,7']).toContain(rel.join(','));
          }
        }
      }
    },
  );

  it('완전종지(V→I) 문제의 정답 악보는 소프라노가 으뜸음으로 끝난다', () => {
    let seen = 0;
    for (let i = 0; i < 60 && seen < 5; i++) {
      const q = generateChoiceQuestion('progression', 'progression_2');
      if (q.correctAnswer !== '완전종지') continue;
      seen++;
      const { chords, tonicPc } = parseGrandStaff(q.abcNotation);
      expect(mod12(chords[chords.length - 1].soprano)).toBe(tonicPc);
      // 이끔음(7̂)이 소프라노에 있었다면 1̂로 상행
      const prev = chords[chords.length - 2];
      if (mod12(prev.soprano) === mod12(tonicPc + 11)) {
        expect(chords[chords.length - 1].soprano - prev.soprano).toBe(1);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

// ── 5~7단계: 종지 세분화 · 기능 진행(전위·7화음) · 로마숫자 판별 ───────────────
const MAJOR_FULL: Record<string, number[]> = {
  I: [0, 4, 7],
  ii: [2, 5, 9],
  iii: [4, 7, 11],
  IV: [5, 9, 12],
  V: [7, 11, 14],
  vi: [9, 12, 16],
  'vii°': [11, 14, 17],
};
const MINOR_FULL: Record<string, number[]> = {
  i: [0, 3, 7],
  'ii°': [2, 5, 8],
  iv: [5, 8, 12],
  V: [7, 11, 14],
  VI: [8, 12, 15],
};
const SEVENTH_OF: Record<string, number> = {
  I: 11,
  ii: 10,
  IV: 11,
  V: 10,
  vi: 10,
  i: 10,
  iv: 10,
  'ii°': 10,
};

/** 로마숫자 토큰 → { pcs(으뜸음 기준 상대), bassRel, seventhRel } */
function expectedChord(token: string, minor: boolean) {
  const t = parseRomanToken(token);
  const triad = (minor ? MINOR_FULL : MAJOR_FULL)[t.base];
  expect(triad).toBeDefined();
  const members = t.seventh ? [...triad, triad[0] + SEVENTH_OF[t.base]] : triad;
  const rel = members.map((m) => mod12(m));
  return {
    rel,
    bassRel: rel[Math.min(t.bassMember, rel.length - 1)],
    seventhRel: t.seventh ? rel[3] : null,
  };
}

function pcsOf(c: VoicedChord): number[] {
  return [c.bass, c.tenor, c.alto, c.soprano].map(mod12);
}

/** 큰보표 ABC가 로마숫자 열(토큰)과 일치하는지: 구성음 집합(근음·3음 필수, 7음 필수)·베이스 구성음 */
function expectChordsMatch(abc: string, romans: string[], minor: boolean) {
  const { chords, tonicPc } = parseGrandStaff(abc);
  expect(chords).toHaveLength(romans.length);
  const seventhPcs: Array<number | null> = [];
  romans.forEach((token, i) => {
    const exp = expectedChord(token, minor);
    const c = chords[i];
    const rel = new Set(pcsOf(c).map((p) => mod12(p - tonicPc)));
    for (const p of rel) expect(exp.rel).toContain(p); // 화음 밖 음 없음
    expect(rel.has(exp.rel[0])).toBe(true); // 근음
    expect(rel.has(exp.rel[1])).toBe(true); // 3음
    if (exp.seventhRel !== null) expect(rel.has(exp.seventhRel)).toBe(true); // 7음
    expect(mod12(c.bass - tonicPc)).toBe(exp.bassRel); // 전위(베이스 구성음)
    seventhPcs.push(exp.seventhRel === null ? null : mod12(tonicPc + exp.seventhRel));
  });
  // 성부 진행 규칙 + 7음 하행 해결
  expect(voiceLeadingIssues(chords, { seventhPcs })).toEqual([]);
  return { chords, tonicPc };
}

describe('realizeProgression — 전위·7화음', () => {
  it('ChordSpec.bassMember 로 지정한 구성음이 베이스에 오고, 7화음은 7음을 포함한다', () => {
    const voiced = realizeProgression({
      chords: [
        { intervals: [0, 4, 7] },
        { intervals: [2, 5, 9], bassMember: 1 }, // ii6 → 베이스 F
        { intervals: [7, 11, 14, 17] }, // V7
        { intervals: [0, 4, 7] },
      ],
      tonicMidi: 60,
      sopranoEndsOnTonic: true,
      random: () => 0,
    });
    expect(mod12(voiced[1].bass)).toBe(5);
    expect(pcsOf(voiced[2])).toContain(5); // V7의 7음 F
    expect(mod12(voiced[3].soprano)).toBe(0);
    expect(voiceLeadingIssues(voiced, { seventhPcs: [null, null, 5, null] })).toEqual([]);
  });

  it('finalSopranoMembers [1,2] 이면 마지막 소프라노가 3̂ 또는 5̂ (IAC)', () => {
    for (let i = 0; i < 10; i++) {
      const voiced = realizeProgression({
        chords: [
          [0, 4, 7],
          [5, 9, 12],
          [7, 11, 14],
          [0, 4, 7],
        ],
        tonicMidi: 60,
        finalSopranoMembers: [1, 2],
      });
      expect([4, 7]).toContain(mod12(voiced[3].soprano));
    }
  });
});

describe('questionGenerator 5~7단계', () => {
  const LABEL_TO_ROMANS: Record<string, { romans: string[]; minor: boolean }> = {};
  for (const key of [
    'I-ii6-V7-I',
    'I-IV-V7-I',
    'I-ii-V7-I',
    'I6-IV-V7-I',
    'I-vi-ii6-V7',
    'I-IV-ii6-V7',
    'I-V7-vi-IV',
  ]) {
    LABEL_TO_ROMANS[key] = { romans: key.split('-'), minor: false };
  }
  for (const key of ['i-iv-V7-i', 'i-ii°6-V7-i', 'i-iv6-V7-i']) {
    LABEL_TO_ROMANS[key] = { romans: key.split('-'), minor: true };
  }

  it('progression_6: 정답·보기 악보가 라벨의 로마숫자(전위·7화음)와 일치하고 7음은 2도 하행 해결된다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const q = generateChoiceQuestion('progression', 'progression_6');
      seen.add(q.correctAnswer);
      expect(q.prompt).toContain('7화음');
      for (const label of q.choices) {
        const spec = LABEL_TO_ROMANS[label];
        expect(spec).toBeDefined();
        expectChordsMatch(q.choiceAbc[label], spec.romans, spec.minor);
      }
      expect(q.choiceAbc[q.correctAnswer]).toBe(q.abcNotation);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('progression_5: 종지 종류가 마지막 두 화음·소프라노·베이스로 확인된다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const q = generateChoiceQuestion('progression', 'progression_5');
      seen.add(q.correctAnswer);
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      for (const label of q.choices) {
        const { chords, tonicPc } = parseGrandStaff(q.choiceAbc[label]);
        expect(voiceLeadingIssues(chords)).toEqual([]);
        const last = chords[chords.length - 1];
        const prev = chords[chords.length - 2];
        const rootOf = (c: VoicedChord) => {
          const rel = [...new Set(pcsOf(c).map((p) => mod12(p - tonicPc)))].sort((a, b) => a - b);
          const hasThird = (r: number) => rel.includes(mod12(r + 3)) || rel.includes(mod12(r + 4));
          // 장·단3화음 근음 찾기: 3음과 5음이 모두 있는 음을 우선, 5음 생략이면 3음만으로
          return (
            rel.find((r) => hasThird(r) && rel.includes(mod12(r + 7))) ??
            rel.find((r) => hasThird(r))!
          );
        };
        const prevRoot = rootOf(prev);
        const lastRoot = rootOf(last);
        const sop = mod12(last.soprano - tonicPc);
        const bassRel = mod12(last.bass - tonicPc);
        if (label.startsWith('완전 정격종지')) {
          expect(prevRoot).toBe(7);
          expect(lastRoot).toBe(0);
          expect(bassRel).toBe(0);
          expect(sop).toBe(0);
        } else if (label.startsWith('불완전 정격종지')) {
          expect(prevRoot).toBe(7);
          expect(lastRoot).toBe(0);
          expect(sop !== 0 || bassRel !== 0).toBe(true);
        } else if (label === '반종지') {
          expect(lastRoot).toBe(7);
        } else if (label === '기만종지') {
          expect(prevRoot).toBe(7);
          expect(lastRoot).toBe(9);
        } else {
          throw new Error('unexpected label ' + label);
        }
      }
    }
    expect(seen.size).toBe(4);
  });

  it('progression_7: 첫 화음은 으뜸화음, 둘째 화음은 라벨의 로마숫자와 일치하고 보기는 같은 조성 안에서만 나온다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const q = generateChoiceQuestion('progression', 'progression_7');
      seen.add(q.correctAnswer);
      const minor = /K:[A-G][#b]?m/.test(q.abcNotation);
      const tonicToken = minor ? 'i' : 'I';
      for (const label of q.choices) {
        const token = label.split(' ')[0];
        // 장조 보기는 장조 로마숫자(I·ii·iii·IV·V·vi·vii°6), 단조 보기는 단조 로마숫자만
        expect(Object.keys(minor ? MINOR_FULL : MAJOR_FULL)).toContain(parseRomanToken(token).base);
        expectChordsMatch(q.choiceAbc[label], [tonicToken, token], minor);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(7);
  });
});
