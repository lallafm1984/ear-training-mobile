import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib';
import { PlanTier, SubscriptionState, PlanLimits, PLAN_LIMITS } from '../types';
import { useAuth } from './AuthContext';
import {
  initRevenueCat, getCustomerInfo, isPro,
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
        const rcPro = isPro(info);

        let tier: PlanTier = rcPro ? 'pro' : 'free';
        let expiresAt: string | null = null;

        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        if (entitlement?.expirationDate) {
          expiresAt = entitlement.expirationDate;
        }

        // DB의 tier와 RevenueCat이 다르면 DB 동기화
        if (profile.tier !== tier) {
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
    upgradePlan, subscriptionState: subState, loading,
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
