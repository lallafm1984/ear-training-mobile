// ─────────────────────────────────────────────────────────────
// useSkillProfile — UserSkillProfile 영속화 (AsyncStorage + Supabase)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context';
import { supabase } from '../lib';
import { DEFAULT_SKILL_PROFILE } from '../lib/trackConfig';
import type { UserSkillProfile } from '../lib/trackConfig';
import type { TrackType } from '../theme';

const STORAGE_KEY = '@melodygen_skill_profile';

export function useSkillProfile() {
  const [profile, setProfile] = useState<UserSkillProfile>(DEFAULT_SKILL_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const { session } = useAuth();

  // ── 로컬 로드 ──
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          setProfile({ ...DEFAULT_SKILL_PROFILE, ...JSON.parse(raw) });
        } catch { /* ignore */ }
      }
      setLoaded(true);
    });
  }, []);

  // ── Supabase에서 가져오기 (로그인 시) ──
  useEffect(() => {
    if (!session?.user?.id || !loaded) return;
    supabase
      .from('user_skill_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const remote: UserSkillProfile = {
            rhythmLevel: data.rhythm_level ?? 1,
            intervalLevel: data.interval_level ?? 1,
            keyLevel: data.key_level ?? 1,
            comprehensiveLevel: data.comprehensive_level ?? 1,
            recentAccuracy: data.recent_accuracy ?? 0.6,
            streakDays: data.streak_days ?? 0,
            lastQuickTrack: data.last_quick_track ?? null,
            sameTrackCount: data.same_track_count ?? 0,
          };
          setProfile(remote);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
        }
      });
  }, [session?.user?.id, loaded]);

  // ── 저장 헬퍼 ──
  const persist = useCallback(async (updated: UserSkillProfile) => {
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Supabase 동기화 (비차단)
    if (session?.user?.id) {
      supabase
        .from('user_skill_profiles')
        .upsert({
          user_id: session.user.id,
          rhythm_level: updated.rhythmLevel,
          interval_level: updated.intervalLevel,
          key_level: updated.keyLevel,
          comprehensive_level: updated.comprehensiveLevel,
          recent_accuracy: updated.recentAccuracy,
          streak_days: updated.streakDays,
          last_quick_track: updated.lastQuickTrack,
          same_track_count: updated.sameTrackCount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .then(() => { /* fire & forget */ });
    }
  }, [session?.user?.id]);

  // ── 자기 평가 반영 ──
  const applyEvaluation = useCallback(async (
    track: TrackType,
    level: number,
    rating: 'easy' | 'normal' | 'hard',
  ) => {
    const updated = { ...profile };

    // 정확도 업데이트 (이동 평균)
    const ratingScore = { easy: 0.9, normal: 0.65, hard: 0.35 }[rating];
    updated.recentAccuracy = updated.recentAccuracy * 0.7 + ratingScore * 0.3;

    // 레벨 조정
    const trackLevelKey = {
      rhythm: 'rhythmLevel',
      interval: 'intervalLevel',
      key: 'keyLevel',
      comprehensive: 'comprehensiveLevel',
    }[track] as keyof UserSkillProfile;

    const maxLevels = { rhythm: 6, interval: 4, key: 4, comprehensive: 3 };
    const currentLevel = updated[trackLevelKey] as number;

    if (rating === 'easy' && currentLevel === level && level < maxLevels[track]) {
      // 쉬웠으면 다음 레벨 해금
      (updated as any)[trackLevelKey] = level + 1;
    }
    // 'hard'일 때 레벨을 내리지는 않음 (동기 부여 유지)

    // 퀵스타트 트랙 순환 추적
    if (updated.lastQuickTrack === track) {
      updated.sameTrackCount += 1;
    } else {
      updated.lastQuickTrack = track;
      updated.sameTrackCount = 1;
    }

    await persist(updated);
  }, [profile, persist]);

  // ── 스트릭 업데이트 ──
  const updateStreak = useCallback(async () => {
    const today = new Date().toDateString();
    const lastKey = '@melodygen_last_practice_date';
    const lastDate = await AsyncStorage.getItem(lastKey);

    if (lastDate === today) return; // 오늘 이미 연습함

    const updated = { ...profile };
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === yesterday) {
      updated.streakDays += 1;
    } else if (lastDate !== today) {
      updated.streakDays = 1;
    }

    await AsyncStorage.setItem(lastKey, today);
    await persist(updated);
  }, [profile, persist]);

  return { profile, loaded, applyEvaluation, updateStreak };
}
