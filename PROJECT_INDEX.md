# MelodyGen — 프로젝트 구조 인덱스

> 마지막 업데이트: 2026-04-09

## 디렉토리 구조

```
src/
├── components/          # 재사용 가능 UI 컴포넌트 (19개, 미사용 2개)
├── context/             # React Context 프로바이더 (3개)
├── hooks/               # 커스텀 React 훅 (5개)
├── lib/                 # 비즈니스 로직 모듈
│   ├── scoreUtils/      # 악보 유틸리티 (8개 모듈)
│   ├── scoreGenerator/  # 악보 생성 엔진 (6개 모듈)
│   ├── twoVoice/        # 2성부 작곡 모듈 (12개)
│   ├── practiceScoreGenerator.ts  # 기보형 악보 생성 (공유)
│   ├── examNotationStore.ts      # 모의시험↔기보연습 데이터 전달
│   ├── mascotConfig.ts           # 마스코트 진화 시스템 (레벨/EXP/비주얼)
│   └── ...              # 기타 라이브러리
├── i18n/                # 국제화 (i18next)
│   ├── index.ts         # i18n 초기화 + 언어 감지
│   └── locales/         # 번역 파일 (ko/en/ja × 12 네임스페이스)
├── navigation/          # 네비게이션 설정
├── screens/             # 화면 컴포넌트 (14개 + ScoreEditor 서브모듈)
│   └── ScoreEditor/     # 악보 에디터 (13개 모듈)
├── theme/               # 디자인 토큰 (색상, 테마)
├── types/               # TypeScript 타입 정의
└── __tests__/           # Jest 테스트 (10개)
```

---

## 사용 상태 분류

### ✅ 활성 사용 중 (Active)

#### 화면 (Screens) — 로그인 → 메인 흐름에서 도달 가능

| 화면 | 파일 | 진입 경로 |
|------|------|-----------|
| Login | `screens/LoginScreen.tsx` | App.tsx — 미로그인 시 |
| Onboarding | `screens/OnboardingScreen.tsx` | 최초 실행 시 |
| Home | `screens/HomeScreen.tsx` | 로그인 후 메인 |
| CategoryPractice | `screens/CategoryPracticeScreen.tsx` | Home → 카테고리 선택 |
| ChoicePractice | `screens/ChoicePracticeScreen.tsx` | CategoryPractice → 객관식 |
| NotationPractice | `screens/NotationPracticeScreen.tsx` | CategoryPractice → 기보형 |
| MockExamSetup | `screens/MockExamSetupScreen.tsx` | Home → 모의시험 |
| MockExam | `screens/MockExamScreen.tsx` | MockExamSetup → 시험 진행 |
| ExamResult | `screens/ExamResultScreen.tsx` | MockExam → 결과 |
| Stats | `screens/StatsScreen.tsx` | Home → 통계 |
| DailyGoal | `screens/DailyGoalScreen.tsx` | Home → 일일 목표 |
| Paywall | `screens/PaywallScreen.tsx` | Home → 구독 (모달) |
| Profile | `screens/ProfileScreen.tsx` | Home → 프로필 (모달) |

#### 컴포넌트 (Components)

| 컴포넌트 | 사용처 |
|----------|--------|
| `AbcjsRenderer` | ChoicePractice, MockExam, NotationPractice, ScoreEditor |
| `abcjsSource.ts` | abcjsWebViewHtml 내부 |
| `abcjsWebViewHtml.ts` | AbcjsRenderer 내부 |
| `AppAlert` | AlertContext |
| `BottomSheet` | ScoreEditor (PlaybackSheet, SavedScoresSheet, SettingsSheet) |
| `CategoryCard` | HomeScreen |
| `DailyScoreChart` | StatsScreen |
| `DurationToolbar` | NotationPracticeScreen |
| `ErrorBoundary` | App.tsx |
| `GoogleLogo` | LoginScreen |
| `GradingResult` | NotationPracticeScreen |
| `LegalModal` | LoginScreen, ProfileScreen |
| `MascotCharacter` | HomeScreen, DailyGoalScreen, MascotGalleryScreen |
| `PianoKeyboard` | NotationPracticeScreen |
| `PracticeCalendar` | StatsScreen |
| `PracticeSettingsSheet` | CategoryPracticeScreen |
| `RecentActivityList` | HomeScreen |
| `SplashScreen` | MainStack (초기 로딩) |
| `UpgradeModal` | ScoreEditor |

#### 커스텀 훅

| 훅 | 사용처 |
|----|--------|
| `useSkillProfile` | HomeScreen, ChoicePractice, NotationPractice, MockExam, Stats |
| `usePracticeHistory` | HomeScreen, ChoicePractice, NotationPractice, MockExam, Stats, DailyGoal |
| `useMascotExp` | HomeScreen, DailyGoalScreen, MascotGalleryScreen |
| `useDownloadQuota` | ScoreEditor |
| `useNoteInput` | NotationPracticeScreen |

#### Context 프로바이더

| Context | 파일 | 사용처 |
|---------|------|--------|
| `AuthContext` | `context/AuthContext.tsx` | App.tsx, 전체 인증 |
| `SubscriptionContext` | `context/SubscriptionContext.tsx` | MainStack 하위 전체 |
| `AlertContext` | `context/AlertContext.tsx` | App.tsx, 전체 알림 |

#### 라이브러리 (Lib) — 모두 활성

