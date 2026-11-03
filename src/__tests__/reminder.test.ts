const mockNotifications = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
};
jest.mock('expo-notifications', () => mockNotifications);
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../lib/logger', () => ({ logger: { warn: jest.fn(), debug: jest.fn() } }));

import {
  DEFAULT_REMINDER_SETTINGS,
  REMINDER_PRESETS,
  formatReminderTime,
  normalizeReminderSettings,
  shiftReminderHour,
} from '../lib/reminder';
import {
  DAILY_REMINDER_CHANNEL_ID,
  DAILY_REMINDER_ID,
  cancelDailyReminder,
  ensureNotificationPermission,
  scheduleDailyReminder,
} from '../lib/notifications';

describe('리마인더 설정', () => {
  it('깨진 값은 기본값으로, 범위 밖 시각은 잘라낸다', () => {
    expect(normalizeReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(normalizeReminderSettings({ enabled: 'yes', hour: 30, minute: -5 })).toEqual({
      enabled: false,
      hour: 23,
      minute: 0,
    });
    expect(normalizeReminderSettings({ enabled: true, hour: 7, minute: 30 })).toEqual({
      enabled: true,
      hour: 7,
      minute: 30,
    });
  });

  it('HH:MM 으로 표시하고 시간은 24시간 안에서 돈다', () => {
    expect(formatReminderTime(8, 5)).toBe('08:05');
    expect(formatReminderTime(21, 30)).toBe('21:30');
    expect(shiftReminderHour(23, 1)).toBe(0);
    expect(shiftReminderHour(0, -1)).toBe(23);
    REMINDER_PRESETS.forEach((p) => {
      expect(p.hour).toBeGreaterThanOrEqual(0);
      expect(p.hour).toBeLessThan(24);
    });
  });
});

describe('로컬 알림 래퍼', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('권한이 있으면 다시 묻지 않는다', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await ensureNotificationPermission()).toBe(true);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('아직 안 물었으면 요청하고, 다시 물을 수 없으면 false', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await ensureNotificationPermission()).toBe(true);

    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    expect(await ensureNotificationPermission()).toBe(false);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('예약 전에 기존 리마인더를 지우고 매일 트리거로 같은 식별자를 쓴다', async () => {
    const ok = await scheduleDailyReminder(20, 30, {
      title: '제목',
      body: '본문',
      channelName: '채널',
    });
    expect(ok).toBe(true);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      DAILY_REMINDER_ID,
    );
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      DAILY_REMINDER_CHANNEL_ID,
      expect.objectContaining({ name: '채널' }),
    );
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: DAILY_REMINDER_ID,
      content: { title: '제목', body: '본문', sound: 'default' },
      trigger: { type: 'daily', hour: 20, minute: 30, channelId: DAILY_REMINDER_CHANNEL_ID },
    });
  });

  it('예약 실패는 false 로 알리고, 취소는 예외를 삼킨다', async () => {
    mockNotifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await scheduleDailyReminder(9, 0, { title: 't', body: 'b', channelName: 'c' })).toBe(
      false,
    );
    mockNotifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(cancelDailyReminder()).resolves.toBeUndefined();
  });
});
