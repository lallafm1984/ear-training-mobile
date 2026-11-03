create table if not exists public.app_promotions (
  id text primary key,
  enabled boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_promotions_valid_period check (ends_at > starts_at)
);

comment on table public.app_promotions is
  'Server-authoritative promotion periods used for account entitlement decisions.';

alter table public.app_promotions enable row level security;

-- 앱은 원본 일정 행을 직접 읽거나 변경하지 않고, 아래 RPC의 판정 결과만 사용한다.
revoke all on public.app_promotions from anon, authenticated;

insert into public.app_promotions (id, enabled, starts_at, ends_at)
values (
  'admissions_support_2026',
  true,
  timestamptz '2026-08-18 00:00:00+09',
  timestamptz '2026-09-18 00:00:00+09'
)
on conflict (id) do update
set enabled = excluded.enabled,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    updated_at = now();

create or replace function public.is_promotion_active(p_promotion_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_promotions
    where id = p_promotion_id
      and enabled
      and now() >= starts_at
      and now() < ends_at
  );
$$;

comment on function public.is_promotion_active(text) is
  'Returns promotion activity using PostgreSQL server time; callable by authenticated users only.';

revoke execute on function public.is_promotion_active(text) from public, anon;
grant execute on function public.is_promotion_active(text) to authenticated;
