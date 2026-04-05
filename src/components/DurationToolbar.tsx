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

const DURATION_BUTTONS: { dur: NoteDuration; icon: string; label: string }[] = [
  { dur: '1', icon: 'music-note-whole', label: '온음표' },
  { dur: '2', icon: 'music-note-half', label: '2분음표' },
  { dur: '4', icon: 'music-note-quarter', label: '4분음표' },
  { dur: '8', icon: 'music-note-eighth', label: '8분음표' },
  { dur: '16', icon: 'music-note-sixteenth', label: '16분음표' },
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
  const isSelected = (dur: NoteDuration) => selectedDuration === dur;

  return (
    <View style={styles.container}>
      {/* Row 1 — Duration buttons */}
      <View style={styles.row}>
        {DURATION_BUTTONS.map(({ dur, icon, label }) => {
          const selected = isSelected(dur);
          const disabled = !canAddDuration(dur);
          return (
            <TouchableOpacity
              key={dur}
              style={[
                styles.durationBtn,
                selected && {
                  backgroundColor: accentColor + '20',
                  borderColor: accentColor,
                },
                disabled && styles.disabled,
              ]}
              disabled={disabled}
              onPress={() => onDurationSelect(dur)}
              accessibilityLabel={label}
            >
              <MaterialCommunityIcons
                name={icon as any}
                size={22}
                color={selected ? accentColor : COLORS.slate600}
              />
            </TouchableOpacity>
          );
        })}

        {/* Dot toggle */}
        <TouchableOpacity
          style={[
            styles.durationBtn,
            isDotted && {
              backgroundColor: accentColor + '20',
              borderColor: accentColor,
            },
          ]}
          onPress={onToggleDot}
          accessibilityLabel="점음표 토글"
        >
          <Text
            style={[
              styles.durationBtnText,
              { color: isDotted ? accentColor : COLORS.slate600 },
            ]}
          >
            점
          </Text>
        </TouchableOpacity>
      </View>

      {/* Row 2 — Tool buttons */}
      <View style={styles.row}>
        {/* Sharp */}
        <TouchableOpacity
          style={[
            styles.toolBtn,
            accidentalMode === '#' && styles.toolBtnActive,
          ]}
          onPress={() => onAccidentalMode(accidentalMode === '#' ? null : '#')}
          accessibilityLabel="올림표"
        >
          <Text
            style={[
              styles.toolBtnText,
              accidentalMode === '#' && styles.toolBtnTextActive,
            ]}
          >
            ♯
          </Text>
        </TouchableOpacity>

        {/* Flat */}
        <TouchableOpacity
          style={[
            styles.toolBtn,
            accidentalMode === 'b' && styles.toolBtnActive,
          ]}
          onPress={() => onAccidentalMode(accidentalMode === 'b' ? null : 'b')}
          accessibilityLabel="내림표"
        >
          <Text
            style={[
              styles.toolBtnText,
              accidentalMode === 'b' && styles.toolBtnTextActive,
            ]}
          >
            ♭
          </Text>
        </TouchableOpacity>

        {/* Tie */}
        <TouchableOpacity
          style={[styles.toolBtn, tieMode && styles.toolBtnActive]}
          onPress={onToggleTie}
          accessibilityLabel="붙임줄"
        >
          <Text
            style={[
              styles.toolBtnText,
              tieMode && styles.toolBtnTextActive,
            ]}
          >
            ⌒
          </Text>
        </TouchableOpacity>

        {/* Rest */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={onAddRest}
          accessibilityLabel="쉼표"
        >
          <MaterialCommunityIcons
            name="music-rest-quarter"
            size={16}
            color={COLORS.slate600}
          />
          <Text style={[styles.toolBtnText, { marginLeft: 2 }]}>쉼표</Text>
        </TouchableOpacity>

        {/* Undo */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={onUndo}
          accessibilityLabel="되돌리기"
        >
          <MaterialCommunityIcons
            name="undo"
            size={16}
            color={COLORS.slate600}
          />
        </TouchableOpacity>

        {/* Clear */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={onClear}
          accessibilityLabel="전체 지우기"
        >
          <MaterialCommunityIcons
            name="delete-outline"
            size={16}
            color={COLORS.slate600}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  durationBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.slate600,
  },
  disabled: {
    opacity: 0.3,
  },
  toolBtn: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: COLORS.slate700,
  },
  toolBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slate600,
  },
  toolBtnTextActive: {
    color: '#fff',
  },
});
