// ─────────────────────────────────────────────────────────────
// notifications — expo-notifications 얇은 래퍼 (로컬 알림 전용)
//
// 원격 푸시·토큰·서버 연동은 없다. 매일 같은 시각에 울리는 로컬 알림 하나만 다룬다.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logger } from './logger';

export const DAILY_REMINDER_ID = 'daily-practice-reminder';
export const DAILY_REMINDER_CHANNEL_ID = 'daily-reminder';

/** 알림 권한이 있는지 확인하고, 아직 묻지 않았다면 요청한다. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch (e) {
    logger.warn('[notifications] 권한 확인 실패:', e);
    return false;
  }
}

export interface DailyReminderContent {
  title: string;
  body: string;
  channelName: string;
}

/** 매일 hour:minute 에 울리는 리마인더를 (기존 것을 지우고) 예약한다. */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  content: DailyReminderContent,
): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL_ID, {
        name: content.channelName,
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: { title: content.title, body: content.body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: DAILY_REMINDER_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch (e) {
    logger.warn('[notifications] 리마인더 예약 실패:', e);
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch (e) {
    logger.warn('[notifications] 리마인더 취소 실패:', e);
  }
}
