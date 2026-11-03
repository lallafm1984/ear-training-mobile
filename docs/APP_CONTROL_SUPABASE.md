# Supabase 앱 버전 정책 및 원격 공지 운영

MelodyGen은 Supabase의 운영 메타데이터를 앱 시작 시 조회해 Android 강제 업데이트와 원격 공지 팝업을 제어합니다. 연습 기록·시험 결과·악보 등 사용자 콘텐츠는 이 기능과 무관하며 기존처럼 로컬 저장소만 사용합니다.

현재 라이브 DB 상태, 빌드 61 산출물, 구버전 호환 경계와 다음 세션 점검 순서는 `docs/APP_CONTROL_RELEASE_HANDOFF_20260822.md`를 참고합니다.

## 구성 요소

- `app_release_policies`: 플랫폼별 최신/최소 허용 빌드와 스토어 링크
- `app_announcements`: 기간·플랫폼·빌드별 공지 팝업
- `get_app_control_config(...)`: 앱이 호출하는 읽기 전용 RPC
- 앱은 원본 테이블에 직접 접근할 수 없습니다. `anon`과 `authenticated` 역할에는 RPC 실행 권한만 있습니다.
- 시작/종료 시각은 휴대폰 시계가 아니라 PostgreSQL 서버 시각으로 판정합니다.

마이그레이션:

```text
supabase/migrations/20260822090000_create_app_control.sql
```

## 강제 업데이트 운영

Supabase Dashboard → Table Editor → `app_release_policies` → `android` 행에서 조정합니다.

| 필드                      | 의미                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `enabled`                 | 버전 정책 사용 여부                                                    |
| `latest_build`            | Google Play에서 모든 대상 사용자에게 실제 제공 중인 최신 `versionCode` |
| `minimum_supported_build` | `force_latest=false`일 때 차단할 기준 빌드                             |
| `force_latest`            | `true`이면 `latest_build`보다 낮은 모든 빌드를 차단                    |
| `latest_version_name`     | 화면에 보여 줄 버전명                                                  |
| `store_url`               | 업데이트 버튼이 여는 HTTPS Google Play 주소                            |
| `update_*_ko/en/ja`       | 언어별 제목·본문·버튼 문구                                             |

현재 기본 정책은 Android 빌드 58, `force_latest=true`입니다.

새 로컬 AAB를 만들면 `npm run android:build:local`이 `versionCode`를 자동으로 1 올립니다. 이번 프로덕션 제출본인 빌드 61의 운영 순서는 다음과 같습니다.

1. 로컬 빌드 61 AAB를 Google Play에 업로드합니다.
2. 심사와 프로덕션 출시를 완료합니다.
3. 대상 국가와 사용자의 Google Play에서 빌드 61이 실제 제공되는지 확인합니다.
4. 그 후 `latest_build=61`, `minimum_supported_build=61`, `latest_version_name`을 갱신합니다.

Google Play 배포 전에 `latest_build`를 먼저 올리면 사용자가 업데이트 화면에서 빠져나오지 못하지만 스토어에는 업데이트가 없는 상태가 됩니다. 단계적 출시 중에는 `force_latest`를 끄거나, 출시율이 100%가 된 뒤 값을 올리세요.

빌드 61이 Google Play에 완전히 출시되기 전까지 운영 기준은 58로 유지합니다. 출시 확인 후 기준을 61로 올리면 이 기능이 포함된 앱은 다음 시작·포그라운드 복귀 시 업데이트 화면을 표시합니다. 빌드 58처럼 이 기능이 포함되지 않은 기존 바이너리에는 팝업을 소급해서 띄울 수 없으며, 기능이 들어간 빌드 59 이상부터 이후 버전 업데이트를 제어할 수 있습니다.

긴급하게 차단을 해제하려면 `force_latest=false`로 바꾸고 `minimum_supported_build`를 현재 허용할 빌드로 낮춥니다. 정책 전체를 끄려면 `enabled=false`로 바꿉니다.

## 원격 공지 팝업 운영

Supabase Dashboard → Table Editor → `app_announcements`에서 `remote_notice_example` 행을 복제하거나 수정합니다.

| 필드                     | 의미                                             |
| ------------------------ | ------------------------------------------------ |
| `id`                     | 영문 소문자·숫자·`_`·`-`로 만든 고유 ID          |
| `revision`               | 같은 공지를 모든 사용자에게 다시 보이려면 1 증가 |
| `enabled`                | 공지 활성화 여부                                 |
| `platform`               | `all`, `android`, `ios`                          |
| `priority`               | 동시에 여러 공지가 활성화되면 큰 값 하나를 표시  |
| `starts_at`, `ends_at`   | 서버 시각 기준 노출 기간. `ends_at`은 비워도 됨  |
| `min_build`, `max_build` | 특정 빌드 범위에만 표시. 비워도 됨               |
| `display_mode`           | `once`, `daily`, `every_launch`                  |
| `title_*`, `body_*`      | 한국어/영어/일본어 제목과 본문                   |
| `action_url`             | 선택 링크. HTTPS만 허용                          |
| `action_label_*`         | 링크가 있을 때 표시할 버튼 문구                  |
| `confirm_label_*`        | 닫기 버튼 문구                                   |

