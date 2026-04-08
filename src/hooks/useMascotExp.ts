import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLevel,
  getExpForNextLevel,
  getMascotParams,
} from '../lib/mascotConfig';
import { useAuth } from '../context';

const BASE_KEY = '@melodygen_mascot_exp';

interface StoredData {
  totalExp: number;
  lastExpDate: string;
}

export function useMascotExp() {
  const { user } = useAuth();
  const storageKey = user ? `${BASE_KEY}_${user.id}` : null;

  const [totalExp, setTotalExp] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // AsyncStorage에서 로드
  useEffect(() => {
    if (!storageKey) { setLoaded(true); return; }
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
  const addExp = useCallback(
    async (amount: number) => {
      if (!storageKey) return;
      const newTotal = totalExp + amount;
      setTotalExp(newTotal);
      try {
        const data: StoredData = {
          totalExp: newTotal,
          lastExpDate: new Date().toISOString().split('T')[0],
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // 저장 실패 시 무시
      }
    },
    [totalExp, storageKey],
  );

  const level = getLevel(totalExp);
  const progress = getExpForNextLevel(totalExp);
  const mascot = getMascotParams(level);

  return { totalExp, level, progress, mascot, loaded, addExp };
}
