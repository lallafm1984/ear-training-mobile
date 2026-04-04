# MelodyGen - 청음 훈련 앱 기획서

## 1. 프로젝트 개요

**MelodyGen**은 음악 전공자 및 입시 준비생을 위한 모바일 청음 훈련 앱입니다.
선율·리듬·음정·화성·조성·2성부 6가지 카테고리를 체계적으로 훈련하고,
모의시험으로 실전 감각을 기르며, 학습 통계로 약점을 파악할 수 있습니다.

- **플랫폼**: React Native (Expo) — iOS / Android
- **백엔드**: Supabase (Auth, Database, RLS)
- **로컬 캐시**: AsyncStorage (오프라인 지원)
- **오디오**: ABC 기보법 → WebView 기반 abcjs 합성

---

## 2. 콘텐츠 카테고리

| 카테고리 | 유형 | 난이도 수 | 무료 제공 | Pro 전용 |
|---------|------|----------|----------|---------|
| 선율 받아쓰기 (Melody) | 기보형 | 9단계 | L1-3 | L4-9 |
| 리듬 받아쓰기 (Rhythm) | 기보형 | 6단계 | L1-2 | L3-6 |
| 음정 듣기 (Interval) | 객관식 | 4단계 | L1-2 | L3-4 |
| 화성 듣기 (Chord) | 객관식 | 4단계 | L1 | L2-4 |
| 조성 판별 (Key) | 객관식 | 3단계 | L1 | L2-3 |
| 2성부 받아쓰기 (Two-Voice) | 기보형 | 4단계 | 없음 | 전체 |

### 2.1 난이도 상세

**선율 (9단계)**
- L1: 온음표/2분음표/4분음표 | L2-3: 8분음표
- L4: 점4분음표 | L5: 붙임줄 | L6: 16분음표
- L7: 점8분음표 | L8: 임시표 | L9: 셋잇단음표

**리듬 (6단계)**
- L1-2: 기본 음가 | L3: 점음표 + 당김음
- L4: 16분음표 | L5: 셋잇단 | L6: 복합 리듬

**음정 (4단계)**
- L1: 완전음정 (P1, P4, P5, P8)
- L2: 장/단 3도, 6도
- L3: 장/단 2도, 7도
- L4: 증/감음정 + 복합음정

**화성 (4단계)**
- L1: 장/단 3화음 | L2: 증/감 3화음
- L3: 7화음 (M7, m7, dom7) | L4: 전위 + 복합

**조성 (3단계)**
- L1: C장조 / A단조
- L2: 조표 3개 이하 (10개 조성)
- L3: 전체 24개 조성

**2성부 (4단계)**
- L1-4: 기초 → 복잡한 베이스 패턴

---

## 3. 연습 모드

### 3.1 기보형 연습 (ScoreEditor)
- 대상: 선율, 리듬, 2성부
- 음원을 듣고 악보 에디터에 직접 기보
- 자기 평가(1-5점)로 학습 기록 <--생각해볼문제>

### 3.2 객관식 연습 (ChoicePractice)
- 대상: 음정, 화성, 조성
- 음원 재생 후 4지선다 중 정답 선택
- 정답/오답 즉시 피드백 (애니메이션)
- 5문제 이상 풀면 연습 종료 가능
- 정답률 기반 selfRating 자동 계산 (1-5, 0 방지)

### 3.3 문제 자동 생성
- **음정**: C4-G4 범위에서 근음 선택, 반음 수로 상위음 계산
- **화성**: C3-A3 범위, 10개 코드 템플릿, 난이도별 풀 필터링
- **조성**: 24개 조성 템플릿, 음계 ABC 기보법 생성
- 모든 문제는 ABC notation → abcjs WebView로 오디오 합성

---

## 4. 모의시험 시스템

### 4.1 시험 프리셋

| 프리셋 | 문항 수 | 제한 시간 | 구성 |
|-------|--------|----------|------|
| 기초 종합 | 10 | 20분 | 선율L1(3) + 음정L1(4) + 화성L1(3) |
| 중급 종합 | 12 | 30분 | 선율L4(2) + 리듬L3(2) + 음정L2(3) + 화성L2(3) + 조성L2(2) |
| 고급 실전 | 14 | 45분 | 선율L7(2) + 리듬L5(2) + 음정L3(3) + 화성L3(3) + 조성L3(2) + 2성부L2(2) |
| 음정 집중 | 10 | 무제한 | 음정L1(5) + 음정L2(5) |
| 화성 집중 | 10 | 무제한 | 화성L1(5) + 화성L2(5) |

