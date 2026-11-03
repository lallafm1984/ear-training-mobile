import {
  MAX_SHARE_CARD_STATS,
  buildShareText,
  normalizeShareStats,
  shareCardFileName,
  type ShareCardData,
} from '../lib/shareCard';

const base: ShareCardData = {
  kind: 'exam',
  title: '모의시험 결과',
  headline: '92점',
  headlineLabel: '총점 · A+',
  subtitle: '기초 청음 모의시험',
  stats: [
    { label: '등급', value: 'A+' },
    { label: '문항', value: '20' },
  ],
  date: '2026. 11. 3.',
};

describe('buildShareText', () => {
  it('제목·값·부제·지표·날짜·푸터·스토어 링크를 줄 단위로 구성한다', () => {
    const text = buildShareText(base, {
      brand: 'MelodyGen',
      footer: 'MelodyGen으로 청음 연습 중!',
      storeUrl: 'https://example.com/app',
    });
    expect(text.split('\n')).toEqual([
      '[MelodyGen] 모의시험 결과',
      '92점 · 총점 · A+',
      '기초 청음 모의시험',
      '등급 A+ · 문항 20',
      '2026. 11. 3.',
      '',
      'MelodyGen으로 청음 연습 중!',
      'https://example.com/app',
    ]);
  });

  it('선택 항목이 없으면 해당 줄을 생략한다', () => {
    const text = buildShareText(
      { kind: 'stats', title: '내 기록', headline: '7일', date: '오늘' },
      { brand: 'MelodyGen', footer: 'footer' },
    );
    expect(text).toBe('[MelodyGen] 내 기록\n7일\n오늘\n\nfooter');
  });
});

describe('normalizeShareStats', () => {
  it('빈 항목을 제거하고 최대 개수로 자른다', () => {
    const stats = normalizeShareStats([
      { label: 'a', value: '1' },
      { label: ' ', value: '2' },
      { label: 'b', value: '' },
      { label: 'c', value: '3' },
      { label: 'd', value: '4' },
      { label: 'e', value: '5' },
      { label: 'f', value: '6' },
    ]);
    expect(stats).toHaveLength(MAX_SHARE_CARD_STATS);
    expect(stats.map((s) => s.label)).toEqual(['a', 'c', 'd', 'e']);
    expect(normalizeShareStats(undefined)).toEqual([]);
  });
});

describe('shareCardFileName', () => {
  it('종류와 로컬 시각으로 파일 이름을 만든다', () => {
    const name = shareCardFileName('levelTest', new Date(2026, 10, 3, 9, 5));
    expect(name).toBe('melodygen-levelTest-20261103-0905');
  });
});
