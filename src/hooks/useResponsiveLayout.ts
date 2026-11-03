// ─────────────────────────────────────────────────────────────
// useResponsiveLayout — 현재 창 크기 기반 레이아웃 정보 (태블릿 가운데 정렬 등)
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { getLayoutInfo, type LayoutInfo } from '../lib/layout';

export function useResponsiveLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getLayoutInfo(width, height), [width, height]);
}
