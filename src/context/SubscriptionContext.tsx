import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib';
import { PlanTier, SubscriptionState, PlanLimits, PLAN_LIMITS } from '../types';
import { useAuth } from './AuthContext';


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
  genBalance:         number;       // 자동 충전 gen
  genPaidBalance:     number;       // 결제 gen
  consumeGen:         (amount: number) => Promise<void>;
  addPaidGen:         (amount: number) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [subState, setSubState] = useState<SubscriptionState>(DEFAULT_STATE);
  const [loading,  setLoading]  = useState(true);

  // ── profile 변경 시 구독 상태 동기화 ────────────────────
  useEffect(() => {
    if (!user || !profile) {
      setSubState(DEFAULT_STATE);
      setLoading(false);
      return;
    }

    const currentMonth = getCurrentYearMonth();
    let tier = (profile.tier as PlanTier) ?? 'free';
    let expiresAt = profile.subscription_expires_at ?? null;
    let downloadCount = profile.monthly_download_count ?? 0;
    let resetMonth = profile.download_reset_month ?? currentMonth;

    // 만료 체크
    if (expiresAt && new Date(expiresAt) < new Date()) {
      tier      = 'free';
      expiresAt = null;
    }

    // 월 변경 시 카운트 리셋
    if (resetMonth !== currentMonth) {
      downloadCount = 0;
      resetMonth    = currentMonth;
      // DB에도 반영
      supabase
        .from('profiles')
        .update({ monthly_download_count: 0, download_reset_month: currentMonth })
        .eq('id', user.id)
        .then(() => {});
    }

    setSubState({ tier, expiresAt, monthlyDownloadCount: downloadCount, downloadResetMonth: resetMonth });
    setLoading(false);
  }, [user, profile]);

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
    const limits = PLAN_LIMITS[subState.tier];
    if (limits.monthlyDownloadLimit === null) return true;
    if (limits.monthlyDownloadLimit === 0)    return false;
    if (subState.monthlyDownloadCount >= limits.monthlyDownloadLimit) return false;

    await persistToSupabase({
      ...subState,
      monthlyDownloadCount: subState.monthlyDownloadCount + 1,
    });
    return true;
  }, [subState, persistToSupabase]);

  // ── Gen 잔액 ─────────────────────────────────────────────
  const [genBalance,     setGenBalance]     = useState<number>(profile?.gen_balance      ?? 100);
  const [genPaidBalance, setGenPaidBalance] = useState<number>((profile as any)?.gen_paid_balance ?? 0);

  useEffect(() => {
    setGenBalance(profile?.gen_balance ?? 100);
    setGenPaidBalance((profile as any)?.gen_paid_balance ?? 0);
  }, [profile]);

  // 자동 충전 먼저 차감, 부족하면 결제 gen에서 차감
  const consumeGen = useCallback(async (amount: number) => {
    let autoDeduct = Math.min(amount, genBalance);
    let paidDeduct = amount - autoDeduct;

    const nextAuto = genBalance - autoDeduct;
    const nextPaid = Math.max(0, genPaidBalance - paidDeduct);

    setGenBalance(nextAuto);
    setGenPaidBalance(nextPaid);
    if (user) {
      await supabase.from('profiles')
        .update({ gen_balance: nextAuto, gen_paid_balance: nextPaid })
        .eq('id', user.id);
    }
  }, [genBalance, genPaidBalance, user]);

  // 결제 gen 추가
  const addPaidGen = useCallback(async (amount: number) => {
    const next = genPaidBalance + amount;
    setGenPaidBalance(next);
    if (user) {
      await supabase.from('profiles').update({ gen_paid_balance: next }).eq('id', user.id);
    }
  }, [genPaidBalance, user]);

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
    genBalance, genPaidBalance, consumeGen, addPaidGen,
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
