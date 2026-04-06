import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Music2, Sparkles, Lock, Eye, EyeOff, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRACK_META } from '../../lib/trackConfig';
import type { TrackType } from '../../theme/colors';
import { BASS_DIFF_DESC } from '../../lib';
import type { BassDifficulty } from '../../lib';
import type { UpgradeReason } from '../../components';
import type { PlanLimits } from '../../types';
import { ALL_BASS_DIFFICULTIES } from './constants';

export interface GenerateSheetProps {
  open: boolean;
  onClose: () => void;
  // Generation settings
  genTab: 'melody' | 'grand';
  setGenTab: (t: 'melody' | 'grand') => void;
  genPracticeMode: 'partPractice' | 'comprehensive';
  setGenPracticeMode: (m: 'partPractice' | 'comprehensive') => void;
  genPartLevel: number;
  setGenPartLevel: (l: number) => void;
  genCompLevel: number;
  setGenCompLevel: (l: number) => void;
  genHideNotes: boolean;
  setGenHideNotes: (v: boolean) => void;
  genBassDifficulty: BassDifficulty;
  setGenBassDifficulty: (d: BassDifficulty) => void;
  // Score state for grand staff toggle
  useGrandStaff: boolean;
  onToggleGrandStaff: (v: boolean) => void;
  // Actions
  onGenerate: () => void;
  isGenerating: boolean;
  // Subscription
  limits: PlanLimits;
  openUpgrade: (reason: UpgradeReason) => void;
}

