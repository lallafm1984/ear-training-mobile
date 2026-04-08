// ─────────────────────────────────────────────────────────────
// DailyScoreChart — 일별 평균 점수 라인 차트 (카테고리별)
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig } from '../lib/contentConfig';
import type { PracticeRecord, ContentCategory } from '../types/content';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H_PAD = 32;
const CHART_WIDTH = SCREEN_WIDTH - 40 - CHART_H_PAD * 2; // 화면 - 컨테이너패딩 - 차트패딩

const CATEGORIES: ContentCategory[] = ['melody', 'rhythm', 'interval', 'chord', 'key', 'twoVoice'];
const PERIODS = [
  { label: '7일', days: 7 },
  { label: '14일', days: 14 },
  { label: '30일', days: 30 },
];

interface Props {
  records: PracticeRecord[];
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailyScoreChart({ records }: Props) {
  const [periodIndex, setPeriodIndex] = useState(0);
  const [activeCategories, setActiveCategories] = useState<Set<ContentCategory>>(
    new Set(['melody', 'interval', 'chord']),
  );

  const days = PERIODS[periodIndex].days;
  const chartHeight = 150;
  const yMax = 5;

  // 날짜 레이블 + 카테고리별 일평균 데이터
  const { dateLabels, data } = useMemo(() => {
    const now = new Date();
    const keys: string[] = [];
    const labels: string[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      keys.push(toDateKey(d));
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }

    // 날짜+카테고리별 그룹핑
    const grouped: Record<string, Record<string, { sum: number; count: number }>> = {};
    records.forEach(r => {
      const key = toDateKey(new Date(r.practicedAt));
      if (!grouped[key]) grouped[key] = {};
      if (!grouped[key][r.contentType]) grouped[key][r.contentType] = { sum: 0, count: 0 };
      grouped[key][r.contentType].sum += r.selfRating;
      grouped[key][r.contentType].count += 1;
    });

    const catData: Record<ContentCategory, (number | null)[]> = {} as any;
    CATEGORIES.forEach(cat => {
      catData[cat] = keys.map(key => {
        const g = grouped[key]?.[cat];
        return g ? Math.round((g.sum / g.count) * 10) / 10 : null;
      });
    });

    return { dateLabels: labels, data: catData };
  }, [records, days]);

  const toggleCategory = (cat: ContentCategory) => {
    const next = new Set(activeCategories);
    if (next.has(cat)) {
      if (next.size > 1) next.delete(cat);
    } else {
      next.add(cat);
    }
    setActiveCategories(next);
  };

  const xStep = days > 1 ? CHART_WIDTH / (days - 1) : CHART_WIDTH;

  // X축 레이블 표시 간격
  const labelInterval = days <= 7 ? 1 : days <= 14 ? 2 : Math.ceil(days / 7);

  return (
    <View style={styles.container}>
      {/* 기간 탭 */}
      <View style={styles.periodRow}>
        {PERIODS.map((p, i) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.periodTab, i === periodIndex && styles.periodActive]}
            onPress={() => setPeriodIndex(i)}
          >
            <Text style={[styles.periodText, i === periodIndex && styles.periodActiveText]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SVG 차트 */}
      <View style={{ marginVertical: 12, alignItems: 'center' }}>
        <Svg width={CHART_WIDTH + CHART_H_PAD * 2} height={chartHeight + 28}>
          {/* Y축 그리드 + 레이블 */}
          {[0, 1, 2, 3, 4, 5].map(v => {
            const y = chartHeight - (v / yMax) * chartHeight;
            return (
              <React.Fragment key={v}>
                <Line
                  x1={CHART_H_PAD}
                  y1={y}
                  x2={CHART_H_PAD + CHART_WIDTH}
                  y2={y}
                  stroke={v === 0 ? COLORS.slate200 : COLORS.slate100}
                  strokeWidth={1}
                />
                <SvgText
                  x={CHART_H_PAD - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill={COLORS.slate400}
                >
                  {v}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* 카테고리별 라인 */}
          {CATEGORIES.filter(cat => activeCategories.has(cat)).map(cat => {
            const points = data[cat];
            const color = CATEGORY_COLORS[cat].main;

            const segments: { x: number; y: number }[] = [];
            points.forEach((val, i) => {
              if (val !== null) {
                segments.push({
                  x: CHART_H_PAD + i * xStep,
                  y: chartHeight - (val / yMax) * chartHeight,
                });
              }
            });

            if (segments.length === 0) return null;

            if (segments.length === 1) {
              return (
                <Circle
                  key={cat}
                  cx={segments[0].x}
                  cy={segments[0].y}
                  r={3.5}
                  fill={color}
                />
              );
            }

            const pointsStr = segments.map(p => `${p.x},${p.y}`).join(' ');
            return (
              <React.Fragment key={cat}>
                <Polyline
                  points={pointsStr}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {segments.map((pt, i) => (
                  <Circle key={i} cx={pt.x} cy={pt.y} r={3} fill={color} />
                ))}
              </React.Fragment>
            );
          })}

          {/* X축 레이블 */}
          {dateLabels.map((label, i) => {
            if (i % labelInterval !== 0 && i !== days - 1) return null;
            return (
              <SvgText
                key={i}
                x={CHART_H_PAD + i * xStep}
                y={chartHeight + 16}
                textAnchor="middle"
                fontSize={9}
                fill={COLORS.slate400}
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      {/* 범례 (토글) */}
      <View style={styles.legend}>
        {CATEGORIES.map(cat => {
          const config = getContentConfig(cat);
          const active = activeCategories.has(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.legendItem, !active && { opacity: 0.3 }]}
              onPress={() => toggleCategory(cat)}
            >
              <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[cat].main }]} />
              <Text style={styles.legendText}>{config.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.slate100,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodActive: {
    backgroundColor: '#fff',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slate400,
  },
  periodActiveText: {
    color: COLORS.slate800,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    rowGap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slate600,
  },
});
