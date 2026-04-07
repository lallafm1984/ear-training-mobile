import {
  getContentConfig,
  getDifficultyList,
  getDifficultyLabel,
  CONTENT_CATEGORIES,
} from '../lib/contentConfig';
import type { ContentCategory } from '../types/content';

describe('CONTENT_CATEGORIES', () => {
  it('6개 카테고리가 존재한다', () => {
    expect(CONTENT_CATEGORIES).toHaveLength(6);
  });

  it('각 카테고리가 필수 속성을 가진다', () => {
    for (const cat of CONTENT_CATEGORIES) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('description');
      expect(cat).toHaveProperty('answerType');
      expect(cat).toHaveProperty('maxLevel');
      expect(typeof cat.maxLevel).toBe('number');
    }
  });

  it('카테고리 ID 목록이 올바르다', () => {
    const ids = CONTENT_CATEGORIES.map(c => c.id);
    expect(ids).toEqual(['melody', 'rhythm', 'interval', 'chord', 'key', 'twoVoice']);
  });
});

describe('getContentConfig', () => {
  const cases: [ContentCategory, string][] = [
    ['melody', '선율 받아쓰기'],
    ['rhythm', '리듬 받아쓰기'],
    ['interval', '음정 듣기'],
    ['chord', '화성 듣기'],
    ['key', '조성 판별'],
    ['twoVoice', '2성부 받아쓰기'],
  ];

  it.each(cases)('%s 카테고리의 이름이 올바르다', (id, expectedName) => {
    const config = getContentConfig(id);
    expect(config.id).toBe(id);
    expect(config.name).toBe(expectedName);
  });
});

describe('getDifficultyList', () => {
  it('melody 카테고리는 9개 난이도를 가진다', () => {
    const list = getDifficultyList('melody');
    expect(list).toHaveLength(9);
    expect(list[0]).toBe('beginner_1');
    expect(list[8]).toBe('advanced_3');
  });

  it('rhythm 카테고리는 6개 난이도를 가진다', () => {
    const list = getDifficultyList('rhythm');
    expect(list).toHaveLength(6);
    expect(list[0]).toBe('rhythm_1');
  });

  it('interval 카테고리는 4개 난이도를 가진다', () => {
    expect(getDifficultyList('interval')).toHaveLength(4);
  });

  it('chord 카테고리는 4개 난이도를 가진다', () => {
    expect(getDifficultyList('chord')).toHaveLength(4);
  });

  it('key 카테고리는 3개 난이도를 가진다', () => {
    expect(getDifficultyList('key')).toHaveLength(3);
  });

  it('twoVoice 카테고리는 4개 난이도를 가진다', () => {
    expect(getDifficultyList('twoVoice')).toHaveLength(4);
  });
});

describe('getDifficultyLabel', () => {
  it('melody beginner_1 라벨이 올바르다', () => {
    expect(getDifficultyLabel('melody', 'beginner_1' as any)).toBe('초급 1 · 온음표/2분음표');
  });

  it('rhythm rhythm_3 라벨이 올바르다', () => {
    expect(getDifficultyLabel('rhythm', 'rhythm_3' as any)).toBe('3단계 · 점음표 + 당김음');
  });

  it('존재하지 않는 난이도는 키 자체를 반환한다', () => {
    expect(getDifficultyLabel('melody', 'nonexistent' as any)).toBe('nonexistent');
  });
});
