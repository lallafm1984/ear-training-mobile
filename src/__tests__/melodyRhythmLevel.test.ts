import {
  getDurationPoolForMelodyLevel,
  getTrebleRhythmParamsForMelodyLevel,
} from '../lib/melodyRhythmLevel';

describe('getDurationPoolForMelodyLevel', () => {
  it('레벨 1은 온음표/2분음표 풀이다', () => {
    expect(getDurationPoolForMelodyLevel(1)).toEqual([16, 8]);
  });

  it('레벨 3은 8분음표를 포함한다', () => {
    const pool = getDurationPoolForMelodyLevel(3);
    expect(pool).toContain(2); // 8분음표 = 2 sixteenths
  });

  it('레벨 6은 16분음표를 포함한다', () => {
    const pool = getDurationPoolForMelodyLevel(6);
    expect(pool).toContain(1); // 16분음표 = 1 sixteenth
  });

  it('모든 레벨(1-9)이 비어있지 않은 배열을 반환한다', () => {
    for (let level = 1; level <= 9; level++) {
      const pool = getDurationPoolForMelodyLevel(level);
      expect(Array.isArray(pool)).toBe(true);
      expect(pool.length).toBeGreaterThan(0);
    }
  });

  it('범위 밖 레벨은 클램핑된다 (0 → 1, 10 → 9)', () => {
    expect(getDurationPoolForMelodyLevel(0)).toEqual(getDurationPoolForMelodyLevel(1));
    expect(getDurationPoolForMelodyLevel(10)).toEqual(getDurationPoolForMelodyLevel(9));
  });

  it('모든 풀의 값은 양수이다', () => {
    for (let level = 1; level <= 9; level++) {
      const pool = getDurationPoolForMelodyLevel(level);
      pool.forEach(v => expect(v).toBeGreaterThan(0));
    }
  });
});

describe('getTrebleRhythmParamsForMelodyLevel', () => {
  it('레벨 1은 모든 확률이 0이다', () => {
    const params = getTrebleRhythmParamsForMelodyLevel(1);
    expect(params.syncopationProb).toBe(0);
    expect(params.dottedProb).toBe(0);
    expect(params.tieProb).toBe(0);
    expect(params.tripletProb).toBe(0);
  });

  it('레벨 9는 셋잇단음표 확률이 0보다 크다', () => {
    const params = getTrebleRhythmParamsForMelodyLevel(9);
    expect(params.tripletProb).toBeGreaterThan(0);
    expect(params.tripletBudget[1]).toBeGreaterThan(0);
  });

  it('모든 레벨이 필수 속성을 가진다', () => {
    for (let level = 1; level <= 9; level++) {
      const params = getTrebleRhythmParamsForMelodyLevel(level);
      expect(params).toHaveProperty('syncopationProb');
      expect(params).toHaveProperty('dottedProb');
      expect(params).toHaveProperty('tieProb');
      expect(params).toHaveProperty('tripletProb');
      expect(params).toHaveProperty('tripletBudget');
      expect(params.tripletBudget).toHaveLength(2);
    }
  });

  it('반환값은 원본의 복사본이다 (수정해도 원본 불변)', () => {
    const a = getTrebleRhythmParamsForMelodyLevel(5);
    const b = getTrebleRhythmParamsForMelodyLevel(5);
    a.syncopationProb = 999;
    expect(b.syncopationProb).not.toBe(999);
  });
});
