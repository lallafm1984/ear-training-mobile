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
// 헬퍼
// ─────────────────────────────────────────────────────────────

function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DEFAULT_STATE: SubscriptionState = {
  tier:                 'free',
  expiresAt:            null,
  monthlyDownloadCount: 0,
  downloadResetMonth:   getCurrentYearMonth(),
};

// ─────────────────────────────────────────────────────────────
// Context 타입
// ─────────────────────────────────────────────────────────────

export interface SubscriptionContextValue {
  tier:               PlanTier;
  limits:             PlanLimits;
  isExpired:          boolean;
  remainingDownloads: number | null;
  upgradePlan:        (newTier: PlanTier, durationDays?: number) => Promise<void>;
  consumeDownload:    () => Promise<boolean>;
  subscriptionState:  SubscriptionState;
  loading:            boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

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
        // RevenueCat에 Supabase user ID 연결
        await loginRevenueCat(user.id);
        const info = await getCustomerInfo();
        const rcPro = isPro(info);

        const currentMonth = getCurrentYearMonth();
        let tier: PlanTier = rcPro ? 'pro' : 'free';
        let expiresAt: string | null = null;
        let downloadCount = profile.monthly_download_count ?? 0;
        let resetMonth = profile.download_reset_month ?? currentMonth;

        // RevenueCat에서 만료일 가져오기
        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        if (entitlement?.expirationDate) {
          expiresAt = entitlement.expirationDate;
        }

        // DB의 tier와 RevenueCat이 다르면 DB 동기화 (RevenueCat이 source of truth)
        if (profile.tier !== tier) {
          supabase
            .from('profiles')
            .update({ tier, subscription_expires_at: expiresAt })
            .eq('id', user.id)
            .then(() => {});
        }

        // 월 변경 시 카운트 리셋
        if (resetMonth !== currentMonth) {
          downloadCount = 0;
          resetMonth = currentMonth;
          supabase
            .from('profiles')
            .update({ monthly_download_count: 0, download_reset_month: currentMonth })
            .eq('id', user.id)
            .then(() => {});
        }

        setSubState({ tier, expiresAt, monthlyDownloadCount: downloadCount, downloadResetMonth: resetMonth });
      } catch {
        // RevenueCat 실패 시 DB 기반 폴백
        const currentMonth = getCurrentYearMonth();
        let tier = (profile.tier as PlanTier) ?? 'free';
        let expiresAt = profile.subscription_expires_at ?? null;
        let downloadCount = profile.monthly_download_count ?? 0;
        let resetMonth = profile.download_reset_month ?? currentMonth;

        if (tier === 'premium' as any) tier = 'pro';
        if (expiresAt && new Date(expiresAt) < new Date()) {
          tier = 'free';
          expiresAt = null;
        }

        setSubState({ tier, expiresAt, monthlyDownloadCount: downloadCount, downloadResetMonth: resetMonth });
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
        monthly_download_count:  next.monthlyDownloadCount,
        download_reset_month:    next.downloadResetMonth,
      })
      .eq('id', user.id);
  }, [user]);

  // ── 플랜 업그레이드 ──────────────────────────────────────
  const upgradePlan = useCallback(async (newTier: PlanTier, durationDays = 30) => {
    const expiresAt = newTier === 'free'
      ? null
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await persistToSupabase({
      tier:                 newTier,
      expiresAt,
      monthlyDownloadCount: 0,
      downloadResetMonth:   getCurrentYearMonth(),
    });
  }, [persistToSupabase]);

  // ── 다운로드 소모 ────────────────────────────────────────
  const consumeDownload = useCallback(async (): Promise<boolean> => {
    // 함수형 업데이트로 최신 상태 참조 (stale closure 방지)
    return new Promise<boolean>((resolve) => {
      setSubState(prev => {
        const limits = PLAN_LIMITS[prev.tier];
        if (limits.monthlyDownloadLimit === null) { resolve(true); return prev; }
        if (limits.monthlyDownloadLimit === 0)    { resolve(false); return prev; }
        if (prev.monthlyDownloadCount >= limits.monthlyDownloadLimit) { resolve(false); return prev; }

        const next = { ...prev, monthlyDownloadCount: prev.monthlyDownloadCount + 1 };
        persistToSupabase(next);
        resolve(true);
        return next;
      });
    });
  }, [persistToSupabase]);

  // ── 파생값 ──────────────────────────────────────────────
  const isExpired = !!(subState.expiresAt && new Date(subState.expiresAt) < new Date());
  const effectiveTier: PlanTier = isExpired ? 'free' : subState.tier;
  const limits = PLAN_LIMITS[effectiveTier];

  const remainingDownloads: number | null = (() => {
    if (limits.monthlyDownloadLimit === null) return null;
    if (limits.monthlyDownloadLimit === 0)    return 0;
    return Math.max(0, limits.monthlyDownloadLimit - subState.monthlyDownloadCount);
  })();

  const value: SubscriptionContextValue = {
    tier: effectiveTier, limits, isExpired, remainingDownloads,
    upgradePlan, consumeDownload, subscriptionState: subState, loading,
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
