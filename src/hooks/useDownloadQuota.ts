import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useAlert, useSubscription } from '../context';
import * as MediaLibrary from 'expo-media-library';
import type { UpgradeReason } from '../components';

/**
 * 다운로드 권한 체크 훅.
 * onUpgradeNeeded: 구독 제한 도달 시 호출할 콜백 (UpgradeModal 트리거용)
 */
export function useDownloadQuota(onUpgradeNeeded?: (reason: UpgradeReason) => void) {
  const { showAlert } = useAlert();
  const { tier, limits } = useSubscription();

  /** 다운로드 시도 (오디오) */
  const checkAndConsume = useCallback(async (): Promise<boolean> => {
    // 1. 구독 권한 체크
    if (!limits.canDownloadAudio) {
      if (onUpgradeNeeded) {
        onUpgradeNeeded('download_audio');
      } else {
        showAlert({
          title: '음원 다운로드 불가',
          message: '청음 음원(MP3) 다운로드는 Pro 플랜 전용 기능입니다.',
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
          title: '권한 설정 필요',
          message: '파일을 기기에 저장하려면 저장소 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          type: 'info',
          buttons: [
            { text: '나중에', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => Linking.openSettings() },
          ],
        });
        return false;
      }
    } catch (error) {
      if (__DEV__) console.warn('권한 체크 에러(오디오):', error);
    }

    return true;
  }, [limits, onUpgradeNeeded, showAlert]);

  /** 이미지 다운로드 전 체크 */
  const checkImageDownload = useCallback(async (): Promise<boolean> => {
    // 1. 구독 권한 체크
    if (!limits.canDownloadImage) {
      if (onUpgradeNeeded) {
        onUpgradeNeeded('download_image');
      } else {
        showAlert({
          title: '이미지 저장 불가',
          message: '악보 이미지(PNG) 저장은 Pro 플랜 전용 기능입니다.',
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
          title: '권한 설정 필요',
          message: '이미지를 갤러리에 저장하려면 저장소 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          type: 'info',
          buttons: [
            { text: '나중에', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => Linking.openSettings() },
          ],
        });
        return false;
      }
    } catch (error) {
      if (__DEV__) console.warn('권한 체크 에러(이미지):', error);
      return true;
    }

    return true;
  }, [limits, onUpgradeNeeded, showAlert]);

  return {
    tier,
    checkAndConsume,
    checkCanDownload: checkAndConsume,
    checkImageDownload,
  };
}
