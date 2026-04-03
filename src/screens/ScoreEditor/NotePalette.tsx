import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Undo, Trash2, ChevronDown } from 'lucide-react-native';
import type { ScoreNote, NoteDuration, Accidental, PitchName, TupletType } from '../../lib';
import { getValidTupletTypesForDuration } from '../../lib';
import { DURATIONS, ACCIDENTALS, PITCHES, PITCH_LABELS, PITCH_STYLES } from './constants';
import { styles } from './styles';

interface NotePaletteProps {
  selectedNote: { id: string; staff: 'treble' | 'bass' } | null;
  selectedNoteObj: ScoreNote | null | undefined;
  curNotesLength: number;
  canEditNotes: boolean;
  // Note editing params
  duration: NoteDuration;
  accidental: Accidental;
  octave: number;
  tie: boolean;
  tuplet: TupletType;
  // Sub menu
  mobileSubMenu: 'duration' | 'accidental' | 'octave' | 'tie' | 'tuplet' | null;
  setMobileSubMenu: (m: 'duration' | 'accidental' | 'octave' | 'tie' | 'tuplet' | null) => void;
  // Handlers
  onBaseDurationClick: (base: NoteDuration) => void;
  onDotToggle: () => void;
  onAccidentalChange: (acc: Accidental) => void;
  onOctaveChange: (oct: number) => void;
  onTieToggle: () => void;
  onTupletChange: (t: TupletType) => void;
  onAddNote: (pitch: PitchName) => void;
  onUndo: () => void;
  onDelete: () => void;
  // Derived
  baseDur: NoteDuration;
  hasDot: boolean;
  dotDisabled: boolean;
}

const TUPLET_LABELS: Record<TupletType, string> = {
  '': '없음',
  '2': '2연',
  '3': '3연',
  '4': '4연',
  '5': '5연',
  '6': '6연',
  '7': '7연',
  '8': '8연',
};

