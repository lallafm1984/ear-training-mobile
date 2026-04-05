// ─────────────────────────────────────────────────────────────
// useNoteInput — 음표 입력 상태 관리 훅
// ─────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import type { ScoreNote, NoteDuration, PitchName, Accidental } from '../lib/scoreUtils';
import { uid, durationToSixteenths, getSixteenthsPerBar, getKeySigAlteration } from '../lib/scoreUtils';

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

// ── Simple ABC converter (no engraving transforms) ──

/** 사용자 입력 음표를 ABC 문자열로 직접 변환 — engraving 변환 없이 그대로 출력 */
function userNotesToAbc(
  notes: ScoreNote[],
  keySignature: string,
  timeSignature: string,
  bassNotes?: ScoreNote[],
  useGrandStaff?: boolean,
): string {
  if (notes.length === 0 && (!bassNotes || bassNotes.length === 0)) return '';

  const barSixteenths = getSixteenthsPerBar(timeSignature);

  function noteToAbcStr(note: ScoreNote, keySig: string): string {
    if (note.pitch === 'rest') {
      const dur = durationToSixteenths(note.duration);
      return `z${dur === 1 ? '' : dur}`;
    }

    // ABC pitch: C D E F G A B = octave 5, c d e f g a b = octave 5 in ABC
    // Actually in ABC with L:1/16: C,, = C2, C, = C3, C = C4, c = C5, c' = C6
    const pitchName = note.pitch;
    const octave = note.octave;

    let abcPitch: string;
    if (octave <= 4) {
      abcPitch = pitchName.toUpperCase();
      for (let i = octave; i < 4; i++) abcPitch += ',';
    } else {
      abcPitch = pitchName.toLowerCase();
      for (let i = 5; i < octave; i++) abcPitch += "'";
    }

    // 임시표 처리
    const keySigAlt = getKeySigAlteration(keySig, pitchName);
    if (note.accidental === '#' && keySigAlt !== '#') {
      abcPitch = '^' + abcPitch;
    } else if (note.accidental === 'b' && keySigAlt !== 'b') {
      abcPitch = '_' + abcPitch;
    } else if (note.accidental === 'n' || (note.accidental === '' && (keySigAlt === '#' || keySigAlt === 'b'))) {
      // 내추럴이 필요한 경우 (조표에 의한 변화음을 취소)
      if (keySigAlt) abcPitch = '=' + abcPitch;
    }

    const dur = durationToSixteenths(note.duration);
    const durStr = dur === 1 ? '' : dur.toString();

    let result = abcPitch + durStr;
    if (note.tie) result += '-';
    return result;
  }

  function notesBodyAbc(noteArr: ScoreNote[], keySig: string): string {
    let abc = '';
    let barPos = 0;
    for (const note of noteArr) {
      abc += noteToAbcStr(note, keySig) + ' ';
      barPos += durationToSixteenths(note.duration);
      if (barPos >= barSixteenths) {
        abc += '| ';
        barPos = 0;
      }
    }
    abc = abc.trimEnd();
    if (!abc.endsWith('|')) abc += ' |]';
    else abc = abc.slice(0, -1) + ']';
    return abc;
  }

  const header = [
    'X: 1',
    'T: ',
    `M: ${timeSignature}`,
    'L: 1/16',
    'Q: 1/4=90',
    useGrandStaff ? '%%staves {V1 V2}' : null,
    `K: ${keySignature}`,
  ].filter(Boolean).join('\n');

  if (!useGrandStaff || !bassNotes) {
    return header + '\n' + notesBodyAbc(notes, keySignature);
  }

  const trebleBody = notesBodyAbc(notes, keySignature);
  const bassBody = bassNotes.length > 0 ? notesBodyAbc(bassNotes, keySignature) : 'z16 |]';
  return header + '\nV:V1 clef=treble\n' + trebleBody + '\nV:V2 clef=bass\n' + bassBody;
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

/** 음표 인덱스가 속한 마디의 시작/끝 인덱스와 마디 내 위치 반환 */
function getMeasureInfo(notes: ScoreNote[], noteIndex: number, barLen: number) {
  let cumulative = 0;
  let measureStartIdx = 0;
  let measureCum = 0; // 현재 마디 내 누적

  for (let i = 0; i < notes.length; i++) {
    const dur = durationToSixteenths(notes[i].duration);
    if (measureCum + dur > barLen) {
      // 새 마디 시작
      measureStartIdx = i;
      measureCum = 0;
    }
    if (i === noteIndex) {
      // 이 마디의 총 음가 계산 (이 마디에 속하는 모든 음표)
      let measureTotal = 0;
      let measureEndIdx = i; // inclusive
      let tempCum = 0;
      for (let j = measureStartIdx; j < notes.length; j++) {
        const d = durationToSixteenths(notes[j].duration);
        if (tempCum + d > barLen) break;
        tempCum += d;
        measureEndIdx = j;
      }
      measureTotal = tempCum;
      return {
        measureStartIdx,
        measureEndIdx,
        posInMeasure: measureCum,
        measureTotal,
        isMeasureFull: measureTotal >= barLen,
        spaceBeforeNote: measureCum,                          // 이 음표 전까지 사용된 공간
        spaceAfterNote: measureTotal - measureCum - dur,      // 이 음표 뒤 남은 공간
      };
    }
    measureCum += dur;
    if (measureCum >= barLen) {
      measureCum = 0;
      measureStartIdx = i + 1;
    }
  }
  return {
    measureStartIdx: 0, measureEndIdx: 0, posInMeasure: 0,
    measureTotal: 0, isMeasureFull: false, spaceBeforeNote: 0, spaceAfterNote: 0,
  };
}

/** duration에 해당하는 쉼표 ScoreNote 생성 */
function makeRestNote(dur: NoteDuration): ScoreNote {
  return { id: uid(), pitch: 'rest' as PitchName, octave: 0, accidental: '' as Accidental, duration: dur };
}

/** 16분음표 수를 NoteDuration으로 변환 (가능한 경우) */
const SIXTEENTHS_TO_NOEDUR: Record<number, NoteDuration> = {
  16: '1', 12: '2.', 8: '2', 6: '4.', 4: '4', 3: '8.', 2: '8', 1: '16',
};

/** 배열 내 연속된 쉼표를 합쳐서 하나의 쉼표로 만듦 (마디 경계 내에서만) */
function mergeAdjacentRests(notes: ScoreNote[], barLen: number): ScoreNote[] {
  const result: ScoreNote[] = [];
  let barPos = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const dur = durationToSixteenths(note.duration);

    if (note.pitch === 'rest') {
      // 연속 쉼표 합산 (마디 경계 넘지 않게)
      let totalRestDur = dur;
      const barRemain = barLen - barPos;
      let j = i + 1;
      while (j < notes.length && notes[j].pitch === 'rest') {
        const nextDur = durationToSixteenths(notes[j].duration);
        if (totalRestDur + nextDur > barRemain) break; // 마디 경계 넘으면 중단
        totalRestDur += nextDur;
        j++;
      }

      // 합산된 음가에 맞는 단일 쉼표가 있으면 사용
      const merged = SIXTEENTHS_TO_NOEDUR[totalRestDur];
      if (merged) {
        result.push(makeRestNote(merged));
      } else {
        // 단일 쉼표로 표현 불가 → 가능한 큰 쉼표들로 분해
        const rests = makeRests(totalRestDur);
        result.push(...rests);
      }

      barPos += totalRestDur;
      i = j - 1; // for 루프에서 i++ 하므로
    } else {
      result.push(note);
      barPos += dur;
    }

    if (barPos >= barLen) barPos = 0;
  }
  return result;
}

