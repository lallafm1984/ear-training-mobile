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
