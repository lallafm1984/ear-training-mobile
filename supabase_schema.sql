-- ═══════════════════════════════════════════════════════════
-- MelodyGen - Supabase 초기 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- ═══════════════════════════════════════════════════════════

-- ── 1. profiles 테이블 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                    TEXT        NOT NULL,
  display_name             TEXT,
  avatar_url               TEXT,
  tier                     TEXT        NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
  subscription_expires_at  TIMESTAMPTZ,
  monthly_download_count   INT         NOT NULL DEFAULT 0,
  download_reset_month     TEXT        NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. RLS 활성화 ──────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 조회 가능
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 본인 프로필만 수정 가능
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 본인 프로필만 삭제 가능 (회원 탈퇴)
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ── 3. 신규 가입 시 profiles 자동 생성 트리거 ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── 4. updated_at 자동 갱신 트리거 ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 5. 매월 1일 다운로드 카운트 초기화 함수 ────────────────
-- (선택사항: Supabase Scheduled Jobs 또는 Edge Function에서 호출)
CREATE OR REPLACE FUNCTION public.reset_monthly_downloads()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET monthly_download_count = 0,
      download_reset_month   = TO_CHAR(NOW(), 'YYYY-MM')
  WHERE download_reset_month < TO_CHAR(NOW(), 'YYYY-MM');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
