import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { createOAuthCallbackProcessor, supabase } from '../lib';
import type { Profile } from '../lib';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { logoutRevenueCat } from '../lib/revenueCat';
import { logger } from '../lib/logger';
import {
  GUEST_MODE_FLAG_KEY,
  GUEST_STORAGE_ID,
  allLocalDataKeys,
  hasGuestData,
  migrateGuestDataToAccount,
} from '../lib/localProfileStorage';
import { useAlert } from './AlertContext';

WebBrowser.maybeCompleteAuthSession();

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** 현재 세션 (null = 미로그인) */
  session: Session | null;
  /** 현재 유저 */
  user: User | null;
  /** profiles 테이블 데이터 */
  profile: Profile | null;
  /** 초기 세션 로딩 중 */
  loading: boolean;
  /** 프로필 갱신 중 */
  profileLoading: boolean;
  /** 로그인 없이 게스트로 사용 중 */
  isGuest: boolean;
  /**
   * 로컬 학습 데이터(연습 기록·실력 프로필·EXP 등)의 소유자 ID.
   * 로그인 상태면 user.id, 게스트면 GUEST_STORAGE_ID. 항상 값이 있다.
   */
  storageUserId: string;
  /** 로그인 없이 시작 */
  continueAsGuest: () => Promise<void>;
  /** 게스트 모드를 끝내고 로그인 화면으로 돌아간다. 로컬 데이터는 보존된다. */
  exitGuestMode: () => Promise<void>;

  /** 이메일+비밀번호 로그인 */
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  /** 이메일+비밀번호 회원가입 */
  signUp: (email: string, password: string, displayName: string) => Promise<AuthError | null>;
  /** 로그아웃 */
  signOut: () => Promise<void>;
  /** 비밀번호 변경 */
  updatePassword: (newPassword: string) => Promise<AuthError | null>;
  /** Google OAuth 로그인 */
  signInWithGoogle: () => Promise<void>;
  /** 프로필(닉네임) 업데이트 */
  updateProfile: (data: { display_name?: string }) => Promise<string | null>;
  /** 회원 탈퇴 */
  deleteAccount: () => Promise<string | null>;
  /** 프로필 강제 리로드 */
  reloadProfile: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showAlert } = useAlert();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  // 게스트 플래그: 앱 재시작 후에도 로그인 화면을 건너뛰기 위해 저장한다.
  const [guestMode, setGuestMode] = useState(false);
  const [guestLoading, setGuestLoading] = useState(true);
  // 게스트 데이터 이관이 끝날 때까지는 계정 키로 전환하지 않는다.
  const [migratingUserId, setMigratingUserId] = useState<string | null>(null);

  // ── 프로필 로드 (없으면 자동 생성) ──────────────────────
  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();

      if (data) {
        setProfile(data as Profile);
        return;
      }

      // 프로필이 없으면 생성 (탈퇴 후 재가입 등)
      if (error?.code === 'PGRST116') {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) return;

        const meta = authUser.user_metadata ?? {};
        const displayName =
          meta.display_name || meta.full_name || authUser.email?.split('@')[0] || '';

        const { data: created, error: insertErr } = await supabase
          .from('profiles')
          .insert({
            id: uid,
            email: authUser.email ?? '',
            display_name: displayName,
            avatar_url: meta.avatar_url || null,
          })
          .select('*')
          .single();

        if (insertErr) {
          logger.warn('[AuthContext] 프로필 생성 실패:', insertErr.message);
        } else {
          setProfile(created as Profile);
        }
      } else if (error) {
        logger.warn('[AuthContext] 프로필 로드 실패:', error.message);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const showGoogleSignInError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('[Google OAuth] 로그인 실패:', message);
      showAlert({
        title: i18n.t('auth:login.googleErrorTitle'),
        message: i18n.t('auth:login.googleErrorMessage'),
        type: 'error',
      });
    },
    [showAlert],
  );

  // Android에서는 Custom Tab 복귀(AppState)와 딥링크 이벤트가 경합할 수 있다.
  // WebBrowser 결과와 무관하게 앱 전역에서 콜백을 처리하고, 동일 URL은 한 번만 교환한다.
  const oauthCallbackProcessor = useMemo(
    () => createOAuthCallbackProcessor(supabase.auth, showGoogleSignInError),
    [showGoogleSignInError],
  );

  // ── 게스트 데이터 → 계정 이관 ───────────────────────────
  // 로그인 직후 한 번 실행한다. 이관 중에는 storageUserId를 게스트로 유지해
  // 훅들이 반쯤 합쳐진 데이터를 읽지 않게 한다. 이 함수는 setUser와 같은
  // 핸들러 안에서 동기적으로 호출되므로 migratingUserId가 user와 함께 반영된다.
  // 프로필 로딩 화면이 끝나기 전에 로컬 검사가 끝나므로 화면 깜빡임은 없다.
  const migrateGuestData = useCallback(async (uid: string) => {
    setMigratingUserId(uid);
    try {
      if (!(await hasGuestData(AsyncStorage))) return;
      const result = await migrateGuestDataToAccount(AsyncStorage, uid);
      if (result.migrated) {
        logger.debug(
          `[AuthContext] 게스트 데이터 이관 완료: 연습 ${result.practiceRecords}건, 시험 ${result.examSessions}건`,
        );
      }
    } catch (error) {
      logger.warn('[AuthContext] 게스트 데이터 이관 실패:', String(error));
    } finally {
      await AsyncStorage.removeItem(GUEST_MODE_FLAG_KEY).catch(() => {});
      setGuestMode(false);
      setMigratingUserId(null);
    }
  }, []);

  // ── 세션 초기화 + OAuth 딥링크 + onAuthStateChange 리스너 ─
  useEffect(() => {
    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // TOKEN_REFRESHED는 프로필 데이터 변경 없음 → 재로드 불필요 (profileLoading 플래시 방지)
        if (event !== 'TOKEN_REFRESHED') {
          loadProfile(s.user.id);
        }
        if (event === 'SIGNED_IN') {
          // 게스트로 쓰다가 로그인한 경우를 포함해, 훅이 계정 키로 넘어가기 전에 이관을 건다.
          void migrateGuestData(s.user.id);
        }
      } else {
        setProfile(null);
      }
    });

    const linkingListener = Linking.addEventListener('url', ({ url }) => {
      void oauthCallbackProcessor.process(url);
    });

    const initializeSession = async () => {
      try {
        // 앱이 OAuth 콜백으로 새로 시작된 경우 세션 복원보다 먼저 교환한다.
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await oauthCallbackProcessor.process(initialUrl);

        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          loadProfile(s.user.id);
          // 이전 실행에서 이관이 끝나기 전에 앱이 종료된 경우를 회수한다.
          void migrateGuestData(s.user.id);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const initializeGuestMode = async () => {
      try {
        const flag = await AsyncStorage.getItem(GUEST_MODE_FLAG_KEY);
        if (mounted) setGuestMode(flag === 'true');
      } catch {
        // 플래그를 못 읽으면 로그인 화면으로 간다.
      } finally {
        if (mounted) setGuestLoading(false);
      }
    };

    void initializeSession();
    void initializeGuestMode();

    return () => {
      mounted = false;
      linkingListener.remove();
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, oauthCallbackProcessor, migrateGuestData]);

  // ── 게스트 모드 ──────────────────────────────────────────
  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_MODE_FLAG_KEY, 'true').catch(() => {});
    setGuestMode(true);
  }, []);

  const exitGuestMode = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_MODE_FLAG_KEY).catch(() => {});
    setGuestMode(false);
  }, []);

  // ── 로그인 ───────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  // ── 회원가입 ─────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return error;
  }, []);

  // ── 로그아웃 ─────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  // ── Google OAuth 로그인 ──────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'melodygen' });
    oauthCallbackProcessor.reset();

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      if (!data.url) throw new Error('Google OAuth URL was not created');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      // success는 즉시 처리한다. Android에서 dismiss가 먼저 반환되더라도
      // 전역 Linking 리스너가 동일 콜백을 처리하므로 로그인 결과가 유실되지 않는다.
      if (result.type === 'success') {
        await oauthCallbackProcessor.process(result.url);
      }
    } catch (error) {
      showGoogleSignInError(error);
    }
  }, [oauthCallbackProcessor, showGoogleSignInError]);

  // ── 비밀번호 변경 ─────────────────────────────────────────
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error;
  }, []);

  // ── 프로필 업데이트 ───────────────────────────────────────
  const updateProfile = useCallback(
    async (data: { display_name?: string }) => {
      if (!user) return i18n.t('common:error.loginRequired');
      const { error } = await supabase
        .from('profiles')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) return error.message;
      await loadProfile(user.id);
      return null;
    },
    [user, loadProfile],
  );

  // ── 회원 탈퇴 ────────────────────────────────────────────
  const deleteAccount = useCallback(async () => {
    if (!user) return i18n.t('common:error.loginRequired');

    // profiles 레코드 삭제 (CASCADE로 auth.users도 삭제됨)
    const { error: delError } = await supabase.from('profiles').delete().eq('id', user.id);

    if (delError) return delError.message;

    // 로컬 데이터 정리 (학습 데이터 키는 사용자 ID 접미사가 붙는다)
    await AsyncStorage.multiRemove([
      ...allLocalDataKeys(user.id),
      '@melodygen_onboarding_done',
    ]).catch(() => {});

    // auth.users 삭제 (security definer DB Function)
    const { error: authDelError } = await supabase.rpc('delete_own_account');
    if (authDelError) logger.warn('auth.users 삭제 실패:', authDelError.message);

    // RevenueCat 사용자 초기화 — 탈퇴 후 재가입 시 이전 구매 토큰이
    // oldPurchaseToken으로 사용되어 "구독 변경 불가" 오류가 나는 것을 방지
    await logoutRevenueCat().catch(() => {});

    await supabase.auth.signOut();
    return null;
  }, [user]);

  const isGuest = !session && guestMode;
  const storageUserId = user && migratingUserId !== user.id ? user.id : GUEST_STORAGE_ID;

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading: loading || guestLoading,
    profileLoading,
    isGuest,
    storageUserId,
    continueAsGuest,
    exitGuestMode,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    updatePassword,
    updateProfile,
    deleteAccount,
    reloadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
