// ─────────────────────────────────────────────────────────────
// MascotGalleryScreen — 마스코트 100레벨 갤러리 (테스트용)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { COLORS } from '../theme/colors';
import { STAGE_NAMES, getMascotParams } from '../lib/mascotConfig';
import { useMascotExp } from '../hooks/useMascotExp';
import MascotCharacter from '../components/MascotCharacter';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;

const ALL_LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);

export default function MascotGalleryScreen() {
  const navigation = useNavigation<NavProp>();
  const { level: currentLevel, totalExp } = useMascotExp();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.primary500} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>마스코트 갤러리</Text>
          <Text style={styles.headerSub}>현재 Lv.{currentLevel} · {totalExp} EXP</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 스테이지별 그룹 */}
        {STAGE_NAMES.map((stageName, stageIdx) => {
          const startLevel = stageIdx * 6 + 1;
          const endLevel = stageIdx * 6 + 6;
          const stageLevels = ALL_LEVELS.slice(stageIdx * 6, stageIdx * 6 + 6);
          const stageColor = getMascotParams(startLevel).bodyColor;

          return (
            <View key={stageIdx}>
              {/* 스테이지 헤더 */}
              <View style={[styles.stageHeader, { backgroundColor: stageColor + '15' }]}>
                <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
                <Text style={[styles.stageName, { color: stageColor }]}>
                  {stageName}
                </Text>
                <Text style={styles.stageRange}>
                  Lv.{startLevel} ~ {endLevel}
                </Text>
              </View>

              {/* 레벨 그리드 */}
              <View style={styles.grid}>
                {stageLevels.map(lv => {
                  const isUnlocked = lv <= currentLevel;
                  const isCurrent = lv === currentLevel;
                  const params = getMascotParams(lv);

                  return (
                    <View
                      key={lv}
                      style={[
                        styles.card,
                        isCurrent && styles.cardCurrent,
                      ]}
                    >
                      <MascotCharacter size={56} level={lv} />
                      <Text style={[
                        styles.cardLevel,
                        isCurrent && { color: COLORS.primary500, fontWeight: '900' },
                        !isUnlocked && { color: COLORS.slate300 },
                      ]}>
                        Lv.{lv}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.slate800,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.slate500,
    marginTop: 1,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 4,
  },
  // 스테이지
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stageName: {
    fontSize: 15,
    fontWeight: '800',
  },
  stageRange: {
    fontSize: 11,
    color: COLORS.slate400,
    marginLeft: 'auto',
  },
  // 그리드 (5열)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },
  card: {
    width: '18.5%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  cardCurrent: {
    borderColor: COLORS.primary500,
    borderWidth: 2,
    backgroundColor: '#eef2ff',
  },
  cardLocked: {
    opacity: 0.4,
  },
  lockedOverlay: {
    opacity: 0.5,
  },
  cardLevel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slate500,
    marginTop: 4,
  },
});
