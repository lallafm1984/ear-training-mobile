# MelodyGen — 프로젝트 구조 인덱스

> 마지막 업데이트: 2026-11-03

## 디렉토리 구조

```
src/
├── components/          # 재사용 가능 UI 컴포넌트 (23개, 미사용 2개)
├── context/             # React Context 프로바이더 (4개)
├── hooks/               # 커스텀 React 훅 (10개)
├── lib/                 # 비즈니스 로직 모듈
│   ├── scoreUtils/      # 악보 유틸리티 (8개 모듈)
│   ├── scoreGenerator/  # 악보 생성 엔진 (7개 모듈)
│   ├── twoVoice/        # 2성부 작곡 모듈 (12개)
│   ├── beginnerCourse/  # 귀 열기 7일 코스 (커리큘럼·미니 문제 생성·진행 상태, 3개 모듈)
│   ├── levelTest/       # 3분 레벨 테스트 (영역 정의·계단식 진행·결과·문항 어댑터, 3개 모듈)
│   ├── practiceScoreGenerator.ts  # 기보형 악보 생성 (공유)
│   ├── examNotationStore.ts      # 모의시험↔기보연습 데이터 전달
│   ├── wrongNotes.ts             # 오답노트 저장 모델·병합·복습 문항 변환·약점 TOP 집계 (로컬 전용)
│   ├── wrongNoteReviewStore.ts   # 오답노트 → 객관식 복습 모드 문항 전달
│   ├── shareCard.ts              # 결과 공유 카드 데이터 모델·텍스트 공유 문구·파일명 (순수 함수)
│   ├── scaleQuestions.ts         # 음계·선법 듣기 객관식 문제 생성 (템플릿·근음 철자·유사 보기)
│   ├── progressionVoicing.ts     # 화성진행·종지 재생용 4성부(SATB) 성부 배치 엔진 (동적 계획법: 병행 5·8도 금지·이끔음 상행·PAC/IAC 소프라노·전위·7화음 7음 하행 해결)
│   ├── rhythmTap.ts              # 리듬 탭 패턴 생성·예상 타점·탭 타이밍 채점 (순수 함수)
│   ├── layout.ts                 # 반응형 레이아웃 판정 (태블릿·콘텐츠/폼/시트 최대 폭·모달 폭, 순수 함수)
│   ├── dailyGoal.ts              # 일일 목표 7종 판정 (오늘 달성 수·연속 달성일, 순수 함수) — Home·DailyGoal 공통
│   ├── mascotConfig.ts           # 마스코트 진화 시스템 (레벨/EXP/비주얼)
│   ├── oauthCallback.ts          # OAuth 딥링크 query/hash 파싱 + Supabase 세션 생성
│   ├── appControl.ts             # 원격 버전 정책/공지 RPC 파싱·빌드 판정·노출 키
│   ├── secureStoreAdapter.ts     # Supabase 세션 SecureStore 청크 저장/레거시 호환
│   ├── logger.ts                 # 개발 빌드 전용 중앙 로그 경계
│   ├── reminder.ts               # 매일 연습 리마인더 설정(기기 전역 키·시각 프리셋·정규화)
│   ├── notifications.ts          # expo-notifications 래퍼 (권한 확인·매일 로컬 알림 예약/취소)
│   └── ...              # 기타 라이브러리
├── i18n/                # 국제화 (i18next)
│   ├── index.ts         # i18n 초기화 + 언어 감지
│   ├── language.ts      # 지원 언어 정규화 + 기기 지역 매칭
│   └── locales/         # 번역 파일 (ko/en/ja × 17 네임스페이스)
├── navigation/          # 네비게이션 설정
├── screens/             # 화면 컴포넌트 (19개 + ScoreEditor 서브모듈·숨김)
│   └── ScoreEditor/     # 악보 에디터 (13개 모듈, MainStack 미등록 — 2026-11 숨김)
├── theme/               # 디자인 토큰 (색상, 테마)
├── types/               # TypeScript 타입 정의
└── __tests__/           # Jest 테스트 (31개)
assets/
├── icon-square.png      # Android/iOS 스토어용 정사각형 앱 아이콘 원본
└── notification-icon.png # Android 알림 작은 아이콘 (96×96 흰색 음표, expo-notifications 플러그인)
credentials/
└── android/             # 로컬 Android 릴리스/upload key 키스토어 위치 (.jks는 Git 제외)
build/                   # Android 릴리스 산출물 및 Play Console 제출용 인증서 (.apk/.aab/.pem, Git 제외)
docs/
├── LOCAL_ANDROID_BUILD_MAC.md                # Mac 로컬 Android 릴리스 빌드 절차
├── APP_CONTROL_SUPABASE.md                   # 강제 업데이트/원격 공지 Supabase 운영 절차
├── APP_CONTROL_RELEASE_HANDOFF_20260822.md    # 빌드 61·라이브 DB·구버전 경계 인수인계
├── NOTATION_SCREEN_FIX_20260831.md            # 선율/2성부 회귀 원인·실기기 검증·62 (1.1.3) AAB
├── BEGINNER_EAR_OPENING_COURSE_DESIGN.md      # 귀 열기 7일 코스 설계안 (2026-11-03 구현)
├── PROFILES_RLS_20261103.md                   # profiles RLS 활성화 마이그레이션 적용·검증 절차
└── CONTENT_SCOPE_2_0.md                       # 2.0 콘텐츠 무료/Pro 오픈 범위표·기존 사용자 데이터 보존 근거
store/
└── android/
    ├── listing.md                             # Play 스토어 등록 문구 (2.0 ko/en/ja, 릴리스 노트, 앱 액세스 정보)
    └── RELEASE_GUIDE.md                       # Play Console 릴리스 절차 가이드
scripts/
├── androidLocalBuildEnv.mjs            # 로컬 Android 빌드 환경 변수/경로 유틸
├── checkMacAndroidBuildEnv.mjs         # Mac Android 빌드 필수 도구 점검
├── createAndroidLocalCredentials.mjs   # EAS credentials.json 생성
├── verifyAndroidReleaseKeystore.mjs    # JKS alias/비밀번호 검증
├── buildAndroidReleaseLocal.mjs        # versionCode 증가 + EAS local AAB 빌드
└── buildAndroidReleaseGradle.mjs       # EAS 없이 prebuild + Gradle bundleRelease AAB 빌드
```

