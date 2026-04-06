// ────────────────────────────────────────────────────────────────
// Bass generation engine
// ────────────────────────────────────────────────────────────────

import type { ScoreNote, PitchName, Accidental, NoteDuration } from '../scoreUtils';
import {
  durationToSixteenths, getSixteenthsPerBar, SIXTEENTHS_TO_DUR,
  noteToMidiWithKey, getKeySigAlteration,
  nnToMidi, getMidiInterval,
  PITCH_ORDER, getBassBaseOctave, CHORD_TONES,
  DISSONANT_PC, IMPERFECT_CONSONANT_PC, MIN_TREBLE_BASS_SEMITONES,
  uid, makeNote, makeRest, noteNumToNote, scaleNoteToNn,
  buildTrebleAttackMidiMap, passesBassSpacing,
  chordToneBnnCandidates, snapToChordTone,
  getStrongBeatOffsets, getScaleDegrees,
} from '../scoreUtils';
import type { BassDifficulty } from './types';
import { BASS_LEVEL_PARAMS } from './types';
import type { LevelParams } from './melodyEngine';
import { rand } from './melodyEngine';
import { resolveBassClash, smoothBassMelodicContinuity, ensureConsonance, fixParallelPerfect, applyImperfectConsonanceRatio } from './postProcessing';
import { fillRhythm } from '../trebleRhythmFill';

