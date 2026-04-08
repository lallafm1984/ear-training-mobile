import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Dimensions,
} from 'react-native';
import { Crown, Lock, X, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { PLAN_NAME, PLAN_COLOR } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type UpgradeReason =
  | 'grand_staff'
  | 'exam_mode'
  | 'difficulty'
  | 'measures'
  | 'edit_notes'
  | 'download_audio'
  | 'download_image'
  | 'save_scores'
  | 'key_signature'
  | 'time_signature'
  | 'download_limit';


interface UpgradeModalProps {
  visible: boolean;
  reason: UpgradeReason;
  onClose: () => void;
  /** 요금제 화면으로 이동 콜백 */
  onGoToPaywall: () => void;
}

export default function UpgradeModal({ visible, reason, onClose, onGoToPaywall }: UpgradeModalProps) {
  const { t } = useTranslation('subscription');
  const reasonKey = reason.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
  const info = {
    title: t(`subscription:upgrade.${reasonKey}Title`),
    description: t(`subscription:upgrade.${reasonKey}Desc`),
    benefits: t(`subscription:upgrade.${reasonKey}Benefits`, { returnObjects: true }) as string[],
  };
  const tierColor = PLAN_COLOR.pro;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container}>
          {/* 닫기 버튼 */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* 자물쇠 아이콘 */}
          <View style={[styles.iconWrap, { backgroundColor: `${tierColor}22` }]}>
            <Lock size={28} color={tierColor} />
          </View>

          {/* 제목 */}
          <Text style={styles.title}>{info.title}</Text>
          <View style={[styles.tierBadge, { backgroundColor: `${tierColor}22` }]}>
            <Crown size={11} color={tierColor} />
            <Text style={[styles.tierBadgeText, { color: tierColor }]}>
              {t('subscription:upgrade.tierBadge')}
            </Text>
          </View>
          <Text style={styles.description}>{info.description}</Text>

          {/* 혜택 목록 */}
          <View style={styles.benefitList}>
            {info.benefits.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Check size={13} color="#10b981" />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {/* CTA 버튼 */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: tierColor }]}
            onPress={() => { onClose(); onGoToPaywall(); }}
          >
            <Crown size={15} color="#fff" />
            <Text style={styles.ctaBtnText}>
              {t('subscription:upgrade.ctaButton')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>{t('subscription:upgrade.dismissButton')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitList: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#1e293b',
  },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
