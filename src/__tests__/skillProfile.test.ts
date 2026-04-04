import {
  getQuickStartRecommendation,
  buildGeneratorOptions,
  getMinBassDifficulty,
  getAllowedBassDifficulties,
  DEFAULT_SKILL_PROFILE,
  TRACK_META,
} from '../lib/trackConfig';
import type { UserSkillProfile } from '../lib/trackConfig';

describe('getQuickStartRecommendation', () => {
  it('기본 프로필: partPractice L1 추천', () => {
    const rec = getQuickStartRecommendation(DEFAULT_SKILL_PROFILE);
    expect(rec.track).toBe('partPractice');
    expect(rec.level).toBe(1);
  });

  it('높은 정확도: 레벨 +1 추천', () => {
    const profile: UserSkillProfile = {
      ...DEFAULT_SKILL_PROFILE,
      recentAccuracy: 0.85,
    };
    const rec = getQuickStartRecommendation(profile);
    expect(rec.level).toBe(2);
  });

  it('낮은 정확도 + 레벨 1: 레벨 1 유지 (하한)', () => {
    const profile: UserSkillProfile = {
      ...DEFAULT_SKILL_PROFILE,
      recentAccuracy: 0.3,
      partPracticeLevel: 1,
    };
    const rec = getQuickStartRecommendation(profile);
    expect(rec.level).toBeGreaterThanOrEqual(1);
  });

  it('같은 트랙 3회 연속: 다른 트랙으로 순환', () => {
    const profile: UserSkillProfile = {
      ...DEFAULT_SKILL_PROFILE,
      lastQuickTrack: 'partPractice',
      sameTrackCount: 3,
      partPracticeLevel: 1,
      comprehensiveLevel: 1,
    };
    const rec = getQuickStartRecommendation(profile);
    expect(rec.track).toBe('comprehensive');
  });

  it('partPractice 진행률 > comprehensive: comprehensive 우선 추천', () => {
    const profile: UserSkillProfile = {
      ...DEFAULT_SKILL_PROFILE,
      partPracticeLevel: 9, // max
      comprehensiveLevel: 1,
      recentAccuracy: 0.6,
    };
    const rec = getQuickStartRecommendation(profile);
    expect(rec.track).toBe('comprehensive');
  });

  it('최대 레벨에서 높은 정확도: 레벨이 max를 초과하지 않음', () => {
    const profile: UserSkillProfile = {
      ...DEFAULT_SKILL_PROFILE,
      partPracticeLevel: 9,
      comprehensiveLevel: 4,
      recentAccuracy: 0.95,
    };
    const rec = getQuickStartRecommendation(profile);
    expect(rec.level).toBeLessThanOrEqual(rec.maxLevel);
  });
});

describe('buildGeneratorOptions', () => {
  it('partPractice L1: C장조, 4/4, 4마디', () => {
    const opts = buildGeneratorOptions('partPractice', 1);
    expect(opts.keySignature).toBe('C');
    expect(opts.timeSignature).toBe('4/4');
    expect(opts.measures).toBe(4);
    expect(opts.useGrandStaff).toBe(false);
  });

  it('partPractice: 모든 레벨(1-9) 에러 없이 생성', () => {
    for (let level = 1; level <= 9; level++) {
      expect(() => buildGeneratorOptions('partPractice', level)).not.toThrow();
    }
  });

  it('partPractice 잘못된 레벨: 에러 발생', () => {
    expect(() => buildGeneratorOptions('partPractice', 0)).toThrow();
    expect(() => buildGeneratorOptions('partPractice', 10)).toThrow();
  });

  it('comprehensive: 모든 레벨(1-4) 에러 없이 생성', () => {
    for (let level = 1; level <= 4; level++) {
      expect(() => buildGeneratorOptions('comprehensive', level)).not.toThrow();
    }
  });

  it('comprehensive L3-4: 큰보표 가능', () => {
    // 랜덤이므로 여러 번 시도
    let sawGrandStaff = false;
    for (let i = 0; i < 20; i++) {
      const opts = buildGeneratorOptions('comprehensive', 4);
      if (opts.useGrandStaff) { sawGrandStaff = true; break; }
    }
    // 확률적이므로 반드시 나와야 하는 건 아니지만 20번이면 거의 확실
    expect(sawGrandStaff).toBe(true);
  });
});

describe('getMinBassDifficulty', () => {
  it('beginner → bass_1', () => {
    expect(getMinBassDifficulty('beginner_1')).toBe('bass_1');
    expect(getMinBassDifficulty('beginner_3')).toBe('bass_1');
  });

  it('intermediate → bass_2', () => {
    expect(getMinBassDifficulty('intermediate_1')).toBe('bass_2');
  });

  it('advanced → bass_3', () => {
    expect(getMinBassDifficulty('advanced_1')).toBe('bass_3');
  });
});

describe('getAllowedBassDifficulties', () => {
  it('beginner: bass_1 ~ bass_4 전체', () => {
    const allowed = getAllowedBassDifficulties('beginner_1');
    expect(allowed).toEqual(['bass_1', 'bass_2', 'bass_3', 'bass_4']);
  });

  it('advanced: bass_3 ~ bass_4', () => {
    const allowed = getAllowedBassDifficulties('advanced_1');
    expect(allowed).toEqual(['bass_3', 'bass_4']);
  });
});

describe('TRACK_META', () => {
  it('partPractice: 9레벨 메타데이터', () => {
    expect(TRACK_META.partPractice.maxLevel).toBe(9);
    expect(TRACK_META.partPractice.levels).toHaveLength(9);
  });

  it('comprehensive: 4레벨 메타데이터', () => {
    expect(TRACK_META.comprehensive.maxLevel).toBe(4);
    expect(TRACK_META.comprehensive.levels).toHaveLength(4);
  });

  it('Pro 필수 레벨이 올바르게 표시됨', () => {
    // partPractice L1-5 무료, L6-9 Pro
    TRACK_META.partPractice.levels.forEach(l => {
      if (l.level <= 5) expect(l.requiresPro).toBe(false);
      else expect(l.requiresPro).toBe(true);
    });
  });
});
