import { generateScore, getDifficultyCategory } from '../lib/scoreGenerator';
import { durationToSixteenths } from '../lib/scoreUtils';
import type { Difficulty, GeneratorOptions } from '../lib/scoreGenerator';

function makeOpts(overrides: Partial<GeneratorOptions> = {}): GeneratorOptions {
  return {
    keySignature: 'C',
    timeSignature: '4/4',
    difficulty: 'beginner_1',
    measures: 4,
    useGrandStaff: false,
    ...overrides,
  };
}

describe('getDifficultyCategory', () => {
  it('beginner 카테고리 분류', () => {
    expect(getDifficultyCategory('beginner_1')).toBe('beginner');
    expect(getDifficultyCategory('beginner_3')).toBe('beginner');
  });

  it('intermediate 카테고리 분류', () => {
    expect(getDifficultyCategory('intermediate_1')).toBe('intermediate');
    expect(getDifficultyCategory('intermediate_3')).toBe('intermediate');
  });

  it('advanced 카테고리 분류', () => {
    expect(getDifficultyCategory('advanced_1')).toBe('advanced');
    expect(getDifficultyCategory('advanced_3')).toBe('advanced');
  });
});

describe('generateScore', () => {
  const difficulties: Difficulty[] = [
    'beginner_1', 'beginner_2', 'beginner_3',
    'intermediate_1', 'intermediate_2', 'intermediate_3',
    'advanced_1', 'advanced_2', 'advanced_3',
  ];

  difficulties.forEach(diff => {
    it(`${diff}: trebleNotes 배열 반환 + 길이 > 0`, () => {
      const score = generateScore(makeOpts({ difficulty: diff }));
      expect(score.trebleNotes).toBeDefined();
      expect(Array.isArray(score.trebleNotes)).toBe(true);
      expect(score.trebleNotes.length).toBeGreaterThan(0);
    });
  });

  it('4/4 + 4마디: 올바른 총 길이', () => {
    const score = generateScore(makeOpts({ measures: 4, timeSignature: '4/4' }));
    // 4마디 * 4/4 = 16 16분음표 단위 per bar = 64 총 sixteenths
    const totalSixteenths = score.trebleNotes.reduce((sum, n) => sum + durationToSixteenths(n.duration), 0);
    expect(totalSixteenths).toBe(64);
  });

  it('3/4 박자: 올바른 총 길이', () => {
    const score = generateScore(makeOpts({ measures: 4, timeSignature: '3/4' }));
    // 4마디 * 3/4 = 12 16분음표 단위 per bar = 48 총 sixteenths
    const totalSixteenths = score.trebleNotes.reduce((sum, n) => sum + durationToSixteenths(n.duration), 0);
    expect(totalSixteenths).toBe(48);
  });

  it('useGrandStaff: bassNotes도 반환', () => {
    const score = generateScore(makeOpts({
      useGrandStaff: true,
      bassDifficulty: 'bass_1',
    }));
    expect(score.bassNotes).toBeDefined();
    expect(score.bassNotes.length).toBeGreaterThan(0);
  });

  it('useGrandStaff=false: bassNotes 빈 배열', () => {
    const score = generateScore(makeOpts({ useGrandStaff: false }));
    expect(score.bassNotes).toHaveLength(0);
  });

  it('다양한 조성에서 에러 없이 생성', () => {
    const keys = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb'];
    keys.forEach(key => {
      expect(() => generateScore(makeOpts({ keySignature: key }))).not.toThrow();
    });
  });

  it('trebleNotes의 각 노트가 필수 필드 포함', () => {
    const score = generateScore(makeOpts());
    score.trebleNotes.forEach(note => {
      expect(note).toHaveProperty('id');
      expect(note).toHaveProperty('duration');
      expect(typeof note.duration).toBe('string');
      expect(durationToSixteenths(note.duration)).toBeGreaterThan(0);
    });
  });
});
