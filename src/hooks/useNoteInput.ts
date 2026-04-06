// ─────────────────────────────────────────────────────────────
// useNoteInput — 음표 입력 상태 관리 훅
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react';
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
  tripletMode: boolean;
  selectedNoteIndex: number | null;
  editSnapshot: { trebleNotes: ScoreNote[]; bassNotes: ScoreNote[] } | null;
  tripletEditStep: number; // 0, 1, 2 — which note in triplet group to edit next
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
  trebleInvisibleFrom?: number,
  bassInvisibleFrom?: number,
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

  function notesBodyAbc(noteArr: ScoreNote[], keySig: string, invisibleFromIndex?: number): string {
    let abc = '';
    let barPos = 0;
    let tupletRemaining = 0;
    let currentTupletNoteDur = 0; // 그룹 시작 시 설정, 전체 음표에 동일 적용

    for (let i = 0; i < noteArr.length; i++) {
      const note = noteArr[i];

      // 셋잇단음표 시작 마커 (앞에 공백으로 beam 분리)
      if (note.tuplet === '3' && tupletRemaining === 0) {
        if (abc.length > 0 && !abc.endsWith(' ') && !abc.endsWith('|')) {
          abc += ' ';
        }
        abc += '(3:2:3';
        tupletRemaining = 3;
        currentTupletNoteDur = note.tupletNoteDur ?? 2; // 첫 음표에서 한번만 설정
      }

      // 셋잇단음표 내부: 그룹 전체 동일 duration, beam 연결 (공백 없음)
      if (tupletRemaining > 0) {
        const noteDur = currentTupletNoteDur;
        // pitch 부분만 생성 (duration 제외)
        const dummyAbc = noteToAbcStr({ ...note, duration: '16' } as ScoreNote, keySig);
        // '16' → durationToSixteenths = 1 → durStr = '' 이므로 pitch만 남음
        const pitchPart = dummyAbc.replace(/-$/, ''); // tie 마커 제거
        abc += pitchPart + (noteDur === 1 ? '' : noteDur);
        tupletRemaining--;
        if (tupletRemaining === 0) {
          // 셋잇단 전체가 tupletSpan 만큼 차지
          barPos += durationToSixteenths(note.tupletSpan ?? '4');
          abc += ' '; // 그룹 끝난 후에만 공백
        }
        // 그룹 내부: 공백 없음 (beam 연결)
      } else {
        // invisible rest 처리: invisibleFromIndex 이상인 rest는 x로 출력
        const isInvisible = invisibleFromIndex !== undefined && i >= invisibleFromIndex && note.pitch === 'rest';
        if (isInvisible) {
          const dur = durationToSixteenths(note.duration);
          abc += `x${dur === 1 ? '' : dur} `;
        } else {
          abc += noteToAbcStr(note, keySig) + ' ';
        }
        barPos += durationToSixteenths(note.duration);
      }

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
    return header + '\n' + notesBodyAbc(notes, keySignature, trebleInvisibleFrom);
  }

  const trebleBody = notesBodyAbc(notes, keySignature, trebleInvisibleFrom);
  const bassBody = bassNotes.length > 0 ? notesBodyAbc(bassNotes, keySignature, bassInvisibleFrom) : 'z16 |]';
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

/** 특정 마디에 속하는 음표들을 반환 */
function getNotesForMeasure(notes: ScoreNote[], measureIdx: number, barLen: number): ScoreNote[] {
  let pos = 0;
  let currentMeasure = 0;
  const result: ScoreNote[] = [];
  for (const note of notes) {
    if (currentMeasure === measureIdx) result.push(note);
    pos += durationToSixteenths(note.duration);
    if (pos >= barLen * (currentMeasure + 1)) {
      currentMeasure++;
      if (currentMeasure > measureIdx) break;
    }
  }
  return result;
}

/** 특정 마디의 시작 인덱스를 반환 */
function getMeasureStartIndex(notes: ScoreNote[], measureIdx: number, barLen: number): number {
  let pos = 0;
  let currentMeasure = 0;
  for (let i = 0; i < notes.length; i++) {
    if (currentMeasure === measureIdx) return i;
    pos += durationToSixteenths(notes[i].duration);
    if (pos >= barLen * (currentMeasure + 1)) {
      currentMeasure++;
    }
  }
  return notes.length;
}

/** 특정 마디에서 사용된 16분음표 수 */
function getMeasureUsed(notes: ScoreNote[], measureIdx: number, barLen: number): number {
  const measureNotes = getNotesForMeasure(notes, measureIdx, barLen);
  return sumSixteenths(measureNotes);
}

/** 특정 마디가 완성되었는지 확인 */
function isMeasureComplete(notes: ScoreNote[], measureIdx: number, barLen: number): boolean {
  return getMeasureUsed(notes, measureIdx, barLen) >= barLen;
}

/** 셋잇단음표 그룹의 시작 인덱스를 찾음. 해당 인덱스가 셋잇단이 아니면 -1 */
function findTripletGroupStart(notes: ScoreNote[], index: number): number {
  if (index < 0 || index >= notes.length) return -1;
  // 현재 음표가 그룹 시작 (tuplet === '3')
  if (notes[index].tuplet === '3') return index;
  // 이전 음표가 그룹 시작이고, 현재가 2번째
  if (index >= 1 && notes[index - 1].tuplet === '3') return index - 1;
  // 2개 전 음표가 그룹 시작이고, 현재가 3번째
  if (index >= 2 && notes[index - 2].tuplet === '3') return index - 2;
  return -1;
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
    tripletMode: false,
    selectedNoteIndex: null,
    editSnapshot: null,
    tripletEditStep: 0,
  };
}

