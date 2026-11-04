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

import { generateChoiceQuestion, generateChoiceQuestions } from '../lib/questionGenerator';

describe('generateChoiceQuestion', () => {
  describe('interval', () => {
    const difficulties = [
      'interval_1',
      'interval_2',
      'interval_3',
      'interval_4',
      'interval_5',
      'interval_6',
    ] as const;

    difficulties.forEach((diff) => {
      it(`${diff}: 4개 보기 + 정답 포함 + ABC notation 존재`, () => {
        const q = generateChoiceQuestion('interval', diff);
        expect(q.choices).toHaveLength(4);
        expect(q.choices).toContain(q.correctAnswer);
        expect(q.abcNotation).toBeTruthy();
        expect(q.abcNotation.length).toBeGreaterThan(0);
        expect(q.prompt).toBeTruthy();
        expect(q.contentType).toBe('interval');
        expect(q.difficulty).toBe(diff);
        expect(q.id).toMatch(/^q_/);
      });

      it(`${diff}: 보기에 중복 없음`, () => {
        const q = generateChoiceQuestion('interval', diff);
        const unique = new Set(q.choices);
        expect(unique.size).toBe(q.choices.length);
      });
    });
  });

  describe('chord', () => {
    const difficulties = ['chord_2', 'chord_3', 'chord_4', 'chord_5'] as const;

    difficulties.forEach((diff) => {
      it(`${diff}: 4개 보기 + 정답 포함 + ABC notation 존재`, () => {
        const q = generateChoiceQuestion('chord', diff);
        expect(q.choices).toHaveLength(4);
        expect(q.choices).toContain(q.correctAnswer);
        expect(q.abcNotation).toBeTruthy();
        expect(q.contentType).toBe('chord');
      });

      it(`${diff}: 보기에 중복 없음`, () => {
        const q = generateChoiceQuestion('chord', diff);
        const unique = new Set(q.choices);
        expect(unique.size).toBe(q.choices.length);
      });
    });
  });

  describe('key', () => {
    const difficulties = ['key_1', 'key_2', 'key_3'] as const;

    difficulties.forEach((diff) => {
      const expectedChoiceCount = diff === 'key_1' ? 2 : 4;

      it(`${diff}: ${expectedChoiceCount}개 보기 + 정답 포함 + ABC notation 존재`, () => {
        const q = generateChoiceQuestion('key', diff);
        expect(q.choices).toHaveLength(expectedChoiceCount);
        expect(q.choices).toContain(q.correctAnswer);
        expect(q.abcNotation).toBeTruthy();
        expect(q.contentType).toBe('key');
      });

      it(`${diff}: 보기에 중복 없음`, () => {
        const q = generateChoiceQuestion('key', diff);
        const unique = new Set(q.choices);
        expect(unique.size).toBe(q.choices.length);
      });
    });
  });

  describe('progression', () => {
    const difficulties = [
      'progression_1',
      'progression_2',
      'progression_3',
      'progression_4',
    ] as const;

    difficulties.forEach((diff) => {
      it(`${diff}: 보기 + 정답 포함 + ABC chord notation 존재`, () => {
        const q = generateChoiceQuestion('progression', diff);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.choices.length).toBeLessThanOrEqual(4);
        expect(q.choices).toContain(q.correctAnswer);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.abcNotation).toContain('K:');
        expect(q.abcNotation).toContain('M:4/4');
        expect(q.abcNotation).toMatch(/\[[^\]]+\]/);
        expect(q.contentType).toBe('progression');
        expect(q.difficulty).toBe(diff);
      });
    });

    it('progression_2는 종지명 보기와 종지 프롬프트를 생성한다', () => {
      const q = generateChoiceQuestion('progression', 'progression_2');
      expect(q.prompt).toBe('마지막 종지의 종류를 고르세요.');
      expect(['완전종지', '반종지', '변격종지', '기만종지']).toContain(q.correctAnswer);
    });

    it('progression_1은 로마숫자 진행 보기와 진행 프롬프트를 생성한다', () => {
      const q = generateChoiceQuestion('progression', 'progression_1');
      expect(q.prompt).toBe('들리는 화성 진행을 고르세요.');
      expect(q.correctAnswer).toMatch(/[IViv]/);
    });

    it('progression_3은 정답과 보기의 화음 개수를 맞춘다', () => {
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      try {
        const q = generateChoiceQuestion('progression', 'progression_3');
        const correctChordCount = q.correctAnswer.split('-').length;

        expect(q.correctAnswer).toBe('ii-V-I');
        expect(q.choices).toHaveLength(4);
        expect(q.choices.map((choice) => choice.split('-').length)).toEqual(
          q.choices.map(() => correctChordCount),
        );
      } finally {
        randomSpy.mockRestore();
      }
    });
  });

  it('지원하지 않는 카테고리에서 에러 발생', () => {
    expect(() => generateChoiceQuestion('melody', 'beginner_1')).toThrow();
  });
});

