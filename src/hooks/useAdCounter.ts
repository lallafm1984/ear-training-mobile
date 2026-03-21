import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'melodygen_generate_count';

/**
 * 무료 유저의 자동생성 횟수를 추적하고
 * 광고 표시 시점(3의 배수)을 알려주는 훅.
 *
 * @param adEveryN  - 광고를 보여줄 주기 (0이면 광고 없음)
 */
export function useAdCounter(adEveryN: number) {
  const [shouldShowAd, setShouldShowAd] = useState(false);
  const countRef = useRef<number | null>(null);

  /** 비동기로 카운트를 로드 */
  const loadCount = useCallback(async (): Promise<number> => {
    if (countRef.current !== null) return countRef.current;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const val = raw ? parseInt(raw, 10) : 0;
      countRef.current = isNaN(val) ? 0 : val;
    } catch {
      countRef.current = 0;
    }
    return countRef.current;
  }, []);

  /**
   * 생성하기 버튼 클릭 시 호출.
   * 반환값: true면 광고 모달을 보여줘야 함.
   */
  const recordGeneration = useCallback(async (): Promise<boolean> => {
    if (adEveryN <= 0) return false;

    const current = await loadCount();
    const next = current + 1;
    countRef.current = next;

    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // 저장 실패 시 무시
    }

    const showAd = next % adEveryN === 0;
    setShouldShowAd(showAd);
    return showAd;
  }, [adEveryN, loadCount]);

  /** 광고 모달 닫기 후 상태 초기화 */
  const dismissAd = useCallback(() => {
    setShouldShowAd(false);
  }, []);

  return { shouldShowAd, recordGeneration, dismissAd };
}
