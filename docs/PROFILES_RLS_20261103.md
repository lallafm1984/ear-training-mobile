# profiles 테이블 RLS 활성화 (2026-11-03)

## 배경

- Supabase Security Advisor 메일(2026-10-17 기준)에 `ear-training` 프로젝트의 CRITICAL 이슈
  **Table publicly accessible / `rls_disabled_in_public`** 이 표시됨.
- 저장소 마이그레이션에 정의된 테이블(`session_content_logs`, `app_promotions`, `app_release_policies`,
  `app_announcements`)은 모두 RLS 가 켜져 있다. 대시보드에서 직접 만든 `public.profiles` 만 마이그레이션이 없고,
  8월 인수인계 기록에도 `profiles` 의 RLS 비활성이 Advisor 에 표시됐다고 남아 있다. → 대상 테이블은 `public.profiles`.
- RLS 가 꺼져 있으면 anon 키만으로 모든 사용자의 이메일·표시 이름·구독 상태를 읽고 바꿀 수 있다.

## 변경 파일

| 파일                                                                           | 내용                                                                                          | 적용 조건                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `supabase/migrations/20261103120000_enable_profiles_rls.sql`                   | `profiles` RLS 활성화, anon 권한 회수, 본인 행 select/insert/update/delete 정책               | **즉시 적용 권장.** 앱 동작 변화 없음                |
| `supabase/migrations/20261103120100_protect_profiles_subscription_columns.sql` | 클라이언트 JWT 로는 `tier`·`subscription_expires_at` 변경을 무시하는 트리거 (PLANNING.md §13) | `revenuecat-webhook` 이 배포·연결되어 있을 때만 적용 |

## 앱 코드와의 정합성

| 호출                                       | 위치                        | 정책                                                            |
| ------------------------------------------ | --------------------------- | --------------------------------------------------------------- |
| `select * from profiles where id = uid`    | `AuthContext.loadProfile`   | select own                                                      |
| `insert profiles (id = uid)` (재가입 복구) | `AuthContext.loadProfile`   | insert own                                                      |
| `update display_name`                      | `AuthContext.updateProfile` | update own                                                      |
| `update tier, subscription_expires_at`     | `SubscriptionContext`       | update own (트리거 적용 시 두 컬럼은 무시되고 오류는 나지 않음) |
| `delete profiles where id = uid`           | `AuthContext.deleteAccount` | delete own                                                      |
| `update tier …` (service_role)             | `revenuecat-webhook`        | RLS 우회                                                        |
| `rpc delete_own_account`                   | `AuthContext.deleteAccount` | security definer, 영향 없음                                     |

## 적용 방법 (운영 DB)

1. Supabase 대시보드 → SQL Editor 에서 `20261103120000_enable_profiles_rls.sql` 내용을 실행한다.
   (또는 로컬에서 `supabase link` 후 `supabase db push`.)
2. 확인:
   ```sql
   select relrowsecurity from pg_class where oid = 'public.profiles'::regclass; -- true
   select policyname, cmd from pg_policies where tablename = 'profiles';      -- 4개
   ```
3. 앱에서 로그인 → 프로필 표시 이름 변경 → 로그아웃/재로그인 → 회원 탈퇴 흐름을 한 번씩 확인한다.
4. Security Advisor 를 다시 열어 `rls_disabled_in_public` 이 사라졌는지 본다. 다른 테이블이 추가로 표시되면 같은 방식으로 처리한다.
5. `revenuecat-webhook` 이 배포되어 있고 RevenueCat 대시보드의 Webhook URL 이 연결돼 있으면
   `20261103120100_protect_profiles_subscription_columns.sql` 도 실행한다.

## 롤백

```sql
drop trigger if exists protect_profile_subscription_columns on public.profiles;
drop function if exists public.protect_profile_subscription_columns();
alter table public.profiles disable row level security;
```
