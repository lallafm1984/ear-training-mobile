// ─────────────────────────────────────────────────────────────
// reminder — 매일 연습 리마인더 설정 (기기 전역, 순수 함수)
//
// 알림은 기기에 로컬로만 예약한다(서버·푸시 토큰 없음). 설정은 사용자 계정과 무관한
// 기기 설정이므로 소유자 접미사 없이 하나의 키에 저장한다.
// ─────────────────────────────────────────────────────────────

export interface ReminderSettings {
  enabled: boolean;
  /** 0~23 */
  hour: number;
  /** 0~59 */
  minute: number;
}

export const REMINDER_SETTINGS_KEY = '@melodygen_reminder';
/** 일일 목표 달성 후 "알림 켤까요?" 안내를 닫았는지 (기기 전역) */
export const REMINDER_NUDGE_DISMISSED_KEY = '@melodygen_reminder_nudge_dismissed';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, hour: 20, minute: 0 };

/** 빠른 선택용 시각 */
export const REMINDER_PRESETS: ReadonlyArray<{ hour: number; minute: number }> = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 30 },
];

export const REMINDER_MINUTE_OPTIONS = [0, 15, 30, 45] as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeReminderSettings(raw: unknown): ReminderSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_REMINDER_SETTINGS;
  const r = raw as Partial<ReminderSettings>;
  return {
    enabled: r.enabled === true,
    hour: clampInt(r.hour, 0, 23, DEFAULT_REMINDER_SETTINGS.hour),
    minute: clampInt(r.minute, 0, 59, DEFAULT_REMINDER_SETTINGS.minute),
  };
}

/** "HH:MM" (24시간제) */
export function formatReminderTime(hour: number, minute: number): string {
  const hh = String(clampInt(hour, 0, 23, 0)).padStart(2, '0');
  const mm = String(clampInt(minute, 0, 59, 0)).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function isSameReminderTime(
  a: { hour: number; minute: number },
  b: { hour: number; minute: number },
): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

/** 시간을 한 시간 단위로 돌린다 (23 → 0, 0 → 23) */
export function shiftReminderHour(hour: number, delta: number): number {
  return (((hour + delta) % 24) + 24) % 24;
}
