import {
  getScaleDegrees,
  getKeySigAlteration,
  getKeySignatureAccidentalCount,
  KEY_SIG_MAP,
} from '../lib/scoreUtils/keySignature';

describe('getScaleDegrees', () => {
  it('C장조 음계', () => {
    expect(getScaleDegrees('C')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('G장조 음계', () => {
    expect(getScaleDegrees('G')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('Am 단조 음계 (자연단음계 구성음)', () => {
    expect(getScaleDegrees('Am')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('F장조 음계', () => {
    expect(getScaleDegrees('F')).toEqual(['F', 'G', 'A', 'B', 'C', 'D', 'E']);
  });

  it('D장조 음계', () => {
    expect(getScaleDegrees('D')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  });

  it('항상 7개 음을 반환한다', () => {
    expect(getScaleDegrees('E')).toHaveLength(7);
    expect(getScaleDegrees('Bb')).toHaveLength(7);
  });
});

describe('getKeySigAlteration', () => {
  it('G장조에서 F는 샤프', () => {
    expect(getKeySigAlteration('G', 'F')).toBe('#');
  });

  it('F장조에서 B는 플랫', () => {
    expect(getKeySigAlteration('F', 'B')).toBe('b');
  });

  it('C장조에서 C는 변화 없음', () => {
    expect(getKeySigAlteration('C', 'C')).toBe('');
  });

  it('D장조에서 F#, C#', () => {
    expect(getKeySigAlteration('D', 'F')).toBe('#');
    expect(getKeySigAlteration('D', 'C')).toBe('#');
    expect(getKeySigAlteration('D', 'G')).toBe('');
  });

  it('Eb장조에서 B, E, A 플랫', () => {
    expect(getKeySigAlteration('Eb', 'B')).toBe('b');
    expect(getKeySigAlteration('Eb', 'E')).toBe('b');
    expect(getKeySigAlteration('Eb', 'A')).toBe('b');
    expect(getKeySigAlteration('Eb', 'C')).toBe('');
  });
});

describe('getKeySignatureAccidentalCount', () => {
  it('C장조 → 0', () => {
    expect(getKeySignatureAccidentalCount('C')).toBe(0);
  });

  it('G장조 → 1', () => {
    expect(getKeySignatureAccidentalCount('G')).toBe(1);
  });

  it('D장조 → 2', () => {
    expect(getKeySignatureAccidentalCount('D')).toBe(2);
  });

  it('F장조 → 1', () => {
    expect(getKeySignatureAccidentalCount('F')).toBe(1);
  });

  it('Bb장조 → 2', () => {
    expect(getKeySignatureAccidentalCount('Bb')).toBe(2);
  });

  it('Am 단조 → 0', () => {
    expect(getKeySignatureAccidentalCount('Am')).toBe(0);
  });

  it('Em 단조 → 1', () => {
    expect(getKeySignatureAccidentalCount('Em')).toBe(1);
  });

  it('존재하지 않는 키 → 0', () => {
    expect(getKeySignatureAccidentalCount('X#')).toBe(0);
  });
});
