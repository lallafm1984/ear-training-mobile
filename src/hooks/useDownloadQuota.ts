import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { useSubscription } from '../context/SubscriptionContext';
import type { UpgradeReason } from '../components/UpgradeModal';

/**
 * 다운로드 권한 체크 + 소모 훅.
 * onUpgradeNeeded: 구독 제한 도달 시 호출할 콜백 (UpgradeModal 트리거용)
 */
export function useDownloadQuota(onUpgradeNeeded?: (reason: UpgradeReason) => void) {
  const { tier, limits, remainingDownloads, consumeDownload } = useSubscription();

  /** 다운로드 시도 (오디오) */
  const checkAndConsume = useCallback(async (): Promise<boolean> => {
    // 1. 구독 권한 체크
    if (!limits.canDownloadAudio) {
      if (onUpgradeNeeded) {
        onUpgradeNeeded('download_audio');
      } else {
        Alert.alert(
          '다운로드 불가',
          'Pro 또는 Premium 플랜에서 음원을 다운로드할 수 있습니다.',
          [{ text: '확인', style: 'cancel' }],
        );
      }
      return false;
    }

    // 2. 한도 체크
    if (limits.monthlyDownloadLimit !== null) {
      if (remainingDownloads !== null && remainingDownloads <= 0) {
        if (onUpgradeNeeded) {
          onUpgradeNeeded('download_limit');
        } else {
          Alert.alert(
            '다운로드 한도 초과',
            `이번 달 다운로드 ${limits.monthlyDownloadLimit}회를 모두 사용했습니다.\n\n무제한 다운로드는 Premium 플랜에서 이용 가능합니다.`,
            [{ text: '확인', style: 'cancel' }],
          );
        }
        return false;
      }
    }

    // 3. 기기 권한 체크 (라이브러리 저장용)
    try {
      const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') {
        if (status === 'undetermined' || (status === 'denied' && canAskAgain)) {
          const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
          if (newStatus === 'granted') {
            const ok = await consumeDownload();
            return ok;
          }
        }

        Alert.alert(
          '권한 설정 필요',
          '파일을 기기에 저장하려면 저장소 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          [
            { text: '나중에', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
    } catch (error) {
      console.warn('권한 체크 에러(오디오):', error);
      const ok = await consumeDownload();
      return ok;
    }

    // 4. 소모 및 성공
    const ok = await consumeDownload();
    if (!ok) return false;

    return true;
  }, [limits, remainingDownloads, consumeDownload, onUpgradeNeeded]);

  /** 이미지 다운로드 전 체크 */
  const checkImageDownload = useCallback(async (): Promise<boolean> => {
    // 1. 구독 권한 체크
    if (!limits.canDownloadImage) {
      if (onUpgradeNeeded) {
        onUpgradeNeeded('download_image');
      } else {
        Alert.alert(
          '이미지 저장 불가',
          'Pro 또는 Premium 플랜에서 악보 이미지를 저장할 수 있습니다.',
          [{ text: '확인' }],
        );
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

        Alert.alert(
          '권한 설정 필요',
          '이미지를 갤러리에 저장하려면 저장소 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          [
            { text: '나중에', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
    } catch (error) {
      console.warn('권한 체크 에러(이미지):', error);
      return true;
    }

    return true;
  }, [limits, onUpgradeNeeded]);

  return {
    tier,
    remainingDownloads,
    monthlyLimit: limits.monthlyDownloadLimit,
    checkAndConsume,
    checkCanDownload: checkAndConsume,
    consumeDownload,
    checkImageDownload,
  };
}
