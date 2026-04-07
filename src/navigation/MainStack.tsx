// ─────────────────────────────────────────────────────────────
// MainStack — 인증 후 메인 네비게이션
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '../components/SplashScreen';

import HomeScreen from '../screens/HomeScreen';
import ScoreEditorScreen from '../screens/ScoreEditor';
import CategoryPracticeScreen from '../screens/CategoryPracticeScreen';
import ChoicePracticeScreen from '../screens/ChoicePracticeScreen';
import NotationPracticeScreen from '../screens/NotationPracticeScreen';
import MockExamSetupScreen from '../screens/MockExamSetupScreen';
import MockExamScreen from '../screens/MockExamScreen';
import ExamResultScreen from '../screens/ExamResultScreen';
import StatsScreen from '../screens/StatsScreen';
import OnboardingScreen, { hasCompletedOnboarding } from '../screens/OnboardingScreen';
import PaywallScreen from '../screens/PaywallScreen';
import ProfileScreen from '../screens/ProfileScreen';

import type { ContentCategory, ContentDifficulty } from '../types/content';

export interface PracticeSettings {
  timeSignature: string;
  keySignature: string;
  tempo: number;
  rhythmPitch?: string;   // 리듬 받아쓰기 음이름 (기본 'B' = 시)
}

// ─────────────────────────────────────────────────────────────
// 네비게이션 파라미터 타입
// ─────────────────────────────────────────────────────────────

export type MainStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  CategoryPractice: { category: ContentCategory };
  ChoicePractice: { category: ContentCategory; difficulty: ContentDifficulty };
  NotationPractice: { category: ContentCategory; difficulty: ContentDifficulty; practiceSettings?: PracticeSettings };
  ScoreEditor: {
    category?: ContentCategory;
    difficulty?: ContentDifficulty;
    practiceMode?: 'partPractice' | 'comprehensive';
    level?: number;
  } | undefined;
  MockExamSetup: undefined;
  MockExam: { presetId: string };
  ExamResult: {
    presetId: string;
    title: string;
    totalScore: number;
    maxScore: number;
    categoryScores: string;
    elapsedSeconds: number;
    totalQuestions: number;
  };
  Stats: undefined;
  Paywall: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<MainStackParamList>();

export default function MainStack() {
  const [initialRoute, setInitialRoute] = useState<keyof MainStackParamList | null>(null);

  useEffect(() => {
    hasCompletedOnboarding().then(done => {
      setInitialRoute(done ? 'Home' : 'Onboarding');
    });
  }, []);

  // 초기 라우트 결정 대기
  if (!initialRoute) return <SplashScreen />;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CategoryPractice" component={CategoryPracticeScreen} />
      <Stack.Screen name="ChoicePractice" component={ChoicePracticeScreen} />
      <Stack.Screen name="NotationPractice" component={NotationPracticeScreen} />
      <Stack.Screen name="ScoreEditor" component={ScoreEditorScreen} />
      <Stack.Screen name="MockExamSetup" component={MockExamSetupScreen} />
      <Stack.Screen name="MockExam" component={MockExamScreen} />
      <Stack.Screen name="ExamResult" component={ExamResultScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen
        name="Paywall"
        options={{ presentation: 'modal' }}
      >
        {({ navigation }) => (
          <PaywallScreen onClose={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Profile"
        options={{ presentation: 'modal' }}
      >
        {({ navigation }) => (
          <ProfileScreen
            onClose={() => navigation.goBack()}
            onGoToPaywall={() => navigation.navigate('Paywall')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
