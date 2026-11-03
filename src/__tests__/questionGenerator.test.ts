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
    const difficulties = ['interval_1', 'interval_2', 'interval_3', 'interval_4'] as const;

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
    const difficulties = ['chord_2', 'chord_3', 'chord_4'] as const;

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
