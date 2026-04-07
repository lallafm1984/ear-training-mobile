import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import BottomSheet from './BottomSheet';
import type { PracticeSettings } from '../navigation/MainStack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8'];

const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

const TEMPOS = [60, 70, 80, 90, 100, 110, 120];

const KEY_DISPLAY: Record<string, string> = {
  C: 'C', G: 'G', D: 'D', A: 'A', E: 'E', B: 'B', 'F#': 'F#', 'C#': 'C#',
  F: 'F', Bb: 'B♭', Eb: 'E♭', Ab: 'A♭', Db: 'D♭', Gb: 'G♭', Cb: 'C♭',
  Am: 'Am', Em: 'Em', Bm: 'Bm', 'F#m': 'F#m', 'C#m': 'C#m', 'G#m': 'G#m', 'D#m': 'D#m', 'A#m': 'A#m',
  Dm: 'Dm', Gm: 'Gm', Cm: 'Cm', Fm: 'Fm', Bbm: 'B♭m', Ebm: 'E♭m', Abm: 'A♭m',
};

const KEY_ACCIDENTAL: Record<string, string> = {
  C: '', G: '#1', D: '#2', A: '#3', E: '#4', B: '#5', 'F#': '#6', 'C#': '#7',
  F: '♭1', Bb: '♭2', Eb: '♭3', Ab: '♭4', Db: '♭5', Gb: '♭6', Cb: '♭7',
  Am: '', Em: '#1', Bm: '#2', 'F#m': '#3', 'C#m': '#4', 'G#m': '#5', 'D#m': '#6', 'A#m': '#7',
  Dm: '♭1', Gm: '♭2', Cm: '♭3', Fm: '♭4', Bbm: '♭5', Ebm: '♭6', Abm: '♭7',
};

interface PracticeSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: PracticeSettings;
  onChangeSettings: (settings: PracticeSettings) => void;
  accentColor: string;
  accentBg: string;
}

export default function PracticeSettingsSheet({
  open, onClose, settings, onChangeSettings, accentColor, accentBg,
}: PracticeSettingsSheetProps) {
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>(
    settings.keySignature.includes('m') ? 'minor' : 'major'
  );

  const update = (patch: Partial<PracticeSettings>) => {
    onChangeSettings({ ...settings, ...patch });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="연습 설정">
      {/* 박자 */}
      <View style={styles.group}>
        <Text style={styles.label}>박자</Text>
        <View style={styles.chipRow}>
          {TIME_SIGNATURES.map(t => {
            const active = settings.timeSignature === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => update({ timeSignature: t })}
                style={[
                  styles.chip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 조성 */}
      <View style={styles.group}>
        <Text style={styles.label}>조성</Text>
        <View style={styles.keyModeTabRow}>
          <TouchableOpacity
            onPress={() => setKeyMode('major')}
            style={[styles.keyModeTab, keyMode === 'major' && styles.keyModeTabActive]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'major' && styles.keyModeTabTextActive]}>
              장조 (Major)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setKeyMode('minor')}
            style={[styles.keyModeTab, keyMode === 'minor' && styles.keyModeTabActive]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'minor' && styles.keyModeTabTextActive]}>
              단조 (Minor)
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.keyGrid}>
          {(keyMode === 'major' ? MAJOR_KEYS : MINOR_KEYS).map(k => {
            const active = settings.keySignature === k;
            const acc = KEY_ACCIDENTAL[k] ?? '';
            return (
              <TouchableOpacity
                key={k}
                onPress={() => update({ keySignature: k })}
                style={[
                  styles.keyChip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.keyChipMain, active && { color: '#fff' }]}>
                  {KEY_DISPLAY[k] ?? k}
                </Text>
                {acc ? (
                  <Text style={[styles.keyChipSub, active && { color: '#c7d2fe' }]}>{acc}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 빠르기 */}
      <View style={styles.group}>
        <Text style={styles.label}>빠르기 (BPM)</Text>
        <View style={styles.chipRow}>
          {TEMPOS.map(bpm => {
            const active = settings.tempo === bpm;
            return (
              <TouchableOpacity
                key={bpm}
                onPress={() => update({ tempo: bpm })}
                style={[
                  styles.chip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>
                  {bpm}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 10 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '700', color: '#475569' },

  keyModeTabRow: {
    flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8,
    padding: 2, marginBottom: 8,
  },
  keyModeTab: {
    flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
  },
  keyModeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  keyModeTabText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  keyModeTabTextActive: { color: '#1e293b' },

  keyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  keyChip: {
    width: (SCREEN_WIDTH - 32 - 5 * 4) / 5,
    paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  keyChipMain: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  keyChipSub: { fontSize: 8, color: '#94a3b8', marginTop: 0 },
});
