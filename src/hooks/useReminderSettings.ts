// ─────────────────────────────────────────────────────────────
// useReminderSettings — 매일 연습 리마인더 설정 저장 + 로컬 알림 예약 동기화
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_REMINDER_SETTINGS,
  REMINDER_SETTINGS_KEY,
  normalizeReminderSettings,
  type ReminderSettings,
} from '../lib/reminder';
import {
  cancelDailyReminder,
  ensureNotificationPermission,
  scheduleDailyReminder,
} from '../lib/notifications';

export type ReminderUpdateOutcome = 'saved' | 'permission_denied' | 'schedule_failed';

export function useReminderSettings() {
  const { t, i18n } = useTranslation(['profile']);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
        const next = raw ? normalizeReminderSettings(JSON.parse(raw)) : DEFAULT_REMINDER_SETTINGS;
        if (!cancelled) {
          settingsRef.current = next;
          setSettings(next);
        }
      } catch {
        // 기본값 유지
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = useCallback(
    () => ({
      title: t('profile:reminder.notificationTitle'),
      body: t('profile:reminder.notificationBody'),
      channelName: t('profile:reminder.channelName'),
    }),
    [t],
  );

  /** 설정을 저장하고 알림 예약을 맞춘다. */
  const apply = useCallback(
    async (next: ReminderSettings): Promise<ReminderUpdateOutcome> => {
      if (next.enabled) {
        const granted = await ensureNotificationPermission();
        if (!granted) return 'permission_denied';
        const ok = await scheduleDailyReminder(next.hour, next.minute, content());
        if (!ok) return 'schedule_failed';
      } else {
        await cancelDailyReminder();
      }
      settingsRef.current = next;
      setSettings(next);
      try {
        await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패 시 화면 값만 유지
      }
      return 'saved';
    },
    [content],
  );

  const setEnabled = useCallback(
    (enabled: boolean) => apply({ ...settingsRef.current, enabled }),
    [apply],
  );

  const setTime = useCallback(
    (hour: number, minute: number) => apply({ ...settingsRef.current, hour, minute }),
    [apply],
  );

  // 언어가 바뀌면 알림 문구도 새 언어로 다시 예약한다.
  const lastLanguage = useRef(i18n.language);
  useEffect(() => {
    if (!loaded) return;
    if (lastLanguage.current === i18n.language) return;
    lastLanguage.current = i18n.language;
    if (settingsRef.current.enabled) {
      void scheduleDailyReminder(settingsRef.current.hour, settingsRef.current.minute, content());
    }
  }, [i18n.language, loaded, content]);

  return { settings, loaded, setEnabled, setTime };
}
