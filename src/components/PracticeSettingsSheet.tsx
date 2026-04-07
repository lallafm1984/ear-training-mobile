import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { Lock } from 'lucide-react-native';
import BottomSheet from './BottomSheet';
import { COLORS } from '../theme/colors';
import type { PracticeSettings } from '../navigation/MainStack';
import type { PlanTier } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── 옵션 정의 ──

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8'];

// 올림표/내림표 분리: 5도권 순서
const SHARP_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_MAJOR = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const SHARP_MINOR = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
const FLAT_MINOR = ['Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

const TEMPOS: { bpm: number; label: string }[] = [
  { bpm: 60, label: 'Largo' },
  { bpm: 70, label: 'Adagio' },
  { bpm: 80, label: 'Andante' },
  { bpm: 90, label: 'Moderato' },
  { bpm: 100, label: 'Allegretto' },
  { bpm: 110, label: 'Allegro' },
  { bpm: 120, label: 'Vivace' },
];

const KEY_DISPLAY: Record<string, string> = {
  C: 'C', G: 'G', D: 'D', A: 'A', E: 'E', B: 'B', 'F#': 'F#', 'C#': 'C#',
  F: 'F', Bb: 'B♭', Eb: 'E♭', Ab: 'A♭', Db: 'D♭', Gb: 'G♭', Cb: 'C♭',
  Am: 'Am', Em: 'Em', Bm: 'Bm', 'F#m': 'F#m', 'C#m': 'C#m', 'G#m': 'G#m', 'D#m': 'D#m', 'A#m': 'A#m',
  Dm: 'Dm', Gm: 'Gm', Cm: 'Cm', Fm: 'Fm', Bbm: 'B♭m', Ebm: 'E♭m', Abm: 'A♭m',
};

const KEY_ACC_COUNT: Record<string, string> = {
  C: '0', G: '1#', D: '2#', A: '3#', E: '4#', B: '5#', 'F#': '6#', 'C#': '7#',
  F: '1♭', Bb: '2♭', Eb: '3♭', Ab: '4♭', Db: '5♭', Gb: '6♭', Cb: '7♭',
  Am: '0', Em: '1#', Bm: '2#', 'F#m': '3#', 'C#m': '4#', 'G#m': '5#', 'D#m': '6#', 'A#m': '7#',
  Dm: '1♭', Gm: '2♭', Cm: '3♭', Fm: '4♭', Bbm: '5♭', Ebm: '6♭', Abm: '7♭',
};

// Free 사용자 허용 범위
const FREE_TIME_SIGS = ['4/4'];
const FREE_KEY_SIGS = ['C', 'Am'];

interface PracticeSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: PracticeSettings;
  onChangeSettings: (settings: PracticeSettings) => void;
  accentColor: string;
  accentBg: string;
  tier: PlanTier;
  onUpgrade: () => void;
}