export default function GenerateSheet({
  open,
  onClose,
  genTab,
  setGenTab,
  genPracticeMode,
  setGenPracticeMode,
  genPartLevel,
  setGenPartLevel,
  genCompLevel,
  setGenCompLevel,
  genHideNotes,
  setGenHideNotes,
  genBassDifficulty,
  setGenBassDifficulty,
  useGrandStaff,
  onToggleGrandStaff,
  onGenerate,
  isGenerating,
  limits,
  openUpgrade,
}: GenerateSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.genSheetContent}>
          <View style={styles.sheetHandle} />

          {/* 헤더 */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>AI 자동생성</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* 탭 바 */}
          <View style={styles.genTabBar}>
            <TouchableOpacity
              style={[styles.genTabItem, genTab === 'melody' && styles.genTabItemActive]}
              onPress={() => setGenTab('melody')}
            >
              <Music2 size={12} color={genTab === 'melody' ? '#6366f1' : '#94a3b8'} />
              <Text style={[styles.genTabText, genTab === 'melody' && styles.genTabTextActive]}>선율</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genTabItem, genTab === 'grand' && styles.genTabItemActive]}
              onPress={() => setGenTab('grand')}
            >
              <Music2 size={12} color={genTab === 'grand' ? '#7c3aed' : '#94a3b8'} />
              <Text style={[styles.genTabText, genTab === 'grand' && styles.genTabTextActivePurple]}>큰보표</Text>
              {useGrandStaff && <View style={styles.genTabActiveDot} />}
            </TouchableOpacity>
          </View>

          {/* 탭 콘텐츠 (스크롤) */}
          <ScrollView
            contentContainerStyle={styles.genSheetInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {genTab === 'melody' ? (
              <>
                {/* 연습 모드 선택 탭 */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {(['partPractice', 'comprehensive'] as const).map(mode => {
                    const meta = TRACK_META[mode];
                    const isActive = genPracticeMode === mode;
                    const modeColor = mode === 'partPractice' ? '#6366f1' : '#f59e0b';
                    return (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setGenPracticeMode(mode)}
                        style={[
                          styles.genCatChip,
                          {
                            flex: 1,
                            backgroundColor: isActive ? modeColor : '#f1f5f9',
                            borderColor: isActive ? modeColor : '#e2e8f0',
                            borderWidth: 1.5,
                            borderRadius: 10,
                            paddingVertical: 10,
                            alignItems: 'center',
                          },
                        ]}
                      >
                        <Text style={[
                          styles.genCatChipText,
                          {
                            color: isActive ? '#fff' : '#475569',
                            fontWeight: isActive ? '700' : '600',
                            fontSize: 13,
                          },
                        ]}>
                          {meta.name}
                        </Text>
                        <Text style={{
                          color: isActive ? 'rgba(255,255,255,0.8)' : '#94a3b8',
                          fontSize: 10,
                          marginTop: 2,
                        }}>
                          {meta.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 레벨 선택 */}
                {genPracticeMode === 'partPractice' ? (
                  <>
                    <Text style={styles.genSectionLabel}>단계 선택</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {TRACK_META.partPractice.levels.map(lv => {
                        const isActive = genPartLevel === lv.level;
                        const allowed = !lv.requiresPro || limits.canUseGrandStaff;
                        return (
                          <TouchableOpacity
                            key={lv.level}
                            onPress={() => {
                              if (!allowed) { onClose(); openUpgrade('difficulty'); return; }
                              setGenPartLevel(lv.level);
                            }}
                            style={[
                              styles.genDiffBtn,
                              {
                                backgroundColor: isActive ? '#6366f1' : '#eef2ff',
                                borderColor: isActive ? '#6366f1' : '#c7d2fe',
                                opacity: allowed ? 1 : 0.45,
                                shadowColor: isActive ? '#6366f1' : 'transparent',
                                shadowOpacity: isActive ? 0.35 : 0,
                                shadowRadius: 5,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: isActive ? 3 : 0,
                              },
                            ]}
                          >
                            {!allowed && (
                              <Lock size={8} color={isActive ? 'rgba(255,255,255,0.7)' : '#4338ca99'} style={{ marginBottom: 1 }} />
                            )}
                            <Text style={[styles.genDiffBtnLabel, { color: isActive ? '#fff' : '#4338ca' }]}>
                              {lv.name}
                            </Text>
                            <Text style={[styles.genDiffBtnDesc, { color: isActive ? 'rgba(255,255,255,0.85)' : '#4338cacc' }]} numberOfLines={2}>
                              {lv.description}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* 부분연습 안내 */}
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 11, color: '#64748b', lineHeight: 16 }}>
                        선택한 요소 + 기본음표(2분·4분)만 나옵니다.{'\n'}
                        C장조 · 4/4박자 · 4마디 고정
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.genSectionLabel}>단계 선택</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {TRACK_META.comprehensive.levels.map(lv => {
                        const isActive = genCompLevel === lv.level;
                        const allowed = !lv.requiresPro || limits.canUseGrandStaff;
                        return (
                          <TouchableOpacity
                            key={lv.level}
                            onPress={() => {
                              if (!allowed) { onClose(); openUpgrade('difficulty'); return; }
                              setGenCompLevel(lv.level);
                            }}
                            style={[
                              styles.genDiffBtn,
                              {
                                backgroundColor: isActive ? '#f59e0b' : '#fffbeb',
                                borderColor: isActive ? '#f59e0b' : '#fde68a',
                                opacity: allowed ? 1 : 0.45,
                                shadowColor: isActive ? '#f59e0b' : 'transparent',
                                shadowOpacity: isActive ? 0.35 : 0,
                                shadowRadius: 5,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: isActive ? 3 : 0,
                              },
                            ]}
                          >
                            {!allowed && (
                              <Lock size={8} color={isActive ? 'rgba(255,255,255,0.7)' : '#b4530999'} style={{ marginBottom: 1 }} />
                            )}
                            <Text style={[styles.genDiffBtnLabel, { color: isActive ? '#fff' : '#b45309' }]}>
                              {lv.name}
                            </Text>
                            <Text style={[styles.genDiffBtnDesc, { color: isActive ? 'rgba(255,255,255,0.85)' : '#b45309cc' }]} numberOfLines={2}>
                              {lv.description}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* 종합연습 안내 */}
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#fffbeb', borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' }}>
                      <Text style={{ fontSize: 11, color: '#92400e', lineHeight: 16 }}>
                        선택한 범위의 모든 요소가 종합적으로 나옵니다.{'\n'}
                        조성·박자·큰보표가 랜덤으로 결정됩니다 · 8마디
                      </Text>
                    </View>
                  </>
                )}

                {/* 음표 숨기기 */}
                <View style={[styles.genOptionRow, { marginTop: 14 }, genHideNotes && { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <View style={[styles.genCardIconWrap, { backgroundColor: genHideNotes ? '#fef3c7' : '#f1f5f9' }]}>
                    {genHideNotes
                      ? <EyeOff size={13} color="#d97706" />
                      : <Eye size={13} color="#64748b" />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.genCardTitle, genHideNotes && { color: '#92400e' }]}>음표 숨기기</Text>
                    <Text style={[styles.genCardSubtitle, { marginLeft: 0 }, genHideNotes && { color: '#d97706' }]}>
                      생성된 악보의 음표를 가립니다.
                    </Text>
                  </View>
                  <Switch
                    value={genHideNotes}
                    onValueChange={setGenHideNotes}
                    trackColor={{ true: '#f59e0b', false: '#e2e8f0' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </>
            ) : (
              <>
                {/* 큰보표 토글 */}
                <View style={[styles.genOptionRow, useGrandStaff && { backgroundColor: '#faf5ff', borderColor: '#ddd6fe' }]}>
                  <View style={[styles.genCardIconWrap, { backgroundColor: useGrandStaff ? '#ede9fe' : '#f1f5f9' }]}>
                    <Music2 size={13} color={useGrandStaff ? '#7c3aed' : '#64748b'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.genCardTitle, useGrandStaff && { color: '#5b21b6' }]}>큰보표 (Grand Staff)</Text>
                    <Text style={[styles.genCardSubtitle, { marginLeft: 0 }]}>높은음자리 + 낮은음자리</Text>
                  </View>
                  {limits.canUseGrandStaff ? (
                    <Switch
                      value={useGrandStaff}
                      onValueChange={onToggleGrandStaff}
                      trackColor={{ true: '#7c3aed', false: '#e2e8f0' }}
                      thumbColor="#ffffff"
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => { onClose(); openUpgrade('grand_staff'); }}
                      style={styles.genProBadge}
                    >
                      <Lock size={11} color="#7c3aed" />
                      <Text style={styles.genProBadgeText}>PRO</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 베이스 난이도 — 항상 표시, 큰보표 OFF면 비활성 */}
                <View style={{ marginTop: 14, opacity: useGrandStaff ? 1 : 0.4 }}>
                  <Text style={[styles.genSectionLabel, { color: '#7c3aed' }]}>베이스 난이도</Text>
                  {[
                    ALL_BASS_DIFFICULTIES,
                  ].map((row, rowIdx) => (
                    <View key={rowIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                      {row.map(bd => {
                        const isActive = genBassDifficulty === bd && useGrandStaff;
                        const levelNum = bd.split('_')[1];
                        return (
                          <TouchableOpacity
                            key={bd}
                            onPress={() => { if (useGrandStaff) setGenBassDifficulty(bd); }}
                            disabled={!useGrandStaff}
                            style={[
                              styles.genBassBtn,
                              {
                                backgroundColor: isActive ? '#7c3aed' : '#ede9fe',
                                borderColor: isActive ? '#7c3aed' : '#c4b5fd',
                                shadowColor: isActive ? '#7c3aed' : 'transparent',
                                shadowOpacity: isActive ? 0.35 : 0,
                                shadowRadius: 4,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: isActive ? 3 : 0,
                              },
                            ]}
                          >
                            <Text style={[styles.genDiffBtnLabel, { color: isActive ? '#fff' : '#5b21b6' }]}>
                              {levelNum}단계
                            </Text>
                            <Text style={[styles.genDiffBtnDesc, { color: isActive ? 'rgba(255,255,255,0.85)' : '#7c3aedcc' }]} numberOfLines={2}>
                              {BASS_DIFF_DESC[bd]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* 고정 하단 - 생성 버튼 */}
          <View style={[styles.genSheetFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity
              style={styles.genPrimaryBtn}
              onPress={onGenerate}
              activeOpacity={0.85}
            >
              <Sparkles size={16} color="#fff" />
              <Text style={styles.genPrimaryBtnText}>
                생성하기
              </Text>
            </TouchableOpacity>
            <Text style={styles.genFooter}>
              현재 조성 · 박자 · 큰보표 설정이 적용됩니다. 기존 음표는 교체됩니다.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  genSheetContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
  },
  genTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
  },
  genTabItemActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  genTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  genTabTextActive: {
    color: '#6366f1',
  },
  genTabTextActivePurple: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '600',
  },
  genTabActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
  },
  genSheetInner: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  genCatChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 6,
    marginTop: 2,
  },
  genCatChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  genSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  genDiffBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  genDiffBtnLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  genDiffBtnDesc: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  genOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8edf2',
    padding: 12,
    marginBottom: 8,
  },
  genCardIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  genCardSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
    marginLeft: 34,
  },
  genProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  genProBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 0.5,
  },
  genBassBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  genSheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  genPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  genPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  genFooter: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
});
