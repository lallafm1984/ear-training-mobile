import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MONTHLY_PRICE_STRING, getMonthlyPriceString } from '../lib/revenueCat';

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export type LegalType = 'privacy' | 'terms';

interface Section {
  title: string;
  body: string;
}

// ─────────────────────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────────────────────

interface LegalModalProps {
  visible: boolean;
  type: LegalType;
  onClose: () => void;
}

export default function LegalModal({ visible, type, onClose }: LegalModalProps) {
  const { t } = useTranslation('legal');
  const [priceString, setPriceString] = useState(DEFAULT_MONTHLY_PRICE_STRING);

  useEffect(() => {
    if (!visible || type !== 'terms') return;

    let isMounted = true;
    getMonthlyPriceString()
      .then((price) => {
        if (isMounted) setPriceString(price);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [type, visible]);

  const interpolation = { price: priceString };
  const title = t(`${type}.title`, interpolation);
  const subtitle = t(`${type}.subtitle`, interpolation);
  const sections = t(`${type}.sections`, {
    ...interpolation,
    returnObjects: true,
  }) as Section[];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common:button.close')}
          >
            <X size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>{subtitle}</Text>

          {Array.isArray(sections) &&
            sections.map((s, i) => (
              <View key={i} style={styles.section}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 21,
  },
});
