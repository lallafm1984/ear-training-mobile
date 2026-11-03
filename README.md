# MelodyGen (ear-training-mobile)

음대 입시생과 취미 학습자를 위한 모바일 청음 훈련 앱. 모든 문제(악보·객관식·리듬)는 클라이언트에서 알고리즘으로 생성하며, 학습 데이터는 기기(AsyncStorage)에만 저장한다.

## 스택

- Expo 54 · React Native 0.81 · React 19 · TypeScript 5.9
- React Navigation 7, i18next (ko/en/ja), lucide-react-native
- 악보 렌더링·재생: ABCJS (WebView, `src/components/AbcjsRenderer.tsx`)
- 인증·프로필: Supabase / 구독: RevenueCat / 알림: expo-notifications (로컬 예약만)

## 콘텐츠 (10종)

마디 받아쓰기, 선율 받아쓰기, 리듬 받아쓰기, 2성부 받아쓰기(기보형) · 음정, 화성, 화성 진행, 조성, 음계·선법(객관식) · 리듬 탭(탭 타이밍 채점). 설정은 `src/lib/contentConfig.ts`.

부가 흐름: 게스트 모드, 귀 열기 7일 코스, 3분 레벨 테스트, 오답노트·약점 집중 연습, 일일 목표·마스코트, 매일 리마인더, 결과 공유 카드, 모의시험.

## 시작하기

```bash
npm install
npm start            # Expo dev server (expo-dev-client 필요: 네이티브 모듈 포함)
npm run android      # 로컬 Android 실행
npm test             # Jest
npm run lint         # ESLint
npm run format:check # Prettier
npx tsc --noEmit     # 타입 검사
```

네이티브 모듈(expo-notifications, react-native-view-shot, expo-secure-store 등)을 쓰므로 Expo Go가 아닌 개발 빌드(dev client)로 실행한다.

## 구조

파일 위치와 기능별 매핑은 `PROJECT_INDEX.md`를 먼저 본다. 작업 규칙은 `CLAUDE.md`, `AGENTS.md`.

- `src/screens/` 화면 · `src/components/` UI · `src/hooks/` 상태 훅 · `src/lib/` 생성 엔진·순수 로직 · `src/i18n/` 번역
- `supabase/` Edge Function·마이그레이션 · `docs/` 설계·운영 문서 · `store/android/` 스토어 문구·출시 절차

## 데이터 원칙

- 로그인·프로필·구독 상태만 Supabase를 쓴다.
- 연습 기록, 실력 프로필, 시험 결과, 오답노트, 코스 진행 등 학습 데이터는 로컬 전용이며, 로그인 시 게스트 데이터를 계정 키로 이관한다(`src/lib/localProfileStorage.ts`).
- 세션 단위 콘텐츠 실행 집계(`session_content_logs`)만 서버로 보낸다.

## 빌드·출시

- Mac 로컬 Android 릴리스 빌드: `docs/LOCAL_ANDROID_BUILD_MAC.md` (`npm run android:build:local`, versionCode 자동 증가)
- Play Store 등록 정보·출시 절차: `store/android/listing.md`, `store/android/RELEASE_GUIDE.md`
- 원격 버전 정책·공지: `docs/APP_CONTROL_SUPABASE.md`
- profiles RLS 적용 절차: `docs/PROFILES_RLS_20261103.md`

## 라이선스

비공개 (private).
