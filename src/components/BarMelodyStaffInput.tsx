import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/colors';
import type { ScoreNote } from '../lib/scoreUtils';
import {
  BAR_MELODY_SLOT_COUNT,
  buildBarMelodyDisplayAbc,
} from '../lib/barMelody';
import AbcjsRenderer from './AbcjsRenderer';

interface BarMelodyStaffInputProps {
  notes: (ScoreNote | null)[];
  accentColor: string;
}

export default function BarMelodyStaffInput({
  notes,
  accentColor,
}: BarMelodyStaffInputProps) {
  const answeredCount = notes.filter(Boolean).length;
  const abcString = useMemo(() => buildBarMelodyDisplayAbc(notes), [notes]);

  return (
    <View style={[styles.container, { borderColor: `${accentColor}33` }]}>
      <View style={styles.scoreSurface}>
        <AbcjsRenderer
          abcString={abcString}
          hideNotes={false}
          tempo={80}
          timeSignature="4/4"
          keySignature="C"
          barsPerStaff={1}
          stretchLast={true}
          showNoteCursor={false}
          showMeasureHighlight={false}
          interactive={false}
          renderScale={2}
          staffWidth={520}
        />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: accentColor }]}>
          {answeredCount}/{BAR_MELODY_SLOT_COUNT}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  scoreSurface: {
    minHeight: 220,
    paddingHorizontal: 2,
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  footer: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
    backgroundColor: COLORS.slate50,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