// ── 베이스 난이도별 생성 (bass_1~bass_9) ─────────────────────
export function generateBassForBar(
  bassNotes: ScoreNote[],
  trebleRhythm: number[],
  sixteenthsPerBar: number,
  chordRoot: number,
  scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature: string,
  bassDifficulty: BassDifficulty,
  prevBassNn: number,
  prevBassMidi: number | undefined,
  /** 0부터 — 싱코페이션 구절 해소 판별용 */
  barIndex: number,
  /** 총 마디(종지 포함) — 해소 마디 계산 */
  totalMeasures: number,
  /** 다음 마디 코드 근음 (3단계 순차 경과음 연결용, 마지막 마디면 0) */
  nextChordRoot: number,
  /** 직전 마디의 진행 방향 (계단식 베이스 연속성 유지용) */
  prevBassDir: number,
  /** bass_5: 도약 실행할 마디 인덱스 집합 */
  leapBarsSet?: Set<number>,
): { prevBassNn: number; lastMidi: number | undefined; prevBassDir: number } {
  const BASS_BASE = getBassBaseOctave(scale);
  const bp = BASS_LEVEL_PARAMS[bassDifficulty];
  const bTones = CHORD_TONES[chordRoot];

  // 근음·3음·5음 bnn 정규화 (베이스 음역 -5 ~ 4)
  const rootBnn  = chordRoot > 4 ? chordRoot - 7 : chordRoot;
  const thirdBnn = bTones[1] > 4 ? bTones[1] - 7 : bTones[1];
  const fifthBnn = bTones[2] > 4 ? bTones[2] - 7 : bTones[2];

  /** 직전 실제 울린 MIDI — 충돌로 옥타브만 바뀐 뒤 다음 음이 '한 옥타브 위 계단'처럼 보이는 것 방지 */
  let prevMidiTrack: number | undefined = prevBassMidi;

  // snapToChordTone → imported from scoreUtils (now takes bTones as 2nd param)

  /** 음 하나 출력 — 충돌 해결 후 bassNotes에 추가, 실제 bnn 반환 */
  const emitNote = (nn: number, dur: number, off: number): number => {
    const n = Math.max(-5, Math.min(4, nn));
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    const { pitch, octave } = noteNumToNote(n, scale, BASS_BASE);
    const oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, n, oct, durLabel, off, scale, BASS_BASE, keySignature, trebleAttackMap, bTones);
    note = smoothBassMelodicContinuity(note, durLabel, off, prevMidiTrack, keySignature, trebleAttackMap);
    note = fixParallelPerfect(n, note, durLabel, off, prevMidiTrack, trebleAttackMap, scale, BASS_BASE, keySignature);
    prevMidiTrack = noteToMidiWithKey(note, keySignature);
    bassNotes.push(note);
    return n;
  };

  const bassRhythm = fillRhythm(sixteenthsPerBar, bp.durationPool, {
    timeSignature, minDur: bp.minDur,
  });

  let bnn = rootBnn;
  let bassOff = 0;

  // ── 패턴 보호용 공통 emit (4~7단 등) ──────────────────────────
  // resolveBassClash로 인한 고유 반주 패턴 훼손 방지
  // 동일 건반(treble 충돌) 시에만 옥타브를 내림.
  const emitPatternNote = (nn: number, dur: number, off: number): void => {
    const n = Math.max(-5, Math.min(4, nn));
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    const { pitch, octave } = noteNumToNote(n, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(3, octave));
    let note = makeNote(pitch, oct, durLabel);
    
    const clashMidi = trebleAttackMap.get(off);
    if (clashMidi !== undefined && noteToMidiWithKey(note, keySignature) === clashMidi) {
      note = makeNote(pitch, Math.max(2, oct - 1), durLabel);
    }
    prevMidiTrack = noteToMidiWithKey(note, keySignature);
    bassNotes.push(note);
  };

  switch (bp.mode) {

    // ── 1단: 지속음 — 해당 마디 화음의 근음을 한 음으로 유지 ──
    case 'pedal': {
      const pedalBnn = rootBnn; // 해당 마디 코드의 근음
      const durLabel = SIXTEENTHS_TO_DUR[sixteenthsPerBar] || '1';
      const { pitch, octave } = noteNumToNote(pedalBnn, scale, BASS_BASE);
      const oct = Math.max(2, Math.min(3, octave));
      let note = makeNote(pitch, oct, durLabel);
      note = resolveBassClash(note, pedalBnn, oct, durLabel, 0, scale, BASS_BASE, keySignature, trebleAttackMap, bTones);
      note = smoothBassMelodicContinuity(note, durLabel, 0, prevMidiTrack, keySignature, trebleAttackMap);
      prevMidiTrack = noteToMidiWithKey(note, keySignature);
      bassNotes.push(note);
      return { prevBassNn: pedalBnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 2단: 근음 정박 — 모든 정박에 코드 근음 동일 배치 ─────────
    case 'root_beat': {

      // 박자별 리듬 패턴 결정 (16분음표 단위)
      const [rbTopStr, rbBotStr] = timeSignature.split('/');
      const rbTop = parseInt(rbTopStr, 10);
      const rbBot = parseInt(rbBotStr, 10);
      const isCompound = rbBot === 8 && rbTop % 3 === 0 && rbTop >= 6;

      let rbPattern: { dur: number; useRoot: boolean }[];

      if (isCompound) {
        // 복합 박자 (6/8, 9/8, 12/8): 점4분음표(6) 단위
        const numGroups = Math.round(sixteenthsPerBar / 6);
        rbPattern = [];
        for (let g = 0; g < numGroups; g++) {
          // 모든 그룹을 Root로 고정
          rbPattern.push({ dur: 6, useRoot: true });
        }
        // 나머지 (6으로 나누어 떨어지지 않을 경우)
        const remainder = sixteenthsPerBar - numGroups * 6;
        if (remainder > 0) {
          rbPattern.push({ dur: remainder, useRoot: true });
        }
      } else if (rbTop === 4 && rbBot === 4) {
        // 4/4: 2분음표 2개 — 1박·3박 모두 Root
        rbPattern = [
          { dur: 8, useRoot: true },
          { dur: 8, useRoot: true },
        ];
      } else if (rbTop === 3 && rbBot === 4) {
        // 3/4: 점2분음표 1개 — 마디 전체 Root
        rbPattern = [{ dur: 12, useRoot: true }];
      } else if (rbTop === 2 && rbBot === 4) {
        // 2/4: 2분음표 1개 — 마디 전체 Root
        rbPattern = [{ dur: 8, useRoot: true }];
      } else if (rbTop === 2 && rbBot === 2) {
        // 2/2: 온음표 1개 — 마디 전체 Root
        rbPattern = [{ dur: 16, useRoot: true }];
      } else {
        // 기타 박자: 박 단위로 분할, 첫 박 Root + 나머지 Root 또는 5th
        const rbBeatSize = 16 / rbBot;
        rbPattern = [];
        let rem = sixteenthsPerBar;
        let isFirst = true;
        while (rem > 0) {
          const chunk = Math.min(rbBeatSize, rem);
          rbPattern.push({ dur: chunk, useRoot: true });
          rem -= chunk;
          isFirst = false;
        }
      }

      // ── 근음 정박 전용 emit ──────────────────────────────────────
      // 음 자체는 절대 바꾸지 않음 (resolveBassClash 스킵)
      // 동일 건반(treble 충돌) 시에만 옥타브 1 내림
      const emitRootNote = (nn: number, dur: number, off: number): void => {
        const n = Math.max(-5, Math.min(4, nn));
        const durLabel = SIXTEENTHS_TO_DUR[dur] || '2';
        const { pitch, octave } = noteNumToNote(n, scale, BASS_BASE);
        let oct = Math.max(2, Math.min(3, octave));
        let note = makeNote(pitch, oct, durLabel);
        // 동일 건반만 회피 (옥타브 1 내림)
        const clashMidi = trebleAttackMap.get(off);
        if (clashMidi !== undefined && noteToMidiWithKey(note, keySignature) === clashMidi) {
          note = makeNote(pitch, Math.max(2, oct - 1), durLabel);
        }
        prevMidiTrack = noteToMidiWithKey(note, keySignature);
        bassNotes.push(note);
      };

      // 패턴 실행 — 모든 슬롯에 동일 근음
      for (let j = 0; j < rbPattern.length; j++) {
        emitRootNote(rootBnn, rbPattern[j].dur, bassOff);
        bassOff += rbPattern[j].dur;
      }
      bnn = rootBnn;
      return { prevBassNn: rootBnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 3단: 순차 진행 — 마디 간 연속 2도 순차 (도약 없음) ──────
    // 랜덤 요소로 다양한 패턴 생성:
    //   - 시작 음: 랜덤 (으뜸음, 3음, 5음 등)
    //   - 초기 방향: 상행/하행 랜덤
    //   - 음역 경계에서 자동 방향 반전
    //   - 30% 확률로 방향 전환 (다양성)
    //   - 리듬: 2분음표 단위
    case 'directed_step': {
      // 박자별 리듬 결정: 2분음표(8) 단위
      const [stepTopStr, stepBotStr] = timeSignature.split('/');
      const stepTop = parseInt(stepTopStr, 10) || 4;
      const stepBot = parseInt(stepBotStr, 10) || 4;
      const isStepCompound = stepBot === 8 && stepTop % 3 === 0 && stepTop >= 6;

      let stepRhythm: number[];

      if (isStepCompound) {
        // 복합 박자 (6/8, 9/8, 12/8): 점4분음표 단위
        const numGroups = Math.round(sixteenthsPerBar / 6);
        stepRhythm = Array(numGroups).fill(6);
        const remainder = sixteenthsPerBar - numGroups * 6;
        if (remainder > 0) stepRhythm.push(remainder);
      } else if (stepTop >= 4 && stepBot === 4) {
        // 4/4, 5/4 등: 2분음표(8) 단위
        stepRhythm = [];
        let rem = sixteenthsPerBar;
        while (rem > 0) {
          const chunk = Math.min(8, rem);
          stepRhythm.push(chunk);
          rem -= chunk;
        }
      } else if (stepTop === 3 && stepBot === 4) {
        stepRhythm = [12];
      } else if (stepTop === 2 && stepBot === 4) {
        stepRhythm = [8];
      } else {
        stepRhythm = [];
        let rem = sixteenthsPerBar;
        while (rem > 0) {
          const chunk = Math.min(8, rem);
          stepRhythm.push(chunk);
          rem -= chunk;
        }
      }

      const numSlots = stepRhythm.length;

      let startBnn: number;
      let stepDir: number;

      if (barIndex === 0) {
        // 첫 마디: 현재 화음의 화음톤 중심으로 시작 (-1 제거: I화음에서 비화성음)
        startBnn = snapToChordTone(rand([0, 2, 4, -3]), bTones);
        stepDir = Math.random() < 0.5 ? -1 : 1;
      } else {
        // 이후 마디: 직전 마디의 방향을 계속 유지하되, 음역 끝부분에 다다르면 무조건 반전
        stepDir = prevBassDir === 0 ? (Math.random() < 0.5 ? 1 : -1) : prevBassDir;

        if (prevBassNn >= 3) {
          stepDir = -1;
        } else if (prevBassNn <= -4) {
          stepDir = 1;
        } else {
          // 일정한 지그재그 패턴 방지: 20% 확률로만 방향을 전환하여 연속적인 계단 진행 유도
          if (Math.random() < 0.2) {
            stepDir = stepDir === 1 ? -1 : 1;
          }
        }

        // 직전 마디 마지막 음에서 한 스텝 진행 후 현재 화음톤으로 스냅 (마디 경계 화성 정합)
        startBnn = prevBassNn + stepDir;
        if (startBnn > 4) { startBnn = prevBassNn - 1; stepDir = -1; }
        if (startBnn < -5) { startBnn = prevBassNn + 1; stepDir = 1; }
        startBnn = Math.max(-5, Math.min(4, startBnn));
        startBnn = snapToChordTone(startBnn, bTones);
      }

      // 시퀀스 생성: 매 슬롯마다 같은 방향으로 이동 후 화음톤 스냅
      const stepSequence: number[] = [startBnn];
      let current = startBnn;
      for (let s = 1; s < numSlots; s++) {
        current += stepDir;
        // 경계 도달 시 방향 반전
        if (current > 4) { current = prevBassNn <= 4 ? 3 : 4; stepDir = -1; }
        if (current < -5) { current = prevBassNn >= -5 ? -4 : -5; stepDir = 1; }
        current = Math.max(-5, Math.min(4, current));
        // 강박 슬롯은 화음톤에 스냅 — 비화성음으로 인한 불협화음 방지
        const snapped = snapToChordTone(current, bTones);
        if (snapped !== stepSequence[s - 1]) current = snapped;
        stepSequence.push(current);
      }

      // ── 순차 진행 전용 emit ──────────────────────────────────────
      // resolveBassClash / smoothBassMelodicContinuity를 건너뛰어
      // 음 자체가 바뀌어 도약이 생기는 문제 방지.
      // 동일 건반(treble 충돌) 시에만 옥타브를 내림.
      const emitStepNote = (nn: number, dur: number, off: number): void => {
        // 3단계: 순차 패턴 보존 우선 — ensureConsonance 사용 시
        // 순차 음이 화음톤으로 변경되어 계단식 패턴이 깨지므로 적용하지 않음
        const n = Math.max(-5, Math.min(4, nn));
        const durLabel = SIXTEENTHS_TO_DUR[dur] || '2';
        const { pitch, octave } = noteNumToNote(n, scale, BASS_BASE);
        let oct = Math.max(2, Math.min(3, octave));
        let note = makeNote(pitch, oct, durLabel);
        // 동일 건반 회피 + 최소 간격(15반음) 미달 시 옥타브 내림
        const clashMidi = trebleAttackMap.get(off);
        if (clashMidi !== undefined) {
          const bassMidi = noteToMidiWithKey(note, keySignature);
          if (bassMidi === clashMidi || clashMidi - bassMidi < MIN_TREBLE_BASS_SEMITONES) {
            note = makeNote(pitch, Math.max(2, oct - 1), durLabel);
          }
        }
        note = fixParallelPerfect(n, note, durLabel, off, prevMidiTrack, trebleAttackMap, scale, BASS_BASE, keySignature);
        prevMidiTrack = noteToMidiWithKey(note, keySignature);
        bassNotes.push(note);
      };

      // 출력 — 의도한 시퀀스를 그대로 출력 (보정으로 인한 도약 없음)
      let intendedLastBnn = startBnn;
      for (let j = 0; j < stepRhythm.length; j++) {
        const seqBnn = j < stepSequence.length ? stepSequence[j] : startBnn;
        emitStepNote(seqBnn, stepRhythm[j], bassOff);
        if (j < stepSequence.length) intendedLastBnn = stepSequence[j];
        bassOff += stepRhythm[j];
        bnn = seqBnn;
      }
      // prevBassNn은 의도한 순차 위치로 반환 (다음 마디 계산 기준)
      return { prevBassNn: intendedLastBnn, lastMidi: prevMidiTrack, prevBassDir: stepDir };
    }

    // ── 4단: 기본 반주 (미사용 — 주석 처리) ────────────
    /* case 'alternating': {
      const rhythmLen = bassRhythm.length;

      for (let j = 0; j < rhythmLen; j++) {
        // 마지막 박자 & 패턴이 2개 이상이고 & 다음 마디 코드가 존재할 때 어프로치 노트 적용
        const isLastSlot = j === rhythmLen - 1 && rhythmLen > 1;
        const hasNextMeasure = barIndex + 1 < totalMeasures;

        if (isLastSlot && hasNextMeasure) {
          // 다음 마디 첫 박 타겟의 bnn 계산
          let targetBnn = nextChordRoot > 4 ? nextChordRoot - 7 : nextChordRoot;
          
          // 타겟 노트의 인접음(Diatonic Approach): 위에서 하행(+1) 또는 아래에서 상행(-1)
          let approachDir = Math.random() < 0.5 ? 1 : -1;
          
          // 어프로치 노트가 베이스 음역(-5 ~ 4)을 벗어나면, 옥타브를 꺾지 말고 어프로치 방향을 반전시킴
          // (옥타브를 꺾으면 다음 마디 타겟음과 7도 도약이 발생함)
          if (targetBnn + approachDir > 4) {
            approachDir = -1;
          } else if (targetBnn + approachDir < -5) {
            approachDir = 1;
          }
          bnn = targetBnn + approachDir;
        } else {
          // 1~3박자: 무조건 근음(Root) 연주
          bnn = rootBnn;
        }

        emitPatternNote(bnn, bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    } */ // end alternating (미사용)

    // ── 5단: 2분음표 협화 베이스 — 화음톤 기반 2분음표로 treble과 협화 ──
    case 'harmonic_half': {
      // 박자별 2분음표(8) 단위 리듬 결정
      const [hTopStr, hBotStr] = timeSignature.split('/');
      const hTop = parseInt(hTopStr, 10) || 4;
      const hBot = parseInt(hBotStr, 10) || 4;
      const isHCompound = hBot === 8 && hTop % 3 === 0 && hTop >= 6;
      let hRhythm: number[];
      if (isHCompound) {
        // 복합 박자: 점4분음표(6) 단위
        const n = Math.round(sixteenthsPerBar / 6);
        hRhythm = Array(n).fill(6);
        const rem = sixteenthsPerBar - n * 6;
        if (rem > 0) hRhythm.push(rem);
      } else if (hTop === 3 && hBot === 4) {
        // 3/4: 점2분음표 1개
        hRhythm = [12];
      } else if (hTop === 2 && hBot === 4) {
        // 2/4: 2분음표 1개
        hRhythm = [8];
      } else {
        // 4/4 등: 2분음표(8) 단위
        hRhythm = [];
        let rem = sixteenthsPerBar;
        while (rem > 0) { const c = Math.min(8, rem); hRhythm.push(c); rem -= c; }
      }

      // 첫 슬롯은 근음, 이후 슬롯은 treble과 가장 잘 어울리는 화음톤 선택
      bnn = rootBnn;
      let hOff = bassOff;
      for (let j = 0; j < hRhythm.length; j++) {
        if (j > 0) {
          // treble MIDI 확인 후 가장 협화적인 화음톤 선택
          const tMidi = trebleAttackMap.get(hOff);
          if (tMidi !== undefined) {
            let bestTone = rootBnn, bestScore = -1;
            for (const t of bTones) {
              const cand = t > 4 ? t - 7 : t;
              if (cand < -5 || cand > 4) continue;
              const { pitch: cp, octave: co } = noteNumToNote(cand, scale, BASS_BASE);
              const cOct = Math.max(2, Math.min(3, co));
              const cMidi = noteToMidiWithKey(makeNote(cp, cOct, '4'), keySignature);
              const pc = ((tMidi - cMidi) % 12 + 12) % 12;
              // 불완전 협화음(3도/6도) 최우선, 완전 협화음 차선, 불협화 제외
              let score = 0;
              if (IMPERFECT_CONSONANT_PC.has(pc)) score = 3;
              else if (!DISSONANT_PC.has(pc)) score = 1;
              // 직전 음과의 순차 진행 보너스 (부드러운 움직임)
              const dist = Math.abs(cand - bnn);
              if (dist <= 2) score += 1;
              if (score > bestScore) { bestScore = score; bestTone = cand; }
            }
            bnn = bestTone;
          } else {
            bnn = rand(bTones);
            if (bnn > 4) bnn -= 7;
          }
        }
        bnn = Math.max(-5, Math.min(4, bnn));
        // 협화음 검증
        bnn = ensureConsonance(bnn, hOff, trebleAttackMap, scale, BASS_BASE, keySignature, bTones);

        const durLabel = SIXTEENTHS_TO_DUR[hRhythm[j]] || '2';
        const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
        let oct = Math.max(2, Math.min(3, octave));
        let note = makeNote(pitch, oct, durLabel);
        // 동일 건반 회피 + 최소 간격
        const clashMidi = trebleAttackMap.get(hOff);
        if (clashMidi !== undefined) {
          const bassMidi = noteToMidiWithKey(note, keySignature);
          if (bassMidi === clashMidi || clashMidi - bassMidi < MIN_TREBLE_BASS_SEMITONES) {
            note = makeNote(pitch, Math.max(2, oct - 1), durLabel);
          }
        }
        note = fixParallelPerfect(bnn, note, durLabel, hOff, prevMidiTrack, trebleAttackMap, scale, BASS_BASE, keySignature);
        prevMidiTrack = noteToMidiWithKey(note, keySignature);
        bassNotes.push(note);
        hOff += hRhythm[j];
      }
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 3단: 2분음표 + 4분음표 협화 베이스 ────────────────────────
    // 4/4: 2분+2분(8+8) 또는 2분+4분+4분(8+4+4) 랜덤 선택
    // 3/4: 2분+4분(8+4)
    // 2/4: 2분(8)
    case 'harmonic_mixed': {
      const [mTopStr, mBotStr] = timeSignature.split('/');
      const mTop = parseInt(mTopStr, 10) || 4;
      const mBot = parseInt(mBotStr, 10) || 4;
      const isMCompound = mBot === 8 && mTop % 3 === 0 && mTop >= 6;
      let mRhythm: number[];
      if (isMCompound) {
        // 복합 박자: 점4분(6) 단위
        const n = Math.round(sixteenthsPerBar / 6);
        mRhythm = Array(n).fill(6);
        const rem = sixteenthsPerBar - n * 6;
        if (rem > 0) mRhythm.push(rem);
      } else if (mTop === 4 && mBot === 4) {
        // 4/4: 2분+2분 또는 2분+4분+4분
        mRhythm = Math.random() < 0.5 ? [8, 8] : [8, 4, 4];
      } else if (mTop === 3 && mBot === 4) {
        // 3/4: 2분+4분
        mRhythm = [8, 4];
      } else if (mTop === 2 && mBot === 4) {
        // 2/4: 2분 1개
        mRhythm = [8];
      } else {
        // 기타: 2분 단위 채우기
        mRhythm = [];
        let rem = sixteenthsPerBar;
        while (rem > 0) { const c = Math.min(8, rem); mRhythm.push(c); rem -= c; }
      }

      // 첫 슬롯은 근음, 이후 슬롯은 treble과 가장 잘 어울리는 화음톤 선택
      bnn = rootBnn;
      let mOff = bassOff;
      for (let j = 0; j < mRhythm.length; j++) {
        if (j > 0) {
          const tMidi = trebleAttackMap.get(mOff);
          if (tMidi !== undefined) {
            let bestTone = rootBnn, bestScore = -1;
            for (const t of bTones) {
              const cand = t > 4 ? t - 7 : t;
              if (cand < -5 || cand > 4) continue;
              const { pitch: cp, octave: co } = noteNumToNote(cand, scale, BASS_BASE);
              const cOct = Math.max(2, Math.min(3, co));
              const cMidi = noteToMidiWithKey(makeNote(cp, cOct, '4'), keySignature);
              const pc = ((tMidi - cMidi) % 12 + 12) % 12;
              let score = 0;
              if (IMPERFECT_CONSONANT_PC.has(pc)) score = 3;
              else if (!DISSONANT_PC.has(pc)) score = 1;
              const dist = Math.abs(cand - bnn);
              if (dist <= 2) score += 1;
              if (score > bestScore) { bestScore = score; bestTone = cand; }
            }
            bnn = bestTone;
          } else {
            bnn = rand(bTones);
            if (bnn > 4) bnn -= 7;
          }
        }
        bnn = Math.max(-5, Math.min(4, bnn));
        bnn = ensureConsonance(bnn, mOff, trebleAttackMap, scale, BASS_BASE, keySignature, bTones);

        const durLabel = SIXTEENTHS_TO_DUR[mRhythm[j]] || '4';
        const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
        let oct = Math.max(2, Math.min(3, octave));
        let note = makeNote(pitch, oct, durLabel);
        const clashMidi = trebleAttackMap.get(mOff);
        if (clashMidi !== undefined) {
          const bassMidi = noteToMidiWithKey(note, keySignature);
          if (bassMidi === clashMidi || clashMidi - bassMidi < MIN_TREBLE_BASS_SEMITONES) {
            note = makeNote(pitch, Math.max(2, oct - 1), durLabel);
          }
        }
        note = fixParallelPerfect(bnn, note, durLabel, mOff, prevMidiTrack, trebleAttackMap, scale, BASS_BASE, keySignature);
        prevMidiTrack = noteToMidiWithKey(note, keySignature);
        bassNotes.push(note);
        mOff += mRhythm[j];
      }
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 6단: 분산화음 arpeggio (미사용 — 주석 처리) ─────────────
    /* case 'arpeggio': {
      // 3음·5음은 가급적 근음 위로 올림
      let hi3 = thirdBnn <= rootBnn ? thirdBnn + 7 : thirdBnn;
      let hi5 = fifthBnn <= rootBnn ? fifthBnn + 7 : fifthBnn;

      // 음역(4) 초과 시 옥타브를 낮춤 (clamp로 인해 같은 음 반복되는 버그 방지)
      if (hi3 > 4) hi3 -= 7;
      if (hi5 > 4) hi5 -= 7;

      const arp = [rootBnn, hi3, hi5, hi3];
      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = arp[j % arp.length];
        emitPatternNote(bnn, bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 7단: 전위 화음 (미사용) ─────────────────
    case 'inversion': {
      // 하행 베이스 라인: 5음(높)→3음→근음  또는  3음→근음→5음(낮)
      let hi5 = fifthBnn < rootBnn ? fifthBnn + 7 : fifthBnn;
      if (hi5 > 4) hi5 -= 7;

      let lo5 = fifthBnn > rootBnn ? fifthBnn - 7 : fifthBnn;
      if (lo5 < -5) lo5 += 7;

      const descLine = Math.random() < 0.5
        ? [hi5, thirdBnn, rootBnn]
        : [thirdBnn, rootBnn, lo5];

      for (let j = 0; j < bassRhythm.length; j++) {
        bnn = emitNote(descLine[j % descLine.length], bassRhythm[j], bassOff);
        bassOff += bassRhythm[j];
      }
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 8단: 싱코페이션 — (쉼표)-근음 교차 / 구절 해소는 isSyncopationPhraseResolutionBar 참조
    case 'syncopated': {
      if (isSyncopationPhraseResolutionBar(totalMeasures, barIndex)) {
        // 5단 leap과 동일: 도약 진행(근↔낮은5↔3↔근) + 5단 리듬 풀
        const lowFifth = fifthBnn >= rootBnn ? fifthBnn - 7 : fifthBnn;
        const leapPattern = [rootBnn, Math.max(-5, lowFifth), thirdBnn, rootBnn];
        const resolutionRhythm = fillRhythm(sixteenthsPerBar, [4], {
          timeSignature, minDur: 4,
        });
        let pos = 0;
        for (let j = 0; j < resolutionRhythm.length; j++) {
          bnn = emitNote(leapPattern[j % leapPattern.length], resolutionRhythm[j], pos);
          pos += resolutionRhythm[j];
        }
        bassOff = pos;
        return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
      }

      const [topStr, bs] = timeSignature.split('/');
      const top = parseInt(topStr, 10) || 4;
      const bottom = parseInt(bs, 10) || 4;
      const isCompound = bottom === 8 && top % 3 === 0 && top >= 6;
      const beatSize = isCompound ? 6 : 16 / bottom;
      const numBeats = Math.max(1, Math.round(sixteenthsPerBar / beatSize));
      let pos = 0;
      bnn = rootBnn;
      for (let b = 0; b < numBeats; b++) {
        const dur = beatSize;
        if (b % 2 === 0) {
          bassNotes.push(makeRest(SIXTEENTHS_TO_DUR[dur] || '4'));
        } else {
          bnn = emitNote(rootBnn, dur, pos);
        }
        pos += dur;
      }
      bassOff = pos;
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }

    // ── 9단: 반진행 — 마디 단위 반진행 + 강박 이동 보장 + 병행 완전음정 방지 ─
    case 'contrary': {
      const [, bs] = timeSignature.split('/');
      const beatSize = 16 / (parseInt(bs, 10) || 4);

      // 트레블 공격 목록 (시간순 정렬)
      const trebleAttacks = [...trebleAttackMap.entries()].sort(([a], [b]) => a - b);

      // pos에서 가장 최근 트레블 MIDI 값
      const getTrebleMidiAt = (pos: number): number | undefined => {
        let result: number | undefined;
        for (const [off, midi] of trebleAttacks) {
          if (off <= pos) result = midi;
          else break;
        }
        return result;
      };

      // bnn → MIDI 변환
      const bnnToMidi = (n: number): number => {
        const clamped = Math.max(-5, Math.min(4, n));
        const { pitch, octave } = noteNumToNote(clamped, scale, BASS_BASE);
        const oct = Math.max(2, Math.min(4, octave));
        return noteToMidiWithKey(makeNote(pitch, oct, '4'), keySignature);
      };

      // 방향 인식 화음 구성음 snap — 현재 위치 제외, 방향 강력 선호
      const snapDir = (nn: number, preferDir: number): number => {
        let best: number | undefined;
        let bestScore = Infinity;
        for (const t of bTones) {
          for (const base of [
            Math.floor(nn / 7) * 7 + t,
            Math.floor(nn / 7) * 7 + t - 7,
            Math.floor(nn / 7) * 7 + t + 7,
          ]) {
            if (base === nn || base < -5 || base > 4) continue; // 현재 위치 제외
            const d = Math.abs(base - nn);
            const wrongDir = preferDir !== 0 && Math.sign(base - nn) !== preferDir;
            const score = d + (wrongDir ? 10 : 0); // 방향 페널티 강화
            if (score < bestScore) { bestScore = score; best = base; }
          }
        }
        return Math.max(-5, Math.min(4, best ?? nn));
      };

      // 병행 완전음정(5도/8도) 검사
      const hasParallelPerfect = (
        pBMidi: number, pTMidi: number | undefined,
        cBMidi: number, cTMidi: number | undefined,
      ): boolean => {
        if (pTMidi === undefined || cTMidi === undefined) return false;
        const pInt = ((pTMidi - pBMidi) % 12 + 12) % 12;
        const cInt = ((cTMidi - cBMidi) % 12 + 12) % 12;
        if ((pInt !== 0 && pInt !== 7) || (cInt !== 0 && cInt !== 7)) return false;
        return Math.sign(cBMidi - pBMidi) !== 0 &&
          Math.sign(cBMidi - pBMidi) === Math.sign(cTMidi - pTMidi);
      };

      // 마디 전체 트레블 방향으로 반진행 방향 결정 (진동 방지)
      const globalTDir = trebleAttacks.length >= 2
        ? (trebleAttacks[trebleAttacks.length - 1][1] > trebleAttacks[0][1] ? 1 : -1) : 0;
      const bassDir = globalTDir === 0 ? (Math.random() < 0.5 ? 1 : -1) : -globalTDir;

      bnn = snapToChordTone(prevBassNn !== 0 ? prevBassNn : rootBnn, bTones);

      let pos = 0;
      let prevBMidi = bnnToMidi(bnn);
      let prevTMidi = getTrebleMidiAt(0);

      for (let j = 0; j < bassRhythm.length; j++) {
        if (j > 0) {
          if (pos % beatSize === 0) {
            // 강박: 현재 위치 제외 + 방향 강력 선호 chord tone snap → 반드시 이동 보장
            bnn = snapDir(bnn, bassDir);
          } else {
            // 약박: 순차 경과음 (passing tone)
            bnn = Math.max(-5, Math.min(4, bnn + bassDir));
          }
        }

        // 병행 완전음정 보정 — 위반 시 한 step 추가 이동
        const currTMidi = getTrebleMidiAt(pos);
        if (j > 0 && hasParallelPerfect(prevBMidi, prevTMidi, bnnToMidi(bnn), currTMidi)) {
          bnn = Math.max(-5, Math.min(4, bnn + bassDir));
        }

        bnn = emitNote(bnn, bassRhythm[j], bassOff);
        prevBMidi = noteToMidiWithKey(bassNotes[bassNotes.length - 1], keySignature);
        prevTMidi = currTMidi;
        bassOff += bassRhythm[j];
        pos += bassRhythm[j];
      }
      return { prevBassNn: bnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
    }
    */ // end 미사용 케이스 (arpeggio / inversion / syncopated / contrary)

    default:
      return { prevBassNn: rootBnn, lastMidi: prevMidiTrack, prevBassDir: 0 };
  }
}

// ── 초급 베이스: 화음톤 기반 ─────────────────────────────────
function generateBasicBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature?: string,
  pool?: number[],
  params?: LevelParams,
) {
  const BASS_BASE   = getBassBaseOctave(scale);
  const bTones      = CHORD_TONES[chordRoot];
  // 난이도 풀 우선, 없으면 트레블 기반 폴백
  const bassPool = pool ?? (trebleRhythm.some(d => d <= 2) ? [16, 8] : [8, 4]);
  const bassRhythm  = fillRhythm(sixteenthsPerBar, bassPool, { timeSignature, minDur: 2 });

  const strongBeats = getStrongBeatOffsets(timeSignature || '4/4');
  const contraryRatio = params?.contraryMotionRatio ?? 0.30;
  const consonanceTarget = params?.consonanceRatio ?? 1.0;

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

  const startIdx = bassNotes.length;
  const offsets: number[] = [];
  const durations: number[] = [];

  let bassOff = 0;
  let prevMidi: number | undefined = undefined;
  let prevTrebleMidi: number | undefined;
  for (let j = 0; j < bassRhythm.length; j++) {
    const dur      = bassRhythm[j];
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    if (j > 0) {
      // 반진행 바이어스: treble 방향 반대로 화음톤 선택
      const curTrebleMidi = trebleAttackMap.get(bassOff);
      let useContrary = false;
      if (prevTrebleMidi !== undefined && curTrebleMidi !== undefined && Math.random() < contraryRatio) {
        const trebleDir = curTrebleMidi > prevTrebleMidi ? 1 : curTrebleMidi < prevTrebleMidi ? -1 : 0;
        if (trebleDir !== 0) {
          // treble 반대 방향의 화음톤 선호
          const candidates = bTones.map(t => t > 4 ? t - 7 : t).filter(t => t >= -5 && t <= 4);
          const preferred = candidates.filter(t => Math.sign(t - bnn) === -trebleDir);
          if (preferred.length > 0) { bnn = rand(preferred); useContrary = true; }
        }
      }
      if (!useContrary) { bnn = rand(bTones); if (bnn > 4) bnn -= 7; }
    }
    bnn = Math.max(-5, Math.min(4, bnn));

    // 강박 협화음 검증
    if (strongBeats.has(bassOff)) {
      bnn = ensureConsonance(bnn, bassOff, trebleAttackMap, scale, BASS_BASE, keySignature, bTones);
    }

    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, bnn, oct, durLabel, bassOff, scale, BASS_BASE, keySignature, trebleAttackMap, bTones);
    note = smoothBassMelodicContinuity(note, durLabel, bassOff, prevMidi, keySignature, trebleAttackMap);
    note = fixParallelPerfect(bnn, note, durLabel, bassOff, prevMidi, trebleAttackMap, scale, BASS_BASE, keySignature);

    // treble MIDI 추적
    const tMidi = trebleAttackMap.get(bassOff);
    if (tMidi !== undefined) prevTrebleMidi = tMidi;

    prevMidi = noteToMidiWithKey(note, keySignature);
    bassNotes.push(note);
    offsets.push(bassOff);
    durations.push(dur);
    bassOff += dur;
  }

  // 불완전 협화음 비율 후보정
  if (consonanceTarget < 1.0) {
    applyImperfectConsonanceRatio(
      bassNotes, startIdx, offsets, durations,
      trebleAttackMap, scale, BASS_BASE, keySignature, bTones,
      consonanceTarget, strongBeats,
    );
  }
}

// ── 중급 베이스: 독립적 리듬 프로필 ─────────────────────────
function generateIndependentBass(
  bassNotes: ScoreNote[], trebleRhythm: number[], sixteenthsPerBar: number,
  chordRoot: number, scale: PitchName[], params: LevelParams,
  keySignature: string,
  trebleAttackMap: Map<number, number>,
  timeSignature?: string,
  pool?: number[],
) {
  const BASS_BASE   = getBassBaseOctave(scale);
  const bTones      = CHORD_TONES[chordRoot];

  // 난이도 풀 우선, 없으면 독립도 기반 폴백
  let bassPool: number[];
  if (pool) {
    bassPool = pool;
  } else if (params.bassIndependence >= 0.6) {
    bassPool = [8, 6, 4, 2];
  } else {
    const trebleShort = trebleRhythm.some(d => d <= 2);
    bassPool = trebleShort ? [8, 4] : [8, 6, 4];
  }

  const bassRhythm = fillRhythm(sixteenthsPerBar, bassPool, { timeSignature, minDur: 2 });

  const strongBeats = getStrongBeatOffsets(timeSignature || '4/4');
  const contraryRatio = params.contraryMotionRatio;
  const consonanceTarget = params.consonanceRatio;

  let bnn = chordRoot;
  if (bnn > 4) bnn -= 7;

  const startIdx = bassNotes.length;
  const offsets: number[] = [];
  const durations: number[] = [];

  let bassOff = 0;
  let prevMidi: number | undefined = undefined;
  let prevTrebleMidi: number | undefined;
  for (let j = 0; j < bassRhythm.length; j++) {
    const dur      = bassRhythm[j];
    const durLabel = SIXTEENTHS_TO_DUR[dur] || '4';
    if (j > 0) {
      // 반진행 바이어스: treble 방향 반대로 이동 선호
      const curTrebleMidi = trebleAttackMap.get(bassOff);
      let useContrary = false;
      if (prevTrebleMidi !== undefined && curTrebleMidi !== undefined && Math.random() < contraryRatio) {
        const trebleDir = curTrebleMidi > prevTrebleMidi ? 1 : curTrebleMidi < prevTrebleMidi ? -1 : 0;
        if (trebleDir !== 0) {
          // treble 반대 방향으로 순차/화음톤 이동
          const bassDir = -trebleDir;
          if (Math.random() < 0.4) {
            bnn += bassDir; // 순차 (반진행 방향)
          } else {
            const candidates = bTones.map(t => t > 4 ? t - 7 : t).filter(t => t >= -5 && t <= 4);
            const preferred = candidates.filter(t => Math.sign(t - bnn) === bassDir);
            bnn = preferred.length > 0 ? rand(preferred) : rand(candidates);
          }
          useContrary = true;
        }
      }
      if (!useContrary) {
        // 기존 순차진행 + 화음톤 혼합
        if (Math.random() < 0.4) {
          bnn += rand([1, -1]); // 순차
        } else {
          bnn = rand(bTones);
        }
      }
      if (bnn > 4) bnn -= 7;
    }
    bnn = Math.max(-5, Math.min(4, bnn));

    // 강박 협화음 검증
    if (strongBeats.has(bassOff)) {
      bnn = ensureConsonance(bnn, bassOff, trebleAttackMap, scale, BASS_BASE, keySignature, bTones);
    }

    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, durLabel);
    note = resolveBassClash(note, bnn, oct, durLabel, bassOff, scale, BASS_BASE, keySignature, trebleAttackMap, bTones);
    note = smoothBassMelodicContinuity(note, durLabel, bassOff, prevMidi, keySignature, trebleAttackMap);
    note = fixParallelPerfect(bnn, note, durLabel, bassOff, prevMidi, trebleAttackMap, scale, BASS_BASE, keySignature);

    // treble MIDI 추적
    const tMidi = trebleAttackMap.get(bassOff);
    if (tMidi !== undefined) prevTrebleMidi = tMidi;

    prevMidi = noteToMidiWithKey(note, keySignature);
    bassNotes.push(note);
    offsets.push(bassOff);
    durations.push(dur);
    bassOff += dur;
  }

  // 불완전 협화음 비율 후보정
  applyImperfectConsonanceRatio(
    bassNotes, startIdx, offsets, durations,
    trebleAttackMap, scale, BASS_BASE, keySignature, bTones,
    consonanceTarget, strongBeats,
  );
}

// ── 고급 베이스: 분산화음(아르페지오) / 워킹베이스 ────────────
function generateArpeggioBass(
  bassNotes: ScoreNote[],
  sixteenthsPerBar: number,
  chordRoot: number,
  scale: PitchName[],
  keySignature: string,
  trebleAttackMap: Map<number, number>,
) {
  const BASS_BASE = getBassBaseOctave(scale);
  const bTones = CHORD_TONES[chordRoot];
  const pattern = [bTones[0], bTones[2], bTones[1], bTones[2]];

  const totalEighths = Math.floor(sixteenthsPerBar / 2);
  const leftover     = sixteenthsPerBar % 2;

  let bassOff = 0;
  let prevMidi: number | undefined = undefined;
  for (let j = 0; j < totalEighths; j++) {
    let bnn = pattern[j % pattern.length];
    if (bnn > 4) bnn -= 7;
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, '8');
    note = resolveBassClash(note, bnn, oct, '8', bassOff, scale, BASS_BASE, keySignature, trebleAttackMap, bTones);
    note = smoothBassMelodicContinuity(note, '8', bassOff, prevMidi, keySignature, trebleAttackMap);
    prevMidi = noteToMidiWithKey(note, keySignature);
    bassNotes.push(note);
    bassOff += 2;
  }

  if (leftover > 0) {
    let bnn = pattern[totalEighths % pattern.length];
    if (bnn > 4) bnn -= 7;
    bnn = Math.max(-5, Math.min(4, bnn));
    const { pitch, octave } = noteNumToNote(bnn, scale, BASS_BASE);
    let oct = Math.max(2, Math.min(4, octave));
    let note = makeNote(pitch, oct, '16');
    note = resolveBassClash(note, bnn, oct, '16', bassOff, scale, BASS_BASE, keySignature, trebleAttackMap, bTones);
    note = smoothBassMelodicContinuity(note, '16', bassOff, prevMidi, keySignature, trebleAttackMap);
    bassNotes.push(note);
  }
}
