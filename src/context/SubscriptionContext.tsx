import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib';
import { PlanTier, SubscriptionState, PlanLimits, PLAN_LIMITS } from '../types';
import { useAuth } from './AuthContext';
import {
  initRevenueCat, getCustomerInfo,
  loginRevenueCat, logoutRevenueCat, ENTITLEMENT_ID,
  invalidateCustomerInfoCache, addCustomerInfoUpdateListener,
} from '../lib/revenueCat';
import type { CustomerInfo } from 'react-native-purchases';


// ─────────────────────────────────────────────────────────────
// Context 타입
// ─────────────────────────────────────────────────────────────

export interface SubscriptionContextValue {
  tier:              PlanTier;
  limits:            PlanLimits;
  isExpired:         boolean;
  upgradePlan:       (newTier: PlanTier, durationDays?: number) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  subscriptionState: SubscriptionState;
  loading:           boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

const DEFAULT_STATE: SubscriptionState = {
  tier:      'free',
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
  const [loading,  setLoading]  = useState(true);
  const [rcReady, setRcReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // ── RevenueCat 초기화 ─────────────────────────────────────
  useEffect(() => {
    initRevenueCat().then(() => setRcReady(true)).catch(() => setRcReady(true));
  }, []);

  // ── 구독 상태를 RC CustomerInfo + DB와 동기화 ─────────────
  // RC가 진실 공급원. DB는 캐시일 뿐이므로 차이가 있으면 DB를 RC에 맞춘다.
  const syncFromCustomerInfo = useCallback((info: CustomerInfo) => {
    const { tier, expiresAt } = deriveSubscriptionFromRc(info);
    setSubState(prev => {
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
        let tier = (profile.tier as PlanTier) ?? 'free';
        let expiresAt = profile.subscription_expires_at ?? null;

        if (tier === 'premium' as any) tier = 'pro';
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
    const unsubscribe = addCustomerInfoUpdateListener(info => {
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
  const persistToSupabase = useCallback(async (next: SubscriptionState) => {
    setSubState(next);
    if (!user) return;
    await supabase
      .from('profiles')
      .update({
        tier:                    next.tier,
        subscription_expires_at: next.expiresAt,
      })
      .eq('id', user.id);
  }, [user]);

  // ── RevenueCat에서 구독 상태 재동기화 ─────────────────────
  const refreshSubscription = useCallback(async () => {
    try {
      // 환불 직후 등 캐시가 stale일 수 있으므로 무효화 후 최신 데이터를 받는다.
      await invalidateCustomerInfoCache().catch(() => {});
      const info = await getCustomerInfo();
      if (__DEV__) {
        console.log('[Subscription] entitlements:', JSON.stringify(info.entitlements, null, 2));
        console.log('[Subscription] activeSubscriptions:', info.activeSubscriptions);
      }
      syncFromCustomerInfo(info);
    } catch {
      // 실패 시 무시
    }
  }, [syncFromCustomerInfo]);

  // ── 플랜 업그레이드 ──────────────────────────────────────
  const upgradePlan = useCallback(async (newTier: PlanTier, durationDays = 30) => {
    const expiresAt = newTier === 'free'
      ? null
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await persistToSupabase({ tier: newTier, expiresAt });
  }, [persistToSupabase]);

  // ── 파생값 ──────────────────────────────────────────────
  const isExpired = !!(subState.expiresAt && new Date(subState.expiresAt) < new Date());
  const effectiveTier: PlanTier = isExpired ? 'free' : subState.tier;
  const limits = PLAN_LIMITS[effectiveTier];

  const value: SubscriptionContextValue = {
    tier: effectiveTier, limits, isExpired,
    upgradePlan, refreshSubscription, subscriptionState: subState, loading,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
