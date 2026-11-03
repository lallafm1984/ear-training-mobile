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

Mac에는 Windows의 `D:\Projects\YulProject_1\ear-training-mobile\build` 경로가 없으므로, Windows PC로 넘길 때는 `build/*.aab`를 해당 Windows 폴더에 복사합니다.
