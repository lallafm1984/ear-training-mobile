import { useState } from 'react';
import type {
  PlaybackMode, APExamSettings, KoreanExamSettings, EchoSettings, CustomPlaySettings,
} from '../../types';
import {
  DEFAULT_AP_SETTINGS, DEFAULT_KOREAN_SETTINGS,
  DEFAULT_ECHO_SETTINGS, DEFAULT_CUSTOM_SETTINGS,
  DEFAULT_PRACTICE_WAIT_SECONDS,
} from '../../types';

export function usePlaybackConfig() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode | null>(null);
  const [prependBasePitch, setPrependBasePitch] = useState(false);
  const [prependMetronome, setPrependMetronome] = useState(false);
  const [scaleTempo, setScaleTempo] = useState(80);
  const [metronomeFreq, setMetronomeFreq] = useState(1000);
  const [examMode, setExamMode] = useState(false);
  const [examWaitSeconds, setExamWaitSeconds] = useState(DEFAULT_PRACTICE_WAIT_SECONDS);
  const [showNoteCursor, setShowNoteCursor] = useState(true);
  const [showMeasureHighlight, setShowMeasureHighlight] = useState(true);
  const [hideNotes, setHideNotes] = useState(false);
  const [apExamSettings, setApExamSettings] = useState<APExamSettings>({ ...DEFAULT_AP_SETTINGS });
  const [koreanExamSettings, setKoreanExamSettings] = useState<KoreanExamSettings>({ ...DEFAULT_KOREAN_SETTINGS });
  const [echoSettings, setEchoSettings] = useState<EchoSettings>({ ...DEFAULT_ECHO_SETTINGS });
  const [customPlaySettings, setCustomPlaySettings] = useState<CustomPlaySettings>({ ...DEFAULT_CUSTOM_SETTINGS });

  return {
    isPlaying, setIsPlaying,
    playbackMode, setPlaybackMode,
    prependBasePitch, setPrependBasePitch,
    prependMetronome, setPrependMetronome,
    scaleTempo, setScaleTempo,
    metronomeFreq, setMetronomeFreq,
    examMode, setExamMode,
    examWaitSeconds, setExamWaitSeconds,
    showNoteCursor, setShowNoteCursor,
    showMeasureHighlight, setShowMeasureHighlight,
    hideNotes, setHideNotes,
    apExamSettings, setApExamSettings,
    koreanExamSettings, setKoreanExamSettings,
    echoSettings, setEchoSettings,
    customPlaySettings, setCustomPlaySettings,
  };
}

export type PlaybackConfigState = ReturnType<typeof usePlaybackConfig>;