---

## 사용 상태 분류

### ✅ 활성 사용 중 (Active)

#### 화면 (Screens) — 로그인 → 메인 흐름에서 도달 가능

| 화면             | 파일                                 | 진입 경로                                                                              |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Login            | `screens/LoginScreen.tsx`            | App.tsx — 미로그인·게스트 아님 시. "로그인 없이 시작"으로 게스트 모드 진입             |
| Onboarding       | `screens/OnboardingScreen.tsx`       | 최초 실행 시                                                                           |
| Home             | `screens/HomeScreen.tsx`             | 로그인 후 메인                                                                         |
| CategoryPractice | `screens/CategoryPracticeScreen.tsx` | Home → 카테고리 선택                                                                   |
| ChoicePractice   | `screens/ChoicePracticeScreen.tsx`   | CategoryPractice → 객관식 (WrongNotes → review 복습 모드)                              |
| NotationPractice | `screens/NotationPracticeScreen.tsx` | CategoryPractice → 기보형                                                              |
| MockExamSetup    | `screens/MockExamSetupScreen.tsx`    | Home → 모의시험                                                                        |
| MockExam         | `screens/MockExamScreen.tsx`         | MockExamSetup → 시험 진행                                                              |
| ExamResult       | `screens/ExamResultScreen.tsx`       | MockExam → 결과                                                                        |
| Stats            | `screens/StatsScreen.tsx`            | Home → 통계                                                                            |
| DailyGoal        | `screens/DailyGoalScreen.tsx`        | Home → 일일 목표                                                                       |
| MascotGallery    | `screens/MascotGalleryScreen.tsx`    | Home 마스코트 카드 / DailyGoal 마스코트 행 → 60레벨 컬렉션 (해금·잠금·현재 표시)       |
| BeginnerCourse   | `screens/BeginnerCourseScreen.tsx`   | Home → "처음이라면: 귀 열기 코스" 카드 (7일 레슨 목록·진행률)                          |
| BeginnerLesson   | `screens/BeginnerLessonScreen.tsx`   | BeginnerCourse → Day 카드 (듣기 포인트 → 미니 문제 → 결과·EXP)                         |
| LevelTest        | `screens/LevelTestScreen.tsx`        | Home → "3분 레벨 테스트" 카드 (계단식 12문항 → 영역별 시작 난이도 추천)                |
| WrongNotes       | `screens/WrongNotesScreen.tsx`       | Stats/ExamResult/ChoicePractice 결과 → 오답노트 (약점 TOP3·필터·듣기·복습 시작)        |
| RhythmTap        | `screens/RhythmTapScreen.tsx`        | CategoryPractice(리듬 탭) → 듣기 → 메트로놈 클릭 트랙에 맞춰 탭 → 타이밍 채점·타임라인 |
| Paywall          | `screens/PaywallScreen.tsx`          | Home → 구독 (모달)                                                                     |
| Profile          | `screens/ProfileScreen.tsx`          | Home → 프로필 (모달)                                                                   |

#### 컴포넌트 (Components)

