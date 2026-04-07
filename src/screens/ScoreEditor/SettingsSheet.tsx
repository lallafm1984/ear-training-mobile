import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Lock } from 'lucide-react-native';
import BottomSheet from '../../components/BottomSheet';
import type { ScoreState } from '../../lib';
import type { UpgradeReason } from '../../components';
import {
  TIME_SIGNATURES, MAJOR_KEYS, MINOR_KEYS, KEY_ACCIDENTAL,
} from './constants';
import type { PlanLimits } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  state: ScoreState;
  setState: React.Dispatch<React.SetStateAction<ScoreState>>;
  limits: PlanLimits;
  openUpgrade: (reason: UpgradeReason) => void;
}

export default function SettingsSheet({
  open,
  onClose,
  state,
  setState,
  limits,
  openUpgrade,
}: SettingsSheetProps) {
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>('major');

  return (
    <BottomSheet open={open} onClose={onClose} title="악보 설정">
      {/* 제목 */}
      <View style={styles.bsGroup}>
        <Text style={styles.bsLabel}>악보 제목</Text>
        <TextInput
          style={styles.bsInput}
          value={state.title}
          onChangeText={t => setState(p => ({ ...p, title: t }))}
          placeholder="제목을 입력하세요"
          placeholderTextColor="#cbd5e1"
        />
      </View>

      {/* 박자 */}
      <View style={styles.bsGroup}>
        <Text style={styles.bsLabel}>박자</Text>
        <View style={styles.settingsChipRow}>
          {TIME_SIGNATURES.map(t => {
            const allowed = limits.allowedTimeSignatures.includes(t);
            return (
              <TouchableOpacity
                key={t}
                onPress={() => {
                  if (!allowed) { onClose(); openUpgrade('time_signature'); return; }
                  setState(p => ({ ...p, timeSignature: t }));
                }}
                style={[styles.settingsChip, state.timeSignature === t && styles.settingsChipActive, !allowed && { opacity: 0.45 }]}
              >
                {!allowed && <Lock size={8} color="#94a3b8" style={{ marginRight: 2 }} />}
                <Text style={[styles.settingsChipText, state.timeSignature === t && styles.settingsChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* BPM */}
      <View style={styles.bsGroup}>
        <Text style={styles.bsLabel}>빠르기 (BPM)</Text>
        <View style={styles.settingsBpmRow}>
          <TouchableOpacity
            onPress={() => setState(p => ({ ...p, tempo: Math.max(40, (p.tempo || 80) - 5) }))}
            style={styles.bpmStepBtn}
          >
            <Text style={styles.bpmStepBtnText}>－</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.bpmInput}
            keyboardType="number-pad"
            value={state.tempo === 0 ? '' : String(state.tempo)}
            onChangeText={t => {
              if (t === '') { setState(p => ({ ...p, tempo: 0 })); return; }
              const n = parseInt(t);
              if (!isNaN(n)) setState(p => ({ ...p, tempo: n }));
            }}
            onEndEditing={() => setState(p => ({ ...p, tempo: Math.max(40, p.tempo || 80) }))}
          />
          <TouchableOpacity
            onPress={() => setState(p => ({ ...p, tempo: Math.min(240, (p.tempo || 80) + 5) }))}
            style={styles.bpmStepBtn}
          >
            <Text style={styles.bpmStepBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 조성 */}
      <View style={styles.bsGroup}>
        <Text style={styles.bsLabel}>조성</Text>
        {/* 장조/단조 탭 */}
        <View style={styles.keyModeTabRow}>
          <TouchableOpacity
            onPress={() => setKeyMode('major')}
            style={[styles.keyModeTab, keyMode === 'major' && styles.keyModeTabActive]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'major' && styles.keyModeTabTextActive]}>장조 (Major)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setKeyMode('minor')}
            style={[styles.keyModeTab, keyMode === 'minor' && styles.keyModeTabActive]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'minor' && styles.keyModeTabTextActive]}>단조 (Minor)</Text>
          </TouchableOpacity>
        </View>
        {/* 조성 그리드 */}
        <View style={styles.keyGrid}>
          {(keyMode === 'major' ? MAJOR_KEYS : MINOR_KEYS).map(k => {
            const isActive = state.keySignature === k;
            const acc = KEY_ACCIDENTAL[k] ?? '';
            const allowed = limits.allowedKeySignatures.includes(k);
            return (
              <TouchableOpacity
                key={k}
                onPress={() => {
                  if (!allowed) { onClose(); openUpgrade('key_signature'); return; }
                  setState(p => ({ ...p, keySignature: k }));
                }}
                style={[styles.keyChip, isActive && styles.keyChipActive, !allowed && { opacity: 0.45 }]}
              >
                {!allowed && <Lock size={7} color="#94a3b8" style={{ position: 'absolute', top: 3, right: 3 }} />}
                <Text style={[styles.keyChipMain, isActive && styles.keyChipMainActive]}>{k}</Text>
                {acc ? <Text style={[styles.keyChipSub, isActive && { color: '#c7d2fe' }]}>{acc}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bsGroup: { marginBottom: 10 },
  bsLabel: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4 },
  bsInput: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#1e293b',
  },

  settingsChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  settingsChip: {
    width: (SCREEN_WIDTH - 32 - 8 * 3) / 4,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  settingsChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  settingsChipText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  settingsChipTextActive: { color: '#ffffff' },

  settingsBpmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, overflow: 'hidden',
  },
  bpmStepBtn: {
    width: 48, height: 48, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  bpmStepBtnText: { fontSize: 20, fontWeight: '600', color: '#475569' },
  bpmInput: {
    flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1e293b',
    paddingVertical: 10,
  },

  keyModeTabRow: {
    flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8,
    padding: 2, marginBottom: 8,
  },
  keyModeTab: {
    flex: 1, paddingVertical: 6, borderRadius: 6,
    alignItems: 'center',
  },
  keyModeTabActive: {
    backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 4, elevation: 2,
  },
  keyModeTabText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  keyModeTabTextActive: { color: '#1e293b' },

  keyGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
  },
  keyChip: {
    width: (SCREEN_WIDTH - 32 - 5 * 5) / 6,
    paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  keyChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  keyChipMain: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  keyChipMainActive: { color: '#ffffff' },
  keyChipSub: { fontSize: 8, color: '#94a3b8', marginTop: 0 },
});
