# 선율/2성부 받아쓰기 악보 입력 & 자동 채점 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선율/2성부 받아쓰기에서 자기평가 방식을 피아노 건반 입력 + 자동 채점 방식으로 변경한다.

**Architecture:** React Native 네이티브 컴포넌트(피아노 건반, 음길이 버튼)로 입력을 받고, 기존 ABCJS WebView로 악보를 실시간 렌더링한다. 채점은 붙임줄/점음표 등가 처리를 포함한 정규화 비교 방식을 사용한다.

**Tech Stack:** React Native, TypeScript, ABCJS (WebView), Jest

---

## File Structure

### 새로 생성

| 파일 | 책임 |
|------|------|
| `src/lib/grading.ts` | 정규화(NormalizedNote) + 채점 로직 |
| `src/__tests__/grading.test.ts` | 채점 로직 테스트 |
| `src/hooks/useNoteInput.ts` | 음표 입력 상태 관리 훅 |
| `src/components/PianoKeyboard.tsx` | 스크롤 가능한 피아노 건반 컴포넌트 |
| `src/components/DurationToolbar.tsx` | 음길이 + 도구 버튼 바 컴포넌트 |
| `src/components/GradingResult.tsx` | 채점 결과 표시 컴포넌트 |

### 수정

| 파일 | 변경 |
|------|------|
| `src/screens/NotationPracticeScreen.tsx` | melody/twoVoice에서 자기평가 → 입력+채점 UI로 분기 |

---

### Task 1: 채점 로직 — 정규화 함수

**Files:**
- Create: `src/lib/grading.ts`
- Create: `src/__tests__/grading.test.ts`

- [ ] **Step 1: 테스트 파일 생성 — normalizeNotes 기본 케이스**

```typescript
// src/__tests__/grading.test.ts
import { normalizeNotes, type NormalizedNote } from '../lib/grading';
import type { ScoreNote } from '../lib/scoreUtils';
import { uid } from '../lib/scoreUtils';

function makeNote(pitch: string, octave: number, duration: string, options: Partial<ScoreNote> = {}): ScoreNote {
  return {
    pitch: pitch as any,
    octave,
    accidental: options.accidental ?? '' as any,
    duration: duration as any,
    tie: options.tie,
    tuplet: options.tuplet,
    tupletSpan: options.tupletSpan,
    tupletNoteDur: options.tupletNoteDur,
    id: uid(),
  };
}

describe('normalizeNotes', () => {
  it('단순 음표 나열은 그대로 변환', () => {
    const notes = [
      makeNote('C', 4, '4'),
      makeNote('D', 4, '4'),
      makeNote('E', 4, '2'),
    ];
    const result = normalizeNotes(notes);
    expect(result).toEqual([
      { pitch: 'C4', totalDuration: 4, sourceIndices: [0] },
      { pitch: 'D4', totalDuration: 4, sourceIndices: [1] },
      { pitch: 'E4', totalDuration: 8, sourceIndices: [2] },
    ]);
  });

  it('붙임줄로 연결된 같은 음높이 음표를 합산', () => {
    const notes = [
      makeNote('C', 4, '4', { tie: true }),
      makeNote('C', 4, '8'),
    ];
    const result = normalizeNotes(notes);
    expect(result).toEqual([
      { pitch: 'C4', totalDuration: 6, sourceIndices: [0, 1] },
    ]);
  });

  it('점음표는 총 음가로 변환', () => {
    const notes = [
      makeNote('C', 4, '4.'),
    ];
    const result = normalizeNotes(notes);
    expect(result).toEqual([
      { pitch: 'C4', totalDuration: 6, sourceIndices: [0] },
    ]);
  });

  it('쉼표는 pitch를 rest로 변환', () => {
    const notes = [
      makeNote('rest', 0, '4'),
    ];
    const result = normalizeNotes(notes);
    expect(result).toEqual([
      { pitch: 'rest', totalDuration: 4, sourceIndices: [0] },
    ]);
  });

  it('임시표가 있는 음표는 pitch에 포함', () => {
    const notes = [
      makeNote('F', 4, '4', { accidental: '#' as any }),
    ];
    const result = normalizeNotes(notes);
    expect(result).toEqual([
      { pitch: 'F#4', totalDuration: 4, sourceIndices: [0] },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx jest src/__tests__/grading.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../lib/grading'`

- [ ] **Step 3: normalizeNotes 구현**

```typescript
// src/lib/grading.ts
import { durationToSixteenths } from './scoreUtils';
import type { ScoreNote } from './scoreUtils';

export interface NormalizedNote {
  pitch: string;           // "C4", "F#4", "rest"
  totalDuration: number;   // 16분음표 단위
  sourceIndices: number[]; // 원본 ScoreNote 인덱스
}

function scorePitch(note: ScoreNote): string {
  if (note.pitch === 'rest') return 'rest';
  const acc = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
  return `${note.pitch}${acc}${note.octave}`;
}

export function normalizeNotes(notes: ScoreNote[]): NormalizedNote[] {
  const result: NormalizedNote[] = [];
  let i = 0;

  while (i < notes.length) {
    const note = notes[i];
    const pitch = scorePitch(note);
    let totalDuration = durationToSixteenths(note.duration);
    const sourceIndices = [i];

    // 붙임줄로 연결된 같은 음높이 음표들을 합산
    while (note.tie && i + 1 < notes.length) {
      const next = notes[i + 1];
      if (scorePitch(next) !== pitch) break;
      i++;
      totalDuration += durationToSixteenths(next.duration);
      sourceIndices.push(i);
      if (!next.tie) break;
    }

    result.push({ pitch, totalDuration, sourceIndices });
    i++;
  }

  return result;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx jest src/__tests__/grading.test.ts --no-coverage`
