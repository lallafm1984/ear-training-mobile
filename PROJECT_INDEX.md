# MelodyGen (ear-training-mobile) 프로젝트 인덱스

> 이 문서는 Claude가 파일 검색 시 우선 참조하는 프로젝트 구조 로드맵입니다.
> 프로젝트 구조가 변경되면 반드시 이 문서도 함께 업데이트해야 합니다.

## 1. 프로젝트 개요

- **앱 이름**: MelodyGen (음악 청음 훈련 앱)
- **번들 ID**: com.melodygen.app
- **버전**: 1.1.0
- **프레임워크**: React Native 0.81.5 + Expo 54.0.0
- **언어**: TypeScript 5.9.2 (strict mode)
- **백엔드**: Supabase (PostgreSQL + Auth)
- **결제**: RevenueCat (인앱 구독)
- **악보 렌더링**: ABCjs (WebView 기반)
- **네비게이션**: React Navigation (Stack + Bottom Tabs)
- **상태관리**: React Context API + AsyncStorage
- **테스트**: Jest + ts-jest

### 핵심 기능
- 선율/리듬 받아쓰기 (Notation Practice)
- 음정/화성/조성 듣기 (Multiple Choice)
- 2성부 대위법 연습 (Two-Voice)
- 악보 에디터 (Score Editor)
- 모의시험 (Mock Exam)
- 학습 통계 및 스킬 프로필
- 프리미엄 구독 (Free/Pro)

---

## 2. 디렉토리 트리

```
ear-training-mobile/
├── App.tsx                         # 앱 루트 컴포넌트
├── index.ts                        # 진입점 (registerRootComponent)
├── package.json                    # 의존성 및 스크립트
├── tsconfig.json                   # TypeScript 설정
├── babel.config.js                 # Babel 설정
├── app.json                        # Expo 앱 설정
├── eas.json                        # EAS 빌드 설정
├── jest.config.js                  # Jest 설정
├── jest.setup.js                   # Jest 셋업
├── CLAUDE.md                       # Claude AI 지시사항
├── CHANGELOG.md                    # 버전 변경 이력
├── TODOS.md                        # 할 일 목록
├── README.md                       # 프로젝트 소개
├── supabase_schema.sql             # Supabase 초기 스키마
├── supabase_migration_phase3.sql   # Phase 3 마이그레이션
├── add_gen_balance.sql             # 생성 잔액 SQL
├── test_abc.html                   # ABC 테스트 HTML
├── test_abc2.js                    # ABC 테스트 JS
│
├── src/                            # 메인 소스코드
│   ├── __tests__/                  # 단위 테스트
│   ├── components/                 # 재사용 UI 컴포넌트
│   ├── context/                    # React Context (상태관리)
│   ├── hooks/                      # 커스텀 React 훅
│   ├── lib/                        # 비즈니스 로직 & 유틸리티
│   │   └── twoVoice/              # 2성부 생성 모듈
│   ├── navigation/                 # 네비게이션 설정
│   ├── screens/                    # 화면 컴포넌트
│   │   └── ScoreEditor/           # 악보 에디터 서브모듈
│   ├── theme/                      # 테마 (색상)
│   └── types/                      # TypeScript 타입 정의
│
├── scripts/                        # 개발/QA 유틸리티 스크립트
├── assets/                         # 정적 에셋
├── docs/                           # 문서
│   ├── superpowers/plans/         # AI 기획 문서
│   └── superpowers/specs/         # AI 설계 문서
└── store/android/                  # Play Store 리스팅/릴리스 가이드
```

---

## 3. 진입점

| 파일 | 역할 |
|------|------|
| `index.ts` | Expo 앱 등록 (registerRootComponent) |
| `App.tsx` | 루트 컴포넌트. 인증 상태에 따라 LoginScreen 또는 MainStack 렌더링. ErrorBoundary, SafeAreaProvider, NavigationContainer 래핑 |

---

## 4. 화면 (Screens)

