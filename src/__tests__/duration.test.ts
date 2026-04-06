import {
  durationToSixteenths,
  sixteenthsToDuration,
  getSixteenthsPerBar,
  isCompoundMeter,
  getBeamGroupSixteenths,
  getTupletNoteDuration,
} from '../lib/scoreUtils/duration';

describe('durationToSixteenths', () => {
  const cases: [string, number][] = [
    ['1', 16],
    ['1.', 24],
    ['2', 8],
    ['2.', 12],
    ['4', 4],
    ['4.', 6],
    ['8', 2],
    ['8.', 3],
    ['16', 1],
  ];

  it.each(cases)('duration "%s" → %d 16분음표', (dur, expected) => {
    expect(durationToSixteenths(dur as any)).toBe(expected);
  });
});

describe('sixteenthsToDuration', () => {
  it('16 → 온음표', () => {
    expect(sixteenthsToDuration(16)).toBe('1');
  });

  it('8 → 2분음표', () => {
    expect(sixteenthsToDuration(8)).toBe('2');
  });

  it('4 → 4분음표', () => {
    expect(sixteenthsToDuration(4)).toBe('4');
  });

  it('1 → 16분음표', () => {
    expect(sixteenthsToDuration(1)).toBe('16');
  });

  it('24 → 점온음표', () => {
    expect(sixteenthsToDuration(24)).toBe('1.');
  });
});

describe('getSixteenthsPerBar', () => {
  const cases: [string, number][] = [
    ['4/4', 16],
    ['3/4', 12],
    ['6/8', 12],
    ['2/4', 8],
    ['2/2', 16],
    ['3/8', 6],
  ];

  it.each(cases)('박자 %s → %d 16분음표', (ts, expected) => {
    expect(getSixteenthsPerBar(ts)).toBe(expected);
  });
});

describe('isCompoundMeter', () => {
  it('6/8은 복합 박자이다', () => {
    expect(isCompoundMeter('6/8')).toBe(true);
  });

  it('9/8은 복합 박자이다', () => {
    expect(isCompoundMeter('9/8')).toBe(true);
  });

  it('12/8은 복합 박자이다', () => {
    expect(isCompoundMeter('12/8')).toBe(true);
  });

  it('4/4는 복합 박자가 아니다', () => {
    expect(isCompoundMeter('4/4')).toBe(false);
  });

  it('3/4는 복합 박자가 아니다', () => {
    expect(isCompoundMeter('3/4')).toBe(false);
  });

  it('2/4는 복합 박자가 아니다', () => {
    expect(isCompoundMeter('2/4')).toBe(false);
  });

  it('3/8은 복합 박자가 아니다 (top < 6)', () => {
    expect(isCompoundMeter('3/8')).toBe(false);
  });
});

describe('getBeamGroupSixteenths', () => {
  it('4/4 → 4 (4분음표 단위)', () => {
    expect(getBeamGroupSixteenths('4/4')).toBe(4);
  });

  it('6/8 → 6 (점4분음표 단위)', () => {
    expect(getBeamGroupSixteenths('6/8')).toBe(6);
  });

  it('3/4 → 4', () => {
    expect(getBeamGroupSixteenths('3/4')).toBe(4);
  });

  it('2/2 → 8', () => {
    expect(getBeamGroupSixteenths('2/2')).toBe(8);
  });
});

describe('getTupletNoteDuration', () => {
  it('셋잇단음표(3) + 4분음표 span → 2', () => {
    expect(getTupletNoteDuration('3', '4')).toBe(2);
  });

  it('셋잇단음표(3) + 2분음표 span → 4', () => {
    expect(getTupletNoteDuration('3', '2')).toBe(4);
  });

  it('둘잇단음표(2) + 점4분음표 span → 2', () => {
    expect(getTupletNoteDuration('2', '4.')).toBe(2);
  });
});
