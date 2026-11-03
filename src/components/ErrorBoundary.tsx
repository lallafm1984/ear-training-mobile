// ─────────────────────────────────────────────────────────────
// ErrorBoundary — 에러 발생 시 앱 크래시 방지 + 복구 UI
// ─────────────────────────────────────────────────────────────

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { logger } from '../lib/logger';
import i18n from '../i18n';

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
    logger.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AlertTriangle size={48} color={COLORS.error} />
          <Text style={styles.title}>{i18n.t('common:errorBoundary.title')}</Text>
          <Text style={styles.message}>{i18n.t('common:errorBoundary.message')}</Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetail} numberOfLines={5}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={this.handleReset}
            accessibilityRole="button"
          >
            <RotateCcw size={18} color="#fff" />
            <Text style={styles.retryText}>{i18n.t('common:errorBoundary.retry')}</Text>
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
    backgroundColor: COLORS.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate800,
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.slate500,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorDetail: {
    fontSize: 11,
    color: COLORS.slate400,
    backgroundColor: COLORS.slate100,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    fontFamily: 'monospace',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary500,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
});