/** 주어진 16ths를 쉼표 ScoreNote 배열로 분해 */
function makeRests(sixteenths: number): ScoreNote[] {
  const rests: ScoreNote[] = [];
  let remain = sixteenths;
  const sizes: number[] = [16, 8, 4, 2, 1];
  for (const s of sizes) {
    while (remain >= s && SIXTEENTHS_TO_NOEDUR[s]) {
      rests.push(makeRestNote(SIXTEENTHS_TO_NOEDUR[s]));
      remain -= s;
    }
  }
  return rests;
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
          // 교체 모드: 음높이만 변경, 음길이는 원래 것 유지
          notes[prev.selectedNoteIndex] = {
            ...oldNote,
            pitch,
            octave,
            accidental: resolvedAccidental,
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
    setState(prev => {
      const newIndex = prev.selectedNoteIndex === index ? null : index;
      // 선택한 음표의 음길이를 selectedDuration에 반영
      if (newIndex !== null) {
        const notes = prev.activeVoice === 'treble' ? prev.trebleNotes : prev.bassNotes;
        if (newIndex >= 0 && newIndex < notes.length) {
          const note = notes[newIndex];
          // 점음표면 기�� 음길이 + isDotted로 분리
          const durStr = note.duration as string;
          if (durStr.endsWith('.')) {
            const baseDur = durStr.slice(0, -1) as NoteDuration;
            return { ...prev, selectedNoteIndex: newIndex, selectedDuration: baseDur, isDotted: true };
          }
          return { ...prev, selectedNoteIndex: newIndex, selectedDuration: note.duration, isDotted: false };
        }
      }
      return { ...prev, selectedNoteIndex: newIndex };
    });
  }, []);

  /** 선택된 음표의 음길이만 변경 (편집 모드 전용)
   *  - 짧아지면: 마디가 꽉 찬 경우에만 차이만큼 쉼표 삽입
   *  - 길어지면: 마디 내 공간 부족 시 거부
   */
  const updateSelectedNoteDuration = useCallback((dur: NoteDuration) => {
    setState(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;
      if (idx < 0 || idx >= notes.length) return prev;

      // firstNote 보호
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;

      const oldDur16 = durationToSixteenths(notes[idx].duration);
      const newDur16 = durationToSixteenths(dur);
      if (oldDur16 === newDur16) return prev;

      const info = getMeasureInfo(notes, idx, barSixteenths);
      // 마디 내에서 이 음표를 제외한 사용 공간
      const otherUsed = info.measureTotal - oldDur16;
      const maxForNote = barSixteenths - otherUsed;

      if (newDur16 > maxForNote) return prev; // 마디 초과 → 거부

      notes[idx] = { ...notes[idx], duration: dur };

      if (newDur16 < oldDur16 && info.isMeasureFull) {
        // 짧아지고 마디가 꽉 찼었을 때 ��� 차이만큼 쉼표 삽입
        const gap = oldDur16 - newDur16;
        const rests = makeRests(gap);
        notes.splice(idx + 1, 0, ...rests);
      }

      // 연속 쉼표 합치기
      const merged = mergeAdjacentRests(notes, barSixteenths);
      return { ...prev, [key]: merged };
    });
  }, [barSixteenths, firstNote]);

  /** 편집 모드에서 특정 음길이로 변경 가능한지 확인 */
  const canEditDuration = useCallback((dur: NoteDuration): boolean => {
    const notes = getActiveNotes();
    if (state.selectedNoteIndex === null || state.selectedNoteIndex >= notes.length) return false;
    const idx = state.selectedNoteIndex;
    if (state.activeVoice === 'treble' && firstNote && idx === 0) return false;

    const oldDur16 = durationToSixteenths(notes[idx].duration);
    const newDur16 = durationToSixteenths(dur);
    if (newDur16 <= oldDur16) return true; // 줄이거나 같으면 항상 허용

    const info = getMeasureInfo(notes, idx, barSixteenths);
    const otherUsed = info.measureTotal - oldDur16;
    return newDur16 <= barSixteenths - otherUsed;
  }, [getActiveNotes, state.selectedNoteIndex, state.activeVoice, firstNote, barSixteenths]);

  /** 선택된 음표를 같은 길이의 쉼표로 변환 (편집 모드 전용) */
  const replaceWithRest = useCallback(() => {
    setState(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;
      if (idx < 0 || idx >= notes.length) return prev;

      // 이미 쉼표면 무시
      if (notes[idx].pitch === 'rest') return prev;

      notes[idx] = makeRestNote(notes[idx].duration);
      const merged = mergeAdjacentRests(notes, barSixteenths);
      return { ...prev, [key]: merged, selectedNoteIndex: null };
    });
  }, [firstNote, barSixteenths]);

  /** 선택된 음표를 같은 길이의 쉼표로 대체 (삭제 = 쉼표 대체, 마디 구조 유지) */
  const deleteSelectedNote = useCallback(() => {
    setState(prev => {
      if (prev.selectedNoteIndex === null) return prev;

      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;

      // firstNote 보호
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;
      if (idx < 0 || idx >= notes.length) return prev;

      // 삭제 대신 같은 길이의 쉼표로 대체
      const deletedDur = notes[idx].duration;
      notes[idx] = makeRestNote(deletedDur);

      // 연속 쉼표 합치기
      const merged = mergeAdjacentRests(notes, barSixteenths);

      return {
        ...prev,
        [key]: merged,
        selectedNoteIndex: null,
      };
    });
  }, [firstNote]);

  const getUserAbcString = useCallback((): string => {
    return userNotesToAbc(
      state.trebleNotes,
      keySignature,
      timeSignature,
      useGrandStaff ? state.bassNotes : undefined,
      useGrandStaff,
    );
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
    canEditDuration,
    replaceWithRest,
    deleteSelectedNote,
    getUserAbcString,
    reset,
  };
}