// ── Hook ──

export function useNoteInput(options: UseNoteInputOptions) {
  const { keySignature, timeSignature, measures, useGrandStaff, firstNote } = options;

  const [state, setState] = useState<NoteInputState>(() => makeInitialState(firstNote));

  // ── Undo history stack ──
  const undoHistoryRef = useRef<{ trebleNotes: ScoreNote[]; bassNotes: ScoreNote[] }[]>([]);

  /** setState wrapper that saves undo snapshot before mutation */
  function setStateWithUndo(updater: (prev: NoteInputState) => NoteInputState) {
    setState(prev => {
      const next = updater(prev);
      if (next === prev) return prev; // no change → no undo entry
      undoHistoryRef.current.push({
        trebleNotes: prev.trebleNotes,
        bassNotes: prev.bassNotes,
      });
      if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift();
      return next;
    });
  }

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

  /** 선택된 음표의 붙임줄 토글 (편집 모드 전용) */
  const toggleSelectedTie = useCallback(() => {
    setStateWithUndo(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;
      if (idx < 0 || idx >= notes.length) return prev;

      const note = notes[idx];
      if (note.tie) {
        // 붙임줄 제거
        notes[idx] = { ...note, tie: false };
      } else {
        // 붙임줄 추가: 다음 음표가 같은 음높이일 때만
        const next = notes[idx + 1];
        if (next && next.pitch === note.pitch && next.octave === note.octave && next.pitch !== 'rest') {
          notes[idx] = { ...note, tie: true };
        } else {
          return prev; // 다음 음표가 없거나 다른 음 → 무시
        }
      }
      return { ...prev, [key]: notes };
    });
  }, []);

  const setActiveVoice = useCallback((voice: 'treble' | 'bass') => {
    if (!useGrandStaff) return;
    setState(prev => ({ ...prev, activeVoice: voice, selectedNoteIndex: null }));
  }, [useGrandStaff]);

  const addNote = useCallback(
    (pitch: PitchName, octave: number, accidental?: Accidental) => {
      setStateWithUndo(prev => {
        const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
        const notes = [...prev[key] as ScoreNote[]];

        // 임시표 결정: accidentalMode 우선, 그 다음 인자
        const resolvedAccidental: Accidental =
          prev.accidentalMode === '#' ? '#' :
          prev.accidentalMode === 'b' ? 'b' :
          accidental ?? '';

        // ── 셋잇단음표 모드 ──
        if (prev.tripletMode && prev.selectedNoteIndex === null) {
          // 셋잇단음표: 4분음표(4 sixteenths) 공간에 3개 음표
          const spanSixteenths = 4; // 항상 4분음표 공간
          const remaining = totalSixteenths - sumSixteenths(notes);
          if (spanSixteenths > remaining) return prev;

          for (let i = 0; i < 3; i++) {
            notes.push({
              id: uid(),
              pitch,
              octave,
              accidental: resolvedAccidental,
              duration: '8' as NoteDuration,
              ...(i === 0
                ? { tuplet: '3' as any, tupletSpan: '4' as NoteDuration, tupletNoteDur: 2 }
                : { tupletNoteDur: 1 }),
            });
          }

          return {
            ...prev,
            [key]: notes,
            accidentalMode: null,
            isDotted: false,
            tripletMode: false,
            selectedNoteIndex: null,
          };
        }

        // ── 선택된 음표가 있으면 교체 모드 ──
        if (prev.selectedNoteIndex !== null && prev.selectedNoteIndex >= 0 && prev.selectedNoteIndex < notes.length) {
          // firstNote(인덱스 0) 보호
          if (prev.activeVoice === 'treble' && firstNote && prev.selectedNoteIndex === 0) {
            return { ...prev, selectedNoteIndex: null, accidentalMode: null, tripletEditStep: 0 };
          }

          const isTripletGroup = notes[prev.selectedNoteIndex].tuplet === '3';

          if (isTripletGroup) {
            // 셋잇단음표 그룹: 순서대로 음높이 변경
            const editIdx = prev.selectedNoteIndex + prev.tripletEditStep;
            if (editIdx < notes.length) {
              notes[editIdx] = {
                ...notes[editIdx],
                pitch,
                octave,
                accidental: resolvedAccidental,
                id: uid(),
              };
            }
            const nextStep = prev.tripletEditStep + 1;
            if (nextStep >= 3) {
              // 3개 다 변경 완료 → 선택 해제
              return {
                ...prev,
                [key]: notes,
                accidentalMode: null,
                selectedNoteIndex: null,
                tripletEditStep: 0,
              };
            }
            return {
              ...prev,
              [key]: notes,
              accidentalMode: null,
              tripletEditStep: nextStep,
            };
          }

          // 일반 음표 교체 (기존 로직)
          const oldNote = notes[prev.selectedNoteIndex];
          notes[prev.selectedNoteIndex] = {
            ...oldNote,
            pitch,
            octave,
            accidental: resolvedAccidental,
            id: uid(),
          };

          return {
            ...prev,
            [key]: notes,
            accidentalMode: null,
            isDotted: false,
            selectedNoteIndex: null,
            tripletEditStep: 0,
          };
        }

        // ── 선택 없으면 기존 추가 모드 ──
        let effectiveDur: NoteDuration = prev.selectedDuration;
        if (prev.isDotted) {
          effectiveDur = applyDot(effectiveDur);
        }

        // 전체 남은 공간 확인
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
          [key]: notes,
          // 입력 후 모드 초기화
          accidentalMode: null,
          isDotted: false,
          tieMode: false,
          selectedNoteIndex: null,
        };
      });
    },
    [totalSixteenths, firstNote, barSixteenths, measures],
  );

  const addRest = useCallback(() => {
    setStateWithUndo(prev => {
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
    const snapshot = undoHistoryRef.current.pop();
    if (!snapshot) return;
    setState(prev => ({
      ...prev,
      trebleNotes: snapshot.trebleNotes,
      bassNotes: snapshot.bassNotes,
      selectedNoteIndex: null,
      editSnapshot: null,
      tripletEditStep: 0,
    }));
  }, []);

  const clear = useCallback(() => {
    undoHistoryRef.current = [];
    setState(prev => ({
      ...prev,
      trebleNotes: firstNote ? [firstNote] : [],
      bassNotes: [],
      selectedNoteIndex: null,
    }));
  }, [firstNote]);

  const selectNote = useCallback((index: number | null) => {
    setState(prev => {
      if (index === null) {
        return { ...prev, selectedNoteIndex: null, editSnapshot: null, tripletEditStep: 0 };
      }
      const notes = prev.activeVoice === 'treble' ? prev.trebleNotes : prev.bassNotes;

      // 셋잇단음표 그룹이면 시작 인덱스로 설정
      const tripletStart = findTripletGroupStart(notes, index);
      const newIndex = tripletStart >= 0 ? tripletStart : index;

      // 토글: 같은 음표 다시 선택하면 해제
      if (prev.selectedNoteIndex === newIndex) {
        return { ...prev, selectedNoteIndex: null, editSnapshot: null, tripletEditStep: 0 };
      }

      // 스냅샷 저장 (첫 선택 시)
      const snapshot = prev.editSnapshot ?? {
        trebleNotes: [...prev.trebleNotes],
        bassNotes: [...prev.bassNotes],
      };

      // 선택한 음표의 음길이 반영
      if (newIndex >= 0 && newIndex < notes.length) {
        const note = notes[newIndex];
        const durStr = note.duration as string;
        if (durStr.endsWith('.')) {
          return { ...prev, selectedNoteIndex: newIndex, selectedDuration: durStr.slice(0, -1) as NoteDuration, isDotted: true, editSnapshot: snapshot, tripletEditStep: 0 };
        }
        return { ...prev, selectedNoteIndex: newIndex, selectedDuration: note.duration, isDotted: false, editSnapshot: snapshot, tripletEditStep: 0 };
      }
      return { ...prev, selectedNoteIndex: newIndex, editSnapshot: snapshot, tripletEditStep: 0 };
    });
  }, []);

  /** 선택된 음표의 음길이만 변경 (편집 모드 전용)
   *  - 짧아지면: 마디가 꽉 찬 경우에만 차이만큼 쉼표 삽입
   *  - 길어지면: 마디 내 공간 부족 시 거부
   */
  const updateSelectedNoteDuration = useCallback((dur: NoteDuration) => {
    setStateWithUndo(prev => {
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

    // 셋잇단음표는 음길이 변경 불가
    if (notes[idx].tuplet === '3') return false;

    const oldDur16 = durationToSixteenths(notes[idx].duration);
    const newDur16 = durationToSixteenths(dur);
    if (newDur16 <= oldDur16) return true; // 줄이거나 같으면 항상 허용

    const info = getMeasureInfo(notes, idx, barSixteenths);
    const otherUsed = info.measureTotal - oldDur16;
    return newDur16 <= barSixteenths - otherUsed;
  }, [getActiveNotes, state.selectedNoteIndex, state.activeVoice, firstNote, barSixteenths]);

  /** 선택된 음표를 셋잇단음표로 변환 (4분음표 → 8분×3) */
  const replaceWithTriplet = useCallback(() => {
    setStateWithUndo(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;
      if (idx < 0 || idx >= notes.length) return prev;

      const note = notes[idx];
      // 이미 셋잇단이면 무시
      if (note.tuplet === '3') return prev;
      // 4분음표(4 sixteenths) 이상이어야 셋잇단 변환 가능
      const dur16 = durationToSixteenths(note.duration);
      if (dur16 < 4) return prev;

      // 원래 음표를 3개의 셋잇단으로 교체
      const tripletNotes: ScoreNote[] = [];
      for (let i = 0; i < 3; i++) {
        tripletNotes.push({
          id: uid(),
          pitch: note.pitch,
          octave: note.octave,
          accidental: note.accidental,
          duration: '8' as NoteDuration,
          ...(i === 0
            ? { tuplet: '3' as any, tupletSpan: '4' as NoteDuration, tupletNoteDur: 2 }
            : { tupletNoteDur: 1 }),
        });
      }

      // 원래 음표가 4분음표보다 길면 나머지를 쉼표로 채움
      const remainDur = dur16 - 4;
      const restNotes = remainDur > 0 ? makeRests(remainDur) : [];

      notes.splice(idx, 1, ...tripletNotes, ...restNotes);
      const merged = mergeAdjacentRests(notes, barSixteenths);

      return { ...prev, [key]: merged, selectedNoteIndex: null, tripletEditStep: 0 };
    });
  }, [firstNote, barSixteenths]);

  /** 선택된 음표를 같은 길이의 쉼표로 변환 (편집 모드 전용) */
  const replaceWithRest = useCallback(() => {
    setStateWithUndo(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;
      if (idx < 0 || idx >= notes.length) return prev;

      const isTripletGroup = notes[idx].tuplet === '3';

      if (isTripletGroup) {
        // 셋잇단 3개 제거 → 4분쉼표로 대체
        const removeCount = Math.min(3, notes.length - idx);
        notes.splice(idx, removeCount, makeRestNote('4'));
        const merged = mergeAdjacentRests(notes, barSixteenths);
        return { ...prev, [key]: merged, selectedNoteIndex: null, tripletEditStep: 0 };
      }

      // 이미 쉼표면 무시
      if (notes[idx].pitch === 'rest') return prev;

      notes[idx] = makeRestNote(notes[idx].duration);
      const merged = mergeAdjacentRests(notes, barSixteenths);
      return { ...prev, [key]: merged, selectedNoteIndex: null, tripletEditStep: 0 };
    });
  }, [firstNote, barSixteenths]);

  /** 선택된 음표를 같은 길이의 쉼표로 대체 (삭제 = 쉼표 대체, 마디 구조 유지) */
  const deleteSelectedNote = useCallback(() => {
    setStateWithUndo(prev => {
      if (prev.selectedNoteIndex === null) return prev;

      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key] as ScoreNote[]];
      const idx = prev.selectedNoteIndex;

      // firstNote 보호
      if (prev.activeVoice === 'treble' && firstNote && idx === 0) return prev;
      if (idx < 0 || idx >= notes.length) return prev;

      const isTripletGroup = notes[idx].tuplet === '3';

      if (isTripletGroup) {
        // 셋잇단 3개 제거 → 4분쉼표로 대체
        const removeCount = Math.min(3, notes.length - idx);
        notes.splice(idx, removeCount, makeRestNote('4'));
        const merged = mergeAdjacentRests(notes, barSixteenths);
        return { ...prev, [key]: merged, selectedNoteIndex: null, tripletEditStep: 0 };
      }

      // 일반 음표: 같은 길이 쉼표로 대체
      notes[idx] = makeRestNote(notes[idx].duration);

      // 연속 쉼표 합치기
      const merged = mergeAdjacentRests(notes, barSixteenths);

      return {
        ...prev,
        [key]: merged,
        selectedNoteIndex: null,
        tripletEditStep: 0,
      };
    });
  }, [firstNote, barSixteenths]);

  /** 수정 취소: 스냅샷으로 복원 */
  const cancelEdit = useCallback(() => {
    setState(prev => {
      if (!prev.editSnapshot) return { ...prev, selectedNoteIndex: null, tripletEditStep: 0 };
      return {
        ...prev,
        trebleNotes: prev.editSnapshot.trebleNotes,
        bassNotes: prev.editSnapshot.bassNotes,
        selectedNoteIndex: null,
        editSnapshot: null,
        tripletEditStep: 0,
      };
    });
  }, []);

  /** 셋잇단음표 모드 토글 */
  const toggleTriplet = useCallback(() => {
    setState(prev => ({ ...prev, tripletMode: !prev.tripletMode }));
  }, []);

  const getUserAbcString = useCallback((): string => {
    const trebleLen = state.trebleNotes.length;
    const bassLen = state.bassNotes.length;
    const trebleRemain = totalSixteenths - sumSixteenths(state.trebleNotes);
    const bassRemain = useGrandStaff ? totalSixteenths - sumSixteenths(state.bassNotes) : 0;
    const paddedTreble = trebleRemain > 0 ? [...state.trebleNotes, ...makeRests(trebleRemain)] : state.trebleNotes;
    const paddedBass = useGrandStaff
      ? (bassRemain > 0 ? [...state.bassNotes, ...makeRests(bassRemain)] : state.bassNotes)
      : undefined;

    return userNotesToAbc(
      paddedTreble,
      keySignature,
      timeSignature,
      paddedBass,
      useGrandStaff,
      trebleLen,   // invisibleFromIndex for treble
      bassLen,     // invisibleFromIndex for bass
    );
  }, [keySignature, timeSignature, useGrandStaff, state.trebleNotes, state.bassNotes, totalSixteenths]);

  /** 현재 입력 위치 정보 (마디, 박) */
  const getCurrentPositionInfo = useCallback(() => {
    const notes = getActiveNotes();
    const used = sumSixteenths(notes);
    const [tsTop, tsBottom] = timeSignature.split('/').map(Number);
    const beatUnit = 16 / (tsBottom || 4);
    const currentMeasure = Math.floor(used / barSixteenths);
    const posInMeasure = used % barSixteenths;
    const currentBeat = Math.floor(posInMeasure / beatUnit) + 1;
    return { measure: Math.min(currentMeasure + 1, measures), beat: currentBeat, totalMeasures: measures };
  }, [getActiveNotes, timeSignature, barSixteenths, measures]);

  /** 모든 공간이 채워졌는지 확인 */
  const isComplete = sumSixteenths(getActiveNotes()) >= totalSixteenths;

  const reset = useCallback((newFirstNote?: ScoreNote | null) => {
    undoHistoryRef.current = [];
    setState(makeInitialState(newFirstNote ?? firstNote));
  }, [firstNote]);

  const isTripletSelected = state.selectedNoteIndex !== null &&
    getActiveNotes()[state.selectedNoteIndex]?.tuplet === '3';

  const isSelectedNoteTied = state.selectedNoteIndex !== null &&
    !!getActiveNotes()[state.selectedNoteIndex]?.tie;

  return {
    // State
    ...state,
    // Derived
    getActiveNotes,
    getRemainingDuration,
    canAddDuration,
    isTripletSelected,
    isSelectedNoteTied,
    isComplete,
    getCurrentPositionInfo,
    // Actions
    setDuration,
    toggleDot,
    setAccidentalMode,
    toggleTie,
    toggleSelectedTie,
    setActiveVoice,
    addNote,
    addRest,
    undo,
    canUndo: undoHistoryRef.current.length > 0,
    clear,
    selectNote,
    updateSelectedNoteDuration,
    canEditDuration,
    replaceWithRest,
    replaceWithTriplet,
    deleteSelectedNote,
    cancelEdit,
    toggleTriplet,
    getUserAbcString,
    reset,
  };
}