| 컴포넌트                | 사용처                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbcjsRenderer`         | ChoicePractice, MockExam, NotationPractice, ScoreEditor, WrongNotes(듣기), BeginnerLesson, LevelTest, RhythmTap(클릭 트랙·정답 악보)                 |
| `abcjsSource.ts`        | abcjsWebViewHtml 내부                                                                                                                                |
| `abcjsWebViewHtml.ts`   | AbcjsRenderer 내부                                                                                                                                   |
| `AppAlert`              | AlertContext                                                                                                                                         |
| `AppControlGate`        | App.tsx (로그인 전 강제 업데이트 및 전역 공지)                                                                                                       |
| `BeginnerLessonIcon`    | BeginnerCourseScreen, BeginnerLessonScreen                                                                                                           |
| `BottomSheet`           | ScoreEditor (PlaybackSheet, SavedScoresSheet, SettingsSheet)                                                                                         |
| `CategoryCard`          | HomeScreen                                                                                                                                           |
| `DailyScoreChart`       | StatsScreen                                                                                                                                          |
| `DurationToolbar`       | NotationPracticeScreen                                                                                                                               |
| `ErrorBoundary`         | App.tsx                                                                                                                                              |
| `GoogleLogo`            | LoginScreen                                                                                                                                          |
| `GradingResult`         | NotationPracticeScreen                                                                                                                               |
| `LegalModal`            | LoginScreen, ProfileScreen                                                                                                                           |
| `MascotCharacter`       | HomeScreen, DailyGoalScreen, MascotGalleryScreen, BeginnerLessonScreen, LevelTestScreen, ShareResultCard                                             |
| `PianoKeyboard`         | NotationPracticeScreen                                                                                                                               |
| `PracticeCalendar`      | StatsScreen                                                                                                                                          |
| `PracticeSettingsSheet` | CategoryPracticeScreen                                                                                                                               |
| `RecentActivityList`    | HomeScreen                                                                                                                                           |
| `ShareCardModal`        | ExamResult, ChoicePractice(결과), LevelTest(결과), Stats(헤더), BeginnerLesson(코스 완주) — 카드 미리보기·이미지(view-shot+expo-sharing)/텍스트 공유 |
| `ShareResultCard`       | ShareCardModal 내부 (캡처 대상 카드 뷰, MascotCharacter 포함)                                                                                        |
| `SplashScreen`          | MainStack (초기 로딩)                                                                                                                                |
| `UpgradeModal`          | ScoreEditor                                                                                                                                          |

#### 커스텀 훅

| 훅                          | 사용처                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `useSkillProfile`           | HomeScreen, ChoicePractice, NotationPractice, MockExam, Stats                                                    |
| `usePracticeHistory`        | HomeScreen, ChoicePractice, NotationPractice, MockExam, Stats, DailyGoal                                         |
| `useMascotExp`              | HomeScreen, DailyGoalScreen, MascotGalleryScreen, BeginnerLessonScreen                                           |
| `useBeginnerCourseProgress` | HomeScreen, BeginnerCourseScreen, BeginnerLessonScreen (로컬 진행 상태·EXP 중복 지급 방지)                       |
| `useLevelTestResult`        | HomeScreen, LevelTestScreen, CategoryPracticeScreen (레벨 테스트 결과 로컬 저장·추천 난이도)                     |
| `useReminderSettings`       | ProfileScreen(알림 섹션), DailyGoalScreen(달성 후 권유) — 설정 저장 + 로컬 알림 예약 동기화, 언어 변경 시 재예약 |
| `useWrongNotes`             | ChoicePractice, MockExam, ExamResult, Stats, WrongNotesScreen (오답 누적·해결·삭제, 로컬 전용)                   |
| `useResponsiveLayout`       | 모든 주요 화면(ScrollView contentContainerStyle·하단 바) — 태블릿에서 콘텐츠 760dp 가운데 정렬                   |
| `useDownloadQuota`          | ScoreEditor                                                                                                      |
| `useNoteInput`              | NotationPracticeScreen — 새 악보 조건을 명시적으로 받는 안정된 reset 콜백                                        |

#### Context 프로바이더

| Context                    | 파일                                   | 사용처                                   |
| -------------------------- | -------------------------------------- | ---------------------------------------- |
| `AuthContext`              | `context/AuthContext.tsx`              | App.tsx, 전체 인증                       |
| `SubscriptionContext`      | `context/SubscriptionContext.tsx`      | MainStack 하위 전체                      |
| `AlertContext`             | `context/AlertContext.tsx`             | App.tsx, 전체 알림                       |
| `SessionContentLogContext` | `context/SessionContentLogContext.tsx` | 로그인 세션 컨텐츠 실행 카운트 집계/전송 |

#### 라이브러리 (Lib) — 모두 활성

| 모듈                        | 주요 사용처                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scoreUtils/*`              | scoreGenerator, twoVoice, practiceScoreGenerator                                                                                                                                                  |
| `scoreGenerator/*`          | ScoreEditor, practiceScoreGenerator                                                                                                                                                               |
| `twoVoice/*`                | scoreGenerator (generateTwoVoiceStack)                                                                                                                                                            |
| `beginnerCourse/*`          | BeginnerCourse/BeginnerLesson 화면, useBeginnerCourseProgress, localProfileStorage (config·questions·progress)                                                                                    |
| `levelTest/*`               | LevelTestScreen, CategoryPracticeScreen(추천 배지), useLevelTestResult, localProfileStorage (config·engine·questions)                                                                             |
| `practiceScoreGenerator.ts` | NotationPractice, MockExam                                                                                                                                                                        |
| `contentConfig.ts`          | 대부분의 화면 (8곳)                                                                                                                                                                               |
| `questionGenerator.ts`      | ChoicePractice, MockExam                                                                                                                                                                          |
| `scaleQuestions.ts`         | questionGenerator(scale 분기), ChoicePractice·MockExam을 통해 사용                                                                                                                                |
| `progressionVoicing.ts`     | questionGenerator(renderProgressionAbc 성부 배치)                                                                                                                                                 |
| `rhythmTap.ts`              | RhythmTapScreen (패턴 생성·타점·채점)                                                                                                                                                             |
| `layout.ts`                 | useResponsiveLayout, AppAlert·UpgradeModal(모달 폭 상한), BottomSheet·ShareCardModal(시트 폭 상한), LoginScreen·OnboardingScreen(폼/버튼 열 폭 상한), DailyScoreChart(기본 차트 폭)              |
| `grading.ts`                | NotationPractice, GradingResult                                                                                                                                                                   |
| `examPresets.ts`            | MockExamSetup, MockExam                                                                                                                                                                           |
| `examNotationStore.ts`      | MockExam, NotationPractice                                                                                                                                                                        |
| `wrongNotes.ts`             | useWrongNotes, WrongNotesScreen, ChoicePractice(복습 모드), localProfileStorage(병합)                                                                                                             |
| `wrongNoteReviewStore.ts`   | WrongNotesScreen(복습 시작) → ChoicePracticeScreen(review 파라미터)                                                                                                                               |
| `shareCard.ts`              | ShareCardModal, ShareResultCard (공유 카드 데이터·텍스트 문구)                                                                                                                                    |
| `computeStats.ts`           | StatsScreen (computeStats 요약 + computeInsights 카테고리별 분석·약점/강점·주간 증감·활동일)                                                                                                        |
| `dailyGoal.ts`              | HomeScreen(마스코트·일일 목표 카드), DailyGoalScreen(목표 목록·연속 달성일) — 전체 기록 기준으로 같은 값                                                                                        |
| `mascotConfig.ts`           | MascotGalleryScreen, DailyGoalScreen(스테이지 인덱스)                                                                                                                                             |
| `oauthCallback.ts`          | AuthContext (Google OAuth 딥링크/콜드 스타트 세션 생성)                                                                                                                                           |
| `appControl.ts`             | AppControlGate (최신 빌드 강제/공지 RPC 검증 및 로컬 노출 상태)                                                                                                                                   |
| `secureStoreAdapter.ts`     | Supabase 인증 세션의 청크 암호화 저장 및 기존 단일 키 마이그레이션                                                                                                                                |
| `logger.ts`                 | ErrorBoundary, 인증·구독·결제의 개발 빌드 전용 진단 로그                                                                                                                                          |
| `reminder.ts`               | useReminderSettings, ProfileScreen, DailyGoalScreen (리마인더 설정 순수 함수)                                                                                                                     |
| `notifications.ts`          | useReminderSettings (expo-notifications 권한·매일 알림 예약, 로컬 전용)                                                                                                                           |
| `trackConfig.ts`            | ScoreEditor, useSkillProfile, practiceScoreGenerator                                                                                                                                              |
| `revenueCat.ts`             | SubscriptionContext, PaywallScreen                                                                                                                                                                |
| `melodyRhythmLevel.ts`      | scoreGenerator, twoVoice                                                                                                                                                                          |
| `trebleRhythmFill.ts`       | scoreGenerator, twoVoice, rhythmEngine                                                                                                                                                            |
| `rhythmEngine.ts`           | practiceScoreGenerator, rhythmTap                                                                                                                                                                 |
| `supabase.ts`               | AuthContext, useSkillProfile                                                                                                                                                                      |
| `sessionContentLog.ts`      | SessionContentLogContext, 세션 컨텐츠 로그 테이블 insert 매핑 테스트                                                                                                                              |
| `localDate.ts`              | useMascotExp (기기 시간대 기준 YYYY-MM-DD 날짜 키)                                                                                                                                                |
| `localProfileStorage.ts`    | AuthContext, usePracticeHistory, useSkillProfile, useMascotExp, useBeginnerCourseProgress, useLevelTestResult, useWrongNotes, DailyGoal, ExamResult, Stats (로컬 학습 데이터 키·게스트→계정 이관) |