| 파일 | 화면명 | 역할 |
|------|--------|------|
| `src/screens/HomeScreen.tsx` | Home | 메인 대시보드. 카테고리 카드, 빠른 시작, 최근 활동 |
| `src/screens/CategoryPracticeScreen.tsx` | CategoryPractice | 카테고리별 난이도 선택 |
| `src/screens/ChoicePracticeScreen.tsx` | ChoicePractice | 객관식 퀴즈 (음정/화성/조성) |
| `src/screens/NotationPracticeScreen.tsx` | NotationPractice | 악보 입력 연습 (선율/리듬/2성부) |
| `src/screens/ScoreEditorScreen.tsx` | ScoreEditor | 고급 악보 에디터 (래퍼) |
| `src/screens/MockExamSetupScreen.tsx` | MockExamSetup | 모의시험 프리셋 선택 |
| `src/screens/MockExamScreen.tsx` | MockExam | 모의시험 실행 (타이머, 섹션 네비게이션) |
| `src/screens/ExamResultScreen.tsx` | ExamResult | 시험 결과 표시 및 Supabase 저장 |
| `src/screens/StatsScreen.tsx` | Stats | 학습 통계 대시보드 |
| `src/screens/LoginScreen.tsx` | Login | Google OAuth 로그인 |
| `src/screens/OnboardingScreen.tsx` | Onboarding | 신규 사용자 튜토리얼 캐러셀 |
| `src/screens/PaywallScreen.tsx` | Paywall | 구독 플랜 안내 및 구매 |
| `src/screens/ProfileScreen.tsx` | Profile | 계정 설정, 로그아웃, 탈퇴 |
| `src/screens/index.ts` | - | 화면 barrel export |

### ScoreEditor 서브모듈 (`src/screens/ScoreEditor/`)

| 파일 | 역할 |
|------|------|
| `index.tsx` | 메인 에디터 컴포넌트 |
| `AbcNotationModal.tsx` | ABC 표기법 모달 |
| `GenerateSheet.tsx` | 자동 악보 생성 시트 |
| `NotePalette.tsx` | 음표 입력 팔레트 |
| `PlaybackSheet.tsx` | 재생 컨트롤 시트 |
| `SavedScoresSheet.tsx` | 저장된 악보 목록 |
| `SettingsSheet.tsx` | 에디터 설정 시트 |
| `constants.ts` | 에디터 상수 |
| `types.ts` | 에디터 타입 정의 |
| `utils.ts` | 에디터 유틸리티 함수 |
| `styles.ts` | 에디터 스타일 |

---

## 5. 컴포넌트 (Components)

| 파일 | 역할 |
|------|------|
| `src/components/AbcjsRenderer.tsx` | ABCjs WebView 기반 악보 렌더링. togglePlay(), requestExportImage(), requestExportAudio() 메서드 제공 |
| `src/components/PianoKeyboard.tsx` | 인터랙티브 피아노 건반 UI |
| `src/components/CategoryCard.tsx` | 카테고리 표시 카드 |
| `src/components/QuickStartCard.tsx` | 빠른 시작 추천 카드 |
| `src/components/RecentActivityList.tsx` | 최근 연습 히스토리 목록 |
| `src/components/GradingResult.tsx` | 채점 결과 표시 |
| `src/components/AppAlert.tsx` | 글로벌 알림 모달 |
| `src/components/UpgradeModal.tsx` | Pro 업그레이드 모달 |
| `src/components/SelfEvalModal.tsx` | 자기 평가 모달 (1-5점) |
| `src/components/BottomSheet.tsx` | 재사용 바텀 시트 |
| `src/components/ErrorBoundary.tsx` | 에러 경계 래퍼 |
| `src/components/SplashScreen.tsx` | 로딩 스플래시 |
| `src/components/DurationToolbar.tsx` | 음표 길이 선택 툴바 |
| `src/components/abcjsWebViewHtml.ts` | WebView용 HTML 템플릿 |
| `src/components/abcjsSource.ts` | ABCjs 라이브러리 번들 (483KB) |
| `src/components/index.ts` | 컴포넌트 barrel export |

---

## 6. Context (상태관리)

| 파일 | 역할 | 관리 상태 |
|------|------|-----------|
| `src/context/AuthContext.tsx` | 인증 상태 관리 | session, user, profile, loading. Google OAuth + Supabase Auth |
| `src/context/SubscriptionContext.tsx` | 구독 상태 관리 | tier(free/pro), limits, remainingDownloads, isExpired. RevenueCat 연동 |
| `src/context/AlertContext.tsx` | 글로벌 알림 관리 | alert config, showAlert() 메서드 |
| `src/context/index.ts` | barrel export | - |

---

## 7. Hooks (커스텀 훅)