### 4.2 시험 진행
- 문항별 카테고리 표시 + 오디오 재생
- 객관식: 보기 선택 | 기보형: 자기 평가(1-5점)
- 문항 네비게이션 (이전/다음/번호 도트)
- 타이머 (시간 초과 시 자동 제출)
- 미답변 문항 경고 후 제출 확인

### 4.3 결과 화면
- 총점/백분율/등급(A+~D) 표시
- 카테고리별 점수 막대 차트
- 약점 카테고리 학습 팁 (동점 시 문항 수 기준)
- "다시 시험보기" (replace 네비게이션으로 스택 관리)
- Supabase `exam_sessions` 테이블에 결과 영구 저장

---

## 5. 화면 구성

### 5.1 네비게이션 스택

```
Onboarding → Home (메인)
                ├── CategoryPractice → ChoicePractice (객관식)
                │                    → ScoreEditor (기보형)
                ├── MockExamSetup → MockExam → ExamResult
                ├── Stats
                ├── Paywall (모달)
                └── Profile (모달)
```

### 5.2 온보딩 (최초 1회)
- 4페이지 스와이프 가이드
- 청음 훈련 소개 → 연습 방식 → 모의시험 → 통계
- 건너뛰기 / 시작하기 버튼
- SafeAreaView 노치 대응
- 완료 후 AsyncStorage 플래그 저장

### 5.3 홈 대시보드
- **빠른 시작 카드**: 스마트 추천 알고리즘 기반
  - 가장 적게 연습한 카테고리 우선
  - 동점 시 평균 평점이 낮은 카테고리
  - 카테고리별 테마 색상 동적 반영
- **액션 행**: 연습하기 / 모의시험 / 통계 (3열)
- **카테고리 그리드**: 6개 카테고리 카드 + 연습 횟수 배지
- **최근 활동**: 최근 연습 기록 리스트
- Pro 배지 표시 + 프로필 아이콘

### 5.4 통계 대시보드
- 요약 카드: 연속 학습일 / 총 연습 횟수 / 이번 주
- 카테고리별 진도 막대 차트 (연습 횟수 + 평균 평점)
- 활동 요약: 월간/주간 횟수, 레벨, 연속 학습일
- 최근 모의시험 기록 (Supabase에서 로드)
- 기록 없을 때 빈 상태 안내 UI

---

## 6. 데이터 구조

### 6.1 로컬 저장소 (AsyncStorage)

| 키 | 용도 |
|----|------|
| `@melodygen_recent_activity` | 연습 기록 (최대 100건) |
| `@melodygen_skill_profile` | 스킬 프로필 |
| `@melodygen_onboarding_done` | 온보딩 완료 여부 |
| `@melodygen_last_practice_date` | 마지막 연습일 (연속 학습 계산) |

### 6.2 Supabase 테이블

**profiles**
- `id` (UUID, PK → auth.users)
- `email`, `display_name`, `avatar_url`
- `tier` ('free' | 'pro'), `subscription_expires_at`
- `monthly_download_count`, `download_reset_month`
- RLS: 본인만 SELECT/UPDATE/DELETE

**practice_records**
- `id` (TEXT, PK), `user_id` (FK)
- `content_type` (카테고리), `difficulty`, `self_rating` (1-5)
- `practiced_at`, `created_at`
- 인덱스: user_id, practiced_at DESC
- RLS: 본인만 SELECT/INSERT/DELETE

**exam_sessions**
- `id`, `user_id`, `preset_id`, `title`
- `total_score`, `max_score`, `total_questions`, `elapsed_seconds`
- `category_scores` (JSONB — 카테고리별 점수/최대/문항수)
- `completed_at`
- 인덱스: user_id, completed_at DESC
- RLS: 본인만 SELECT/INSERT

**user_skill_profiles**
- `user_id`, `part_practice_level`, `comprehensive_level`
- `recent_accuracy`, `streak_days`
- `last_quick_track`, `same_track_count`

### 6.3 데이터 동기화 전략
- **로컬 우선**: AsyncStorage에 즉시 저장 → UI 즉각 반영
- **백그라운드 동기화**: Supabase에 비동기 저장 (fire & forget)
- **병합**: 로그인 시 원격 데이터와 ID 기반 중복 제거 후 병합
- **경쟁 조건 방지**: 함수형 상태 업데이트 (`setRecords(prev => ...)`)

---

## 7. 구독 시스템

### 7.1 플랜 비교

