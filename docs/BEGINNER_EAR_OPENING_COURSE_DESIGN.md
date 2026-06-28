# 초급자 귀 열기 코스 설계안

> 작성일: 2026-04-28  
> 목적: MelodyGen의 기존 연습 엔진을 활용해 초급자가 "문제를 푸는 앱" 전에 "귀를 여는 앱"을 경험하게 만든다.

## 결론

초급자용 신규 콘텐츠는 별도 서버 콘텐츠가 아니라, 클라이언트에서 생성되는 7일짜리 로컬 커리큘럼으로 만든다.

이름은 **귀 열기 코스**가 좋다. 기존 카테고리인 선율, 리듬, 음정, 화성, 조성을 그대로 활용하되, 초급자에게 바로 채점부터 시키지 않는다. 먼저 듣는 관점, 비교 기준, 작은 성공 경험을 준 뒤 기존 연습 화면으로 연결한다.

## 현재 프로젝트 관찰

- `src/lib/contentConfig.ts`는 6개 카테고리와 난이도를 이미 잘 분리한다.
- `src/lib/questionGenerator.ts`는 음정, 화성, 조성 객관식 문제를 동적으로 생성한다.
- `src/lib/practiceScoreGenerator.ts`는 선율, 리듬, 2성부 기보형 문제를 동적으로 생성한다.
- `src/screens/HomeScreen.tsx`는 일일 목표, 모의시험, 통계, 카테고리 카드를 노출한다.
- `src/screens/DailyGoalScreen.tsx`는 5개 카테고리 완료 루프와 마스코트 EXP 보상을 이미 갖고 있다.
- `src/screens/ChoicePracticeScreen.tsx`는 정답/오답 피드백은 있지만 해설과 학습 모드가 없다.
- `src/screens/NotationPracticeScreen.tsx`는 실제 받아쓰기 훈련은 강하지만, 초급자에게는 입력 부담이 먼저 온다.
- `src/screens/OnboardingScreen.tsx`는 앱 소개만 하고, 첫 연습 성공으로 이어지는 학습 진입로는 없다.

현재 구조의 강점은 문제 생성과 채점 엔진이다. 약점은 초급자가 "무엇을 들어야 하는지" 배우기 전에 바로 문제를 풀어야 한다는 점이다.

## 외부 패턴 참고

`musictheory.net`은 귀 훈련을 note, interval, scale, chord처럼 아주 작은 식별 단위로 쪼갠다.

`teoria.com`은 최신 연습에 rhythmic dictation using patterns, harmonic progressions using patterns처럼 패턴 기반 받아쓰기를 둔다.

`EarMaster`는 음정 학습에서 익숙한 노래를 기준점으로 쓰는 방식을 소개한다. 단, 스스로도 이 방식은 암기 보조이고 최종 목표는 즉각적 인식이라고 설명한다.

MelodyGen에 맞는 방향은 세 가지를 섞는 것이다.

- 아주 작은 단위로 시작한다.
- 패턴을 먼저 들려준다.
- 익숙한 비유는 쓰되, 앱 안에서는 반복 청취와 즉각 피드백으로 감각화한다.

## 사용자 문제

초급자는 틀리는 문제가 아니라, 무엇을 틀렸는지 모르는 문제가 더 크다.

예를 들어 `interval_1`은 코드상 기본 음정으로 시작하지만, 초급자 입장에서는 단3도, 장3도, 완전4도, 완전5도, 옥타브가 한꺼번에 나온다. 음악 경험이 적은 사용자는 이것도 이미 어렵다.

리듬도 `rhythm_1`이 2분음표, 4분음표, 4분쉼표부터 시작하지만, 초급자는 "긴 소리와 짧은 소리", "소리와 침묵", "마디 안에서 위치"를 먼저 배워야 한다.

## 제품 목표

- 첫날 3분 안에 "나도 들을 수 있네"라는 성공 경험을 만든다.
- 기존 6개 카테고리로 가기 전, 초급자를 위한 안내 레이어를 만든다.
- 신규 콘텐츠는 로컬 생성 원칙을 지킨다. 서버 API는 쓰지 않는다.
- 기존 문제 생성기와 연습 기록 구조를 최대한 재사용한다.
- Pro 전환을 억지로 밀지 않는다. 초급 코스는 Free 사용자의 잔존율을 올리는 입구로 둔다.

