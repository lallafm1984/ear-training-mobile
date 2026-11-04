# 앱 제어·무료 프로모션 릴리스 인수인계 (2026-08-22)

이 문서는 MelodyGen의 강제 업데이트, Supabase 원격 공지, 2026 수험생 무료 이용 프로모션을 다른 개발 세션에서 안전하게 이어가기 위한 현재 상태 기록입니다. 필드별 운영법은 `docs/APP_CONTROL_SUPABASE.md`, 로컬 Android 빌드는 `docs/LOCAL_ANDROID_BUILD_MAC.md`를 함께 참고합니다.

## 완료된 결과

- 앱 시작과 포그라운드 복귀 시 Supabase의 앱 제어 RPC를 조회합니다.
- 출시된 최신 빌드보다 낮은 지원 앱에는 닫을 수 없는 업데이트 화면을 표시할 수 있습니다.
- 원격 공지는 `once`, `daily`, `every_launch` 세 모드로 운영할 수 있습니다.
- 이전 `once_per_build` 모드는 구버전·기존 행 호환을 위해 계속 파싱합니다.
- 짧은 공지는 내용 높이에 맞게 표시하고, 긴 공지는 카드 높이 82% 안에서 본문만 스크롤합니다.
- 2026 수험생 무료 이용 기간과 공지는 9월 30일 종료로 맞췄습니다.
- 사용자 문구에는 프로모션 시작일을 표시하지 않고 `9월 30일까지`만 안내합니다.
- 현재 앱 설정은 `versionName=1.0.2`, Android `versionCode=61`입니다.

## 데이터 경계

이 기능은 앱 운영 메타데이터에만 Supabase를 사용합니다.

- 허용: 인증, 프로필, 구독 상태, 프로모션 기간, 버전 정책, 원격 공지
- 로컬 전용: 연습 기록, 실력 프로필, 시험 결과, 악보와 그 밖의 학습 콘텐츠

원격 공지 추가를 이유로 사용자 학습 콘텐츠를 Supabase에 저장하지 않습니다.

## 주요 파일

| 파일                                                                       | 역할                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `App.tsx`                                                                  | 로그인 여부와 무관하게 최상위에 `AppControlGate` 적용            |
| `src/components/AppControlGate.tsx`                                        | 정책 조회·캐시·강제 업데이트 화면·공지 팝업·앱 활성화 재조회     |
| `src/lib/appControl.ts`                                                    | RPC 응답 검증, 강제 업데이트 재계산, 언어·빌드·공지 노출 키 처리 |
| `src/__tests__/appControl.test.ts`                                         | 정책 변조 방어, 빌드 판정, URL 검증, 공지 모드·날짜 키 테스트    |
| `src/lib/promotionConfig.ts`                                               | 서버 시간 기반 무료 프로모션 RPC 호출                            |
| `src/context/SubscriptionContext.tsx`                                      | 프로모션 활성 시 Pro 이용 권한 반영                              |
| `supabase/migrations/20260818083000_create_server_timed_promotions.sql`    | `app_promotions`와 `is_promotion_active` 생성                    |
| `supabase/migrations/20260822090000_create_app_control.sql`                | 버전 정책·공지 테이블·제한 RPC 생성                              |
| `supabase/migrations/20260822153000_extend_admissions_promotion.sql`       | 무료 기간 연장과 프로모션 공지 생성                              |
| `supabase/migrations/20260822182000_add_daily_announcement_mode.sql`       | `daily` 모드와 레거시 호환 제약 적용                             |
| `supabase/migrations/20260822183000_set_admissions_announcement_daily.sql` | 실제 공지를 빌드 60+ 하루 1회로 바꾸고 종료일 동기화             |

## 앱 제어 흐름

