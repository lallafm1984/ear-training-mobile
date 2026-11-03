update public.app_announcements
set revision = case
      when display_mode = 'daily' and coalesce(min_build, 0) >= 60 then revision
      else revision + 1
    end,
    display_mode = 'daily',
    min_build = greatest(coalesce(min_build, 60), 60),
    ends_at = coalesce(
      (
        select promotion.ends_at
        from public.app_promotions as promotion
        where promotion.id = 'admissions_support_2026'
      ),
      ends_at
    ),
    updated_at = now()
where id = 'admissions_support_2026';

comment on table public.app_announcements is
  'Remotely managed, server-timed global announcement popups. The admissions_support_2026 notice is daily for build 60+ and ends with its promotion.';