| 모듈 | 주요 사용처 |
|------|-------------|
| `scoreUtils/*` | scoreGenerator, twoVoice, practiceScoreGenerator |
| `scoreGenerator/*` | ScoreEditor, practiceScoreGenerator |
| `twoVoice/*` | scoreGenerator (generateTwoVoiceStack) |
| `practiceScoreGenerator.ts` | NotationPractice, MockExam |
| `contentConfig.ts` | 대부분의 화면 (8곳) |
| `questionGenerator.ts` | ChoicePractice, MockExam |
| `grading.ts` | NotationPractice, GradingResult |
| `examPresets.ts` | MockExamSetup, MockExam |
| `examNotationStore.ts` | MockExam, NotationPractice |
| `computeStats.ts` | StatsScreen |
| `mascotConfig.ts` | MascotGalleryScreen, DailyGoalScreen |
| `trackConfig.ts` | ScoreEditor, useSkillProfile, practiceScoreGenerator |
| `revenueCat.ts` | SubscriptionContext, PaywallScreen |
| `melodyRhythmLevel.ts` | scoreGenerator, twoVoice |
| `trebleRhythmFill.ts` | scoreGenerator, twoVoice, rhythmEngine |
| `rhythmEngine.ts` | practiceScoreGenerator |
| `supabase.ts` | AuthContext, useSkillProfile |

---

### ⚠️ 도달 불가 화면 (Unreachable — MainStack 등록 O, navigate 호출 X)

| 화면 | 파일 | 설명 |
|------|------|------|
| **ScoreEditor** | `screens/ScoreEditor/` (13개 모듈) | MainStack에 등록되어 있으나 `navigate('ScoreEditor')` 호출하는 화면 없음. 악보 에디터 + AI 생성 기능 포함 |
| **MascotGallery** | `screens/MascotGalleryScreen.tsx` | MainStack에 등록되어 있으나 `navigate('MascotGallery')` 호출하는 화면 없음 |

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

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| **QuickStartCard** | `components/QuickStartCard.tsx` | barrel export(`components/index.ts`)만 존재, 어떤 화면에서도 import하지 않음 |
| **SelfEvalModal** | `components/SelfEvalModal.tsx` | barrel export(`components/index.ts`)만 존재, 어떤 화면에서도 import하지 않음 |

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

| 모듈 | 역할 |
|------|------|
| `types.ts` | `ScoreNote`, `ScoreState`, `NoteDuration`, `PitchName`, `Accidental`, `TupletType` 타입 |
| `duration.ts` | 음가 변환, 박자 계산, 잇단음표, beam 그룹 유틸리티 |
| `keySignature.ts` | 조성/음계 생성, 임시표 엔진 (`KEY_SIG_MAP`, `resolveAbcAccidental`) |
| `midi.ts` | MIDI 변환, 이명동음 처리 (`nnToMidi`, `noteToMidiWithKey`) |
| `noteFactory.ts` | 음표 생성 헬퍼 (`uid`, `makeNote`, `makeRest`, `noteNumToNote`) |
| `bassUtils.ts` | 베이스 성부 유틸 (`CHORD_TONES`, `buildTrebleAttackMidiMap`, `passesBassSpacing`) |
| `harmony.ts` | 화성 진행 생성 (`generateProgression`, `getStrongBeatOffsets`) |
| `abc.ts` | ABC 표기법 파이프라인 (`splitAtBeatBoundaries`, `generateAbc`, `getMeasureCount`) |

**의존성**: `types` ← `duration` ← `keySignature` ← `midi` ← `abc`

---

### `src/lib/scoreGenerator/` — 악보 생성 엔진

| 모듈 | 역할 |
|------|------|
| `types.ts` | `Difficulty`, `BassDifficulty`, `GeneratorOptions`, `GeneratedScore`, `DURATION_POOL` |
| `melodyEngine.ts` | 멜로디 생성/수정 (40+ 함수: 임시표 정리, 트라이톤 수정, 종지 생성 등) |
| `voiceLeading.ts` | 성부 진행 분석 (`buildAttackTimeline`, `isConsonantInterval`, `isParallelPerfect`) |
| `postProcessing.ts` | 후처리 (`reviewAndFixScore`, 불협화음 해결, 병행 완전음정 수정) |
| `bassEngine.ts` | 베이스 생성 3전략 (`generateBasicBass`, `generateIndependentBass`, `generateArpeggioBass`) |
| `index.ts` | `generateScore` 메인 함수 + barrel export |

---

## 디자인 토큰

- `theme/colors.ts`: `COLORS` (primary/secondary/neutral/semantic), `CATEGORY_COLORS`, `TRACK_COLORS`

---

## 코드 품질 도구

- **ESLint**: `eslint.config.mjs` (flat config, typescript-eslint + react-hooks)
- **Prettier**: `.prettierrc` (singleQuote, trailingComma, printWidth 100)
- 실행: `npm run lint` / `npm run format` / `npm run format:check`

---

## 테스트

| 테스트 파일 | 대상 |
|------------|------|
| `grading.test.ts` | `normalizeNotes`, `gradeNotes` |
| `questionGenerator.test.ts` | 객관식 문제 생성 |
| `scoreGenerator.test.ts` | 악보 생성 엔진 |
| `computeStats.test.ts` | 통계 집계 |
| `skillProfile.test.ts` | 스킬 레벨 계산 |
| `contentConfig.test.ts` | 카테고리 설정/난이도 라벨 |
| `duration.test.ts` | 음가 변환/박자 계산 |
| `keySignature.test.ts` | 조성/음계/임시표 |
| `melodyRhythmLevel.test.ts` | 레벨별 리듬 파라미터 |
| `examPresets.test.ts` | 시험 프리셋 구조 검증 |

실행: `npm test` (179개 테스트)
