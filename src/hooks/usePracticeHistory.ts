// ─────────────────────────────────────────────────────────────
// usePracticeHistory — 연습 기록 영속화 (AsyncStorage 로컬 전용)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeStats, type PracticeStats } from '../lib/computeStats';
import type { PracticeRecord } from '../types/content';

export type { PracticeStats } from '../lib/computeStats';
export { computeStats } from '../lib/computeStats';

const STORAGE_KEY = '@melodygen_recent_activity';
const MAX_LOCAL = 5000;

export function usePracticeHistory() {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [stats, setStats] = useState<PracticeStats>(computeStats([]));
  const [loaded, setLoaded] = useState(false);
  const initialLoadDone = useRef(false);
  const recordsRef = useRef<PracticeRecord[]>([]);

  // ── 로컬 로드 ──
  const load = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PracticeRecord[];
        recordsRef.current = parsed;
        setRecords(parsed);
        setStats(computeStats(parsed));
      } catch { /* ignore */ }
    }
    if (!initialLoadDone.current) {
      setLoaded(true);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── 기록 추가 ──
  const addRecord = useCallback(async (record: PracticeRecord) => {
    const updated = [record, ...recordsRef.current].slice(0, MAX_LOCAL);
    recordsRef.current = updated;
    setRecords(updated);
    setStats(computeStats(updated));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  // ── 기록 배치 추가 (모의시험용 — AsyncStorage 동시 쓰기 방지) ──
  const addBatchRecords = useCallback(async (newRecords: PracticeRecord[]) => {
    const updated = [...newRecords, ...recordsRef.current].slice(0, MAX_LOCAL);
    recordsRef.current = updated;
    setRecords(updated);
    setStats(computeStats(updated));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  return { records, stats, loaded, addRecord, addBatchRecords, reload: load };
}
