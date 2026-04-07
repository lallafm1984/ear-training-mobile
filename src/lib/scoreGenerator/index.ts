// ────────────────────────────────────────────────────────────────
// scoreGenerator barrel — 악보 생성 엔진 진입점
// ────────────────────────────────────────────────────────────────

export type { Difficulty, BassDifficulty, DifficultyCategory, GeneratorOptions, GeneratedScore } from './types';
export { getDifficultyCategory, BASS_DIFF_LABELS, BASS_DIFF_DESC } from './types';

import type { ScoreNote, PitchName, Accidental, NoteDuration } from '../scoreUtils';
import {
  getSixteenthsPerBar, durationToSixteenths,
  getKeySigAlteration, getKeySignatureAccidentalCount,
  getScaleDegrees, SIXTEENTHS_TO_DUR, splitAtBeatBoundaries,
  nnToMidi, getMidiInterval, isForbiddenMelodicInterval,
  PITCH_ORDER, getBassBaseOctave, CHORD_TONES,
  DISSONANT_PC, IMPERFECT_CONSONANT_PC, MIN_TREBLE_BASS_SEMITONES,
  uid, makeNote, makeRest, noteNumToNote, scaleNoteToNn,
  buildTrebleAttackMidiMap, passesBassSpacing,
  chordToneBnnCandidates, snapToChordTone,
  generateProgression, getStrongBeatOffsets,
  noteToMidiWithKey, getTupletActualSixteenths,
} from '../scoreUtils';

import type { BassLevel, TimeSignature as TVTimeSignature } from '../twoVoice';
import { applyCounterpointCorrections, generateTwoVoiceStack } from '../twoVoice';
import { applyMelodyAccidentals, ensureMinAccidentalBars } from '../twoVoice/chromaticAccidental';
import { fillRhythm } from '../trebleRhythmFill';

import type { Difficulty, BassDifficulty, GeneratorOptions, GeneratedScore } from './types';
import { difficultyLevel, DURATION_POOL, BASS_LEVEL_PARAMS, LEVEL_PARAMS } from './types';
import type { LevelParams } from './types';

// Import internal helpers from sub-modules
import { isMinorKey, getMinorLeadingToneAccidental, mapBassDifficultyToLevel, buildBassAttackMidiMap } from './melodyEngine';
import { rand, lastNonRestMelody, samePitchHeight, tryInsertTriplet, cleanupBrokenAccidentals, fixTritoneleaps, fixConsecutiveRepeats, fixMinorCrossRelation, generateCadenceMeasure, forceGrandStaffFinalTonic, applyInternalRests, fixForbiddenInterval, applyGapFill, isTriadSubset, checkConsecutiveLeapTriad, applyTendencyResolution, enforcePeakNote } from './melodyEngine';
import { reviewAndFixScore } from './postProcessing';
import { generateBassForBar } from './bassEngine';

// ────────────────────────────────────────────────────────────────
// Main generator
// ────────────────────────────────────────────────────────────────

