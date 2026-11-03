-- ─────────────────────────────────────────────────────────────
-- profiles.tier / subscription_expires_at 클라이언트 변경 차단 (docs/PLANNING.md §13)
--
-- RLS 만으로는 사용자가 본인 행의 tier 를 'pro' 로 직접 UPDATE 할 수 있다.
-- 이 트리거는 authenticated/anon JWT 로 들어온 UPDATE 에서 두 컬럼의 변경을 조용히 무시하고
-- (오류 없이 나머지 컬럼만 반영), service_role 키와 JWT 가 없는 내부 세션(SQL Editor, 마이그레이션)만 허용한다.
--
-- ⚠ 적용 전제: revenuecat-webhook Edge Function 이 배포되어 RevenueCat 이벤트가 profiles 에
--   반영되고 있어야 한다. 그렇지 않으면 DB 의 tier 캐시(RevenueCat 실패 시 폴백)가 더 이상 갱신되지 않는다.
--   구독 판정 자체는 RevenueCat SDK 가 담당하므로 앱의 Pro 접근 여부는 바뀌지 않는다.
-- ─────────────────────────────────────────────────────────────

create or replace function public.protect_profile_subscription_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), '');
begin
  -- service_role(Edge Function) 또는 JWT 없는 내부 세션은 허용
  if jwt_role = 'service_role' or jwt_role = '' then
    return new;
  end if;

  -- 클라이언트 세션: 구독 컬럼 변경을 되돌리고 나머지 컬럼만 반영
  new.tier := old.tier;
  new.subscription_expires_at := old.subscription_expires_at;
  return new;
end;
$$;

revoke all on function public.protect_profile_subscription_columns() from public, anon, authenticated;

drop trigger if exists protect_profile_subscription_columns on public.profiles;
create trigger protect_profile_subscription_columns
  before update of tier, subscription_expires_at on public.profiles
  for each row
  execute function public.protect_profile_subscription_columns();