---

## Supabase Edge Functions

| 함수                 | 파일                                             | 역할                                            |
| -------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `revenuecat-webhook` | `supabase/functions/revenuecat-webhook/index.ts` | RevenueCat 웹훅으로 구독 상태를 profiles에 반영 |

---

## Supabase Migrations

| 마이그레이션                                               | 역할                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `20260518060000_create_session_content_logs.sql`           | 세션 컨텐츠 실행 요약 로그 테이블/RLS 생성                                                |
| `20260818083000_create_server_timed_promotions.sql`        | 서버 시간 기반 프로모션 테이블/RPC 생성                                                   |
| `20260822090000_create_app_control.sql`                    | 플랫폼별 버전 정책·원격 공지 테이블과 제한 RPC 생성                                       |
| `20260822153000_extend_admissions_promotion.sql`           | 무료 이용 9월 30일 연장·빌드 59+ 원격 공지 활성화                                         |
| `20260822182000_add_daily_announcement_mode.sql`           | 하루 1회 공지 모드 추가·기존 모드 호환 유지                                               |
| `20260822183000_set_admissions_announcement_daily.sql`     | 무료 이용 공지를 빌드 60+ 하루 1회로 전환·종료일 동기화                                   |
| `20261103120000_enable_profiles_rls.sql`                   | `profiles` RLS 활성화·anon 회수·본인 행 정책 (Advisor rls_disabled_in_public 대응)        |
| `20261103120100_protect_profiles_subscription_columns.sql` | 클라이언트 JWT의 `tier`·`subscription_expires_at` 변경 무시 트리거 (webhook 배포 후 적용) |
| `20261104100000_end_admissions_promotion.sql`              | 수험생 무료 프로모션·공지 행 비활성화 확정(2.0부터 클라이언트 판정 제거)                  |

---

### ⚠️ 숨김 화면 (Hidden — MainStack 미등록, navigate 호출 X)

| 화면            | 파일                               | 설명                                                                                                                                                      |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ScoreEditor** | `screens/ScoreEditor/` (13개 모듈) | 2026-11 편집기 숨김: `MainStack.tsx`에서 import·`Stack.Screen` 등록을 제거(파라미터 타입만 유지). 코드는 보존되어 있으며 재노출 시 등록만 복구하면 됨 |

**ScoreEditor 관련 모듈** (ScoreEditor만 사용하는 모듈):

- `screens/ScoreEditor/GenerateSheet.tsx` — AI 악보 생성 UI
- `screens/ScoreEditor/PlaybackSheet.tsx` — 재생 옵션
- `screens/ScoreEditor/SavedScoresSheet.tsx` — 저장된 악보 목록
- `screens/ScoreEditor/SettingsSheet.tsx` — 설정
- `screens/ScoreEditor/NotePalette.tsx` — 음표 입력
- `screens/ScoreEditor/AbcNotationModal.tsx` — ABC 표기법
- `screens/ScoreEditor/LoadingModal.tsx` — 로딩
- `screens/ScoreEditor/usePlaybackConfig.ts` — 재생 설정 상태
- `screens/ScoreEditor/useGenerationState.ts` — 생성 파라미터 상태
- `screens/ScoreEditor/constants.ts`, `styles.ts`, `types.ts`, `utils.ts`

