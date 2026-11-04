# MelodyGen 2.0 작업 인수인계 (2026-11-04)

다른 개발 세션(Codex 등)이 2.0 업데이트 작업을 그대로 이어가기 위한 현재 상태 기록이다. 코드 구조는 `PROJECT_INDEX.md`, 작업 규칙은 `CLAUDE.md`·`AGENTS.md`가 기준이고, 이 문서는 "지금 어디까지 왔고, 무엇이 남았고, 어떤 결정이 내려졌는지"만 다룬다.

## 0. 먼저 읽을 것 · 시작 체크리스트

1. `CLAUDE.md`, `AGENTS.md`, `PROJECT_INDEX.md`를 먼저 읽는다. 파일을 찾을 때는 항상 `PROJECT_INDEX.md`부터 본다.
2. 작업 브랜치는 **`claude/project-thread-6dd7sm`** (PR #12, base `master`). 다른 브랜치에 푸시하지 않는다.
3. 맥북 작업 경로는 **`/Users/lim/melodygen-build/ear-training-mobile-2.0`** (git worktree, 영문 경로). `/Users/lim/Desktop/프로젝트/ear-training-mobile`(브랜치 `sync/v58-local-snapshot`, 라이브 1.1.3 소스, 추적되지 않는 `outputs/` 포함)은 **건드리지 않는다.**
4. 시작 시 아래를 돌려 기준 상태를 확인한다.

```bash
git fetch origin claude/project-thread-6dd7sm && git pull --ff-only origin claude/project-thread-6dd7sm
npm install
npx tsc --noEmit && npm run lint && npm run format:check && npm test
```

기대값: TypeScript 오류 0, ESLint 오류 0, Prettier 통과, Jest **34 스위트 / 476개** 통과.

## 1. 현재 상태 한눈에

| 항목 | 상태 |
| --- | --- |
| 라이브 버전 | 1.1.3 / Android versionCode 62 (소스 = 브랜치 `sync/v58-local-snapshot`, 커밋 3a1a283). 원격 `master`(e5858fe, versionCode 52)는 더 오래된 상태 |
| 2.0 브랜치 HEAD | UI·콘텐츠 수정 이후 운영 DB `02e3936`, R8 `10e3ab6`, 알림 호환·빌드 `ec6bb58` (`claude/project-thread-6dd7sm`), PR #12 https://github.com/lallafm1984/ear-training-mobile/pull/12 (오픈, 미머지) |
| 앱 버전 | `app.json` version **2.0.0**, android.versionCode **72** |
| 출시 후보 AAB | `build/melodygen-android-v72.aab` (2.0.0/72, 66.9MiB, SHA-256 `6e2639f1187b7d957c0921130ee416522b20870f8a7775eea32406e77e6e8669`, 소스 `ec6bb58`). Windows 최종 보관본과 해시 일치, 상세는 13장. v71 이하는 최신 후보가 아님 |
| 코드 | ✅ tsc / eslint / prettier 통과 |
| 테스트 | ✅ Jest 34 스위트 476개. 이전 abcjs 실제 렌더 기록은 2,440 + 361 + 450 문항. 이번 추가 검증은 12장 |
| 빌드 | ✅ v72 AAB·APK 빌드·Windows 복사, upload 서명 검증, AAB의 `jarsigner`·Supabase 호스트·R8 3개 지표 25% 이상 확인 (13장) |
| 운영 DB | ✅ profiles RLS·종료 프로모션 비활성화 2건 적용·검증. 구독 보호 트리거 1건은 웹훅 연결 확인 전 보류 (`docs/PROFILES_RLS_20261103.md`) |
| 스토어 | ❌ 문구만 준비(`store/android/listing.md`). AAB 업로드·스크린샷·출시 노트 등록 미진행 |
| 실기기 | ⚠️ Galaxy S25에서 리듬 탭 신호·언어 선택/취소/적용/재시작 유지 확인. 알림 권한·OS 예약 확인. 나머지는 7·12장 |

## 2. 환경 사실 (맥북)

- Node 24.18 / Temurin JDK 17 / `ANDROID_HOME=/Users/lim/Library/Android/sdk` / bundletool 없음.
- **EAS에 로그인되어 있지 않다** (`npx eas-cli@latest whoami` → Not logged in, `.env.local`에 `EXPO_TOKEN`도 없음). 그래서 `npm run android:build:local`(EAS)은 쓸 수 없고 `npm run android:build:gradle`(EAS 없는 prebuild + Gradle)을 쓴다.
- 서명 정보는 워크트리의 `.env.local`(`MELODYGEN_ANDROID_KEYSTORE_PATH / KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD`)과 `credentials/android/melodygen-upload-20260630.jks`(upload key). **비밀값은 출력·기록·커밋하지 않는다.** 두 파일 모두 gitignore 대상이다.
- **한글 경로에서는 빌드가 실패한다.** `~/Desktop/프로젝트/...`에서는 Gradle `createBundleReleaseJsAndAssets`가 "Unable to resolve module .../index.ts"로 실패했다(2026-08 릴리스도 같은 이유로 영문 임시 경로 사용). 반드시 영문 경로 워크트리에서 빌드한다.
- 생성 폴더 `android/`, 산출물 `build/`, `credentials.json`은 gitignore다. 빌드 뒤 커밋할 변경은 `app.json`의 versionCode 한 줄만이어야 한다.

## 3. 2.0에서 바뀐 것 (커밋 순)

### 3.1 기능 (2026-11-03)

| 커밋 | 내용 |
| --- | --- |
| 1859148 | 게스트 모드 – 로그인 없이 시작, 로컬 데이터를 소유자별 키로 분리, 로그인 시 게스트 데이터 병합 이관 |
| b08319f | 객관식 정답 해설 + 내 답/정답 비교 듣기 |
| 1768088 | 귀 열기 7일 코스 (`BeginnerCourse`/`BeginnerLesson`, 설계 `docs/BEGINNER_EAR_OPENING_COURSE_DESIGN.md`) |
| 724a945 | profiles RLS·구독 컬럼 보호 마이그레이션 추가 (현재 적용 범위는 6장) |
| fee985a | 3분 레벨 테스트 → 시작 난이도 추천 |
| 5ee748d | 매일 연습 리마인더 (expo-notifications 로컬 알림, 알림 아이콘) |
| fdbafbf | 오답노트·약점 집중 연습 |
| 3223ffa | 결과 공유 카드 (react-native-view-shot + expo-sharing) |
| d37930f | 새 콘텐츠 2종: 음계·선법 듣기, 리듬 탭 → 콘텐츠 8종에서 10종 |
| 8e17b9d | 마스코트 갤러리 공개, 일일 목표 7종 |
| 4363a1c | 태블릿 레이아웃 (콘텐츠 760dp 가운데 정렬, 모달/시트/폼 폭 상한) |
| 1218878 | 스토어 문구·README·TODOS·버전 2.0.0 |

### 3.2 QA 라운드 (2026-11-03~04)

| 커밋 | 내용 |
| --- | --- |
| 0007ed0 | 콘텐츠 QA(청음 시험 기준): 선율 큰 도약, 2성부 종지·병행, 화성진행 ♭조 철자 버그, 조성 기준음, 리듬 쉼표 규칙. 최종 안전망 `scoreGenerator/finalSanity.ts`, 규칙 테스트 `contentQaRules.test.ts` |
| dd92559 | QA 1차: 일일 목표 집계 `lib/dailyGoal.ts` 통일, 네이티브 Alert → `useAlert`, 뒤로가기 보호, 태블릿 폭 |
| ac563b2 | QA 2차: 날짜 로케일 `i18n.language`, 닉네임 모달 폭, 홈 카드 폰 3열·태블릿 5열 |
| 5363d26 | QA 3차: ErrorBoundary 다국어, 13개 화면 아이콘 버튼 접근성 라벨 |
| 8915b05 | 복합박자(6/8·9/8) 셋잇단 레벨 → 둘잇단(2:3) 출제. `ScoreEditor`는 MainStack에서 제외해 숨김(코드 보존, 삭제 여부는 Lim 결정 대기) |
| 29b7a11 | Milne 교재 대조 문구 수정 3건(트라이톤 라벨, I-vi-ii-V 해설, 변격종지 해설) |

### 3.3 교재 검토 후속 · 추가 콘텐츠 (2026-11-04)

| 커밋 | 내용 |
| --- | --- |
| ca8120f | 화성진행·종지 재생을 4성부(SATB) 성부 배치 엔진 `lib/progressionVoicing.ts`로 교체 (병행 5·8도 금지, 이끔음 상행, PAC 소프라노 1̂) |
| f382097 | 화음 듣기 4단계: 3화음 제1·제2전위 |
| 02d20f0 | 악보 생성 다양성 (복합박자 선율 리듬, 종지 음가, 2성부 베이스 리듬 변형) |
| 985f1a3 | 음정 5(화성 음정)·6(복합음정 m9~M13), 리듬 탭 5(3/4)·6(6/8), 음계 5(상행·하행) |
| 5b0a025 | 화성 진행 5(종지 세분화 PAC/IAC/HC/DC)·6(기능 진행 ii6·V7·I6·iv6·ii°6)·7(로마숫자 화음 판별). 엔진에 전위·7화음·마지막 소프라노 제어 |
| 744ed6b | 2.0 추가 난이도 무료/Pro 범위 적용, NEW 배지, 요금제 비교표 자동 생성, 통계 카테고리 분석(`computeInsights`), 데이터 보존 회귀 테스트 |

### 3.4 출시 정리 · 빌드 (2026-11-04)

| 커밋 | 내용 |
| --- | --- |
| b2b31d6 | versionCode 62→63 (첫 AAB, 수동 prebuild+Gradle, 폐기) |
| 6c00fb0 | `npm run android:build:gradle` 스크립트(`scripts/buildAndroidReleaseGradle.mjs`) + `docs/LOCAL_ANDROID_BUILD_MAC.md` "EAS 로그인 없이 빌드" |
| 9a84025 | 9~10월 수험생 전원 Pro 무료 프로모션의 클라이언트 판정 제거 (`promotionConfig.ts`·테스트·i18n 삭제, `SubscriptionContext` 정리) + 프로모션 행 비활성화 마이그레이션 |
| 6dacd6c | versionCode 63→64 (출시 후보 AAB) |
| 9804319 | 빌드 문서 갱신 |

## 4. 설계 결정 · 규약 (반드시 유지)

- **데이터 원칙(CLAUDE.md):** 로그인·프로필·구독 상태만 Supabase. 연습 기록·실력 프로필·시험 결과·오답노트·코스 진행·레벨 테스트 결과는 AsyncStorage 로컬 전용. 문제·악보는 클라이언트에서 동적 생성.
- **기존 사용자 데이터 보존:** 로컬 키는 1.1.x와 같은 `<base>_<userId>` 형식(`localProfileStorage.ts`의 `localDataKey`). 저장 형태(UserSkillProfile·PracticeRecord·ExamRecord·mascot) 불변. 2.0 신규 키(`_guest`, wrong_notes, level_test, beginner_course, reminder)는 추가만. 로컬 키 삭제는 회원 탈퇴 때만. 회귀 테스트 `localProfileStorage.test.ts` "기존 사용자 데이터 보존".
- **무료/Pro 범위:** 2.0 추가 난이도는 전부 기존 `freeMaxLevel` 뒤에 붙어 **Pro 전용**, 무료 범위는 1.1.x와 동일. 근거 코드 `contentConfig.ts`(`NEW_CONTENT_DIFFICULTIES`, `freeMaxLevel`), 표 `docs/CONTENT_SCOPE_2_0.md`. 요금제 비교표(PaywallScreen)는 `CONTENT_CATEGORIES`에서 자동 생성한다(하드코딩 금지).
- **난이도를 추가할 때 4단계:** (1) `types/content.ts` 타입·`contentConfig.ts` 라벨 맵·maxLevel(테스트가 목록 길이와 대조) (2) ko/en/ja 라벨·해설·안내문 (3) `NEW_CONTENT_DIFFICULTIES` 등록 (4) 기존 id·순서 불변. 레벨 테스트·입문 코스·모의시험 프리셋은 기존 난이도만 쓴다.
- **로마숫자 토큰(`questionGenerator.ts` `parseRomanToken`):** 접미 6/64 = 전위, 7/65/43/42 = 7화음, ° = 감화음. 진행 템플릿 kind: progression · cadence(2·4단계) · cadenceDetail(5) · roman(7). 라벨 네임스페이스 `content:progression` / `content:cadence` / `content:roman`.
- **잇단음표 규약:** 복합박자(6/8·9/8)는 셋잇단 대신 둘잇단(2:3, ABC `(2:3:2`). 그룹 첫 음에 `tuplet`/`tupletSpan`/`tupletNoteDur`, 나머지 음의 `tupletNoteDur` 합이 span(셋잇단 [2,1,1], 둘잇단 [2,4]). 테스트 `compoundTuplet.test.ts`.
- **성부 배치 엔진(`progressionVoicing.ts`):** 화성 콘텐츠를 만질 때는 반드시 이 엔진으로 재생 ABC를 만든다. `ChordSpec {intervals; bassMember?}`, 7화음은 7음 2도 하행 해결, `finalSopranoMembers`로 PAC/IAC 구분. 검증 `progressionVoicing.test.ts`, 큰보표 파서는 `contentQaRules.test.ts`.
- **프로모션:** 날짜 기반 전원 Pro 무료 캠페인은 종료·제거됨. 새 캠페인이 필요하면 2.0 클라이언트에 별도 구현이 필요하다. DB의 `app_promotions`/`is_promotion_active`는 빌드 62 이하 호환용으로만 남긴다.
- **UI 기본 규약:** 새 화면은 `useResponsiveLayout`(태블릿), `useAlert`(네이티브 Alert 금지), 아이콘 버튼 `accessibilityRole/Label`, i18n ko/en/ja 3개 언어 동시 추가, 날짜 포맷은 항상 `i18n.language`. 다크모드·iOS·연간 구독은 **범위 제외**(Lim 결정).
- **이론 기준:** 교재는 Andre Mount, *Fundamentals, Function, and Form*(Milne Open Textbooks). 콘텐츠 정확성 판단은 이 교재와 실제 청음 시험 출제 관행을 따른다.

## 5. 빌드 · 배포 절차

```bash
# 영문 경로 워크트리에서
npm run android:build:gradle -- --clean      # versionCode +1 → prebuild → :app:bundleRelease → build/melodygen-android-v<N>.aab
npm run android:build:gradle -- --apk --no-bump   # 실기기 설치용 APK, 버전 유지
```

- 스크립트는 `.env.local` 서명 값을 환경 변수로만 Gradle에 넘기고, `eas.json` `build.production.env`의 `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`를 번들에 넣는다(이 단계가 없으면 로그인이 안 되는 번들이 만들어진다). 끝나면 산출물 인증서 SHA-256(기대값 `f8364c66ad87f18c0a5febe4f00527f657f895cb4072b2f3c9951c196b7415a8` = upload 인증서), `jarsigner -verify`, 번들 내 Supabase 호스트, 파일 SHA-256을 출력한다. 이 값들이 다르면 업로드하지 않는다.
- 빌드 뒤 커밋은 `app.json` versionCode 한 줄만. 메시지 예: `Android versionCode 65 (2.0.0 릴리스 AAB)`.
- Play Console 절차는 `store/android/RELEASE_GUIDE.md`, 등록 문구·출시 노트는 `store/android/listing.md`. 내부 테스트 트랙 → 검증 → 프로덕션 순서. Play App Signing을 쓰므로 로컬 AAB는 upload 키로 서명되고 Google이 재서명한다(`docs/LOCAL_ANDROID_BUILD_MAC.md`).
- 2.0에는 새 네이티브 모듈(expo-notifications, react-native-view-shot)이 있어 **개발 클라이언트도 새로 빌드**해야 한다(`eas.json` development 프로필 또는 `npx expo run:android`).

## 6. 운영 Supabase 마이그레이션 적용 현황

2026-11-04 사용자 승인 후 **1·2번 적용 완료**. 역할별 접근·구독 캐시 갱신은 ROLLBACK 트랜잭션으로 검증했고, 빌드 62·67 × ko/en/ja 앱 제어 응답 해시는 적용 전후 동일하다. 운영 이력은 `20261104073459/enable_profiles_rls`, `20261104073628/end_admissions_promotion`. 아래 3번만 보류이며, 상세 결과는 `docs/PROFILES_RLS_20261103.md`의 운영 적용 결과를 따른다.

운영 프로젝트 ref `xcxlqeaenpsnnxphedci`. 적용은 Supabase 대시보드 SQL Editor에서 파일 내용을 실행하거나, CLI를 쓸 수 있으면 `supabase link` 후 적용한다. 자세한 배경·검증·롤백은 `docs/PROFILES_RLS_20261103.md`.

| 순서 | 파일 | 적용 조건 | 점검 결과 |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20261103120000_enable_profiles_rls.sql` | **즉시 적용 가능** | 라이브 1.1.3(3a1a283)·2.0 모두 `profiles`를 본인 행(`id = auth.uid()`)만 select/insert/update/delete 한다. `revenuecat-webhook`은 service_role로 RLS 우회, `delete_own_account`는 security definer. 앱 동작 변화 없음 |
| 2 | `supabase/migrations/20261104100000_end_admissions_promotion.sql` | **즉시 적용 가능** | 기간이 2026-10-01에 끝나 이미 비활성인 프로모션·공지 행을 `enabled=false`로 고정 |
| 3 | `supabase/migrations/20261103120100_protect_profiles_subscription_columns.sql` | `revenuecat-webhook` Edge Function이 배포돼 있고 RevenueCat 대시보드 Webhook URL이 연결된 경우에만 | 클라이언트는 `SubscriptionContext`가 RevenueCat 결과를 `profiles.tier`에 캐시로 쓰는데, 트리거가 이를 무시하므로 웹훅이 없으면 DB tier 캐시(RevenueCat 실패 시 폴백)가 갱신되지 않는다. 웹훅 배포 여부를 먼저 확인할 것 |

적용 후 확인 SQL:

```sql
select relrowsecurity from pg_class where oid = 'public.profiles'::regclass;  -- true
select policyname, cmd from pg_policies where tablename = 'profiles';          -- 4개
select id, enabled, ends_at from public.app_promotions;                         -- admissions_support_2026 false
```

그 뒤 앱에서 로그인 → 표시 이름 변경 → 로그아웃/재로그인 → 회원 탈퇴 흐름을 한 번씩 확인하고, Security Advisor에서 `rls_disabled_in_public`이 사라졌는지 본다.

## 7. 남은 일 (우선순위 순)

1. **실기기 검증 확대** (13장의 최신 AAB 또는 `--apk --no-bump` APK). 특히:
   - 리듬 탭 클릭 트랙 동기화(4/4·3/4·6/8), 6/8 강박 점 표시, 허용 오차 체감
   - 공유 카드 캡처·공유 시트(view-shot)
   - 리마인더 알림 권한 요청·예약·수신(앱이 포그라운드일 때는 표시되지 않는 것이 의도된 동작)
   - 화성진행 4성부 재생 음량·속도, 6/8 둘잇단 입력·재생
   - 태블릿 레이아웃(가운데 정렬, 모달 폭), 통계 화면 새 섹션, NEW 배지, 요금제 비교표
   - 게스트 → 로그인 데이터 이관, 1.1.3 설치 위에 덮어 설치 시 기존 기록 유지
2. **Play Console** 내부 테스트 트랙에 13장의 최신 AAB 업로드 → DEX 지표·업데이트 검증 → 프로덕션. 스토어 문구·스크린샷·출시 노트 갱신.
3. **운영 DB** 1·2는 적용 완료. RevenueCat 웹훅 연결·실제 수신 확인 후 3(구독 보호 트리거)만 검토 (6장).
4. **QA 반복 루프 유지**(Lim 상시 지시): 디자인·코드·사용자·콘텐츠 관점으로 점검 → 수정 → 재점검을 반복하고 PR #12 설명의 라운드 표에 커밋을 추가한다.
5. 결정 대기: `ScoreEditor` 완전 삭제 여부(현재 숨김만). `TODOS.md` 1번(계정 삭제 Edge Function)은 `delete_own_account` RPC(security definer) 도입으로 해소된 것으로 보이나 운영 DB에 함수가 존재하는지 확인해 TODOS를 갱신할 것.

## 8. 알고 있는 한계 · 주의

- 2성부 4단계 병행 1/40 잔존, 화음 객관식은 조표 없이 ♯ 철자(소리는 정확), 부분 연습은 설정을 바꾸지 않으면 항상 C장조·4/4(조성 랜덤은 후속 과제).
- 화면 전반에 하드코딩 hex 색상이 많다(COLORS 토큰 미사용). 다크모드 제외 결정으로 보류.
- `expo-notifications`에 `setNotificationHandler`가 없어 포그라운드 알림은 표시되지 않는다(의도된 허용).
- `contentQaRules.test.ts`의 간헐 `repeat3` 실패는 F장조 6/8·bass_4/시드 463으로 재현했다. 반복 구간 마지막 음의 화성 제약 때문에 대체 후보가 없던 경우였고, 앞선 두 반복음도 기존 제약 안에서 검사하도록 `0163bcc`에서 수정했다. 고정 시드 회귀 테스트와 전체 검사가 통과했다. 별도로 알려진 병행 잔존 한계는 이번 점검에서 해소했다고 주장하지 않는다.
- `npm audit`에서 취약점 다수 보고(의존성 트리, 미조치).

## 9. 작업 규칙 (Lim 요구사항 요약)

- 언어는 한국어. 품질 우선, 교재 기준 이론 정확성, 실제 청음 시험 관행 준수.
- **서비스 중인 1.1.3에 영향을 주지 않는다**: 별도 브랜치·PR, 라이브 DB 변경은 라이브 클라이언트 코드(3a1a283)와 대조한 뒤에만.
- 파일 추가·이동·삭제, 기능-파일 매핑, 테스트 수가 바뀌면 `PROJECT_INDEX.md`를 같은 커밋에서 갱신한다.
- 악보 생성 로직을 바꾸면 `contentQaRules.test.ts`·`compoundTuplet.test.ts`를 반드시 돌리고, 큰 변경은 10장 하네스로 재검증한다.
- 임시 프로브 테스트(`src/__tests__/__probe_*.test.ts` 등)와 QA 하네스는 커밋하지 않는다.
- 보고는 코드 / 테스트 / 빌드 / DB / 스토어 / 실기기 완료 상태를 각각 구분한다.
- 비밀값(키스토어 비밀번호·alias, 토큰)은 어떤 문서·로그·커밋에도 넣지 않는다. `eas.json`의 Supabase anon 키는 공개 키라 예외.
- Prettier 범위는 `src/`(`npm run format:check`). 커밋 메시지는 한국어, 기능 단위.

## 10. 검증 방법 (재사용)

- **콘텐츠 하네스:** 임시 Jest에서 카테고리·난이도·박자별 40회 생성 → 규칙 검사(도약·반복·강박 불협화·병행·음역) → ABC를 덤프해 Playwright에서 `assets/abcjs-basic-min.js`를 로드하고 `renderAbc`+`setTiming`으로 경고·마디 길이·음높이 검증. 결과만 테스트(`contentQaRules.test.ts` 등)로 고정하고 하네스는 커밋하지 않는다.
- **i18n:** ko/en/ja 키 패리티 검사 + 코드의 정적 `t('ns:key')` 존재 검사(동적 접합 키는 제외). JSX 안 한글 리터럴 grep.
- **UI 규약 grep:** `Alert.alert` 사용 화면, `useResponsiveLayout` 미사용 화면, `toLocaleDateString('ko-KR')` 고정.
- **데이터 보존:** 라이브 스냅샷 `git show 3a1a283:src/lib/localProfileStorage.ts` 등과 키 생성식을 대조.

## 11. 참고 문서

- PR #12: https://github.com/lallafm1984/ear-training-mobile/pull/12 (커밋별 요약·검증 상태 표를 계속 갱신)
- `docs/CONTENT_SCOPE_2_0.md` — 무료/Pro 범위표, 데이터 보존 근거
- `docs/PROFILES_RLS_20261103.md` — RLS 배경·적용·검증·롤백
- `docs/LOCAL_ANDROID_BUILD_MAC.md` — 맥 로컬 빌드(EAS / Gradle 두 경로), 인증서 지문
- `docs/APP_CONTROL_SUPABASE.md` — 강제 업데이트·원격 공지·프로모션 운영(종료 안내 포함)
- `docs/APP_CONTROL_RELEASE_HANDOFF_20260822.md`, `docs/NOTATION_SCREEN_FIX_20260831.md` — 1.1.x 릴리스 기록
- `docs/BEGINNER_EAR_OPENING_COURSE_DESIGN.md` — 귀 열기 코스 설계
- `store/android/listing.md`, `store/android/RELEASE_GUIDE.md` — 스토어 문구·출시 절차
- `TODOS.md` — 남은 일 목록(7장과 함께 갱신할 것)


## 12. Codex 추가 QA·사용자 피드백 반영 (2026-11-04)

### 코드

| 커밋 | 내용 |
| --- | --- |
| `b638689` | 리듬 탭 6/8 클릭 트랙 분모 고정(4) 제거, 탭 전환 시 예약 정답 재생 취소. 계정 삭제 RPC 실패 시 프로필·로컬 데이터·로그인 보존. 온보딩·서비스 소개의 오래된 6개 카테고리 문구 갱신 |
| `4059b99` | 준비(회색) → 입력(진한 주황색·큰 “지금 탭하세요!”) 전환 강조, 마지막 박 뒤 다음 마디 1 대신 입력 종료 표시. 언어 설정을 3개 라디오 옵션 선택 → 적용 방식으로 변경(취소·뒤로가기 시 현재 언어 유지) |
| `0163bcc` | 2성부 동일음 3회 반복 간헐 실패의 고정 시드 재현·수정 |
| `b676f16` | Android versionCode 67 출시 후보 |

- `tsc --noEmit`, ESLint, Prettier 통과. Jest **34 스위트/476개** 통과.
- `rhythmTapScreen.test.ts`: 4/4·3/4·6/8 클릭 간격·카운트인·취소, 자동 재생 충돌, 마지막 박 이후 숫자 재시작 방지.
- `languagePickerModal.test.ts`: 현재 선택, 적용 전 보류, 취소·뒤로가기, 오류 재시도, 연속 적용 방지.
- `authContext.test.ts`: RPC 실패 시 보존, 서버 성공 후 로컬 정리 순서, 게스트 삭제 차단.
- 수정 전 코드에서 새 회귀 테스트의 실패를 확인했고, 수정 후 통과했다. 콘텐츠 시드 463도 수정 전 실패/수정 후 통과를 확인했다.
- 실제 WebView 클릭 예약 코드의 4/4(750ms)·3/4(714.286ms)·6/8(326.087ms) 간격 및 강박 주기를 별도 하네스로 검증했다. 음질·청감 검증과 구분한다.

### Android UI 검증 범위

- **Galaxy S25(SM-S931N), 별도 `com.melodygen.app.qa` 패키지:** 준비/입력/종료 화면, 언어 선택만으로는 미변경·취소·적용·앱 재시작 후 언어 유지 확인. 확인 후 언어는 한국어로 복구했다. 화면 캡처는 UI 코드가 동일한 QA v66에서 수집했다.
- **Android 태블릿 에뮬레이터(1600×2560, density 240):** 준비/입력/종료 화면의 가운데 정렬과 신호 변경, 결과 → 공유 카드 → 이미지 캡처 → Android 공유 시트의 이미지 미리보기 확인. 수신자를 고르거나 전송하지 않았다.
- **알림:** S25에서 POST_NOTIFICATIONS 권한 granted 및 QA 앱의 20:00 알림이 Android AlarmManager에 예약됨을 확인했다. 실제 알림 수신은 아직 확인하지 않았다.
- **기존 1.1.3 덮어 설치:** S25의 Play 설치본(versionCode 62)은 Play 서명이고, 로컬 APK는 upload 서명이라 직접 덮어 설치할 수 없다. 원본 앱을 삭제하지 않고 QA 패키지를 따로 설치했다. 실제 업데이트 데이터 보존 검증은 Play 내부 테스트 경로가 필요하다.
- 6/8 둘잇단 기보, 4성부 청감, 게스트 → 로그인 실제 이관, 테스트 계정 탈퇴는 여전히 별도 실기기 확인이 필요하다.

### 당시 산출물 (v67, 최신 후보는 13장)

- 출시용 AAB: Mac `build/melodygen-android-v67.aab` / Windows **`D:\Projects\YulProject_1\ear-training-mobile\build\melodygen-android-v67.aab`**.
- AAB SHA-256: `30c30274e1531cbdd2cfae288a062642ccc79d86add25fe56cb1a47a175b5fda`. upload 인증서 지문 일치, `jarsigner -verify` 통과, Supabase 호스트 포함 확인.
- 별도 앱/arm64 QA APK: Mac `build/qa-v67/melodygen-android-v67-qa-arm64.apk` / Windows **`D:\Projects\YulProject_1\ear-training-mobile\build\melodygen-android-v67-qa-arm64.apk`** (51.3MB).
- QA APK SHA-256: `1fdc288595a3f614d80366a68b07a05b637ce73647dc73d15c694b1adfa9db99`. `apksigner verify`로 upload 인증서를 직접 확인했다. 기존 빌드 스크립트는 APK의 v2/v3 서명을 keytool로 읽지 못해 인증서 경고를 출력하므로 APK는 apksigner 결과로 판정한다.
- Windows에서 두 파일의 SHA-256이 Mac 원본과 일치함을 확인했다. QA APK는 Play 업로드용이 아니며, OAuth scheme도 `melodygen-qa`로 분리했다.
- UI 증거: `build/qa-v67/screenshots/`(Git 제외). 서명·환경 변수 등 비밀값은 기록하지 않았다.

### 당시 운영·스토어 (후속 적용 결과는 6·13장)

- 이 QA 라운드까지 운영 DB는 **조회만** 했다. `profiles` RLS=false/정책 0개/구독 보호 트리거 없음, 종료 프로모션 enabled=true를 확인했다.
- `delete_own_account()`와 auth.users → profiles `ON DELETE CASCADE`가 운영 DB에 존재한다. 기존 TODOS의 “별도 계정 삭제 Edge Function 필요” 항목은 실제 상태에 맞게 고쳤다.
- `revenuecat-webhook`은 ACTIVE/version 2지만 RevenueCat 측 연결과 실제 수신 여부는 확인하지 않았다. 이 시점에는 3건 마이그레이션이 미적용이었다. 이후 2건의 적용 결과는 6·13장을 따른다.
- Play 업로드·내부 테스트 배포·프로덕션 출시는 수행하지 않았다. 당시 후보는 v67이었다. 현재 후보는 13장을 따른다.


## 13. 운영 DB 반영·Google Play DEX 최적화 후속 (2026-11-04)

### 운영 DB

- 사용자 요청의 “실서버 영향이 없다면 미리 반영” 조건에 따라 라이브 1.1.3 코드와 운영 권한을 대조한 뒤 2건만 적용했다(`02e3936`). 본인 프로필 CRUD·구독 캐시 갱신은 허용하고, 타인 행·anon 접근은 막는 역할별 테스트를 ROLLBACK으로 검증했다.
- profiles RLS/정책 4개 및 종료 프로모션·공지 비활성화가 적용됐다. 빌드 62/67 × ko/en/ja 원격 앱 제어 응답이 전후 동일하고 프로모션은 적용 전후 모두 비활성이다. Advisor의 profiles RLS 오류도 해소됐다.
- RevenueCat 웹훅은 ACTIVE v2/service_role 사용까지 확인했다. 실제 RevenueCat 연결·수신은 미확인이라 기존 tier 폴백 캐시를 막을 수 있는 구독 컬럼 보호 트리거는 보류한다. 상세 이력·검증 범위는 `docs/PROFILES_RLS_20261103.md`.

### DEX 경고 대응

- 릴리스 62의 난독화 2% 경고 대응으로 R8 난독화·코드 최적화·코드 축소·리소스 축소를 prebuild config plugin에 영구 반영했다(`10e3ab6`).
- `purchases-store-amazon:9.29.0` consumer 규칙의 전역 `-dontoptimize`만 제외하고 Amazon 보호 규칙은 보존했다. 실제 release 실행에서 확인한 Expo Record reflection 보호 규칙도 추가했다.
- `expo-notifications:0.32.17`의 제공 규칙이 consumer에 연결되지 않아 v71에서 알림 직렬화 실패를 재현했다. upstream과 같은 알림 패키지 보호 규칙을 복원한 빌드가 v72다(`ec6bb58`). v70·v71은 Windows `build/obsolete/`에 분리했으며 출시 후보로 사용하지 않는다.
- AAB 내 `r8.json` 기준 **난독화 58.47% / 최적화 58.16% / 코드 축소 58.40%**. 모두 활성이고 25% 기준 이상이다. 보고서 누락·비활성·기준 미달이면 빌드 검증이 실패한다.
- DEX는 v67의 5개/54,268,100바이트에서 v72의 2개/14,480,992바이트로 **73.32% 감소**했다. AAB 전체는 75,677,659 → 70,182,395바이트다.

### 최종 산출물

- Mac AAB: `/Users/lim/melodygen-build/ear-training-mobile-2.0/build/melodygen-android-v72.aab`
- Windows AAB: **`D:\Projects\YulProject_1\ear-training-mobile\build\melodygen-android-v72.aab`**
- 버전 **2.0.0 / versionCode 72**, 소스 `ec6bb58`.
- AAB SHA-256: `6e2639f1187b7d957c0921130ee416522b20870f8a7775eea32406e77e6e8669`. Windows 원본 해시 일치.
- `jarsigner`·upload 인증서 일치·JS 번들 Supabase 호스트 확인 완료. 같은 버전 APK도 `apksigner verify --print-certs`로 인증서를 확인했다.
- AAB와 같은 폴더에 `melodygen-android-v72-r8.json`, `melodygen-android-v72-mapping.txt`, `melodygen-android-v72-optimization-verification.json`, `melodygen-android-v72.apk`를 보관했다. 보고서와 mapping은 AAB 내부에도 포함된다.
- **Play 업로드·배포는 미수행**. 새 AAB 업로드 후 Play Console DEX 재평가를 확인해야 하며 기존 출시 62의 온라인 경고가 이미 사라졌다고 보고하지 않는다.


### 최적화 release 실행 검증 범위

- 최종 v72 APK를 Android 폰 에뮬레이터(1080×2400)에 설치해 cold start·SecureStore 초기화·게스트/기존 로컬 연습 기록 유지·통계 화면을 확인했다.
- 통계 결과 카드 → 이미지 캡처 → Android 공유 시트와 이미지 미리보기를 확인했다. 수신자를 선택하거나 전송하지 않았다. WebView 악보·리듬 연습은 같은 최적화 설정의 v71에서 별도로 실행 확인했다.
- 알림 권한 granted, 20:00 AlarmManager 예약, 앱 재실행 후 설정 enabled 및 OS 예약 유지를 확인했다. 실제 알림 수신은 미확인이다.
- 최종 로그에서 SecureStore Record 변환·직렬화·ClassNotFoundException·NoSuchMethodError·FATAL EXCEPTION은 0건이다. 에뮬레이터에는 결제 서비스가 없어 RevenueCat은 BILLING_UNAVAILABLE을 반환한다. 실제 구매·복원 검증으로 간주하지 않는다.
- 증거는 `build/qa-v72/`(Git 제외), 빌드 비교는 `build/melodygen-android-v72-optimization-verification.json`에 보관했다.
- 이 실행 검증은 에뮬레이터에서만 했다. Galaxy의 Play 62 설치본과 별도 QA 67은 변경하지 않았다. Play 업데이트 데이터 보존·실계정 이관/탈퇴·구매는 추가 검증이 필요하다.
