import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import type { PitchName, Accidental } from '../lib/scoreUtils';

interface PianoKeyboardProps {
  onKeyPress: (pitch: PitchName, octave: number, accidental: Accidental) => void;
  accentColor: string;
  initialOctave?: number;
}

const WHITE_KEY_WIDTH = 36;
const WHITE_KEY_HEIGHT = 100;
const WHITE_KEY_GAP = 1;
const BLACK_KEY_WIDTH = 24;
const BLACK_KEY_HEIGHT = 62;

const WHITE_NOTES: PitchName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTE_INDICES = [0, 1, 3, 4, 5]; // C#, D#, F#, G#, A#
const BLACK_NOTE_NAMES: PitchName[] = ['C', 'D', 'F', 'G', 'A'];

const OCTAVES = [3, 4, 5];

export default function PianoKeyboard({
  onKeyPress,
  accentColor,
  initialOctave = 4,
}: PianoKeyboardProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const octaveIndex = OCTAVES.indexOf(initialOctave);
    if (octaveIndex >= 0) {
      const scrollX = octaveIndex * 7 * (WHITE_KEY_WIDTH + WHITE_KEY_GAP * 2);
      scrollRef.current?.scrollTo({ x: scrollX, animated: false });
    }
  }, [initialOctave]);

  const whiteKeys: { pitch: PitchName; octave: number }[] = [];
  for (const oct of OCTAVES) {
    for (const note of WHITE_NOTES) {
      whiteKeys.push({ pitch: note, octave: oct });
    }
  }
  // Final C6
  whiteKeys.push({ pitch: 'C', octave: 6 });

  const blackKeys: { pitch: PitchName; octave: number; whiteIndex: number }[] = [];
  for (let oi = 0; oi < OCTAVES.length; oi++) {
    const oct = OCTAVES[oi];
    for (let bi = 0; bi < BLACK_NOTE_INDICES.length; bi++) {
      const whiteIndex = oi * 7 + BLACK_NOTE_INDICES[bi];
      blackKeys.push({ pitch: BLACK_NOTE_NAMES[bi], octave: oct, whiteIndex });
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.keysWrapper}>
          {/* White keys */}
          {whiteKeys.map((key, index) => (
            <TouchableOpacity
              key={`white-${key.pitch}${key.octave}`}
              style={styles.whiteKey}
              activeOpacity={0.7}
              onPress={() => onKeyPress(key.pitch, key.octave, '')}
            >
              <Text style={styles.whiteKeyLabel}>
                {key.pitch}{key.octave}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Black keys */}
          {blackKeys.map((key) => {
            const left =
              key.whiteIndex * (WHITE_KEY_WIDTH + WHITE_KEY_GAP * 2) +
              WHITE_KEY_WIDTH -
              BLACK_KEY_WIDTH / 2 +
              WHITE_KEY_GAP;
            return (
              <TouchableOpacity
                key={`black-${key.pitch}#${key.octave}`}
                style={[styles.blackKey, { left }]}
                activeOpacity={0.7}
                onPress={() => onKeyPress(key.pitch, key.octave, '#')}
              >
                <Text style={styles.blackKeyLabel}>
                  {key.pitch}#{key.octave}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  keysWrapper: {
    position: 'relative',
    flexDirection: 'row',
    height: WHITE_KEY_HEIGHT,
  },
  whiteKey: {
    width: WHITE_KEY_WIDTH,
    height: WHITE_KEY_HEIGHT,
    backgroundColor: '#f0f0f0',
    marginHorizontal: WHITE_KEY_GAP,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  whiteKeyLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: '500',
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    width: BLACK_KEY_WIDTH,
    height: BLACK_KEY_HEIGHT,
    backgroundColor: '#222',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  blackKeyLabel: {
    fontSize: 7,
    color: '#aaa',
    fontWeight: '500',
  },
});
