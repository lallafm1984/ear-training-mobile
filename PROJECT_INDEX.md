# MelodyGen — 프로젝트 구조 인덱스

> 마지막 업데이트: 2026-11-03

## 디렉토리 구조

```
src/
├── components/          # 재사용 가능 UI 컴포넌트 (23개, 미사용 2개)
├── context/             # React Context 프로바이더 (4개)
├── hooks/               # 커스텀 React 훅 (9개)
├── lib/                 # 비즈니스 로직 모듈
│   ├── scoreUtils/      # 악보 유틸리티 (8개 모듈)
│   ├── scoreGenerator/  # 악보 생성 엔진 (6개 모듈)
│   ├── twoVoice/        # 2성부 작곡 모듈 (12개)
│   ├── beginnerCourse/  # 귀 열기 7일 코스 (커리큘럼·미니 문제 생성·진행 상태, 3개 모듈)
│   ├── levelTest/       # 3분 레벨 테스트 (영역 정의·계단식 진행·결과·문항 어댑터, 3개 모듈)
│   ├── practiceScoreGenerator.ts  # 기보형 악보 생성 (공유)
│   ├── examNotationStore.ts      # 모의시험↔기보연습 데이터 전달
│   ├── wrongNotes.ts             # 오답노트 저장 모델·병합·복습 문항 변환·약점 TOP 집계 (로컬 전용)
│   ├── wrongNoteReviewStore.ts   # 오답노트 → 객관식 복습 모드 문항 전달
│   ├── shareCard.ts              # 결과 공유 카드 데이터 모델·텍스트 공유 문구·파일명 (순수 함수)
│   ├── mascotConfig.ts           # 마스코트 진화 시스템 (레벨/EXP/비주얼)
│   ├── oauthCallback.ts          # OAuth 딥링크 query/hash 파싱 + Supabase 세션 생성
│   ├── promotionConfig.ts        # 서버 시간 기반 Pro 캠페인 RPC/공지 키
│   ├── appControl.ts             # 원격 버전 정책/공지 RPC 파싱·빌드 판정·노출 키
│   ├── secureStoreAdapter.ts     # Supabase 세션 SecureStore 청크 저장/레거시 호환
│   ├── logger.ts                 # 개발 빌드 전용 중앙 로그 경계
│   ├── reminder.ts               # 매일 연습 리마인더 설정(기기 전역 키·시각 프리셋·정규화)
│   ├── notifications.ts          # expo-notifications 래퍼 (권한 확인·매일 로컬 알림 예약/취소)
│   └── ...              # 기타 라이브러리
├── i18n/                # 국제화 (i18next)
│   ├── index.ts         # i18n 초기화 + 언어 감지
│   ├── language.ts      # 지원 언어 정규화 + 기기 지역 매칭
│   └── locales/         # 번역 파일 (ko/en/ja × 16 네임스페이스)
├── navigation/          # 네비게이션 설정
├── screens/             # 화면 컴포넌트 (18개 + ScoreEditor 서브모듈)
│   └── ScoreEditor/     # 악보 에디터 (13개 모듈)
├── theme/               # 디자인 토큰 (색상, 테마)
├── types/               # TypeScript 타입 정의
└── __tests__/           # Jest 테스트 (25개)
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
└── PROFILES_RLS_20261103.md                   # profiles RLS 활성화 마이그레이션 적용·검증 절차
scripts/
├── androidLocalBuildEnv.mjs            # 로컬 Android 빌드 환경 변수/경로 유틸
├── checkMacAndroidBuildEnv.mjs         # Mac Android 빌드 필수 도구 점검
├── createAndroidLocalCredentials.mjs   # EAS credentials.json 생성
├── verifyAndroidReleaseKeystore.mjs    # JKS alias/비밀번호 검증
└── buildAndroidReleaseLocal.mjs        # versionCode 증가 + EAS local AAB 빌드
```

---

## 사용 상태 분류

### ✅ 활성 사용 중 (Active)

#### 화면 (Screens) — 로그인 → 메인 흐름에서 도달 가능

