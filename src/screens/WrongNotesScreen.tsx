// ─────────────────────────────────────────────────────────────
// WrongNotesScreen — 오답노트 (약점 TOP3 · 복습 · 틀린 문제 다시 듣기)
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BookOpen,
  Volume2,
  VolumeX,
  Trash2,
  Check,
  Play,
  Target,
  Sparkles,
  RotateCcw,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS, CATEGORY_COLORS } from '../theme/colors';
import AbcjsRenderer, { type AbcjsRendererHandle } from '../components/AbcjsRenderer';
import { useWrongNotes } from '../hooks/useWrongNotes';
import { usePracticeHistory } from '../hooks/usePracticeHistory';
import {
  MAX_REVIEW_BATCH,
  pickReviewNotes,
  summarizeWeakness,
  wrongNoteToChoiceQuestion,
  type WrongNote,
} from '../lib/wrongNotes';
import { wrongNoteReviewStore } from '../lib/wrongNoteReviewStore';
import type { ContentCategory, ContentDifficulty } from '../types/content';
import type { MainStackParamList } from '../navigation/MainStack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type NavProp = StackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'WrongNotes'>;
type Filter = 'all' | 'unresolved' | 'resolved';

const SILENT_ABC = 'X:1\nM:4/4\nL:1/4\nK:C\nz4 |]';