> 참고: ScoreEditor가 사용하는 `useDownloadQuota` 훅, `UpgradeModal` 컴포넌트, `trackConfig.ts`는 다른 곳에서도 사용 중 (trackConfig → useSkillProfile, practiceScoreGenerator)

---

### ❌ 미사용 컴포넌트 (Dead Code)

| 컴포넌트           | 파일                            | 설명                                                                         |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| **QuickStartCard** | `components/QuickStartCard.tsx` | barrel export(`components/index.ts`)만 존재, 어떤 화면에서도 import하지 않음 |
| **SelfEvalModal**  | `components/SelfEvalModal.tsx`  | barrel export(`components/index.ts`)만 존재, 어떤 화면에서도 import하지 않음 |

---

### 📝 screens/index.ts barrel 비효율

`screens/index.ts`는 12개 화면을 export하지만, 실제로 barrel을 통해 import하는 곳은 **App.tsx의 `LoginScreen`** 1곳뿐. MainStack.tsx는 모든 화면을 직접 import.

---

## 네비게이션 흐름 (실제 도달 가능)

```
Login → Onboarding → Home
                       ├── DailyGoal → CategoryPractice → ChoicePractice (객관식)
                       │                                → NotationPractice (기보형)
                       ├── CategoryPractice → ChoicePractice (객관식)
                       │                    → NotationPractice (기보형)
                       ├── BeginnerCourse → BeginnerLesson → ChoicePractice (레슨 연결 연습)
                       ├── LevelTest → CategoryPractice (추천 난이도 선택) / BeginnerCourse (입문 권유)
                       ├── MockExamSetup → MockExam → ExamResult
                       ├── Stats
                       ├── MascotGallery (Home·DailyGoal 마스코트 탭)
                       ├── Paywall (모달)
                       └── Profile (모달)

[숨김]
  └── ScoreEditor (MainStack 미등록 — 2026-11 편집기 숨김, 코드만 보존)
```

---

## 핵심 모듈 상세

### `src/lib/scoreUtils/` — 악보 유틸리티

| 모듈              | 역할                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `types.ts`        | `ScoreNote`, `ScoreState`, `NoteDuration`, `PitchName`, `Accidental`, `TupletType` 타입 |
| `duration.ts`     | 음가 변환, 박자 계산, 잇단음표, beam 그룹 유틸리티                                      |
| `keySignature.ts` | 조성/음계 생성, 임시표 엔진 (`KEY_SIG_MAP`, `resolveAbcAccidental`)                     |
| `midi.ts`         | MIDI 변환, 이명동음 처리 (`nnToMidi`, `noteToMidiWithKey`)                              |
| `noteFactory.ts`  | 음표 생성 헬퍼 (`uid`, `makeNote`, `makeRest`, `noteNumToNote`)                         |
| `bassUtils.ts`    | 베이스 성부 유틸 (`CHORD_TONES`, `buildTrebleAttackMidiMap`, `passesBassSpacing`)       |
| `harmony.ts`      | 화성 진행 생성 (`generateProgression`, `getStrongBeatOffsets`)                          |
| `abc.ts`          | ABC 표기법 파이프라인 (`splitAtBeatBoundaries`, `generateAbc`, `getMeasureCount`)       |

**의존성**: `types` ← `duration` ← `keySignature` ← `midi` ← `abc`

---

### `src/lib/scoreGenerator/` — 악보 생성 엔진

| 모듈                | 역할                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `types.ts`          | `Difficulty`, `BassDifficulty`, `GeneratorOptions`, `GeneratedScore`, `DURATION_POOL`      |
| `melodyEngine.ts`   | 멜로디 생성/수정 (40+ 함수: 임시표 정리, 트라이톤 수정, 종지 생성 등)                      |
| `finalSanity.ts`    | 최종 안전망 `applyFinalSanity` — 금지 도약(쉼표 건너뛰기 포함)·3회 반복·강박 불협화·병행 완전음정·음역을 최소 변경으로 수정, `isBadMelodicStep` |
| `voiceLeading.ts`   | 성부 진행 분석 (`buildAttackTimeline`, `isConsonantInterval`, `isParallelPerfect`)         |
| `postProcessing.ts` | 후처리 (`reviewAndFixScore`, 불협화음 해결, 병행 완전음정 수정)                            |
| `bassEngine.ts`     | 베이스 생성 3전략 (`generateBasicBass`, `generateIndependentBass`, `generateArpeggioBass`) |
| `index.ts`          | `generateScore` 메인 함수 + barrel export                                                  |

---

## 디자인 토큰

- `theme/colors.ts`: `COLORS` (primary/secondary/neutral/semantic), `CATEGORY_COLORS`, `TRACK_COLORS`

---

## 코드 품질 도구

- **ESLint**: `eslint.config.mjs` (flat config, typescript-eslint + react-hooks)
- **Prettier**: `.prettierrc` (singleQuote, trailingComma, printWidth 100)
- 실행: `npm run lint` / `npm run format` / `npm run format:check`

## 빌드/배포 설정

