// ─────────────────────────────────────────────────────────────
// useNoteInput — 음표 입력 상태 관리 훅
// ─────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import type { ScoreNote, NoteDuration, PitchName, Accidental } from '../lib/scoreUtils';
import { uid, durationToSixteenths, getSixteenthsPerBar, generateAbc } from '../lib/scoreUtils';

// ── Types ──

export interface NoteInputState {
  trebleNotes: ScoreNote[];
  bassNotes: ScoreNote[];
  activeVoice: 'treble' | 'bass';
  selectedDuration: NoteDuration;
  isDotted: boolean;
  accidentalMode: '#' | 'b' | null;
  tieMode: boolean;
  selectedNoteIndex: number | null;
}

interface UseNoteInputOptions {
  keySignature: string;
  timeSignature: string;
  measures: number;
  useGrandStaff: boolean;
  firstNote?: ScoreNote | null;
}

// ── Helpers ──

/** 점음표 적용 — 2., 4., 8. 만 허용 */
function applyDot(dur: NoteDuration): NoteDuration {
  switch (dur) {
    case '2': return '2.';
    case '4': return '4.';
    case '8': return '8.';
    default: return dur;
  }
}

function sumSixteenths(notes: ScoreNote[]): number {
  return notes.reduce((sum, n) => sum + durationToSixteenths(n.duration), 0);
}

// ── Initial state factory ──

function makeInitialState(firstNote?: ScoreNote | null): NoteInputState {
  return {
    trebleNotes: firstNote ? [firstNote] : [],
    bassNotes: [],
    activeVoice: 'treble',
    selectedDuration: '4',
    isDotted: false,
    accidentalMode: null,
    tieMode: false,
    selectedNoteIndex: null,
  };
}

// ── Hook ──