노출 방식:

- `once`: 공지 ID와 revision 조합당 기기에서 한 번
- `daily`: 기기의 현지 날짜를 기준으로 하루에 한 번
- `every_launch`: 앱을 완전히 다시 시작할 때마다 한 번

이전에 사용하던 `once_per_build` 값은 기존 앱·운영 행 호환을 위해 DB와 앱에서 계속 읽을 수 있지만, 새 공지는 위 세 모드 중 하나를 사용합니다. `daily`는 이를 지원하는 빌드에만 전달되도록 `min_build`를 설정해야 구버전 앱의 공지 파싱에 영향을 주지 않습니다.

팝업 높이는 제목과 본문 길이에 맞춰 자동으로 늘어납니다. 본문이 길어 화면 높이의 82%를 넘으면 팝업 외곽과 버튼은 화면 안에 유지되고 본문 영역만 스크롤됩니다.

운영 순서:

1. `enabled=false` 상태에서 제목·본문·기간·대상을 먼저 저장합니다.
2. 링크를 넣었다면 `https://` 주소와 버튼 문구를 함께 확인합니다.
3. 모든 값 확인 후 `enabled=true`로 전환합니다.
4. 종료하려면 즉시 `enabled=false`로 바꾸거나 `ends_at`을 지정합니다.
5. 기존에 본 사용자에게 수정본을 다시 띄우려면 `revision`을 증가시킵니다.

강제 업데이트 조건과 공지가 동시에 활성화되면 강제 업데이트 화면이 먼저 표시됩니다.

### 2026 수험생 무료 이용 공지

- 운영 행: `admissions_support_2026`
- 무료 이용 종료: 2026년 9월 30일 23:59:59(KST), DB의 배타적 종료값은 `2026-10-01 00:00:00+09`
- 공지 대상: Android 빌드 60 이상
- 노출 방식: 기기의 현지 날짜 기준 하루에 한 번(`daily`)
- 사용자 문구에는 시작일을 표시하지 않고 `9월 30일까지`만 안내
- 빌드 59부터 기존 Home 화면의 고정 공지를 제거했으며, `daily`를 지원하는 빌드 60 이상에서 이 원격 공지를 사용함
- 공지 `ends_at`은 프로모션 `ends_at`과 동일하게 유지하여 무료 이용이 끝나는 시각에 함께 종료

기간 또는 문구를 바꿀 때는 `app_promotions.ends_at`과 `app_announcements.ends_at`/`body_*`를 함께 수정합니다. 이미 공지를 본 기기에도 수정본을 다시 띄우려면 `revision`을 1 증가시킵니다.

## 적용 범위와 장애 동작

- 이 기능이 포함된 새 빌드부터 원격 제어가 가능합니다. 이미 배포된 빌드 58에는 코드를 소급해서 넣을 수 없습니다.
- 빌드 58 이하의 프로모션 권한 판정도 기존 `is_promotion_active` RPC를 사용하므로 무료 이용 종료 연장은 동일하게 적용됩니다. 다만 해당 바이너리에 내장된 과거 공지 문구 자체는 원격으로 바꿀 수 없습니다.
- 앱은 시작 시와 백그라운드에서 다시 활성화될 때 정책을 새로 조회합니다.
- 정상 응답은 기기에 캐시합니다. 일시적인 네트워크/RPC 장애 때는 마지막으로 검증된 정책을 사용합니다.
- 첫 실행이고 캐시도 없는데 Supabase에 연결되지 않으면 앱 사용을 허용합니다. 네트워크 장애만으로 모든 사용자가 앱에서 잠기는 상황을 피하기 위한 동작입니다.
- 원격 응답의 필드 형식, 빌드 범위, 플랫폼, HTTPS 링크가 잘못되면 해당 응답을 적용하지 않습니다.

## 배포 전 점검표

- [ ] 단위 테스트에서 최신/구버전/최소 지원 빌드 판정 확인
- [ ] Supabase RPC가 `anon` 키로 조회되고 원본 테이블 직접 조회는 거부되는지 확인
- [ ] Android 실제 빌드에서 로그인 전 업데이트 화면 확인
- [ ] 업데이트 버튼이 MelodyGen Google Play 페이지를 여는지 확인
- [ ] 공지의 한국어/영어/일본어와 노출 모드 확인
- [ ] 정책 값을 올리기 전에 Google Play 실제 배포 상태 확인