1. `AppControlGate`가 네이티브 `versionCode`, 플랫폼, 언어를 확인합니다.
2. `get_app_control_config(platform, build, locale)` RPC를 최대 5초 동안 호출합니다.
3. 앱이 RPC 응답의 타입, 빌드 범위, 플랫폼, HTTPS URL을 다시 검증합니다.
4. 강제 업데이트 대상이면 업데이트 화면이 공지보다 먼저 표시됩니다.
5. 강제 업데이트 대상이 아니면 조건에 맞는 공지 1개를 표시합니다.
6. 정상 응답은 AsyncStorage에 캐시합니다. 일시적 장애에는 마지막 검증 응답을 사용합니다.
7. 첫 실행이고 캐시도 없을 때 네트워크가 실패하면 앱 사용을 허용합니다.

서버가 보낸 `forceUpdate` 값은 그대로 신뢰하지 않습니다. 앱이 `force_latest`, 최신/최소 빌드와 현재 네이티브 빌드를 비교해 다시 계산합니다.

## 공지 노출 키

| 모드             | 저장 기준                        | 실제 동작                                                      |
| ---------------- | -------------------------------- | -------------------------------------------------------------- |
| `once`           | `id + revision`                  | 해당 개정 공지를 기기에서 한 번 표시                           |
| `daily`          | `id + revision + 기기 현지 날짜` | 날짜별 한 번 표시, 자정을 넘긴 동일 프로세스도 새 날짜 키 사용 |
| `every_launch`   | 영구 확인 키 없음                | 새 앱 프로세스마다 표시, 같은 실행 세션에서는 반복 방지        |
| `once_per_build` | `id + revision + versionCode`    | 빌드별 한 번, 레거시 호환 전용                                 |

같은 날 문구를 고쳐 즉시 다시 보여야 한다면 `revision`을 증가시킵니다.

## 2026-08-22 운영 DB 확인값

Supabase 프로젝트 `ear-training`의 운영 DB에 관련 SQL을 실행하고 RPC로 재확인한 상태입니다.

### `app_release_policies` Android 행

```text
enabled                   = true
latest_build              = 58
minimum_supported_build   = 58
force_latest              = true
latest_version_name       = 1.0.2
```

빌드 61이 Google Play에 완전히 출시되기 전까지 위 값을 61로 올리지 않습니다.

### `app_promotions` 프로모션 행

```text
id          = admissions_support_2026
enabled     = true
starts_at   = 2026-08-18 00:00:00+09
ends_at     = 2026-10-01 00:00:00+09
```

`ends_at`은 배타적 종료값입니다. 따라서 실제 무료 이용 가능 기간의 마지막 날짜는 2026년 9월 30일입니다.

### `app_announcements` 공지 행

```text
id            = admissions_support_2026
revision      = 2
enabled       = true
platform      = android
priority      = 100
display_mode  = daily
min_build     = 60
max_build     = null
ends_at       = 2026-10-01 00:00:00+09
```

운영 DB에서 공지 `ends_at`과 프로모션 `ends_at`의 일치 여부는 `true`로 확인했습니다.

테스트용 `remote_notice_test_v60`, `remote_notice_long_daily_v60` 행은 모두 `enabled=false`입니다.

## 구버전 호환 경계

| 설치 빌드 | 동작                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 58 이하   | 앱 제어 코드가 없으므로 강제 업데이트·새 원격 공지를 소급 적용할 수 없음. 무료 권한은 기존 `is_promotion_active` RPC로 연장 기간 적용 |
| 59        | 앱 제어 기능은 있으나 `daily` 공지를 전달하지 않도록 현재 프로모션 공지의 `min_build=60` 설정. 운영 RPC 확인 결과 공지 `null`         |
| 60 이상   | `daily` 공지를 정상 파싱·저장·표시                                                                                                    |

DB 제약과 앱 파서는 `once_per_build`도 계속 허용합니다. 기존 행을 일괄 변환하거나 제거하지 않습니다.

## 현재 프로덕션 산출물

```text
build/melodygen-android-v61.aab
SHA-256 aaae95736b43f1bb58b91aa4c833a53cc8850b845c9889643c4c8d004d49eb78

build/melodygen-android-v61.apk
SHA-256 75d589412e7a3fd6a3fa93d8b84cb3142a6ffc9108799e79026e6e288ad9cb33
```

