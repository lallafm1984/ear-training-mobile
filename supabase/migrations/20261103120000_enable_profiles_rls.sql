-- ─────────────────────────────────────────────────────────────
-- public.profiles 행 수준 보안(RLS) 활성화
-- Supabase Security Advisor: "Table publicly accessible / rls_disabled_in_public" (CRITICAL)
--
-- profiles 테이블은 대시보드에서 생성되어 저장소 마이그레이션에 정의가 없다.
-- 이 파일은 테이블이 이미 존재한다는 전제로 RLS와 본인 행 정책만 정의한다.
--
-- 앱 동작 영향 없음:
--   - AuthContext / SubscriptionContext 는 로그인한 사용자의 본인 행만 select/insert/update/delete 한다.
--   - revenuecat-webhook Edge Function 은 service_role 키를 쓰므로 RLS를 우회한다.
--   - delete_own_account RPC(security definer)는 auth.users 를 지우며 이 정책의 영향을 받지 않는다.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- 익명(anon) 키로 profiles 에 접근할 경로는 없다 (앱은 로그인 후에만 조회).
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- 탈퇴 후 재가입 등으로 행이 없을 때 AuthContext 가 본인 행을 생성한다.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own profile (tier protected)" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 회원 탈퇴: AuthContext.deleteAccount 가 본인 행을 지운다.
drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles
  for delete
  to authenticated
  using ((select auth.uid()) = id);