| 화면             | 파일                                 | 진입 경로                                                                       |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Login            | `screens/LoginScreen.tsx`            | App.tsx — 미로그인·게스트 아님 시. "로그인 없이 시작"으로 게스트 모드 진입      |
| Onboarding       | `screens/OnboardingScreen.tsx`       | 최초 실행 시                                                                    |
| Home             | `screens/HomeScreen.tsx`             | 로그인 후 메인                                                                  |
| CategoryPractice | `screens/CategoryPracticeScreen.tsx` | Home → 카테고리 선택                                                            |
| ChoicePractice   | `screens/ChoicePracticeScreen.tsx`   | CategoryPractice → 객관식 (WrongNotes → review 복습 모드)                       |
| NotationPractice | `screens/NotationPracticeScreen.tsx` | CategoryPractice → 기보형                                                       |
| MockExamSetup    | `screens/MockExamSetupScreen.tsx`    | Home → 모의시험                                                                 |
| MockExam         | `screens/MockExamScreen.tsx`         | MockExamSetup → 시험 진행                                                       |
| ExamResult       | `screens/ExamResultScreen.tsx`       | MockExam → 결과                                                                 |
| Stats            | `screens/StatsScreen.tsx`            | Home → 통계                                                                     |
| DailyGoal        | `screens/DailyGoalScreen.tsx`        | Home → 일일 목표                                                                |
| BeginnerCourse   | `screens/BeginnerCourseScreen.tsx`   | Home → "처음이라면: 귀 열기 코스" 카드 (7일 레슨 목록·진행률)                   |
| BeginnerLesson   | `screens/BeginnerLessonScreen.tsx`   | BeginnerCourse → Day 카드 (듣기 포인트 → 미니 문제 → 결과·EXP)                  |
| LevelTest        | `screens/LevelTestScreen.tsx`        | Home → "3분 레벨 테스트" 카드 (계단식 12문항 → 영역별 시작 난이도 추천)         |
| WrongNotes       | `screens/WrongNotesScreen.tsx`       | Stats/ExamResult/ChoicePractice 결과 → 오답노트 (약점 TOP3·필터·듣기·복습 시작) |
| Paywall          | `screens/PaywallScreen.tsx`          | Home → 구독 (모달)                                                              |
| Profile          | `screens/ProfileScreen.tsx`          | Home → 프로필 (모달)                                                            |

#### 컴포넌트 (Components)

