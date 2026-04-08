// ─────────────────────────────────────────────────────────────
// PracticeCalendar — 월간 캘린더 (연습 활동 표시)
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import { getContentConfig } from '../lib/contentConfig';
import type { PracticeRecord, ContentCategory } from '../types/content';

interface Props {
  records: PracticeRecord[];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PracticeCalendar({ records }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(new Date()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 날짜별 기록 그룹핑
  const recordsByDate = useMemo(() => {
    const map: Record<string, PracticeRecord[]> = {};
    records.forEach(r => {
      const key = toDateKey(new Date(r.practicedAt));
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [records]);

  // 캘린더 그리드 생성
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (number | null)[][] = [];
    let week: (number | null)[] = Array(firstDay).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      result.push(week);
    }
    return result;
  }, [year, month]);

  const todayStr = toDateKey(new Date());

  const handleDayPress = (day: number) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(key === selectedDate ? null : key);
  };

  // 날짜별 연습 카테고리 (최대 4개 도트)
  const getCategoryDots = (dateKey: string): ContentCategory[] => {
    const recs = recordsByDate[dateKey];
    if (!recs) return [];
    const cats = new Set<ContentCategory>();
    recs.forEach(r => cats.add(r.contentType));
    return Array.from(cats).slice(0, 4);
  };

  // 선택된 날짜의 기록
  const selectedRecords = selectedDate ? (recordsByDate[selectedDate] || []) : [];

  // 선택된 날짜의 카테고리별 요약
  const selectedSummary = useMemo(() => {
    if (!selectedRecords.length) return [];
    const map: Record<string, { count: number; sum: number }> = {};
    selectedRecords.forEach(r => {
      if (!map[r.contentType]) map[r.contentType] = { count: 0, sum: 0 };
      map[r.contentType].count++;
      map[r.contentType].sum += r.selfRating;
    });
    return Object.entries(map).map(([cat, { count, sum }]) => ({
      category: cat as ContentCategory,
      count,
      avgRating: Math.round((sum / count) * 10) / 10,
    }));
  }, [selectedRecords]);

  return (
    <View style={styles.container}>
      {/* 월 네비게이션 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentDate(new Date(year, month - 1, 1))} hitSlop={12}>
          <ChevronLeft size={20} color={COLORS.slate600} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{year}년 {month + 1}월</Text>
        <TouchableOpacity onPress={() => setCurrentDate(new Date(year, month + 1, 1))} hitSlop={12}>
          <ChevronRight size={20} color={COLORS.slate600} />
        </TouchableOpacity>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={w} style={styles.weekCell}>
            <Text style={[
              styles.weekText,
              i === 0 && { color: '#ef4444' },
              i === 6 && { color: '#3b82f6' },
            ]}>{w}</Text>
          </View>
        ))}
      </View>

      {/* 날짜 셀 */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={styles.dayCell} />;

            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateKey === todayStr;
            const isSelected = dateKey === selectedDate;
            const dayRecs = recordsByDate[dateKey];
            const hasPractice = !!dayRecs && dayRecs.length > 0;
            const dots = getCategoryDots(dateKey);

            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.dayCell,
                  hasPractice && !isSelected && styles.practiced,
                  isToday && !isSelected && styles.today,
                  isSelected && styles.selected,
                ]}
                onPress={() => handleDayPress(day)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayText,
                  di === 0 && { color: '#ef4444' },
                  di === 6 && { color: '#3b82f6' },
                  hasPractice && !isSelected && { fontWeight: '800' },
                  isSelected && { color: '#fff', fontWeight: '800' },
                ]}>
                  {day}
                </Text>
                {dots.length > 0 && !isSelected && (
                  <View style={styles.dotsRow}>
                    {dots.map(cat => (
                      <View key={cat} style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat].main }]} />
                    ))}
                  </View>
                )}
                {isSelected && hasPractice && (
                  <Text style={styles.selectedCount}>{dayRecs!.length}회</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* 선택된 날짜 상세 */}
      {selectedDate && selectedSummary.length > 0 && (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            {parseInt(selectedDate.split('-')[1])}월 {parseInt(selectedDate.split('-')[2])}일 연습 기록
          </Text>
          {selectedSummary.map(({ category, count, avgRating }) => {
            const config = getContentConfig(category);
            const colors = CATEGORY_COLORS[category];
            return (
              <View key={category} style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailDot, { backgroundColor: colors.main }]} />
                  <Text style={styles.detailName}>{config.name}</Text>
                </View>
                <View style={styles.detailRight}>
                  <Text style={styles.detailCount}>{count}회</Text>
                  <Text style={[styles.detailRating, { color: colors.main }]}>
                    평균 {avgRating}점
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {selectedDate && selectedSummary.length === 0 && (
        <View style={styles.detail}>
          <Text style={styles.detailEmpty}>이 날은 연습 기록이 없습니다</Text>
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.slate400,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 42,
    borderRadius: 10,
    margin: 1,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  today: {
    borderWidth: 1.5,
    borderColor: COLORS.primary500,
  },
  selected: {
    backgroundColor: COLORS.primary500,
  },
  practiced: {
    backgroundColor: COLORS.primary500 + '12',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  catDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  selectedCount: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  // 선택된 날짜 상세
  detail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
    gap: 8,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate700,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate700,
  },
  detailRight: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  detailCount: {
    fontSize: 12,
    color: COLORS.slate500,
  },
  detailRating: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailEmpty: {
    fontSize: 13,
    color: COLORS.slate400,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
