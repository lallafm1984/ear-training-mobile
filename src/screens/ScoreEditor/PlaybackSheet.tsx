import React from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Lock } from 'lucide-react-native';

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
  limits: any;
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
  return (
    <BottomSheet open={open} onClose={onClose} title="재생 옵션">

      {/* ── 공통 설정값 (모든 모드에 적용) ── */}
      <Text style={[styles.playOptLabel, { marginBottom: 10 }]}>공통 설정</Text>
      <View style={styles.commonSettingsRow}>
        <View style={styles.commonSettingsCard}>
          <Text style={styles.commonSettingsLabel}>스케일 BPM</Text>
          <TextInput
            style={styles.commonSettingsInput}
            keyboardType="number-pad"
            value={String(scaleTempo || '')}
            onChangeText={v => { const n = parseInt(v); if (!isNaN(n)) setScaleTempo(n); }}
          />
        </View>
        <View style={styles.commonSettingsCard}>
          <Text style={styles.commonSettingsLabel}>카운트인 (Hz)</Text>
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
          <Text style={styles.commonSettingsLabel}>현재 음표 표시</Text>
          <Switch value={showNoteCursor} onValueChange={setShowNoteCursor} />
        </View>
        <View style={[styles.commonSettingsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.commonSettingsLabel}>현재 마디 표시</Text>
          <Switch value={showMeasureHighlight} onValueChange={setShowMeasureHighlight} />
        </View>
      </View>

      {/* ── 재생 모드 선택 (accordion) ── */}
      <Text style={[styles.playOptLabel, { marginBottom: 10 }]}>재생 모드</Text>

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
              <Text style={[styles.modeCardTitle, isActive && styles.modeCardTitleActive]}>일반 재생</Text>
              <Text style={[styles.modeCardDesc, isActive && styles.modeCardDescActive]}>전체를 한 번 재생합니다</Text>
            </TouchableOpacity>

            {/* 일반 재생 설정: 스케일·카운트인 ON/OFF */}
            {isActive && (
              <View style={styles.modeSettingsBox}>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>스케일 재생</Text>
                  <Switch value={prependBasePitch} onValueChange={setPrependBasePitch} />
                </View>
                <View style={[styles.modeOptRow, { marginBottom: 0 }]}>
                  <Text style={styles.modeOptLabel}>카운트인</Text>
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
                구간별 반복 훈련 · 슬라이딩 방식
              </Text>
            </TouchableOpacity>

            {/* 연습 모드 설정 (accordion) */}
            {isActive && !locked && (
              <View style={styles.modeSettingsBox}>
                {/* 순서 표시 */}
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {'스케일 → 전체 재생 → '}
                    <Text style={styles.modeSeqHighlight}>{examWaitSeconds}초</Text>
                    {'\n→ 2마디씩 ×2회 + 4마디 누적 ('}
                    <Text style={styles.modeSeqHighlight}>{examWaitSeconds}초</Text>
                    {' 휴식)\n→ 다음 2마디로 이동, 반복\n→ 전체 재생'}
                  </Text>
                </View>
                {/* 옵션 */}
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>구간 휴식 (초)</Text>
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
                4회 통재생 · 첫 휴식 {apExamSettings.firstRestSeconds}초 · 이후 {apExamSettings.restSeconds}초
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#bfdbfe' }]}>
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {'스케일 → 으뜸화음 → 전체 재생 →\n'}
                    <Text style={styles.modeSeqHighlight}>{apExamSettings.firstRestSeconds}초 휴식</Text>
                    {' → 전체 재생 →\n'}
                    <Text style={styles.modeSeqHighlight}>{apExamSettings.restSeconds}초 휴식</Text>
                    {' → 전체 재생 →\n'}
                    <Text style={styles.modeSeqHighlight}>{apExamSettings.restSeconds}초 휴식</Text>
                    {' → 전체 재생'}
                  </Text>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>1회차 후 휴식 (초)</Text>
                  <TextInput
                    style={styles.modeOptInput}
                    keyboardType="number-pad"
                    value={String(apExamSettings.firstRestSeconds)}
                    onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setApExamSettings(s => ({ ...s, firstRestSeconds: n })); }}
                  />
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>2·3·4회차 후 휴식 (초)</Text>
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
                {koreanExamSettings.totalPlays}회 통재생 · {koreanExamSettings.restSeconds}초 휴식
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#fde68a' }]}>
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {'스케일 → 으뜸화음 → 시작음 →\n'}
                    {Array.from({ length: koreanExamSettings.totalPlays }, (_, i) => (
                      i < koreanExamSettings.totalPlays - 1 ? (
                        <Text key={i}>
                          {'전체 재생 → '}
                          <Text style={styles.modeSeqHighlight}>{koreanExamSettings.restSeconds}초 휴식</Text>
                          {' → '}
                        </Text>
                      ) : (
                        <Text key={i}>{'전체 재생'}</Text>
                      )
                    ))}
                  </Text>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>재생 횟수</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[3, 4, 5].map(n => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setKoreanExamSettings(s => ({ ...s, totalPlays: n }))}
                        style={[styles.modeCountChip, koreanExamSettings.totalPlays === n && { backgroundColor: '#d97706', borderColor: '#d97706' }]}
                      >
                        <Text style={[styles.modeCountChipText, koreanExamSettings.totalPlays === n && { color: '#fff' }]}>{n}회</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>재생 간 휴식 (초)</Text>
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
                {echoSettings.phraseMeasures}마디씩 · {echoSettings.responseSeconds}초 응답
              </Text>
            </TouchableOpacity>

            {isActive && !locked && (
              <View style={[styles.modeSettingsBox, { borderColor: '#bbf7d0' }]}>
                <View style={styles.modeSeqBox}>
                  <Text style={styles.modeSeqText}>
                    {'스케일 → 으뜸화음 →\n('}
                    <Text style={styles.modeSeqHighlight}>{echoSettings.phraseMeasures}마디</Text>
                    {' 재생 → '}
                    <Text style={styles.modeSeqHighlight}>{echoSettings.responseSeconds}초</Text>
                    {' 응답) × 마디 수 만큼 반복'}
                  </Text>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>구간 크기 (마디)</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[1, 2, 4].map(n => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setEchoSettings(s => ({ ...s, phraseMeasures: n }))}
                        style={[styles.modeCountChip, echoSettings.phraseMeasures === n && { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}
                      >
                        <Text style={[styles.modeCountChipText, echoSettings.phraseMeasures === n && { color: '#fff' }]}>{n}마디</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>응답 시간 (초)</Text>
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
        if (prependScale) prefixParts.push('스케일');
        if (prependTonicChord) prefixParts.push('으뜸화음');

        // 본 재생 순서 텍스트
        let bodyText = '';
        if (useSegments) {
          bodyText = `전체 재생 → ${restSeconds}초 휴식 → ` +
            `${segmentMeasures}마디×${segmentRepeats}회 → ` +
            `${restSeconds}초 휴식 (전 구간 반복) → 전체 재생`;
        } else {
          const playParts: string[] = [];
          for (let i = 0; i < totalPlays; i++) {
            playParts.push('전체 재생');
            if (i < totalPlays - 1) playParts.push(`${restSeconds}초 휴식`);
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
                재생 횟수·구간·휴식 직접 설정
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
                    {/* 본 재생 부분: '초 휴식' 토큰만 굵게 */}
                    {bodyText.split(/(\d+초 휴식)/g).map((seg, i) =>
                      /^\d+초 휴식$/.test(seg)
                        ? <Text key={i} style={styles.modeSeqHighlight}>{seg}</Text>
                        : <Text key={i}>{seg}</Text>
                    )}
                  </Text>
                </View>

                {/* ── 준비 옵션 ── */}
                <View style={[styles.modeOptRow, { marginBottom: 6 }]}>
                  <Text style={styles.modeOptLabel}>스케일 재생</Text>
                  <Switch value={prependScale} onValueChange={v => setCustomPlaySettings(s => ({ ...s, prependScale: v }))} trackColor={{ true: '#9333ea' }} />
                </View>
                <View style={[styles.modeOptRow, { marginBottom: 14 }]}>
                  <Text style={styles.modeOptLabel}>으뜸화음 재생</Text>
                  <Switch value={prependTonicChord} onValueChange={v => setCustomPlaySettings(s => ({ ...s, prependTonicChord: v }))} trackColor={{ true: '#9333ea' }} />
                </View>

                {/* ── 구간 분할 ── */}
                <View style={[styles.modeOptRow, { marginBottom: 10 }]}>
                  <Text style={styles.modeOptLabel}>구간 분할</Text>
                  <Switch value={useSegments} onValueChange={v => setCustomPlaySettings(s => ({ ...s, useSegments: v }))} trackColor={{ true: '#9333ea' }} />
                </View>
                {!useSegments && (
                  <View style={styles.modeOptRow}>
                    <Text style={styles.modeOptLabel}>재생 횟수</Text>
                    <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(totalPlays)}
                      onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, totalPlays: n })); }} />
                  </View>
                )}
                {useSegments && (
                  <>
                    <View style={styles.modeOptRow}>
                      <Text style={styles.modeOptLabel}>구간 크기 (마디)</Text>
                      <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(segmentMeasures)}
                        onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, segmentMeasures: n })); }} />
                    </View>
                    <View style={styles.modeOptRow}>
                      <Text style={styles.modeOptLabel}>구간 반복 횟수</Text>
                      <TextInput style={styles.modeOptInput} keyboardType="number-pad" value={String(segmentRepeats)}
                        onChangeText={v => { const n = parseInt(v); if (!isNaN(n) && n > 0) setCustomPlaySettings(s => ({ ...s, segmentRepeats: n })); }} />
                    </View>
                  </>
                )}
                <View style={styles.modeOptRow}>
                  <Text style={styles.modeOptLabel}>휴식 시간 (초)</Text>
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
