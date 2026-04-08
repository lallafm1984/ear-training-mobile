import React, { useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../theme/colors';
import AbcjsRenderer, { type AbcjsRendererHandle } from './AbcjsRenderer';
import type { GradingResult as GradingResultType } from '../lib/grading';

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

interface GradingResultProps {
  answerAbcString: string;
  userAbcString: string;
  gradingResult: GradingResultType;
  timeSignature: string;
  accentColor: string;
  barsPerStaff?: number;
  onScrollDelta?: (dy: number) => void;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

function GradingResultView({
  answerAbcString,
  userAbcString,
  gradingResult,
  timeSignature,
  accentColor,
  barsPerStaff,
  onScrollDelta,
}: GradingResultProps) {
  const { t } = useTranslation(['practice']);
  const answerRef = useRef<AbcjsRendererHandle>(null);

  const percentage = Math.round(gradingResult.accuracy * 100);

  // 사용자 음표별 색상 빌드 (userSourceIndices 기반)
  const userNoteColors = useMemo(() => {
    const result: (string | null)[] = [];
    gradingResult.grades.forEach(g => {
      const color =
        g.grade === 'correct' ? 'correct' :
        g.grade === 'missing' ? null :
        'wrong'; // wrong / extra
      g.userSourceIndices.forEach(idx => {
        result[idx] = color;
      });
    });
    return result;
  }, [gradingResult]);
  const wrongTotal = gradingResult.wrongCount + gradingResult.missingCount;

  return (
    <View style={styles.container}>
      {/* ── Score section ── */}
      <View style={styles.scoreSection}>
        <Text style={[styles.percentageText, { color: accentColor }]}>
          {percentage}%
        </Text>
        <View style={styles.countsRow}>
          <View style={styles.countItem}>
            <Text style={[styles.countNumber, { color: '#22dd44' }]}>
              {gradingResult.correctCount}
            </Text>
            <Text style={styles.countLabel}>{t('practice:choice.correct')}</Text>
          </View>
          <View style={styles.countItem}>
            <Text style={[styles.countNumber, { color: '#e74c3c' }]}>
              {wrongTotal}
            </Text>
            <Text style={styles.countLabel}>{t('practice:choice.incorrect')}</Text>
          </View>
        </View>
      </View>

      {/* ── 문제 악보 card ── */}
      <View style={styles.card}>
        <View style={styles.scoreHeader}>
          <Text style={styles.headerTitle}>{t('practice:grading.questionScore')}</Text>
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: accentColor }]}
            onPress={() => answerRef.current?.togglePlay()}
          >
            <Text style={styles.playButtonText}>{t('practice:grading.replay')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <AbcjsRenderer
            ref={answerRef}
            abcString={answerAbcString}
            timeSignature={timeSignature}
            barsPerStaff={barsPerStaff}
            onScrollDelta={onScrollDelta}
          />
        </View>
      </View>

      {/* ── 내 답안 card ── */}
      <View style={styles.card}>
        <View style={styles.scoreHeader}>
          <Text style={styles.headerTitle}>{t('practice:grading.myAnswer')}</Text>
        </View>
        <View style={styles.cardBody}>
          <AbcjsRenderer
            abcString={userAbcString}
            timeSignature={timeSignature}
            stretchLast={true}
            barsPerStaff={barsPerStaff}
            noteColors={userNoteColors}
            onScrollDelta={onScrollDelta}
          />
        </View>
      </View>

    </View>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },

  // Score section
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  percentageText: {
    fontSize: 44,
    fontWeight: '700',
  },
  countsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  countItem: {
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  countLabel: {
    fontSize: 11,
    color: COLORS.slate500,
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    overflow: 'hidden',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  playButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  playButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  cardBody: {
    padding: 8,
  },

});

export default GradingResultView;
