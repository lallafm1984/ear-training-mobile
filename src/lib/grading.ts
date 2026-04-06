import { durationToSixteenths } from './scoreUtils';
import type { ScoreNote, NoteDuration } from './scoreUtils';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** @deprecated 기존 호환용. 새 로직은 TimelineEvent 사용 */
export interface NormalizedNote {
  pitch: string;           // "C4", "F#4", "rest"
  totalDuration: number;   // 16th note units
  sourceIndices: number[]; // original ScoreNote indices
}

export type NoteGradeType = 'correct' | 'wrong' | 'missing' | 'extra';

export interface NoteGrade {
  grade: NoteGradeType;
  answerSourceIndices: number[];
  userSourceIndices: number[];
}

export interface GradingResult {
  grades: NoteGrade[];
  accuracy: number;       // 0.0 ~ 1.0
  selfRating: number;     // 1 ~ 5
  correctCount: number;
  wrongCount: number;
  missingCount: number;
  extraCount: number;
}

// ──────────────────────────────────────────────
// Timeline types
// ──────────────────────────────────────────────

export interface TimelineEvent {
  startPos: number;       // 48분음표 단위 시작 위치
  duration: number;       // 48분음표 단위 길이
  pitch: string;          // "C4", "F#4", "rest"
  isTriplet: boolean;     // 셋잇단 여부
  sourceIndices: number[];
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function pitchString(note: ScoreNote): string {
  if (note.pitch === 'rest') return 'rest';
  const acc = note.accidental === '#' ? '#' : note.accidental === 'b' ? 'b' : '';
  return `${note.pitch}${acc}${note.octave}`;
}

/**
 * 48분음표 단위 변환 (셋잇단 정수 처리를 위해 16분 × 3 해상도 사용)
 * whole=48, half=24, quarter=12, eighth=6, 16th=3
 * triplet-eighth-in-quarter = 12/3 = 4 (정수)
 */
export function durationTo48ths(dur: NoteDuration): number {
  switch (dur) {
    case '1':  return 48;
    case '1.': return 72;
    case '2':  return 24;
    case '2.': return 36;
    case '4':  return 12;
    case '4.': return 18;
    case '8':  return 6;
    case '8.': return 9;
    case '16': return 3;
    default:   return 12;
  }
}

// ──────────────────────────────────────────────
// normalizeNotes (기존 호환용 유지)
// ──────────────────────────────────────────────

export function normalizeNotes(notes: ScoreNote[]): NormalizedNote[] {
  const result: NormalizedNote[] = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const pitch = pitchString(note);
    const dur = durationToSixteenths(note.duration);

    const prevNote = i > 0 ? notes[i - 1] : null;
    const isTied = note.tie || (prevNote != null && prevNote.tie === true);
    if (
      isTied &&
      result.length > 0 &&
      result[result.length - 1].pitch === pitch
    ) {
      const prev = result[result.length - 1];
      prev.totalDuration += dur;
      prev.sourceIndices.push(i);
    } else {
      result.push({
        pitch,
        totalDuration: dur,
        sourceIndices: [i],
      });
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// buildTimeline — 박자 위치 기반 타임라인 생성
// ──────────────────────────────────────────────

export function buildTimeline(notes: ScoreNote[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let pos = 0;
  let tripletRemaining = 0;
  let tripletNoteDur = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    let dur: number;
    let isTriplet = false;

    if (note.tuplet && parseInt(note.tuplet) >= 2) {
      // 잇단음표 그룹 시작
      const n = parseInt(note.tuplet);
      const span = durationTo48ths(note.tupletSpan || '4');
      tripletNoteDur = Math.round(span / n);
      tripletRemaining = n - 1;
      dur = tripletNoteDur;
      isTriplet = true;
    } else if (tripletRemaining > 0) {
      // 잇단음표 그룹 계속
      dur = tripletNoteDur;
      tripletRemaining--;
      isTriplet = true;
    } else {
      dur = durationTo48ths(note.duration);
    }

    const pitch = pitchString(note);

    // 붙임줄(타이) 병합
    // - 후방 tie: 현재 note.tie=true → "이전 음표에 연결" (수동 입력, 테스트)
    // - 전방 tie: 이전 notes[i-1].tie=true → "다음 음표로 연결" (splitAtBeatBoundaries)
    const prevNote = i > 0 ? notes[i - 1] : null;
    const isTied = note.tie || (prevNote != null && prevNote.tie === true);
    if (isTied && events.length > 0) {
      const prev = events[events.length - 1];
      if (prev.pitch === pitch && prev.isTriplet === isTriplet) {
        prev.duration += dur;
        prev.sourceIndices.push(i);
        pos += dur;
        continue;
      }
    }

    events.push({
      startPos: pos,
      duration: dur,
      pitch,
      isTriplet,
      sourceIndices: [i],
    });

    pos += dur;
  }

  return events;
}

// ──────────────────────────────────────────────
// gradeNotes — 박자 위치 기반 채점 (정답 / 오답)
// ──────────────────────────────────────────────

export function gradeNotes(
  answerNotes: ScoreNote[],
  userNotes: ScoreNote[],
): GradingResult {
  const answerTimeline = buildTimeline(answerNotes);
  const userTimeline = buildTimeline(userNotes);

  const grades: NoteGrade[] = [];

  // 사용자 이벤트를 시작 위치로 매핑
  const userByPos = new Map<number, TimelineEvent>();
  for (const ue of userTimeline) {
    userByPos.set(ue.startPos, ue);
  }

  const matchedUserPos = new Set<number>();

  for (const ae of answerTimeline) {
    const ue = userByPos.get(ae.startPos);

    if (!ue) {
      grades.push({
        grade: 'missing',
        answerSourceIndices: ae.sourceIndices,
        userSourceIndices: [],
      });
      continue;
    }

    matchedUserPos.add(ue.startPos);

    const pitchMatch = ae.pitch === ue.pitch;
    const durMatch = ae.duration === ue.duration;
    const tripletMatch = ae.isTriplet === ue.isTriplet;

    const grade: NoteGradeType =
      (pitchMatch && durMatch && tripletMatch) ? 'correct' : 'wrong';

    grades.push({
      grade,
      answerSourceIndices: ae.sourceIndices,
      userSourceIndices: ue.sourceIndices,
    });
  }

  // 매칭되지 않은 사용자 음표 → extra
  for (const ue of userTimeline) {
    if (!matchedUserPos.has(ue.startPos)) {
      grades.push({
        grade: 'extra',
        answerSourceIndices: [],
        userSourceIndices: ue.sourceIndices,
      });
    }
  }

  // ── 후처리: 음표 분할 감지 ──
  // 정답보다 짧은 음표 + 정답 시간 범위 안에 extra 음표 존재 → extra 흡수
  const absorbed = new Set<number>();
  for (let i = 0; i < grades.length; i++) {
    const g = grades[i];
    if (g.grade !== 'wrong') continue;

    const ae = answerTimeline.find(a => a.sourceIndices[0] === g.answerSourceIndices[0]);
    if (!ae) continue;
    const ue = userByPos.get(ae.startPos);
    if (!ue || ue.duration >= ae.duration) continue;

    const spanEnd = ae.startPos + ae.duration;

    for (let j = 0; j < grades.length; j++) {
      if (j === i || grades[j].grade !== 'extra' || absorbed.has(j)) continue;
      const extraUe = userTimeline.find(u => u.sourceIndices[0] === grades[j].userSourceIndices[0]);
      if (extraUe && extraUe.startPos > ae.startPos && extraUe.startPos < spanEnd) {
        g.userSourceIndices.push(...grades[j].userSourceIndices);
        absorbed.add(j);
      }
    }
  }

  // 흡수된 extra 제거
  const finalGrades = grades.filter((_, i) => !absorbed.has(i));

  const correctCount = finalGrades.filter(g => g.grade === 'correct').length;
  const wrongCount = finalGrades.filter(g => g.grade === 'wrong').length;
  const missingCount = finalGrades.filter(g => g.grade === 'missing').length;
  const extraCount = finalGrades.filter(g => g.grade === 'extra').length;

  const total = answerTimeline.length;
  const accuracy = total === 0 ? 0 : correctCount / total;

  let selfRating: number;
  if (accuracy >= 0.9) selfRating = 5;
  else if (accuracy >= 0.7) selfRating = 4;
  else if (accuracy >= 0.5) selfRating = 3;
  else if (accuracy >= 0.3) selfRating = 2;
  else selfRating = 1;

  return {
    grades: finalGrades,
    accuracy,
    selfRating,
    correctCount,
    wrongCount,
    missingCount,
    extraCount,
  };
}
