// ─────────────────────────────────────────────────────────────
// shareCard — 결과 공유 카드 데이터 모델 + 텍스트 공유 문구 (순수 함수)
// ─────────────────────────────────────────────────────────────

export type ShareCardKind = 'exam' | 'practice' | 'levelTest' | 'stats' | 'course';

export interface ShareCardStat {
  label: string;
  value: string;
}

export interface ShareCardData {
  kind: ShareCardKind;
  /** 카드 제목 (예: "모의시험 결과") */
  title: string;
  /** 가장 크게 보이는 값 (예: "92점", "중급") */
  headline: string;
  /** 큰 값 아래 설명 (예: "총점 · A+") */
  headlineLabel?: string;
  /** 부제 (예: 시험 이름, 카테고리 · 난이도) */
  subtitle?: string;
  /** 보조 지표 (최대 4개까지 표시) */
  stats?: ShareCardStat[];
  /** 강조 색 (기본: 인디고) */
  accent?: string;
  /** 표시용 날짜 문자열 */
  date: string;
  mascotLevel?: number;
  happy?: boolean;
}

export const MAX_SHARE_CARD_STATS = 4;

export const SHARE_STORE_URL = 'https://play.google.com/store/apps/details?id=com.melodygen.app';

export interface ShareTextOptions {
  brand: string;
  footer: string;
  storeUrl?: string;
}

/** 텍스트 공유(메신저 등)용 문구 */
export function buildShareText(data: ShareCardData, opts: ShareTextOptions): string {
  const lines: string[] = [];
  lines.push(`[${opts.brand}] ${data.title}`);

  const headline = data.headlineLabel ? `${data.headline} · ${data.headlineLabel}` : data.headline;
  lines.push(headline);

  if (data.subtitle) lines.push(data.subtitle);

  const stats = (data.stats ?? []).slice(0, MAX_SHARE_CARD_STATS);
  if (stats.length > 0) {
    lines.push(stats.map((s) => `${s.label} ${s.value}`).join(' · '));
  }

  lines.push(data.date);
  lines.push('');
  lines.push(opts.footer);
  if (opts.storeUrl) lines.push(opts.storeUrl);
  return lines.join('\n');
}

/** 캡처 이미지 파일 이름 (확장자 제외) */
export function shareCardFileName(kind: ShareCardKind, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}`;
  return `melodygen-${kind}-${stamp}`;
}

/** 지표 목록을 카드 표시 개수로 자르고 빈 항목을 제거 */
export function normalizeShareStats(stats: ShareCardStat[] | undefined): ShareCardStat[] {
  if (!stats) return [];
  return stats
    .filter((s) => s && s.label.trim().length > 0 && s.value.trim().length > 0)
    .slice(0, MAX_SHARE_CARD_STATS);
}
