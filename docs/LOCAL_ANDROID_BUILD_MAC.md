# Mac 로컬 Android 릴리스 빌드

이 문서는 MelodyGen Android 릴리스 AAB를 Mac 로컬에서 생성하고, Google Play App Signing 상태에 맞춰 관리하는 절차입니다.

## 현재 설정된 파일

- 기존 릴리스 키스토어: `credentials/android/melodygen-release.jks`
- 현재 upload key 키스토어: `credentials/android/melodygen-upload-20260630.jks`
- 환경 예시: `.env.local.example`
- EAS 로컬 자격증명 생성: `scripts/createAndroidLocalCredentials.mjs`
- 키스토어 검증: `scripts/verifyAndroidReleaseKeystore.mjs`
- 로컬 환경 점검: `scripts/checkMacAndroidBuildEnv.mjs`
- 로컬 릴리스 빌드: `scripts/buildAndroidReleaseLocal.mjs`
- EAS 없는 Gradle 릴리스 빌드: `scripts/buildAndroidReleaseGradle.mjs`

`credentials/android/melodygen-release.jks`는 `/Users/lim/Downloads/melodygen-release.jks`에서 복사했습니다. 이 파일은 Git에 커밋되지 않습니다.

`credentials/android/melodygen-upload-20260630.jks`는 Play App Signing에서 upload key를 새로 등록하기 위해 만든 키스토어입니다. 비밀번호와 alias는 `.env.local`에만 저장합니다.

## Play App Signing 키 업그레이드

2026-06-30에 Play Console에서 내려받은 업그레이드된 앱 서명 인증서는 `/Users/lim/Downloads/deployment_cert.der`입니다.

이 파일은 공개 인증서이며 앱을 직접 서명할 수 있는 개인키가 아닙니다. 로컬 AAB는 upload key로 서명하고, Play Console이 사용자에게 배포할 APK/AAB를 업그레이드된 앱 서명 키로 다시 서명합니다.

업그레이드된 앱 서명 인증서 지문:

```text
SHA1:   59:F0:49:63:2F:FA:96:B5:66:B5:18:F2:CC:83:44:41:16:4B:90:CD
SHA256: 54:31:FD:05:5C:36:D0:BD:C5:FF:EE:00:B0:AA:E6:DA:B3:63:67:A0:82:89:40:E8:14:8F:59:A1:1C:D4:4F:8C
```

서명 인증서 지문을 요구하는 외부 서비스가 있으면 위 값을 새 앱 서명 키 기준으로 갱신합니다.

- Google Cloud Console에 Android OAuth 클라이언트가 있다면 `com.melodygen.app` 패키지에 위 SHA-1을 추가합니다.
- Firebase, Google Maps, Play Games 등 SHA 지문을 쓰는 서비스가 생기면 위 SHA-1/SHA-256을 등록합니다.
- 현재 앱의 Google 로그인은 Supabase OAuth + Expo WebBrowser 흐름이므로 앱 코드 안에는 Android OAuth client ID나 SHA 지문 설정 파일이 없습니다.

## Mac에 필요한 도구

1. Node.js LTS와 npm
2. Java JDK 17
3. Android Studio 및 Android SDK
4. EAS CLI 로그인 또는 로컬 Gradle 빌드용 Android Gradle 캐시 접근 권한

확인:

```bash
node -v
npm -v
java -version
keytool -help
adb version
```

현재 이 Mac에서는 Node.js, npm, npx, Java 17, Android SDK, adb, keytool이 확인됐습니다. Expo/EAS 계정에는 로그인되어 있지 않으므로 EAS 클라우드/원격 자격증명 빌드가 필요하면 별도 로그인이 필요합니다.

Android SDK는 `/Users/lim/Library/Android/sdk`에 설치되어 있습니다. `adb`가 PATH에서 잡히지 않으면 `~/.zshrc`에 아래 값을 추가합니다.

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

설치 후 점검:

```bash
npm run android:env:check
```

## 환경 변수 설정

루트에서 예시 파일을 복사한 뒤 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

필수 값:

```bash
MELODYGEN_ANDROID_KEYSTORE_PATH=credentials/android/melodygen-upload-20260630.jks
MELODYGEN_ANDROID_KEYSTORE_PASSWORD=키스토어_비밀번호
MELODYGEN_ANDROID_KEY_ALIAS=키_ALIAS
MELODYGEN_ANDROID_KEY_PASSWORD=키_비밀번호
```

키 비밀번호가 키스토어 비밀번호와 같다면 `MELODYGEN_ANDROID_KEY_PASSWORD`에 같은 값을 넣으면 됩니다.

alias를 모르면 키스토어 비밀번호를 입력한 뒤 아래 명령으로 확인합니다.

```bash
node scripts/verifyAndroidReleaseKeystore.mjs --list-aliases
```

## 빌드 순서

