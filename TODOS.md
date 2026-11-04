# TODOS

## 출시 전 필수 (BLOCKER)

### 1. 계정 삭제 실제 계정 검증

- **2026-11-04 운영 조회:** `public.delete_own_account()`가 존재한다. `SECURITY DEFINER`, 빈 `search_path`, `auth.uid()`로 본인 `auth.users` 행만 삭제하며, `profiles_id_fkey`의 `ON DELETE CASCADE`로 프로필도 삭제된다. 별도 Edge Function 신규 구현은 필요 없다.
- **2.0 후속 수정:** `AuthContext.deleteAccount`는 RPC 성공 후 본인 로컬 학습 데이터를 정리하고 로그아웃한다. RPC 실패 시 오류를 반환하고 기존 프로필·로컬 기록·세션을 보존한다. `authContext.test.ts`에서 실패·성공 순서·게스트 차단을 검증한다.
- **남은 검증:** 삭제 가능한 테스트 계정으로 로그인 → 표시 이름 변경 → 로그아웃/재로그인 → 탈퇴를 확인한다. 이번 점검에서는 실제 계정을 삭제하지 않았다.

### 2. RevenueCat webhook → DB tier 동기화

- **What:** RevenueCat 구독 상태 변경 시 webhook → Supabase Edge Function → `profiles.tier` 업데이트 (service_role)
- **Why:** 구독 컬럼 보호 트리거 적용 후에는 클라이언트의 tier 캐시 갱신이 무시된다. 본인 행 RLS와 구독 컬럼 보호 트리거는 별개다.
- **Depends on:** 구독 보호 트리거 적용 전 실제 RevenueCat → 웹훅 수신 연결 확인
- **2026-11-03 현황:** 코드에 `supabase/functions/revenuecat-webhook`과 RLS 마이그레이션 2건(`20261103120000_enable_profiles_rls.sql`, `20261103120100_protect_profiles_subscription_columns.sql`)이 있다. 운영 DB 적용은 아직이며 절차는 `docs/PROFILES_RLS_20261103.md`. Advisor의 `rls_disabled_in_public`(profiles) 경고는 첫 번째 마이그레이션 적용으로 해소된다.
- **2026-11-04 운영 조회:** `revenuecat-webhook`은 ACTIVE/version 2로 배포되어 있다. RevenueCat 대시보드의 연결·실제 수신은 미확인. `profiles` RLS는 false, 정책 0개, 구독 보호 트리거도 미적용이다. 종료된 `admissions_support_2026`의 `enabled`도 아직 true다(종료 시각은 지남). 이번 점검은 읽기 전용이며 운영 DB 변경은 하지 않았다.

## 2.0 업데이트 이후 남은 일 (2026-11-04)

- [ ] 실기기 검증 확대: 알림 실제 수신, 6/8 둘잇단 기보·4성부 청감, 게스트 로그인 이관, Play 업데이트 데이터 보존. S25의 리듬 탭 신호·언어 선택/취소/적용/재시작 유지·알림 권한/예약, 태블릿 에뮬레이터의 공유 카드 캡처·공유 시트는 확인했다(`docs/HANDOFF_2_0_CODEX_20261104.md` 12장).
- [ ] profiles RLS 마이그레이션 운영 DB 적용 (`docs/PROFILES_RLS_20261103.md`)
- [ ] 종료 프로모션·공지 비활성화 마이그레이션 운영 DB 적용 (`20261104100000_end_admissions_promotion.sql`)
- [ ] Play Console 내부 테스트 v67 AAB 업로드, 스토어 문구·스크린샷·출시 노트 갱신 (`store/android/listing.md`)
- [ ] (보류) iOS: Apple 로그인, 마이크 권한 문구 삭제, 계정 삭제 확인
- [ ] (보류) 연간 요금제·무료 체험, 다크 모드