describe('generateChoiceQuestions (배치)', () => {
  it('지정한 개수만큼 문제 생성', () => {
    const questions = generateChoiceQuestions('interval', 'interval_1', 5);
    expect(questions).toHaveLength(5);
    questions.forEach((q) => {
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(q.correctAnswer);
    });
  });

  it('0개 요청 시 빈 배열', () => {
    const questions = generateChoiceQuestions('interval', 'interval_1', 0);
    expect(questions).toHaveLength(0);
  });
});

describe('해설과 비교 청취', () => {
  const cases = [
    ['interval', 'interval_3'],
    ['chord', 'chord_4'],
    ['key', 'key_1'],
    ['key', 'key_3'],
    ['progression', 'progression_2'],
    ['progression', 'progression_4'],
  ] as const;

  cases.forEach(([category, difficulty]) => {
    it(`${category}/${difficulty}: 모든 보기에 비교용 ABC와 해설이 있다`, () => {
      for (let i = 0; i < 10; i++) {
        const q = generateChoiceQuestion(category, difficulty);
        expect(q.explanation.length).toBeGreaterThan(10);
        expect(q.explanation).not.toMatch(/^content:/);
        for (const choice of q.choices) {
          expect(q.choiceAbc[choice]).toContain('K:');
        }
        expect(q.choiceAbc[q.correctAnswer]).toBe(q.abcNotation);
      }
    });
  });

  it('음정 오답 소리는 정답과 같은 방향으로 연주된다', () => {
    const q = generateChoiceQuestion('interval', 'interval_1');
    const notes = (abc: string) =>
      abc
        .split('\n')
        .pop()!
        .split(' ')
        .filter((n) => n !== 'z' && n !== '|]');
    const correctNotes = notes(q.abcNotation);
    expect(correctNotes).toHaveLength(2);
    for (const choice of q.choices) {
      expect(notes(q.choiceAbc[choice])).toHaveLength(2);
    }
  });

  it('조성 오답 소리는 같은 멜로디 패턴을 다른 조표로 연주한다', () => {
    const q = generateChoiceQuestion('key', 'key_2');
    const keyLine = (abc: string) => abc.split('\n').find((l) => l.startsWith('K:'));
    const keys = new Set(q.choices.map((c) => keyLine(q.choiceAbc[c])));
    expect(keys.size).toBe(q.choices.length);
  });
});

