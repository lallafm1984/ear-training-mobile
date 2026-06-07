create table if not exists public.session_content_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_sec integer not null check (duration_sec >= 0),
  app_version text,
  locale text not null,
  total_runs integer not null check (total_runs > 0),
  by_content jsonb not null default '{}'::jsonb,
  by_content_difficulty jsonb not null default '{}'::jsonb,
  by_source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_content_logs_session_id_length check (char_length(session_id) <= 128),
  constraint session_content_logs_app_version_length check (
    app_version is null or char_length(app_version) <= 64
  ),
  constraint session_content_logs_locale_length check (char_length(locale) <= 32),
  constraint session_content_logs_by_content_is_object check (jsonb_typeof(by_content) = 'object'),
  constraint session_content_logs_by_content_difficulty_is_object check (
    jsonb_typeof(by_content_difficulty) = 'object'
  ),
  constraint session_content_logs_by_source_is_object check (jsonb_typeof(by_source) = 'object')
);

create index if not exists session_content_logs_user_created_at_idx
  on public.session_content_logs (user_id, created_at desc);

create index if not exists session_content_logs_created_at_idx
  on public.session_content_logs (created_at desc);

alter table public.session_content_logs enable row level security;

revoke all on public.session_content_logs from anon, authenticated;
grant select, insert on public.session_content_logs to authenticated;

drop policy if exists "Users can insert own session content logs" on public.session_content_logs;
create policy "Users can insert own session content logs"
  on public.session_content_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can read own session content logs" on public.session_content_logs;
create policy "Users can read own session content logs"
  on public.session_content_logs
  for select
  to authenticated
  using (user_id = auth.uid());