## 제안 콘텐츠: 귀 열기 7일 코스

### Day 1: 소리의 높낮이

목표: 올라감, 내려감, 같음을 구별한다.

형식: 2지선다 또는 3지선다.

예시:

- 같은 음 두 번
- C에서 E로 올라감
- G에서 D로 내려감

기존 연결:

- `questionGenerator.ts`의 음정 생성 로직을 더 쉬운 pre-interval 풀로 확장 가능
- 기존 `ChoicePracticeScreen` 패턴 재사용 가능

### Day 2: 긴 소리와 짧은 소리

목표: 2분음표, 4분음표, 쉼표의 체감 차이를 안다.

형식: 듣고 두 패턴 중 고르기.

예시:

- 길게-길게
- 짧게-짧게-길게
- 소리-쉼-소리

기존 연결:

- `rhythmEngine.ts` 또는 `practiceScoreGenerator.ts`의 리듬 생성을 초급 패턴 고정 세트로 제한
- `NotationPracticeScreen`의 리듬 입력 전 단계로 사용

### Day 3: 3도와 5도 느낌

목표: 가까운 도약과 넓은 도약을 구별한다.

형식: "가까움 / 넓음"부터 시작하고, 마지막에 단3도/장3도/완전5도 이름을 노출한다.

기존 연결:

- `INTERVAL_POOLS.interval_1`보다 더 작은 풀 필요
- 기존 음정 객관식 생성기의 오답 로직 재사용 가능

### Day 4: 장조와 단조 색깔

목표: 밝음/어두움이 아니라 중심음과 3도 색감을 듣는다.

형식: 짧은 멜로디를 듣고 장조/단조 선택.

기존 연결:

- `KEY_TEMPLATES`의 `C_major`, `A_minor`를 그대로 활용
- `key_1`보다 설명을 강화한 튜토리얼 버전

### Day 5: 리듬 패턴 따라잡기

목표: 패턴을 이름보다 몸으로 먼저 인식한다.

형식: 듣고 같은 리듬 카드를 고른 뒤, 한 문제만 직접 입력한다.

기존 연결:

- `NotationPracticeScreen`의 리듬 입력 UI로 마지막 문제를 연결
- 패턴형 리듬 받아쓰기 개념은 teoria의 방향과 잘 맞음

### Day 6: 첫 선율 받아쓰기

목표: 첫 음 힌트를 받고 3음 또는 4음만 입력한다.

형식: 듣기, 스케일 듣기, 첫 음 고정, 나머지 3음 입력.

기존 연결:

- `NotationPracticeScreen`은 이미 첫 음 힌트와 스케일 듣기를 제공한다.
- `generatePracticeScore`에 tutorial용 짧은 마디 옵션이 필요하다.

### Day 7: 미니 졸업 테스트

목표: 음정 2문제, 리듬 2문제, 조성 1문제, 선율 1문제를 아주 짧게 묶는다.

형식: 점수보다 "잘 들은 것 / 다시 들을 것" 리포트.

기존 연결:

- `MockExamScreen`/`ExamResultScreen`의 축소판으로 볼 수 있다.
- 초급 리포트는 통계보다 다음 추천 콘텐츠가 중요하다.

## MVP 범위

가장 작은 좋은 버전은 신규 화면 2개와 로컬 진행 상태 1개다.

- `BeginnerCourseScreen`: 7일 카드 목록, 진행률, 오늘 추천 레슨
- `BeginnerLessonScreen`: 듣기 설명, 미니 문제, 기존 연습으로 연결
- `useBeginnerCourseProgress`: AsyncStorage 기반 완료 상태
- `beginnerCourseConfig.ts`: 7일 코스 정의와 문제 생성 파라미터

이 정도면 기존 문제 생성기와 UI를 해치지 않고 초급자 레이어를 추가할 수 있다.

## 비범위

- 서버 콘텐츠 관리 CMS
- 영상 강의
- 저작권 있는 실제 노래 음원 사용
- 완전한 음악이론 교재
- 고급 사용자용 새 카테고리

지금 필요한 건 콘텐츠 플랫폼이 아니다. 첫 성공 경험이다.

## UX 흐름

### 첫 진입

Home 상단 또는 일일 목표 카드 근처에 `처음이라면: 귀 열기 코스` 카드를 둔다.

카피:

> 악보를 몰라도 괜찮아요. 7일 동안 귀가 먼저 반응하게 만들어 봅시다.

