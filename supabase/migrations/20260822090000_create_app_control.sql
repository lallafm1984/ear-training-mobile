create table if not exists public.app_release_policies (
  platform text primary key,
  enabled boolean not null default true,
  latest_build integer not null,
  minimum_supported_build integer not null,
  force_latest boolean not null default true,
  latest_version_name text,
  store_url text not null,
  update_title_ko text not null,
  update_title_en text,
  update_title_ja text,
  update_message_ko text not null,
  update_message_en text,
  update_message_ja text,
  update_button_label_ko text not null default '최신 버전으로 업데이트',
  update_button_label_en text,
  update_button_label_ja text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_release_policies_platform_check
    check (platform in ('android', 'ios')),
  constraint app_release_policies_builds_check
    check (
      latest_build > 0
      and minimum_supported_build > 0
      and minimum_supported_build <= latest_build
    ),
  constraint app_release_policies_store_url_check
    check (store_url like 'https://%')
);

comment on table public.app_release_policies is
  'Server-authoritative mobile release policy. When force_latest is true, every older build is blocked.';

create table if not exists public.app_announcements (
  id text primary key,
  revision integer not null default 1,
  enabled boolean not null default false,
  platform text not null default 'all',
  priority integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  min_build integer,
  max_build integer,
  display_mode text not null default 'once',
  title_ko text not null,
  title_en text,
  title_ja text,
  body_ko text not null,
  body_en text,
  body_ja text,
  action_label_ko text,
  action_label_en text,
  action_label_ja text,
  action_url text,
  confirm_label_ko text not null default '확인',
  confirm_label_en text,
  confirm_label_ja text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_announcements_id_check
    check (id ~ '^[a-z0-9][a-z0-9_-]{0,99}$'),
  constraint app_announcements_revision_check
    check (revision > 0),
  constraint app_announcements_platform_check
    check (platform in ('all', 'android', 'ios')),
  constraint app_announcements_priority_check
    check (priority between -1000 and 1000),
  constraint app_announcements_period_check
    check (ends_at is null or ends_at > starts_at),
  constraint app_announcements_build_range_check
    check (
      (min_build is null or min_build > 0)
      and (max_build is null or max_build > 0)
      and (min_build is null or max_build is null or min_build <= max_build)
    ),
  constraint app_announcements_display_mode_check
    check (display_mode in ('once', 'once_per_build', 'every_launch')),
  constraint app_announcements_action_check
    check (
      (action_url is null and action_label_ko is null)
      or (action_url like 'https://%' and action_label_ko is not null)
    )
);

comment on table public.app_announcements is
  'Remotely managed, server-timed global announcement popups. Increment revision to show an edited notice again.';

alter table public.app_release_policies enable row level security;
alter table public.app_announcements enable row level security;

-- 앱은 운영 원본 행을 직접 읽거나 변경하지 않고, 제한된 RPC 응답만 사용한다.
revoke all on public.app_release_policies from anon, authenticated;
revoke all on public.app_announcements from anon, authenticated;

create or replace function public.set_app_control_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_release_policies_set_updated_at
  on public.app_release_policies;
create trigger app_release_policies_set_updated_at
before update on public.app_release_policies
for each row execute function public.set_app_control_updated_at();

drop trigger if exists app_announcements_set_updated_at
  on public.app_announcements;
create trigger app_announcements_set_updated_at
before update on public.app_announcements
for each row execute function public.set_app_control_updated_at();

insert into public.app_release_policies (
  platform,
  enabled,
  latest_build,
  minimum_supported_build,
  force_latest,
  latest_version_name,
  store_url,
  update_title_ko,
  update_title_en,
  update_title_ja,
  update_message_ko,
  update_message_en,
  update_message_ja,
  update_button_label_ko,
  update_button_label_en,
  update_button_label_ja
)
values (
  'android',
  true,
  58,
  58,
  true,
  '1.0.2',
  'https://play.google.com/store/apps/details?id=com.melodygen.app',
  '새 버전이 출시되었습니다',
  'A new version is available',
  '新しいバージョンがあります',
  'MelodyGen을 계속 사용하려면 최신 버전으로 업데이트해 주세요.',
  'Update to the latest version to continue using MelodyGen.',
  'MelodyGenを引き続き使用するには、最新バージョンに更新してください。',
  '최신 버전으로 업데이트',
  'Update now',
  '今すぐ更新'
)
on conflict (platform) do nothing;

