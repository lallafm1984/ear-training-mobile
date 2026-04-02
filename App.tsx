import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth, SubscriptionProvider, AlertProvider } from './src/context';
import {
  ScoreEditorScreen, LoginScreen, HomeScreen, TrackDetailScreen,
} from './src/screens';
import type { TrackType } from './src/theme';
import { useSkillProfile } from './src/hooks';

// ─────────────────────────────────────────────────────────────
// 네비게이션 상태 타입
// ─────────────────────────────────────────────────────────────

type Screen =
  | { name: 'home' }
  | { name: 'trackDetail'; track: TrackType }
  | { name: 'editor'; trackMode?: { track: TrackType; level: number } }
;

// ─────────────────────────────────────────────────────────────
// 메인 앱 (인증 후)
// ─────────────────────────────────────────────────────────────

function MainApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const { profile: skillProfile, applyEvaluation, updateStreak } = useSkillProfile();

  // Home → 트랙 연습 시작
  const handleStartTrack = useCallback((track: TrackType, level: number) => {
    setScreen({ name: 'editor', trackMode: { track, level } });
  }, []);

  // Home → 트랙 상세
  const handleOpenTrackDetail = useCallback((track: TrackType) => {
    setScreen({ name: 'trackDetail', track });
  }, []);

  // Home → 자유 연습 (기존 ScoreEditorScreen)
  const handleOpenFreePlay = useCallback(() => {
    setScreen({ name: 'editor' });
  }, []);

  // Home → 프로필 (ScoreEditorScreen 내부 모달로 처리)
  const handleOpenProfile = useCallback(() => {
    setScreen({ name: 'editor' });
  }, []);

  // 뒤로가기
  const handleBack = useCallback(() => {
    setScreen({ name: 'home' });
  }, []);

  // TrackDetail → 레벨 시작
  const handleStartLevel = useCallback((track: TrackType, level: number) => {
    setScreen({ name: 'editor', trackMode: { track, level } });
  }, []);

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          onStartTrack={handleStartTrack}
          onOpenTrackDetail={handleOpenTrackDetail}
          onOpenFreePlay={handleOpenFreePlay}
          onOpenProfile={handleOpenProfile}
          skillProfile={skillProfile}
        />
      );

    case 'trackDetail':
      return (
        <TrackDetailScreen
          track={screen.track}
          onBack={handleBack}
          onStartLevel={handleStartLevel}
          skillProfile={skillProfile}
        />
      );

    case 'editor':
      return (
        <ScoreEditorScreen
          trackMode={screen.trackMode}
          onBackToHome={handleBack}
          onEvaluate={applyEvaluation}
          onPracticeComplete={updateStreak}
        />
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Auth 게이트: 로그인 여부에 따라 화면 분기
// ─────────────────────────────────────────────────────────────

function AppNavigator() {
  const { session, loading, profileLoading } = useAuth();

  // 초기 세션 복원 중 또는 프로필 로딩 중
  if (loading || (session && profileLoading)) {
    const message = loading ? '앱을 시작하는 중...' : '계정 정보를 불러오는 중...';
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ marginTop: 16, fontSize: 14, color: '#6b7280' }}>{message}</Text>
      </View>
    );
  }

  // 미로그인 → 로그인 화면
  if (!session) {
    return <LoginScreen />;
  }

  // 로그인 완료 → 메인 앱
  return (
    <SubscriptionProvider>
      <MainApp />
    </SubscriptionProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#6366f1" />
      <AlertProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}
