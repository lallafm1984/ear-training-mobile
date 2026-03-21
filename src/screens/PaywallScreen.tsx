import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, SafeAreaView, StatusBar, Platform, Dimensions,
} from 'react-native';
import { Crown, Check, X, Sparkles, Music2, Download, Zap } from 'lucide-react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { PlanTier, PLAN_LIMITS, PLAN_COLOR, PLAN_NAME } from '../types/subscription';

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
      { label: '높은음자리 단선율 악보', icon: <Music2 size={13} color="#94a3b8" /> },
      { label: '초급 난이도만', icon: <Zap size={13} color="#94a3b8" /> },
      { label: '최대 4마디 생성', icon: <Check size={13} color="#94a3b8" /> },
      { label: '3회 생성마다 광고 시청', icon: <X size={13} color="#ef4444" /> },
    ],
  },
  {
    tier: 'pro',
    price: '9,900원',
    priceNote: '월 구독 / 언제든 취소',
    badge: '인기',
    features: [
      { label: '큰보표 (Grand Staff) 사용', icon: <Check size={13} color="#6366f1" /> },
      { label: '시험 모드 (마디별 재생)', icon: <Check size={13} color="#6366f1" /> },
      { label: '초·중·고급 전 난이도', icon: <Check size={13} color="#6366f1" /> },
      { label: '마디 수 무제한 (8마디+)', icon: <Check size={13} color="#6366f1" /> },
      { label: '음표 편집 기능', icon: <Check size={13} color="#6366f1" /> },
      { label: '월 50회 음원 다운로드', icon: <Download size={13} color="#6366f1" /> },
      { label: '광고 완전 제거', icon: <Check size={13} color="#6366f1" /> },
    ],
  },
  {
    tier: 'premium',
    price: '32,500원',
    priceNote: '월 구독 / 언제든 취소',
    badge: '교사·학원 추천',
    features: [
      { label: 'Pro 모든 기능 포함', icon: <Check size={13} color="#f59e0b" /> },
      { label: '음원 무제한 다운로드', icon: <Download size={13} color="#f59e0b" /> },
      { label: '오프라인 수업 자료 활용', icon: <Check size={13} color="#f59e0b" /> },
      { label: '대량 문제 생성·저장', icon: <Check size={13} color="#f59e0b" /> },
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
  premium: string;
}

const COMPARE_ROWS: CompareRow[] = [
  { label: '⚡ Gen/일', free: '+100', pro: '+200', premium: '무제한' },
  { label: '큰보표', free: '✕', pro: '✓', premium: '✓' },
  { label: '시험 모드', free: '✕', pro: '✓', premium: '✓' },
  { label: '난이도', free: '초급', pro: '전체', premium: '전체' },
  { label: '마디 수', free: '최대 4', pro: '무제한', premium: '무제한' },
  { label: '음표 편집', free: '✕', pro: '✓', premium: '✓' },
  { label: '다운로드', free: '불가', pro: '월 50회', premium: '무제한' },
  { label: '광고', free: '3회당 1회', pro: '없음', premium: '없음' },
];

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function PaywallScreen({ onClose }: PaywallScreenProps) {
  const { tier: currentTier, upgradePlan, loading } = useSubscription();
  const [purchasing, setPurchasing] = useState<PlanTier | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const handleSelectPlan = async (tier: PlanTier) => {
    if (tier === currentTier) {
      Alert.alert('현재 플랜', `이미 ${PLAN_NAME[tier]} 플랜을 이용 중입니다.`);
      return;
    }

    if (tier === 'free') {
      Alert.alert(
        '무료 플랜으로 변경',
        '유료 구독을 취소하면 다음 갱신일 이후 무료 플랜으로 전환됩니다.\n\nGoogle Play / App Store에서 직접 구독을 취소하세요.',
        [{ text: '확인' }],
      );
      return;
    }

    // TODO: 실제 IAP 연동 시 아래 Alert를 RevenueCat / StoreKit 구매 플로우로 교체
    Alert.alert(
      `${PLAN_NAME[tier]} 플랜 구독`,
      `${tier === 'pro' ? '9,900원' : '32,500원'} / 월\n\n실제 결제는 Google Play 또는 App Store를 통해 처리됩니다.\n\n(현재 개발 버전: 테스트 구독 적용)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구독 시작',
          onPress: async () => {
            setPurchasing(tier);
            try {
              // 개발용: 30일 구독 적용
              await upgradePlan(tier, 30);
              Alert.alert(
                '구독 완료',
                `${PLAN_NAME[tier]} 플랜이 활성화되었습니다!`,
                [{ text: '확인', onPress: onClose }],
              );
            } catch (e) {
              Alert.alert('오류', '구독 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ],
    );
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
          <Crown size={18} color="#f59e0b" />
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
                  isPurchasing && { opacity: 0.6 },
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
              <Text style={[styles.compareCell, styles.compareHeaderText, { color: PLAN_COLOR.premium }]}>Premium</Text>
            </View>
            {COMPARE_ROWS.map((row, i) => (
              <View
                key={i}
                style={[styles.compareRow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}
              >
                <Text style={[styles.compareCell, styles.compareLabel]}>{row.label}</Text>
                <Text style={[styles.compareCell, row.free === '✕' && { color: '#ef4444' }]}>{row.free}</Text>
                <Text style={[styles.compareCell, { color: PLAN_COLOR.pro, fontWeight: 'bold' }]}>{row.pro}</Text>
                <Text style={[styles.compareCell, { color: PLAN_COLOR.premium, fontWeight: 'bold' }]}>{row.premium}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 면책 조항 */}
        <Text style={styles.disclaimer}>
          * 구독은 Google Play / App Store를 통해 처리됩니다.{'\n'}
          * 구독은 다음 갱신일 24시간 전까지 취소할 수 있습니다.{'\n'}
          * 현재 버전은 개발 중으로, 실제 결제 대신 테스트 구독이 적용됩니다.
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
    backgroundColor: '#fef9c3',
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
  disclaimer: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
