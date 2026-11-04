// ─────────────────────────────────────────────────────────────
// layout — 화면 크기 기준 반응형 레이아웃 판정 (태블릿·콘텐츠 최대 폭)
// ─────────────────────────────────────────────────────────────

/** 짧은 변이 이 값 이상이면 태블릿으로 본다 (dp) */
export const TABLET_MIN_SHORT_SIDE = 600;
/** 태블릿에서 스크롤 콘텐츠를 가운데 정렬할 최대 폭 */
export const CONTENT_MAX_WIDTH = 760;
/** 가운데 정렬되는 모달/알림 카드의 최대 폭 */
export const MODAL_MAX_WIDTH = 440;
/** 로그인·온보딩처럼 세로로 긴 폼/버튼 열의 최대 폭 (태블릿) */
export const NARROW_MAX_WIDTH = 480;
/** 아래에서 올라오는 시트(설정·공유 카드)의 최대 폭 (태블릿) */
export const SHEET_MAX_WIDTH = 560;

export type CenteredStyle =
  | { width: '100%'; maxWidth: number; alignSelf: 'center' }
  | Record<string, never>;

function centered(isTablet: boolean, maxWidth: number): CenteredStyle {
  return isTablet ? { width: '100%', maxWidth, alignSelf: 'center' } : {};
}

export interface LayoutInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  /** 태블릿이면 콘텐츠 최대 폭, 폰이면 undefined */
  contentMaxWidth: number | undefined;
  /** ScrollView contentContainerStyle에 합칠 스타일 (폰에서는 빈 객체) */
  contentStyle: CenteredStyle;
  /** 로그인 폼·온보딩 버튼처럼 폭이 넓어지면 어색한 열에 합칠 스타일 (폰에서는 빈 객체) */
  narrowStyle: CenteredStyle;
  /** 바닥 시트 컨테이너에 합칠 스타일 (폰에서는 빈 객체) */
  sheetStyle: CenteredStyle;
  /** 가로 그리드 열 수 (카테고리 카드 등). 폰 3열, 태블릿 5열(10종이 2행에 맞음) */
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
    contentStyle: centered(isTablet, CONTENT_MAX_WIDTH),
    narrowStyle: centered(isTablet, NARROW_MAX_WIDTH),
    sheetStyle: centered(isTablet, SHEET_MAX_WIDTH),
    gridColumns: isTablet ? 5 : 3,
  };
}

/** 가운데 모달 카드 폭: 화면 폭에서 여백을 뺀 값과 최대 폭 중 작은 쪽 */
export function modalCardWidth(screenWidth: number, horizontalMargin: number): number {
  return Math.min(screenWidth - horizontalMargin, MODAL_MAX_WIDTH);
}
