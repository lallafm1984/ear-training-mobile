# Google Play Store 출시 가이드

## 1단계: 계정 설정

### Google Play Console
1. https://play.google.com/console 에서 개발자 계정 등록 ($25 일회성)
2. 새 앱 만들기 → 앱 이름: "MelodyGen - 청음 훈련"
3. 기본 정보 입력 (listing.md 참고)

### Expo 계정
```bash
npm install -g eas-cli
eas login
eas init
```
`eas init` 실행 후 생성된 projectId를 `app.json`의 `extra.eas.projectId`에 입력

### RevenueCat 설정
1. https://app.revenuecat.com 에서 프로젝트 생성
2. Google Play 앱 추가 → 패키지명: `com.melodygen.app`
3. Google Play 서비스 자격 증명 연결 (서비스 계정 JSON 업로드)
4. Products → 월간 구독 상품 추가 (ID: `melodygen_pro_monthly`)
5. Entitlements → `pro` 생성 → 상품 연결
6. Offerings → Default → Monthly 패키지 추가
7. API Keys에서 Google용 공개 키 복사
8. `src/lib/revenueCat.ts`의 `REVENUECAT_API_KEY_ANDROID`에 붙여넣기

## 2단계: Google Play 인앱 상품 등록

1. Play Console → 수익 창출 → 상품 → 구독
2. 구독 ID: `melodygen_pro_monthly`
3. 구독 이름: "MelodyGen Pro"
4. 가격: 5,500원/월
5. 혜택 기간: 없음 (또는 7일 무료 체험)
6. 유예 기간: 3일

## 3단계: 서비스 계정 키 생성

Google Cloud Console에서:
1. https://console.cloud.google.com → Play Console 프로젝트
2. IAM → 서비스 계정 만들기
3. 역할: "서비스 계정 사용자"
4. JSON 키 다운로드 → 프로젝트 루트에 `google-service-account.json`으로 저장
5. Play Console → 설정 → API 액세스 → 서비스 계정 연결

## 4단계: 빌드 및 제출

```bash
# 프로덕션 AAB 빌드
eas build --platform android --profile production

# Google Play에 제출 (내부 테스트 트랙)
eas submit --platform android --profile production
```

첫 빌드 시 EAS가 키스토어를 자동 생성합니다.

## 5단계: 테스트

1. Play Console → 테스트 → 내부 테스트
2. 테스터 이메일 추가 (본인 + 학생 5명)
3. 테스트 링크 공유
4. IAP 테스트: Play Console에서 라이선스 테스터로 등록

## 6단계: 프로덕션 출시

1. 내부 테스트에서 문제 없으면
2. Play Console → 프로덕션 → 새 버전 만들기
3. 내부 테스트 빌드를 프로덕션으로 승격
4. 스토어 등록 정보 최종 확인
5. 검토 제출 (보통 1~3일 소요)

## 버전 업데이트 시

```bash
# app.json에서 version + versionCode 증가
# versionCode는 매 빌드마다 반드시 증가해야 함

eas build --platform android --profile production
eas submit --platform android --profile production
```

## 환경 변수 관리

프로덕션 키는 EAS Secrets로 관리하는 것을 권장:
```bash
eas secret:create --name REVENUECAT_ANDROID_KEY --value "goog_YOUR_KEY" --scope project
```

그 후 `revenueCat.ts`에서:
```ts
import Constants from 'expo-constants';
const REVENUECAT_API_KEY_ANDROID = Constants.expirationConfig?.extra?.revenueCatAndroidKey ?? 'goog_YOUR_KEY';
```
