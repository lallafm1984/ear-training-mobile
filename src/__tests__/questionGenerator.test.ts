import { generateChoiceQuestion, generateChoiceQuestions } from '../lib/questionGenerator';

describe('generateChoiceQuestion', () => {
  describe('interval', () => {
    const difficulties = ['interval_1', 'interval_2', 'interval_3', 'interval_4'] as const;

    difficulties.forEach(diff => {
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

    difficulties.forEach(diff => {
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

    difficulties.forEach(diff => {
      it(`${diff}: 4개 보기 + 정답 포함 + ABC notation 존재`, () => {
        const q = generateChoiceQuestion('key', diff);
        expect(q.choices).toHaveLength(4);
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

  it('지원하지 않는 카테고리에서 에러 발생', () => {
    expect(() => generateChoiceQuestion('melody' as any, 'melody_1' as any)).toThrow();
  });
});

describe('generateChoiceQuestions (배치)', () => {
  it('지정한 개수만큼 문제 생성', () => {
    const questions = generateChoiceQuestions('interval', 'interval_1', 5);
    expect(questions).toHaveLength(5);
    questions.forEach(q => {
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(q.correctAnswer);
    });
  });

  it('0개 요청 시 빈 배열', () => {
    const questions = generateChoiceQuestions('interval', 'interval_1', 0);
    expect(questions).toHaveLength(0);
  });
});