export default function PracticeSettingsSheet({
  open, onClose, settings, onChangeSettings, accentColor, accentBg, tier, onUpgrade,
}: PracticeSettingsSheetProps) {
  const isFree = tier === 'free';
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>(
    settings.keySignature.includes('m') ? 'minor' : 'major'
  );

  const update = (patch: Partial<PracticeSettings>) => {
    onChangeSettings({ ...settings, ...patch });
  };

  const isDefault = (field: string, value: string | number) => {
    if (field === 'time') return value === '4/4';
    if (field === 'key') return value === 'C';
    if (field === 'tempo') return value === 80;
    return false;
  };

  const sharpKeys = keyMode === 'major' ? SHARP_MAJOR : SHARP_MINOR;
  const flatKeys = keyMode === 'major' ? FLAT_MAJOR : FLAT_MINOR;

  return (
    <BottomSheet open={open} onClose={onClose} title="연습 설정">
      {/* ── 박자 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>박자</Text>
        <View style={styles.chipRow}>
          {TIME_SIGNATURES.map(t => {
            const active = settings.timeSignature === t;
            const isDef = isDefault('time', t);
            const locked = isFree && !FREE_TIME_SIGS.includes(t);
            return (
              <TouchableOpacity
                key={t}
                onPress={() => locked ? onUpgrade() : update({ timeSignature: t })}
                style={[
                  styles.timeChip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                  locked && { opacity: 0.45 },
                ]}
              >
                {locked && <Lock size={8} color="#94a3b8" style={{ position: 'absolute', top: 3, right: 3 }} />}
                <Text style={[styles.timeChipText, active && { color: '#fff' }]}>
                  {t}
                </Text>
                {isDef && !active && !locked && (
                  <View style={[styles.defaultDot, { backgroundColor: accentColor + '40' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 조성 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>조성</Text>
        {/* 장조/단조 탭 */}
        <View style={styles.keyModeTabRow}>
          <TouchableOpacity
            onPress={() => setKeyMode('major')}
            style={[styles.keyModeTab, keyMode === 'major' && { backgroundColor: accentColor }]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'major' && { color: '#fff' }]}>
              장조
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setKeyMode('minor')}
            style={[styles.keyModeTab, keyMode === 'minor' && { backgroundColor: accentColor }]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'minor' && { color: '#fff' }]}>
              단조
            </Text>
          </TouchableOpacity>
        </View>

        {/* 올림표 계열 */}
        <Text style={styles.keyGroupLabel}>
          {sharpKeys[0] === 'C' || sharpKeys[0] === 'Am' ? '기본 / 올림표 (#)' : '올림표 (#)'}
        </Text>
        <View style={styles.keyGrid}>
          {sharpKeys.map(k => {
            const active = settings.keySignature === k;
            const acc = KEY_ACC_COUNT[k] ?? '';
            const locked = isFree && !FREE_KEY_SIGS.includes(k);
            return (
              <TouchableOpacity
                key={k}
                onPress={() => locked ? onUpgrade() : update({ keySignature: k })}
                style={[
                  styles.keyChip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                  locked && { opacity: 0.45 },
                ]}
              >
                {locked && <Lock size={7} color="#94a3b8" style={{ position: 'absolute', top: 2, right: 2 }} />}
                <Text style={[styles.keyChipMain, active && { color: '#fff' }]}>
                  {KEY_DISPLAY[k] ?? k}
                </Text>
                {acc !== '0' ? (
                  <Text style={[styles.keyChipSub, active && { color: 'rgba(255,255,255,0.6)' }]}>{acc}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 내림표 계열 */}
        <Text style={[styles.keyGroupLabel, { marginTop: 5 }]}>내림표 (♭)</Text>
        <View style={styles.keyGrid}>
          {flatKeys.map(k => {
            const active = settings.keySignature === k;
            const acc = KEY_ACC_COUNT[k] ?? '';
            const locked = isFree && !FREE_KEY_SIGS.includes(k);
            return (
              <TouchableOpacity
                key={k}
                onPress={() => locked ? onUpgrade() : update({ keySignature: k })}
                style={[
                  styles.keyChip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                  locked && { opacity: 0.45 },
                ]}
              >
                {locked && <Lock size={7} color="#94a3b8" style={{ position: 'absolute', top: 2, right: 2 }} />}
                <Text style={[styles.keyChipMain, active && { color: '#fff' }]}>
                  {KEY_DISPLAY[k] ?? k}
                </Text>
                <Text style={[styles.keyChipSub, active && { color: 'rgba(255,255,255,0.6)' }]}>{acc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 빠르기 ── */}
      <View style={[styles.section, { marginBottom: 0 }]}>
        <Text style={styles.sectionLabel}>빠르기 (BPM)</Text>
        <View style={styles.tempoRow}>
          {TEMPOS.map(({ bpm }) => {
            const active = settings.tempo === bpm;
            const isDef = isDefault('tempo', bpm);
            return (
              <TouchableOpacity
                key={bpm}
                onPress={() => update({ tempo: bpm })}
                style={[
                  styles.tempoChip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.tempoText, active && { color: '#fff' }]}>
                  {bpm}
                </Text>
                {isDef && !active && (
                  <View style={[styles.defaultDot, { backgroundColor: accentColor + '40' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

// ── 치수 ──
const SIDE_PAD = 16;
const KEY_COLS = 5;
const KEY_GAP = 4;
const KEY_CHIP_W = (SCREEN_WIDTH - SIDE_PAD * 2 - KEY_GAP * (KEY_COLS - 1)) / KEY_COLS;

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate700,
    marginBottom: 6,
  },

  // 박자 칩
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    alignItems: 'center',
    position: 'relative',
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate600,
  },
  defaultDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // 조성 탭
  keyModeTabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.slate100,
    borderRadius: 8,
    padding: 2,
    marginBottom: 6,
    gap: 2,
  },
  keyModeTab: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  keyModeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate400,
  },

  // 조성 그리드
  keyGroupLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slate400,
    marginBottom: 3,
    marginLeft: 2,
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: KEY_GAP,
  },
  keyChip: {
    width: KEY_CHIP_W,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyChipMain: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate800,
  },
  keyChipSub: {
    fontSize: 8,
    color: COLORS.slate400,
    marginTop: 0,
  },

  // 빠르기
  tempoRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tempoChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    alignItems: 'center',
    position: 'relative',
  },
  tempoText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate600,
  },
});
