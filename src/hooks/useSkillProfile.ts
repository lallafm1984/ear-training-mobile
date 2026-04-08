// ─────────────────────────────────────────────────────────────
// useSkillProfile — UserSkillProfile 영속화 (AsyncStorage 로컬 전용)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SKILL_PROFILE } from '../lib/trackConfig';
import type { UserSkillProfile } from '../lib/trackConfig';
import type { TrackType } from '../theme';

const STORAGE_KEY = '@melodygen_skill_profile';
const MS_PER_DAY = 86_400_000;

export function useSkillProfile() {
  const [profile, setProfile] = useState<UserSkillProfile>(DEFAULT_SKILL_PROFILE);
  const [loaded, setLoaded] = useState(false);

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

  // ── 저장 헬퍼 ──
  const persist = useCallback(async (updated: UserSkillProfile) => {
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

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
      partPractice: 'partPracticeLevel',
      comprehensive: 'comprehensiveLevel',
    }[track] as keyof UserSkillProfile;

    const maxLevels: Record<TrackType, number> = { partPractice: 9, comprehensive: 4 };
    const currentLevel = updated[trackLevelKey] as number;

    if (rating === 'easy' && currentLevel === level && level < maxLevels[track]) {
      (updated as any)[trackLevelKey] = level + 1;
    }

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

    if (lastDate === today) return;

    const updated = { ...profile };
    const yesterday = new Date(Date.now() - MS_PER_DAY).toDateString();
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
