# Android release signing

이 폴더는 Mac 로컬 Android 릴리스 빌드에 사용할 서명 키스토어를 두는 위치입니다.

- `melodygen-release.jks`는 `/Users/lim/Downloads/melodygen-release.jks`에서 복사했습니다.
- `melodygen-upload-20260630.jks`는 Play App Signing의 upload key 재설정용으로 새로 생성한 키스토어입니다.
- Play Console upload key 재설정에는 `build/melodygen-upload-20260630.pem` 인증서를 제출합니다.
- Play Console의 앱 서명 키 업그레이드 인증서는 `/Users/lim/Downloads/deployment_cert.der`입니다. 이 파일은 공개 인증서이며 AAB 서명에 쓰는 개인키가 아닙니다.
- `.jks`, `credentials.json`, `.env.local`은 Git에 커밋하지 않습니다.
- 비밀번호와 alias는 루트의 `.env.local`에만 입력합니다.

검증:

```bash
npm run android:keystore:check
```
