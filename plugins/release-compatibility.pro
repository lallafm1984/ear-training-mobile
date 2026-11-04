# purchases-store-amazon 9.29.0의 보호 규칙을 유지한다.
# 앱 전체의 최적화를 끄는 -dontoptimize만 제외한다.
# 원본: RevenueCat/purchases-android feature/amazon/consumer-rules.pro
-dontwarn com.amazon.**
-keep class com.amazon.** { *; }
-keepattributes *Annotation*

# Expo SDK 54는 아래 변환기·생성기에서 Kotlin reflection으로 Record를 구성한다.
# 보안 저장소·알림 등의 옵션 변환을 보존하고 나머지 앱은 계속 최적화한다.
-keep class expo.modules.kotlin.records.** { *; }
-keep class expo.modules.kotlin.allocators.** { *; }

# expo-notifications 0.32.17에 포함됐지만 consumerProguardFiles 연결이 빠진 규칙.
# 알림 저장/복원에 쓰는 Java 직렬화 메서드·모델 이름을 유지한다.
# upstream 수정: https://github.com/expo/expo/pull/45974
-keep class expo.modules.notifications.** { *; }