export function useNoteInput(options: UseNoteInputOptions) {
  const { keySignature, timeSignature, measures, useGrandStaff, firstNote } = options;

  const [state, setState] = useState<NoteInputState>(() => makeInitialState(firstNote));

  const barSixteenths = getSixteenthsPerBar(timeSignature);
  const totalSixteenths = measures * barSixteenths;

  // ── Derived helpers ──

  const getActiveNotes = useCallback(
    (): ScoreNote[] => (state.activeVoice === 'treble' ? state.trebleNotes : state.bassNotes),
    [state.activeVoice, state.trebleNotes, state.bassNotes],
  );

  const getRemainingDuration = useCallback((): number => {
    return totalSixteenths - sumSixteenths(getActiveNotes());
  }, [totalSixteenths, getActiveNotes]);

  const canAddDuration = useCallback(
    (dur: NoteDuration): boolean => durationToSixteenths(dur) <= getRemainingDuration(),
    [getRemainingDuration],
  );

  // ── Actions ──

  const setDuration = useCallback((dur: NoteDuration) => {
    setState(prev => ({ ...prev, selectedDuration: dur, isDotted: false }));
  }, []);

  const toggleDot = useCallback(() => {
    setState(prev => ({ ...prev, isDotted: !prev.isDotted }));
  }, []);

  const setAccidentalMode = useCallback((mode: '#' | 'b' | null) => {
    setState(prev => ({
      ...prev,
      accidentalMode: prev.accidentalMode === mode ? null : mode,
    }));
  }, []);

  const toggleTie = useCallback(() => {
    setState(prev => ({ ...prev, tieMode: !prev.tieMode }));
  }, []);

  const setActiveVoice = useCallback((voice: 'treble' | 'bass') => {
    if (!useGrandStaff) return;
    setState(prev => ({ ...prev, activeVoice: voice, selectedNoteIndex: null }));
  }, [useGrandStaff]);

  const addNote = useCallback(
    (pitch: PitchName, octave: number, accidental?: Accidental) => {
      setState(prev => {
        const notes =
          prev.activeVoice === 'treble' ? [...prev.trebleNotes] : [...prev.bassNotes];

        // 임시표 결정: accidentalMode 우선, 그 다음 인자
        const resolvedAccidental: Accidental =
          prev.accidentalMode === '#' ? '#' :
          prev.accidentalMode === 'b' ? 'b' :
          accidental ?? '';

        // ── 선택된 음표가 있으면 교체 모드 ──
        if (prev.selectedNoteIndex !== null && prev.selectedNoteIndex >= 0 && prev.selectedNoteIndex < notes.length) {
          // firstNote(인덱스 0) 보호
          if (prev.activeVoice === 'treble' && firstNote && prev.selectedNoteIndex === 0) {
            return { ...prev, selectedNoteIndex: null, accidentalMode: null };
          }

          const oldNote = notes[prev.selectedNoteIndex];
          // 유효 듀레이션: 현재 선택된 음길이 또는 기존 음표의 음길이 유지
          let effectiveDur: NoteDuration = prev.selectedDuration;
          if (prev.isDotted) {
            effectiveDur = applyDot(effectiveDur);
          }

          // 교체 시 음가 차이 확인
          const durDiff = durationToSixteenths(effectiveDur) - durationToSixteenths(oldNote.duration);
          const remaining = totalSixteenths - sumSixteenths(notes);
          if (durDiff > remaining) return prev; // 공간 부족

          notes[prev.selectedNoteIndex] = {
            ...oldNote,
            pitch,
            octave,
            accidental: resolvedAccidental,
            duration: effectiveDur,
            id: uid(),
          };

          return {
            ...prev,
            trebleNotes: prev.activeVoice === 'treble' ? notes : prev.trebleNotes,
            bassNotes: prev.activeVoice === 'bass' ? notes : prev.bassNotes,
            accidentalMode: null,
            isDotted: false,
            selectedNoteIndex: null,
          };
        }

        // ── 선택 없으면 기존 추가 모드 ──
        let effectiveDur: NoteDuration = prev.selectedDuration;
        if (prev.isDotted) {
          effectiveDur = applyDot(effectiveDur);
        }

        // 남은 공간 확인
        const remaining = totalSixteenths - sumSixteenths(notes);
        if (durationToSixteenths(effectiveDur) > remaining) return prev;

        // 타이 모드 시 이전 음에 tie 설정 (같은 pitch + octave 인 경우만)
        if (prev.tieMode && notes.length > 0) {
          const last = notes[notes.length - 1];
          if (last.pitch === pitch && last.octave === octave) {
            notes[notes.length - 1] = { ...last, tie: true };
          }
        }

        const newNote: ScoreNote = {
          id: uid(),
          pitch,
          octave,
          accidental: resolvedAccidental,
          duration: effectiveDur,
        };

        notes.push(newNote);

        return {
          ...prev,
          trebleNotes: prev.activeVoice === 'treble' ? notes : prev.trebleNotes,
          bassNotes: prev.activeVoice === 'bass' ? notes : prev.bassNotes,
          // 입력 후 모드 초기화
          accidentalMode: null,
          isDotted: false,
          tieMode: false,
          selectedNoteIndex: null,
        };
      });
    },
    [totalSixteenths, firstNote],
  );

  const addRest = useCallback(() => {
    setState(prev => {
      const notes =
        prev.activeVoice === 'treble' ? [...prev.trebleNotes] : [...prev.bassNotes];

      let effectiveDur: NoteDuration = prev.selectedDuration;
      if (prev.isDotted) {
        effectiveDur = applyDot(effectiveDur);
      }

      const remaining = totalSixteenths - sumSixteenths(notes);
      if (durationToSixteenths(effectiveDur) > remaining) return prev;

      const restNote: ScoreNote = {
        id: uid(),
        pitch: 'rest',
        octave: 0,
        accidental: '',
        duration: effectiveDur,
      };

      notes.push(restNote);

      return {
        ...prev,
        trebleNotes: prev.activeVoice === 'treble' ? notes : prev.trebleNotes,
        bassNotes: prev.activeVoice === 'bass' ? notes : prev.bassNotes,
        accidentalMode: null,
        isDotted: false,
        tieMode: false,
        selectedNoteIndex: null,
      };
    });
  }, [totalSixteenths]);

  const undo = useCallback(() => {
    setState(prev => {
      const notes =
        prev.activeVoice === 'treble' ? [...prev.trebleNotes] : [...prev.bassNotes];

      // firstNote 보호: 트레블에서 인덱스 0은 삭제 불가
      const minIndex = prev.activeVoice === 'treble' && firstNote ? 1 : 0;
      if (notes.length <= minIndex) return prev;

      notes.pop();

      // 새 마지막 음의 tie 제거
      if (notes.length > 0) {
        const last = notes[notes.length - 1];
        if (last.tie) {
          notes[notes.length - 1] = { ...last, tie: false };
        }
      }

      return {
        ...prev,
        trebleNotes: prev.activeVoice === 'treble' ? notes : prev.trebleNotes,
        bassNotes: prev.activeVoice === 'bass' ? notes : prev.bassNotes,
        selectedNoteIndex: null,
      };
    });
  }, [firstNote]);

  const clear = useCallback(() => {
    setState(prev => ({
      ...prev,
      trebleNotes: firstNote ? [firstNote] : [],
      bassNotes: [],
      selectedNoteIndex: null,
    }));
  }, [firstNote]);

  const selectNote = useCallback((index: number | null) => {
    setState(prev => ({
      ...prev,
      selectedNoteIndex: prev.selectedNoteIndex === index ? null : index,
    }));
  }, []);

  /** 선택된 음표의 음길이만 변경 (편집 모드 전용) */
  const updateSelectedNoteDuration = useCallback((dur: NoteDuration) => {
    setState(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;
      if (idx < 0 || idx >= notes.length) return prev;

      // firstNote 보호
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;

      // 음가 차이 확인
      const oldDur = durationToSixteenths(notes[idx].duration);
      const newDur = durationToSixteenths(dur);
      const remaining = totalSixteenths - sumSixteenths(notes);
      if (newDur - oldDur > remaining) return prev; // 공간 부족

      notes[idx] = { ...notes[idx], duration: dur };
      return { ...prev, [key]: notes };
    });
  }, [totalSixteenths, firstNote]);

  const deleteSelectedNote = useCallback(() => {
    setState(prev => {
      if (prev.selectedNoteIndex === null) return prev;

      const notes =
        prev.activeVoice === 'treble' ? [...prev.trebleNotes] : [...prev.bassNotes];

      // firstNote 보호
      if (prev.activeVoice === 'treble' && firstNote && prev.selectedNoteIndex === 0) {
        return prev;
      }

      if (prev.selectedNoteIndex < 0 || prev.selectedNoteIndex >= notes.length) return prev;

      notes.splice(prev.selectedNoteIndex, 1);

      return {
        ...prev,
        trebleNotes: prev.activeVoice === 'treble' ? notes : prev.trebleNotes,
        bassNotes: prev.activeVoice === 'bass' ? notes : prev.bassNotes,
        selectedNoteIndex: null,
      };
    });
  }, [firstNote]);

  const getUserAbcString = useCallback((): string => {
    return generateAbc({
      title: '',
      keySignature,
      timeSignature,
      tempo: 120,
      notes: state.trebleNotes,
      bassNotes: useGrandStaff ? state.bassNotes : undefined,
      useGrandStaff,
    });
  }, [keySignature, timeSignature, useGrandStaff, state.trebleNotes, state.bassNotes]);

  const reset = useCallback((newFirstNote?: ScoreNote | null) => {
    setState(makeInitialState(newFirstNote ?? firstNote));
  }, [firstNote]);

  return {
    // State
    ...state,
    // Derived
    getActiveNotes,
    getRemainingDuration,
    canAddDuration,
    // Actions
    setDuration,
    toggleDot,
    setAccidentalMode,
    toggleTie,
    setActiveVoice,
    addNote,
    addRest,
    undo,
    clear,
    selectNote,
    updateSelectedNoteDuration,
    deleteSelectedNote,
    getUserAbcString,
    reset,
  };
}
