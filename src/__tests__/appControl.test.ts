import {
  ANNOUNCEMENT_SEEN_PREFIX,
  fetchAppControlConfig,
  getAnnouncementSeenKey,
  getAnnouncementSessionKey,
  normalizeAppControlLocale,
  parseAppControlConfig,
  parseNativeBuildNumber,
  type AppAnnouncement,
  type AppControlRpc,
} from '../lib/appControl';

const releaseResponse = {
  platform: 'android',
  latestBuild: 58,
  minimumSupportedBuild: 54,
  forceLatest: true,
  latestVersionName: '1.0.2',
  requiredBuild: 58,
  forceUpdate: false,
  storeUrl: 'https://play.google.com/store/apps/details?id=com.melodygen.app',
  title: '새 버전이 출시되었습니다',
  message: '최신 버전으로 업데이트해 주세요.',
  buttonLabel: '최신 버전으로 업데이트',
};

const announcementResponse = {
  id: 'service_notice',
  revision: 2,
  displayMode: 'once_per_build',
  title: '공지사항',
  body: '점검 안내입니다.',
  actionLabel: '자세히 보기',
  actionUrl: 'https://example.com/notice',
  confirmLabel: '확인',
};

describe('app control config', () => {
  it('forces every build older than latest when forceLatest is enabled', () => {
    const config = parseAppControlConfig(
      { release: releaseResponse, announcement: null },
      'android',
      57,
    );

    expect(config.release).toMatchObject({ requiredBuild: 58, forceUpdate: true });
  });

  it('allows the latest build and ignores an untrusted server forceUpdate flag', () => {
    const config = parseAppControlConfig(
      {
        release: { ...releaseResponse, forceUpdate: true },
        announcement: null,
      },
      'android',
      58,
    );

    expect(config.release?.forceUpdate).toBe(false);
  });

  it('uses minimumSupportedBuild when forceLatest is disabled', () => {
    const config = parseAppControlConfig(
      {
        release: { ...releaseResponse, forceLatest: false },
        announcement: null,
      },
      'android',
      55,
    );

    expect(config.release).toMatchObject({ requiredBuild: 54, forceUpdate: false });
  });

  it('rejects an impossible build range', () => {
    expect(() =>
      parseAppControlConfig(
        {
          release: {
            ...releaseResponse,
            latestBuild: 57,
            minimumSupportedBuild: 58,
          },
          announcement: null,
        },
        'android',
        58,
      ),
    ).toThrow('Invalid release build range');
  });

  it('rejects a release policy for another platform', () => {
    expect(() =>
      parseAppControlConfig(
        { release: { ...releaseResponse, platform: 'ios' }, announcement: null },
        'android',
        58,
      ),
    ).toThrow('Release platform mismatch');
  });

  it('accepts a localized announcement with an HTTPS action', () => {
    const config = parseAppControlConfig(
      { release: releaseResponse, announcement: announcementResponse },
      'android',
      58,
    );

    expect(config.announcement).toEqual(announcementResponse);
  });

  it('rejects non-HTTPS store and announcement links', () => {
    expect(() =>
      parseAppControlConfig(
        {
          release: { ...releaseResponse, storeUrl: 'market://details?id=com.melodygen.app' },
          announcement: null,
        },
        'android',
        58,
      ),
    ).toThrow('Invalid release.storeUrl');

    expect(() =>
      parseAppControlConfig(
        {
          release: releaseResponse,
          announcement: { ...announcementResponse, actionUrl: 'javascript:alert(1)' },
        },
        'android',
        58,
      ),
    ).toThrow('Invalid announcement.actionUrl');
  });

  it('calls the public RPC with build, platform, and locale', async () => {
    const rpc = jest.fn<ReturnType<AppControlRpc>, Parameters<AppControlRpc>>().mockResolvedValue({
      data: { release: releaseResponse, announcement: announcementResponse },
      error: null,
    });

    const result = await fetchAppControlConfig(rpc, 'android', 58, 'ko');

    expect(rpc).toHaveBeenCalledWith('get_app_control_config', {
      p_platform: 'android',
      p_build: 58,
      p_locale: 'ko',
    });
    expect(result.config.announcement?.id).toBe('service_notice');
  });

  it('propagates an RPC error so the gate can use its cache', async () => {
    const rpc = jest.fn<ReturnType<AppControlRpc>, Parameters<AppControlRpc>>().mockResolvedValue({
      data: null,
      error: { message: 'app control unavailable' },
    });

    await expect(fetchAppControlConfig(rpc, 'android', 58, 'ko')).rejects.toThrow(
      'app control unavailable',
    );
  });
});

describe('app control runtime helpers', () => {
  const announcement: AppAnnouncement = {
    id: 'service_notice',
    revision: 2,
    displayMode: 'once',
    title: '공지사항',
    body: '내용',
    actionLabel: null,
    actionUrl: null,
    confirmLabel: '확인',
  };

  it('prefers the native build version and falls back to app config', () => {
    expect(parseNativeBuildNumber('59', 58)).toBe(59);
    expect(parseNativeBuildNumber(null, 58)).toBe(58);
    expect(parseNativeBuildNumber('not-a-number', '58')).toBe(58);
    expect(parseNativeBuildNumber('', undefined)).toBeNull();
  });

  it('normalizes supported locales and falls back to Korean', () => {
    expect(normalizeAppControlLocale('en-US')).toBe('en');
    expect(normalizeAppControlLocale('ja_JP')).toBe('ja');
    expect(normalizeAppControlLocale('fr-FR')).toBe('ko');
  });

  it('builds stable persisted and per-build announcement keys', () => {
    expect(getAnnouncementSeenKey(announcement, 58)).toBe(
      `${ANNOUNCEMENT_SEEN_PREFIX}:service_notice:2`,
    );
    expect(getAnnouncementSeenKey({ ...announcement, displayMode: 'once_per_build' }, 58)).toBe(
      `${ANNOUNCEMENT_SEEN_PREFIX}:service_notice:2:58`,
    );
    expect(getAnnouncementSeenKey({ ...announcement, displayMode: 'every_launch' }, 58)).toBeNull();
    expect(getAnnouncementSessionKey(announcement, 58)).toBe('service_notice:2:58');
  });

  it('scopes daily announcements to the device local calendar date', () => {
    const firstDay = new Date(2026, 7, 22, 23, 59);
    const nextDay = new Date(2026, 7, 23, 0, 1);
    const dailyAnnouncement = { ...announcement, displayMode: 'daily' as const };

    expect(getAnnouncementSeenKey(dailyAnnouncement, 60, firstDay)).toBe(
      `${ANNOUNCEMENT_SEEN_PREFIX}:service_notice:2:2026-08-22`,
    );
    expect(getAnnouncementSeenKey(dailyAnnouncement, 60, nextDay)).toBe(
      `${ANNOUNCEMENT_SEEN_PREFIX}:service_notice:2:2026-08-23`,
    );
    expect(getAnnouncementSessionKey(dailyAnnouncement, 60, firstDay)).toBe(
      'service_notice:2:60:2026-08-22',
    );
    expect(getAnnouncementSessionKey(dailyAnnouncement, 60, nextDay)).toBe(
      'service_notice:2:60:2026-08-23',
    );
  });
});