| 항목                              | 파일                                        | 역할                                                     |
| --------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Mac 로컬 Android 릴리스 빌드 문서 | `docs/LOCAL_ANDROID_BUILD_MAC.md`           | Windows 키스토어를 Mac 로컬 EAS 빌드에서 재사용하는 절차 |
| Android 서명 키스토어 위치        | `credentials/android/melodygen-release.jks` | Git 제외된 로컬 릴리스 서명 키스토어                     |
| Android 로컬 환경 예시            | `.env.local.example`                        | 키스토어 경로, 비밀번호, alias 환경 변수 템플릿          |
| Mac 로컬 빌드 환경 점검           | `scripts/checkMacAndroidBuildEnv.mjs`       | Node/npm/Java/Android SDK/adb 상태 점검                  |
| EAS credentials 생성              | `scripts/createAndroidLocalCredentials.mjs` | `.env.local` 기반 `credentials.json` 생성                |
| 키스토어 검증                     | `scripts/verifyAndroidReleaseKeystore.mjs`  | `keytool`로 JKS/alias 검증                               |
| Android 로컬 릴리스 빌드          | `scripts/buildAndroidReleaseLocal.mjs`      | `versionCode` 증가 후 `eas build --local` AAB 생성       |
| EAS 없는 Gradle 릴리스 빌드       | `scripts/buildAndroidReleaseGradle.mjs`     | versionCode 증가 → prebuild → `:app:bundleRelease` → 서명 검증 |
| 앱 버전/공지 운영 문서            | `docs/APP_CONTROL_SUPABASE.md`              | Supabase 원격 정책 필드·안전한 배포 순서·장애 동작       |

---

## 테스트

| 테스트 파일                      | 대상                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `grading.test.ts`                | `normalizeNotes`, `gradeNotes`                                                                        |
| `questionGenerator.test.ts`      | 객관식 문제 생성 (음정 5·6단계 화성 음정·복합음정 반음 수 검증 포함)                                   |
| `progressionVoicing.test.ts`     | 화성진행 4성부 성부 배치 규칙 (병행·교차·음역·이끔음·PAC/IAC·전위·7음 해결, 5~7단계 라벨↔악보 일치 검증) |
| `scoreGenerator.test.ts`         | 악보 생성 엔진                                                                                        |
| `computeStats.test.ts`           | 통계 집계                                                                                             |
| `skillProfile.test.ts`           | 스킬 레벨 계산                                                                                        |
| `contentConfig.test.ts`          | 카테고리 설정/난이도 라벨                                                                             |
| `contentQaRules.test.ts`         | 콘텐츠 QA 규칙 (청음 시험 기준: 선율·2성부 도약/반복/종지, 리듬 받아쓰기, 화성진행·조성·음정 ABC 표기)        |
| `compoundTuplet.test.ts`         | 복합박자(6/8·9/8) 잇단음표 규칙 — 셋잇단 레벨은 둘잇단(2:3)으로 출제, ABC `(2:3:2`·채점 타임라인·마디 길이     |
| `duration.test.ts`               | 음가 변환/박자 계산                                                                                   |
| `keySignature.test.ts`           | 조성/음계/임시표                                                                                      |
| `melodyRhythmLevel.test.ts`      | 레벨별 리듬 파라미터                                                                                  |
| `examPresets.test.ts`            | 시험 프리셋 구조 검증                                                                                 |
| `i18nLanguage.test.ts`           | 기기 지역 감지/지원 언어 정규화                                                                       |
| `sessionContentLog.test.ts`      | 세션 컨텐츠 실행 카운트 요약/DB insert 매핑                                                           |
| `localDate.test.ts`              | 로컬 날짜 키 (UTC 날짜 밀림 방지)                                                                     |
| `localProfileStorage.test.ts`    | 게스트 데이터 병합 규칙과 계정 이관                                                                   |
| `beginnerCourse.test.ts`         | 귀 열기 코스 문제 생성(보기 소리·정답 포함), 잠금·완료·병합                                           |
| `levelTest.test.ts`              | 레벨 테스트 계단식 진행, 영역 레벨 추정·추천, 정규화·병합, 문항 생성                                  |
| `reminder.test.ts`               | 리마인더 설정 정규화·시각 표시, 알림 권한 흐름·매일 예약/취소 호출 검증                               |
| `wrongNotes.test.ts`             | 오답 누적·해결·삭제·정리, 병합, 복습 문항 변환·선택, 약점 TOP 집계                                    |
| `scaleQuestions.test.ts`         | 음계 템플릿 무결성, 근음별 임시표 철자, 오답 보기 선택, 문제 생성, 5단계 상행·하행(가락단음계 하행형) |
| `rhythmTap.test.ts`              | 타점 계산(쉼표·붙임줄·잇단음표), 허용 오차, 탭 채점, 문제 생성, 점수 변환, 3/4·6/8 레벨·강박 주기      |
| `layout.test.ts`                 | 태블릿 판정·콘텐츠/폼/시트 정렬 스타일·모달 폭                                                        |
| `dailyGoal.test.ts`              | 일일 목표 카테고리, 오늘 달성 수(기록 20개 초과 포함), 연속 달성일(오늘 진행 중·중간 공백·6/7 미달성) |
| `shareCard.test.ts`              | 공유 텍스트 구성, 지표 정규화, 캡처 파일명                                                            |
| `oauthCallback.test.ts`          | OAuth query/hash 파싱, PKCE·implicit 세션 생성 및 오류 처리                                           |
| `appControl.test.ts`             | 최신/최소 빌드 차단, RPC 검증, 공지 링크·노출 키                                                      |
| `secureStoreAdapter.test.ts`     | SecureStore UTF-8 청크, 레거시 세션, 교체·손상·삭제 처리                                              |
| `notationPracticeScreen.test.ts` | 실제 화면·입력 훅·생성기로 선율/2성부 재생성 루프, 답안 유지·다음 문제, 모의시험, 생성 예약 취소 검증 |

