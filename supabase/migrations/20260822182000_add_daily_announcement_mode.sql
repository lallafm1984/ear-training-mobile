alter table public.app_announcements
  drop constraint if exists app_announcements_display_mode_check;

-- once_per_build는 이미 설치된 앱과 기존 운영 행의 호환성을 위해 계속 허용한다.
-- 새 운영 공지는 once, daily, every_launch 세 모드 중 하나를 사용한다.
alter table public.app_announcements
  add constraint app_announcements_display_mode_check
  check (display_mode in ('once', 'daily', 'every_launch', 'once_per_build'));

comment on column public.app_announcements.display_mode is
  'Popup cadence: once, daily, or every_launch. once_per_build is retained for backward compatibility.';
