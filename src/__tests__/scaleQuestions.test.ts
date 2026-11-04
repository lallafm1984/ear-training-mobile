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
  SCALE_DIRECTIONS,
  SCALE_POOLS,
  SCALE_TEMPLATES,
  buildScaleWrongChoices,
  generateScaleQuestion,
  scaleStepSequence,
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
  (['scale_1', 'scale_2', 'scale_3', 'scale_4', 'scale_5'] as const).forEach((diff) => {
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

describe('scale_5 — 상행·하행', () => {
  const noteTokens = (abc: string) => abc.split('\n').pop()!.replace(' |]', '').split(' ');

  it('상행 후 하행: 음 수는 2n-1이고 마지막 음만 길다', () => {
    const body = scaleToAbcBody(60, 'major', 'both');
    const toks = body.split(' ');
    expect(toks).toHaveLength(15);
    expect(toks[toks.length - 1]).toMatch(/2$/);
    expect(toks.slice(0, -1).every((t) => !/\d$/.test(t))).toBe(true);
    expect(toks).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
      'c',
      'B',
      'A',
      'G',
      'F',
      'E',
      'D',
      'C2',
    ]);
  });

  it('가락단음계는 하행에서 자연단음계로 돌아온다 (제자리표·♭ 명시)', () => {
    expect(scaleToAbcBody(62, 'melodic_minor', 'both')).toBe('D E F G A B ^c d =c _B A G F E D2');
    // 화성단음계는 하행도 같은 형태 — M:none(마디 없음)이라 이미 적은 ♭은 다시 적지 않아도 유지된다
    expect(scaleToAbcBody(60, 'harmonic_minor', 'both')).toBe('C D _E F G _A B c B A G F E D C2');
  });

  it('scaleStepSequence: 상행만이면 템플릿과 같고, both면 하행형 템플릿을 거꾸로 이어 붙인다', () => {
    const up = scaleStepSequence('melodic_minor');
    expect(up.map((s) => s.step)).toEqual([0, 2, 3, 5, 7, 9, 11, 12]);
    const both = scaleStepSequence('melodic_minor', 'both');
    expect(both.map((s) => s.step)).toEqual([0, 2, 3, 5, 7, 9, 11, 12, 10, 8, 7, 5, 3, 2, 0]);
  });

  it('scale_5 문제: 정답·보기 모두 상·하행으로 연주되고 해설에 하행 안내가 붙는다', () => {
    expect(SCALE_DIRECTIONS.scale_5).toBe('both');
    let melodicSeen = false;
    for (let i = 0; i < 30; i++) {
      const q = generateScaleQuestion('scale_5');
      expect(q.prompt).toBe('상행 뒤 하행까지 듣고 음계 종류를 맞추세요.');
      for (const c of q.choices) {
        const toks = noteTokens(q.choiceAbc[c]);
        expect(toks.length).toBeGreaterThanOrEqual(15);
        expect(toks.length % 2).toBe(1);
      }
      if (q.correctAnswer.startsWith('가락단음계')) {
        melodicSeen = true;
        expect(q.explanation).toContain('자연단음계와 같아져요');
      } else {
        expect(q.explanation).toContain('하행');
      }
    }
    expect(melodicSeen).toBe(true);
  });

  it('1~4단계는 상행만 연주한다', () => {
    for (const diff of ['scale_1', 'scale_2', 'scale_3', 'scale_4'] as const) {
      const q = generateScaleQuestion(diff);
      const toks = noteTokens(q.abcNotation);
      expect(toks.length).toBeLessThanOrEqual(8);
    }
  });
});