- AAB: `versionCode=61`, `versionName=1.0.2`, ZIP 무결성·JAR 서명·기존 upload 인증서 일치 확인
- AAB ABI: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`
- APK: APK Signature Scheme v2 검증 완료
- 실제 기기: SM-S931N에 무선 `adb install -r` 성공, 설치 빌드 61·버전명 1.0.2·전면 실행·로그인 데이터 유지 확인
- 임시 네이티브 프로젝트와 테스트 캡처 약 4.9GB는 `/Users/lim/.Trash/codex-melodygen-20260822-1839`로 이동함

EAS 로그인이 만료된 상태여서 최종 산출물은 영문 임시 경로에서 Expo prebuild 후 기존 upload key로 로컬 Gradle 빌드했습니다. 저장소의 표준 절차는 `docs/LOCAL_ANDROID_BUILD_MAC.md`와 `npm run android:build:local`이며, 이 명령은 `versionCode`를 자동 증가시키므로 현재 61 산출물을 재사용할 때 실수로 실행하지 않습니다.

## 검증 완료 항목

2026-08-22 기준:

```text
npm test -- --runInBand  -> 17 suites, 259 tests passed
npm run lint             -> passed
npx tsc --noEmit         -> passed
:app:assembleRelease     -> BUILD SUCCESSFUL
:app:bundleRelease       -> BUILD SUCCESSFUL
```

실제 기기에서 653자 장문 공지로 다음을 확인했습니다.

- 내용 길이에 따른 팝업 높이 증가
- 최대 높이에서 본문만 스크롤
- 제목과 확인 버튼이 화면 안에 유지
- 확인 후 같은 날 강제 종료·재실행 시 재표시되지 않음
- 앱 데이터와 로그인 상태 유지
- 치명적 Android/React Native 오류 없음

## Google Play 출시 후 해야 할 작업

다음 작업은 Play Console에서 빌드 61이 대상 사용자에게 실제 제공되는 것을 확인한 뒤에만 실행합니다.

```sql
update public.app_release_policies
set latest_build = 61,
    minimum_supported_build = 61,
    latest_version_name = '1.0.2',
    updated_at = now()
where platform = 'android';
```

적용 후 반드시 확인합니다.

1. RPC에 빌드 60을 넣으면 `forceUpdate=true`, `requiredBuild=61`인지 확인
2. RPC에 빌드 61을 넣으면 `forceUpdate=false`인지 확인
3. 구버전 실제 기기에서 업데이트 버튼이 Google Play의 MelodyGen 페이지를 여는지 확인
4. Play에서 61을 받을 수 없는 계정·국가·단계적 출시 사용자가 없는지 확인

문제가 생기면 `force_latest=false`로 전환하거나 `minimum_supported_build`를 허용할 빌드로 낮춥니다. Play 출시 전에 정책을 61로 올리면 업데이트할 수 없는 무한 차단 화면이 생길 수 있습니다.

## 다음 세션 시작 점검

1. `PROJECT_INDEX.md`와 이 문서를 먼저 읽습니다.
2. 작업 트리가 기존부터 변경·미추적 파일을 포함하므로 전체 초기화나 광범위한 정리를 하지 않습니다.
3. `app.json`의 현재 `versionCode`와 `build/` 산출물을 확인합니다.
4. Supabase 운영 행과 RPC 결과를 다시 읽어 문서의 스냅샷이 아직 유효한지 확인합니다.
5. Google Play 실제 배포 상태를 확인하지 않고 `latest_build`를 변경하지 않습니다.
6. 새 공지는 먼저 `enabled=false`로 만들고 빌드 범위·기간·언어·링크를 검증한 뒤 활성화합니다.
7. 앱 파일 추가·이동이 있으면 `PROJECT_INDEX.md`도 함께 갱신합니다.

현재 변경은 커밋·푸시하지 않은 상태입니다. 다음 세션은 알 수 없는 기존 변경을 보존하고, 이 기능에 해당하는 파일만 좁게 검토해야 합니다.
