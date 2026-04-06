import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  onNext: () => void;
  onFinish: () => void;
  showFinish: boolean;
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
  onNext,
  onFinish,
  showFinish,
}: GradingResultProps) {
  const answerRef = useRef<AbcjsRendererHandle>(null);

  const percentage = Math.round(gradingResult.accuracy * 100);
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
            <Text style={styles.countLabel}>정답</Text>
          </View>
          <View style={styles.countItem}>
            <Text style={[styles.countNumber, { color: '#e67e22' }]}>
              {gradingResult.partialCount}
            </Text>
            <Text style={styles.countLabel}>부분</Text>
          </View>
          <View style={styles.countItem}>
            <Text style={[styles.countNumber, { color: '#e74c3c' }]}>
              {wrongTotal}
            </Text>
            <Text style={styles.countLabel}>오답</Text>
          </View>
        </View>
      </View>

      {/* ── 문제 악보 card ── */}
      <View style={styles.card}>
        <View style={styles.scoreHeader}>
          <Text style={styles.headerTitle}>문제 악보</Text>
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: accentColor }]}
            onPress={() => answerRef.current?.togglePlay()}
          >
            <Text style={styles.playButtonText}>▶ 다시 듣기</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <AbcjsRenderer
            ref={answerRef}
            abcString={answerAbcString}
            timeSignature={timeSignature}
            barsPerStaff={barsPerStaff}
          />
        </View>
      </View>

      {/* ── 내 답안 card ── */}
      <View style={styles.card}>
        <View style={styles.scoreHeader}>
          <Text style={styles.headerTitle}>내 답안</Text>
        </View>
        <View style={styles.cardBody}>
          <AbcjsRenderer
            abcString={userAbcString}
            timeSignature={timeSignature}
            stretchLast={false}
            barsPerStaff={barsPerStaff}
          />
        </View>
      </View>

      {/* ── Button row ── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: accentColor }]}
          onPress={onNext}
        >
          <Text style={styles.nextButtonText}>다음 문제</Text>
        </TouchableOpacity>
        {showFinish && (
          <TouchableOpacity
            style={[styles.button, styles.finishButton]}
            onPress={onFinish}
          >
            <Text style={styles.finishButtonText}>연습 종료</Text>
          </TouchableOpacity>
        )}
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

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  finishButton: {
    backgroundColor: COLORS.slate200,
  },
  finishButtonText: {
    color: COLORS.slate700,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default GradingResultView;