| 컴포넌트                | 사용처                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbcjsRenderer`         | ChoicePractice, MockExam, NotationPractice, ScoreEditor, WrongNotes(듣기), BeginnerLesson, LevelTest                                                 |
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
| `grading.ts`                | NotationPractice, GradingResult                                                                                                                                                                   |
| `examPresets.ts`            | MockExamSetup, MockExam                                                                                                                                                                           |
| `examNotationStore.ts`      | MockExam, NotationPractice                                                                                                                                                                        |
| `wrongNotes.ts`             | useWrongNotes, WrongNotesScreen, ChoicePractice(복습 모드), localProfileStorage(병합)                                                                                                             |
| `wrongNoteReviewStore.ts`   | WrongNotesScreen(복습 시작) → ChoicePracticeScreen(review 파라미터)                                                                                                                               |
| `shareCard.ts`              | ShareCardModal, ShareResultCard (공유 카드 데이터·텍스트 문구)                                                                                                                                    |
| `computeStats.ts`           | StatsScreen                                                                                                                                                                                       |
| `mascotConfig.ts`           | MascotGalleryScreen, DailyGoalScreen                                                                                                                                                              |
| `oauthCallback.ts`          | AuthContext (Google OAuth 딥링크/콜드 스타트 세션 생성)                                                                                                                                           |
| `promotionConfig.ts`        | SubscriptionContext (서버 시간 프로모션 권한 판정)                                                                                                                                                |
| `appControl.ts`             | AppControlGate (최신 빌드 강제/공지 RPC 검증 및 로컬 노출 상태)                                                                                                                                   |
| `secureStoreAdapter.ts`     | Supabase 인증 세션의 청크 암호화 저장 및 기존 단일 키 마이그레이션                                                                                                                                |
| `logger.ts`                 | ErrorBoundary, 인증·구독·결제의 개발 빌드 전용 진단 로그                                                                                                                                          |
| `reminder.ts`               | useReminderSettings, ProfileScreen, DailyGoalScreen (리마인더 설정 순수 함수)                                                                                                                     |
| `notifications.ts`          | useReminderSettings (expo-notifications 권한·매일 알림 예약, 로컬 전용)                                                                                                                           |
| `trackConfig.ts`            | ScoreEditor, useSkillProfile, practiceScoreGenerator                                                                                                                                              |
| `revenueCat.ts`             | SubscriptionContext, PaywallScreen                                                                                                                                                                |
| `melodyRhythmLevel.ts`      | scoreGenerator, twoVoice                                                                                                                                                                          |
| `trebleRhythmFill.ts`       | scoreGenerator, twoVoice, rhythmEngine                                                                                                                                                            |
| `rhythmEngine.ts`           | practiceScoreGenerator                                                                                                                                                                            |
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

---

### ⚠️ 도달 불가 화면 (Unreachable — MainStack 등록 O, navigate 호출 X)

| 화면              | 파일                               | 설명                                                                                                      |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **ScoreEditor**   | `screens/ScoreEditor/` (13개 모듈) | MainStack에 등록되어 있으나 `navigate('ScoreEditor')` 호출하는 화면 없음. 악보 에디터 + AI 생성 기능 포함 |
| **MascotGallery** | `screens/MascotGalleryScreen.tsx`  | MainStack에 등록되어 있으나 `navigate('MascotGallery')` 호출하는 화면 없음                                |

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
                       ├── Paywall (모달)
                       └── Profile (모달)

[도달 불가]
  ├── ScoreEditor (등록만 됨, 진입 경로 없음)
  └── MascotGallery (등록만 됨, 진입 경로 없음)
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
| 앱 버전/공지 운영 문서            | `docs/APP_CONTROL_SUPABASE.md`              | Supabase 원격 정책 필드·안전한 배포 순서·장애 동작       |

---

## 테스트

| 테스트 파일                      | 대상                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `grading.test.ts`                | `normalizeNotes`, `gradeNotes`                                                                        |
| `questionGenerator.test.ts`      | 객관식 문제 생성                                                                                      |
| `scoreGenerator.test.ts`         | 악보 생성 엔진                                                                                        |
| `computeStats.test.ts`           | 통계 집계                                                                                             |
| `skillProfile.test.ts`           | 스킬 레벨 계산                                                                                        |
| `contentConfig.test.ts`          | 카테고리 설정/난이도 라벨                                                                             |
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
| `shareCard.test.ts`              | 공유 텍스트 구성, 지표 정규화, 캡처 파일명                                                            |
| `oauthCallback.test.ts`          | OAuth query/hash 파싱, PKCE·implicit 세션 생성 및 오류 처리                                           |
| `promotionConfig.test.ts`        | 서버 시간 RPC 판정 및 fail-closed 동작                                                                |
| `appControl.test.ts`             | 최신/최소 빌드 차단, RPC 검증, 공지 링크·노출 키                                                      |
| `secureStoreAdapter.test.ts`     | SecureStore UTF-8 청크, 레거시 세션, 교체·손상·삭제 처리                                              |
| `notationPracticeScreen.test.ts` | 실제 화면·입력 훅·생성기로 선율/2성부 재생성 루프, 답안 유지·다음 문제, 모의시험, 생성 예약 취소 검증 |

실행: `npm test` (332개 테스트). 화면 회귀 테스트는 React 19.1과 동일 버전의 `react-test-renderer` 및 Jest의 JSX 변환을 사용한다.

## 기능별 파일 매핑

| 기능                                                | 파일                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 선율/2성부 받아쓰기 문제 생성·진입·생성 예약 취소   | `src/screens/NotationPracticeScreen.tsx`                                                                                                                                                                                                                                          |
| 새 문제의 첫 음·마디·성부 조건으로 답안 초기화      | `src/hooks/useNoteInput.ts`                                                                                                                                                                                                                                                       |
| 기보형 문제의 클라이언트 동적 생성                  | `src/lib/practiceScoreGenerator.ts`                                                                                                                                                                                                                                               |
| 선율/2성부 화면 깜박임 및 연습 흐름 회귀 검증       | `src/__tests__/notationPracticeScreen.test.ts`                                                                                                                                                                                                                                    |
| 귀 열기 7일 코스 커리큘럼·미니 문제 생성·진행 상태  | `src/lib/beginnerCourse/{config,questions,progress}.ts`                                                                                                                                                                                                                           |
| 3분 레벨 테스트 진행·결과·추천 난이도 연동          | `src/lib/levelTest/{config,engine,questions}.ts`, `src/screens/LevelTestScreen.tsx`, `src/hooks/useLevelTestResult.ts`, `src/screens/CategoryPracticeScreen.tsx`(추천 배지·initialDifficulty)                                                                                     |
| 귀 열기 코스 화면·레슨 진행·EXP 보상·Home 진입 카드 | `src/screens/BeginnerCourseScreen.tsx`, `src/screens/BeginnerLessonScreen.tsx`, `src/hooks/useBeginnerCourseProgress.ts`, `src/screens/HomeScreen.tsx`                                                                                                                            |
| 오답노트 저장·복습 모드·약점 집중 연습              | `src/lib/wrongNotes.ts`, `src/lib/wrongNoteReviewStore.ts`, `src/hooks/useWrongNotes.ts`, `src/screens/WrongNotesScreen.tsx`, `src/screens/ChoicePracticeScreen.tsx`(review), `src/screens/MockExamScreen.tsx`, `src/screens/ExamResultScreen.tsx`, `src/screens/StatsScreen.tsx` |
| 결과 공유 카드 (이미지/텍스트)                      | `src/lib/shareCard.ts`, `src/components/ShareResultCard.tsx`, `src/components/ShareCardModal.tsx`, 진입점: `ExamResultScreen`, `ChoicePracticeScreen`(결과), `LevelTestScreen`(결과), `StatsScreen`(헤더), `BeginnerLessonScreen`(코스 완주)                                      |

---

## 문서

| 파일                                         | 설명                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/NOTATION_SCREEN_FIX_20260831.md`       | 8월 22일 회귀 원인·빌드 58~62 대조·실기기 검증·62 (1.1.3) AAB 및 서명 검증         |
| `docs/BEGINNER_EAR_OPENING_COURSE_DESIGN.md` | 초급자용 “귀 열기 코스” 설계안 (2026-11-03 BeginnerCourse/BeginnerLesson으로 구현) |
| `docs/PROFILES_RLS_20261103.md`              | profiles RLS 활성화·tier 보호 트리거 마이그레이션의 배경·적용·검증 절차            |
| `AD_COPY.md`                                 | 페이지별 광고 문구 모음 (13개 활성 화면)                                           |