| 기능 | Free | Pro (5,500₩/월) |
|------|------|-----------------|
| 2성부 (Grand Staff) | ❌ | ✅ |
| 모의시험 | ❌ | ✅ |
| 최대 선율 레벨 | 3 | 9 |
| 최대 마디 수 | 4 | 무제한 |
| 음표 편집 | ❌ | ✅ |
| 오디오 다운로드 | ❌ | ✅ |
| 월간 다운로드 | 0 | 무제한 |
| 저장 악보 수 | 5 | 20 |
| 조성 선택 | C장조만 | 24개 전체 |
| 박자표 | 4/4만 | 8종 |

### 7.2 구독 상태 관리
- SubscriptionContext에서 전역 관리
- `tier`, `expiresAt`, `monthlyDownloadCount` 추적
- 월간 다운로드 카운트 자동 리셋 (월 변경 시)

---

## 8. 스킬 프로필 & 추천 알고리즘

### 8.1 스킬 프로필 구조
```
partPracticeLevel: 1-9    (파트 연습 진도)
comprehensiveLevel: 1-4   (종합 연습 진도)
recentAccuracy: 0-1       (최근 정확도, 지수이동평균)
streakDays: number         (연속 학습일)
lastQuickTrack: string     (마지막 추천 트랙)
sameTrackCount: number     (동일 트랙 연속 횟수)
```

### 8.2 평가 및 레벨 상승
- 평가 점수: easy=0.9, normal=0.65, hard=0.35
- 정확도 업데이트: 이동평균 (기존 70% + 새 30%)
- 레벨 자동 상승: "easy" 평가 + 현재 레벨 + 최대 미만일 때만
- 트랙 로테이션: 동일 트랙 3회 연속 시 다른 트랙 제안

### 8.3 스마트 추천 알고리즘
1. 모든 카테고리의 연습 횟수 + 평균 평점 조회
2. 연습 횟수 오름차순 정렬 (적게 한 것 우선)
3. 동점 시 평균 평점 오름차순 (못하는 것 우선)
4. 추천 카테고리의 현재 레벨에 맞는 난이도 선택

---

## 9. 오디오 시스템

### 9.1 재생 방식
- ABC 기보법 문자열 → AbcjsRenderer (WebView) → MIDI 합성
- `togglePlay()` / `stopAudio()` 인터페이스
- `isPlaying` / `onPlayStateChange` 상태 관리

### 9.2 오디오 라이프사이클
- 화면 이탈 시: `useFocusEffect` cleanup으로 자동 정지
- 문제 전환 시: `stopAudio()` 호출 후 새 문제 로드
- 시험 문항 이동 시: 이전/다음/도트 네비게이션 모두에서 정지
- 시험 제출 시: 오디오 정지 후 결과 계산

---

## 10. 인증 시스템

### 10.1 로그인 방식
- 이메일/비밀번호 (signIn / signUp)
- Google OAuth (PKCE flow, Expo WebBrowser)

### 10.2 프로필 관리
- 회원가입 시 `profiles` 테이블 자동 생성 (DB trigger)
- 프로필 수정: 표시 이름 변경
- 계정 삭제: profiles 행 삭제

### 10.3 세션 관리
- 앱 시작 시 `getSession()`으로 복원
- `onAuthStateChange` 리스너 (TOKEN_REFRESHED 시 프로필 재로드 생략)

---

## 11. UI/UX 설계

### 11.1 색상 체계

| 카테고리 | 메인 색상 | 배경 색상 |
|---------|----------|----------|
| 선율 | #6366f1 (인디고) | #eef2ff |
| 리듬 | #f59e0b (앰버) | #fffbeb |
| 음정 | #10b981 (에메랄드) | #ecfdf5 |
| 화성 | #8b5cf6 (바이올렛) | #f5f3ff |
| 조성 | #ef4444 (레드) | #fef2f2 |
| 2성부 | #0ea5e9 (스카이) | #f0f9ff |

### 11.2 아이콘
- Lucide React Native 아이콘 세트
- 카테고리별 전용 아이콘: Music, Drum, ArrowUpDown, Layers, Key, FileMusic

### 11.3 에러 처리
- ErrorBoundary (React Class Component) 최상위 래핑
- 개발 모드에서 에러 상세 표시
- 복구 UI 제공

---

