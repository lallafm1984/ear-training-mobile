# profiles 테이블 RLS 활성화 (2026-11-03)

## 운영 적용 결과 (2026-11-04)

- 라이브 1.1.3(`3a1a283`, Android 62)의 본인 프로필 접근과 구독 캐시 갱신 방식을 대조한 뒤, 아래 2건을 운영 `xcxlqeaenpsnnxphedci`에 적용했다.

| 저장소 마이그레이션 | 운영 이력 version/name | 결과 |
| --- | --- | --- |
| `20261103120000_enable_profiles_rls.sql` | `20261104073459` / `enable_profiles_rls` | RLS=true, SELECT/INSERT/UPDATE/DELETE 본인 정책 4개, anon SELECT 권한 없음 |
| `20261104100000_end_admissions_promotion.sql` | `20261104073628` / `end_admissions_promotion` | 이미 기간이 끝난 프로모션·공지의 enabled=false 고정 |

- 3초 잠금 대기 제한·20초 실행 제한을 두었고, 프로모션 적용 시 대상 행을 잠근 뒤 만료 여부를 재확인했다.
- authenticated 역할로 본인 생성·조회·닉네임 수정·삭제, 타인 접근 차단, 소유자 변경 차단을 검증했다. **기존 앱의 tier/만료일 캐시 갱신도 허용됨**을 확인했다. 테스트 변경은 같은 트랜잭션에서 모두 ROLLBACK했다.
- service_role 접근 유지, anon 접근 거부 확인. 배포된 revenuecat-webhook 소스도 service_role 키 사용을 확인했다.
- 적용 전후 profiles 373행/auth.users 377행으로 동일. 빌드 62·67 × ko/en/ja의 앱 제어 RPC 응답 해시 6개가 동일하고, 프로모션 판정도 false로 동일했다.
- Security Advisor의 `rls_disabled_in_public` 경고가 사라졌다. [해당 검사 설명](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- **구독 컬럼 보호 트리거는 미적용.** 웹훅은 배포되어 있지만 RevenueCat 측 연결·실제 수신이 미확인이라 기존 클라이언트 캐시 갱신을 유지한다.
- 운영 이력은 이번 MCP 적용 시점의 버전으로 기록된다. 과거 SQL은 수동 적용되어 이력이 비어 있었으므로, 기존 이력 정합성을 정리하기 전 `supabase db push`로 과거 마이그레이션 전체를 다시 적용하지 않는다.

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
   이미 적용된 운영 환경에서는 재실행하지 않는다. CLI 일괄 적용은 위 운영 이력 주의사항을 먼저 확인한다.
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
