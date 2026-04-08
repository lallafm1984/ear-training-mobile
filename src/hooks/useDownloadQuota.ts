import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useAlert, useSubscription } from '../context';
import * as MediaLibrary from 'expo-media-library';
import type { UpgradeReason } from '../components';
import { useTranslation } from 'react-i18next';

/**
 * 다운로드 권한 체크 훅.
 * onUpgradeNeeded: 구독 제한 도달 시 호출할 콜백 (UpgradeModal 트리거용)
 */
export function useDownloadQuota(onUpgradeNeeded?: (reason: UpgradeReason) => void) {
  const { showAlert } = useAlert();
  const { tier, limits } = useSubscription();
  const { t } = useTranslation(['practice', 'common']);

  /** 다운로드 시도 (오디오) */
  const checkAndConsume = useCallback(async (): Promise<boolean> => {
    // 1. 구독 권한 체크
    if (!limits.canDownloadAudio) {
      if (onUpgradeNeeded) {
        onUpgradeNeeded('download_audio');
      } else {
        showAlert({
          title: t('practice:download.audioBlocked'),
          message: t('practice:download.audioBlockedMsg'),
          type: 'warning',
        });
      }
      return false;
    }

    // 2. 기기 권한 체크 (라이브러리 저장용)
    try {
      const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') {
        if (status === 'undetermined' || (status === 'denied' && canAskAgain)) {
          const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
          if (newStatus === 'granted') return true;
        }

        showAlert({
          title: t('practice:download.permissionTitle'),
          message: t('practice:download.permissionAudioMsg'),
          type: 'info',
          buttons: [
            { text: t('common:button.later'), style: 'cancel' },
            { text: t('common:button.goToSettings'), onPress: () => Linking.openSettings() },
          ],
        });
        return false;
      }
    } catch (error) {
      if (__DEV__) console.warn('권한 체크 에러(오디오):', error);
    }

    return true;
  }, [limits, onUpgradeNeeded, showAlert, t]);

  /** 이미지 다운로드 전 체크 */
  const checkImageDownload = useCallback(async (): Promise<boolean> => {
    // 1. 구독 권한 체크
    if (!limits.canDownloadImage) {
      if (onUpgradeNeeded) {
        onUpgradeNeeded('download_image');
      } else {
        showAlert({
          title: t('practice:download.imageBlocked'),
          message: t('practice:download.imageBlockedMsg'),
          type: 'warning',
        });
      }
      return false;
    }

    // 2. 기기 권한 체크
    try {
      const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') {
        if (status === 'undetermined' || (status === 'denied' && canAskAgain)) {
          const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
          if (newStatus === 'granted') return true;
        }

        showAlert({
          title: t('practice:download.permissionTitle'),
          message: t('practice:download.permissionImageMsg'),
          type: 'info',
          buttons: [
            { text: t('common:button.later'), style: 'cancel' },
            { text: t('common:button.goToSettings'), onPress: () => Linking.openSettings() },
          ],
        });
        return false;
      }
    } catch (error) {
      if (__DEV__) console.warn('권한 체크 에러(이미지):', error);
      return true;
    }

    return true;
  }, [limits, onUpgradeNeeded, showAlert, t]);

  return {
    tier,
    checkAndConsume,
    checkCanDownload: checkAndConsume,
    checkImageDownload,
  };
}
