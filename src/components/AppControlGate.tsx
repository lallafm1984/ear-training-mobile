import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Download, ExternalLink, Megaphone, RefreshCw } from 'lucide-react-native';
import React, { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  APP_CONTROL_CACHE_KEY,
  AppAnnouncement,
  AppControlConfig,
  AppControlPlatform,
  AppControlRpc,
  AppControlRpcResult,
  AppReleasePolicy,
  fetchAppControlConfig,
  getAnnouncementSeenKey,
  getAnnouncementSessionKey,
  normalizeAppControlLocale,
  parseAppControlConfig,
  parseNativeBuildNumber,
} from '../lib/appControl';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme';
import SplashScreen from './SplashScreen';

const CONTROL_REQUEST_TIMEOUT_MS = 5_000;
const EMPTY_CONTROL_CONFIG: AppControlConfig = { release: null, announcement: null };

interface Props {
  children: ReactNode;
}

interface RefreshOptions {
  initial?: boolean;
  showProgress?: boolean;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error('App control request timed out')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function getRuntimeBuildNumber(): number | null {
  const fallback =
    Platform.OS === 'android'
      ? Constants.expoConfig?.android?.versionCode
      : Constants.expoConfig?.ios?.buildNumber;
  return parseNativeBuildNumber(Application.nativeBuildVersion, fallback);
}

function getControlPlatform(): AppControlPlatform | null {
  return Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;
}

interface ForceUpdateScreenProps {
  policy: AppReleasePolicy;
  currentBuild: number;
  openingStore: boolean;
  refreshing: boolean;
  error: string | null;
  onOpenStore: () => void;
  onRefresh: () => void;
}

function ForceUpdateScreen({
  policy,
  currentBuild,
  openingStore,
  refreshing,
  error,
  onOpenStore,
  onRefresh,
}: ForceUpdateScreenProps) {
  const { t } = useTranslation('common');

  return (
    <SafeAreaView style={styles.updateSafeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.updateScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.updateCard} accessibilityViewIsModal>
          <View style={styles.updateIconWrap}>
            <Download size={34} color={COLORS.primary600} strokeWidth={2.2} />
          </View>

          <Text style={styles.updateEyebrow}>MELODYGEN</Text>
          <Text style={styles.updateTitle} accessibilityRole="header">
            {policy.title}
          </Text>
          <Text style={styles.updateMessage}>{policy.message}</Text>

          {policy.latestVersionName ? (
            <View style={styles.versionPill}>
              <Text style={styles.versionPillText}>v{policy.latestVersionName}</Text>
            </View>
          ) : null}

          <View style={styles.buildInfoRow}>
            <Text style={styles.buildInfoText}>
              {t('appControl.currentBuild', { build: currentBuild })}
            </Text>
            <View style={styles.buildDivider} />
            <Text style={styles.buildInfoText}>
              {t('appControl.requiredBuild', { build: policy.requiredBuild })}
            </Text>
          </View>

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, openingStore && styles.buttonDisabled]}
            onPress={onOpenStore}
            activeOpacity={0.78}
            disabled={openingStore}
            accessibilityRole="button"
            accessibilityLabel={policy.buttonLabel}
          >
            {openingStore ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <ExternalLink size={19} color={COLORS.white} />
            )}
            <Text style={styles.primaryButtonText}>
              {openingStore ? t('appControl.openingStore') : policy.buttonLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
            activeOpacity={0.72}
            disabled={refreshing}
            accessibilityRole="button"
            accessibilityLabel={t('appControl.retryButton')}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.primary600} />
            ) : (
              <RefreshCw size={17} color={COLORS.primary600} />
            )}
            <Text style={styles.retryButtonText}>{t('appControl.retryButton')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface AnnouncementModalProps {
  announcement: AppAnnouncement | null;
  actionBusy: boolean;
  error: string | null;
  onDismiss: () => void;
  onAction: () => void;
}

function AnnouncementModal({
  announcement,
  actionBusy,
  error,
  onDismiss,
  onAction,
}: AnnouncementModalProps) {
  return (
    <Modal
      visible={announcement !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={announcement?.confirmLabel}
        />

        {announcement ? (
          <View style={styles.noticeCard} accessibilityViewIsModal>
            <View style={styles.noticeIconWrap}>
              <Megaphone size={27} color={COLORS.primary600} />
            </View>
            <Text style={styles.noticeTitle} accessibilityRole="header">
              {announcement.title}
            </Text>

            <ScrollView
              style={styles.noticeBodyScroll}
              contentContainerStyle={styles.noticeBodyContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.noticeBody}>{announcement.body}</Text>
            </ScrollView>

            {error ? (
              <Text style={styles.noticeError} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            {announcement.actionUrl && announcement.actionLabel ? (
              <TouchableOpacity
                style={[styles.noticeActionButton, actionBusy && styles.buttonDisabled]}
                onPress={onAction}
                disabled={actionBusy}
                activeOpacity={0.78}
                accessibilityRole="link"
                accessibilityLabel={announcement.actionLabel}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <ExternalLink size={17} color={COLORS.white} />
                )}
                <Text style={styles.noticeActionText}>{announcement.actionLabel}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.noticeConfirmButton}
              onPress={onDismiss}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={announcement.confirmLabel}
            >
              <Text style={styles.noticeConfirmText}>{announcement.confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export default function AppControlGate({ children }: Props) {
  const { t, i18n } = useTranslation('common');
  const platform = getControlPlatform();
  const currentBuild = getRuntimeBuildNumber();
  const locale = normalizeAppControlLocale(i18n.resolvedLanguage ?? i18n.language);

  const [controlConfig, setControlConfig] = useState<AppControlConfig>(EMPTY_CONTROL_CONFIG);
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [initialLoading, setInitialLoading] = useState(platform !== null && currentBuild !== null);
  const [refreshing, setRefreshing] = useState(false);
  const [openingStore, setOpeningStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [announcementActionBusy, setAnnouncementActionBusy] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const sessionDismissedRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const applyConfig = useCallback(
    async (config: AppControlConfig, requestId: number) => {
      if (!mountedRef.current || requestId !== requestIdRef.current || currentBuild === null)
        return;
      setControlConfig(config);

      const nextAnnouncement = config.announcement;
      if (!nextAnnouncement) {
        setAnnouncement(null);
        return;
      }

      const sessionKey = getAnnouncementSessionKey(nextAnnouncement, currentBuild);
      if (sessionDismissedRef.current.has(sessionKey)) {
        setAnnouncement(null);
        return;
      }

      const seenKey = getAnnouncementSeenKey(nextAnnouncement, currentBuild);
      if (seenKey) {
        try {
          if (await AsyncStorage.getItem(seenKey)) {
            if (mountedRef.current && requestId === requestIdRef.current) setAnnouncement(null);
            return;
          }
        } catch {
          // 저장소 장애는 공지 자체를 숨길 이유가 아니므로 현재 세션에는 표시한다.
        }
      }

      if (mountedRef.current && requestId === requestIdRef.current) {
        setAnnouncement(nextAnnouncement);
        setAnnouncementError(null);
      }
    },
    [currentBuild],
  );

  const refreshControl = useCallback(
    async ({ initial = false, showProgress = false }: RefreshOptions = {}) => {
      if (!platform || currentBuild === null) {
        if (mountedRef.current) setInitialLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      if (initial && mountedRef.current) setInitialLoading(true);
      if (showProgress && mountedRef.current) setRefreshing(true);

      let cachedRaw: unknown = null;
      try {
        const cached = await AsyncStorage.getItem(APP_CONTROL_CACHE_KEY);
        if (cached) cachedRaw = JSON.parse(cached);
      } catch {
        cachedRaw = null;
      }

      try {
        const rpc: AppControlRpc = (fn, args) =>
          supabase.rpc(fn, args) as unknown as PromiseLike<AppControlRpcResult>;
        const fetched = await withTimeout(
          fetchAppControlConfig(rpc, platform, currentBuild, locale),
          CONTROL_REQUEST_TIMEOUT_MS,
        );

        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        await AsyncStorage.setItem(APP_CONTROL_CACHE_KEY, JSON.stringify(fetched.raw)).catch(
          () => {},
        );
        await applyConfig(fetched.config, requestId);
      } catch {
        let fallback = EMPTY_CONTROL_CONFIG;
        if (cachedRaw !== null) {
          try {
            fallback = parseAppControlConfig(cachedRaw, platform, currentBuild);
          } catch {
            fallback = EMPTY_CONTROL_CONFIG;
          }
        }
        await applyConfig(fallback, requestId);
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setInitialLoading(false);
          if (showProgress) setRefreshing(false);
        }
      }
    },
    [applyConfig, currentBuild, locale, platform],
  );

  useEffect(() => {
    refreshControl({ initial: true });
  }, [refreshControl]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshControl();
    });
    return () => subscription.remove();
  }, [refreshControl]);

  const forceUpdate = controlConfig.release?.forceUpdate === true;

  useEffect(() => {
    if (!forceUpdate || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [forceUpdate]);

  const handleOpenStore = useCallback(async () => {
    const policy = controlConfig.release;
    if (!policy || openingStore) return;

    setOpeningStore(true);
    setStoreError(null);
    try {
      await Linking.openURL(policy.storeUrl);
    } catch {
      if (mountedRef.current) setStoreError(t('appControl.storeOpenError'));
    } finally {
      if (mountedRef.current) setOpeningStore(false);
    }
  }, [controlConfig.release, openingStore, t]);

  const dismissAnnouncement = useCallback(async () => {
    const current = announcement;
    if (!current || currentBuild === null) return;

    setAnnouncement(null);
    setAnnouncementError(null);
    sessionDismissedRef.current.add(getAnnouncementSessionKey(current, currentBuild));

    const seenKey = getAnnouncementSeenKey(current, currentBuild);
    if (seenKey) await AsyncStorage.setItem(seenKey, '1').catch(() => {});
  }, [announcement, currentBuild]);

  const handleAnnouncementAction = useCallback(async () => {
    if (!announcement?.actionUrl || announcementActionBusy) return;

    setAnnouncementActionBusy(true);
    setAnnouncementError(null);
    try {
      await Linking.openURL(announcement.actionUrl);
      await dismissAnnouncement();
    } catch {
      if (mountedRef.current) setAnnouncementError(t('appControl.announcementOpenError'));
    } finally {
      if (mountedRef.current) setAnnouncementActionBusy(false);
    }
  }, [announcement, announcementActionBusy, dismissAnnouncement, t]);

  if (initialLoading) return <SplashScreen />;

  if (forceUpdate && controlConfig.release && currentBuild !== null) {
    return (
      <ForceUpdateScreen
        policy={controlConfig.release}
        currentBuild={currentBuild}
        openingStore={openingStore}
        refreshing={refreshing}
        error={storeError}
        onOpenStore={handleOpenStore}
        onRefresh={() => refreshControl({ showProgress: true })}
      />
    );
  }

  return (
    <>
      {children}
      <AnnouncementModal
        announcement={announcement}
        actionBusy={announcementActionBusy}
        error={announcementError}
        onDismiss={dismissAnnouncement}
        onAction={handleAnnouncementAction}
      />
    </>
  );
}

const styles = StyleSheet.create({
  updateSafeArea: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  updateScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  updateCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: COLORS.slate900,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12,
  },
  updateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.primary50,
    borderWidth: 1,
    borderColor: COLORS.primary200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  updateEyebrow: {
    color: COLORS.primary600,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  updateTitle: {
    color: COLORS.slate900,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
  },
  updateMessage: {
    color: COLORS.slate600,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
  },
  versionPill: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary50,
  },
  versionPillText: {
    color: COLORS.primary700,
    fontSize: 12,
    fontWeight: '700',
  },
  buildInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 22,
  },
  buildInfoText: {
    color: COLORS.slate400,
    fontSize: 11,
    fontWeight: '600',
  },
  buildDivider: {
    width: 1,
    height: 11,
    backgroundColor: COLORS.slate200,
    marginHorizontal: 9,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  retryButtonText: {
    color: COLORS.primary600,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '82%',
    backgroundColor: COLORS.bgCard,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: COLORS.slate900,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 24,
  },
  noticeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: COLORS.primary50,
    borderWidth: 1,
    borderColor: COLORS.primary200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noticeTitle: {
    color: COLORS.slate900,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  noticeBodyScroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
    marginTop: 12,
    marginBottom: 18,
  },
  noticeBodyContent: {
    paddingHorizontal: 2,
  },
  noticeBody: {
    color: COLORS.slate600,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
  },
  noticeError: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  noticeActionButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  noticeActionText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeConfirmButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.slate50,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  noticeConfirmText: {
    color: COLORS.slate600,
    fontSize: 14,
    fontWeight: '700',
  },
});
