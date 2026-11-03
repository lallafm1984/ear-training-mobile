import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib';
import { PlanTier, SubscriptionState, PlanLimits, PLAN_LIMITS } from '../types';
import { useAuth } from './AuthContext';
import {
  initRevenueCat,
  getCustomerInfo,
  loginRevenueCat,
  logoutRevenueCat,
  ENTITLEMENT_ID,
  invalidateCustomerInfoCache,
  addCustomerInfoUpdateListener,
} from '../lib/revenueCat';
import type { CustomerInfo } from 'react-native-purchases';
import { fetchAdmissionsPromotionActive } from '../lib/promotionConfig';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────────────────────
// Context 타입
// ─────────────────────────────────────────────────────────────

export interface SubscriptionContextValue {
  tier: PlanTier;
  limits: PlanLimits;
  isExpired: boolean;
  promotionActive: boolean;
  upgradePlan: (newTier: PlanTier, durationDays?: number) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  subscriptionState: SubscriptionState;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  expiresAt: null,
};

// RevenueCat CustomerInfo → 앱 구독 상태.
// 진실 공급원은 오직 entitlement 하나다. activeSubscriptions를 폴백으로 쓰면
// 환불 후에도 원래 만료일까지 SKU가 남아 있어 며칠간 Pro가 유지되는 버그가 발생한다.
function deriveSubscriptionFromRc(info: CustomerInfo): SubscriptionState {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) {
    return { tier: 'free', expiresAt: null };
  }
  return {
    tier: 'pro',
    expiresAt: entitlement.expirationDate ?? null,
  };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [subState, setSubState] = useState<SubscriptionState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [rcReady, setRcReady] = useState(false);
  const [promotionActive, setPromotionActive] = useState(false);
  const [promotionLoading, setPromotionLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  const promotionUserIdRef = useRef<string | null>(user?.id ?? null);
  promotionUserIdRef.current = user?.id ?? null;

  // 기기 시간이 아닌 Supabase/PostgreSQL 서버 시간으로 캠페인 상태를 판정한다.
  const refreshPromotionState = useCallback(async () => {
    const requestedUserId = promotionUserIdRef.current;
    if (!requestedUserId) {
      setPromotionActive(false);
      return;
    }

    try {
      const active = await fetchAdmissionsPromotionActive((fn, args) => supabase.rpc(fn, args));
      if (promotionUserIdRef.current === requestedUserId) setPromotionActive(active);
    } catch {
      // 서버 판정에 실패하면 로컬 시계를 신뢰하지 않고 권한을 열지 않는다.
      if (promotionUserIdRef.current === requestedUserId) setPromotionActive(false);
    }
  }, []);

  // 캠페인 시작/종료 경계를 앱 재실행 없이 반영한다.
  useEffect(() => {
    let cancelled = false;

    setPromotionLoading(true);
    void refreshPromotionState().finally(() => {
      if (!cancelled) setPromotionLoading(false);
    });
    const interval = setInterval(() => void refreshPromotionState(), 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, refreshPromotionState]);

  // 장시간 백그라운드에 있던 경우 복귀 즉시 서버 상태를 다시 확인한다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPromotionState();
    });
    return () => sub.remove();
  }, [refreshPromotionState]);

  // ── RevenueCat 초기화 ─────────────────────────────────────
  useEffect(() => {
    initRevenueCat()
      .then(() => setRcReady(true))
      .catch(() => setRcReady(true));
  }, []);

  // ── 구독 상태를 RC CustomerInfo + DB와 동기화 ─────────────
  // RC가 진실 공급원. DB는 캐시일 뿐이므로 차이가 있으면 DB를 RC에 맞춘다.
  const syncFromCustomerInfo = useCallback((info: CustomerInfo) => {
    const { tier, expiresAt } = deriveSubscriptionFromRc(info);
    setSubState((prev) => {
      if (prev.tier === tier && prev.expiresAt === expiresAt) return prev;
      return { tier, expiresAt };
    });

    const uid = userIdRef.current;
    if (uid) {
      supabase
        .from('profiles')
        .update({ tier, subscription_expires_at: expiresAt })
        .eq('id', uid)
        .then(() => {});
    }
  }, []);

  // ── RevenueCat 사용자 연결 + 구독 상태 동기화 ─────────────
  useEffect(() => {
    if (!rcReady) return;

    if (!user || !profile) {
      userIdRef.current = null;
      logoutRevenueCat().catch(() => {});
      setSubState(DEFAULT_STATE);
      setLoading(false);
      return;
    }

    userIdRef.current = user.id;

    const syncSubscription = async () => {
      try {
        await loginRevenueCat(user.id);
        // 환불/외부 변경을 놓치지 않도록 캐시 무효화 후 최신 상태를 가져온다.
        await invalidateCustomerInfoCache().catch(() => {});
        const info = await getCustomerInfo();
        syncFromCustomerInfo(info);
      } catch {
        // RevenueCat 실패 시 DB 기반 폴백
        const storedTier = profile.tier as string;
        let tier: PlanTier = storedTier === 'pro' || storedTier === 'premium' ? 'pro' : 'free';
        let expiresAt = profile.subscription_expires_at ?? null;
        if (expiresAt && new Date(expiresAt) < new Date()) {
          tier = 'free';
          expiresAt = null;
        }

        setSubState({ tier, expiresAt });
      } finally {
        setLoading(false);
      }
    };

    syncSubscription();
  }, [user, profile, rcReady, syncFromCustomerInfo]);

  // ── RC CustomerInfo 변경 리스너 ──────────────────────────
  // 환불/갱신 등 서버 측 변경이 SDK에 반영되면 자동으로 상태/DB가 동기화된다.
  useEffect(() => {
    if (!rcReady) return;
    const unsubscribe = addCustomerInfoUpdateListener((info) => {
      syncFromCustomerInfo(info);
    });
    return unsubscribe;
  }, [rcReady, syncFromCustomerInfo]);

  // ── 앱이 포그라운드로 복귀하면 캐시 무효화 후 재동기화 ─────
  // 환불은 앱 밖(스토어)에서 발생하므로, 복귀 시점에 강제로 최신 상태를 끌어온다.
  useEffect(() => {
    if (!rcReady) return;
    const handleAppStateChange = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (!userIdRef.current) return;
      try {
        await invalidateCustomerInfoCache();
        const info = await getCustomerInfo();
        syncFromCustomerInfo(info);
      } catch {
        // 무시
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [rcReady, syncFromCustomerInfo]);

  // ── Supabase에 구독 상태 저장 ────────────────────────────
  const persistToSupabase = useCallback(
    async (next: SubscriptionState) => {
      setSubState(next);
      if (!user) return;
      await supabase
        .from('profiles')
        .update({
          tier: next.tier,
          subscription_expires_at: next.expiresAt,
        })
        .eq('id', user.id);
    },
    [user],
  );

  // ── RevenueCat에서 구독 상태 재동기화 ─────────────────────
  const refreshSubscription = useCallback(async () => {
    try {
      // 환불 직후 등 캐시가 stale일 수 있으므로 무효화 후 최신 데이터를 받는다.
      await invalidateCustomerInfoCache().catch(() => {});
      const info = await getCustomerInfo();
      logger.debug('[Subscription] entitlements:', JSON.stringify(info.entitlements, null, 2));
      logger.debug('[Subscription] activeSubscriptions:', info.activeSubscriptions);
      syncFromCustomerInfo(info);
    } catch {
      // 실패 시 무시
    }
  }, [syncFromCustomerInfo]);

  // ── 플랜 업그레이드 ──────────────────────────────────────
  const upgradePlan = useCallback(
    async (newTier: PlanTier, durationDays = 30) => {
      const expiresAt =
        newTier === 'free'
          ? null
          : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      await persistToSupabase({ tier: newTier, expiresAt });
    },
    [persistToSupabase],
  );

  // ── 파생값 ──────────────────────────────────────────────
  const paidSubscriptionExpired = !!(
    subState.expiresAt && new Date(subState.expiresAt) < new Date()
  );
  const effectiveTier: PlanTier = promotionActive
    ? 'pro'
    : paidSubscriptionExpired
      ? 'free'
      : subState.tier;
  const isExpired = promotionActive ? false : paidSubscriptionExpired;
  const limits = PLAN_LIMITS[effectiveTier];

  const value: SubscriptionContextValue = {
    tier: effectiveTier,
    limits,
    isExpired,
    promotionActive,
    upgradePlan,
    refreshSubscription,
    subscriptionState: subState,
    loading: loading || promotionLoading,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
