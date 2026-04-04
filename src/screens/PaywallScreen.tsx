import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { Crown, Check, X, Sparkles, Music2, Download, Disc3, BookOpen, Edit3 } from 'lucide-react-native';
import { useAlert, useSubscription } from '../context';
import { PlanTier, PLAN_COLOR, PLAN_NAME } from '../types';
import { getOfferings, purchasePackage, restorePurchases, isPro, getCustomerInfo } from '../lib/revenueCat';
import type { PurchasesPackage } from 'react-native-purchases';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaywallScreenProps {
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// 요금제 정보
// ─────────────────────────────────────────────────────────────

interface PlanCard {
  tier: PlanTier;
  price: string;
  priceNote: string;
  badge?: string;
  features: { label: string; icon: React.ReactNode }[];
}

const PLAN_CARDS: PlanCard[] = [
  {
    tier: 'free',
    price: '무료',
    priceNote: '영구 무료',
    features: [
      { label: '다장조(C) · 4/4박자만', icon: <Music2 size={13} color="#94a3b8" /> },
      { label: '초급 난이도 선택 가능', icon: <BookOpen size={13} color="#94a3b8" /> },
      { label: '최대 4마디 생성', icon: <Music2 size={13} color="#94a3b8" /> },
      { label: '악보 최대 5개 저장', icon: <Check size={13} color="#94a3b8" /> },
      { label: '악보 이미지 저장 가능', icon: <Download size={13} color="#94a3b8" /> },
      { label: '일반 재생 모드만 사용 가능', icon: <Disc3 size={13} color="#94a3b8" /> },
    ],
  },
  {
    tier: 'pro',
    price: '5,500원',
    priceNote: '월 구독 / 언제든 취소',
    badge: '모든 기능 잠금 해제',
    features: [
      { label: '모든 조성 · 박자 사용 가능', icon: <Music2 size={13} color="#6366f1" /> },
      { label: '큰보표 (Grand Staff) 사용', icon: <Check size={13} color="#6366f1" /> },
      { label: '모든 재생 모드 사용 가능', icon: <Disc3 size={13} color="#6366f1" /> },
      { label: '초·중·고급 전 난이도', icon: <BookOpen size={13} color="#6366f1" /> },
      { label: '모든 마디 수 선택 가능', icon: <Music2 size={13} color="#6366f1" /> },
      { label: '음표 편집 기능', icon: <Edit3 size={13} color="#6366f1" /> },
      { label: '음원 · 이미지 무제한 다운로드', icon: <Download size={13} color="#6366f1" /> },
      { label: '악보 최대 20개 저장', icon: <Check size={13} color="#6366f1" /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 비교표 행
// ─────────────────────────────────────────────────────────────

interface CompareRow {
  label: string;
  free: string;
  pro: string;
}

const COMPARE_ROWS: CompareRow[] = [
  { label: '조성', free: 'C만', pro: '전체 (24개)' },
  { label: '박자', free: '4/4만', pro: '전체 (8종)' },
  { label: '큰보표', free: '✕', pro: '✓' },
  { label: '재생 모드', free: '일반만', pro: '전체' },
  { label: '난이도', free: '초급', pro: '전체' },
  { label: '마디 수', free: '최대 4', pro: '무제한' },
  { label: '악보 저장', free: '5개', pro: '20개' },
  { label: '음표 편집', free: '✕', pro: '✓' },
  { label: '음원 다운로드', free: '✕', pro: '무제한' },
  { label: '이미지 저장', free: '✓', pro: '✓' },
];

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const { tier: currentTier, loading } = useSubscription();
  const { showAlert } = useAlert();
  const [purchasing, setPurchasing] = useState<PlanTier | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  // RevenueCat에서 상품 정보 로드
  useEffect(() => {
    getOfferings()
      .then(pkgs => setPackages(pkgs))
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }, []);

  const handleSelectPlan = async (tier: PlanTier) => {
    if (tier === currentTier) {
      showAlert({ title: '현재 플랜', message: `이미 ${PLAN_NAME[tier]} 플랜을 이용 중입니다.`, type: 'info' });
      return;
    }

    if (currentTier === 'pro' && tier === 'free') {
      showAlert({
        title: '플랜 변경 불가',
        message: 'Pro 플랜에서 무료 플랜으로는 직접 변경할 수 없습니다.\n\nGoogle Play / App Store에서 구독을 취소하세요.',
        type: 'warning',
      });
      return;
    }

    if (tier === 'free') {
      showAlert({
        title: '무료 플랜으로 변경',
        message: '유료 구독을 취소하면 다음 갱신일 이후 무료 플랜으로 전환됩니다.\n\nGoogle Play / App Store에서 직접 구독을 취소하세요.',
        type: 'info',
      });
      return;
    }

    // RevenueCat 패키지 구매
    const pkg = packages.find(p => p.packageType === 'MONTHLY') ?? packages[0];
    if (!pkg) {
      showAlert({
        title: '상품 로드 실패',
        message: '구독 상품 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
        type: 'error',
      });
      return;
    }

    setPurchasing(tier);
    try {
      const customerInfo = await purchasePackage(pkg);
      if (isPro(customerInfo)) {
        showAlert({
          title: '구독 완료',
          message: `${PLAN_NAME[tier]} 플랜이 활성화되었습니다!\n모든 기능을 자유롭게 이용하세요.`,
          type: 'success',
          buttons: [{ text: '확인', onPress: onClose }],
        });
      }
    } catch (e: any) {
      // 사용자가 취소한 경우 (userCancelled)
      if (e?.userCancelled) return;
      showAlert({
        title: '구독 오류',
        message: '구독 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        type: 'error',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setPurchasing('pro');
    try {
      const info = await restorePurchases();
      if (isPro(info)) {
        showAlert({
          title: '복원 완료',
          message: 'Pro 구독이 복원되었습니다!',
          type: 'success',
          buttons: [{ text: '확인', onPress: onClose }],
        });
      } else {
        showAlert({
          title: '복원 결과',
          message: '활성 구독을 찾을 수 없습니다.',
          type: 'info',
        });
      }
    } catch {
      showAlert({ title: '오류', message: '구독 복원 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.root,
        { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
      ]}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={18} color="#64748b" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Crown size={18} color="#6366f1" />
          <Text style={styles.headerTitle}>MelodyGen 요금제</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 부제목 */}
        <Text style={styles.subtitle}>
          전문적인 청음 훈련을 위한 플랜을 선택하세요
        </Text>

        {/* 현재 플랜 표시 */}
        {currentTier !== 'free' && (
          <View style={styles.currentPlanBanner}>
            <Sparkles size={14} color={PLAN_COLOR[currentTier]} />
            <Text style={[styles.currentPlanText, { color: PLAN_COLOR[currentTier] }]}>
              현재 {PLAN_NAME[currentTier]} 플랜 이용 중
            </Text>
          </View>
        )}

        {/* 요금제 카드 */}
        {PLAN_CARDS.map(card => {
          const isCurrentPlan = card.tier === currentTier;
          const color = PLAN_COLOR[card.tier];
          const isPurchasing = purchasing === card.tier;

          return (
            <View
              key={card.tier}
              style={[
                styles.planCard,
                isCurrentPlan && { borderColor: color, borderWidth: 2 },
                card.tier === 'pro' && styles.planCardHighlight,
              ]}
            >
              {/* 배지 */}
              {card.badge && (
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>{card.badge}</Text>
                </View>
              )}
              {isCurrentPlan && (
                <View style={[styles.currentBadge, { backgroundColor: `${color}22` }]}>
                  <Text style={[styles.currentBadgeText, { color }]}>현재 플랜</Text>
                </View>
              )}

              {/* 플랜 이름 & 가격 */}
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color }]}>{PLAN_NAME[card.tier]}</Text>
                <Text style={styles.planPrice}>{card.price}</Text>
                <Text style={styles.planPriceNote}>{card.priceNote}</Text>
              </View>

              {/* 기능 목록 */}
              <View style={styles.featureList}>
                {card.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    {f.icon}
                    <Text style={styles.featureText}>{f.label}</Text>
                  </View>
                ))}
              </View>

              {/* CTA 버튼 */}
              <TouchableOpacity
                style={[
                  styles.selectBtn,
                  { backgroundColor: isCurrentPlan ? '#f1f5f9' : color },
                  isPurchasing && { opacity: 0.4 },
                ]}
                onPress={() => handleSelectPlan(card.tier)}
                disabled={isPurchasing || loading}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    { color: isCurrentPlan ? '#94a3b8' : '#ffffff' },
                  ]}
                >
                  {isCurrentPlan
                    ? '현재 플랜'
                    : isPurchasing
                      ? '처리 중...'
                      : card.tier === 'free'
                        ? '무료로 계속'
                        : `${PLAN_NAME[card.tier]} 시작하기`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* 비교표 토글 */}
        <TouchableOpacity
          style={styles.compareToggle}
          onPress={() => setShowCompare(v => !v)}
        >
          <Text style={styles.compareToggleText}>
            {showCompare ? '비교표 숨기기' : '전체 기능 비교표 보기'}
          </Text>
        </TouchableOpacity>

        {/* 비교표 */}
        {showCompare && (
          <View style={styles.compareTable}>
            {/* 헤더 */}
            <View style={[styles.compareRow, styles.compareHeaderRow]}>
              <Text style={[styles.compareCell, styles.compareLabel, styles.compareHeaderText]}>기능</Text>
              <Text style={[styles.compareCell, styles.compareHeaderText, { color: PLAN_COLOR.free }]}>Free</Text>
              <Text style={[styles.compareCell, styles.compareHeaderText, { color: PLAN_COLOR.pro }]}>Pro</Text>
            </View>
            {COMPARE_ROWS.map((row, i) => (
              <View
                key={i}
                style={[styles.compareRow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}
              >
                <Text style={[styles.compareCell, styles.compareLabel]}>{row.label}</Text>
                <Text style={[styles.compareCell, row.free === '✕' && { color: '#ef4444' }]}>{row.free}</Text>
                <Text style={[styles.compareCell, { color: PLAN_COLOR.pro, fontWeight: 'bold' }]}>{row.pro}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 구독 복원 */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={!!purchasing}
        >
          <Text style={styles.restoreBtnText}>
            {purchasing === 'pro' ? '복원 중...' : '이전 구독 복원'}
          </Text>
        </TouchableOpacity>

        {/* 면책 조항 */}
        <Text style={styles.disclaimer}>
          * 구독은 Google Play / App Store를 통해 처리됩니다.{'\n'}
          * 구독은 다음 갱신일 24시간 전까지 취소할 수 있습니다.{'\n'}
          * 결제는 확인 시 iTunes/Google Play 계정에 청구됩니다.
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  currentPlanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  currentPlanText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  planCardHighlight: {
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  currentBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  planPriceNote: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#1e293b',
    flex: 1,
  },
  selectBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  compareToggle: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  compareToggleText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  compareTable: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  compareHeaderRow: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  compareCell: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  compareLabel: {
    flex: 1.3,
    textAlign: 'left',
    color: '#1e293b',
    fontWeight: '600',
  },
  compareHeaderText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 16,
  },
  restoreBtnText: {
    fontSize: 13,
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
