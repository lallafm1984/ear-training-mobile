// ─────────────────────────────────────────────────────────────
// 로컬(기기 시간대) 기준 날짜 키 — 'YYYY-MM-DD'
// toISOString()은 UTC 기준이라 한국 시간 오전 9시 전에는 전날로 계산된다.
// ─────────────────────────────────────────────────────────────

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
