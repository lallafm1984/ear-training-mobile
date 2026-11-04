insert into public.app_promotions (
  id,
  enabled,
  starts_at,
  ends_at
)
values (
  'admissions_support_2026',
  true,
  timestamptz '2026-08-18 00:00:00+09',
  timestamptz '2026-10-01 00:00:00+09'
)
on conflict (id) do update
set enabled = excluded.enabled,
    ends_at = excluded.ends_at,
    updated_at = now();

-- 이 공지는 원격 공지 기능이 포함된 Android 빌드 59부터만 표시한다.
-- 시작일은 사용자 문구에서 의도적으로 제외하고, 9월 30일까지임만 안내한다.
insert into public.app_announcements (
  id,
  revision,
  enabled,
  platform,
  priority,
  starts_at,
  ends_at,
  min_build,
  max_build,
  display_mode,
  title_ko,
  title_en,
  title_ja,
  body_ko,
  body_en,
  body_ja,
  action_label_ko,
  action_label_en,
  action_label_ja,
  action_url,
  confirm_label_ko,
  confirm_label_en,
  confirm_label_ja
)
values (
  'admissions_support_2026',
  1,
  true,
  'android',
  100,
  now(),
  timestamptz '2026-10-01 00:00:00+09',
  59,
  null,
  'once',
  '수험생 여러분을 응원합니다',
  'Limited-Time Student Support Promotion',
  '受験生のみなさんを応援します',
  E'9월 30일까지 대입 수시 전형을 준비하는 수험생 여러분을 위한 무료 이용 기간을 운영합니다.\n\n이 기간에는 모든 이용자에게 MelodyGen Pro가 무료로 제공됩니다.\n\n기존 정기 구독자의 다음 결제일은 한 달 뒤로 연장됩니다.\n\n매일의 작은 청음 연습이 자신감으로 이어지길 바랍니다. 여러분의 노력과 도전을 진심으로 응원합니다.',
  E'Through September 30, MelodyGen is offering free access to support students preparing for college applications, music auditions, and new learning goals.\n\nDuring this period, MelodyGen Pro is available free of charge to all users.\n\nFor existing subscribers, the next billing date will be extended by one month.\n\nWe hope each day of ear training builds your confidence. We are cheering for your next step.',
  E'9月30日まで、受験や新しい学習目標に向けて取り組むみなさんを応援する無料利用期間を実施します。\n\n期間中は、すべてのユーザーにMelodyGen Proを無料で提供します。\n\n現在定期購入中の方は、次回の請求日が1か月後に延長されます。\n\n毎日の小さな聴音トレーニングが自信につながりますように。みなさんの努力と新しい一歩を心から応援しています。',
  null,
  null,
  null,
  null,
  '확인',
  'OK',
  '確認'
)
on conflict (id) do update
set revision = excluded.revision,
    enabled = excluded.enabled,
    platform = excluded.platform,
    priority = excluded.priority,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    min_build = excluded.min_build,
    max_build = excluded.max_build,
    display_mode = excluded.display_mode,
    title_ko = excluded.title_ko,
    title_en = excluded.title_en,
    title_ja = excluded.title_ja,
    body_ko = excluded.body_ko,
    body_en = excluded.body_en,
    body_ja = excluded.body_ja,
    action_label_ko = excluded.action_label_ko,
    action_label_en = excluded.action_label_en,
    action_label_ja = excluded.action_label_ja,
    action_url = excluded.action_url,
    confirm_label_ko = excluded.confirm_label_ko,
    confirm_label_en = excluded.confirm_label_en,
    confirm_label_ja = excluded.confirm_label_ja,
    updated_at = now();
