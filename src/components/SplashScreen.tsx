// ─────────────────────────────────────────────────────────────
// SplashScreen — 앱 초기 로딩 화면
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Music } from 'lucide-react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Music size={36} color="#6366f1" />
      </View>
      <Text style={styles.appName}>MelodyGen</Text>
      <ActivityIndicator size="small" color="#6366f1" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#6366f1',
  },
  spinner: {
    marginTop: 16,
  },
});
