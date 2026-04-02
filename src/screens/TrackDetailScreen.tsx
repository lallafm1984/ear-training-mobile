import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, StatusBar,
} from 'react-native';
import {
  ChevronLeft, Play, Lock, Check, Minus,
  Music, Drum, Key, Star, Zap,
} from 'lucide-react-native';
import { useSubscription } from '../context';
import { COLORS, TRACK_COLORS } from '../theme';
import type { TrackType } from '../theme';
import { TRACK_META, getTrackGenCost } from '../lib/trackConfig';
import type { UserSkillProfile } from '../lib/trackConfig';

// ─────────────────────────────────────────────────────────────
// 아이콘 매핑
// ─────────────────────────────────────────────────────────────

const TRACK_ICONS_LG: Record<TrackType, (color: string) => React.ReactNode> = {
  rhythm:        (c) => <Drum size={28} color={c} />,
  interval:      (c) => <Music size={28} color={c} />,
  key:           (c) => <Key size={28} color={c} />,
  comprehensive: (c) => <Star size={28} color={c} />,
};

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface Props {
  track: TrackType;
  onBack: () => void;
  onStartLevel: (track: TrackType, level: number) => void;
  skillProfile?: UserSkillProfile;
}

// ─────────────────────────────────────────────────────────────
// TrackDetailScreen
// ─────────────────────────────────────────────────────────────

export default function TrackDetailScreen({
  track,
  onBack,
  onStartLevel,
  skillProfile,
}: Props) {
  const { tier } = useSubscription();
  const isPro = tier === 'pro' || tier === 'premium';

  const meta = TRACK_META[track];
  const colors = TRACK_COLORS[track];

  // 트랙별 현재 레벨
  const currentLevel = skillProfile
    ? ({
        rhythm: skillProfile.rhythmLevel,
        interval: skillProfile.intervalLevel,
        key: skillProfile.keyLevel,
        comprehensive: skillProfile.comprehensiveLevel,
      }[track] ?? 1)
    : 1;

  const totalPractice = 0; // TODO: practice_sessions에서 가져오기

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.main} />

      {/* ── 헤더 ── */}
      <View style={[styles.header, { backgroundColor: colors.main }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {TRACK_ICONS_LG[track](COLORS.white)}
          <Text style={styles.headerTitle}>{meta.name} 트랙</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── 설명 배너 ── */}
      <View style={[styles.descBanner, { backgroundColor: colors.bg }]}>
        <Text style={[styles.descText, { color: colors.text }]}>
          {meta.description}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 레벨 목록 ── */}
        {meta.levels.map((lvl) => {
          const locked = lvl.requiresPro && !isPro;
          const isCompleted = lvl.level < currentLevel;
          const isCurrent = lvl.level === currentLevel;
          const cost = getTrackGenCost(track, lvl.level);

          return (
            <TouchableOpacity
              key={lvl.level}
              style={[
                styles.levelCard,
                isCurrent && { borderColor: colors.main, borderWidth: 2 },
                locked && styles.levelCardLocked,
              ]}
              onPress={() => {
                if (!locked) onStartLevel(track, lvl.level);
              }}
              activeOpacity={locked ? 1 : 0.7}
            >
              {/* 왼쪽: 상태 아이콘 */}
              <View style={[
                styles.levelStatusIcon,
                isCompleted && { backgroundColor: COLORS.success },
                isCurrent && { backgroundColor: colors.main },
                locked && { backgroundColor: COLORS.slate300 },
                !isCompleted && !isCurrent && !locked && { backgroundColor: COLORS.slate200 },
              ]}>
                {isCompleted ? (
                  <Check size={14} color={COLORS.white} />
                ) : locked ? (
                  <Lock size={12} color={COLORS.white} />
                ) : (
                  <Text style={styles.levelNum}>{lvl.level}</Text>
                )}
              </View>

              {/* 가운데: 정보 */}
              <View style={styles.levelInfo}>
                <View style={styles.levelNameRow}>
                  <Text style={[
                    styles.levelName,
                    locked && { color: COLORS.slate400 },
                  ]}>
                    {lvl.name}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.currentBadgeText, { color: colors.text }]}>현재</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.levelDesc,
                  locked && { color: COLORS.slate300 },
                ]}>
                  {lvl.description}
                </Text>
              </View>

              {/* 오른쪽: 비용 또는 잠금 */}
              <View style={styles.levelRight}>
                {locked ? (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>Pro</Text>
                  </View>
                ) : (
                  <View style={styles.costBadge}>
                    <Zap size={11} color={COLORS.primary500} />
                    <Text style={styles.costText}>{cost}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── 트랙 통계 ── */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>트랙 통계</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{currentLevel} / {meta.maxLevel}</Text>
              <Text style={styles.statLabel}>진행 레벨</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalPractice}회</Text>
              <Text style={styles.statLabel}>총 연습</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.round((currentLevel / meta.maxLevel) * 100)}%
              </Text>
              <Text style={styles.statLabel}>완성도</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.white,
  },

  // 설명 배너
  descBanner: {
    paddingHorizontal: 20, paddingVertical: 12,
  },
  descText: {
    fontSize: 13, fontWeight: '500', lineHeight: 18,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // 레벨 카드
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    gap: 14,
  },
  levelCardLocked: {
    backgroundColor: COLORS.slate50,
    borderColor: COLORS.slate100,
  },

  levelStatusIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  levelNum: {
    fontSize: 13, fontWeight: '700', color: COLORS.white,
  },

  levelInfo: { flex: 1 },
  levelNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 3,
  },
  levelName: {
    fontSize: 15, fontWeight: '700', color: COLORS.slate800,
  },
  levelDesc: {
    fontSize: 12, color: COLORS.slate500, lineHeight: 17,
  },

  currentBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 10, fontWeight: '700',
  },

  levelRight: { alignItems: 'flex-end' },
  proBadge: {
    backgroundColor: COLORS.primary100,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  proBadgeText: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary500,
  },
  costBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary50,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  costText: {
    fontSize: 12, fontWeight: '600', color: COLORS.primary500,
  },

  // 통계
  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  statsTitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.slate800,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: 18, fontWeight: '800', color: COLORS.slate800,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11, color: COLORS.slate400,
  },
  statDivider: {
    width: 1, height: 30,
    backgroundColor: COLORS.slate200,
  },
});
