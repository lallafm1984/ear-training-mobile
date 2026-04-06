# 선율/2성부 받아쓰기 — 악보 입력 & 자동 채점 설계

## 목표

선율 받아쓰기와 2성부 받아쓰기의 기존 "자기평가(1~5점)" 방식을 **사용자가 직접 악보를 입력하고 자동 채점되는 방식**으로 변경한다. 핵심은 모바일에서 쉽고 빠르게 음표를 입력할 수 있는 UX이다.

## 범위

- **변경 대상:** melody(선율 받아쓰기), twoVoice(2성부 받아쓰기) 카테고리
- **변경 없음:** rhythm(리듬 받아쓰기 — 이미 인터랙티브), interval/chord/key(객관식)
- **기존 유지:** 문제 생성(generateScore), 재생(AbcjsRenderer), 스킬 프로필(useSkillProfile)

## 아키텍처

네이티브 입력 + WebView 렌더링 하이브리드 방식. 피아노 건반과 음길이/도구 버튼은 React Native 네이티브 컴포넌트로 구현하고, 악보 표시(문제 악보 + 답안 악보)는 기존 ABCJS WebView를 재활용한다.

---

## 1. 사용자 플로우

```
① 문제 생성 → ② 음악 재생 → ③ 악보 입력 → ④ 제출 & 채점 → ⑤ 결과 확인 → ⑥ 다음 문제
```

### ① 문제 생성
- 기존 `generateScore()` 그대로 사용
- 정답 `ScoreNote[]`를 state에 저장하되 화면에는 숨김

### ② 음악 재생
- 정답 악보를 ABC로 변환 → 기존 AbcjsRenderer로 재생
- 재생 횟수 무제한 (연습 모드)
- 화면에는 빈 오선지 + 조표/박자표 + 첫 번째 음표 힌트만 표시

### ③ 악보 입력
- 음길이 선택 → 피아노 건반 탭 → 음표 추가 → ABC 변환 → 실시간 렌더링
- 상세 입력 규칙은 아래 "입력 시스템" 섹션 참조

### ④ 제출 & 채점
- 정답 ScoreNote[]와 사용자 ScoreNote[]를 정규화 후 비교
- 리듬 등가 처리 포함 (붙임줄 ↔ 점음표)
- 상세는 아래 "채점 시스템" 섹션 참조

### ⑤ 결과 확인
- 문제 악보(위) + 내 답안(아래) 나란히 표시
- 양쪽 악보 모두 틀린 음표에 색상 표시
- 정확도 %, 정답/부분정답/오답 개수

### ⑥ 다음 문제
- 정확도 → selfRating 자동 변환 → 기존 `applyEvaluation()` 호출
- 다음 문제 생성 또는 연습 종료

---

## 2. 화면 레이아웃

### 선율 받아쓰기 (위→아래)

| 영역 | 설명 |
|------|------|
| 컨트롤바 | 난이도/조성/박자 표시, 재생 버튼, 제출 버튼 |
| 답안 악보 (WebView) | 빈 오선지 + 첫 음 힌트, 입력한 음표가 실시간 렌더링 |
| DurationToolbar | 음길이 버튼 + 도구 버튼(♯/♭/붙임줄/쉼표/Undo/Clear) |
| PianoKeyboard | C3~C6 스크롤 가능 건반 |

### 2성부 받아쓰기

- 답안 악보가 대보표(Grand Staff)로 표시
- 활성 성부가 시각적으로 강조 (테두리 색상)
- 비활성 성부를 탭하면 전환
- 건반 초기 위치가 성부에 따라 자동 이동 (트레블: C4 중심, 베이스: C3 중심)

---

## 3. 입력 시스템

### 3.1 피아노 건반 (PianoKeyboard)

