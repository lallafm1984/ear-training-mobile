# MelodyGen — 프로젝트 구조 인덱스

> 마지막 업데이트: 2026-04-06

## 디렉토리 구조

```
src/
├── components/          # 재사용 가능 UI 컴포넌트 (17개)
├── context/             # React Context 프로바이더 (3개)
├── hooks/               # 커스텀 React 훅 (5개)
├── lib/                 # 비즈니스 로직 모듈
│   ├── scoreUtils/      # 악보 유틸리티 (8개 모듈)
│   ├── scoreGenerator/  # 악보 생성 엔진 (6개 모듈)
│   ├── twoVoice/        # 2성부 작곡 모듈 (12개)
│   ├── practiceScoreGenerator.ts  # 기보형 악보 생성 (공유)
│   ├── examNotationStore.ts      # 모의시험↔기보연습 데이터 전달
│   └── ...              # 기타 라이브러리
├── navigation/          # 네비게이션 설정
├── screens/             # 화면 컴포넌트
│   └── ScoreEditor/     # 악보 에디터 (13개 모듈)
├── theme/               # 디자인 토큰 (색상, 테마)
├── types/               # TypeScript 타입 정의
└── __tests__/           # Jest 테스트 (5개)
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

### `src/screens/ScoreEditor/` — 악보 에디터 화면

| 모듈 | 역할 |
|------|------|
| `index.tsx` | 메인 `ScoreEditorScreen` 컴포넌트 |
| `constants.ts` | 상수 (음표, 조성, 난이도 라벨 등) |
| `styles.ts` | StyleSheet 정의 |
| `types.ts` | 로컬 인터페이스 |
| `utils.ts` | `fillWithRests`, `getSavedScores`, `persistScores` |
| `SettingsSheet.tsx` | 조성/박자/템포 설정 바텀시트 |
| `PlaybackSheet.tsx` | 재생 옵션 (AP시험, 한국식, 에코, 커스텀) |
| `GenerateSheet.tsx` | AI 생성 UI (난이도 선택) |
| `SavedScoresSheet.tsx` | 저장된 악보 목록 |
| `NotePalette.tsx` | 음표 입력 팔레트 |
| `AbcNotationModal.tsx` | ABC 표기법 보기 모달 |
| `LoadingModal.tsx` | 로딩 모달 |

---

## Context 프로바이더

| Context | 파일 | 역할 |
|---------|------|------|
| `AuthContext` | `context/AuthContext.tsx` | 인증, 프로필, 세션 관리 |
| `SubscriptionContext` | `context/SubscriptionContext.tsx` | 구독 티어, 다운로드 쿼터 |
| `AlertContext` | `context/AlertContext.tsx` | 글로벌 알림/토스트 |

---

## 커스텀 훅

| 훅 | 역할 |
|----|------|
| `useAuth()` | 인증 상태 접근 |
| `useSubscription()` | 구독 티어/제한 접근 |
| `useAlert()` | 글로벌 알림 표시 |
| `useSkillProfile()` | 스킬 프로필 영속화 (AsyncStorage + Supabase) |
| `usePracticeHistory()` | 연습 통계/기록 |
| `useDownloadQuota()` | 다운로드 권한/소모 |
| `useNoteInput()` | 음표 입력 핸들링 |
| `usePlaybackConfig()` | ScoreEditor 재생 설정 상태 (15개) |
| `useGenerationState()` | ScoreEditor 생성 파라미터 상태 (8개) |

---

## 네비게이션 (12개 화면)

```
Onboarding → Home
              ├── CategoryPractice → ChoicePractice (객관식)
              │                    → NotationPractice (기보형)
              ├── ScoreEditor (악보 에디터)
              ├── MockExamSetup → MockExam → ExamResult
              ├── Stats
              ├── Paywall (모달)
              └── Profile (모달)
```

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
