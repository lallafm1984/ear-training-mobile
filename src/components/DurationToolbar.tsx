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
  onClear?: () => void;
  accentColor: string;
  tripletMode?: boolean;
  onToggleTriplet?: () => void;
}

const DURATION_BUTTONS: { dur: NoteDuration; icon: string; label: string }[] = [
  { dur: '1', icon: 'music-note-whole', label: '온음표' },
  { dur: '2', icon: 'music-note-half', label: '2분음표' },
  { dur: '4', icon: 'music-note-quarter', label: '4분음표' },
  { dur: '8', icon: 'music-note-eighth', label: '8분음표' },
  { dur: '16', icon: 'music-note-sixteenth', label: '16분음표' },
];

const REST_ICON_MAP: Record<string, string> = {
  '1':   'music-rest-whole',
  '2':   'music-rest-half',
  '2.':  'music-rest-half',       // 점2분쉼표 (전용 아이콘 없어 기본 사용)
  '4':   'music-rest-quarter',
  '4.':  'music-rest-quarter',    // 점4분쉼표
  '8':   'music-rest-eighth',
  '8.':  'music-rest-eighth',     // 점8분쉼표
  '16':  'music-rest-sixteenth',
};

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
  tripletMode,
  onToggleTriplet,
}: DurationToolbarProps) {
  const isSelected = (dur: NoteDuration) => selectedDuration === dur;

  const effectiveDurKey = isDotted ? `${selectedDuration}.` : selectedDuration;
  const restIcon = REST_ICON_MAP[effectiveDurKey] ?? REST_ICON_MAP[selectedDuration] ?? 'music-rest-quarter';

  return (
    <View style={styles.container}>
      {/* Row 1 — 음표 버튼 + 점 + 쉼표 (중앙정렬) */}
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
                size={20}
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

        {/* Rest — 선택된 음표 길이+점 기준 쉼표, 차별 색상 */}
        <TouchableOpacity
          style={[
            styles.durationBtn,
            {
              borderColor: isDotted ? '#f59e0b80' : '#f59e0b40',
              backgroundColor: isDotted ? '#fef3c7' : '#fffbeb',
            },
          ]}
          onPress={onAddRest}
          accessibilityLabel="쉼표"
        >
          <MaterialCommunityIcons
            name={restIcon as any}
            size={20}
            color="#d97706"
          />
          {isDotted && (
            <Text style={{ position: 'absolute', top: '25%', right: 3, fontSize: 16, fontWeight: '900', color: '#d97706', lineHeight: 16 }}>•</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Row 2 — 도구 버튼 (중앙정렬) */}
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

        {/* Triplet */}
        {onToggleTriplet && (
          <TouchableOpacity
            style={[styles.toolBtn, tripletMode && styles.toolBtnActive]}
            onPress={onToggleTriplet}
            accessibilityLabel="셋잇단음표"
          >
            <MaterialCommunityIcons
              name="numeric-3-circle-outline"
              size={14}
              color={tripletMode ? '#fff' : COLORS.slate600}
            />
            <Text style={[styles.toolBtnText, tripletMode && styles.toolBtnTextActive, { marginLeft: 2 }]}>셋잇단</Text>
          </TouchableOpacity>
        )}

        {/* Clear — only when provided */}
        {onClear && (
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={onClear}
            accessibilityLabel="전체 지우기"
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={14}
              color={COLORS.slate600}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.slate200,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate600,
  },
  disabled: {
    opacity: 0.3,
  },
  toolBtn: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: COLORS.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: COLORS.slate700,
  },
  toolBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate600,
  },
  toolBtnTextActive: {
    color: '#fff',
  },
});
