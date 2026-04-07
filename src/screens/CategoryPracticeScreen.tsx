// ─────────────────────────────────────────────────────────────
// CategoryPracticeScreen — 카테고리별 난이도 선택 → 연습 진입
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Play, Settings2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';

import { useSubscription } from '../context';
import { COLORS } from '../theme/colors';
import { CATEGORY_COLORS } from '../theme/colors';
import {
  getContentConfig, getDifficultyList, getDifficultyLabel,
} from '../lib/contentConfig';
import type { ContentCategory, ContentDifficulty } from '../types/content';
import type { MainStackParamList, PracticeSettings } from '../navigation/MainStack';
import PracticeSettingsSheet from '../components/PracticeSettingsSheet';

type RouteProp = StackScreenProps<MainStackParamList, 'CategoryPractice'>['route'];
type NavProp = StackNavigationProp<MainStackParamList>;

export default function CategoryPracticeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { category } = route.params;
  const { tier } = useSubscription();

  const config = getContentConfig(category);
  const colors = CATEGORY_COLORS[category];
  const difficulties = getDifficultyList(category);

  const [selectedDiff, setSelectedDiff] = useState<ContentDifficulty>(difficulties[0]);
  const showSettings = category === 'melody' || category === 'twoVoice';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    timeSignature: '4/4',
    keySignature: 'C',
    tempo: 80,
  });

  const selectedIndex = difficulties.indexOf(selectedDiff);
  const isLocked = tier === 'free' && selectedIndex >= config.freeMaxLevel;

  const handleStart = () => {
    if (isLocked) {
      navigation.navigate('Paywall');
      return;
    }

    // 선율/2성부/리듬은 기보형 연습 전용 화면, 음정/화성/조성은 객관식 화면
    if (category === 'melody' || category === 'twoVoice' || category === 'rhythm') {
      navigation.navigate('NotationPractice', {
        category,
        difficulty: selectedDiff,
        ...(showSettings && { practiceSettings }),
      });
    } else {
      navigation.navigate('ChoicePractice', {
        category,
        difficulty: selectedDiff,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <ArrowLeft size={24} color={colors.main} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.main }]}>{config.name}</Text>
          <Text style={styles.headerDesc}>{config.description}</Text>
        </View>
      </View>

      {/* 스크롤 영역: 난이도 목록 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 난이도 선택 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>난이도 선택</Text>
          {showSettings && (
            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              style={[styles.settingsBtn, { backgroundColor: colors.bg }]}
              hitSlop={8}
            >
              <Settings2 size={16} color={colors.main} />
              <Text style={[styles.settingsBtnText, { color: colors.main }]}>설정</Text>
            </TouchableOpacity>
          )}
        </View>

        {showSettings && (
          practiceSettings.timeSignature !== '4/4' ||
          practiceSettings.keySignature !== 'C' ||
          practiceSettings.tempo !== 80
        ) && (
          <View style={[styles.settingsSummary, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
            <Text style={[styles.settingsSummaryText, { color: colors.main }]}>
              {[
                practiceSettings.timeSignature !== '4/4' && practiceSettings.timeSignature,
                practiceSettings.keySignature !== 'C' && practiceSettings.keySignature,
                practiceSettings.tempo !== 80 && `♩=${practiceSettings.tempo}`,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        <View style={styles.diffList}>
          {difficulties.map((diff, index) => {
            const locked = tier === 'free' && index >= config.freeMaxLevel;
            const active = diff === selectedDiff;
            return (
              <TouchableOpacity
                key={diff}
                style={[
                  styles.diffItem,
                  active && { backgroundColor: colors.main, borderColor: colors.main },
                  locked && styles.diffLocked,
                ]}
                onPress={() => setSelectedDiff(diff)}
                activeOpacity={0.7}
              >
                <View style={styles.diffLeft}>
                  <View style={[
                    styles.levelBadge,
                    active
                      ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                      : { backgroundColor: colors.bg },
                  ]}>
                    <Text style={[
                      styles.levelText,
                      active ? { color: '#fff' } : { color: colors.main },
                    ]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.diffLabel,
                      active && { color: '#fff' },
                    ]}
                    numberOfLines={1}
                  >
                    {getDifficultyLabel(category, diff)}
                  </Text>
                </View>
                {locked && <Lock size={14} color={active ? '#fff' : '#94a3b8'} />}
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      {/* 하단 고정 시작 버튼 (MockExamSetupScreen과 동일 패턴) */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[
            styles.startBtn,
            { backgroundColor: isLocked ? COLORS.slate300 : colors.main },
          ]}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          {isLocked ? (
            <>
              <Lock size={20} color="#fff" />
              <Text style={styles.startText}>Pro 업그레이드 필요</Text>
            </>
          ) : (
            <>
              <Play size={20} color="#fff" fill="#fff" />
              <Text style={styles.startText}>연습 시작</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {showSettings && (
        <PracticeSettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={practiceSettings}
          onChangeSettings={setPracticeSettings}
          accentColor={colors.main}
          accentBg={colors.bg}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  headerDesc: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate800,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settingsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  settingsSummary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  settingsSummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffList: {
    gap: 8,
  },
  diffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    backgroundColor: COLORS.white,
  },
  diffLocked: {
    opacity: 0.6,
  },
  diffLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  levelBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '800',
  },
  diffLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate700,
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
    backgroundColor: COLORS.bgPrimary,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
