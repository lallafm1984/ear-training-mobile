// ─────────────────────────────────────────────────────────────
// usePracticeHistory — 연습 기록 영속화 (AsyncStorage 로컬 전용)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeStats, type PracticeStats } from '../lib/computeStats';
import type { PracticeRecord } from '../types/content';

export type { PracticeStats } from '../lib/computeStats';
export { computeStats } from '../lib/computeStats';

const STORAGE_KEY = '@melodygen_recent_activity';
const MAX_LOCAL = 100;

export function usePracticeHistory() {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [stats, setStats] = useState<PracticeStats>(computeStats([]));
  const [loaded, setLoaded] = useState(false);

  // ── 로컬 로드 ──
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PracticeRecord[];
          setRecords(parsed);
          setStats(computeStats(parsed));
        } catch { /* ignore */ }
      }
      setLoaded(true);
    });
  }, []);

  // ── 기록 추가 ──
  const addRecord = useCallback(async (record: PracticeRecord) => {
    let updated: PracticeRecord[] = [];
    setRecords(prev => {
      updated = [record, ...prev].slice(0, MAX_LOCAL);
      return updated;
    });
    setStats(computeStats(updated));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  // ── 기록 배치 추가 (모의시험용 — AsyncStorage 동시 쓰기 방지) ──
  const addBatchRecords = useCallback(async (newRecords: PracticeRecord[]) => {
    let updated: PracticeRecord[] = [];
    setRecords(prev => {
      updated = [...newRecords, ...prev].slice(0, MAX_LOCAL);
      return updated;
    });
    setStats(computeStats(updated));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  return { records, stats, loaded, addRecord, addBatchRecords };
}