-- Supabase Table Editor에서 이 예시 행을 수정하고 enabled를 켜면 즉시 공지할 수 있다.
insert into public.app_announcements (
  id,
  revision,
  enabled,
  platform,
  priority,
  starts_at,
  display_mode,
  title_ko,
  title_en,
  title_ja,
  body_ko,
  body_en,
  body_ja,
  confirm_label_ko,
  confirm_label_en,
  confirm_label_ja
)
values (
  'remote_notice_example',
  1,
  false,
  'all',
  0,
  now(),
  'once',
  '공지사항',
  'Notice',
  'お知らせ',
  'Supabase에서 제목과 내용을 수정한 뒤 enabled를 켜세요.',
  'Edit this title and message in Supabase, then enable the notice.',
  'Supabaseでタイトルと本文を編集し、通知を有効にしてください。',
  '확인',
  'OK',
  '確認'
)
on conflict (id) do nothing;

create index if not exists app_announcements_active_lookup_idx
  on public.app_announcements (
    enabled,
    platform,
    priority desc,
    starts_at desc
  );

create or replace function public.get_app_control_config(
  p_platform text,
  p_build integer,
  p_locale text default 'ko'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'release', (
      select jsonb_build_object(
        'platform', policy.platform,
        'latestBuild', policy.latest_build,
        'minimumSupportedBuild', policy.minimum_supported_build,
        'forceLatest', policy.force_latest,
        'latestVersionName', policy.latest_version_name,
        'requiredBuild', case
          when policy.force_latest then policy.latest_build
          else policy.minimum_supported_build
        end,
        'forceUpdate', coalesce(p_build, 0) < case
          when policy.force_latest then policy.latest_build
          else policy.minimum_supported_build
        end,
        'storeUrl', policy.store_url,
        'title', case left(lower(coalesce(p_locale, 'ko')), 2)
          when 'en' then coalesce(policy.update_title_en, policy.update_title_ko)
          when 'ja' then coalesce(policy.update_title_ja, policy.update_title_ko)
          else policy.update_title_ko
        end,
        'message', case left(lower(coalesce(p_locale, 'ko')), 2)
          when 'en' then coalesce(policy.update_message_en, policy.update_message_ko)
          when 'ja' then coalesce(policy.update_message_ja, policy.update_message_ko)
          else policy.update_message_ko
        end,
        'buttonLabel', case left(lower(coalesce(p_locale, 'ko')), 2)
          when 'en' then coalesce(policy.update_button_label_en, policy.update_button_label_ko)
          when 'ja' then coalesce(policy.update_button_label_ja, policy.update_button_label_ko)
          else policy.update_button_label_ko
        end
      )
      from public.app_release_policies as policy
      where policy.platform = lower(coalesce(p_platform, ''))
        and policy.enabled
      limit 1
    ),
    'announcement', (
      select jsonb_build_object(
        'id', announcement.id,
        'revision', announcement.revision,
        'displayMode', announcement.display_mode,
        'title', case left(lower(coalesce(p_locale, 'ko')), 2)
          when 'en' then coalesce(announcement.title_en, announcement.title_ko)
          when 'ja' then coalesce(announcement.title_ja, announcement.title_ko)
          else announcement.title_ko
        end,
        'body', case left(lower(coalesce(p_locale, 'ko')), 2)
          when 'en' then coalesce(announcement.body_en, announcement.body_ko)
          when 'ja' then coalesce(announcement.body_ja, announcement.body_ko)
          else announcement.body_ko
        end,
        'actionLabel', case
          when announcement.action_url is null then null
          else case left(lower(coalesce(p_locale, 'ko')), 2)
            when 'en' then coalesce(announcement.action_label_en, announcement.action_label_ko)
            when 'ja' then coalesce(announcement.action_label_ja, announcement.action_label_ko)
            else announcement.action_label_ko
          end
        end,
        'actionUrl', announcement.action_url,
        'confirmLabel', case left(lower(coalesce(p_locale, 'ko')), 2)
          when 'en' then coalesce(announcement.confirm_label_en, announcement.confirm_label_ko)
          when 'ja' then coalesce(announcement.confirm_label_ja, announcement.confirm_label_ko)
          else announcement.confirm_label_ko
        end
      )
      from public.app_announcements as announcement
      where announcement.enabled
        and announcement.platform in ('all', lower(coalesce(p_platform, '')))
        and now() >= announcement.starts_at
        and (announcement.ends_at is null or now() < announcement.ends_at)
        and (announcement.min_build is null or coalesce(p_build, 0) >= announcement.min_build)
        and (announcement.max_build is null or coalesce(p_build, 0) <= announcement.max_build)
      order by announcement.priority desc,
               announcement.starts_at desc,
               announcement.updated_at desc
      limit 1
    )
  );
$$;

comment on function public.get_app_control_config(text, integer, text) is
  'Returns localized release enforcement and one active announcement using PostgreSQL server time.';

revoke execute on function public.set_app_control_updated_at() from public, anon, authenticated;
revoke execute on function public.get_app_control_config(text, integer, text) from public;
grant execute on function public.get_app_control_config(text, integer, text) to anon, authenticated;
