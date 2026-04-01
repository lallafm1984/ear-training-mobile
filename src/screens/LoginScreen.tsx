import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Music2 } from 'lucide-react-native';
import { useAuth } from '../context';

import Svg, { Path } from 'react-native-svg';

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.5 16.3 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.5 35.3 44 30 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </Svg>
  );
}

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 로고 */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Music2 size={36} color="#6366f1" />
          </View>
          <Text style={styles.logoTitle}>MelodyGen</Text>
          <Text style={styles.logoSub}>실시간 청음 시험 자동 생성기</Text>
        </View>

        {/* Google 로그인 버튼 */}
        <TouchableOpacity
          style={[styles.googleBtn, loading && { opacity: 0.7 }]}
          onPress={handleGoogle}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#374151" size="small" />
            : <GoogleLogo size={20} />}
          <Text style={styles.googleBtnText}>Google로 계속하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },

  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logoIcon: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  logoTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: '#94a3b8', marginTop: 6 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 16, height: 56,
    width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
