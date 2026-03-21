-- ═══════════════════════════════════════════════════════════
-- Gen 포인트 시스템 마이그레이션
-- Supabase Dashboard > SQL Editor에서 실행하세요.
-- ═══════════════════════════════════════════════════════════

-- ── 1. profiles 테이블에 gen_balance 컬럼 추가 ─────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gen_balance INT NOT NULL DEFAULT 100;

-- ── 2. 기존 사용자에게 초기 Gen 100 부여 ────────────────────
UPDATE public.profiles
  SET gen_balance = 100
  WHERE gen_balance = 0 OR gen_balance IS NULL;

-- ── 3. 신규 가입 트리거 함수 수정 (gen_balance 포함) ────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, gen_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    100
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. 매일 KST 06:00 Gen 충전 함수 ────────────────────────
-- (Supabase Scheduled Jobs 또는 Edge Function에서 호출)
-- Free: 100 Gen, Pro: 200 Gen, Premium: 변동 없음
CREATE OR REPLACE FUNCTION public.recharge_daily_gen()
RETURNS void AS $$
BEGIN
  -- Free 유저: 100 Gen 충전
  UPDATE public.profiles
  SET gen_balance = gen_balance + 100,
      updated_at = NOW()
  WHERE tier = 'free';

  -- Pro 유저: 200 Gen 충전
  UPDATE public.profiles
  SET gen_balance = gen_balance + 200,
      updated_at = NOW()
  WHERE tier = 'pro'
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. 스케줄링 설정 (pg_cron 확장 필요) ─────────────────────
-- Supabase Dashboard > Database > Extensions에서 'pg_cron'을 먼저 활성화하세요.
-- 그 후 아래 SQL을 실행하면 매일 한국시간 오전 6시에 충전됩니다.

-- 기존 동일 이름의 작업이 있다면 제거
-- SELECT cron.unschedule('daily-gen-recharge');

-- 신규 스케줄 등록 (UTC 21:00 = KST 06:00)
SELECT cron.schedule(
  'daily-gen-recharge',
  '0 21 * * *',
  'SELECT public.recharge_daily_gen()'
);