실행: `npm test` (460개 테스트). 화면 회귀 테스트는 React 19.1과 동일 버전의 `react-test-renderer` 및 Jest의 JSX 변환을 사용한다.

## 기능별 파일 매핑

| 기능                                                               | 파일                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 선율/2성부 받아쓰기 문제 생성·진입·생성 예약 취소                  | `src/screens/NotationPracticeScreen.tsx`                                                                                                                                                                                                                                          |
| 새 문제의 첫 음·마디·성부 조건으로 답안 초기화                     | `src/hooks/useNoteInput.ts`                                                                                                                                                                                                                                                       |
| 기보형 문제의 클라이언트 동적 생성                                 | `src/lib/practiceScoreGenerator.ts`                                                                                                                                                                                                                                               |
| 복합박자(6/8·9/8) 잇단음표 = 둘잇단(2:3) 생성·입력·표기            | `src/lib/rhythmEngine.ts`(makeDuplets·findTupletTargetIdx), `src/lib/twoVoice/melodyGenerator.ts`(tupletSpan16·generateDupletNotes), `src/hooks/useNoteInput.ts`(makeTupletGroup·tupletCount), `src/components/DurationToolbar.tsx`(tupletCount), `src/screens/NotationPracticeScreen.tsx`('duplet' 입력), `src/components/PracticeSettingsSheet.tsx`(안내 문구) |
| 화성진행·종지 재생 4성부 성부 배치 (큰보표 V1 S·A / V2 T·B)          | `src/lib/progressionVoicing.ts`, `src/lib/questionGenerator.ts`(renderProgressionAbc·spellChordVoice), `src/__tests__/progressionVoicing.test.ts`, `src/__tests__/contentQaRules.test.ts`(큰보표 파서) |
| 음정 듣기 5·6단계 — 화성 음정(동시 울림)·복합음정(9~13도)          | `src/lib/questionGenerator.ts`(PRESENTATION_POOLS·COMPOUND_INTERVALS·intervalToAbc harmonic), `src/lib/contentConfig.ts`(INTERVAL_DIFF_LABELS), `src/types/content.ts`(IntervalDifficulty), `src/i18n/locales/*/content.json`(interval 13~21·explain.interval·difficulty.interval), `src/i18n/locales/*/practice.json`(choice.intervalHarmonicPrompt·intervalCompoundPrompt) |
| 2.0 추가 콘텐츠 무료/Pro 범위·NEW 배지·요금제 비교표            | `src/lib/contentConfig.ts`(NEW_CONTENT_DIFFICULTIES·isNewDifficulty·countNewLevels·getFreeDifficulties), `src/components/CategoryCard.tsx`(newCount·ICON_MAP export), `src/screens/CategoryPracticeScreen.tsx`(NEW 칩), `src/screens/HomeScreen.tsx`, `src/screens/PaywallScreen.tsx`(CONTENT_CATEGORIES 기반 비교표), `src/i18n/locales/*/common.json`(badge.new), `docs/CONTENT_SCOPE_2_0.md` |
| 통계 화면 — 카테고리별 연습·약점/강점·주간 증감·활동일              | `src/lib/computeStats.ts`(computeInsights), `src/screens/StatsScreen.tsx`, `src/i18n/locales/*/stats.json`(summary.delta*·section.byCategory·activeDays·category.*), `src/__tests__/computeStats.test.ts` |
| 기존 사용자 데이터 보존(1.1.x → 2.0 키·형태 호환)                   | `src/lib/localProfileStorage.ts`(localDataKey = `<base>_<userId>`), `src/__tests__/localProfileStorage.test.ts`("기존 사용자 데이터 보존"), `docs/CONTENT_SCOPE_2_0.md` |
| 화성 진행 5~7단계 — 종지 세분화(PAC/IAC/HC/DC)·기능 진행(ii6·V7·전위)·로마숫자 화음 판별 | `src/lib/questionGenerator.ts`(CADENCE_DETAIL_TEMPLATES·FUNCTIONAL_TEMPLATES·ROMAN_TEMPLATES·parseRomanToken·romanChordSpec), `src/lib/progressionVoicing.ts`(ChordSpec·finalSopranoMembers), `src/lib/contentConfig.ts`(PROGRESSION_DIFF_LABELS), `src/types/content.ts`(ProgressionDifficulty), `src/i18n/locales/*/content.json`(cadence.pac/iac·progression·roman·explain.*·difficulty.progression), `src/i18n/locales/*/practice.json`(choice.cadenceDetailPrompt·progressionFigurePrompt·romanPrompt) |
| 화음 듣기 4단계 — 3화음 전위(제1·제2전위)                          | `src/lib/questionGenerator.ts`(CHORD_TEMPLATES maj_inv2·min_inv2, CHORD_POOLS chord_5), `src/lib/contentConfig.ts`(CHORD_DIFF_LABELS), `src/types/content.ts`(ChordDifficulty), `src/i18n/locales/*/content.json`(chord·explain.chord·difficulty.chord) |
| 선율/2성부 화면 깜박임 및 연습 흐름 회귀 검증                      | `src/__tests__/notationPracticeScreen.test.ts`                                                                                                                                                                                                                                    |
| 귀 열기 7일 코스 커리큘럼·미니 문제 생성·진행 상태                 | `src/lib/beginnerCourse/{config,questions,progress}.ts`                                                                                                                                                                                                                           |
| 3분 레벨 테스트 진행·결과·추천 난이도 연동                         | `src/lib/levelTest/{config,engine,questions}.ts`, `src/screens/LevelTestScreen.tsx`, `src/hooks/useLevelTestResult.ts`, `src/screens/CategoryPracticeScreen.tsx`(추천 배지·initialDifficulty)                                                                                     |
| 마스코트 갤러리 진입·잠금 표시, 일일 목표 7종(마디·화성 진행 포함) | `src/screens/MascotGalleryScreen.tsx`, `src/lib/dailyGoal.ts`(목표 카테고리·달성 수·연속 달성일), `src/screens/HomeScreen.tsx`(마스코트·일일 목표 카드), `src/screens/DailyGoalScreen.tsx`, `src/lib/mascotConfig.ts`(getMascotStageIndex)                                           |
| 귀 열기 코스 화면·레슨 진행·EXP 보상·Home 진입 카드                | `src/screens/BeginnerCourseScreen.tsx`, `src/screens/BeginnerLessonScreen.tsx`, `src/hooks/useBeginnerCourseProgress.ts`, `src/screens/HomeScreen.tsx`                                                                                                                            |
| 오답노트 저장·복습 모드·약점 집중 연습                             | `src/lib/wrongNotes.ts`, `src/lib/wrongNoteReviewStore.ts`, `src/hooks/useWrongNotes.ts`, `src/screens/WrongNotesScreen.tsx`, `src/screens/ChoicePracticeScreen.tsx`(review), `src/screens/MockExamScreen.tsx`, `src/screens/ExamResultScreen.tsx`, `src/screens/StatsScreen.tsx` |
| 결과 공유 카드 (이미지/텍스트)                                     | `src/lib/shareCard.ts`, `src/components/ShareResultCard.tsx`, `src/components/ShareCardModal.tsx`, 진입점: `ExamResultScreen`, `ChoicePracticeScreen`(결과), `LevelTestScreen`(결과), `StatsScreen`(헤더), `BeginnerLessonScreen`(코스 완주)                                      |
| 음계·선법 듣기 (객관식 5단계, 5단계 상행·하행)                     | `src/lib/scaleQuestions.ts`(SCALE_DIRECTIONS·scaleStepSequence·DESCENDING_FORM), `src/lib/questionGenerator.ts`(dispatch), `src/lib/contentConfig.ts`, `src/i18n/locales/*/content.json`(scale·explain.scale·explain.scaleDescending), `src/i18n/locales/*/practice.json`(choice.scaleBothPrompt) |
| 리듬 탭 (탭 타이밍 채점 6단계, 5 3/4·6 6/8)                        | `src/lib/rhythmTap.ts`(RHYTHM_TAP_LEVELS·accentEveryFor), `src/screens/RhythmTapScreen.tsx`(복합박자 강박 점), `src/components/AbcjsRenderer.tsx`(playClickTrack·onClickTrackState), `src/components/abcjsWebViewHtml.ts`(PLAY_CLICK_TRACK), `src/screens/CategoryPracticeScreen.tsx`(answerType tap 분기) |
| 태블릿 레이아웃 (콘텐츠 가운데 정렬·모달/시트/폼 폭·차트 폭)       | `src/lib/layout.ts`, `src/hooks/useResponsiveLayout.ts`, 각 화면의 `contentContainerStyle`, `src/components/{AppAlert,UpgradeModal,BottomSheet,ShareCardModal,DailyScoreChart}.tsx`, `src/screens/{LoginScreen,OnboardingScreen}.tsx`(narrowStyle)                                   |

