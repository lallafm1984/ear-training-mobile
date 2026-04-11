// ─────────────────────────────────────────────────────────────
// RevenueCat 초기화 및 헬퍼
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';

// ── API 키 (RevenueCat 대시보드에서 발급) ──────────────────
// TODO: 실제 키로 교체 필요. EAS Secrets 또는 환경변수 사용 권장.
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_API_KEY';
const REVENUECAT_API_KEY_ANDROID = 'goog_WlXgMWVREJgnSBeRcTeRzrqtFyA';

// ── RevenueCat 제품 식별자 ─────────────────────────────────
// RevenueCat 대시보드에서 설정한 Entitlement ID
export const ENTITLEMENT_ID = 'pro';

/** RevenueCat SDK 초기화. 앱 시작 시 1회 호출. */
export async function initRevenueCat(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios'
    ? REVENUECAT_API_KEY_IOS
    : REVENUECAT_API_KEY_ANDROID;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  await Purchases.configure({ apiKey, appUserID: userId ?? undefined });
}

/** 현재 사용자의 구독 정보 조회 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/** 사용 가능한 패키지(상품) 목록 조회 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  if (!offerings.current || !offerings.current.availablePackages.length) {
    return [];
  }
  return offerings.current.availablePackages;
}

/** 패키지 구매 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/** 구독 복원 */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** CustomerInfo에서 Pro 활성 여부 확인 */
export function isPro(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

/** RevenueCat 사용자 ID를 Supabase user ID와 연결 */
export async function loginRevenueCat(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}

/** RevenueCat 로그아웃 */
export async function logoutRevenueCat(): Promise<void> {
  await Purchases.logOut();
}
