# MelodyGen — 프로젝트 계획 및 현황

> 마지막 업데이트: 2026-04-09

---

## 앱 흐름 개요

```
[Login] → [Onboarding] → [Home]
                            ├── [DailyGoal] → [CategoryPractice] → [ChoicePractice]
                            │                                     → [NotationPractice]
                            ├── [CategoryPractice] → [ChoicePractice]
                            │                      → [NotationPractice]
                            ├── [MockExamSetup] → [MockExam] → [ExamResult]
                            ├── [Stats]
                            ├── [Paywall] (모달)
                            └── [Profile] (모달)
```

---

## 기능 현황

### ✅ 활성 기능 (사용 중)

| 기능 | 핵심 파일 | 상태 |
|------|-----------|------|
| 인증 (Google/Apple 로그인) | `LoginScreen`, `AuthContext`, `supabase.ts` | 완성 |
| 온보딩 | `OnboardingScreen` | 완성 |
| 홈 대시보드 | `HomeScreen`, `CategoryCard`, `RecentActivityList`, `MascotCharacter` | 완성 |
| 카테고리별 연습 | `CategoryPracticeScreen`, `PracticeSettingsSheet` | 완성 |
| 객관식 연습 | `ChoicePracticeScreen`, `questionGenerator.ts` | 완성 |
| 기보형 연습 | `NotationPracticeScreen`, `PianoKeyboard`, `DurationToolbar`, `GradingResult` | 완성 |
| 모의시험 | `MockExamSetupScreen`, `MockExamScreen`, `ExamResultScreen`, `examPresets.ts` | 완성 |
| 통계 | `StatsScreen`, `DailyScoreChart`, `PracticeCalendar`, `computeStats.ts` | 완성 |
| 일일 목표 | `DailyGoalScreen`, `MascotCharacter` | 완성 |
| 구독/결제 | `PaywallScreen`, `SubscriptionContext`, `revenueCat.ts` | 완성 |
| 프로필 | `ProfileScreen`, `LegalModal` | 완성 |
| 마스코트 시스템 | `MascotCharacter`, `mascotConfig.ts`, `useMascotExp` | 완성 |
| 악보 렌더링 | `AbcjsRenderer`, `abcjsSource.ts`, `abcjsWebViewHtml.ts` | 완성 |
| 악보 생성 엔진 | `scoreGenerator/*`, `scoreUtils/*`, `twoVoice/*` | 완성 |
| 스킬 프로필 | `useSkillProfile`, `trackConfig.ts` | 완성 |
| 연습 기록 | `usePracticeHistory` | 완성 |
| 다국어 (ko/en/ja) | `i18n/`, 12개 네임스페이스 | 완성 |
| 글로벌 알림 | `AlertContext`, `AppAlert` | 완성 |

---

### ⚠️ 도달 불가 기능 (코드 존재, 진입 경로 없음)

| 기능 | 파일 | 설명 | 권장 조치 |
|------|------|------|-----------|
| **악보 에디터** | `screens/ScoreEditor/` (13개 모듈) | MainStack에 등록되어 있으나 어떤 화면에서도 `navigate('ScoreEditor')` 호출 없음. AI 악보 생성, 음표 입력, 재생, 저장 기능 포함 | Home에서 진입 경로 추가 또는 제거 결정 필요 |
| **마스코트 갤러리** | `screens/MascotGalleryScreen.tsx` | MainStack에 등록되어 있으나 `navigate('MascotGallery')` 호출 없음. 마스코트 전체 목록 표시 | Home/Profile에서 진입 경로 추가 또는 제거 결정 필요 |

**ScoreEditor 의존 모듈 (ScoreEditor 전용):**
- `GenerateSheet.tsx` — AI 생성 UI
- `PlaybackSheet.tsx` — 재생 옵션 바텀시트
- `SavedScoresSheet.tsx` — 저장 악보 목록
- `SettingsSheet.tsx` — 조성/박자/템포 설정
- `NotePalette.tsx` — 음표 입력 팔레트
- `AbcNotationModal.tsx` — ABC 표기법 보기
- `LoadingModal.tsx` — 로딩 모달
- `usePlaybackConfig.ts` — 재생 설정 상태 훅
- `useGenerationState.ts` — 생성 파라미터 상태 훅
- `constants.ts`, `styles.ts`, `types.ts`, `utils.ts`

> ScoreEditor가 사용하는 `useDownloadQuota`, `UpgradeModal`, `trackConfig.ts`는 다른 곳에서도 사용 중이므로 ScoreEditor 제거 시에도 유지 필요

---

### ❌ 미사용 코드 (Dead Code)

| 파일 | 설명 | 권장 조치 |
|------|------|-----------|
| `components/QuickStartCard.tsx` | barrel export만 존재, 어떤 화면에서도 미사용 | 삭제 가능 |
| `components/SelfEvalModal.tsx` | barrel export만 존재, 어떤 화면에서도 미사용 | 삭제 가능 |

---

### 📝 코드 정리 참고사항

| 항목 | 설명 |
|------|------|
| `screens/index.ts` barrel | 12개 화면 export 중 App.tsx에서 `LoginScreen` 1개만 barrel 경유 사용. MainStack은 직접 import. 정리 또는 통일 고려 |

---

## 데이터 아키텍처

| 구분 | 저장소 | 대상 |
|------|--------|------|
| 인증/계정 | Supabase API | 로그인, 프로필, 구독 상태 |
| 컨텐츠 | AsyncStorage (로컬) | 연습 기록, 실력 프로필, 시험 결과, 악보 |
| 컨텐츠 생성 | 클라이언트 동적 생성 | 악보, 문제 (서버 의존 없음) |

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | React Native (Expo) |
| 네비게이션 | @react-navigation/stack |
| 상태관리 | React Context + AsyncStorage |
| 인증 | Supabase Auth |
| 결제 | RevenueCat |
| 악보 렌더링 | abcjs (WebView) |
| 다국어 | i18next |
| 테스트 | Jest (179개 테스트) |
