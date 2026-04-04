// ─────────────────────────────────────────────────────────────
// usePracticeHistory — 연습 기록 영속화 (AsyncStorage + Supabase)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context';
import { supabase } from '../lib';
import { computeStats, type PracticeStats } from '../lib/computeStats';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';

export type { PracticeStats } from '../lib/computeStats';
export { computeStats } from '../lib/computeStats';

const STORAGE_KEY = '@melodygen_recent_activity';
const MAX_LOCAL = 100;

export function usePracticeHistory() {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [stats, setStats] = useState<PracticeStats>(computeStats([]));
  const [loaded, setLoaded] = useState(false);
  const { session } = useAuth();

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

  // ── Supabase에서 병합 (로그인 시) ──
  useEffect(() => {
    if (!session?.user?.id || !loaded) return;
    supabase
      .from('practice_records')
      .select('*')
      .eq('user_id', session.user.id)
      .order('practiced_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const remote: PracticeRecord[] = data.map(d => ({
            id: d.id,
            contentType: d.content_type as ContentCategory,
            difficulty: d.difficulty as ContentDifficulty,
            selfRating: d.self_rating,
            practicedAt: d.practiced_at,
          }));

          // 함수형 업데이트로 stale closure 방지
          setRecords(prev => {
            const localIds = new Set(prev.map(r => r.id));
            const merged = [...prev];
            remote.forEach(r => {
              if (!localIds.has(r.id)) merged.push(r);
            });

            merged.sort((a, b) =>
              new Date(b.practicedAt).getTime() - new Date(a.practicedAt).getTime()
            );

            const trimmed = merged.slice(0, MAX_LOCAL);
            setStats(computeStats(trimmed));
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
            return trimmed;
          });
        }
      });
  }, [session?.user?.id, loaded]);

  // ── 기록 추가 ──
  const addRecord = useCallback(async (record: PracticeRecord) => {
    let updated: PracticeRecord[] = [];
    setRecords(prev => {
      updated = [record, ...prev].slice(0, MAX_LOCAL);
      return updated;
    });
    setStats(computeStats(updated));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Supabase 비동기 저장
    if (session?.user?.id) {
      supabase
        .from('practice_records')
        .insert({
          id: record.id,
          user_id: session.user.id,
          content_type: record.contentType,
          difficulty: record.difficulty,
          self_rating: record.selfRating,
          practiced_at: record.practicedAt,
        })
        .then(() => { /* fire & forget */ });
    }
  }, [session?.user?.id]);

  // ── 기록 배치 추가 (모의시험용 — AsyncStorage 동시 쓰기 방지) ──
  const addBatchRecords = useCallback(async (newRecords: PracticeRecord[]) => {
    let updated: PracticeRecord[] = [];
    setRecords(prev => {
      updated = [...newRecords, ...prev].slice(0, MAX_LOCAL);
      return updated;
    });
    setStats(computeStats(updated));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Supabase 배치 저장
    if (session?.user?.id && newRecords.length > 0) {
      supabase
        .from('practice_records')
        .insert(newRecords.map(r => ({
          id: r.id,
          user_id: session.user.id,
          content_type: r.contentType,
          difficulty: r.difficulty,
          self_rating: r.selfRating,
          practiced_at: r.practicedAt,
        })))
        .then(() => { /* fire & forget */ });
    }
  }, [session?.user?.id]);

  return { records, stats, loaded, addRecord, addBatchRecords };
}
