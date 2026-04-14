import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib';
import { PlanTier, SubscriptionState, PlanLimits, PLAN_LIMITS } from '../types';
import { useAuth } from './AuthContext';
import {
  initRevenueCat, getCustomerInfo,
  loginRevenueCat, logoutRevenueCat, ENTITLEMENT_ID,
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

  // ── RevenueCat 초기화 ─────────────────────────────────────
  useEffect(() => {
    initRevenueCat().then(() => setRcReady(true)).catch(() => setRcReady(true));
  }, []);

  // ── RevenueCat 사용자 연결 + 구독 상태 동기화 ─────────────
  useEffect(() => {
    if (!rcReady) return;

    if (!user || !profile) {
      logoutRevenueCat().catch(() => {});
      setSubState(DEFAULT_STATE);
      setLoading(false);
      return;
    }

    const syncSubscription = async () => {
      try {
        await loginRevenueCat(user.id);
        const info = await getCustomerInfo();
        const { tier, expiresAt } = deriveSubscriptionFromRc(info);

        // DB의 tier/만료일과 RevenueCat이 다르면 DB 동기화
        // (환불 시 tier='free'로 내려가도록, expiresAt도 항상 함께 맞춘다)
        const dbExpiresAt = profile.subscription_expires_at ?? null;
        if (profile.tier !== tier || dbExpiresAt !== expiresAt) {
          supabase
            .from('profiles')
            .update({ tier, subscription_expires_at: expiresAt })
            .eq('id', user.id)
            .then(() => {});
        }

        setSubState({ tier, expiresAt });
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
  }, [user, profile, rcReady]);

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
      const info = await getCustomerInfo();
      if (__DEV__) {
        console.log('[Subscription] entitlements:', JSON.stringify(info.entitlements, null, 2));
        console.log('[Subscription] activeSubscriptions:', info.activeSubscriptions);
      }

      const { tier, expiresAt } = deriveSubscriptionFromRc(info);
      setSubState({ tier, expiresAt });

      if (user) {
        supabase
          .from('profiles')
          .update({ tier, subscription_expires_at: expiresAt })
          .eq('id', user.id)
          .then(() => {});
      }
    } catch {
      // 실패 시 무시
    }
  }, [user]);

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