- **범위:** C3 ~ C6 (3옥타브, 흰건 22개 + 검은건 15개)
- **표시:** 약 10~12건이 화면에 보이고, 나머지는 좌우 스크롤 (ScrollView horizontal)
- **초기 위치:** 선율은 C4 중심, 2성부 베이스는 C3 중심
- **탭 피드백:** 건반 색상 하이라이트 + 해당 음 짧게 미리듣기
- **검은 건반:** 흰건 사이 위쪽에 짧은 검은 건반 배치 (실제 피아노 비율)

### 3.2 음길이 & 도구 버튼 (DurationToolbar)

**음길이 버튼 (하나만 선택, 선택 상태 유지):**
- 온음표, 2분음표, 4분음표, 8분음표, 16분음표, 점음표

**도구 버튼:**
- ♯ 올림 / ♭ 내림 — 일회성 토글, 다음 건반 탭에 적용 후 자동 OFF
- 붙임줄 — 토글 ON 후 건반 탭 시 이전 음표와 tie 연결
- 쉼표 — 탭 시 선택된 음길이의 쉼표 즉시 추가 (건반 탭 불필요)
- Undo — 마지막 입력 음표 제거
- Clear — 전체 초기화

### 3.3 입력 동작 규칙

| 동작 | 규칙 |
|------|------|
| 기본 음표 입력 | 음길이 선택 상태에서 건반 탭 → ScoreNote 추가 |
| 점음표 | "점" 버튼 토글 ON → 다음 건반 탭 시 점음표로 입력 → 자동 OFF |
| 임시표 (버튼) | ♯/♭ 토글 ON → 흰건반 탭 시 반음 올림/내림 적용 → 자동 OFF |
| 임시표 (검은건) | 검은 건반 직접 탭 → 조표 컨텍스트에 따라 ♯/♭ 자동 결정 |
| 쉼표 | "쉼표" 버튼 탭 → 선택된 음길이의 쉼표 즉시 추가 |
| 붙임줄 | "붙임줄" 토글 ON → 다음 건반 탭 시 이전 음표와 tie 연결 (같은 음높이) |
| Undo | 마지막 입력 음표 제거 |
| 음표 탭 선택 | 악보에서 음표 탭 → 선택 상태 → 삭제 또는 교체 가능 |
| 마디 초과 방지 | 현재 마디의 남은 박자보다 큰 음길이는 버튼 비활성화 |

---

## 4. 채점 시스템

### 4.1 정규화 파이프라인

```
ScoreNote[] → 붙임줄 합산 → NormalizedNote[] → 순서 비교
```

**NormalizedNote 타입:**
```typescript
interface NormalizedNote {
  pitch: string;           // "C4", "D#5", "rest"
  totalDuration: number;   // 16분음표 단위 (♩=4, ♪=2, 𝅗𝅥=8, 𝅝=16)
  sourceIndices: number[]; // 원본 ScoreNote 인덱스 (색상 매핑용)
}
```

**정규화 규칙:**
- 같은 pitch로 tie 연결된 연속 음표들을 하나의 NormalizedNote로 합산
- 점음표는 총 음가로 변환 (♩. = 6/16)
- 쉼표는 pitch를 "rest"로 설정

### 4.2 리듬 등가 처리

| 문제 | 답안 | 정규화 음가 | 판정 |
|------|------|------------|------|
| ♩ + ♪ (tie) | ♩. (점4분) | 6/16 = 6/16 | 정답 |
| ♩. (점4분) | ♩ + ♪ (tie) | 6/16 = 6/16 | 정답 |
| 𝅗𝅥 + ♩ (tie) | 𝅗𝅥. (점2분) | 12/16 = 12/16 | 정답 |
| ♪ + 𝅘𝅥𝅯 (tie) | ♪. (점8분) | 3/16 = 3/16 | 정답 |

### 4.3 비교 및 판정

NormalizedNote[] 배열을 인덱스별로 순서 비교:

