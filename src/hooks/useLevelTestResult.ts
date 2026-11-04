// ─────────────────────────────────────────────────────────────
// useLevelTestResult — 3분 레벨 테스트 결과 (AsyncStorage 로컬 전용)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context';
import { LOCAL_DATA_BASE_KEYS, localDataKey } from '../lib/localProfileStorage';
import { normalizeLevelTestResult, type LevelTestResult } from '../lib/levelTest';

export function useLevelTestResult() {
  const { storageUserId } = useAuth();
  const storageKey = localDataKey(LOCAL_DATA_BASE_KEYS.levelTest, storageUserId);

  const [result, setResult] = useState<LevelTestResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      setResult(raw ? normalizeLevelTestResult(JSON.parse(raw)) : null);
    } catch {
      setResult(null);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    setLoaded(false);
    void load();
  }, [load]);

  const save = useCallback(
    async (next: LevelTestResult) => {
      setResult(next);
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // 저장 실패 시 화면 값만 유지
      }
    },
    [storageKey],
  );

  return { result, loaded, save, reload: load };
}