// ── 화음 4단계: 3화음 전위 ─────────────────────────────────────
describe('chord_5 — 3화음 전위(제1·제2전위)', () => {
  const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  /** K:C 블록 화음 ABC → 베이스 기준 반음 간격 (오름차순) */
  function intervalsFromBass(abc: string): number[] {
    const body = abc.split('\n').filter((l) => !/^[A-Z]:/.test(l))[0];
    const midis: number[] = [];
    const re = /(\^*|_*)([A-Ga-g])([,']*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const letter = m[2].toUpperCase();
      let oct = m[2] === letter ? 4 : 5;
      for (const c of m[3]) oct += c === ',' ? -1 : 1;
      const alt = m[1].startsWith('^') ? m[1].length : m[1].startsWith('_') ? -m[1].length : 0;
      midis.push(12 * (oct + 1) + PC[letter] + alt);
    }
    midis.sort((a, b) => a - b);
    return midis.map((x) => x - midis[0]);
  }
  const EXPECTED: Record<string, number[]> = {
    '장3화음 제1전위': [0, 3, 8],
    '단3화음 제1전위': [0, 4, 9],
    '장3화음 제2전위': [0, 5, 9],
    '단3화음 제2전위': [0, 5, 8],
  };

  it('전위 화음이 출제되고, 베이스 기준 간격이 전위형과 일치하며 보기·해설이 번역된다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const q = generateChoiceQuestion('chord', 'chord_5');
      expect(q.explanation).not.toMatch(/^content:/);
      for (const choice of q.choices) {
        expect(choice).not.toMatch(/^content:/);
        if (EXPECTED[choice])
          expect(intervalsFromBass(q.choiceAbc[choice])).toEqual(EXPECTED[choice]);
      }
      if (EXPECTED[q.correctAnswer]) {
        seen.add(q.correctAnswer);
        expect(intervalsFromBass(q.abcNotation)).toEqual(EXPECTED[q.correctAnswer]);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('chord_4 이하에서는 전위 화음이 정답으로 나오지 않는다', () => {
    for (const d of ['chord_2', 'chord_3', 'chord_4'] as const) {
      for (let i = 0; i < 30; i++) {
        const q = generateChoiceQuestion('chord', d);
        expect(EXPECTED[q.correctAnswer]).toBeUndefined();
      }
    }
  });
});

// ── 음정 5·6단계: 화성 음정(동시 울림)·복합음정 ─────────────────────
describe('음정 5·6단계 — 화성 음정·복합음정', () => {
  const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  /** ABC 음 하나 → MIDI (C4 = 60) */
  function abcMidi(tok: string): number {
    const m = /^([\^_=]*)([A-Ga-g])([,']*)$/.exec(tok);
    if (!m) throw new Error('not a note: ' + tok);
    const acc = (m[1].match(/\^/g) || []).length - (m[1].match(/_/g) || []).length;
    const upper = m[2] === m[2].toUpperCase();
    let octave = upper ? 4 : 5;
    for (const ch of m[3]) octave += ch === "'" ? 1 : -1;
    return (octave + 1) * 12 + PITCH[m[2].toUpperCase()] + acc;
  }
  /** 본문에서 두 음을 뽑아 반음 거리·제시 방식 반환 */
  function parseInterval(abc: string): { semitones: number; harmonic: boolean; low: number } {
    const body = abc.split('\n').pop()!;
    const chord = /^\[(\S+?)\]\d+ z \|\]$/.exec(body);
    if (chord) {
      const toks = chord[1].match(/[\^_=]*[A-Ga-g][,']*/g)!;
      expect(toks).toHaveLength(2);
      const [a, b] = toks.map(abcMidi);
      return { semitones: Math.abs(a - b), harmonic: true, low: Math.min(a, b) };
    }
    const toks = body.split(' ').filter((t) => t !== 'z' && t !== '|]');
    expect(toks).toHaveLength(2);
    const [a, b] = toks.map(abcMidi);
    return { semitones: Math.abs(a - b), harmonic: false, low: Math.min(a, b) };
  }
  const SEMITONES_BY_LABEL: Record<string, number> = {
    '완전1도 (P1)': 0,
    '단2도 (m2)': 1,
    '장2도 (M2)': 2,
    '단3도 (m3)': 3,
    '장3도 (M3)': 4,
    '완전4도 (P4)': 5,
    '증4도/감5도 (A4/d5)': 6,
    '완전5도 (P5)': 7,
    '단6도 (m6)': 8,
    '장6도 (M6)': 9,
    '단7도 (m7)': 10,
    '장7도 (M7)': 11,
    '완전8도 (P8)': 12,
    '단9도 (m9)': 13,
    '장9도 (M9)': 14,
    '단10도 (m10)': 15,
    '장10도 (M10)': 16,
    '완전11도 (P11)': 17,
    '완전12도 (P12)': 19,
    '단13도 (m13)': 20,
    '장13도 (M13)': 21,
  };

  it('interval_5: 두 음이 동시에 울리고([..]) 정답·보기 소리의 반음 수가 라벨과 일치한다', () => {
    for (let i = 0; i < 40; i++) {
      const q = generateChoiceQuestion('interval', 'interval_5');
      const correct = parseInterval(q.abcNotation);
      expect(correct.harmonic).toBe(true);
      expect(correct.semitones).toBe(SEMITONES_BY_LABEL[q.correctAnswer]);
      expect(correct.semitones).toBeGreaterThanOrEqual(1); // 동음은 한 음으로 들려 제외
      expect(correct.semitones).toBeLessThanOrEqual(12);
      expect(q.prompt).toBe('동시에 울리는 두 음을 듣고 음정을 맞추세요.');
      for (const c of q.choices) {
        const p = parseInterval(q.choiceAbc[c]);
        expect(p.harmonic).toBe(true);
        expect(p.semitones).toBe(SEMITONES_BY_LABEL[c]);
      }
    }
  });

  it('interval_6: 정답은 9도~13도 복합음정이고 보기에는 옥타브를 뺀 단순음정이 섞여 있다', () => {
    let simpleDistractor = 0;
    for (let i = 0; i < 40; i++) {
      const q = generateChoiceQuestion('interval', 'interval_6');
      const correct = parseInterval(q.abcNotation);
      expect([13, 14, 15, 16, 17, 19, 20, 21]).toContain(correct.semitones);
      expect(correct.semitones).toBe(SEMITONES_BY_LABEL[q.correctAnswer]);
      expect(q.prompt).toBe('옥타브를 넘는 두 음을 듣고 복합음정을 맞추세요.');
      expect(q.explanation).toContain('옥타브 위의');
      for (const c of q.choices) {
        const p = parseInterval(q.choiceAbc[c]);
        expect(p.harmonic).toBe(correct.harmonic);
        expect(p.semitones).toBe(SEMITONES_BY_LABEL[c]);
        if (p.semitones <= 12) simpleDistractor++;
      }
      // 아래 음은 A3~F♯4, 위 음은 E6를 넘지 않는다
      expect(correct.low).toBeGreaterThanOrEqual(57);
      expect(correct.low + correct.semitones).toBeLessThanOrEqual(88);
    }
    expect(simpleDistractor).toBeGreaterThan(0);
  });

  it('1~4단계는 기존대로 차례 연주이며 복합음정이 정답·보기에 나오지 않는다', () => {
    for (const diff of ['interval_1', 'interval_2', 'interval_3', 'interval_4'] as const) {
      for (let i = 0; i < 15; i++) {
        const q = generateChoiceQuestion('interval', diff);
        const p = parseInterval(q.abcNotation);
        expect(p.harmonic).toBe(false);
        expect(p.semitones).toBeLessThanOrEqual(12);
        expect(p.low + p.semitones).toBeLessThanOrEqual(76); // E5
        for (const c of q.choices) expect(SEMITONES_BY_LABEL[c]).toBeLessThanOrEqual(12);
      }
    }
  });
});
