// ─────────────────────────────────────────────────────────────
// layout — 화면 크기 기준 반응형 레이아웃 판정 (태블릿·콘텐츠 최대 폭)
// ─────────────────────────────────────────────────────────────

/** 짧은 변이 이 값 이상이면 태블릿으로 본다 (dp) */
export const TABLET_MIN_SHORT_SIDE = 600;
/** 태블릿에서 스크롤 콘텐츠를 가운데 정렬할 최대 폭 */
export const CONTENT_MAX_WIDTH = 760;
/** 가운데 정렬되는 모달/알림 카드의 최대 폭 */
export const MODAL_MAX_WIDTH = 440;

export interface LayoutInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  /** 태블릿이면 콘텐츠 최대 폭, 폰이면 undefined */
  contentMaxWidth: number | undefined;
  /** ScrollView contentContainerStyle에 합칠 스타일 (폰에서는 빈 객체) */
  contentStyle: { width: '100%'; maxWidth: number; alignSelf: 'center' } | Record<string, never>;
  /** 가로 그리드 열 수 (카테고리 카드 등) */
  gridColumns: number;
}

export function getLayoutInfo(width: number, height: number): LayoutInfo {
  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= TABLET_MIN_SHORT_SIDE;
  const isLandscape = width > height;
  const contentMaxWidth = isTablet ? CONTENT_MAX_WIDTH : undefined;
  return {
    width,
    height,
    isTablet,
    isLandscape,
    contentMaxWidth,
    contentStyle: isTablet
      ? { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }
      : {},
    gridColumns: isTablet ? 4 : 3,
  };
}

/** 가운데 모달 카드 폭: 화면 폭에서 여백을 뺀 값과 최대 폭 중 작은 쪽 */
export function modalCardWidth(screenWidth: number, horizontalMargin: number): number {
  return Math.min(screenWidth - horizontalMargin, MODAL_MAX_WIDTH);
}