| 파일 | 역할 | 반환 |
|------|------|------|
| `src/hooks/useSkillProfile.ts` | 사용자 스킬 프로필 관리 (레벨, 정확도, 연속일수) | `{ profile, loaded, updateStreak, applyEvaluation }` |
| `src/hooks/usePracticeHistory.ts` | 연습 기록 관리 (AsyncStorage + Supabase 동기화) | `{ records, stats, addRecord, addBatchRecords }` |
| `src/hooks/useDownloadQuota.ts` | 월간 다운로드 한도 관리 | 다운로드 잔여 횟수 |
| `src/hooks/useNoteInput.ts` | 피아노 건반 음표 입력 로직 | 음표 입력 핸들러 |
| `src/hooks/index.ts` | barrel export | - |

---

## 8. Lib (비즈니스 로직)

### 핵심 모듈

| 파일 | 역할 | 주요 함수/export |
|------|------|-----------------|
| `src/lib/scoreGenerator.ts` | 악보 생성 엔진 (128KB) | `generateScore(options)` → GeneratedScore |
| `src/lib/scoreUtils.ts` | 악보 유틸리티 (71KB) | 음높이 변환, 길이, 음정, 임시표 처리 |
| `src/lib/questionGenerator.ts` | 객관식 문제 생성 (14KB) | `generateChoiceQuestion(category, difficulty)` |
| `src/lib/grading.ts` | 채점 로직 | `gradeNotes(answer, user, key)` → GradingResult |
| `src/lib/computeStats.ts` | 통계 계산 | `computeStats(records)` → 카테고리별 합계, 정확도, 주간/월간 |
| `src/lib/contentConfig.ts` | 콘텐츠 카테고리 설정 | 카테고리 정의, 최대 레벨, 무료 한도 |
| `src/lib/trackConfig.ts` | 트랙 설정 (16KB) | 파트연습 vs 종합연습 트랙 구성, 레벨 매핑 |
| `src/lib/examPresets.ts` | 시험 프리셋 정의 | 사전 구성된 시험 시나리오 |
| `src/lib/melodyRhythmLevel.ts` | 난이도별 리듬 매개변수 | 난이도 → 리듬 파라미터 매핑 |
| `src/lib/trebleRhythmFill.ts` | 리듬 패턴 생성 (8KB) | 높은음자리표 리듬 채우기 |
| `src/lib/supabase.ts` | Supabase 클라이언트 | Supabase 초기화 + Profile 타입 |
| `src/lib/revenueCat.ts` | RevenueCat 연동 | 구독/구매 처리 |
| `src/lib/index.ts` | barrel export | - |

### twoVoice 서브모듈 (`src/lib/twoVoice/`)

| 파일 | 역할 |
|------|------|
| `index.ts` | 공개 API (모듈 진입점) |
| `twoVoiceStack.ts` | 메인 2성부 생성 파이프라인 |
| `melodyGenerator.ts` | 선율 라인 생성 |
| `bassGenerator.ts` | 베이스 라인 생성 |
| `bassWithRetry.ts` | 재시도 로직 포함 베이스 생성 |
| `bassToScore.ts` | 베이스 → 악보 변환 |
| `melodyPatterns.ts` | 선율 패턴 템플릿 |
| `bassPatterns.ts` | 베이스 패턴 템플릿 |
| `scales.ts` | 음계 정의, 강박 맵 |
| `meter.ts` | 박자 처리 |
| `counterpoint.ts` | 대위법 규칙 검증 (병행/은복 음정, 성부 간격) |
| `validator.ts` | 유효성 검증 |
| `chromaticAccidental.ts` | 반음계 임시표 처리 |
| `melodyScoreParity.ts` | 선율-악보 일치 검사, 진행 감지 |
| `types.ts` | 타입 정의 |

---

## 9. Types (타입 정의)

| 파일 | 주요 타입 |
|------|----------|
| `src/types/content.ts` | `ContentCategory` ('melody'\|'rhythm'\|'interval'\|'chord'\|'key'\|'twoVoice'), `ContentDifficulty`, `PracticeRecord`, `AnswerType` |
| `src/types/subscription.ts` | `PlanTier` ('free'\|'pro'), `PlanLimits`, `SubscriptionState`, `PLAN_LIMITS` |
| `src/types/exam.ts` | `ExamSection`, `MockExamConfig`, `ExamPreset`, `ExamQuestion` |
| `src/types/playback.ts` | `PlaybackMode` ('normal'\|'apExam'\|'koreanExam'\|'echo'\|'custom'), `APExamSettings`, `KoreanExamSettings` |
| `src/types/index.ts` | barrel export |

---

## 10. Theme