```bash
npm install
npx eas-cli@latest login
npm run android:env:check
npm run android:credentials
npm run android:keystore:check
npm run android:build:local
```

`npm run android:build:local`은 빌드 직전에 `app.json`의 `expo.android.versionCode`를 1 증가시키고, AAB를 기본적으로 `build/` 폴더에 생성합니다.

## EAS 로그인 없이 빌드 (prebuild + Gradle)

EAS 계정에 로그인할 수 없거나 로그인이 만료됐을 때는 EAS 없이 Expo prebuild와 Gradle로 같은 upload key 서명의 AAB를 만들 수 있습니다. 2026-08 릴리스(1.1.x)와 2026-11-04 2.0.0(versionCode 63) AAB가 이 방식으로 만들어졌습니다. 2.0.0 빌드는 같은 순서를 수동으로 실행했고, 그 절차를 아래 스크립트로 고정했습니다.

2.0.0 빌드 기록: 한글 경로(`~/Desktop/프로젝트/...`)에서는 JS 번들 단계(`createBundleReleaseJsAndAssets`)가 "Unable to resolve module .../index.ts"로 실패해 워크트리를 `/Users/lim/melodygen-build/ear-training-mobile-2.0`으로 옮긴 뒤 성공했습니다(Gradle 4분 42초). 산출물 `build/melodygen-android-v63.aab`(약 72MB)의 서명 인증서 지문은 아래 upload 인증서와 일치했고, `jarsigner -verify`는 "jar verified."였습니다.

```bash
npm install
npm run android:env:check
npm run android:keystore:check
npm run android:build:gradle
```

`npm run android:build:gradle`은 다음을 순서대로 수행합니다.

1. `.env.local`의 `MELODYGEN_ANDROID_*` 서명 정보를 읽고(비밀값은 파일에 쓰지 않고 환경 변수로만 Gradle에 전달) `ANDROID_HOME`을 확인합니다.
2. `eas.json`의 `build.production.env`에 있는 `EXPO_PUBLIC_*` 값을 환경 변수로 넣습니다. EAS 빌드에서는 EAS가 넣어 주지만 Gradle 직접 빌드에서는 이 단계가 없으면 Supabase 로그인이 동작하지 않는 번들이 만들어집니다.
3. `app.json`의 `expo.android.versionCode`를 1 증가시킵니다(`--no-bump`로 생략).
4. `npx expo prebuild --platform android --no-install`로 `android/`를 생성하고, `android/app/build.gradle`의 release 서명을 upload key로 바꿉니다.
5. `./gradlew :app:bundleRelease`(`--apk`면 `:app:assembleRelease`)를 실행하고 산출물을 `build/melodygen-android-v<versionCode>.aab`로 복사합니다.
6. 산출물 서명 인증서 SHA-256을 키스토어와 비교하고, `jarsigner -verify`, JS 번들의 Supabase 호스트 포함 여부, 파일 SHA-256을 출력합니다.

옵션:

| 옵션             | 동작                                                   |
| ---------------- | ------------------------------------------------------ |
| `--no-bump`      | versionCode를 올리지 않고 같은 버전으로 다시 빌드      |
| `--apk`          | AAB 대신 실기기 설치용 APK 생성                        |
| `--clean`        | 기존 `android/` 폴더를 지우고 prebuild부터 다시        |
| `--keep-android` | 기존 `android/`를 재사용하고 prebuild 생략             |

주의:

- `android/`와 `build/`는 `.gitignore` 대상입니다. 빌드 뒤 커밋할 변경은 `app.json`의 versionCode 한 줄만이어야 합니다.
- 프로젝트 경로에 한글 등 ASCII 이외 문자가 있으면 CMake/NDK/Hermes 단계가 실패할 수 있습니다(2026-08 릴리스는 이 문제로 영문 임시 경로에서 빌드). 스크립트가 경고를 출력하면, 실패 시 `git worktree add /Users/lim/melodygen-build/ear-training-mobile <브랜치>`처럼 영문 경로에 워크트리를 만들고 `.env.local`과 `credentials/`를 복사해 다시 실행합니다.
- 서명 비밀번호가 `.env.local`에만 있어야 하는 원칙은 그대로입니다. 스크립트는 비밀값을 출력하지 않습니다.
- 업로드 키 인증서 SHA-256은 `f8364c66ad87f18c0a5febe4f00527f657f895cb4072b2f3c9951c196b7415a8`입니다(2026-08-31 릴리스 기록). 스크립트 출력의 "산출물 서명 인증서 SHA-256"이 이 값과 같아야 Play Console이 AAB를 받아 줍니다.

Mac에는 Windows의 `D:\Projects\YulProject_1\ear-training-mobile\build` 경로가 없으므로, Windows PC로 넘길 때는 `build/*.aab`를 해당 Windows 폴더에 복사합니다.
