import { EXAM_PRESETS } from '../lib/examPresets';

const VALID_CONTENT_TYPES = ['melody', 'rhythm', 'interval', 'chord', 'key', 'twoVoice'];

describe('EXAM_PRESETS', () => {
  it('5개의 프리셋이 존재한다', () => {
    expect(EXAM_PRESETS).toHaveLength(5);
  });

  it('각 프리셋이 필수 속성을 가진다', () => {
    for (const preset of EXAM_PRESETS) {
      expect(typeof preset.id).toBe('string');
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.description).toBe('string');
      expect(Array.isArray(preset.sections)).toBe(true);
      expect(preset.sections.length).toBeGreaterThan(0);
    }
  });

  it('각 섹션의 contentType이 유효하다', () => {
    for (const preset of EXAM_PRESETS) {
      for (const section of preset.sections) {
        expect(VALID_CONTENT_TYPES).toContain(section.contentType);
      }
    }
  });

  it('각 섹션의 questionCount가 양수이다', () => {
    for (const preset of EXAM_PRESETS) {
      for (const section of preset.sections) {
        expect(section.questionCount).toBeGreaterThan(0);
      }
    }
  });

  it('프리셋 ID가 모두 고유하다', () => {
    const ids = EXAM_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('기초 종합 프리셋이 올바르게 구성되어 있다', () => {
    const basic = EXAM_PRESETS.find(p => p.id === 'basic');
    expect(basic).toBeDefined();
    expect(basic!.name).toBe('기초 종합');
    expect(basic!.sections).toHaveLength(3);
  });

  it('고급 실전 프리셋이 6개 섹션을 가진다', () => {
    const advanced = EXAM_PRESETS.find(p => p.id === 'advanced');
    expect(advanced).toBeDefined();
    expect(advanced!.sections).toHaveLength(6);
  });
});
