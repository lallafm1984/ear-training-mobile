import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Crown, X, Sparkles, Music2, FileMusic,
  Layers, ArrowUpDown, Key, Drum,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAlert, useSubscription } from '../context';
import { PlanTier, PLAN_COLOR, PLAN_NAME } from '../types';
import { getOfferings, purchasePackage, isPro, restorePurchases } from '../lib/revenueCat';
import type { PurchasesPackage } from 'react-native-purchases';

interface PaywallScreenProps {
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// 청음 훈련 카테고리별 Free/Pro 비교
// ─────────────────────────────────────────────────────────────

interface CategoryCompare {
  name: string;
  icon: React.ReactNode;
  color: string;
  free: string;
  pro: string;
}

const CATEGORY_COMPARE_KEYS = [
  { nameKey: 'subscription:paywall.compareMelody', icon: <Music2 size={14} color="#6366f1" />, color: '#6366f1', free: 'Lv.1~3', pro: 'Lv.1~9' },
  { nameKey: 'subscription:paywall.compareRhythm', icon: <Drum size={14} color="#f59e0b" />, color: '#f59e0b', free: 'Lv.1~2', pro: 'Lv.1~6' },
  { nameKey: 'subscription:paywall.compareInterval', icon: <ArrowUpDown size={14} color="#10b981" />, color: '#10b981', free: 'Lv.1~2', pro: 'Lv.1~4' },
  { nameKey: 'subscription:paywall.compareHarmony', icon: <Layers size={14} color="#8b5cf6" />, color: '#8b5cf6', free: 'Lv.1', pro: 'Lv.1~4' },
  { nameKey: 'subscription:paywall.compareKey', icon: <Key size={14} color="#ef4444" />, color: '#ef4444', free: 'Lv.1', pro: 'Lv.1~3' },
  { nameKey: 'subscription:paywall.compareTwoPart', icon: <FileMusic size={14} color="#0ea5e9" />, color: '#0ea5e9', free: 'locked', pro: 'Lv.1~4' },
  { nameKey: 'subscription:paywall.compareMockExam', icon: <Crown size={14} color="#f59e0b" />, color: '#f59e0b', free: 'Lv.1', pro: 'all' },
];

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const { t } = useTranslation(['subscription', 'content', 'common']);
  const { tier: currentTier, loading } = useSubscription();
  const { showAlert } = useAlert();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    getOfferings()
      .then(pkgs => setPackages(pkgs))
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }, []);

  const handleSubscribe = async () => {
    if (currentTier === 'pro') {
      showAlert({ title: t('subscription:paywall.alreadyProTitle'), message: t('subscription:paywall.alreadyProMessage'), type: 'info' });
      return;
    }

    const pkg = packages.find(p => p.packageType === 'MONTHLY') ?? packages[0];
    if (!pkg) {
      showAlert({
        title: t('subscription:paywall.loadFailTitle'),
        message: t('subscription:paywall.loadFailMessage'),
        type: 'error',
      });
      return;
    }

    setPurchasing(true);
    try {
      const customerInfo = await purchasePackage(pkg);
      if (isPro(customerInfo)) {
        showAlert({
          title: t('subscription:paywall.subscribeSuccessTitle'),
          message: t('subscription:paywall.subscribeSuccessMessage'),
          type: 'success',
          buttons: [{ text: t('common:button.confirm'), onPress: onClose }],
        });
      }
    } catch (e: any) {
      if (e?.userCancelled) return;
      showAlert({
        title: t('subscription:paywall.subscribeErrorTitle'),
        message: t('subscription:paywall.subscribeErrorMessage'),
        type: 'error',
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const customerInfo = await restorePurchases();
      if (isPro(customerInfo)) {
        showAlert({
          title: t('subscription:paywall.restoreSuccessTitle'),
          message: t('subscription:paywall.restoreSuccessMessage'),
          type: 'success',
          buttons: [{ text: t('common:button.confirm'), onPress: onClose }],
        });
      } else {
        showAlert({
          title: t('subscription:paywall.restoreNoneTitle'),
          message: t('subscription:paywall.restoreNoneMessage'),
          type: 'info',
        });
      }
    } catch {
      showAlert({
        title: t('subscription:paywall.restoreErrorTitle'),
        message: t('subscription:paywall.restoreErrorMessage'),
        type: 'error',
      });
    } finally {
      setRestoring(false);
    }
  };

  const isPro_ = currentTier === 'pro';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={18} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription:paywall.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 히어로 섹션 */}
        <View style={styles.hero}>
          <View style={styles.heroIconRow}>
            <Crown size={32} color="#6366f1" />
          </View>
          <Text style={styles.heroTitle}>{t('subscription:paywall.proBanner')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('subscription:paywall.heroSubtitle')}
          </Text>
          {isPro_ && (
            <View style={styles.proBanner}>
              <Sparkles size={14} color="#6366f1" />
              <Text style={styles.proBannerText}>{t('subscription:paywall.currentPro')}</Text>
            </View>
          )}
        </View>

        {/* 카테고리별 Free vs Pro */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('subscription:paywall.compareTitle')}</Text>
          <View style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Text style={[styles.categoryHeaderCell, { flex: 1.5 }]}>{t('subscription:paywall.compareCategory')}</Text>
              <Text style={[styles.categoryHeaderCell, { color: '#94a3b8' }]}>Free</Text>
              <Text style={[styles.categoryHeaderCell, { color: '#6366f1' }]}>Pro</Text>
            </View>
            {CATEGORY_COMPARE_KEYS.map((cat, i) => (
              <View
                key={i}
                style={[styles.categoryRow, i % 2 === 0 && { backgroundColor: '#fafaff' }]}
              >
                <View style={[styles.categoryNameCell, { flex: 1.5 }]}>
                  {cat.icon}
                  <Text style={styles.categoryName}>{t(cat.nameKey)}</Text>
                </View>
                <Text style={[
                  styles.categoryValue,
                  cat.free === 'locked' && { color: '#ef4444', fontSize: 11 },
                ]}>
                  {cat.free === 'locked' ? t('subscription:paywall.locked') : cat.free}
                </Text>
                <Text style={[styles.categoryValue, { color: '#6366f1', fontWeight: '700' }]}>
                  {cat.pro === 'all' ? t('subscription:paywall.allLevels') : cat.pro}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA 버튼 */}
        {!isPro_ && (
          <View style={styles.ctaSection}>
            <TouchableOpacity
              style={[styles.ctaBtn, purchasing && { opacity: 0.5 }]}
              onPress={handleSubscribe}
              disabled={purchasing || loading}
              activeOpacity={0.8}
            >
              <Crown size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>
                {purchasing ? t('subscription:paywall.processing') : t('subscription:paywall.subscribe')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.ctaNote}>{t('subscription:paywall.ctaNote')}</Text>
          </View>
        )}

        {/* 구독 복원 */}
        {!isPro_ && (
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            <Text style={styles.restoreBtnText}>
              {restoring ? t('subscription:paywall.restoring') : t('subscription:paywall.restore')}
            </Text>
          </TouchableOpacity>
        )}

        {/* 면책 조항 */}
        <Text style={styles.disclaimer}>
          {t('subscription:paywall.disclaimer')}
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── 히어로 ──────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2ff',
  },
  heroIconRow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  proBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },

  // ── 섹션 ──────────────────────────────────────────────
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
  },

  // ── 카테고리 비교 ──────────────────────────────────────
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  categoryNameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  categoryValue: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── CTA ────────────────────────────────────────────────
  ctaSection: {
    paddingHorizontal: 16,
    paddingTop: 28,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  ctaNote: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 10,
  },

  // ── 복원 ──────────────────────────────────────────────
  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    textDecorationLine: 'underline',
  },

  // ── 하단 ──────────────────────────────────────────────
  disclaimer: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
