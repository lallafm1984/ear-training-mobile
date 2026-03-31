import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { Zap, X, Check, Info } from 'lucide-react-native';
import { useAlert, useSubscription } from '../context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Gen 패키지 정의
// ─────────────────────────────────────────────────────────────

interface GenPackage {
  id: string;
  gen: number;
  bonus: number;
  price: string;
  priceNum: number;
  badge?: string;
  highlight?: boolean;
}

const GEN_PACKAGES: GenPackage[] = [
  {
    id: 'gen_300',
    gen: 300,
    bonus: 0,
    price: '1,100원',
    priceNum: 1100,
  },
  {
    id: 'gen_900',
    gen: 900,
    bonus: 100,
    price: '2,900원',
    priceNum: 2900,
    badge: '인기',
    highlight: true,
  },
  {
    id: 'gen_2500',
    gen: 2500,
    bonus: 300,
    price: '6,600원',
    priceNum: 6600,
  },
  {
    id: 'gen_6000',
    gen: 6000,
    bonus: 800,
    price: '13,200원',
    priceNum: 13200,
    badge: '최고 가성비',
  },
];

// ─────────────────────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function GenShopModal({ visible, onClose }: Props) {
  const { genBalance, genPaidBalance, addPaidGen, tier } = useSubscription();
  const { showAlert } = useAlert();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const isPremium = tier === 'premium';
  const dailyRecharge = tier === 'pro' ? 200 : 100;

  const handlePurchase = (pkg: GenPackage) => {
    const total = pkg.gen + pkg.bonus;
    showAlert({
      title: `💎 ${total.toLocaleString()} Gen 구매`,
      message: `${pkg.price}\n\n실제 결제는 Google Play 또는 App Store를 통해 처리됩니다.\n\n(현재 개발 버전: 테스트 적용)`,
      type: 'info',
      buttons: [
        { text: '취소', style: 'cancel' },
        { text: '구매하기', onPress: async () => {
          setPurchasing(pkg.id);
          try {
            await addPaidGen(total);
            showAlert({
              title: '충전 완료',
              message: `${total.toLocaleString()} Gen이 충전되었습니다!\n유료 Gen 잔액: ${(genPaidBalance + total).toLocaleString()} Gen`,
              type: 'success',
            });
          } finally {
            setPurchasing(null);
          }
        }},
      ],
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlayBg} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          {/* 드래그 핸들 */}
          <View style={styles.handle} />

          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Zap size={20} color="#6366f1" />
              <Text style={styles.headerTitle}>Gen 충전</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 현재 잔액 카드 */}
            <View style={styles.balanceCard}>
              {isPremium ? (
                <>
                  <View style={styles.balanceLeft}>
                    <Text style={styles.balanceLabel}>현재 Gen 잔액</Text>
                    <Text style={styles.balanceNote}>무제한 (Premium)</Text>
                  </View>
                  <Text style={styles.balanceValue}>∞</Text>
                </>
              ) : (
                <View style={{ flex: 1, gap: 10 }}>
                  <View style={styles.balanceRow}>
                    <View style={styles.balanceLeft}>
                      <Text style={styles.balanceLabel}>자동 충전</Text>
                      <Text style={styles.balanceNote}>매일 오전 6시 +{dailyRecharge} Gen</Text>
                    </View>
                    <Text style={styles.balanceValue}>⚡ {genBalance.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.balanceRow, { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#c7d2fe' }]}>
                    <View style={styles.balanceLeft}>
                      <Text style={[styles.balanceLabel, { color: '#7c3aed' }]}>유료 Gen</Text>
                      <Text style={styles.balanceNote}>구매로 획득한 Gen</Text>
                    </View>
                    <Text style={[styles.balanceValue, { color: '#7c3aed' }]}>💎 {genPaidBalance.toLocaleString()}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Premium 안내 */}
            {isPremium && (
              <View style={styles.premiumBanner}>
                <Zap size={14} color="#92400e" />
                <Text style={styles.premiumBannerText}>
                  Premium 플랜은 Gen이 무제한입니다. 추가 충전이 필요 없습니다.
                </Text>
              </View>
            )}

            {/* Gen 패키지 목록 */}
            <Text style={styles.sectionLabel}>Gen 패키지</Text>
            {GEN_PACKAGES.map(pkg => {
              const total = pkg.gen + pkg.bonus;
              const isPurchasing = purchasing === pkg.id;
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={[
                    styles.packageCard,
                    pkg.highlight && styles.packageCardHighlight,
                    isPurchasing && { opacity: 0.6 },
                  ]}
                  onPress={() => handlePurchase(pkg)}
                  disabled={!!purchasing || isPremium}
                  activeOpacity={0.75}
                >
                  {pkg.badge && (
                    <View style={[styles.pkgBadge, pkg.highlight && styles.pkgBadgeHighlight]}>
                      <Text style={[styles.pkgBadgeText, pkg.highlight && styles.pkgBadgeTextHighlight]}>
                        {pkg.badge}
                      </Text>
                    </View>
                  )}

                  <View style={styles.pkgLeft}>
                    <Text style={styles.pkgIcon}>💎</Text>
                    <View>
                      <Text style={styles.pkgGenAmount}>{pkg.gen.toLocaleString()} Gen</Text>
                      {pkg.bonus > 0 && (
                        <Text style={styles.pkgBonus}>+{pkg.bonus.toLocaleString()} 보너스 증정</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.pkgRight}>
                    {pkg.bonus > 0 && (
                      <Text style={styles.pkgTotalGen}>총 {total.toLocaleString()} Gen</Text>
                    )}
                    {isPurchasing
                      ? <ActivityIndicator size="small" color="#6366f1" />
                      : <Text style={[styles.pkgPrice, pkg.highlight && { color: '#6366f1' }]}>
                          {pkg.price}
                        </Text>
                    }
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Gen 사용 안내 */}
            <View style={styles.infoBox}>
              <View style={styles.infoHeader}>
                <Info size={13} color="#6366f1" />
                <Text style={styles.infoTitle}>Gen 사용 안내</Text>
              </View>
              <Text style={styles.infoDesc}>Gen은 AI 악보 자동생성에 사용되는 재화입니다.</Text>
              {[
                { label: '초급 1단계', cost: '8 Gen', note: '(큰보표 12 Gen)' },
                { label: '초급 3단계', cost: '12 Gen', note: '(큰보표 18 Gen)' },
                { label: '중급 1단계', cost: '14 Gen', note: '(큰보표 21 Gen)' },
                { label: '고급 3단계', cost: '24 Gen', note: '(큰보표 36 Gen)' },
                { label: '8마디 이상', cost: '+5~15 Gen', note: '추가' },
              ].map((r, i) => (
                <View key={i} style={styles.infoRow}>
                  <Check size={11} color="#10b981" />
                  <Text style={styles.infoRowText}>
                    {r.label}: <Text style={{ fontWeight: '700' }}>{r.cost}</Text>
                    <Text style={{ color: '#94a3b8' }}> {r.note}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 32,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center',
  },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  // 잔액 카드
  balanceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLeft: { flex: 1 },
  balanceLabel: { fontSize: 12, fontWeight: '600', color: '#6366f1', marginBottom: 4 },
  balanceNote: { fontSize: 11, color: '#818cf8' },
  balanceValue: { fontSize: 26, fontWeight: '800', color: '#6366f1' },

  // Premium 배너
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  premiumBannerText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  // 패키지 카드
  packageCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  packageCardHighlight: {
    backgroundColor: '#eef2ff',
    borderColor: '#a5b4fc',
    borderWidth: 1.5,
  },
  pkgBadge: {
    position: 'absolute', top: -8, right: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  pkgBadgeHighlight: { backgroundColor: '#6366f1' },
  pkgBadgeText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  pkgBadgeTextHighlight: { color: '#ffffff' },
  pkgLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pkgIcon: { fontSize: 22 },
  pkgGenAmount: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  pkgBonus: { fontSize: 11, color: '#10b981', fontWeight: '600', marginTop: 2 },
  pkgRight: { alignItems: 'flex-end', gap: 2 },
  pkgTotalGen: { fontSize: 11, color: '#6366f1', fontWeight: '600' },
  pkgPrice: { fontSize: 15, fontWeight: '700', color: '#1e293b' },

  // 안내 박스
  infoBox: {
    backgroundColor: '#f8fafc', borderRadius: 14,
    padding: 14, marginTop: 6,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  infoDesc: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  infoRowText: { fontSize: 12, color: '#475569' },
});
