// ─────────────────────────────────────────────────────────────
// MainStack — 인증 후 메인 네비게이션
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import ScoreEditorScreen from '../screens/ScoreEditor';
import CategoryPracticeScreen from '../screens/CategoryPracticeScreen';
import PaywallScreen from '../screens/PaywallScreen';
import ProfileScreen from '../screens/ProfileScreen';

import type { ContentCategory, ContentDifficulty } from '../types/content';

// ─────────────────────────────────────────────────────────────
// 네비게이션 파라미터 타입
// ─────────────────────────────────────────────────────────────

export type MainStackParamList = {
  Home: undefined;
  CategoryPractice: { category: ContentCategory };
  ScoreEditor: {
    category?: ContentCategory;
    difficulty?: ContentDifficulty;
    practiceMode?: 'partPractice' | 'comprehensive';
    level?: number;
  } | undefined;
  Paywall: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<MainStackParamList>();

export default function MainStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CategoryPractice" component={CategoryPracticeScreen} />
      <Stack.Screen name="ScoreEditor" component={ScoreEditorScreen} />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