Expected: PASS — 5 tests passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/grading.ts src/__tests__/grading.test.ts
git commit -m "feat: 채점 정규화 함수 normalizeNotes 구현"
```

---

### Task 2: 채점 로직 — gradeNotes 함수

**Files:**
- Modify: `src/lib/grading.ts`
- Modify: `src/__tests__/grading.test.ts`

- [ ] **Step 1: gradeNotes 테스트 추가**

```typescript
// src/__tests__/grading.test.ts 에 추가
import { normalizeNotes, gradeNotes, type GradingResult, type NoteGrade } from '../lib/grading';

describe('gradeNotes', () => {
  it('완벽히 일치하면 모두 correct', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const user   = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.accuracy).toBe(1.0);
    expect(result.grades.every(g => g.grade === 'correct')).toBe(true);
  });

  it('음높이만 맞으면 partial', () => {
    const answer = [makeNote('C', 4, '4')];
    const user   = [makeNote('C', 4, '8')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('partial');
  });

  it('음길이만 맞으면 partial', () => {
    const answer = [makeNote('C', 4, '4')];
    const user   = [makeNote('D', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('partial');
  });

  it('둘 다 틀리면 wrong', () => {
    const answer = [makeNote('C', 4, '4')];
    const user   = [makeNote('D', 4, '8')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('wrong');
  });

  it('붙임줄과 점음표 등가 처리', () => {
    const answer = [makeNote('C', 4, '4', { tie: true }), makeNote('C', 4, '8')];
    const user   = [makeNote('C', 4, '4.')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.accuracy).toBe(1.0);
  });

  it('점음표 → 붙임줄 역방향 등가 처리', () => {
    const answer = [makeNote('D', 5, '4.')];
    const user   = [makeNote('D', 5, '4', { tie: true }), makeNote('D', 5, '8')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
  });

  it('누락 음표는 missing 처리', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const user   = [makeNote('C', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.grades[1].grade).toBe('missing');
    expect(result.accuracy).toBe(0.5);
  });

  it('초과 음표는 extra 처리', () => {
    const answer = [makeNote('C', 4, '4')];
    const user   = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
    expect(result.grades[1].grade).toBe('extra');
  });

  it('selfRating 변환: 90%+ → 5', () => {
    const answer = Array(10).fill(null).map(() => makeNote('C', 4, '4'));
    const user   = Array(10).fill(null).map(() => makeNote('C', 4, '4'));
    const result = gradeNotes(answer, user);
    expect(result.selfRating).toBe(5);
  });

  it('selfRating 변환: 0% → 1', () => {
    const answer = [makeNote('C', 4, '4')];
    const user   = [makeNote('D', 4, '8')];
    const result = gradeNotes(answer, user);
    expect(result.selfRating).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx jest src/__tests__/grading.test.ts --no-coverage`
Expected: FAIL — `gradeNotes is not a function`

- [ ] **Step 3: gradeNotes 구현**

```typescript
// src/lib/grading.ts 에 추가

export type NoteGradeType = 'correct' | 'partial' | 'wrong' | 'missing' | 'extra';

export interface NoteGrade {
  grade: NoteGradeType;
  answerSourceIndices: number[];  // 정답 원본 인덱스
  userSourceIndices: number[];    // 사용자 원본 인덱스
}

export interface GradingResult {
  grades: NoteGrade[];
  accuracy: number;       // 0.0 ~ 1.0
  selfRating: number;     // 1 ~ 5
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  missingCount: number;
  extraCount: number;
}

function accuracyToSelfRating(accuracy: number): number {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.7) return 4;
  if (accuracy >= 0.5) return 3;
  if (accuracy >= 0.3) return 2;
  return 1;
}

export function gradeNotes(answerNotes: ScoreNote[], userNotes: ScoreNote[]): GradingResult {
  const answerNorm = normalizeNotes(answerNotes);
  const userNorm = normalizeNotes(userNotes);

  const maxLen = Math.max(answerNorm.length, userNorm.length);
  const grades: NoteGrade[] = [];

  for (let i = 0; i < maxLen; i++) {
    const a = answerNorm[i];
    const u = userNorm[i];

    if (!a) {
      // 초과 음표
      grades.push({ grade: 'extra', answerSourceIndices: [], userSourceIndices: u.sourceIndices });
      continue;
    }
    if (!u) {
      // 누락 음표
      grades.push({ grade: 'missing', answerSourceIndices: a.sourceIndices, userSourceIndices: [] });
      continue;
    }

    const pitchMatch = a.pitch === u.pitch;
    const durationMatch = a.totalDuration === u.totalDuration;

    let grade: NoteGradeType;
    if (pitchMatch && durationMatch) {
      grade = 'correct';
    } else if (pitchMatch || durationMatch) {
      grade = 'partial';
    } else {
      grade = 'wrong';
    }

    grades.push({
      grade,
      answerSourceIndices: a.sourceIndices,
      userSourceIndices: u.sourceIndices,
    });
  }

  const correctCount = grades.filter(g => g.grade === 'correct').length;
  const partialCount = grades.filter(g => g.grade === 'partial').length;
  const wrongCount = grades.filter(g => g.grade === 'wrong').length;
  const missingCount = grades.filter(g => g.grade === 'missing').length;
  const extraCount = grades.filter(g => g.grade === 'extra').length;

  const totalAnswer = answerNorm.length;
  const score = totalAnswer > 0
    ? (correctCount + partialCount * 0.5) / totalAnswer
    : 0;
  const accuracy = Math.round(score * 100) / 100;

  return {
    grades,
    accuracy,
    selfRating: accuracyToSelfRating(accuracy),
    correctCount,
    partialCount,
    wrongCount,
    missingCount,
    extraCount,
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx jest src/__tests__/grading.test.ts --no-coverage`
Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/grading.ts src/__tests__/grading.test.ts
git commit -m "feat: gradeNotes 채점 함수 구현 (등가 처리 포함)"
```

---

### Task 3: useNoteInput 훅

**Files:**
- Create: `src/hooks/useNoteInput.ts`

- [ ] **Step 1: useNoteInput 훅 구현**

```typescript
// src/hooks/useNoteInput.ts
import { useState, useCallback, useRef } from 'react';
import type { ScoreNote, NoteDuration, PitchName, Accidental } from '../lib/scoreUtils';
import { uid, durationToSixteenths, getSixteenthsPerBar } from '../lib/scoreUtils';
import { generateAbc } from '../lib/scoreUtils';

export interface NoteInputState {
  trebleNotes: ScoreNote[];
  bassNotes: ScoreNote[];
  activeVoice: 'treble' | 'bass';
  selectedDuration: NoteDuration;
  isDotted: boolean;
  accidentalMode: '#' | 'b' | null;
  tieMode: boolean;
  restMode: boolean;
  selectedNoteIndex: number | null;
}

interface UseNoteInputOptions {
  keySignature: string;
  timeSignature: string;
  measures: number;
  useGrandStaff: boolean;
  firstNote?: ScoreNote | null;
}

export function useNoteInput(options: UseNoteInputOptions) {
  const { keySignature, timeSignature, measures, useGrandStaff, firstNote } = options;
  const barSixteenths = getSixteenthsPerBar(timeSignature);
  const totalSixteenths = barSixteenths * measures;

  const [state, setState] = useState<NoteInputState>(() => ({
    trebleNotes: firstNote ? [firstNote] : [],
    bassNotes: [],
    activeVoice: 'treble',
    selectedDuration: '4',
    isDotted: false,
    accidentalMode: null,
    tieMode: false,
    restMode: false,
    selectedNoteIndex: null,
  }));

  // 현재 활성 성부의 음표 배열
  const getActiveNotes = useCallback(() => {
    return state.activeVoice === 'treble' ? state.trebleNotes : state.bassNotes;
  }, [state.activeVoice, state.trebleNotes, state.bassNotes]);

  // 현재 성부의 총 음가
  const getCurrentTotalDuration = useCallback(() => {
    const notes = getActiveNotes();
    return notes.reduce((sum, n) => sum + durationToSixteenths(n.duration), 0);
  }, [getActiveNotes]);

  // 남은 음가
  const getRemainingDuration = useCallback(() => {
    return totalSixteenths - getCurrentTotalDuration();
  }, [totalSixteenths, getCurrentTotalDuration]);

  // 실제 음길이 계산 (점음표 고려)
  const getEffectiveDuration = useCallback((): NoteDuration => {
    if (state.isDotted) {
      const dotted = `${state.selectedDuration}.` as NoteDuration;
      // 유효한 점음표인지 확인
      if (['2.', '4.', '8.'].includes(dotted)) return dotted;
    }
    return state.selectedDuration;
  }, [state.selectedDuration, state.isDotted]);

  // 음길이 선택
  const setDuration = useCallback((dur: NoteDuration) => {
    setState(prev => ({ ...prev, selectedDuration: dur, isDotted: false }));
  }, []);

  // 점음표 토글
  const toggleDot = useCallback(() => {
    setState(prev => ({ ...prev, isDotted: !prev.isDotted }));
  }, []);

  // 임시표 모드
  const setAccidentalMode = useCallback((mode: '#' | 'b' | null) => {
    setState(prev => ({
      ...prev,
      accidentalMode: prev.accidentalMode === mode ? null : mode,
    }));
  }, []);

  // 붙임줄 모드
  const toggleTie = useCallback(() => {
    setState(prev => ({ ...prev, tieMode: !prev.tieMode }));
  }, []);

  // 성부 전환
  const setActiveVoice = useCallback((voice: 'treble' | 'bass') => {
    if (!useGrandStaff && voice === 'bass') return;
    setState(prev => ({ ...prev, activeVoice: voice, selectedNoteIndex: null }));
  }, [useGrandStaff]);

  // 음표 추가 (건반 탭)
  const addNote = useCallback((pitch: PitchName, octave: number, accidental: Accidental = '') => {
    const duration = getEffectiveDuration();
    const dur16 = durationToSixteenths(duration);
    if (dur16 > getRemainingDuration()) return;

    const activeNotes = getActiveNotes();
    const lastNote = activeNotes[activeNotes.length - 1];

    // 붙임줄 모드: 이전 음표와 같은 음높이일 때만
    const shouldTie = state.tieMode && lastNote &&
      lastNote.pitch === pitch && lastNote.octave === octave;

    // 임시표 모드에서 건반 탭 시 적용
    const finalAccidental = state.accidentalMode || accidental;

    const newNote: ScoreNote = {
      pitch,
      octave,
      accidental: finalAccidental as Accidental,
      duration,
      tie: undefined,
      id: uid(),
    };

    setState(prev => {
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key]];

      // 이전 음표에 tie 설정
      if (shouldTie && notes.length > 0) {
        notes[notes.length - 1] = { ...notes[notes.length - 1], tie: true };
      }

      notes.push(newNote);
      return {
        ...prev,
        [key]: notes,
        accidentalMode: null,  // 일회성 리셋
        isDotted: false,       // 일회성 리셋
        tieMode: false,        // 일회성 리셋
        selectedNoteIndex: null,
      };
    });
  }, [getEffectiveDuration, getRemainingDuration, getActiveNotes, state.tieMode, state.accidentalMode]);

  // 쉼표 추가
  const addRest = useCallback(() => {
    const duration = getEffectiveDuration();
    const dur16 = durationToSixteenths(duration);
    if (dur16 > getRemainingDuration()) return;

    const newRest: ScoreNote = {
      pitch: 'rest' as PitchName,
      octave: 0,
      accidental: '' as Accidental,
      duration,
      id: uid(),
    };

    setState(prev => {
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      return {
        ...prev,
        [key]: [...prev[key], newRest],
        isDotted: false,
        selectedNoteIndex: null,
      };
    });
  }, [getEffectiveDuration, getRemainingDuration]);

  // Undo (마지막 음표 제거)
  const undo = useCallback(() => {
    setState(prev => {
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key]];
      // firstNote는 삭제 불가
      if (prev.activeVoice === 'treble' && firstNote && notes.length <= 1) return prev;
      if (notes.length === 0) return prev;
      notes.pop();
      // 마지막 음표의 tie 제거
      if (notes.length > 0 && notes[notes.length - 1].tie) {
        notes[notes.length - 1] = { ...notes[notes.length - 1], tie: undefined };
      }
      return { ...prev, [key]: notes, selectedNoteIndex: null };
    });
  }, [firstNote]);

  // Clear (전체 초기화)
  const clear = useCallback(() => {
    setState(prev => {
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const initial = prev.activeVoice === 'treble' && firstNote ? [firstNote] : [];
      return { ...prev, [key]: initial, selectedNoteIndex: null };
    });
  }, [firstNote]);

  // 음표 선택 (악보에서 탭)
  const selectNote = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      selectedNoteIndex: prev.selectedNoteIndex === index ? null : index,
    }));
  }, []);

  // 선택된 음표 삭제
  const deleteSelectedNote = useCallback(() => {
    setState(prev => {
      if (prev.selectedNoteIndex === null) return prev;
      const key = prev.activeVoice === 'treble' ? 'trebleNotes' : 'bassNotes';
      const notes = [...prev[key]];
      // firstNote는 삭제 불가
      if (prev.activeVoice === 'treble' && firstNote && prev.selectedNoteIndex === 0) return prev;
      notes.splice(prev.selectedNoteIndex, 1);
      // 삭제 후 이전 음표의 tie 제거
      if (prev.selectedNoteIndex > 0 && notes[prev.selectedNoteIndex - 1]?.tie) {
        notes[prev.selectedNoteIndex - 1] = { ...notes[prev.selectedNoteIndex - 1], tie: undefined };
      }
      return { ...prev, [key]: notes, selectedNoteIndex: null };
    });
  }, [firstNote]);

  // 사용자 답안 ABC 생성
  const getUserAbcString = useCallback(() => {
    if (state.trebleNotes.length === 0 && state.bassNotes.length === 0) return '';
    return generateAbc({
      title: '',
      keySignature,
      timeSignature,
      tempo: 90,
      notes: state.trebleNotes,
      bassNotes: useGrandStaff ? state.bassNotes : undefined,
      useGrandStaff,
    });
  }, [state.trebleNotes, state.bassNotes, keySignature, timeSignature, useGrandStaff]);

  // 마디 초과 방지: 각 음길이가 입력 가능한지
  const canAddDuration = useCallback((dur: NoteDuration): boolean => {
    return durationToSixteenths(dur) <= getRemainingDuration();
  }, [getRemainingDuration]);

  // 전체 리셋 (다음 문제)
  const reset = useCallback((newFirstNote?: ScoreNote | null) => {
    setState({
      trebleNotes: newFirstNote ? [newFirstNote] : [],
      bassNotes: [],
      activeVoice: 'treble',
      selectedDuration: '4',
      isDotted: false,
      accidentalMode: null,
      tieMode: false,
      restMode: false,
      selectedNoteIndex: null,
    });
  }, []);

  return {
    ...state,
    getActiveNotes,
    getRemainingDuration,
    canAddDuration,
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
    deleteSelectedNote,
    getUserAbcString,
    reset,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/hooks/useNoteInput.ts
git commit -m "feat: useNoteInput 음표 입력 상태 관리 훅 구현"
```

---

### Task 4: DurationToolbar 컴포넌트

**Files:**
- Create: `src/components/DurationToolbar.tsx`

- [ ] **Step 1: DurationToolbar 구현**

```typescript
// src/components/DurationToolbar.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import type { NoteDuration } from '../lib/scoreUtils';

interface DurationToolbarProps {
  selectedDuration: NoteDuration;
  isDotted: boolean;
  accidentalMode: '#' | 'b' | null;
  tieMode: boolean;
  canAddDuration: (dur: NoteDuration) => boolean;
  onDurationSelect: (dur: NoteDuration) => void;
  onToggleDot: () => void;
  onAccidentalMode: (mode: '#' | 'b' | null) => void;
  onToggleTie: () => void;
  onAddRest: () => void;
  onUndo: () => void;
  onClear: () => void;
  accentColor: string;
}

const DURATIONS: { dur: NoteDuration; icon: string; label: string }[] = [
  { dur: '1',  icon: 'music-note-whole',            label: '온' },
  { dur: '2',  icon: 'music-note-half',             label: '2분' },
  { dur: '4',  icon: 'music-note-quarter',          label: '4분' },
  { dur: '8',  icon: 'music-note-eighth',           label: '8분' },
  { dur: '16', icon: 'music-note-sixteenth',        label: '16분' },
];

export default function DurationToolbar({
  selectedDuration,
  isDotted,
  accidentalMode,
  tieMode,
  canAddDuration,
  onDurationSelect,
  onToggleDot,
  onAccidentalMode,
  onToggleTie,
  onAddRest,
  onUndo,
  onClear,
  accentColor,
}: DurationToolbarProps) {
  return (
    <View style={styles.container}>
      {/* 음길이 버튼 행 */}
      <View style={styles.row}>
        {DURATIONS.map(({ dur, icon, label }) => {
          const isSelected = selectedDuration === dur;
          const disabled = !canAddDuration(dur);
          return (
            <TouchableOpacity
              key={dur}
              style={[
                styles.durBtn,
                isSelected && { backgroundColor: accentColor + '20', borderColor: accentColor },
                disabled && styles.disabled,
              ]}
              onPress={() => onDurationSelect(dur)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={icon as any}
                size={22}
                color={isSelected ? accentColor : disabled ? COLORS.slate300 : COLORS.slate600}
              />
              <Text style={[
                styles.durLabel,
                { color: isSelected ? accentColor : disabled ? COLORS.slate300 : COLORS.slate600 },
              ]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.durBtn, isDotted && { backgroundColor: accentColor + '20', borderColor: accentColor }]}
          onPress={onToggleDot}
          activeOpacity={0.7}
        >
          <Text style={[styles.dotText, { color: isDotted ? accentColor : COLORS.slate600 }]}>점</Text>
        </TouchableOpacity>
      </View>

      {/* 도구 버튼 행 */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.toolBtn, accidentalMode === '#' && styles.toolActive]}
          onPress={() => onAccidentalMode('#')}
        >
          <Text style={[styles.toolText, accidentalMode === '#' && styles.toolActiveText]}>♯</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, accidentalMode === 'b' && styles.toolActive]}
          onPress={() => onAccidentalMode('b')}
        >
          <Text style={[styles.toolText, accidentalMode === 'b' && styles.toolActiveText]}>♭</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, tieMode && styles.toolActive]}
          onPress={onToggleTie}
        >
          <Text style={[styles.toolText, tieMode && styles.toolActiveText]}>⌒</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={onAddRest}>
          <MaterialCommunityIcons name="music-rest-quarter" size={18} color={COLORS.slate600} />
          <Text style={styles.toolText}>쉼표</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toolBtn, styles.actionBtn]} onPress={onUndo}>
          <Text style={styles.toolText}>↩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toolBtn, styles.actionBtn]} onPress={onClear}>
          <Text style={styles.toolText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, paddingHorizontal: 8 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },
  durBtn: {
    width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.slate200, backgroundColor: '#fff',
  },
  durLabel: { fontSize: 9, marginTop: 1, fontWeight: '600' },
  dotText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.3 },
  toolBtn: {
    height: 36, paddingHorizontal: 10, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
    backgroundColor: COLORS.slate100,
  },
  toolActive: { backgroundColor: COLORS.slate700 },
  toolActiveText: { color: '#fff' },
  toolText: { fontSize: 13, color: COLORS.slate600, fontWeight: '600' },
  actionBtn: { backgroundColor: COLORS.slate200 },
});
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/DurationToolbar.tsx
git commit -m "feat: DurationToolbar 음길이/도구 버튼 컴포넌트"
```

---

### Task 5: PianoKeyboard 컴포넌트

**Files:**
- Create: `src/components/PianoKeyboard.tsx`

- [ ] **Step 1: PianoKeyboard 구현**

```typescript
// src/components/PianoKeyboard.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import type { PitchName, Accidental } from '../lib/scoreUtils';

interface PianoKeyboardProps {
  onKeyPress: (pitch: PitchName, octave: number, accidental: Accidental) => void;
  accentColor: string;
  initialOctave?: number; // 건반 초기 스크롤 위치 (기본 4)
}

// 건반 레이아웃: C3 ~ C6
const OCTAVES = [3, 4, 5];
const WHITE_NOTES: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// 검은 건반 위치 (흰건반 인덱스 기준, C#=0.5, D#=1.5, F#=3.5, G#=4.5, A#=5.5)
const BLACK_KEY_POSITIONS = [
  { offset: 0, pitch: 'C' as PitchName, accidental: '#' as Accidental },
  { offset: 1, pitch: 'D' as PitchName, accidental: '#' as Accidental },
  { offset: 3, pitch: 'F' as PitchName, accidental: '#' as Accidental },
  { offset: 4, pitch: 'G' as PitchName, accidental: '#' as Accidental },
  { offset: 5, pitch: 'A' as PitchName, accidental: '#' as Accidental },
];

const WHITE_KEY_WIDTH = 36;
const WHITE_KEY_HEIGHT = 100;
const BLACK_KEY_WIDTH = 24;
const BLACK_KEY_HEIGHT = 62;

export default function PianoKeyboard({
  onKeyPress,
  accentColor,
  initialOctave = 4,
}: PianoKeyboardProps) {
  const scrollRef = useRef<ScrollView>(null);

  // 초기 스크롤 위치 설정
  useEffect(() => {
    const octaveIndex = OCTAVES.indexOf(initialOctave);
    if (octaveIndex >= 0) {
      const scrollX = octaveIndex * WHITE_NOTES.length * (WHITE_KEY_WIDTH + 2);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: scrollX, animated: false });
      }, 100);
    }
  }, [initialOctave]);

  // C6 (최고음) 추가
  const allWhiteKeys: { pitch: PitchName; octave: number }[] = [];
  for (const oct of OCTAVES) {
    for (const note of WHITE_NOTES) {
      allWhiteKeys.push({ pitch: note, octave: oct });
    }
  }
  allWhiteKeys.push({ pitch: 'C', octave: 6 }); // C6

  const totalWidth = allWhiteKeys.length * (WHITE_KEY_WIDTH + 2);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: totalWidth, height: WHITE_KEY_HEIGHT + 10 }}
      >
        <View style={styles.keyboardWrapper}>
          {/* 흰 건반 */}
          {allWhiteKeys.map((key, i) => (
            <TouchableOpacity
              key={`${key.pitch}${key.octave}`}
              style={styles.whiteKey}
              onPress={() => onKeyPress(key.pitch, key.octave, '' as Accidental)}
              activeOpacity={0.6}
            >
              <Text style={styles.whiteKeyLabel}>{key.pitch}{key.octave}</Text>
            </TouchableOpacity>
          ))}

          {/* 검은 건반 (절대 위치) */}
          {OCTAVES.map((oct, octIdx) =>
            BLACK_KEY_POSITIONS.map(({ offset, pitch, accidental }) => {
              const whiteIndex = octIdx * WHITE_NOTES.length + offset;
              const leftPos = whiteIndex * (WHITE_KEY_WIDTH + 2) + WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 + 1;
              return (
                <TouchableOpacity
                  key={`${pitch}${accidental}${oct}`}
                  style={[styles.blackKey, { left: leftPos }]}
                  onPress={() => onKeyPress(pitch, oct, accidental)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.blackKeyLabel}>{pitch}#{oct}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  keyboardWrapper: {
    flexDirection: 'row',
    position: 'relative',
    paddingHorizontal: 4,
  },
  whiteKey: {
    width: WHITE_KEY_WIDTH,
    height: WHITE_KEY_HEIGHT,
    backgroundColor: '#f0f0f0',
    borderRadius: 0,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    marginHorizontal: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  whiteKeyLabel: {
    fontSize: 9,
    color: '#888',
    fontWeight: '600',
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    width: BLACK_KEY_WIDTH,
    height: BLACK_KEY_HEIGHT,
    backgroundColor: '#222',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  blackKeyLabel: {
    fontSize: 7,
    color: '#aaa',
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/PianoKeyboard.tsx
git commit -m "feat: PianoKeyboard 스크롤 가능 피아노 건반 컴포넌트"
```

---

### Task 6: GradingResult 컴포넌트

**Files:**
- Create: `src/components/GradingResult.tsx`

- [ ] **Step 1: GradingResult 구현**

```typescript
// src/components/GradingResult.tsx
import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import AbcjsRenderer, { type AbcjsRendererHandle } from './AbcjsRenderer';
import type { GradingResult as GradingResultType } from '../lib/grading';

interface GradingResultProps {
  answerAbcString: string;
  userAbcString: string;
  gradingResult: GradingResultType;
  timeSignature: string;
  accentColor: string;
  barsPerStaff?: number;
  onNext: () => void;
  onFinish: () => void;
  showFinish: boolean;
}

export default function GradingResultView({
  answerAbcString,
  userAbcString,
  gradingResult,
  timeSignature,
  accentColor,
  barsPerStaff,
  onNext,
  onFinish,
  showFinish,
}: GradingResultProps) {
  const answerRef = useRef<AbcjsRendererHandle>(null);

  const pct = Math.round(gradingResult.accuracy * 100);

  return (
    <View style={styles.container}>
      {/* 점수 영역 */}
      <View style={styles.scoreSection}>
        <Text style={[styles.scoreText, { color: accentColor }]}>{pct}%</Text>
        <View style={styles.countRow}>
          <View style={styles.countItem}>
            <Text style={[styles.countNum, { color: '#22dd44' }]}>{gradingResult.correctCount}</Text>
            <Text style={styles.countLabel}>정답</Text>
          </View>
          <View style={styles.countItem}>
            <Text style={[styles.countNum, { color: '#e67e22' }]}>{gradingResult.partialCount}</Text>
            <Text style={styles.countLabel}>부분</Text>
          </View>
          <View style={styles.countItem}>
            <Text style={[styles.countNum, { color: '#e74c3c' }]}>{gradingResult.wrongCount + gradingResult.missingCount}</Text>
            <Text style={styles.countLabel}>오답</Text>
          </View>
        </View>
      </View>

      {/* 문제 악보 */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreLabel}>문제 악보</Text>
          <TouchableOpacity
            style={[styles.playSmall, { backgroundColor: accentColor }]}
            onPress={() => answerRef.current?.togglePlay()}
          >
            <Text style={styles.playSmallText}>▶ 다시 듣기</Text>
          </TouchableOpacity>
        </View>
        <AbcjsRenderer
          ref={answerRef}
          abcString={answerAbcString}
          hideNotes={false}
          tempo={90}
          barsPerStaff={barsPerStaff}
          timeSignature={timeSignature}
        />
      </View>

      {/* 내 답안 */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreLabel}>내 답안</Text>
        </View>
        <AbcjsRenderer
          abcString={userAbcString}
          hideNotes={false}
          tempo={90}
          barsPerStaff={barsPerStaff}
          timeSignature={timeSignature}
          stretchLast={false}
        />
      </View>

      {/* 버튼 */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accentColor }]}
          onPress={onNext}
        >
          <Text style={styles.btnText}>다음 문제</Text>
        </TouchableOpacity>
        {showFinish && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: COLORS.slate200 }]}
            onPress={onFinish}
          >
            <Text style={[styles.btnText, { color: COLORS.slate700 }]}>연습 종료</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  scoreSection: { alignItems: 'center', paddingVertical: 12 },
  scoreText: { fontSize: 44, fontWeight: '900' },
  countRow: { flexDirection: 'row', gap: 20, marginTop: 8 },
  countItem: { alignItems: 'center' },
  countNum: { fontSize: 20, fontWeight: '800' },
  countLabel: { fontSize: 11, color: COLORS.slate500, marginTop: 2 },
  scoreCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.slate200, overflow: 'hidden',
  },
  scoreHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.slate100,
  },
  scoreLabel: { fontSize: 13, fontWeight: '600', color: COLORS.slate500 },
  playSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  playSmallText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/GradingResult.tsx
git commit -m "feat: GradingResult 채점 결과 표시 컴포넌트"
```

---

### Task 7: NotationPracticeScreen 통합 — melody/twoVoice 입력 모드

**Files:**
- Modify: `src/screens/NotationPracticeScreen.tsx`

이 태스크는 기존 화면에 새 컴포넌트들을 통합하는 핵심 작업이다. `isRhythm`처럼 `isMelodyInput` 분기를 추가하여 melody/twoVoice 카테고리에서만 새 입력 UI를 활성화한다.

- [ ] **Step 1: import 및 상태 추가**

파일 상단 import에 추가:
```typescript
import PianoKeyboard from '../components/PianoKeyboard';
import DurationToolbar from '../components/DurationToolbar';
import GradingResultView from '../components/GradingResult';
import { useNoteInput } from '../hooks/useNoteInput';
import { gradeNotes, type GradingResult } from '../lib/grading';
```

메인 컴포넌트 상태 영역에 추가 (기존 `isRhythm` 분기 근처):
```typescript
const isMelodyInput = category === 'melody' || category === 'twoVoice';

// 선율/2성부 입력 모드 상태
const [melodySubmitted, setMelodySubmitted] = useState(false);
const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
```

- [ ] **Step 2: useNoteInput 훅 연결**

기존 상태 영역 아래에 추가:
```typescript
// 첫 음 힌트 추출
const firstHintNote = score?.trebleNotes[0] ?? null;

const noteInput = useNoteInput({
  keySignature: score?.keySignature ?? 'C',
  timeSignature: score?.timeSignature ?? '4/4',
  measures: 4,
  useGrandStaff: score?.useGrandStaff ?? false,
  firstNote: isMelodyInput ? firstHintNote : null,
});
```

- [ ] **Step 3: generate 함수에 입력 상태 리셋 추가**

기존 `generate` useCallback 내부, `setRhythmResults([])` 줄 뒤에 추가:
```typescript
setMelodySubmitted(false);
setGradingResult(null);
```

그리고 `setTimeout` 콜백 내부, `setIsGenerating(false)` 전에 추가:
```typescript
// 다음 문제 시 noteInput 리셋
if (category === 'melody' || category === 'twoVoice') {
  // reset은 setTimeout 밖에서 호출하면 score가 아직 없으므로 여기서 호출
  // firstNote는 새 score에서 추출
  noteInput.reset(newScore.trebleNotes[0] ?? null);
}
```

- [ ] **Step 4: 선율/2성부 제출 핸들러 추가**

기존 `handleRhythmSubmit` 뒤에 추가:
```typescript
// ── 선율/2성부: 제출 + 채점 ──
const handleMelodySubmit = useCallback(async () => {
  if (!score || melodySubmitted) return;

  const result = gradeNotes(
    score.trebleNotes,
    noteInput.trebleNotes,
  );

  // 2성부: 베이스도 채점 후 합산
  if (score.useGrandStaff && score.bassNotes.length > 0) {
    const bassResult = gradeNotes(score.bassNotes, noteInput.bassNotes);
    // 합산 정확도
    const totalGrades = [...result.grades, ...bassResult.grades];
    const totalAnswer = score.trebleNotes.length + score.bassNotes.length;
    const correctCount = totalGrades.filter(g => g.grade === 'correct').length;
    const partialCount = totalGrades.filter(g => g.grade === 'partial').length;
    const combinedAccuracy = totalAnswer > 0
      ? Math.round(((correctCount + partialCount * 0.5) / totalAnswer) * 100) / 100
      : 0;
    result.accuracy = combinedAccuracy;
    result.selfRating = combinedAccuracy >= 0.9 ? 5 : combinedAccuracy >= 0.7 ? 4 : combinedAccuracy >= 0.5 ? 3 : combinedAccuracy >= 0.3 ? 2 : 1;
    result.correctCount = correctCount;
    result.partialCount = partialCount;
    result.wrongCount = totalGrades.filter(g => g.grade === 'wrong').length;
    result.missingCount = totalGrades.filter(g => g.grade === 'missing').length;
    result.extraCount = totalGrades.filter(g => g.grade === 'extra').length;
  }

  setGradingResult(result);
  setMelodySubmitted(true);
  setHideNotes(false);
  setPracticeCount(prev => prev + 1);
  setRatings(prev => [...prev, result.selfRating]);

  // 기록 저장
  const record: PracticeRecord = {
    id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    contentType: category,
    difficulty,
    selfRating: result.selfRating,
    practicedAt: new Date().toISOString(),
  };
  await addRecord(record);
  await updateStreak();

  const evalRating = result.selfRating >= 4 ? 'easy' : result.selfRating >= 3 ? 'normal' : 'hard' as const;
  const track = category === 'twoVoice' ? 'comprehensive' : 'partPractice' as const;
  const levelMatch = difficulty.match(/\d+/);
  const level = levelMatch ? parseInt(levelMatch[0], 10) : 1;
  await applyEvaluation(track, level, evalRating);
}, [score, melodySubmitted, noteInput.trebleNotes, noteInput.bassNotes,
    category, difficulty, addRecord, updateStreak, applyEvaluation]);
```

- [ ] **Step 5: 악보 영역 변경 — 답안 악보 추가**

기존 `{/* 악보 영역 */}` 블록 뒤, `{/* 리듬 모드: 답지 악보 */}` 블록 앞에 추가:

```typescript
{/* 선율/2성부 모드: 답안 악보 (사용자 입력 실시간 표시) */}
{isMelodyInput && !melodySubmitted && (
  <View style={styles.rhythmInputDisplay}>
    <Text style={styles.rhythmInputLabel}>내 답안</Text>
    {noteInput.trebleNotes.length > 0 ? (
      <View style={[styles.scoreCard, { borderColor: colors.main + '20' }]}>
        <AbcjsRenderer
          abcString={noteInput.getUserAbcString()}
          hideNotes={false}
          tempo={90}
          barsPerStaff={score?.barsPerStaff}
          timeSignature={score?.timeSignature ?? '4/4'}
          stretchLast={false}
          onNoteClick={(index, voice) => {
            noteInput.setActiveVoice(voice);
            noteInput.selectNote(index);
          }}
          selectedNote={noteInput.selectedNoteIndex !== null ? {
            index: noteInput.selectedNoteIndex,
            voice: noteInput.activeVoice,
          } : null}
        />
      </View>
    ) : (
      <View style={styles.rhythmEmptyAnswer}>
        <Text style={styles.rhythmEmptyText}>아래 건반을 탭하여 입력하세요</Text>
      </View>
    )}
  </View>
)}

{/* 선율/2성부 모드: 채점 결과 */}
{isMelodyInput && melodySubmitted && gradingResult && (
  <GradingResultView
    answerAbcString={abcString}
    userAbcString={noteInput.getUserAbcString()}
    gradingResult={gradingResult}
    timeSignature={score?.timeSignature ?? '4/4'}
    accentColor={colors.main}
    barsPerStaff={score?.barsPerStaff}
    onNext={handleNext}
    onFinish={handleFinish}
    showFinish={practiceCount >= 1}
  />
)}
```

- [ ] **Step 6: 하단 바 변경 — 입력 UI 분기**

기존 `{/* 하단 고정 */}` 블록 내부의 조건 분기를 수정한다. 기존 코드에서 `isRhythm ? (...)  : (... 자기 평가 ...)` 패턴을:

```typescript
{isRhythm ? (
  // 기존 리듬 UI 그대로
  ...
) : isMelodyInput ? (
  // 선율/2성부 입력 모드
  !melodySubmitted ? (
    <>
      {/* 2성부: 성부 전환 표시 */}
      {score?.useGrandStaff && (
        <View style={styles.voiceRow}>
          <TouchableOpacity
            style={[styles.voiceTab, noteInput.activeVoice === 'treble' && { backgroundColor: colors.main }]}
            onPress={() => noteInput.setActiveVoice('treble')}
          >
            <Text style={[styles.voiceTabText, noteInput.activeVoice === 'treble' && { color: '#fff' }]}>
              높은음자리
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voiceTab, noteInput.activeVoice === 'bass' && { backgroundColor: colors.main }]}
            onPress={() => noteInput.setActiveVoice('bass')}
          >
            <Text style={[styles.voiceTabText, noteInput.activeVoice === 'bass' && { color: '#fff' }]}>
              낮은음자리
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <DurationToolbar
        selectedDuration={noteInput.selectedDuration}
        isDotted={noteInput.isDotted}
        accidentalMode={noteInput.accidentalMode}
        tieMode={noteInput.tieMode}
        canAddDuration={noteInput.canAddDuration}
        onDurationSelect={noteInput.setDuration}
        onToggleDot={noteInput.toggleDot}
        onAccidentalMode={noteInput.setAccidentalMode}
        onToggleTie={noteInput.toggleTie}
        onAddRest={noteInput.addRest}
        onUndo={noteInput.undo}
        onClear={noteInput.clear}
        accentColor={colors.main}
      />
      <PianoKeyboard
        onKeyPress={noteInput.addNote}
        accentColor={colors.main}
        initialOctave={noteInput.activeVoice === 'bass' ? 3 : 4}
      />
      {/* 선택 음표 삭제 + 제출 */}
      <View style={styles.rhythmActionRow}>
        {noteInput.selectedNoteIndex !== null && (
          <TouchableOpacity
            style={[styles.rhythmActionBtn, { backgroundColor: '#fee2e2' }]}
            onPress={noteInput.deleteSelectedNote}
          >
            <Text style={[styles.rhythmActionBtnText, { color: '#991b1b' }]}>선택 삭제</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.rhythmActionBtn, {
            backgroundColor: noteInput.trebleNotes.length > 1 ? colors.main : COLORS.slate200,
          }]}
          onPress={handleMelodySubmit}
          disabled={noteInput.trebleNotes.length <= 1}
        >
          <Text style={[styles.rhythmActionBtnText, {
            color: noteInput.trebleNotes.length > 1 ? '#fff' : COLORS.slate400,
          }]}>제출</Text>
        </TouchableOpacity>
      </View>
    </>
  ) : null  // 채점 결과는 스크롤 영역에 표시됨
) : (
  // 기존 자기 평가 UI (여기는 도달하지 않지만 안전장치)
  ...
)}
```

- [ ] **Step 7: 스타일 추가**

StyleSheet에 추가:
```typescript
voiceRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  marginBottom: 8,
},
voiceTab: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
  backgroundColor: COLORS.slate100,
},
voiceTabText: {
  fontSize: 13,
  fontWeight: '700',
  color: COLORS.slate500,
},
```

- [ ] **Step 8: 커밋**

```bash
git add src/screens/NotationPracticeScreen.tsx
git commit -m "feat: NotationPracticeScreen에 선율/2성부 입력+채점 모드 통합"
```

---

### Task 8: 통합 테스트 및 마무리

**Files:**
- Modify: `src/__tests__/grading.test.ts` (edge case 추가)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx jest --no-coverage`
Expected: 모든 테스트 PASS

- [ ] **Step 2: edge case 테스트 추가**

```typescript
// src/__tests__/grading.test.ts 에 추가

describe('gradeNotes edge cases', () => {
  it('빈 답안은 모두 missing', () => {
    const answer = [makeNote('C', 4, '4'), makeNote('D', 4, '4')];
    const result = gradeNotes(answer, []);
    expect(result.missingCount).toBe(2);
    expect(result.accuracy).toBe(0);
    expect(result.selfRating).toBe(1);
  });

  it('쉼표끼리 비교', () => {
    const answer = [makeNote('rest', 0, '4')];
    const user   = [makeNote('rest', 0, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct');
  });

  it('쉼표 vs 음표는 wrong', () => {
    const answer = [makeNote('rest', 0, '4')];
    const user   = [makeNote('C', 4, '4')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('partial'); // duration만 일치
  });

  it('연속 붙임줄 합산 (3개 음표)', () => {
    const answer = [
      makeNote('C', 4, '4', { tie: true }),
      makeNote('C', 4, '4', { tie: true }),
      makeNote('C', 4, '4'),
    ];
    const user = [makeNote('C', 4, '2.')];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('correct'); // 12 = 12
  });

  it('임시표 구별: C4 vs C#4는 오답', () => {
    const answer = [makeNote('C', 4, '4')];
    const user   = [makeNote('C', 4, '4', { accidental: '#' as any })];
    const result = gradeNotes(answer, user);
    expect(result.grades[0].grade).toBe('partial'); // duration만 일치
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `npx jest src/__tests__/grading.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 4: 전체 테스트 최종 실행**

Run: `npx jest --no-coverage`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/__tests__/grading.test.ts
git commit -m "test: 채점 edge case 테스트 추가"
```