export default function WrongNotesScreen() {
  const layout = useResponsiveLayout();
  const { t, i18n } = useTranslation(['wrongNotes', 'content', 'common']);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<Route>();
  const categoryFilter = route.params?.category;
  const { notes, loaded, remove, clearResolved, reload } = useWrongNotes();
  const { records } = usePracticeHistory();

  const [filter, setFilter] = useState<Filter>('unresolved');

  // 듣기: 숨겨진 렌더러 하나로 한 번에 하나만 재생
  const abcjsRef = useRef<AbcjsRendererHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackAbc, setPlaybackAbc] = useState(SILENT_ABC);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const pendingPlayRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => abcjsRef.current?.stopPlay();
    }, [reload]),
  );

  useEffect(() => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    const timer = setTimeout(() => abcjsRef.current?.togglePlay(), 450);
    return () => clearTimeout(timer);
  }, [playbackAbc]);

  useEffect(() => {
    if (!isPlaying) setPlayingId(null);
  }, [isPlaying]);

  const togglePlay = (note: WrongNote) => {
    if (playingId === note.id && isPlaying) {
      abcjsRef.current?.stopPlay();
      return;
    }
    abcjsRef.current?.stopPlay();
    setPlayingId(note.id);
    if (note.abcNotation === playbackAbc) {
      setTimeout(() => abcjsRef.current?.togglePlay(), 120);
      return;
    }
    pendingPlayRef.current = true;
    setPlaybackAbc(note.abcNotation);
  };

  const unresolved = useMemo(() => notes.filter((n) => !n.resolvedAt), [notes]);
  const weakSpots = useMemo(() => summarizeWeakness(notes, records), [notes, records]);

  const visible = useMemo(() => {
    let list = notes;
    if (categoryFilter) list = list.filter((n) => n.contentType === categoryFilter);
    if (filter === 'unresolved') list = list.filter((n) => !n.resolvedAt);
    if (filter === 'resolved') list = list.filter((n) => !!n.resolvedAt);
    return list;
  }, [notes, filter, categoryFilter]);

  const startReview = (spot?: { contentType: ContentCategory; difficulty: ContentDifficulty }) => {
    const picked = pickReviewNotes(notes, spot, MAX_REVIEW_BATCH);
    if (picked.length === 0) return;
    abcjsRef.current?.stopPlay();
    wrongNoteReviewStore.set(picked.map(wrongNoteToChoiceQuestion));
    navigation.navigate('ChoicePractice', {
      category: picked[0].contentType,
      difficulty: picked[0].difficulty,
      review: true,
    });
  };

  const confirmDelete = (note: WrongNote) => {
    Alert.alert(t('wrongNotes:item.delete'), note.correctAnswer, [
      { text: t('common:button.cancel'), style: 'cancel' },
      {
        text: t('common:button.delete'),
        style: 'destructive',
        onPress: () => {
          if (playingId === note.id) abcjsRef.current?.stopPlay();
          void remove(note.id);
        },
      },
    ]);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.primary600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('wrongNotes:title')}</Text>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>
            {t('wrongNotes:unresolvedChip', { count: unresolved.length })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* 약점 TOP 3 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={16} color={COLORS.primary600} />
            <Text style={styles.sectionTitle}>{t('wrongNotes:weakness.title')}</Text>
          </View>
          <Text style={styles.sectionDesc}>{t('wrongNotes:weakness.desc')}</Text>
          {weakSpots.length === 0 ? (
            <View style={styles.weakEmpty}>
              <Sparkles size={16} color={COLORS.slate300} />
              <Text style={styles.weakEmptyText}>{t('wrongNotes:weakness.empty')}</Text>
            </View>
          ) : (
            weakSpots.map((spot, idx) => {
              const colors = CATEGORY_COLORS[spot.contentType];
              return (
                <View key={`${spot.contentType}-${spot.difficulty}`} style={styles.weakCard}>
                  <View style={[styles.weakRank, { backgroundColor: colors.main }]}>
                    <Text style={styles.weakRankText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.weakName, { color: colors.text }]}>
                      {t(`content:category.${spot.contentType}.name`)} ·{' '}
                      {t(`content:difficulty.${spot.contentType}.${spot.difficulty}`)}
                    </Text>
                    <Text style={styles.weakStats}>
                      {t('wrongNotes:weakness.stats', {
                        unresolved: spot.unresolved,
                        wrong: spot.wrongCount,
                        low: spot.lowRatingSessions,
                      })}
                    </Text>
                    <View style={styles.weakActions}>
                      {spot.unresolved > 0 && (
                        <TouchableOpacity
                          style={[styles.weakBtn, { backgroundColor: colors.main }]}
                          onPress={() => startReview(spot)}
                        >
                          <RotateCcw size={12} color="#fff" />
                          <Text style={styles.weakBtnText}>{t('wrongNotes:weakness.review')}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.weakBtn,
                          styles.weakBtnOutline,
                          { borderColor: colors.main },
                        ]}
                        onPress={() =>
                          navigation.navigate('CategoryPractice', {
                            category: spot.contentType,
                            initialDifficulty: spot.difficulty,
                          })
                        }
                      >
                        <Play size={12} color={colors.main} fill={colors.main} />
                        <Text style={[styles.weakBtnText, { color: colors.main }]}>
                          {t('wrongNotes:weakness.practice')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 전체 복습 */}
        {unresolved.length > 0 && (
          <TouchableOpacity style={styles.reviewAllBtn} onPress={() => startReview()}>
            <BookOpen size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewAllText}>
                {t('wrongNotes:reviewAll', { count: unresolved.length })}
              </Text>
              <Text style={styles.reviewAllHint}>
                {t('wrongNotes:reviewAllHint', { max: MAX_REVIEW_BATCH })}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 필터 */}
        <View style={styles.filterRow}>
          {(['unresolved', 'all', 'resolved'] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: '#fff' }]}>
                {t(`wrongNotes:filters.${f}`)}
              </Text>
            </TouchableOpacity>
          ))}
          {filter === 'resolved' && visible.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => void clearResolved()}>
              <Text style={styles.clearBtnText}>{t('wrongNotes:clearResolved')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 목록 */}
        {loaded && visible.length === 0 ? (
          <View style={styles.empty}>
            <BookOpen size={32} color={COLORS.slate300} />
            <Text style={styles.emptyTitle}>{t('wrongNotes:empty.title')}</Text>
            <Text style={styles.emptyDesc}>{t('wrongNotes:empty.desc')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((note) => {
              const colors = CATEGORY_COLORS[note.contentType];
              const playing = playingId === note.id && isPlaying;
              return (
                <View
                  key={note.id}
                  style={[styles.noteCard, note.resolvedAt && styles.noteCardResolved]}
                >
                  <View style={styles.noteTop}>
                    <View style={[styles.catChip, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.catChipText, { color: colors.text }]}>
                        {t(`content:category.${note.contentType}.name`)} ·{' '}
                        {t(`content:difficulty.${note.contentType}.${note.difficulty}`)}
                      </Text>
                    </View>
                    <Text style={styles.noteMeta}>
                      {t(`wrongNotes:item.source.${note.source}`)} · {formatDate(note.lastWrongAt)}
                    </Text>
                  </View>
                  <Text style={styles.notePrompt} numberOfLines={2}>
                    {note.prompt}
                  </Text>
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>{t('wrongNotes:item.correct')}</Text>
                    <Text style={styles.answerCorrect}>{note.correctAnswer}</Text>
                  </View>
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>{t('wrongNotes:item.mine')}</Text>
                    <Text style={styles.answerMine}>{note.myAnswer}</Text>
                  </View>
                  <View style={styles.noteBottom}>
                    <TouchableOpacity
                      style={[
                        styles.listenBtn,
                        { backgroundColor: playing ? COLORS.slate400 : colors.main },
                      ]}
                      onPress={() => togglePlay(note)}
                    >
                      {playing ? (
                        <VolumeX size={14} color="#fff" />
                      ) : (
                        <Volume2 size={14} color="#fff" />
                      )}
                      <Text style={styles.listenText}>
                        {playing ? t('wrongNotes:item.playing') : t('wrongNotes:item.listen')}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.noteFlags}>
                      {note.resolvedAt ? (
                        <View style={styles.resolvedChip}>
                          <Check size={12} color="#047857" />
                          <Text style={styles.resolvedText}>{t('wrongNotes:item.resolved')}</Text>
                        </View>
                      ) : (
                        <Text style={styles.wrongCount}>
                          {t('wrongNotes:item.wrongCount', { count: note.wrongCount })}
                        </Text>
                      )}
                      <TouchableOpacity onPress={() => confirmDelete(note)} hitSlop={8}>
                        <Trash2 size={16} color={COLORS.slate400} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.hiddenRenderer}>
        <AbcjsRenderer
          ref={abcjsRef}
          abcString={playbackAbc}
          hideNotes
          tempo={80}
          isPlaying={isPlaying}
          onPlayStateChange={setIsPlaying}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: COLORS.primary50,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', color: COLORS.primary700 },
  countChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  countChipText: { fontSize: 12, fontWeight: '800', color: COLORS.primary600 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 16 },

  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.slate800 },
  sectionDesc: { fontSize: 11, color: COLORS.slate400, marginBottom: 2 },
  weakEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    padding: 14,
  },
  weakEmptyText: { flex: 1, fontSize: 12, color: COLORS.slate500, lineHeight: 18 },
  weakCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    padding: 14,
  },
  weakRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weakRankText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  weakName: { fontSize: 14, fontWeight: '800' },
  weakStats: { fontSize: 11, color: COLORS.slate500 },
  weakActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  weakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  weakBtnOutline: { backgroundColor: '#fff', borderWidth: 1.5 },
  weakBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  reviewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.primary500,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  reviewAllText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  reviewAllHint: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.slate100,
  },
  filterChipActive: { backgroundColor: COLORS.slate800 },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.slate600 },
  clearBtn: { marginLeft: 'auto', paddingVertical: 6 },
  clearBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.error },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.slate600 },
  emptyDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.slate400,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  list: { gap: 10 },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    padding: 14,
    gap: 6,
  },
  noteCardResolved: { opacity: 0.7 },
  noteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 1 },
  catChipText: { fontSize: 10, fontWeight: '800' },
  noteMeta: { fontSize: 10, color: COLORS.slate400 },
  notePrompt: { fontSize: 13, color: COLORS.slate600, lineHeight: 18 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerLabel: { width: 36, fontSize: 11, fontWeight: '700', color: COLORS.slate400 },
  answerCorrect: { fontSize: 14, fontWeight: '800', color: '#047857' },
  answerMine: { fontSize: 14, fontWeight: '700', color: '#b91c1c' },
  noteBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  listenText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  noteFlags: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resolvedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resolvedText: { fontSize: 11, fontWeight: '800', color: '#047857' },
  wrongCount: { fontSize: 11, fontWeight: '700', color: COLORS.slate400 },
  hiddenRenderer: { height: 0, overflow: 'hidden', opacity: 0 },
});
