// ─────────────────────────────────────────────────────────────
// SelfEvalModal — 연습 후 자기 평가 팝업
// ─────────────────────────────────────────────────────────────

import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { SmilePlus, Meh, Frown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export type EvalRating = 'easy' | 'normal' | 'hard';

interface Props {
  visible: boolean;
  trackName: string;
  level: number;
  onRate: (rating: EvalRating) => void;
  onSkip: () => void;
}

export default function SelfEvalModal({ visible, trackName, level, onRate, onSkip }: Props) {
  const { t } = useTranslation(['practice', 'common']);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onSkip} />
        <View style={styles.card}>
          <Text style={styles.title}>{t('practice:selfEval.title')}</Text>
          <Text style={styles.subtitle}>
            {t('practice:selfEval.subtitle', { track: trackName, level })}
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#ecfdf5' }]}
              onPress={() => onRate('easy')}
              activeOpacity={0.7}
            >
              <SmilePlus size={28} color="#10b981" />
              <Text style={[styles.btnLabel, { color: '#065f46' }]}>{t('practice:selfEval.easy')}</Text>
              <Text style={[styles.btnHint, { color: '#6ee7b7' }]}>{t('practice:selfEval.easyHint')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#eff6ff' }]}
              onPress={() => onRate('normal')}
              activeOpacity={0.7}
            >
              <Meh size={28} color="#3b82f6" />
              <Text style={[styles.btnLabel, { color: '#1e3a5f' }]}>{t('practice:selfEval.normal')}</Text>
              <Text style={[styles.btnHint, { color: '#93c5fd' }]}>{t('practice:selfEval.normalHint')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#fef2f2' }]}
              onPress={() => onRate('hard')}
              activeOpacity={0.7}
            >
              <Frown size={28} color="#ef4444" />
              <Text style={[styles.btnLabel, { color: '#7f1d1d' }]}>{t('practice:selfEval.hard')}</Text>
              <Text style={[styles.btnHint, { color: '#fca5a5' }]}>{t('practice:selfEval.hardHint')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>{t('common:button.skip')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 6,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnHint: {
    fontSize: 10,
    fontWeight: '500',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