---

## 문서

| 파일                                         | 설명                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/NOTATION_SCREEN_FIX_20260831.md`       | 8월 22일 회귀 원인·빌드 58~62 대조·실기기 검증·62 (1.1.3) AAB 및 서명 검증         |
| `docs/BEGINNER_EAR_OPENING_COURSE_DESIGN.md` | 초급자용 “귀 열기 코스” 설계안 (2026-11-03 BeginnerCourse/BeginnerLesson으로 구현) |
| `docs/PROFILES_RLS_20261103.md`              | profiles RLS 활성화·tier 보호 트리거 마이그레이션의 배경·적용·검증 절차            |
| `docs/CONTENT_SCOPE_2_0.md`                  | 2.0 추가 콘텐츠의 무료/Pro 범위표(NEW 배지·요금제 비교표 근거)와 1.1.x 데이터 보존 점검 |
| `docs/HANDOFF_2_0_CODEX_20261104.md`         | 2.0 작업 인수인계: 현재 상태·커밋 요약·설계 규약·빌드 절차·미적용 DB 마이그레이션·남은 일 |
| `AD_COPY.md`                                 | 페이지별 광고 문구 모음 (13개 활성 화면)                                           |
| `store/android/listing.md`                   | Play 스토어 등록 문구 2.0 (ko/en/ja 짧은/전체 설명, 릴리스 노트, 앱 액세스 정보)   |
| `store/android/RELEASE_GUIDE.md`             | Play Console 릴리스 절차 가이드                                                    |
| `README.md`                                  | 프로젝트 개요·스택·콘텐츠 10종·스크립트·데이터 원칙·빌드 문서 안내                 |
| `TODOS.md`                                   | 남은 일 목록 (2.0 이후 남은 항목 포함)                                             |
