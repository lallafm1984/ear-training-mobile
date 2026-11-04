// ─────────────────────────────────────────────────────────────
// useWrongNotes — 오답노트 영속화 (AsyncStorage 로컬 전용)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context';
import { LOCAL_DATA_BASE_KEYS, localDataKey } from '../lib/localProfileStorage';
import {
  buildWrongNote,
  normalizeWrongNotes,
  removeResolvedWrongNotes,
  removeWrongNote,
  resolveWrongNote,
  upsertWrongNote,
  type WrongNote,
  type WrongNoteSource,
} from '../lib/wrongNotes';
import type { ChoiceQuestion } from '../lib/questionGenerator';

export function useWrongNotes() {
  const { storageUserId } = useAuth();
  const storageKey = localDataKey(LOCAL_DATA_BASE_KEYS.wrongNotes, storageUserId);

  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const notesRef = useRef<WrongNote[]>([]);
  // 연속 쓰기가 겹치지 않도록 직렬화
  const chain = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const next = raw ? normalizeWrongNotes(JSON.parse(raw)) : [];
      notesRef.current = next;
      setNotes(next);
    } catch {
      notesRef.current = [];
      setNotes([]);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    setLoaded(false);
    void load();
  }, [load]);

  const mutate = useCallback(
    (fn: (current: WrongNote[]) => WrongNote[]) => {
      const run = async () => {
        // 아직 로드 전이면 저장소 값을 먼저 읽어 덮어쓰기를 막는다
        if (!loaded) {
          try {
            const raw = await AsyncStorage.getItem(storageKey);
            notesRef.current = raw ? normalizeWrongNotes(JSON.parse(raw)) : [];
          } catch {
            // 읽기 실패 시 현재 값 유지
          }
        }
        const next = fn(notesRef.current);
        notesRef.current = next;
        setNotes(next);
        try {
          await AsyncStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // 저장 실패 시 화면 값만 유지
        }
      };
      chain.current = chain.current.then(run, run);
      return chain.current;
    },
    [loaded, storageKey],
  );

  const addWrong = useCallback(
    (question: ChoiceQuestion, myAnswer: string, source: WrongNoteSource) =>
      mutate((cur) => upsertWrongNote(cur, buildWrongNote(question, myAnswer, source))),
    [mutate],
  );

  const addWrongBatch = useCallback(
    (items: Array<{ question: ChoiceQuestion; myAnswer: string }>, source: WrongNoteSource) =>
      mutate((cur) =>
        items.reduce(
          (acc, { question, myAnswer }) =>
            upsertWrongNote(acc, buildWrongNote(question, myAnswer, source)),
          cur,
        ),
      ),
    [mutate],
  );

  const resolve = useCallback((id: string) => mutate((cur) => resolveWrongNote(cur, id)), [mutate]);
  const remove = useCallback((id: string) => mutate((cur) => removeWrongNote(cur, id)), [mutate]);
  const clearResolved = useCallback(() => mutate(removeResolvedWrongNotes), [mutate]);

  return { notes, loaded, addWrong, addWrongBatch, resolve, remove, clearResolved, reload: load };
}