| 판정 | 조건 | 색상 |
|------|------|------|
| 정답 | pitch 일치 AND totalDuration 일치 | 초록 (#22dd44) |
| 부분 정답 | pitch만 일치 OR totalDuration만 일치 | 주황 (#e67e22) |
| 오답 | pitch, totalDuration 모두 불일치 | 빨강 (#e74c3c) |
| 누락/초과 | 음표 개수 차이 | 빨강 (#e74c3c) |

### 4.4 점수 → 스킬 프로필 연동

| 정확도 | selfRating |
|--------|-----------|
| 90% 이상 | 5점 |
| 70% 이상 | 4점 |
| 50% 이상 | 3점 |
| 30% 이상 | 2점 |
| 30% 미만 | 1점 |

정확도 계산: 정답=1.0, 부분정답=0.5, 오답=0.0의 평균

변환된 selfRating으로 기존 `applyEvaluation()` 호출 → 레벨 상향 자동 처리

---

## 5. 컴포넌트 아키텍처

### 새로 생성할 컴포넌트/훅

| 파일 | 역할 |
|------|------|
| `src/components/PianoKeyboard.tsx` | C3~C6 스크롤 가능 피아노 건반 |
| `src/components/DurationToolbar.tsx` | 음길이 + 도구 버튼 바 |
| `src/components/ScoreDisplay.tsx` | 문제/답안 악보 표시 (AbcjsRenderer 래퍼) |
| `src/hooks/useNoteInput.ts` | 음표 입력 상태 관리 (userNotes[], duration, tools, activeVoice) |
| `src/lib/grading.ts` | 정규화 + 채점 로직 |

### 2성부 성부 전환 상세

`useNoteInput` 훅이 `activeVoice: 'treble' | 'bass'` 상태를 관리한다:
- 트레블/베이스 각각 독립적인 `ScoreNote[]` 배열 보유 (`trebleNotes`, `bassNotes`)
- 건반 탭 시 `activeVoice`에 해당하는 배열에 음표 추가
- 성부 전환 시 건반 스크롤 위치 자동 이동 (트레블: C4 중심, 베이스: C3 중심)
- 채점도 성부별 독립 수행 → 합산 정확도

### 악보 탭 인터랙션 (WebView ↔ RN 통신)

답안 악보 WebView에서 음표/성부를 탭할 때의 통신 방식:
- WebView 내 ABCJS 렌더링된 SVG 음표에 클릭 이벤트 리스너 등록
- 음표 탭 시 `window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'noteSelect', index: N }))` 전송
- 성부(보표) 탭 시 `{ type: 'voiceSelect', voice: 'treble' | 'bass' }` 전송
- RN 측 `onMessage` 핸들러에서 수신하여 `useNoteInput` 상태 업데이트
- 선택된 음표는 WebView에 `injectJavaScript`로 하이라이트 스타일 적용

### 수정할 파일

| 파일 | 변경 |
|------|------|
| `src/screens/NotationPracticeScreen.tsx` | melody/twoVoice에서 자기평가 UI → 입력+채점 UI로 분기 |

### 기존 유지 (변경 없음)

| 파일 | 역할 |
|------|------|
| `src/lib/scoreGenerator.ts` | 문제 악보 생성 |
| `src/components/AbcjsRenderer.tsx` | ABC 렌더링 + 재생 |
| `src/lib/scoreUtils.ts` | ABC 변환, 유틸리티 |
| `src/hooks/useSkillProfile.ts` | 스킬 프로필 관리 |
| `src/hooks/usePracticeHistory.ts` | 연습 기록 저장 |

---

## 6. 결과 화면

- 문제 악보(위) + 내 답안(아래) 나란히 표시
- 양쪽 악보 모두 틀린 음표에 색상 오버레이 (sourceIndices로 매핑)
- 정확도 %, 정답/부분정답/오답 개수 표시
- "다시 듣기" 버튼으로 정답 악보 재생 가능
- "다음 문제" / "연습 종료" 버튼