export function generateScore(opts: GeneratorOptions): GeneratedScore {
  const { keySignature, timeSignature, difficulty, measures, useGrandStaff } = opts;
  const bassDifficulty = opts.bassDifficulty;

  if (measures < 1) throw new Error('measures must be >= 1');
  if (!timeSignature || !timeSignature.includes('/')) throw new Error(`Invalid timeSignature: ${timeSignature}`);
  const scale             = getScaleDegrees(keySignature);
  const sixteenthsPerBar  = getSixteenthsPerBar(timeSignature);
  const isMinor           = isMinorKey(keySignature);
  const progression       = generateProgression(measures, isMinor);
  /** 단조 7음 (이끔음 올림 대상) — scale[6] */
  const minorSeventhDeg   = isMinor ? scale[6] : null;
  const minorLeadingAcc   = isMinor && minorSeventhDeg
    ? getMinorLeadingToneAccidental(keySignature, minorSeventhDeg) : '' as Accidental;
  const lvl               = difficultyLevel(difficulty);

  const trebleNotes: ScoreNote[] = [];
  const bassNotes:   ScoreNote[] = [];

  // 루트가 높은 조(G,A,B 등)에서 wrap 편향으로 옥타브5에 음이 몰리는 현상 보정
  // wrapCount >= 4이면 TREBLE_BASE를 3으로 낮춰 한 옥타브 아래에서 시작
  const rootIdx = PITCH_ORDER.indexOf(scale[0]);
  const wrapCount = rootIdx; // wrap이 발생하는 음계도 수 = rootIdx
  const TREBLE_BASE = wrapCount >= 4 ? 3 : 4;
  const BASS_BASE   = getBassBaseOctave(scale);

  // 조표의 wrap 보정을 반영한 트레블 실효 최대 nn 계산
  const rawTrebleMax = lvl <= 2 ? 8 : 12;
  let effectiveTrebleMax = rawTrebleMax;
  while (effectiveTrebleMax > 0 && noteNumToNote(effectiveTrebleMax, scale, TREBLE_BASE).octave > 5) {
    effectiveTrebleMax--;
  }

  // 2성부 + TREBLE_BASE=3 인 조: 트레블이 옥타브3에 내려가면 베이스와 겹침
  // → octave 4 이상만 사용하도록 최소 nn 설정 (Am:2→C4, Gm:3→C4, Bm:1→C#4)
  const trebleRangeMin = (useGrandStaff && TREBLE_BASE <= 3) ? (7 - rootIdx) : 0;

  // ── Step A: 베이스 선생성 + 멜로디 생성 (1성부/2성부 공통) ──
  // 1성부도 2성부와 동일하게 베이스를 내부 생성하여 멜로디 품질 향상 후 베이스 제거
  const bassLevel: BassLevel = bassDifficulty
    ? mapBassDifficultyToLevel(bassDifficulty)
    : 1; // 1성부: 기본 베이스(온음표 루트)로 화성 컨텍스트 제공
  const tvTimeSig = timeSignature as TVTimeSignature;
  const tvMeasures = ([4, 8, 12, 16] as const).find(m => m >= measures - 1) ?? 16;
  const stack = generateTwoVoiceStack({
    keySignature,
    mode: isMinor ? 'harmonic_minor' : 'major',
    timeSig: tvTimeSig,
    measures,
    tvMeasures,
    bassLevel,
    melodyLevel: lvl,
    progression,
    trebleBaseOctave: TREBLE_BASE,
    melodyNnMin: Math.max(trebleRangeMin, 0),
    melodyNnMax: effectiveTrebleMax,
    partPracticeLevel: opts.partPracticeLevel,
  });
  const internalBassNotes = stack.bassScoreNotes;
  trebleNotes.push(...stack.trebleScoreNotes);

  // ── 2성부: 베이스를 최종 출력에 포함 ──
  if (useGrandStaff && internalBassNotes.length > 0) {
    bassNotes.push(...internalBassNotes);
  }

  // ── 1성부 후처리: 임시표 정리 + 삼전음 보정 (내부 베이스 협화 검사 포함) ──
  if (!useGrandStaff) {
    cleanupBrokenAccidentals(trebleNotes, keySignature, internalBassNotes);
    fixTritoneleaps(trebleNotes, scale, TREBLE_BASE, keySignature);
  }

  // ── 종지 마디 ──
  // ── 단조: 종지 직전 마지막 트레블 음이 7음이면 이끔음(올린 7음)으로 교체 ──
  if (isMinor && minorSeventhDeg && minorLeadingAcc && trebleNotes.length > 0) {
    const lastIdx = trebleNotes.length - 1;
    const lastNote = trebleNotes[lastIdx];
    if (lastNote.pitch === minorSeventhDeg && lastNote.accidental === '') {
      trebleNotes[lastIdx] = { ...lastNote, accidental: minorLeadingAcc };
    }
  }

  const cadence = generateCadenceMeasure(
    scale, TREBLE_BASE, BASS_BASE, sixteenthsPerBar, useGrandStaff, keySignature,
  );
  trebleNotes.push(...cadence.treble);
  bassNotes.push(...cadence.bass);

  // ── Step C: 대위법 후처리 (2성부 사용 시) ──
  if (useGrandStaff) {
    applyCounterpointCorrections(trebleNotes, bassNotes, tvTimeSig, keySignature, lvl);

    // ── Step C-1.5: 임시표 정리 + 삼전음 보정 (안전망 이전) ──
    cleanupBrokenAccidentals(trebleNotes, keySignature, bassNotes);
    fixTritoneleaps(trebleNotes, scale, TREBLE_BASE, keySignature);

    // ── Step C-2: 최종 강박 불협화 안전망 ──
    // counterpoint 보정 후에도 남은 강박 불협화를 직접 보정
    // 음표 onset뿐 아니라 지속 중인 강박 위치도 모두 검사
    {
      const strongOffsets16 = [...getStrongBeatOffsets(timeSignature)];

      // 베이스 타임라인
      const bassTimeline: { start: number; end: number; midi: number }[] = [];
      let bPos = 0;
      for (const bn of bassNotes) {
        const dur = bn.tupletNoteDur ?? durationToSixteenths(bn.duration);
        if (bn.pitch !== 'rest') {
          bassTimeline.push({ start: bPos, end: bPos + dur, midi: noteToMidiWithKey(bn, keySignature) });
        }
        bPos += dur;
      }

      // 트레블 타임라인: 각 음의 시작/끝/인덱스
      const trebleTimeline: { start: number; end: number; idx: number }[] = [];
      let tPos = 0;
      for (let ti = 0; ti < trebleNotes.length; ti++) {
        const dur = trebleNotes[ti].tupletNoteDur ?? durationToSixteenths(trebleNotes[ti].duration);
        if (trebleNotes[ti].pitch !== 'rest') {
          trebleTimeline.push({ start: tPos, end: tPos + dur, idx: ti });
        }
        tPos += dur;
      }

      // 모든 강박 위치를 순회
      const totalSixteenths = measures * sixteenthsPerBar;
      for (let absPos = 0; absPos < totalSixteenths; absPos++) {
        const barOff = absPos % sixteenthsPerBar;
        if (!strongOffsets16.includes(barOff)) continue;

        // 이 위치에서 울리는 트레블 찾기
        const te = trebleTimeline.find(t => t.start <= absPos && t.end > absPos);
        if (!te) continue;
        const tn = trebleNotes[te.idx];

        // 이 위치에서 울리는 베이스 찾기
        const be = bassTimeline.find(b => b.start <= absPos && b.end > absPos);
        if (!be) continue;

        const tMidi = noteToMidiWithKey(tn, keySignature);
        const pc = ((tMidi - be.midi) % 12 + 12) % 12;
        if (!DISSONANT_PC.has(pc)) continue;

        // 불협화 → 가까운 스케일 음으로 교체
        // 이 음이 다른 강박에서도 울리므로, 모든 동시 베이스와 협화하는 음을 선택
        let bestPitch: PitchName = tn.pitch;
        let bestOct = tn.octave;
        let bestDist = Infinity;
        let bestIsImperfect = false;

        for (let oct = tn.octave - 1; oct <= tn.octave + 1; oct++) {
          for (const sp of scale) {
            if (sp === 'rest') continue;
            const cNote = makeNote(sp, oct, tn.duration);
            const cMidi = noteToMidiWithKey(cNote, keySignature);
            if (cMidi <= be.midi) continue;
            const cPc = ((cMidi - be.midi) % 12 + 12) % 12;
            if (DISSONANT_PC.has(cPc)) continue;

            // 이 음이 다른 강박에서도 울릴 때 그 베이스와도 협화해야 함
            let allConsonant = true;
            for (let checkPos = te.start; checkPos < te.end; checkPos++) {
              const checkBarOff = checkPos % sixteenthsPerBar;
              if (!strongOffsets16.includes(checkBarOff)) continue;
              const checkBass = bassTimeline.find(b => b.start <= checkPos && b.end > checkPos);
              if (!checkBass) continue;
              const checkPc = ((cMidi - checkBass.midi) % 12 + 12) % 12;
              if (DISSONANT_PC.has(checkPc)) { allConsonant = false; break; }
            }
            if (!allConsonant) continue;

            const dist = Math.abs(cMidi - tMidi);
            const imperfect = IMPERFECT_CONSONANT_PC.has(cPc);
            if (imperfect && !bestIsImperfect) {
              bestPitch = sp; bestOct = oct; bestDist = dist; bestIsImperfect = true;
            } else if (imperfect === bestIsImperfect && dist < bestDist) {
              bestPitch = sp; bestOct = oct; bestDist = dist;
            }
          }
        }

        if (bestDist < Infinity) {
          trebleNotes[te.idx] = { ...tn, pitch: bestPitch, octave: bestOct, accidental: '' };
        }
      }
    }
  }

  // ── Step C-3: 안전망 후 병진행 재보정 ──
  if (useGrandStaff) {
    applyCounterpointCorrections(trebleNotes, bassNotes, tvTimeSig, keySignature, lvl);

    // ── Step C-4: 최종 임시표 정리 (모든 보정 완료 후) ──
    cleanupBrokenAccidentals(trebleNotes, keySignature, bassNotes);
  }

  // ── 후처리: 내부 쉼표 ──
  applyInternalRests(trebleNotes, bassNotes, difficulty, measures, sixteenthsPerBar, useGrandStaff, timeSignature);

  // ── 후처리: 박자 경계 분할 (중급 2단계 이상에서만) ──
  const finalTreble = lvl >= 5
    ? splitAtBeatBoundaries(trebleNotes, timeSignature)
    : trebleNotes;
  const finalBass = useGrandStaff
    ? (lvl >= 5 ? splitAtBeatBoundaries(bassNotes, timeSignature) : bassNotes)
    : bassNotes;

  // ── 후처리: 연속 붙임줄 2회 제한 — 연속된 2개의 tie 중 마지막 제거 ──
  for (let i = 0; i < finalTreble.length - 1; i++) {
    if (finalTreble[i].tie && finalTreble[i + 1].tie) {
      finalTreble[i + 1] = { ...finalTreble[i + 1], tie: false };
    }
  }
  if (useGrandStaff) {
    for (let i = 0; i < finalBass.length - 1; i++) {
      if (finalBass[i].tie && finalBass[i + 1].tie) {
        finalBass[i + 1] = { ...finalBass[i + 1], tie: false };
      }
    }
  }

  // ── 후처리: 연속 동일음 3회 이상 방지 (안전망) ──
  // 생성 루프의 bypass 경로(해결음·이끔음·임시표·타이)에서 누락된 연속 체크 보완
  fixConsecutiveRepeats(finalTreble, scale, TREBLE_BASE, keySignature);

  // ── 후처리: 단조 대사관계(False Relation) 방지 ──
  // 트레블이 올린 7음(이끔음, e.g. G#)을 쓰는 동시에 베이스가 내린 7음(G♮)을 연주하면
  // 귀에 거슬리는 대사(cross-relation) 발생 → 베이스 음을 근음이나 5음으로 교체
  if (isMinor && useGrandStaff && minorSeventhDeg) {
    fixMinorCrossRelation(finalTreble, finalBass, scale, minorSeventhDeg, minorLeadingAcc, BASS_BASE, keySignature, sixteenthsPerBar);
  }

  if (useGrandStaff) {
    forceGrandStaffFinalTonic(finalTreble, finalBass, scale, TREBLE_BASE, BASS_BASE);
  }

  // ── ★ 최종 검토: 비활성화 (reviewAndFixScore 연쇄 보정이 선율 품질 저하 유발) ──
  // const reviewed = reviewAndFixScore(
  //   finalTreble, finalBass,
  //   keySignature, timeSignature, scale,
  //   useGrandStaff, params.consonanceRatio,
  // );

  // ── 최종 임시표 안전망: 모든 후처리(쉼표·분할·반복음·대사관계) 완료 후 ──
  cleanupBrokenAccidentals(finalTreble, keySignature, finalBass);

  // ── 임시표 난이도(L9): cleanup 이후 최소 2마디 보장 ──
  if (opts.partPracticeLevel === 9 || lvl >= 9) {
    ensureMinAccidentalBars(finalTreble, keySignature, isMinor ? 'harmonic_minor' : 'major', sixteenthsPerBar);
  }

  return { trebleNotes: finalTreble, bassNotes: finalBass };
}

