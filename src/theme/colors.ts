// ─────────────────────────────────────────────────────────────
// MelodyGen 디자인 토큰 — 색상
// ─────────────────────────────────────────────────────────────

export const COLORS = {
  // Primary (Indigo)
  primary50:  '#eef2ff',
  primary100: '#e0e7ff',
  primary200: '#c7d2fe',
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1',
  primary600: '#4f46e5',
  primary700: '#4338ca',

  // Secondary (Amber)
  amber50:  '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',

  // Neutral (Slate)
  slate50:  '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  // Semantic
  success:  '#10b981',
  error:    '#ef4444',
  warning:  '#f59e0b',

  // Background
  bgPrimary:   '#f8fafc',
  bgCard:      '#ffffff',
  bgOverlay:   'rgba(0,0,0,0.45)',

  // Track colors
  trackRhythm:       '#6366f1',  // indigo
  trackInterval:     '#8b5cf6',  // violet
  trackKey:          '#0ea5e9',  // sky
  trackComprehensive:'#f59e0b',  // amber

  // Plan tier
  tierFree:    '#94a3b8',
  tierPro:     '#6366f1',
  tierPremium: '#f59e0b',

  white: '#ffffff',
  black: '#000000',
} as const;

// ─────────────────────────────────────────────────────────────
// 트랙별 색상 세트
// ─────────────────────────────────────────────────────────────

export type TrackType = 'rhythm' | 'interval' | 'key' | 'comprehensive';

export const TRACK_COLORS: Record<TrackType, {
  main: string;
  bg: string;
  bgActive: string;
  text: string;
}> = {
  rhythm: {
    main: COLORS.trackRhythm,
    bg: '#eef2ff',
    bgActive: '#6366f1',
    text: '#4338ca',
  },
  interval: {
    main: COLORS.trackInterval,
    bg: '#f5f3ff',
    bgActive: '#8b5cf6',
    text: '#6d28d9',
  },
  key: {
    main: COLORS.trackKey,
    bg: '#f0f9ff',
    bgActive: '#0ea5e9',
    text: '#0369a1',
  },
  comprehensive: {
    main: COLORS.trackComprehensive,
    bg: '#fffbeb',
    bgActive: '#f59e0b',
    text: '#b45309',
  },
};
