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
  SCALE_POOLS,
  SCALE_TEMPLATES,
  buildScaleWrongChoices,
  generateScaleQuestion,
  scaleToAbcBody,
} from '../lib/scaleQuestions';
import { generateChoiceQuestion } from '../lib/questionGenerator';

describe('SCALE_TEMPLATES', () => {
  it('모든 템플릿은 근음에서 시작해 옥타브(12)로 끝나고 글자 수가 일치한다', () => {
    Object.entries(SCALE_TEMPLATES).forEach(([, tpl]) => {
      expect(tpl.steps[0]).toBe(0);
      expect(tpl.steps[tpl.steps.length - 1]).toBe(12);
      expect(tpl.letters).toHaveLength(tpl.steps.length);
      expect(tpl.letters[tpl.letters.length - 1]).toBe(7);
      for (let i = 1; i < tpl.steps.length; i++)
        expect(tpl.steps[i]).toBeGreaterThan(tpl.steps[i - 1]);
    });
  });

  it('장음계·이오니안, 자연단음계·에올리안은 같은 소리다', () => {
    expect(SCALE_TEMPLATES.major.steps).toEqual(SCALE_TEMPLATES.ionian.steps);
    expect(SCALE_TEMPLATES.natural_minor.steps).toEqual(SCALE_TEMPLATES.aeolian.steps);
  });

  it('난이도 풀 안에서는 같은 소리의 음계가 겹치지 않는다', () => {
    Object.values(SCALE_POOLS).forEach((pool) => {
      const seen = new Set<string>();
      pool.forEach((id) => {
        const key = SCALE_TEMPLATES[id].steps.join(',');
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      });
    });
  });
});

describe('scaleToAbcBody', () => {
  it('C 장음계는 임시표 없이 상행하고 마지막 음이 4분음표다', () => {
    expect(scaleToAbcBody(60, 'major')).toBe('C D E F G A B c2');
  });

  it('C 리디안은 F에만 올림표가 붙는다', () => {
    expect(scaleToAbcBody(60, 'lydian')).toBe('C D E ^F G A B c2');
  });

  it('C 프리지안은 내림표로 적는다', () => {
    expect(scaleToAbcBody(60, 'phrygian')).toBe('C _D _E F G _A _B c2');
  });

  it('D♭ 근음은 내림표 철자, F♯ 근음은 올림표 철자를 쓴다', () => {
    expect(scaleToAbcBody(61, 'major')).toBe('_D _E F _G _A _B c _d2');
    expect(scaleToAbcBody(66, 'major')).toBe('^F ^G ^A B ^c ^d ^e ^f2');
  });

  it('블루스 음계는 같은 글자에 내림표 뒤 제자리표를 명시한다', () => {
    expect(scaleToAbcBody(60, 'blues')).toBe('C _E F _G =G _B c2');
  });

  it('화성단음계는 7음만 올린다', () => {
    expect(scaleToAbcBody(62, 'harmonic_minor')).toBe('D E F G A _B ^c d2');
  });
});

describe('buildScaleWrongChoices', () => {
  it('풀 안에서 정답을 제외한 보기를 요청 수만큼 고른다', () => {
    const wrong = buildScaleWrongChoices('dorian', SCALE_POOLS.scale_3, 3);
    expect(wrong).toHaveLength(3);
    expect(wrong).not.toContain('dorian');
    expect(new Set(wrong).size).toBe(3);
    wrong.forEach((w) => expect(SCALE_POOLS.scale_3).toContain(w));
  });

  it('2지선다 풀에서는 나머지 하나를 돌려준다', () => {
    expect(buildScaleWrongChoices('major', SCALE_POOLS.scale_1, 1)).toEqual(['natural_minor']);
  });
});

describe('generateScaleQuestion', () => {
  (['scale_1', 'scale_2', 'scale_3', 'scale_4'] as const).forEach((diff) => {
    it(`${diff}: 보기·정답·비교 청취 ABC·해설을 갖춘다`, () => {
      for (let i = 0; i < 20; i++) {
        const q = generateScaleQuestion(diff);
        expect(q.contentType).toBe('scale');
        expect(q.difficulty).toBe(diff);
        expect(q.choices).toHaveLength(diff === 'scale_1' ? 2 : 4);
        expect(q.choices).toContain(q.correctAnswer);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.abcNotation).toContain('M:none');
        expect(q.choiceAbc[q.correctAnswer]).toBe(q.abcNotation);
        q.choices.forEach((c) => expect(q.choiceAbc[c]).toBeTruthy());
        expect(q.explanation.length).toBeGreaterThan(10);
        expect(q.prompt).toBeTruthy();
      }
    });
  });

  it('generateChoiceQuestion에서 scale 카테고리로 호출된다', () => {
    const q = generateChoiceQuestion('scale', 'scale_2');
    expect(q.contentType).toBe('scale');
  });

  it('같은 음계가 연속 두 번 나오지 않는다', () => {
    let prev = generateScaleQuestion('scale_3').correctAnswer;
    for (let i = 0; i < 15; i++) {
      const next = generateScaleQuestion('scale_3').correctAnswer;
      expect(next).not.toBe(prev);
      prev = next;
    }
  });
});
