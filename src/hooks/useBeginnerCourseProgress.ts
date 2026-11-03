// ─────────────────────────────────────────────────────────────
// useBeginnerCourseProgress — 귀 열기 코스 진행 상태 (AsyncStorage 로컬 전용)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context';
import { LOCAL_DATA_BASE_KEYS, localDataKey } from '../lib/localProfileStorage';
import {
  EMPTY_BEGINNER_PROGRESS,
  applyBeginnerLessonResult,
  getNextBeginnerLessonId,
  isBeginnerCourseComplete,
  normalizeBeginnerProgress,
  type BeginnerCourseProgress,
  type BeginnerLessonResult,
} from '../lib/beginnerCourse';

export function useBeginnerCourseProgress() {
  const { storageUserId } = useAuth();
  const storageKey = localDataKey(LOCAL_DATA_BASE_KEYS.beginnerCourse, storageUserId);

  const [progress, setProgress] = useState<BeginnerCourseProgress>(EMPTY_BEGINNER_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const next = raw ? normalizeBeginnerProgress(JSON.parse(raw)) : EMPTY_BEGINNER_PROGRESS;
      progressRef.current = next;
      setProgress(next);
    } catch {
      progressRef.current = EMPTY_BEGINNER_PROGRESS;
      setProgress(EMPTY_BEGINNER_PROGRESS);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    setLoaded(false);
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: BeginnerCourseProgress) => {
      progressRef.current = next;
      setProgress(next);
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // 저장 실패 시 화면 값만 유지
      }
    },
    [storageKey],
  );

  /** 레슨 완료를 기록하고, 이번에 처음 EXP를 받아야 하는지 돌려준다. */
  const completeLesson = useCallback(
    async (lessonId: string, result: BeginnerLessonResult) => {
      const base = applyBeginnerLessonResult(progressRef.current, lessonId, result);
      const firstReward = !base.rewardedLessonIds.includes(lessonId);
      const courseDone = isBeginnerCourseComplete(base);
      const firstCourseReward = courseDone && !base.courseRewarded;
      const next: BeginnerCourseProgress = {
        ...base,
        rewardedLessonIds: firstReward
          ? [...base.rewardedLessonIds, lessonId]
          : base.rewardedLessonIds,
        courseRewarded: base.courseRewarded || firstCourseReward,
      };
      await persist(next);
      return { firstReward, firstCourseReward, courseDone };
    },
    [persist],
  );

  return {
    progress,
    loaded,
    nextLessonId: getNextBeginnerLessonId(progress),
    isComplete: isBeginnerCourseComplete(progress),
    completeLesson,
    reload: load,
  };
}
