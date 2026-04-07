// ────────────────────────────────────────────────────────────────
// Post-processing: reviewAndFixScore & helpers
// ────────────────────────────────────────────────────────────────

import type { ScoreNote, PitchName, Accidental, NoteDuration } from '../scoreUtils';
import {
  durationToSixteenths, getSixteenthsPerBar, noteToMidiWithKey, getTupletActualSixteenths, SIXTEENTHS_TO_DUR,
  getKeySigAlteration, nnToMidi, getMidiInterval,
  PITCH_ORDER, getBassBaseOctave, CHORD_TONES,
  DISSONANT_PC, IMPERFECT_CONSONANT_PC, MIN_TREBLE_BASS_SEMITONES,
  makeNote, makeRest, noteNumToNote, scaleNoteToNn,
  buildTrebleAttackMidiMap, passesBassSpacing,
  chordToneBnnCandidates, snapToChordTone,
  getStrongBeatOffsets, getScaleDegrees, generateProgression,
} from '../scoreUtils';
import { buildAttackTimeline, isConsonantInterval, isParallelPerfect, splitNotesIntoMeasures } from './voiceLeading';

export function reviewAndFixScore(
  treble: ScoreNote[],
  bass: ScoreNote[],
  keySignature: string,
  timeSignature: string,
  scale: PitchName[],
  useGrandStaff: boolean,
  consonanceRatio: number,
): { treble: ScoreNote[]; bass: ScoreNote[] } {
  const sixteenthsPerBar = getSixteenthsPerBar(timeSignature);
  const BASS_BASE = 3;

  // ════════════════════════════════════════════════════════════════
  // Pass 1: 마디 음가 합계 정합성 검증
  // ════════════════════════════════════════════════════════════════
  const verifyMeasureDurations = (notes: ScoreNote[], label: string): void => {
    // 반복: splice 후 인덱스 변동이 있을 수 있으므로 안정될 때까지 재검증
    for (let pass = 0; pass < 3; pass++) {
    let anyFix = false;
    const measures = splitNotesIntoMeasures(notes, sixteenthsPerBar);
    for (let m = 0; m < measures.length; m++) {
      let total = 0;
      let ni = 0;
      while (ni < measures[m].length) {
        const n = measures[m][ni];
        if (n.tuplet) {
          const span = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
          total += span;
          ni += parseInt(n.tuplet, 10);
        } else {
          total += durationToSixteenths(n.duration);
          ni += 1;
        }
      }
      // 부족한 경우 쉼표로 채움
      if (total < sixteenthsPerBar) {
        const gap = sixteenthsPerBar - total;
        const fillDur = SIXTEENTHS_TO_DUR[gap];
        if (fillDur) {
          let insertIdx = 0;
          for (let mi = 0; mi < m; mi++) insertIdx += measures[mi].length;
          insertIdx += measures[m].length;
          notes.splice(insertIdx, 0, {
            id: Math.random().toString(36).substr(2, 9),
            pitch: 'rest', octave: 4, accidental: '', duration: fillDur, tie: false,
          });
          anyFix = true;
          break; // 재분할 필요 → 다음 pass에서 재검증
        }
      }

      // 초과한 경우: 마디 끝에서 역순으로 음표를 줄여 맞춤
      if (total > sixteenthsPerBar) {
        let excess = total - sixteenthsPerBar;
        let startIdx = 0;
        for (let mi = 0; mi < m; mi++) startIdx += measures[mi].length;

        // 마디 내 요소를 "청크" 단위로 분류 (일반 음표 1개 또는 tuplet 그룹)
        const chunks: { start: number; count: number; dur: number; isTuplet: boolean }[] = [];
        let ci = 0;
        while (ci < measures[m].length) {
          const n = measures[m][ci];
          if (n.tuplet) {
            const cnt = parseInt(n.tuplet, 10);
            const dur = getTupletActualSixteenths(n.tuplet, n.tupletSpan || n.duration);
            chunks.push({ start: ci, count: cnt, dur, isTuplet: true });
            ci += cnt;
          } else {
            chunks.push({ start: ci, count: 1, dur: durationToSixteenths(n.duration), isTuplet: false });
            ci += 1;
          }
        }

        // 뒤에서부터 청크 단위로 제거/축소
        for (let ch = chunks.length - 1; ch >= 0 && excess > 0; ch--) {
          const chunk = chunks[ch];
          if (chunk.dur <= excess) {
            notes.splice(startIdx + chunk.start, chunk.count);
            excess -= chunk.dur;
          } else if (!chunk.isTuplet) {
            const newDur = chunk.dur - excess;
            const newDurLabel = SIXTEENTHS_TO_DUR[newDur];
            if (newDurLabel) {
              notes[startIdx + chunk.start] = { ...notes[startIdx + chunk.start], duration: newDurLabel };
            }
            excess = 0;
          } else {
            // tuplet 그룹 전체 제거 후, 남는 공간을 쉼표로 채움
            const gap = chunk.dur - excess;
            notes.splice(startIdx + chunk.start, chunk.count);
            excess -= chunk.dur;
            if (gap > 0) {
              const fillDur = SIXTEENTHS_TO_DUR[gap];
              if (fillDur) {
                notes.splice(startIdx + chunk.start, 0, {
                  id: Math.random().toString(36).substr(2, 9),
                  pitch: 'rest', octave: 4, accidental: '', duration: fillDur, tie: false,
                });
              }
            }
          }
        }
        anyFix = true;
        break; // 재분할 필요 → 다음 pass에서 재검증
      }
    }
    if (!anyFix) break; // 수정 없으면 종료
    } // end pass loop
  };

  verifyMeasureDurations(treble, 'treble');
  if (useGrandStaff && bass.length > 0) {
    verifyMeasureDurations(bass, 'bass');
  }

  // ════════════════════════════════════════════════════════════════
  // Pass 2: 2성부 수직 화성 검증 (병행 완전음정 + 협화도)
  // ════════════════════════════════════════════════════════════════
  if (useGrandStaff && bass.length > 0) {
    const trebleTL = buildAttackTimeline(treble, keySignature);
    const bassTL   = buildAttackTimeline(bass, keySignature);

    // 동시 공격점 매칭 (offset 기준)
    const bassMap = new Map<number, { noteIdx: number; midi: number }>();
    for (const b of bassTL) {
      bassMap.set(b.offset, { noteIdx: b.noteIdx, midi: b.midi });
    }

    type SimultaneousPoint = {
      offset: number;
      trebleIdx: number; trebleMidi: number;
      bassIdx: number;   bassMidi: number;
    };
    const simultaneous: SimultaneousPoint[] = [];
    for (const t of trebleTL) {
      const b = bassMap.get(t.offset);
      if (b) {
        simultaneous.push({
          offset: t.offset,
          trebleIdx: t.noteIdx, trebleMidi: t.midi,
          bassIdx: b.noteIdx,   bassMidi: b.midi,
        });
      }
    }

    // 2a: 병행 완전5도/옥타브 제거 — 베이스 음을 인접 화음톤으로 이동
    for (let i = 1; i < simultaneous.length; i++) {
      const prev = simultaneous[i - 1];
      const curr = simultaneous[i];
      if (isParallelPerfect(prev.trebleMidi, prev.bassMidi, curr.trebleMidi, curr.bassMidi)) {
        const bassNote = bass[curr.bassIdx];
        if (bassNote.pitch === 'rest') continue;

        // 반음 올리거나 내려서 완전음정 해소
        const currPitchIdx = PITCH_ORDER.indexOf(bassNote.pitch as PitchName);
        if (currPitchIdx < 0) continue;

        // 인접 음계 음으로 이동 (한 스텝 위 또는 아래)
        const stepUp   = (currPitchIdx + 1) % 7;
        const stepDown = (currPitchIdx + 6) % 7;
        const candidatePitches = [PITCH_ORDER[stepUp], PITCH_ORDER[stepDown]];

        let fixed = false;
        for (const candPitch of candidatePitches) {
          const candNote: ScoreNote = {
            ...bassNote, pitch: candPitch, accidental: '' as Accidental,
            id: bassNote.id,
          };
          const candMidi = noteToMidiWithKey(candNote, keySignature);
          // 새 음이 트레블과 병행 완전음정을 만들지 않는지 확인
          if (!isParallelPerfect(prev.trebleMidi, prev.bassMidi, curr.trebleMidi, candMidi)) {
            // 간격도 충분한지 확인
            if (curr.trebleMidi - candMidi >= MIN_TREBLE_BASS_SEMITONES) {
              bass[curr.bassIdx] = candNote;
              curr.bassMidi = candMidi;
              fixed = true;
              break;
            }
          }
        }
        // 인접 음으로도 해결 안 되면 옥타브 조정
        if (!fixed && bassNote.octave > 2) {
          const lowered: ScoreNote = { ...bassNote, octave: bassNote.octave - 1 };
          const loweredMidi = noteToMidiWithKey(lowered, keySignature);
          if (!isParallelPerfect(prev.trebleMidi, prev.bassMidi, curr.trebleMidi, loweredMidi)) {
            bass[curr.bassIdx] = lowered;
            curr.bassMidi = loweredMidi;
          }
        }
      }
    }

    // 2b: 수직 협화도 검증 — 불협화 비율이 (1-consonanceRatio) 초과 시 보정
    let dissonantCount = 0;
    const dissonantPoints: number[] = [];
    for (let i = 0; i < simultaneous.length; i++) {
      const s = simultaneous[i];
      const interval = Math.abs(s.trebleMidi - s.bassMidi);
      if (!isConsonantInterval(interval)) {
        dissonantCount++;
        dissonantPoints.push(i);
      }
    }
    const maxDissonant = Math.floor(simultaneous.length * (1 - consonanceRatio));
    if (dissonantCount > maxDissonant) {
      // 초과 불협화음을 협화음으로 보정 (가장 가까운 협화 음정으로 베이스 이동)
      const excessCount = dissonantCount - maxDissonant;
      const toFix = dissonantPoints.slice(0, excessCount);
      for (const idx of toFix) {
        const s = simultaneous[idx];
        const bassNote = bass[s.bassIdx];
        if (bassNote.pitch === 'rest') continue;
        const bassMidi = s.bassMidi;
        const trebleMidi = s.trebleMidi;

        // 협화 음정 목표: 현재 베이스에서 ±1~2 반음 내 협화음 탐색
        let bestNote: ScoreNote | null = null;
        let bestDist = Infinity;
        for (let delta = -3; delta <= 3; delta++) {
          if (delta === 0) continue;
          const targetMidi = bassMidi + delta;
          if (trebleMidi - targetMidi < MIN_TREBLE_BASS_SEMITONES) continue;
          if (!isConsonantInterval(Math.abs(trebleMidi - targetMidi))) continue;

          // MIDI → 가장 가까운 음계 음 매핑
          const semitone = ((targetMidi % 12) + 12) % 12;
          const PITCH_SEMITONES_REV: Record<number, PitchName> = {
            0: 'C', 1: 'C', 2: 'D', 3: 'D', 4: 'E', 5: 'F',
            6: 'F', 7: 'G', 8: 'G', 9: 'A', 10: 'A', 11: 'B',
          };
          const candPitch = PITCH_SEMITONES_REV[semitone];
          if (!candPitch) continue;
          const candOctave = Math.floor(targetMidi / 12) - 1;
          if (candOctave < 2 || candOctave > 4) continue;

          const candNote: ScoreNote = {
            ...bassNote, pitch: candPitch, octave: candOctave,
            accidental: '' as Accidental,
          };
          const actualMidi = noteToMidiWithKey(candNote, keySignature);
          const dist = Math.abs(actualMidi - bassMidi);
          if (dist < bestDist && isConsonantInterval(Math.abs(trebleMidi - actualMidi))) {
            bestDist = dist;
            bestNote = candNote;
          }
        }
        if (bestNote) {
          bass[s.bassIdx] = bestNote;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Pass 3: 선율 윤곽 검증 — 증음정(augmented 2nd = 3반음) 제거
  // ════════════════════════════════════════════════════════════════
  const fixAugmentedIntervals = (notes: ScoreNote[]): void => {
    for (let i = 1; i < notes.length; i++) {
      if (notes[i].pitch === 'rest' || notes[i - 1].pitch === 'rest') continue;
      if (notes[i].tuplet && notes[i].tuplet !== '') continue; // 잇단음표 내부는 건너뜀

      const prevMidi = noteToMidiWithKey(notes[i - 1], keySignature);
      const currMidi = noteToMidiWithKey(notes[i], keySignature);
      const interval = Math.abs(currMidi - prevMidi);

      // 증2도(3반음) = 자연단음계 6→7도 등에서 발생 — 순차진행처럼 보이지만 소리가 어색
      if (interval === 3) {
        // 현재 음을 한 반음 줄여 장2도(2반음)로 만듦
        const dir = Math.sign(currMidi - prevMidi);
        const targetMidi = prevMidi + dir * 2; // 장2도

        // 가장 가까운 음계 음 찾기
        const targetSemitone = ((targetMidi % 12) + 12) % 12;
        let bestPitch: PitchName | null = null;
        let bestDist = Infinity;
        for (const sp of scale) {
          if (sp === 'rest') continue;
          const spNote: ScoreNote = {
            id: '', pitch: sp, octave: notes[i].octave,
            accidental: '' as Accidental, duration: notes[i].duration,
          };
          const spMidi = noteToMidiWithKey(spNote, keySignature);
          const spSemitone = ((spMidi % 12) + 12) % 12;
          const d = Math.abs(spSemitone - targetSemitone);
          const dWrap = Math.min(d, 12 - d);
          if (dWrap < bestDist) {
            bestDist = dWrap;
            bestPitch = sp;
          }
        }
        if (bestPitch && bestDist <= 1) {
          notes[i] = { ...notes[i], pitch: bestPitch, accidental: '' as Accidental };
        }
      }
    }
  };

  fixAugmentedIntervals(treble);
  if (useGrandStaff && bass.length > 0) {
    fixAugmentedIntervals(bass);
  }

  // ════════════════════════════════════════════════════════════════
  // Pass 4: 마디 경계 성부 진행 매끄러움 (7반음 초과 도약 보정)
  // ════════════════════════════════════════════════════════════════
  const smoothMeasureBoundaries = (notes: ScoreNote[]): void => {
    const measures = splitNotesIntoMeasures(notes, sixteenthsPerBar);
    // 마디 경계: 이전 마디 마지막 음 → 다음 마디 첫 음
    let globalIdx = 0;
    for (let m = 0; m < measures.length; m++) {
      const measureLen = measures[m].length;
      if (m > 0 && measureLen > 0) {
        const prevMeasure = measures[m - 1];
        // 이전 마디 마지막 비쉼표 음
        let prevNote: ScoreNote | null = null;
        for (let k = prevMeasure.length - 1; k >= 0; k--) {
          if (prevMeasure[k].pitch !== 'rest') { prevNote = prevMeasure[k]; break; }
        }
        // 현재 마디 첫 비쉼표 음
        let currNote: ScoreNote | null = null;
        let currNoteLocalIdx = -1;
        for (let k = 0; k < measureLen; k++) {
          if (measures[m][k].pitch !== 'rest') { currNote = measures[m][k]; currNoteLocalIdx = k; break; }
        }

        if (prevNote && currNote) {
          const prevMidi = noteToMidiWithKey(prevNote, keySignature);
          const currMidi = noteToMidiWithKey(currNote, keySignature);
          const leap = Math.abs(currMidi - prevMidi);

          // 7반음(완전5도) 초과 도약 → 인접 음계 음으로 보정
          if (leap > 7) {
            const dir = Math.sign(currMidi - prevMidi);
            // 목표: 직전 음에서 2~5반음 거리의 음계 음
            const targetMidi = prevMidi + dir * 4; // 장3도 거리
            let bestPitch: PitchName | null = null;
            let bestOctave = currNote.octave;
            let bestDist = Infinity;

            for (const sp of scale) {
              if (sp === 'rest') continue;
              for (let oct = currNote.octave - 1; oct <= currNote.octave + 1; oct++) {
                if (oct < 2 || oct > 5) continue;
                const candNote: ScoreNote = {
                  id: '', pitch: sp, octave: oct,
                  accidental: '' as Accidental, duration: currNote.duration,
                };
                const candMidi = noteToMidiWithKey(candNote, keySignature);
                const d = Math.abs(candMidi - targetMidi);
                if (d < bestDist && Math.abs(candMidi - prevMidi) <= 7 && Math.abs(candMidi - prevMidi) >= 1) {
                  bestDist = d;
                  bestPitch = sp;
                  bestOctave = oct;
                }
              }
            }

            if (bestPitch) {
              const actualIdx = globalIdx + currNoteLocalIdx;
              if (actualIdx < notes.length) {
                notes[actualIdx] = {
                  ...notes[actualIdx],
                  pitch: bestPitch,
                  octave: bestOctave,
                  accidental: '' as Accidental,
                };
              }
            }
          }
        }
      }
      globalIdx += measureLen;
    }
  };

  smoothMeasureBoundaries(treble);
  // 베이스는 패턴 기반이므로 마디 경계 보정은 treble에만 적용

  // ════════════════════════════════════════════════════════════════
  // Pass 5: 종지 마디 검증 — 마지막 실제 음이 으뜸음인지 확인
  // ════════════════════════════════════════════════════════════════
  const tonicPitch = scale[0];
  // 트레블 마지막 비쉼표 음 확인
  for (let i = treble.length - 1; i >= 0; i--) {
    if (treble[i].pitch !== 'rest') {
      if (treble[i].pitch !== tonicPitch) {
        treble[i] = { ...treble[i], pitch: tonicPitch, accidental: '' as Accidental };
      }
      break;
    }
  }
  // 베이스 마지막 비쉼표 음 확인
  if (useGrandStaff && bass.length > 0) {
    for (let i = bass.length - 1; i >= 0; i--) {
      if (bass[i].pitch !== 'rest') {
        if (bass[i].pitch !== tonicPitch) {
          bass[i] = { ...bass[i], pitch: tonicPitch, accidental: '' as Accidental };
        }
        break;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Pass 6: 2성부 최종 간격 재검증 (보정 과정에서 간격이 좁아졌을 수 있음)
  // ════════════════════════════════════════════════════════════════
  if (useGrandStaff && bass.length > 0) {
    const trebleTL2 = buildAttackTimeline(treble, keySignature);
    const bassTL2   = buildAttackTimeline(bass, keySignature);
    const bassMap2 = new Map<number, number>();
    for (const b of bassTL2) bassMap2.set(b.offset, b.noteIdx);

    for (const t of trebleTL2) {
      const bIdx = bassMap2.get(t.offset);
      if (bIdx === undefined) continue;
      const bassNote = bass[bIdx];
      if (bassNote.pitch === 'rest') continue;
      const bassMidi = noteToMidiWithKey(bassNote, keySignature);
      const trebleMidi = t.midi;

      // 간격 부족 → 베이스 옥타브 내림
      if (trebleMidi - bassMidi < MIN_TREBLE_BASS_SEMITONES && bassNote.octave > 2) {
        bass[bIdx] = { ...bassNote, octave: Math.max(2, bassNote.octave - 1) };
      }
      // 동일 건반 → 베이스 옥타브 내림
      if (trebleMidi === bassMidi && bassNote.octave > 2) {
        bass[bIdx] = { ...bassNote, octave: Math.max(2, bassNote.octave - 1) };
      }
    }
  }

  return { treble, bass };
}

// passesBassSpacing, chordToneBnnCandidates → imported from scoreUtils

/**
 * 베이스-트레블 충돌 해결.
 * - 동일 건반: 한 옥타브 내림 → 그래도 문제면 다른 화음톤 (bnn±7 그리드, 음수 % 버그 없음)
 * - 성부 간격 부족: 먼저 다른 화음톤으로 재배치, 그다음 한 옥타브 내림
 *   (옥타브만 내리면 다음 음과 '옥타브+도'로 끊기는 현상 완화)
 */
export function resolveBassClash(
  note: ScoreNote, bnn: number, oct: number, durLabel: NoteDuration,
  bassOff: number, scale: PitchName[], bassBase: number,
  keySignature: string, trebleAttackMap: Map<number, number>,
  bTones: number[],
): ScoreNote {
  const clashMidi = trebleAttackMap.get(bassOff);
  if (clashMidi === undefined) return note;

  const bassMidi = noteToMidiWithKey(note, keySignature);
  const pitch = note.pitch as PitchName;

  const noteFromBnn = (b: number): ScoreNote => {
    const n = Math.max(-5, Math.min(4, b));
    const { pitch: p, octave } = noteNumToNote(n, scale, bassBase);
    const o = Math.max(2, Math.min(4, octave));
    return makeNote(p, o, durLabel);
  };

  /** 화음 구성음 후보 중 현재 음과 MIDI 거리가 가장 짧은 통과 후보 반환 */
  const closestChordTone = (): ScoreNote | null => {
    let best: ScoreNote | null = null;
    let bestDist = Infinity;
    for (const candBnn of chordToneBnnCandidates(bnn, bTones)) {
      if (candBnn === bnn) continue;
      const cand = noteFromBnn(candBnn);
      if (!passesBassSpacing(cand, bassOff, trebleAttackMap, keySignature)) continue;
      const dist = Math.abs(noteToMidiWithKey(cand, keySignature) - bassMidi);
      if (dist < bestDist) { bestDist = dist; best = cand; }
    }
    return best;
  };

  // 동일 건반
  if (bassMidi === clashMidi) {
    if (oct > 2) {
      const lowered = makeNote(pitch, Math.max(2, oct - 1), durLabel);
      if (passesBassSpacing(lowered, bassOff, trebleAttackMap, keySignature)) {
        return lowered;
      }
    }
    const closest = closestChordTone();
    if (closest) return closest;
    if (oct > 2) {
      return makeNote(pitch, Math.max(2, oct - 1), durLabel);
    }
    return note;
  }

  // 성부 간격 부족 (§4)
  if (clashMidi - bassMidi < MIN_TREBLE_BASS_SEMITONES) {
    const closest = closestChordTone();
    if (closest) return closest;
    if (oct > 2) {
      const lowered = makeNote(pitch, Math.max(2, oct - 1), durLabel);
      if (passesBassSpacing(lowered, bassOff, trebleAttackMap, keySignature)) {
        return lowered;
      }
    }
  }

  // 피치클래스 반음 충돌 — G bass + G# treble처럼 옥타브를 넘어 동시에 울리는 반음 불협화 감지
  // (차이가 15 이상이라 위 간격 검사를 통과했지만 pitch class는 1 반음 차)
  const pitchClassDiff = ((clashMidi - bassMidi) % 12 + 12) % 12;
  if (pitchClassDiff === 1) {
    const closest = closestChordTone();
    if (closest) return closest;
  }

  return note;
}

/** 직전 베이스와의 간격이 한 옥타브 이상이면, 같은 음높이로 옥타브 2~4 중 간격이 가장 짧은 것 선택 */
export function smoothBassMelodicContinuity(
  note: ScoreNote,
  durLabel: NoteDuration,
  bassOff: number,
  prevMidi: number | undefined,
  keySignature: string,
  trebleAttackMap: Map<number, number>,
): ScoreNote {
  if (prevMidi === undefined || note.pitch === 'rest') return note;
  const midi = noteToMidiWithKey(note, keySignature);
  if (Math.abs(midi - prevMidi) < 12) return note;
  const p = note.pitch as PitchName;
  let best = note;
  let bestD = Math.abs(midi - prevMidi);
  for (let tryOct = 2; tryOct <= 4; tryOct++) {
    const cand = makeNote(p, tryOct, durLabel);
    if (!passesBassSpacing(cand, bassOff, trebleAttackMap, keySignature)) continue;
    const d = Math.abs(noteToMidiWithKey(cand, keySignature) - prevMidi);
    if (d < bestD) {
      bestD = d;
      best = cand;
    }
  }
  return best;
}

/**
 * 싱코페이션 구절 해소 마디 (1-based 기준 설명과 동일)
 * - 4마디 곡(measures<=4): 해소 없음
 * - 그 외: 4,8,12…(종지 직전 마디 미만) + 종지 바로 앞 마디(8곡→7, 12곡→11, 16곡→15)
 */
function isSyncopationPhraseResolutionBar(totalMeasures: number, barIndex: number): boolean {
  if (totalMeasures <= 4) return false;
  const contentBars = totalMeasures - 1;
  const oneBased = barIndex + 1;
  if (oneBased === contentBars) return true;
  return oneBased >= 4 && oneBased % 4 === 0 && oneBased < contentBars;
}

// getStrongBeatOffsets → imported from scoreUtils

/**
 * 수직 협화음 검증 — treble과의 pitch-class 차이가 불협화(2도·4도·7도)이면
 * 가장 가까운 다른 화음톤으로 대체. 대체 불가 시 원본 반환.
 * (2성부 가이드라인 §1: 강박 협화음 우선성)
 */
export function ensureConsonance(
  nn: number, off: number,
  trebleAttackMap: Map<number, number>,
  scale: PitchName[], bassBase: number,
  keySignature: string, bTones: number[],
): number {
  const tMidi = trebleAttackMap.get(off);
  if (tMidi === undefined) return nn;
  const n = Math.max(-5, Math.min(4, nn));
  const { pitch, octave } = noteNumToNote(n, scale, bassBase);
  const oct = Math.max(2, Math.min(3, octave));
  const bMidi = noteToMidiWithKey(makeNote(pitch, oct, '4'), keySignature);
  const pc = ((tMidi - bMidi) % 12 + 12) % 12;
  if (!DISSONANT_PC.has(pc)) return nn;
  // 불협화 → 다른 화음톤 중 협화음이면서 가장 가까운 것 선택
  let best = nn, bestDist = Infinity;
  for (const t of bTones) {
    for (const base of [
      Math.floor(nn / 7) * 7 + t,
      Math.floor(nn / 7) * 7 + t - 7,
      Math.floor(nn / 7) * 7 + t + 7,
    ]) {
      if (base < -5 || base > 4 || base === nn) continue;
      const { pitch: cp, octave: co } = noteNumToNote(base, scale, bassBase);
      const cOct = Math.max(2, Math.min(3, co));
      const cMidi = noteToMidiWithKey(makeNote(cp, cOct, '4'), keySignature);
      const cPc = ((tMidi - cMidi) % 12 + 12) % 12;
      if (DISSONANT_PC.has(cPc)) continue;
      const d = Math.abs(base - nn);
      if (d < bestDist) { bestDist = d; best = base; }
    }
  }
  return Math.max(-5, Math.min(4, best));
}

/**
 * 병진행 완전5도·8도 보정 — treble 반대 방향으로 베이스 1 scale step 조정.
 * 조정 불가(음역 밖, treble 충돌)이면 원본 반환.
 */
export function fixParallelPerfect(
  nn: number, note: ScoreNote, durLabel: NoteDuration, off: number,
  prevBMidi: number | undefined,
  trebleAttackMap: Map<number, number>,
  scale: PitchName[], bassBase: number,
  keySignature: string,
): ScoreNote {
  if (prevBMidi === undefined) return note;
  const curTMidi = trebleAttackMap.get(off);
  if (curTMidi === undefined) return note;
  let prevTMidi: number | undefined;
  for (const [o, m] of trebleAttackMap) { if (o < off) prevTMidi = m; }
  if (prevTMidi === undefined) return note;
  const curBMidi = noteToMidiWithKey(note, keySignature);
  const prevInt = ((prevTMidi - prevBMidi) % 12 + 12) % 12;
  const curInt  = ((curTMidi  - curBMidi)  % 12 + 12) % 12;
  if (!((prevInt === 0 || prevInt === 7) && prevInt === curInt)) return note;
  // 병진행 완전음정 감지 — treble 반대 방향으로 1 scale step 이동
  const trebleDir = curTMidi > prevTMidi ? 1 : -1;
  const fixedNn = Math.max(-5, Math.min(4, nn - trebleDir));
  if (fixedNn === nn) return note;
  const { pitch: fp, octave: fo } = noteNumToNote(fixedNn, scale, bassBase);
  const fixedOct = Math.max(2, Math.min(3, fo));
  const fixedNote = makeNote(fp, fixedOct, durLabel);
  return noteToMidiWithKey(fixedNote, keySignature) !== curTMidi ? fixedNote : note;
}

/**
 * 불완전 협화음 비율 후보정 — perfect consonance(unison/5th/8ve)를
 * 가장 가까운 3rd/6th로 교체하여 imperfect consonance 비율을 높인다.
 * 강박 음은 건드리지 않는다.
 */
export function applyImperfectConsonanceRatio(
  bassNotes: ScoreNote[], startIdx: number,
  offsets: number[], durations: number[],
  trebleAttackMap: Map<number, number>,
  scale: PitchName[], bassBase: number,
  keySignature: string, bTones: number[],
  targetRatio: number,
  strongBeats: Set<number>,
): void {
  const count = offsets.length;
  if (count === 0) return;

  // 현재 비율 계산
  let totalVertical = 0, imperfectCount = 0;
  const pcs: number[] = [];
  for (let i = 0; i < count; i++) {
    const tMidi = trebleAttackMap.get(offsets[i]);
    if (tMidi === undefined) { pcs.push(-1); continue; }
    const bMidi = noteToMidiWithKey(bassNotes[startIdx + i], keySignature);
    const pc = ((tMidi - bMidi) % 12 + 12) % 12;
    pcs.push(pc);
    totalVertical++;
    if (IMPERFECT_CONSONANT_PC.has(pc)) imperfectCount++;
  }
  if (totalVertical === 0) return;
  const currentRatio = imperfectCount / totalVertical;
  if (currentRatio >= targetRatio) return;

  // 부족분 보정: 약박의 perfect consonance(0, 5, 7)를 imperfect로 교체
  const perfectIndices: number[] = [];
  for (let i = 0; i < count; i++) {
    if (strongBeats.has(offsets[i])) continue; // 강박 보존
    const pc = pcs[i];
    if (pc === 0 || pc === 5 || pc === 7) perfectIndices.push(i);
  }

  const needed = Math.ceil(targetRatio * totalVertical) - imperfectCount;
  for (let k = 0; k < Math.min(needed, perfectIndices.length); k++) {
    const idx = perfectIndices[k];
    const off = offsets[idx];
    const tMidi = trebleAttackMap.get(off);
    if (tMidi === undefined) continue;

    // bTones 중 imperfect consonance가 되는 가장 가까운 후보 탐색
    const origNote = bassNotes[startIdx + idx];
    const origBnn = -99; // 역산 불필요 — bTones에서 직접 탐색
    let bestNote: ScoreNote | undefined;
    let bestDist = Infinity;
    for (const t of bTones) {
      for (const base of [t, t - 7, t + 7]) {
        if (base < -5 || base > 4) continue;
        const { pitch: cp, octave: co } = noteNumToNote(base, scale, bassBase);
        const cOct = Math.max(2, Math.min(3, co));
        const cand = makeNote(cp, cOct, origNote.duration);
        const cMidi = noteToMidiWithKey(cand, keySignature);
        const cPc = ((tMidi - cMidi) % 12 + 12) % 12;
        if (!IMPERFECT_CONSONANT_PC.has(cPc)) continue;
        const origMidi = noteToMidiWithKey(origNote, keySignature);
        const d = Math.abs(cMidi - origMidi);
        if (d < bestDist) { bestDist = d; bestNote = cand; }
      }
    }
    if (bestNote) bassNotes[startIdx + idx] = bestNote;
  }
}

