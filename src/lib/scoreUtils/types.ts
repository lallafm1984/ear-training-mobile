// ────────────────────────────────────────────────────────────────
// Score 타입 정의
// ────────────────────────────────────────────────────────────────

export type NoteDuration = '1' | '1.' | '2' | '4' | '8' | '16' | '2.' | '4.' | '8.';
export type Accidental = '#' | 'b' | 'n' | '';
export type PitchName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B' | 'rest';

export type TupletType = '' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export interface ScoreNote {
  pitch: PitchName;
  octave: number;
  accidental: Accidental;
  duration: NoteDuration;
  /** 붙임줄(타이): 직전 음표와 음높이가 같을 때 ABC `-`로 연결. 이음줄(슬러·다른 음)과 구분 */
  tie?: boolean;
  /**
   * Tuplet information — only set on the FIRST note of a tuplet group.
   * 'tuplet' = the tuplet count (3, 5, 6, 7)
   * 'tupletSpan' = the total duration the group occupies (e.g. '4' = quarter note)
   * 'tupletNoteDur' = the calculated visual duration for each note in the group (in 16ths)
   */
  tuplet?: TupletType;
  tupletSpan?: NoteDuration;
  tupletNoteDur?: number;
  id: string;
}

export interface ScoreState {
  title: string;
  keySignature: string;
  timeSignature: string;
  tempo: number;
  notes: ScoreNote[];
  bassNotes?: ScoreNote[];
  useGrandStaff?: boolean;
  /** 못갖춘마디(anacrusis) 박수, 16분음표 단위. 0 또는 미정의 = 없음 */
  pickupSixteenths?: number;
  /** 붙임줄 비활성화 — 중급 2단계 미만 난이도에서 박 경계 분할·타이 생성 금지 */
  disableTies?: boolean;
  /** 한 줄(시스템)당 마디 수. 미정의면 ABC 생성 시 밀도 기준 2~4마디, WebView는 ABCJS 자동 줄바꿈 */
  barsPerStaff?: number;
}
