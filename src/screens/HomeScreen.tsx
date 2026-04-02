import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, Platform, Dimensions,
} from 'react-native';
import {
  Play, ChevronLeft, ChevronRight, Music, Drum,
  Key, Star, Settings2, Zap, Crown, Flame, Lock,
} from 'lucide-react-native';
import { useSubscription } from '../context';
import { COLORS, TRACK_COLORS } from '../theme';
import type { TrackType } from '../theme';
import {
  TRACK_META, ALL_TRACKS,
  getQuickStartRecommendation, DEFAULT_SKILL_PROFILE,
  type UserSkillProfile, type QuickStartRecommendation,
} from '../lib/trackConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

// ─────────────────────────────────────────────────────────────
// 아이콘 매핑
// ─────────────────────────────────────────────────────────────

const TRACK_ICONS: Record<TrackType, React.ReactNode> = {
  rhythm:        <Drum size={22} color={TRACK_COLORS.rhythm.main} />,
  interval:      <Music size={22} color={TRACK_COLORS.interval.main} />,
  key:           <Key size={22} color={TRACK_COLORS.key.main} />,
  comprehensive: <Star size={22} color={TRACK_COLORS.comprehensive.main} />,
};

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface Props {
  onStartTrack: (track: TrackType, level: number) => void;
  onOpenTrackDetail: (track: TrackType) => void;
  onOpenFreePlay: () => void;
  onOpenProfile: () => void;
  skillProfile?: UserSkillProfile;
}

// ─────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────

