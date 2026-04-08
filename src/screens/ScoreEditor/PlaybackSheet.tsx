import React from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import BottomSheet from '../../components/BottomSheet';
import type { UpgradeReason } from '../../components';
import {
  PlaybackMode,
  APExamSettings,
  KoreanExamSettings,
  EchoSettings,
  CustomPlaySettings,
  PLAYBACK_MODE_LABELS,
} from '../../types';
import type { PlanLimits } from '../../types';
import { styles } from './styles';

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

interface PlaybackSheetProps {
  open: boolean;
  onClose: () => void;
  // Common settings
  scaleTempo: number;
  setScaleTempo: (v: number) => void;
  metronomeFreq: number;
  setMetronomeFreq: (v: number) => void;
  showNoteCursor: boolean;
  setShowNoteCursor: (v: boolean) => void;
  showMeasureHighlight: boolean;
  setShowMeasureHighlight: (v: boolean) => void;
  // Playback mode
  playbackMode: PlaybackMode | null;
  setPlaybackMode: (m: PlaybackMode | null) => void;
  examMode: boolean;
  setExamMode: (v: boolean) => void;
  examWaitSeconds: number;
  setExamWaitSeconds: (v: number) => void;
  // Mode-specific settings
  prependBasePitch: boolean;
  setPrependBasePitch: (v: boolean) => void;
  prependMetronome: boolean;
  setPrependMetronome: (v: boolean) => void;
  apExamSettings: APExamSettings;
  setApExamSettings: React.Dispatch<React.SetStateAction<APExamSettings>>;
  koreanExamSettings: KoreanExamSettings;
  setKoreanExamSettings: React.Dispatch<React.SetStateAction<KoreanExamSettings>>;
  echoSettings: EchoSettings;
  setEchoSettings: React.Dispatch<React.SetStateAction<EchoSettings>>;
  customPlaySettings: CustomPlaySettings;
  setCustomPlaySettings: React.Dispatch<React.SetStateAction<CustomPlaySettings>>;
  // Subscription
  limits: PlanLimits;
  openUpgrade: (reason: UpgradeReason) => void;
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

const PlaybackSheet: React.FC<PlaybackSheetProps> = ({
  open,
  onClose,
  scaleTempo,
  setScaleTempo,
  metronomeFreq,
  setMetronomeFreq,
  showNoteCursor,
  setShowNoteCursor,
  showMeasureHighlight,
  setShowMeasureHighlight,
  playbackMode,
  setPlaybackMode,
  examMode,
  setExamMode,
  examWaitSeconds,
  setExamWaitSeconds,
  prependBasePitch,
  setPrependBasePitch,
  prependMetronome,
  setPrependMetronome,
  apExamSettings,
  setApExamSettings,
  koreanExamSettings,
  setKoreanExamSettings,
  echoSettings,
  setEchoSettings,
  customPlaySettings,
  setCustomPlaySettings,
  limits,
  openUpgrade,
}) => {
  const { t } = useTranslation('editor');
  return (
    <BottomSheet open={open} onClose={onClose} title={t('playback.title')}>

      {/* ── 공통 설정값 (모든 모드에 적용) ── */}
      <Text style={[styles.playOptLabel, { marginBottom: 10 }]}>{t('playback.commonSettings')}</Text>
      <View style={styles.commonSettingsRow}>
        <View style={styles.commonSettingsCard}>
          <Text style={styles.commonSettingsLabel}>{t('playback.scaleBpm')}</Text>
          <TextInput
            style={styles.commonSettingsInput}
            keyboardType="number-pad"
            value={String(scaleTempo || '')}
            onChangeText={v => { const n = parseInt(v); if (!isNaN(n)) setScaleTempo(n); }}
          />
        </View>
        <View style={styles.commonSettingsCard}>
          <Text style={styles.commonSettingsLabel}>{t('playback.countIn')}</Text>
          <TextInput
            style={styles.commonSettingsInput}
            keyboardType="number-pad"
            value={String(metronomeFreq || '')}
            onChangeText={v => { const n = parseInt(v); if (!isNaN(n)) setMetronomeFreq(n); }}
          />
        </View>
      </View>

      {/* 재생 시 표시 옵션 */}
      <View style={styles.commonSettingsRow}>
        <View style={[styles.commonSettingsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.commonSettingsLabel}>{t('playback.showNoteCursor')}</Text>
          <Switch value={showNoteCursor} onValueChange={setShowNoteCursor} />
        </View>
        <View style={[styles.commonSettingsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.commonSettingsLabel}>{t('playback.showMeasureHighlight')}</Text>
          <Switch value={showMeasureHighlight} onValueChange={setShowMeasureHighlight} />
        </View>
      </View>

      {/* ── 재생 모드 선택 (accordion) ── */}
      <Text style={[styles.playOptLabel, { marginBottom: 10 }]}>{t('playback.modeSelect')}</Text>

      {/* ① 일반 재생 */}
      {(() => {
        const isActive = !playbackMode && !examMode;
        return (
          <View style={styles.modeAccordion}>
            <TouchableOpacity
              onPress={() => { setPlaybackMode(null); setExamMode(false); }}
              style={[styles.modeCard, isActive && styles.modeCardActive, isActive && styles.modeCardExpanded]}
              activeOpacity={0.75}
            >
              <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive]}>{t('playback.normalPlay')}</Text>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive]}>{t('playback.normalPlayDesc')}</Text>
            </TouchableOpacity>

            {/* 일반 재생 설정: 스케일·카운트인 ON/OFF */}
            {isActive && (
              <View style={styles.modeSettingsBox}>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.scalePlay')}</Text>
                  <Switch value={prependBasePitch} onValueChange={setPrependBasePitch} />
                </View>
                <View style={[styles.modeOptRow, { marginBottom: 0 }]}>
                  <Text style={styles.modeOptLabel}>{t('playback.countInToggle')}</Text>
                  <Switch value={prependMetronome} onValueChange={setPrependMetronome} />
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* ② 연습 모드 */}
      {(() => {
        const isActive = playbackMode === 'practice';
        const locked = !limits.canUseExamMode;
        return (
          <View style={styles.modeAccordion}>
            <TouchableOpacity
              onPress={() => {
                if (locked) { onClose(); openUpgrade('exam_mode'); return; }
                setPlaybackMode('practice'); setExamMode(true);
              }}
              style={[styles.modeCard, isActive && styles.modeCardActive, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {locked && <Lock size={12} color="#94a3b8" />}
                <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                  {PLAYBACK_MODE_LABELS.practice}
                </Text>
                {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
              </View>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                {t('playback.practiceDesc')}
              </Text>
            </TouchableOpacity>

            {/* 연습 모드 설정 (accordion) */}
            {isActive && !locked && (
              <View style={styles.modeSettingsBox}>
                {/* 순서 표시 */}
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {t('playback.practiceSeq1')}
                    <Text style={styles.modeSeqHighlight}>{examWaitSeconds}{t('playback.seconds')}</Text>
                    {t('playback.practiceSeq2')}
                    <Text style={styles.modeSeqHighlight}>{examWaitSeconds}{t('playback.seconds')}</Text>
                    {t('playback.practiceSeq3')}
                  </Text>
                </View>
                {/* 옵션 */}
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.sectionRest')}</Text>
                  <TextInput
                    style={styles.modeOptInput}
                    keyboardType="number-pad"
                    value={String(examWaitSeconds || '')}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setExamWaitSeconds(n); }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* ③ AP 시험 모드 */}
      {(() => {
        const isActive = playbackMode === 'ap_exam';
        const locked = !limits.canUseExamMode;
        return (
          <View style={styles.modeAccordion}>
            <TouchableOpacity
              onPress={() => {
                if (locked) { onClose(); openUpgrade('exam_mode'); return; }
                setPlaybackMode('ap_exam'); setExamMode(true);
              }}
              style={[styles.modeCard, isActive && styles.modeCardActiveAP, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {locked && <Lock size={12} color="#94a3b8" />}
                <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                  {PLAYBACK_MODE_LABELS.ap_exam}
                </Text>
                {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
              </View>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                {t('playback.apDesc', { firstRest: apExamSettings.firstRestSeconds, rest: apExamSettings.restSeconds })}
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#bfdbfe' }]}>
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {t('playback.apSeq1')}
                    <Text style={styles.modeSeqHighlight}>{apExamSettings.firstRestSeconds}{t('playback.secondsRest')}</Text>
                    {t('playback.apSeq2')}
                    <Text style={styles.modeSeqHighlight}>{apExamSettings.restSeconds}{t('playback.secondsRest')}</Text>
                    {t('playback.apSeq2')}
                    <Text style={styles.modeSeqHighlight}>{apExamSettings.restSeconds}{t('playback.secondsRest')}</Text>
                    {t('playback.apSeq3')}
                  </Text>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.apFirstRest')}</Text>
                  <TextInput
                    style={styles.modeOptInput}
                    keyboardType="number-pad"
                    value={String(apExamSettings.firstRestSeconds)}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setApExamSettings(s => ({ ...s, firstRestSeconds: n })); }}
                  />
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.apRest')}</Text>
                  <TextInput
                    style={styles.modeOptInput}
                    keyboardType="number-pad"
                    value={String(apExamSettings.restSeconds)}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setApExamSettings(s => ({ ...s, restSeconds: n })); }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* ④ 한국 입시 모드 */}
      {(() => {
        const isActive = playbackMode === 'korean_exam';
        const locked = !limits.canUseExamMode;
        return (
          <View style={styles.modeAccordion}>
            <TouchableOpacity
              onPress={() => {
                if (locked) { onClose(); openUpgrade('exam_mode'); return; }
                setPlaybackMode('korean_exam'); setExamMode(true);
              }}
              style={[styles.modeCard, isActive && styles.modeCardActiveKR, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {locked && <Lock size={12} color="#94a3b8" />}
                <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                  {PLAYBACK_MODE_LABELS.korean_exam}
                </Text>
                {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
              </View>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                {t('playback.koreanDesc', { plays: koreanExamSettings.totalPlays, rest: koreanExamSettings.restSeconds })}
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#fde68a' }]}>
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {t('playback.koreanSeq1')}
                    {Array.from({ length: koreanExamSettings.totalPlays }, (_, i) => (
                      i < koreanExamSettings.totalPlays - 1 ? (
                        <Text key={i}>
                          {t('playback.fullPlay')}{' → '}
                          <Text style={styles.modeSeqHighlight}>{koreanExamSettings.restSeconds}{t('playback.secondsRest')}</Text>
                          {' → '}
                        </Text>
                      ) : (
                        <Text key={i}>{t('playback.fullPlay')}</Text>
                      )
                    ))}
                  </Text>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.playCount')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[3, 4, 5].map(n => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setKoreanExamSettings(s => ({ ...s, totalPlays: n }))}
                        style={[styles.modeCountChip, koreanExamSettings.totalPlays === n && { backgroundColor: '#d97706', borderColor: '#d97706' }]}
                      >
                        <Text style={[styles.modeCountChipText, koreanExamSettings.totalPlays === n && { color: '#fff' }]}>{t('playback.timesCount', { n })}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.playRestTime')}</Text>
                  <TextInput
                    style={styles.modeOptInput}
                    keyboardType="number-pad"
                    value={String(koreanExamSettings.restSeconds)}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setKoreanExamSettings(s => ({ ...s, restSeconds: n })); }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* ⑤ 에코 모드 (ABRSM) */}
      {(() => {
        const isActive = playbackMode === 'echo';
        const locked = !limits.canUseExamMode;
        return (
          <View style={styles.modeAccordion}>
            <TouchableOpacity
              onPress={() => {
                if (locked) { onClose(); openUpgrade('exam_mode'); return; }
                setPlaybackMode('echo'); setExamMode(true);
              }}
              style={[styles.modeCard, isActive && styles.modeCardActiveEcho, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {locked && <Lock size={12} color="#94a3b8" />}
                <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                  {PLAYBACK_MODE_LABELS.echo}
                </Text>
                {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
              </View>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                {t('playback.echoDesc', { measures: echoSettings.phraseMeasures, seconds: echoSettings.responseSeconds })}
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#bbf7d0' }]}>
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {t('playback.echoSeq1')}
                    <Text style={styles.modeSeqHighlight}>{t('playback.measuresCount', { n: echoSettings.phraseMeasures })}</Text>
                    {t('playback.echoSeq2')}
                    <Text style={styles.modeSeqHighlight}>{echoSettings.responseSeconds}{t('playback.seconds')}</Text>
                    {t('playback.echoSeq3')}
                  </Text>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.sectionSize')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[1, 2, 4].map(n => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setEchoSettings(s => ({ ...s, phraseMeasures: n }))}
                        style={[styles.modeCountChip, echoSettings.phraseMeasures === n && { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}
                      >
                        <Text style={[styles.modeCountChipText, echoSettings.phraseMeasures === n && { color: '#fff' }]}>{t('playback.measuresCount', { n })}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.responseTime')}</Text>
                  <TextInput
                    style={styles.modeOptInput}
                    keyboardType="number-pad"
                    value={String(echoSettings.responseSeconds)}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setEchoSettings(s => ({ ...s, responseSeconds: n })); }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* ⑥ 커스텀 모드 */}
      {(() => {
        const isActive = playbackMode === 'custom';
        const locked = !limits.canUseExamMode;
        const { prependScale, prependTonicChord, prependCountIn,
          totalPlays, useSegments, segmentMeasures, segmentRepeats, restSeconds } = customPlaySettings;

        // 순서 텍스트 앞부분 (스케일·으뜸화음·카운트인)
        const prefixParts: string[] = [];
        if (prependScale) prefixParts.push(t('playback.scale'));
        if (prependTonicChord) prefixParts.push(t('playback.tonicChord'));

        // 본 재생 순서 텍스트
        let bodyText = '';
        if (useSegments) {
          bodyText = `${t('playback.fullPlay')} → ${restSeconds}${t('playback.secondsRest')} → ` +
            `${t('playback.measuresCount', { n: segmentMeasures })}×${t('playback.timesCount', { n: segmentRepeats })} → ` +
            `${restSeconds}${t('playback.secondsRest')} (${t('playback.allSections')}) → ${t('playback.fullPlay')}`;
        } else {
          const playParts: string[] = [];
          for (let i = 0; i < totalPlays; i++) {
            playParts.push(t('playback.fullPlay'));
            if (i < totalPlays - 1) playParts.push(`${restSeconds}${t('playback.secondsRest')}`);
          }
          bodyText = playParts.join(' → ');
        }

        return (
          <View style={[styles.modeAccordion, { marginBottom: 0 }]}>
            <TouchableOpacity
              onPress={() => {
                if (locked) { onClose(); openUpgrade('exam_mode'); return; }
                setPlaybackMode('custom'); setExamMode(true);
              }}
              style={[styles.modeCard, isActive && styles.modeCardActiveCustom, isActive && styles.modeCardExpanded, locked && styles.modeCardLocked]}
              activeOpacity={0.75}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {locked && <Lock size={12} color="#94a3b8" />}
                <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive, locked && { color: '#94a3b8' }]}>
                  {PLAYBACK_MODE_LABELS.custom}
                </Text>
                {locked && <Text style={styles.lockedFeatureText}>PRO</Text>}
              </View>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive, locked && { color: '#cbd5e1' }]}>
                {t('playback.customDesc')}
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#e9d5ff' }]}>

                {/* ── 순서 텍스트 ── */}
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {prefixParts.length > 0 && (
                      <Text>
                        {prefixParts.join(' → ')}
                        {' → '}
                      </Text>
                    )}
                    {/* 본 재생 부분: 'N초 휴식' 토큰만 굵게 */}
                    {bodyText.split(/(\d+[^\d→]+)/).map((seg, i) =>
                      /^\d+/.test(seg) && seg.includes(t('playback.secondsRest').trim())
                        ? <Text key={i} style={styles.modeSeqHighlight}>{seg}</Text>
                        : <Text key={i}>{seg}</Text>
                    )}
                  </Text>
                </View>

                {/* ── 준비 옵션 ── */}
                <View style={[styles.modeOptRow, { marginBottom: 6 }]}>
                  <Text style={styles.modeOptLabel}>{t('playback.prependScale')}</Text>
                  <Switch value={prependScale} onValueChange={v => setCustomPlaySettings(s => ({ ...s, prependScale: v }))} trackColor={{ true: '#9333ea' }} />
                </View>
                <View style={[styles.modeOptRow, { marginBottom: 14 }]}>
                  <Text style={styles.modeOptLabel}>{t('playback.prependTonicChord')}</Text>
                  <Switch value={prependTonicChord} onValueChange={v => setCustomPlaySettings(s => ({ ...s, prependTonicChord: v }))} trackColor={{ true: '#9333ea' }} />
                </View>

                {/* ── 구간 분할 ── */}
                <View style={[styles.modeOptRow, { marginBottom: 10 }]}>
                  <Text style={styles.modeOptLabel}>{t('playback.splitSection')}</Text>
                  <Switch value={useSegments} onValueChange={v => setCustomPlaySettings(s => ({ ...s, useSegments: v }))} trackColor={{ true: '#9333ea' }} />
                </View>
                {!useSegments && (
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>{t('playback.playCount')}</Text>
                    <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(totalPlays)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, totalPlays: n })); }} />
                  </View>
                )}
                {useSegments && (
                  <>
                    <View style={styles.modeOptRow}>
                      <Text style={styles.modeOptLabel}>{t('playback.sectionSize')}</Text>
                      <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(segmentMeasures)}
                        onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, segmentMeasures: n })); }} />
                    </View>
                    <View style={styles.modeOptRow}>
                      <Text style={styles.modeOptLabel}>{t('playback.sectionRepeat')}</Text>
                      <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(segmentRepeats)}
                        onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, segmentRepeats: n })); }} />
                    </View>
                  </>
                )}
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>{t('playback.restTime')}</Text>
                  <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(restSeconds)}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, restSeconds: n })); }} />
                </View>
              </View>
            )}
          </View>
        );
      })()}

    </BottomSheet>
  );
};

export default PlaybackSheet;
