import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth, SubscriptionProvider, AlertProvider } from './src/context';
import { LoginScreen } from './src/screens';
import MainStack from './src/navigation/MainStack';
import ErrorBoundary from './src/components/ErrorBoundary';

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

  // 로그인 완료 → 홈 대시보드 (네비게이션 스택)
  return (
    <SubscriptionProvider>
      <MainStack />
    </SubscriptionProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#6366f1" />
        <NavigationContainer>
          <AlertProvider>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
          </AlertProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
