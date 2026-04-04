// ─────────────────────────────────────────────────────────────
// usePracticeHistory — 연습 기록 영속화 (AsyncStorage + Supabase)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context';
import { supabase } from '../lib';
import type { ContentCategory, ContentDifficulty, PracticeRecord } from '../types/content';

const STORAGE_KEY = '@melodygen_recent_activity';
const MAX_LOCAL = 100;

export interface PracticeStats {
  totalSessions: number;
  totalByCategory: Record<ContentCategory, number>;
  avgRatingByCategory: Record<ContentCategory, number>;
  recentRecords: PracticeRecord[];
  weeklyCount: number;
  monthlyCount: number;
}

const CATEGORIES: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key', 'twoVoice'];

function emptyStats(): PracticeStats {
  const totalByCategory = {} as Record<ContentCategory, number>;
  const avgRatingByCategory = {} as Record<ContentCategory, number>;
  CATEGORIES.forEach(c => {
    totalByCategory[c] = 0;
    avgRatingByCategory[c] = 0;
  });
  return {
    totalSessions: 0,
    totalByCategory,
    avgRatingByCategory,
    recentRecords: [],
    weeklyCount: 0,
    monthlyCount: 0,
  };
}

export function computeStats(records: PracticeRecord[]): PracticeStats {
  const stats = emptyStats();
  stats.totalSessions = records.length;
  stats.recentRecords = records.slice(0, 20);

  const now = Date.now();
  const weekAgo = now - 7 * 86400_000;
  const monthAgo = now - 30 * 86400_000;

  const ratingSum: Record<string, number> = {};
  const ratingCount: Record<string, number> = {};

  records.forEach(r => {
    const cat = r.contentType;
    stats.totalByCategory[cat] = (stats.totalByCategory[cat] || 0) + 1;

    ratingSum[cat] = (ratingSum[cat] || 0) + r.selfRating;
    ratingCount[cat] = (ratingCount[cat] || 0) + 1;

    const ts = new Date(r.practicedAt).getTime();
    if (ts >= weekAgo) stats.weeklyCount++;
    if (ts >= monthAgo) stats.monthlyCount++;
  });

  CATEGORIES.forEach(c => {
    stats.avgRatingByCategory[c] = ratingCount[c]
      ? Math.round((ratingSum[c] / ratingCount[c]) * 10) / 10
      : 0;
  });

  return stats;
}

export function usePracticeHistory() {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [stats, setStats] = useState<PracticeStats>(emptyStats());
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

          // 병합: 중복 제거 (id 기준)
          const localIds = new Set(records.map(r => r.id));
          const merged = [...records];
          remote.forEach(r => {
            if (!localIds.has(r.id)) merged.push(r);
          });

          // 날짜순 정렬
          merged.sort((a, b) =>
            new Date(b.practicedAt).getTime() - new Date(a.practicedAt).getTime()
          );

          const trimmed = merged.slice(0, MAX_LOCAL);
          setRecords(trimmed);
          setStats(computeStats(trimmed));
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
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

  return { records, stats, loaded, addRecord };
}
