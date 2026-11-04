-- ─────────────────────────────────────────────────────────────
-- 2026 수험생 무료 이용 프로모션 종료 확정
--
-- admissions_support_2026 은 2026-10-01 00:00(+09) 에 기간이 끝나 is_promotion_active 가 이미 false 를
-- 반환한다. 2.0(Android 빌드 63)부터는 클라이언트가 프로모션 판정을 호출하지 않으며,
-- 빌드 62 이하 구버전이 계속 RPC 를 호출하므로 테이블·RPC 는 유지하고 행만 명시적으로 비활성화한다.
-- 기간을 잘못 연장해도 구버전에 Pro 가 다시 열리지 않도록 enabled 를 false 로 고정한다.
-- ─────────────────────────────────────────────────────────────

update public.app_promotions
set enabled = false,
    updated_at = now()
where id = 'admissions_support_2026';

update public.app_announcements
set enabled = false,
    updated_at = now()
where id = 'admissions_support_2026';
