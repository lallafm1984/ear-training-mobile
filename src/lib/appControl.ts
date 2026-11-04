export const APP_CONTROL_CACHE_KEY = '@melodygen_app_control_config_v1';
export const ANNOUNCEMENT_SEEN_PREFIX = '@melodygen_announcement_seen_v1';

export type AppControlPlatform = 'android' | 'ios';
export type AnnouncementDisplayMode = 'once' | 'daily' | 'every_launch' | 'once_per_build';

export interface AppReleasePolicy {
  platform: AppControlPlatform;
  latestBuild: number;
  minimumSupportedBuild: number;
  requiredBuild: number;
  latestVersionName: string | null;
  storeUrl: string;
  title: string;
  message: string;
  buttonLabel: string;
  forceUpdate: boolean;
}

export interface AppAnnouncement {
  id: string;
  revision: number;
  displayMode: AnnouncementDisplayMode;
  title: string;
  body: string;
  actionLabel: string | null;
  actionUrl: string | null;
  confirmLabel: string;
}

export interface AppControlConfig {
  release: AppReleasePolicy | null;
  announcement: AppAnnouncement | null;
}

export interface AppControlRpcResult {
  data: unknown;
  error: { message: string } | null;
}

export type AppControlRpc = (
  fn: 'get_app_control_config',
  args: {
    p_platform: AppControlPlatform;
    p_build: number;
    p_locale: string;
  },
) => PromiseLike<AppControlRpcResult>;

export interface FetchedAppControlConfig {
  config: AppControlConfig;
  raw: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireInteger(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new Error(`Invalid ${field}`);
  }
  return value as number;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function requireHttpsUrl(value: unknown, field: string): string {
  const url = requireString(value, field);
  if (!/^https:\/\/[^\s]+$/i.test(url)) {
    throw new Error(`Invalid ${field}`);
  }
  return url;
}

function parseReleasePolicy(
  value: unknown,
  platform: AppControlPlatform,
  currentBuild: number,
): AppReleasePolicy | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('Invalid release policy');

  const remotePlatform = requireString(value.platform, 'release.platform');
  if (remotePlatform !== platform) throw new Error('Release platform mismatch');

  const latestBuild = requireInteger(value.latestBuild, 'release.latestBuild', 1);
  const minimumSupportedBuild = requireInteger(
    value.minimumSupportedBuild,
    'release.minimumSupportedBuild',
    1,
  );
  const forceLatest = value.forceLatest === true;
  const requiredBuild = forceLatest ? latestBuild : minimumSupportedBuild;

  if (minimumSupportedBuild > latestBuild) {
    throw new Error('Invalid release build range');
  }

  return {
    platform,
    latestBuild,
    minimumSupportedBuild,
    requiredBuild,
    latestVersionName: optionalString(value.latestVersionName),
    storeUrl: requireHttpsUrl(value.storeUrl, 'release.storeUrl'),
    title: requireString(value.title, 'release.title'),
    message: requireString(value.message, 'release.message'),
    buttonLabel: requireString(value.buttonLabel, 'release.buttonLabel'),
    // 서버 응답의 forceUpdate 값을 그대로 신뢰하지 않고 설치 빌드와 다시 비교한다.
    forceUpdate: currentBuild < requiredBuild,
  };
}

function parseAnnouncement(value: unknown): AppAnnouncement | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('Invalid announcement');

  const displayMode = requireString(
    value.displayMode,
    'announcement.displayMode',
  ) as AnnouncementDisplayMode;
  if (!['once', 'daily', 'every_launch', 'once_per_build'].includes(displayMode)) {
    throw new Error('Invalid announcement.displayMode');
  }

  const actionUrl =
    value.actionUrl === null || value.actionUrl === undefined
      ? null
      : requireHttpsUrl(value.actionUrl, 'announcement.actionUrl');
  const actionLabel = actionUrl
    ? requireString(value.actionLabel, 'announcement.actionLabel')
    : null;

  return {
    id: requireString(value.id, 'announcement.id'),
    revision: requireInteger(value.revision, 'announcement.revision', 1),
    displayMode,
    title: requireString(value.title, 'announcement.title'),
    body: requireString(value.body, 'announcement.body'),
    actionLabel,
    actionUrl,
    confirmLabel: requireString(value.confirmLabel, 'announcement.confirmLabel'),
  };
}

export function parseAppControlConfig(
  value: unknown,
  platform: AppControlPlatform,
  currentBuild: number,
): AppControlConfig {
  if (!isRecord(value)) throw new Error('Invalid app control response');

  return {
    release: parseReleasePolicy(value.release, platform, currentBuild),
    announcement: parseAnnouncement(value.announcement),
  };
}

export async function fetchAppControlConfig(
  rpc: AppControlRpc,
  platform: AppControlPlatform,
  currentBuild: number,
  locale: string,
): Promise<FetchedAppControlConfig> {
  const { data, error } = await rpc('get_app_control_config', {
    p_platform: platform,
    p_build: currentBuild,
    p_locale: locale,
  });

  if (error) throw new Error(error.message);

  return {
    config: parseAppControlConfig(data, platform, currentBuild),
    raw: data,
  };
}

export function parseNativeBuildNumber(
  nativeBuildVersion: string | null | undefined,
  fallbackBuild: string | number | null | undefined,
): number | null {
  for (const candidate of [nativeBuildVersion, fallbackBuild]) {
    if (candidate === null || candidate === undefined || candidate === '') continue;
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function normalizeAppControlLocale(locale: string | null | undefined): 'ko' | 'en' | 'ja' {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return language === 'en' || language === 'ja' ? language : 'ko';
}

export function getAnnouncementSeenKey(
  announcement: AppAnnouncement,
  currentBuild: number,
  now = new Date(),
): string | null {
  if (announcement.displayMode === 'every_launch') return null;

  const base = `${ANNOUNCEMENT_SEEN_PREFIX}:${announcement.id}:${announcement.revision}`;
  if (announcement.displayMode === 'daily') return `${base}:${formatLocalDate(now)}`;
  return announcement.displayMode === 'once_per_build' ? `${base}:${currentBuild}` : base;
}

export function getAnnouncementSessionKey(
  announcement: AppAnnouncement,
  currentBuild: number,
  now = new Date(),
): string {
  const base = `${announcement.id}:${announcement.revision}:${currentBuild}`;
  return announcement.displayMode === 'daily' ? `${base}:${formatLocalDate(now)}` : base;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
