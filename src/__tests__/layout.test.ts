import {
  CONTENT_MAX_WIDTH,
  MODAL_MAX_WIDTH,
  NARROW_MAX_WIDTH,
  SHEET_MAX_WIDTH,
  getLayoutInfo,
  modalCardWidth,
} from '../lib/layout';

describe('getLayoutInfo', () => {
  it('폰 크기에서는 태블릿이 아니고 콘텐츠 스타일이 비어 있다', () => {
    const info = getLayoutInfo(390, 844);
    expect(info.isTablet).toBe(false);
    expect(info.contentMaxWidth).toBeUndefined();
    expect(info.contentStyle).toEqual({});
    expect(info.narrowStyle).toEqual({});
    expect(info.sheetStyle).toEqual({});
    expect(info.gridColumns).toBe(3);
  });

  it('짧은 변이 600 이상이면 태블릿으로 보고 콘텐츠를 가운데 정렬한다', () => {
    const portrait = getLayoutInfo(800, 1280);
    expect(portrait.isTablet).toBe(true);
    expect(portrait.isLandscape).toBe(false);
    expect(portrait.contentStyle).toEqual({
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    });
    expect(portrait.narrowStyle).toEqual({
      width: '100%',
      maxWidth: NARROW_MAX_WIDTH,
      alignSelf: 'center',
    });
    expect(portrait.sheetStyle).toEqual({
      width: '100%',
      maxWidth: SHEET_MAX_WIDTH,
      alignSelf: 'center',
    });
    expect(NARROW_MAX_WIDTH).toBeLessThan(SHEET_MAX_WIDTH);
    expect(SHEET_MAX_WIDTH).toBeLessThan(CONTENT_MAX_WIDTH);
    const landscape = getLayoutInfo(1280, 800);
    expect(landscape.isTablet).toBe(true);
    expect(landscape.isLandscape).toBe(true);
  });

  it('폴더블 펼침(짧은 변 600 미만)은 폰으로 취급한다', () => {
    expect(getLayoutInfo(590, 700).isTablet).toBe(false);
  });
});

describe('modalCardWidth', () => {
  it('화면 여백을 뺀 폭과 최대 폭 중 작은 값을 쓴다', () => {
    expect(modalCardWidth(390, 56)).toBe(334);
    expect(modalCardWidth(900, 56)).toBe(MODAL_MAX_WIDTH);
  });
});