## 12. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 프레임워크 | React Native + Expo |
| 언어 | TypeScript |
| 네비게이션 | React Navigation (Stack Navigator) |
| 상태 관리 | React Context + Custom Hooks |
| 로컬 저장 | AsyncStorage |
| 백엔드 | Supabase (PostgreSQL + Auth + RLS) |
| 오디오 | abcjs (WebView 합성) |
| UI 아이콘 | Lucide React Native |
| 안전 영역 | react-native-safe-area-context |

---

---

## 13. 출시 전 보안: profiles.tier RLS 잠금

현재 `profiles` 테이블은 사용자가 본인 행을 자유롭게 UPDATE 가능하여,
클라이언트에서 `tier: 'pro'`를 직접 설정하면 무료로 Pro 접근이 가능합니다.

### Supabase SQL (대시보드 → SQL Editor에서 실행)

```sql
-- 1. 기존 UPDATE 정책 제거
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 2. tier, subscription_expires_at 변경 불가 정책 재생성
CREATE POLICY "Users can update own profile (tier protected)"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND tier = (SELECT tier FROM profiles WHERE id = auth.uid())
  AND subscription_expires_at = (SELECT subscription_expires_at FROM profiles WHERE id = auth.uid())
);

-- 3. 구독 변경은 Edge Function (service_role)으로만 수행
-- upgradePlan()은 향후 RevenueCat webhook → Edge Function으로 전환 필요
```

### 클라이언트 코드 변경 (IAP 연동 시)

`SubscriptionContext.tsx`의 `upgradePlan()`은 IAP 연동 후:
1. 클라이언트 → App Store/Play Store에서 결제
2. 영수증 → Supabase Edge Function으로 전송
3. Edge Function이 영수증 검증 후 `service_role`로 `tier` 업데이트

현재는 테스트 목적으로 클라이언트 직접 업데이트를 유지하되,
**프로덕션 출시 전 반드시 위 SQL을 적용**해야 합니다.

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|---------------|-----------|-----------|----------|
| 1 | CEO | SELECTIVE EXPANSION 모드 선택 | Mechanical | P3(실용적) | 코드 100% 완성, 추가 기능보다 출시 우선 | SCOPE EXPANSION |
| 2 | CEO | 웹앱 대안 유보 | Taste | P6(행동 우선) | 이미 RN 앱 완성. 전환 비용 > 이득 | 웹앱 우선 출시 |
| 3 | CEO | 강사 추천 코드 유보 | Mechanical | P3(실용적) | 출시 후 데이터 기반 판단 | 즉시 구현 |
| 4 | CEO | 카카오 로그인 유보 | Taste | P3(실용적) | 출시 차단 아님, 전환율 영향은 측정 후 | 즉시 구현 |
| 5 | Design | 로딩/에러 상태 추가 필수 | Mechanical | P1(완전성) | 프로덕션 필수. 빈 화면은 버그로 인식 | 유보 |
| 6 | Design | 시험 이탈 가드 추가 필수 | Mechanical | P1(완전성) | 45분 시험 데이터 손실은 1점 리뷰 직결 | 유보 |
| 7 | Design | 접근성 라벨 출시 후 1차 업데이트 | Taste | P3(실용적) | MVP에서 전면 접근성은 과다. 기본만 추가 | 즉시 전면 구현 |
| 8 | Design | 타이포/스페이싱 시스템 출시 후 | Taste | P5(명시적) | 현재 동작함. 일관성은 점진적 개선 | 즉시 정리 |
| 9 | Design | 학습 경로 유보 | Taste | P3(실용적) | 사용자 데이터 없이 경로 설계는 가설 | 즉시 구현 |
| 10 | Eng | 디버그 fetch 제거 필수 | Mechanical | P5(명시적) | 프로덕션 코드에 디버그 호출은 부적절 | 유지 |
| 11 | Eng | profiles.tier RLS 잠금 필수 | Mechanical | P1(완전성) | 구독 우회는 수익 직결 보안 이슈 | 클라이언트 검증만 |
| 12 | Eng | 핵심 함수 단위 테스트 추가 | Mechanical | P1(완전성) | questionGen, computeStats, applyEval | 테스트 없이 출시 |
| 13 | Eng | Supabase 쓰기 재시도 큐 | Taste | P1(완전성) | 데이터 손실 방지. 출시 전 vs 후 판단 필요 | Fire-and-forget 유지 |
| 14 | Eng | WebView 보안 제한 | Mechanical | P1(완전성) | originWhitelist 제한, 파일 접근 차단 | 현재 설정 유지 |
| 15 | Eng | 시험 타이머 레이스 컨디션 수정 | Mechanical | P1(완전성) | 데이터 무결성 직결 | 현재 코드 유지 |
