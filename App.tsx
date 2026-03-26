import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { AlertProvider } from './src/context/AlertContext';
import ScoreEditorScreen from './src/screens/ScoreEditorScreen';
import LoginScreen from './src/screens/LoginScreen';

// ─────────────────────────────────────────────────────────────
// Auth 게이트: 로그인 여부에 따라 화면 분기
// ─────────────────────────────────────────────────────────────

function AppNavigator() {
  const { session, loading, profileLoading } = useAuth();
  const prevGateRef = useRef<string>('');

  useEffect(() => {
    const gate = loading ? 'loading' : (session && profileLoading) ? 'profileLoading' : !session ? 'login' : 'editor';
    if (prevGateRef.current !== gate) {
      prevGateRef.current = gate;
      // #region agent log
      fetch('http://127.0.0.1:7799/ingest/6d247eca-612c-4796-b0fb-a95a95970bf4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'62f487'},body:JSON.stringify({sessionId:'62f487',location:'App.tsx:AppNavigator',message:'nav gate',data:{gate,loading,profileLoading:!!(session&&profileLoading),hasSession:!!session},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    }
  }, [loading, session, profileLoading]);

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
      <StatusBar style="light" backgroundColor="#6366f1" />
      <AlertProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}
