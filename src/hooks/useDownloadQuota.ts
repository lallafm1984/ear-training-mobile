import { useCallback } from 'react';
import { useAlert, useSubscription } from '../context';
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

    return true;
  }, [limits, onUpgradeNeeded, showAlert, t]);

  return {
    tier,
    checkAndConsume,
    checkCanDownload: checkAndConsume,
    checkImageDownload,
  };
}
