import { toLocalDateKey } from '../lib/localDate';

describe('toLocalDateKey', () => {
  it('기기 시간대의 연-월-일을 0 채움 형식으로 반환한다', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(toLocalDateKey(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
  });

  it('자정 직후도 UTC가 아닌 로컬 날짜를 쓴다', () => {
    const justAfterMidnight = new Date(2026, 10, 4, 0, 1);
    expect(toLocalDateKey(justAfterMidnight)).toBe('2026-11-04');
  });
});
