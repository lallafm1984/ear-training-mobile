# TODOS

## 출시 전 필수 (BLOCKER)

### 1. 계정 삭제 Edge Function

- **What:** Supabase Edge Function에서 `auth.admin.deleteUser()` 호출 + 클라이언트 연동
- **Why:** Apple App Store 가이드라인 5.1.1(v) — 계정 삭제 기능 필수. 현재 `profiles` 행만 삭제하고 `auth.users`는 남아있음
- **Context:** `AuthContext.tsx:190-214`의 `deleteAccount`가 주석으로 "Edge Function 필요" 표시. service_role key는 클라이언트에서 사용 불가
- **Depends on:** Supabase 프로젝트에 Edge Function 환경 설정

### 2. RevenueCat webhook → DB tier 동기화

- **What:** RevenueCat 구독 상태 변경 시 webhook → Supabase Edge Function → `profiles.tier` 업데이트 (service_role)
- **Why:** `profiles.tier` RLS 적용 시 클라이언트 직접 쓰기가 차단됨. DB와 RevenueCat 상태 동기화 필요
- **Context:** `SubscriptionContext.tsx:93-98`에서 현재 클라이언트가 직접 tier를 UPDATE하고 있음. RLS SQL은 `PLANNING.md:361-392`에 작성됨
- **Depends on:** RLS SQL 적용 시점과 함께 처리
- **2026-11-03 현황:** 코드에 `supabase/functions/revenuecat-webhook`과 RLS 마이그레이션 2건(`20261103120000_enable_profiles_rls.sql`, `20261103120100_protect_profiles_subscription_columns.sql`)이 있다. 운영 DB 적용은 아직이며 절차는 `docs/PROFILES_RLS_20261103.md`. Advisor의 `rls_disabled_in_public`(profiles) 경고는 첫 번째 마이그레이션 적용으로 해소된다.

## 2.0 업데이트 이후 남은 일 (2026-11-03)

- [ ] 새 네이티브 모듈(expo-notifications, react-native-view-shot) 포함 개발 빌드·릴리스 빌드 후 실기기 확인: 알림 예약, 공유 카드 캡처, 리듬 탭 클릭 트랙 동기화
- [ ] profiles RLS 마이그레이션 운영 DB 적용 (`docs/PROFILES_RLS_20261103.md`)
- [ ] Play Console 스토어 문구·스크린샷·출시 노트 갱신 (`store/android/listing.md`)
- [ ] (보류) iOS: Apple 로그인, 마이크 권한 문구 삭제, 계정 삭제 확인
- [ ] (보류) 연간 요금제·무료 체험, 다크 모드