export default function HomeScreen({
  onStartTrack,
  onOpenTrackDetail,
  onOpenFreePlay,
  onOpenProfile,
  skillProfile,
}: Props) {
  const { tier, genBalance } = useSubscription();
  const profile = skillProfile ?? DEFAULT_SKILL_PROFILE;
  const isPro = tier === 'pro' || tier === 'premium';

  // Quick Start 추천
  const recommendation = useMemo(
    () => getQuickStartRecommendation(profile),
    [profile],
  );

  // Quick Start 레벨 조정 (◀▶)
  const [qsTrack, setQsTrack] = useState<TrackType>(recommendation.track);
  const [qsLevel, setQsLevel] = useState<number>(recommendation.level);

  const qsMeta = TRACK_META[qsTrack];
  const qsLevelMeta = qsMeta.levels[qsLevel - 1];
  const canGoPrev = qsLevel > 1;
  const canGoNext = qsLevel < qsMeta.maxLevel;
  const qsLocked = qsLevelMeta?.requiresPro && !isPro;

  const handleQsPrev = useCallback(() => {
    if (canGoPrev) setQsLevel(l => l - 1);
  }, [canGoPrev]);

  const handleQsNext = useCallback(() => {
    if (canGoNext) setQsLevel(l => l + 1);
  }, [canGoNext]);

  const handleQsStart = useCallback(() => {
    if (!qsLocked) onStartTrack(qsTrack, qsLevel);
  }, [qsTrack, qsLevel, qsLocked, onStartTrack]);

  // Quick Start 트랙 순환
  const handleQsTrackCycle = useCallback(() => {
    const idx = ALL_TRACKS.indexOf(qsTrack);
    const next = ALL_TRACKS[(idx + 1) % ALL_TRACKS.length];
    setQsTrack(next);
    const nextMeta = TRACK_META[next];
    // 해당 트랙의 프로필 레벨로 리셋
    const levelMap: Record<TrackType, number> = {
      rhythm: profile.rhythmLevel,
      interval: profile.intervalLevel,
      key: profile.keyLevel,
      comprehensive: profile.comprehensiveLevel,
    };
    setQsLevel(Math.max(1, Math.min(levelMap[next], nextMeta.maxLevel)));
  }, [qsTrack, profile]);

  // 트랙별 현재 레벨
  const trackLevels: Record<TrackType, number> = {
    rhythm: profile.rhythmLevel,
    interval: profile.intervalLevel,
    key: profile.keyLevel,
    comprehensive: profile.comprehensiveLevel,
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary500} />

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>MelodyGen</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.genBadge}>
            <Zap size={13} color={COLORS.primary500} />
            <Text style={styles.genBadgeText}>{genBalance}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
            <Crown size={16} color={COLORS.amber500} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 스트릭 ── */}
        {profile.streakDays > 0 && (
          <View style={styles.streakBanner}>
            <Flame size={16} color="#ef4444" />
            <Text style={styles.streakText}>
              {profile.streakDays}일 연속 연습 중!
            </Text>
          </View>
        )}

        {/* ── Quick Start ── */}
        <View style={styles.quickStartCard}>
          <View style={styles.qsHeader}>
            <Text style={styles.qsTitle}>원터치 연습</Text>
            <TouchableOpacity onPress={handleQsTrackCycle} style={styles.qsTrackChip}>
              {TRACK_ICONS[qsTrack]}
              <Text style={[styles.qsTrackChipText, { color: TRACK_COLORS[qsTrack].text }]}>
                {qsMeta.name}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.qsLevelName}>
            {qsLevelMeta?.name ?? ''}
          </Text>
          <Text style={styles.qsLevelDesc}>
            {qsLevelMeta?.description ?? ''}
          </Text>

          <View style={styles.qsControls}>
            <TouchableOpacity
              style={[styles.qsArrowBtn, !canGoPrev && styles.qsArrowDisabled]}
              onPress={handleQsPrev}
              disabled={!canGoPrev}
            >
              <ChevronLeft size={20} color={canGoPrev ? COLORS.slate700 : COLORS.slate300} />
              <Text style={[styles.qsArrowLabel, !canGoPrev && { color: COLORS.slate300 }]}>
                {canGoPrev ? `${qsLevel - 1}단계` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.qsStartBtn,
                qsLocked && styles.qsStartBtnLocked,
              ]}
              onPress={handleQsStart}
              activeOpacity={0.8}
            >
              {qsLocked ? (
                <>
                  <Lock size={20} color={COLORS.white} />
                  <Text style={styles.qsStartBtnText}>Pro 필요</Text>
                </>
              ) : (
                <>
                  <Play size={20} color={COLORS.white} fill={COLORS.white} />
                  <Text style={styles.qsStartBtnText}>{qsLevel}단계 시작</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.qsArrowBtn, !canGoNext && styles.qsArrowDisabled]}
              onPress={handleQsNext}
              disabled={!canGoNext}
            >
              <Text style={[styles.qsArrowLabel, !canGoNext && { color: COLORS.slate300 }]}>
                {canGoNext ? `${qsLevel + 1}단계` : ''}
              </Text>
              <ChevronRight size={20} color={canGoNext ? COLORS.slate700 : COLORS.slate300} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 특화 연습 ── */}
        <Text style={styles.sectionTitle}>특화 연습</Text>

        <View style={styles.trackGrid}>
          {ALL_TRACKS.map(track => {
            const meta = TRACK_META[track];
            const colors = TRACK_COLORS[track];
            const currentLevel = trackLevels[track];
            const progress = currentLevel / meta.maxLevel;

            return (
              <TouchableOpacity
                key={track}
                style={[styles.trackCard, { borderColor: colors.main + '30' }]}
                onPress={() => onOpenTrackDetail(track)}
                activeOpacity={0.75}
              >
                <View style={[styles.trackIconWrap, { backgroundColor: colors.bg }]}>
                  {TRACK_ICONS[track]}
                </View>
                <Text style={[styles.trackCardName, { color: colors.text }]}>
                  {meta.name}
                </Text>
                <Text style={styles.trackCardLevel}>
                  {currentLevel} / {meta.maxLevel}
                </Text>

                {/* 진행도 바 */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.max(5, progress * 100)}%`,
                        backgroundColor: colors.main,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 자유 연습 ── */}
        <TouchableOpacity
          style={styles.freePlayCard}
          onPress={onOpenFreePlay}
          activeOpacity={0.75}
        >
          <View style={styles.freePlayLeft}>
            <Settings2 size={20} color={COLORS.slate500} />
            <View style={styles.freePlayTextWrap}>
              <Text style={styles.freePlayTitle}>자유 연습</Text>
              <Text style={styles.freePlayDesc}>
                조성·박자·난이도 직접 설정
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={COLORS.slate400} />
        </TouchableOpacity>

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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.primary500,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: 20, fontWeight: '800', color: COLORS.white,
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  genBadgeText: {
    fontSize: 13, fontWeight: '700', color: COLORS.primary500,
  },
  profileBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // 스트릭
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  streakText: { fontSize: 13, fontWeight: '600', color: '#991b1b' },

  // Quick Start
  quickStartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: COLORS.primary500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  qsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  qsTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.slate800,
  },
  qsTrackChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.slate50,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.slate200,
  },
  qsTrackChipText: {
    fontSize: 13, fontWeight: '600',
  },
  qsLevelName: {
    fontSize: 22, fontWeight: '700', color: COLORS.slate800,
    marginBottom: 4,
  },
  qsLevelDesc: {
    fontSize: 14, color: COLORS.slate500,
    marginBottom: 20,
  },
  qsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  qsArrowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 10, paddingHorizontal: 4,
    minWidth: 70,
  },
  qsArrowDisabled: { opacity: 0.4 },
  qsArrowLabel: {
    fontSize: 12, fontWeight: '600', color: COLORS.slate600,
  },
  qsStartBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary500,
    borderRadius: 14,
    paddingVertical: 14,
  },
  qsStartBtnLocked: {
    backgroundColor: COLORS.slate400,
  },
  qsStartBtnText: {
    fontSize: 16, fontWeight: '700', color: COLORS.white,
  },

  // 섹션
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.slate800,
    marginBottom: 12,
  },

  // 트랙 그리드
  trackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: 20,
  },
  trackCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  trackIconWrap: {
    width: 44, height: 44,
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  trackCardName: {
    fontSize: 16, fontWeight: '700',
    marginBottom: 2,
  },
  trackCardLevel: {
    fontSize: 12, color: COLORS.slate400,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: COLORS.slate100,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', borderRadius: 3,
  },

  // 자유 연습
  freePlayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  freePlayLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  freePlayTextWrap: { gap: 2 },
  freePlayTitle: {
    fontSize: 15, fontWeight: '700', color: COLORS.slate800,
  },
  freePlayDesc: {
    fontSize: 12, color: COLORS.slate500,
  },
});