버튼:

> 1일차 시작

### 레슨 화면

각 레슨은 3단계다.

1. 듣는 포인트: 오늘은 "높아지는지 낮아지는지"만 듣는다.
2. 연습 문제: 3~5문제, 짧고 즉시 피드백.
3. 연결 문제: 기존 카테고리의 초급 문제 1개로 연결.

### 완료 후

완료 메시지는 점수보다 다음 행동을 준다.

예시:

> 오늘은 올라감/내려감을 구별했어요. 내일은 긴 소리와 짧은 소리를 들어봅니다.

마스코트 EXP는 소량 지급한다. DailyGoal과 충돌하지 않게 별도 보상 키를 둔다.

## 데이터 설계

콘텐츠 관련 데이터는 프로젝트 원칙대로 AsyncStorage 로컬 저장만 사용한다.

예상 키:

- `@melodygen_beginner_course_progress_${user.id}`
- `@melodygen_beginner_course_last_completed_${user.id}`
- `@melodygen_beginner_course_rewarded_${user.id}`

저장 형태:

```ts
interface BeginnerCourseProgress {
  completedLessonIds: string[];
  currentDay: number;
  lastCompletedAt?: string;
  lessonResults: Record<string, {
    completedAt: string;
    correct: number;
    total: number;
  }>;
}
```

## 구현 후보 파일

- `src/lib/beginnerCourseConfig.ts`: 7일 커리큘럼 정의
- `src/hooks/useBeginnerCourseProgress.ts`: 로컬 진행률 저장
- `src/screens/BeginnerCourseScreen.tsx`: 코스 홈
- `src/screens/BeginnerLessonScreen.tsx`: 레슨 진행
- `src/navigation/MainStack.tsx`: 신규 화면 등록
- `src/screens/HomeScreen.tsx`: 코스 진입 카드 추가
- `src/i18n/locales/{ko,en,ja}/beginner.json`: 문구 추가
- `PROJECT_INDEX.md`: 화면, 훅, 라이브러리 인덱스 업데이트

## 리스크

- 기존 `ChoicePracticeScreen`과 `NotationPracticeScreen`을 그대로 재사용하려고 하면 튜토리얼 UX가 너무 딱딱해질 수 있다.
- 새 화면을 너무 크게 만들면 또 하나의 연습 모드가 되어 제품이 복잡해진다.
- 초급 콘텐츠를 Pro 잠금 뒤에 두면 첫 성공 경험이 사라진다.
- 실제 노래 예시를 넣으면 저작권과 국가별 친숙도 문제가 생긴다. 앱 안에서는 자체 생성 음형을 쓰는 편이 안전하다.

## 추천 실행 순서

1. `beginnerCourseConfig.ts`로 7일 레슨 정의만 먼저 만든다.
2. `BeginnerCourseScreen`에 7일 카드와 진행률을 만든다.
3. `BeginnerLessonScreen`은 처음에는 객관식 미니 문제만 지원한다.
4. Day 6 선율 입력은 두 번째 패스에서 붙인다.
5. 완료 기록을 `usePracticeHistory`에 바로 섞지 말고, 코스 완료 상태로 따로 저장한다.
6. 코스 완료 후 기존 `CategoryPractice`로 연결해서 실제 연습 기록을 남긴다.

## 성공 기준

- 신규 사용자가 첫 세션에서 3분 안에 Day 1을 완료한다.
- Day 1 완료 후 기존 `interval_1` 또는 `rhythm_1`로 자연스럽게 이동한다.
- 초급 코스가 기존 일일 목표와 충돌하지 않는다.
- 모든 콘텐츠는 로컬 생성과 AsyncStorage 저장만 사용한다.
- Free 사용자도 7일 코스를 끝까지 경험할 수 있다.

## 제품 판단

이 기획은 MelodyGen에 잘 맞는다.

지금 앱은 엔진이 이미 있다. 문제는 엔진 앞에 초급자를 앉히는 방식이다. 초급자는 "틀렸습니다"보다 "이렇게 들으면 됩니다"가 필요하다.

귀 열기 코스는 새 콘텐츠처럼 보이지만 실제로는 기존 자산을 초급자 언어로 재포장하는 작업이다. 작고, 제품적으로 선명하고, Free 사용자에게도 가치가 있다.

이게 첫 번째로 만들 콘텐츠다.
