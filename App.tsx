import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import ScoreEditorScreen from './src/screens/ScoreEditorScreen';
import LoginScreen from './src/screens/LoginScreen';

// ─────────────────────────────────────────────────────────────
// Auth 게이트: 로그인 여부에 따라 화면 분기
// ─────────────────────────────────────────────────────────────

function AppNavigator() {
  const { session, loading } = useAuth();

  // 초기 세션 복원 중 — 스플래시 유지
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#6366f1" />
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
      <ScoreEditorScreen />
    </SubscriptionProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#f8fafc" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
