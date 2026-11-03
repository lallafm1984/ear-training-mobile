import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLevel, getExpForNextLevel, getMascotParams } from '../lib/mascotConfig';
import { useAuth } from '../context';
import { toLocalDateKey } from '../lib/localDate';
import { LOCAL_DATA_BASE_KEYS, localDataKey } from '../lib/localProfileStorage';

interface StoredData {
  totalExp: number;
  lastExpDate: string;
}

export function useMascotExp() {
  const { storageUserId } = useAuth();
  const storageKey = localDataKey(LOCAL_DATA_BASE_KEYS.mascotExp, storageUserId);

  const [totalExp, setTotalExp] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // AsyncStorage에서 로드
  useEffect(() => {
    setLoaded(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const data: StoredData = JSON.parse(raw);
          setTotalExp(data.totalExp);
        } else {
          setTotalExp(0);
        }
      } catch {
        // 로드 실패 시 기본값 유지
      } finally {
        setLoaded(true);
      }
    })();
  }, [storageKey]);

  // EXP 추가 및 저장
  // 화면 state(totalExp)가 아직 로드되지 않았거나 오래된 값일 수 있으므로
  // 항상 저장소의 현재 값을 읽어 더한다. (로드 전 호출 시 기존 EXP를 덮어쓰던 문제 수정)
  const addExp = useCallback(
    async (amount: number) => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const stored: StoredData | null = raw ? JSON.parse(raw) : null;
        const newTotal = (stored?.totalExp ?? 0) + amount;
        setTotalExp(newTotal);
        const data: StoredData = {
          totalExp: newTotal,
          lastExpDate: toLocalDateKey(new Date()),
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // 저장 실패 시 화면 값만 반영
        setTotalExp((prev) => prev + amount);
      }
    },
    [storageKey],
  );

  const level = getLevel(totalExp);
  const progress = getExpForNextLevel(totalExp);
  const mascot = getMascotParams(level);

  return { totalExp, level, progress, mascot, loaded, addExp };
}