const NotePalette: React.FC<NotePaletteProps> = ({
  selectedNote,
  selectedNoteObj,
  curNotesLength,
  canEditNotes,
  duration,
  accidental,
  octave,
  tie,
  tuplet,
  mobileSubMenu,
  setMobileSubMenu,
  onBaseDurationClick,
  onDotToggle,
  onAccidentalChange,
  onOctaveChange,
  onTieToggle,
  onTupletChange,
  onAddNote,
  onUndo,
  onDelete,
  baseDur,
  hasDot,
  dotDisabled,
}) => {
  if (!selectedNote) return null;

  return (
    <>
      {/* 1. Tuplet sub-menu */}
      {mobileSubMenu === 'tuplet' && (
        <View style={styles.subMenuContainer}>
          {(() => {
            const valid = getValidTupletTypesForDuration(duration);
            const withCurrent = tuplet && !valid.includes(tuplet) ? [...valid, tuplet] : valid;
            const options: [TupletType, string][] = [
              ['', '없음'],
              ...withCurrent.map(
                (t) => [t, TUPLET_LABELS[t] || `${t}연`] as [TupletType, string],
              ),
            ];
            return options.map(([v, l]) => (
              <TouchableOpacity
                key={v}
                onPress={() => {
                  onTupletChange(v);
                  setMobileSubMenu(null);
                }}
                style={[
                  styles.subMenuChip,
                  {
                    backgroundColor: tuplet === v ? '#f59e0b' : '#ffffff',
                    borderWidth: tuplet === v ? 0 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.subMenuChipText,
                    { color: tuplet === v ? '#ffffff' : '#1e293b' },
                  ]}
                >
                  {l}
                </Text>
              </TouchableOpacity>
            ));
          })()}
        </View>
      )}

      {/* 2. Accidental sub-menu */}
      {mobileSubMenu === 'accidental' && (
        <View style={styles.subMenuContainer}>
          {ACCIDENTALS.map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={() => {
                onAccidentalChange(a.value);
                setMobileSubMenu(null);
              }}
              style={[
                styles.subMenuChip,
                {
                  flex: 1,
                  backgroundColor: accidental === a.value ? '#ef4444' : '#ffffff',
                  borderWidth: accidental === a.value ? 0 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.subMenuChipText,
                  { color: accidental === a.value ? '#ffffff' : '#1e293b' },
                ]}
              >
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Row 1: Edit buttons (undo, delete) */}
      <View style={styles.paletteRow1}>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
          {canEditNotes && (
            <>
              <TouchableOpacity
                onPress={onUndo}
                style={[styles.iconButton, { opacity: curNotesLength === 0 ? 0.3 : 1 }]}
                disabled={curNotesLength === 0}
              >
                <Undo size={13} color="#1e293b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDelete}
                style={[styles.iconButton, { backgroundColor: '#fef2f2' }]}
              >
                <Trash2 size={13} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Row 2: Octave controls, accidental dropdown, Tie toggle, tuplet dropdown */}
      <View style={styles.paletteRow2}>
        <TouchableOpacity
          onPress={() => onOctaveChange(Math.max(2, octave - 1))}
          style={styles.octaveBtn}
        >
          <Text style={styles.octaveBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.octaveText}>Oct{octave}</Text>
        <TouchableOpacity
          onPress={() => onOctaveChange(Math.min(6, octave + 1))}
          style={styles.octaveBtn}
        >
          <Text style={styles.octaveBtnText}>+</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          onPress={() =>
            setMobileSubMenu(mobileSubMenu === 'accidental' ? null : 'accidental')
          }
          style={[
            styles.optionChip,
            {
              backgroundColor:
                mobileSubMenu === 'accidental'
                  ? '#ef4444'
                  : accidental
                    ? '#fef2f2'
                    : '#f8fafc',
              borderWidth: mobileSubMenu === 'accidental' || accidental ? 0 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.optionChipText,
              {
                color:
                  mobileSubMenu === 'accidental'
                    ? '#fff'
                    : accidental
                      ? '#ef4444'
                      : '#1e293b',
              },
            ]}
          >
            {accidental === '#'
              ? '\u266F'
              : accidental === 'b'
                ? '\u266D'
                : accidental === 'n'
                  ? '\u266E'
                  : '변화표'}
          </Text>
          <ChevronDown
            size={9}
            color={
              mobileSubMenu === 'accidental'
                ? '#fff'
                : accidental
                  ? '#ef4444'
                  : '#1e293b'
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onTieToggle}
          style={[
            styles.optionChip,
            {
              backgroundColor: tie ? '#6366f1' : '#f8fafc',
              borderWidth: tie ? 0 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.optionChipText,
              { color: tie ? '#fff' : '#1e293b' },
            ]}
          >
            Tie{tie ? '\u2713' : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            setMobileSubMenu(mobileSubMenu === 'tuplet' ? null : 'tuplet')
          }
          style={[
            styles.optionChip,
            {
              backgroundColor:
                mobileSubMenu === 'tuplet'
                  ? '#f59e0b'
                  : tuplet
                    ? '#FEF3C7'
                    : '#f8fafc',
              borderWidth: mobileSubMenu === 'tuplet' || tuplet ? 0 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.optionChipText,
              {
                color:
                  mobileSubMenu === 'tuplet'
                    ? '#fff'
                    : tuplet
                      ? '#92400e'
                      : '#1e293b',
              },
            ]}
          >
            {tuplet ? `${tuplet}연` : '잇단음'}
          </Text>
          <ChevronDown
            size={9}
            color={
              mobileSubMenu === 'tuplet'
                ? '#fff'
                : tuplet
                  ? '#92400e'
                  : '#1e293b'
            }
          />
        </TouchableOpacity>
      </View>

      {/* Row 3: Duration buttons + dot toggle */}
      <View style={styles.paletteRow3}>
        {DURATIONS.map((d) => (
          <TouchableOpacity
            key={d.value}
            onPress={() => onBaseDurationClick(d.value)}
            style={[
              styles.durBtn,
              {
                backgroundColor: baseDur === d.value ? '#6366f1' : '#f8fafc',
                borderWidth: baseDur === d.value ? 0 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.durBtnText,
                { color: baseDur === d.value ? '#fff' : '#1e293b' },
              ]}
            >
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={onDotToggle}
          disabled={dotDisabled}
          style={[
            styles.durBtn,
            {
              backgroundColor: hasDot ? '#ef4444' : '#f8fafc',
              borderWidth: hasDot ? 0 : 1,
              opacity: dotDisabled ? 0.4 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.durBtnText,
              { color: hasDot ? '#fff' : dotDisabled ? '#cbd5e1' : '#1e293b' },
            ]}
          >
            점·
          </Text>
        </TouchableOpacity>
      </View>

      {/* Row 4: Pitch buttons (C D E F G A B + rest) */}
      <View style={styles.paletteRow4}>
        {PITCHES.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => onAddNote(p)}
            style={[
              styles.pitchBtn,
              {
                backgroundColor: PITCH_STYLES[p].bg,
                borderColor:
                  selectedNoteObj?.pitch === p
                    ? '#fbbf24'
                    : PITCH_STYLES[p].border,
              },
            ]}
          >
            <Text style={[styles.pitchBtnText, { color: PITCH_STYLES[p].text }]}>
              {p}
            </Text>
            <Text style={[styles.pitchBtnSubText, { color: PITCH_STYLES[p].text }]}>
              {PITCH_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => onAddNote('rest' as PitchName)}
          style={[
            styles.pitchBtn,
            { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
          ]}
        >
          <Text style={[styles.pitchBtnText, { color: '#94a3b8', fontSize: 11 }]}>
            쉼표
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default NotePalette;