| 파일 | 역할 |
|------|------|
| `src/theme/colors.ts` | 색상 팔레트. Primary: Indigo(#6366f1), Secondary: Amber(#f59e0b), 카테고리별 색상 |
| `src/theme/index.ts` | barrel export |

---

## 11. Navigation

| 파일 | 역할 |
|------|------|
| `src/navigation/MainStack.tsx` | Stack Navigator 라우트 정의. 12개 화면 등록, 타입된 라우트 파라미터 |

### 네비게이션 흐름
```
앱 시작 → AuthContext 세션 확인
├── 미로그인 → LoginScreen (Google OAuth)
└── 로그인됨
    ├── 온보딩 미완료 → OnboardingScreen
    └── 온보딩 완료 → Home
        ├── CategoryPractice → NotationPractice 또는 ChoicePractice
        ├── ScoreEditor
        ├── MockExamSetup → MockExam → ExamResult
        ├── Stats
        ├── Profile
        └── Paywall
```

---

## 12. 테스트

| 파일 | 커버리지 |
|------|----------|
| `src/__tests__/scoreGenerator.test.ts` | 악보 생성 (난이도별, 마디 수) |
| `src/__tests__/grading.test.ts` | 채점 로직 (정답/오답/부분/초과/누락) |
| `src/__tests__/computeStats.test.ts` | 통계 집계 (카테고리별, 정확도) |
| `src/__tests__/questionGenerator.test.ts` | 객관식 문제 생성 |
| `src/__tests__/skillProfile.test.ts` | 스킬 프로필 추천 |

---

## 13. Scripts (개발 유틸리티)

| 파일 | 역할 |
|------|------|
| `scripts/generateTestAbc.ts` | 테스트 선율 생성 |
| `scripts/generateTwoVoiceAbc.ts` | 2성부 테스트 생성 |
| `scripts/analyzeAbcQuality.ts` | 생성 품질 분석 |
| `scripts/analyzeAccidentals.ts` | 임시표 분석 |
| `scripts/analyzeMajorMinor.ts` | 장단조 분석 |
| `scripts/checkAccidentals.ts` | 임시표 검증 |
| `scripts/checkBar7Flat.ts` | 특정 마디 테스트 |
| `scripts/checkFirstNote100.ts` | 첫 음표 검증 |
| `scripts/checkFirstNote2v.ts` | 2성부 첫 음표 검증 |
| `scripts/checkFirstNoteBoth.ts` | 통합 첫 음표 검증 |
| `scripts/compareMelody1v2.ts` | 단성부 vs 2성부 비교 |
| `scripts/bulkTest100.ts` | 벌크 테스트 (100회) |
| `scripts/generateBulkTest.ts` | 벌크 테스트 생성 |
| `scripts/qaTwoVoice.ts` | 2성부 QA |
| `scripts/qaTwoVoiceBatch.ts` | 2성부 배치 QA |
| `scripts/test1v_adv.ts` | 고급 단성부 테스트 |
| `scripts/testTwoVoice.ts` | 2성부 테스트 |
| `scripts/bundle-abcjs.js` | ABCjs 번들링 |

---

## 14. 설정 파일

| 파일 | 역할 |
|------|------|
| `app.json` | Expo 앱 설정 (이름, 번들ID, 권한, 플러그인) |
| `eas.json` | EAS 빌드 프로필 (development/preview/production) |
| `tsconfig.json` | TypeScript 설정 (expo/tsconfig.base 확장, strict) |
| `babel.config.js` | Babel 프리셋 (babel-preset-expo) |
| `jest.config.js` | Jest 설정 (ts-jest, node 환경) |
| `jest.setup.js` | Jest 셋업 |

---

## 15. 문서

| 파일 | 역할 |
|------|------|
| `docs/PLANNING.md` | 프로젝트 기획 문서 (18KB) |
| `docs/PRIVACY_POLICY.md` | 개인정보 처리방침 |
| `docs/TERMS_OF_SERVICE.md` | 이용약관 |
| `docs/superpowers/plans/` | AI 기획 문서 |
| `docs/superpowers/specs/` | AI 설계 문서 |
| `store/android/listing.md` | Play Store 리스팅 |
| `store/android/RELEASE_GUIDE.md` | Android 릴리스 가이드 |

---

## 16. DB 스키마

SQL 파일: `supabase_schema.sql`, `supabase_migration_phase3.sql`, `add_gen_balance.sql`

### 주요 테이블
| 테이블 | 역할 |
|--------|------|
| `profiles` | 사용자 프로필 (tier, 구독 만료일, 다운로드 횟수) |
| `practice_records` | 연습 기록 (카테고리, 난이도, 평가, 정확도) |
| `user_skill_profiles` | 스킬 프로필 (레벨, 정확도, 연속일수) |
| `exam_results` | 시험 결과 (점수, 카테고리별 점수 JSONB) |

---

## 17. 외부 연동

| 서비스 | 용도 | 관련 파일 |
|--------|------|-----------|
| Supabase | 백엔드, 인증, DB | `src/lib/supabase.ts`, `src/context/AuthContext.tsx` |
| RevenueCat | 인앱 구독/결제 | `src/lib/revenueCat.ts`, `src/context/SubscriptionContext.tsx` |
| ABCjs | 악보 렌더링 | `src/components/AbcjsRenderer.tsx`, `src/components/abcjsSource.ts` |
| Expo | 모바일 런타임, 빌드 | `app.json`, `eas.json` |

---

## 18. 기능별 파일 매핑

### 악보 생성/렌더링을 수정하려면
- `src/lib/scoreGenerator.ts` - 생성 엔진
- `src/lib/scoreUtils.ts` - 유틸리티
- `src/lib/melodyRhythmLevel.ts` - 난이도 매핑
- `src/lib/trebleRhythmFill.ts` - 리듬 패턴
- `src/components/AbcjsRenderer.tsx` - 렌더링
- `src/components/abcjsWebViewHtml.ts` - WebView HTML

### 2성부 기능을 수정하려면
- `src/lib/twoVoice/` - 전체 디렉토리
- `src/lib/scoreGenerator.ts` - 2성부 호출 부분
- `src/screens/NotationPracticeScreen.tsx` - 2성부 연습 UI

### 채점/평가를 수정하려면
- `src/lib/grading.ts` - 채점 로직
- `src/components/GradingResult.tsx` - 결과 표시
- `src/components/SelfEvalModal.tsx` - 자기평가

### 객관식 퀴즈를 수정하려면
- `src/lib/questionGenerator.ts` - 문제 생성
- `src/screens/ChoicePracticeScreen.tsx` - 퀴즈 UI
- `src/lib/contentConfig.ts` - 카테고리 설정

### 모의시험을 수정하려면
- `src/lib/examPresets.ts` - 시험 프리셋
- `src/screens/MockExamSetupScreen.tsx` - 설정 화면
- `src/screens/MockExamScreen.tsx` - 시험 실행
- `src/screens/ExamResultScreen.tsx` - 결과 표시
- `src/types/exam.ts` - 시험 타입

### 인증/계정을 수정하려면
- `src/context/AuthContext.tsx` - 인증 로직
- `src/lib/supabase.ts` - Supabase 클라이언트
- `src/screens/LoginScreen.tsx` - 로그인 UI
- `src/screens/ProfileScreen.tsx` - 프로필 UI

### 구독/결제를 수정하려면
- `src/context/SubscriptionContext.tsx` - 구독 상태
- `src/lib/revenueCat.ts` - RevenueCat 연동
- `src/screens/PaywallScreen.tsx` - 결제 UI
- `src/components/UpgradeModal.tsx` - 업그레이드 모달
- `src/types/subscription.ts` - 구독 타입

### 통계/진행도를 수정하려면
- `src/lib/computeStats.ts` - 통계 계산
- `src/hooks/useSkillProfile.ts` - 스킬 프로필
- `src/hooks/usePracticeHistory.ts` - 연습 기록
- `src/screens/StatsScreen.tsx` - 통계 화면
- `src/screens/HomeScreen.tsx` - 대시보드

### 악보 에디터를 수정하려면
- `src/screens/ScoreEditor/` - 전체 디렉토리
- `src/screens/ScoreEditorScreen.tsx` - 래퍼 화면
- `src/lib/scoreGenerator.ts` - 생성 엔진
- `src/components/AbcjsRenderer.tsx` - 렌더링

### 네비게이션을 수정하려면
- `src/navigation/MainStack.tsx` - 라우트 정의
- `App.tsx` - 루트 래퍼

### 테마/스타일을 수정하려면
- `src/theme/colors.ts` - 색상 팔레트
- `src/screens/ScoreEditor/styles.ts` - 에디터 스타일

### 피아노 입력을 수정하려면
- `src/components/PianoKeyboard.tsx` - 건반 UI
- `src/hooks/useNoteInput.ts` - 입력 로직
- `src/components/DurationToolbar.tsx` - 길이 선택
