// ─────────────────────────────────────────────────────────────
// ErrorBoundary — 에러 발생 시 앱 크래시 방지 + 복구 UI
// ─────────────────────────────────────────────────────────────

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AlertTriangle size={48} color="#ef4444" />
          <Text style={styles.title}>문제가 발생했습니다</Text>
          <Text style={styles.message}>
            앱에서 예기치 않은 오류가 발생했습니다.{'\n'}
            아래 버튼을 눌러 다시 시도해 주세요.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetail} numberOfLines={5}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleReset}>
            <RotateCcw size={18} color="#fff" />
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorDetail: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    fontFamily: 'monospace',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
