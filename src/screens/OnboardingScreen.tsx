// ─────────────────────────────────────────────────────────────
// OnboardingScreen — 신규 사용자 환영 및 가이드
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  FlatList, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Music, Headphones, Target, BarChart3, ChevronRight,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme/colors';
import type { MainStackParamList } from '../navigation/MainStack';

type NavProp = StackNavigationProp<MainStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = '@melodygen_onboarding_done';

interface SlideData {
  id: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  title: string;
  description: string;
}

const SLIDES: SlideData[] = [
  {
    id: '1',
    icon: Music,
    color: COLORS.primary500,
    bgColor: '#eef2ff',
    title: 'auth:onboarding.slide1Title',
    description: 'auth:onboarding.slide1Desc',
  },
  {
    id: '2',
    icon: Headphones,
    color: '#10b981',
    bgColor: '#ecfdf5',
    title: 'auth:onboarding.slide2Title',
    description: 'auth:onboarding.slide2Desc',
  },
  {
    id: '3',
    icon: Target,
    color: COLORS.amber500,
    bgColor: '#fffbeb',
    title: 'auth:onboarding.slide3Title',
    description: 'auth:onboarding.slide3Desc',
  },
  {
    id: '4',
    icon: BarChart3,
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    title: 'auth:onboarding.slide4Title',
    description: 'auth:onboarding.slide4Desc',
  },
];

export default function OnboardingScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      try {
        flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      } catch { /* layout not ready */ }
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Home');
  };

  const handleStart = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Home');
  };

  const isLast = currentIndex === SLIDES.length - 1;

  const renderSlide = ({ item }: { item: SlideData }) => {
    const IconComp = item.icon;
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View style={[styles.iconCircle, { backgroundColor: item.bgColor }]}>
          <IconComp size={48} color={item.color} />
        </View>
        <Text style={styles.slideTitle}>{t(item.title)}</Text>
        <Text style={styles.slideDesc}>{t(item.description)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        {!isLast && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('common:button.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(idx);
        }}
      />

      {/* 인디케이터 */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, idx) => {
          const inputRange = [
            (idx - 1) * SCREEN_WIDTH,
            idx * SCREEN_WIDTH,
            (idx + 1) * SCREEN_WIDTH,
          ];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={idx}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: SLIDES[currentIndex].color,
                },
              ]}
            />
          );
        })}
      </View>

      {/* 하단 버튼 */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {isLast ? (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: COLORS.primary500 }]}
            onPress={handleStart}
          >
            <Text style={styles.startText}>{t('common:button.start')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: SLIDES[currentIndex].color }]}
            onPress={handleNext}
          >
            <Text style={styles.nextText}>{t('common:button.next')}</Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

/** 온보딩 완료 여부 확인 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === 'true';
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 44,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.slate400,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.slate800,
    textAlign: 'center',
  },
  slideDesc: {
    fontSize: 15,
    color: COLORS.slate500,
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 4,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  startBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  startText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
