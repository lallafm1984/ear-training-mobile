import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { AlertConfig } from '../context/AlertContext';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  config: AlertConfig | null;
  onClose: () => void;
}

const TYPE_CONFIG = {
  success: { Icon: CheckCircle,    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  error:   { Icon: XCircle,        color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  warning: { Icon: AlertTriangle,  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  info:    { Icon: Info,           color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
};

export default function AppAlert({ visible, config, onClose }: Props) {
  const { t } = useTranslation('common');
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!config) return null;

  const type = config.type ?? 'info';
  const { Icon, color, bg, border } = TYPE_CONFIG[type];
  const buttons = config.buttons ?? [{ text: t('common:button.confirm') }];

  const handlePress = (btn: typeof buttons[number]) => {
    onClose();
    if (btn.onPress) setTimeout(btn.onPress, 60);
  };

  const handleBackdropPress = () => {
    const cancelBtn = buttons.find(b => b.style === 'cancel');
    if (cancelBtn) handlePress(cancelBtn);
    else onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />

        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* 아이콘 */}
          <View style={[styles.iconWrap, { backgroundColor: bg, borderColor: border }]}>
            <Icon size={26} color={color} />
          </View>

          {/* 제목 */}
          <Text style={[styles.title, !config.message && { marginBottom: 22 }]}>
            {config.title}
          </Text>

          {/* 메시지 */}
          {!!config.message && (
            <Text style={styles.message}>{config.message}</Text>
          )}

          {/* 버튼 */}
          <View style={[styles.btnRow, buttons.length === 1 && styles.btnRowSingle]}>
            {buttons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel      = btn.style === 'cancel';
              const isPrimary     = !isDestructive && !isCancel;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    isPrimary    && styles.btnPrimary,
                    isDestructive && styles.btnDestructive,
                    isCancel     && styles.btnCancel,
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.btnText,
                    isPrimary    && styles.btnTextPrimary,
                    isDestructive && styles.btnTextDestructive,
                    isCancel     && styles.btnTextCancel,
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: W - 56,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 9,
    width: '100%',
  },
  btnRowSingle: {
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
  },
  btnDestructive: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  btnCancel: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnTextPrimary: {
    color: '#ffffff',
  },
  btnTextDestructive: {
    color: '#dc2626',
  },
  btnTextCancel: {
    color: '#64748b',
  },
});
