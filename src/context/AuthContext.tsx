import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** 현재 세션 (null = 미로그인) */
  session:  Session | null;
  /** 현재 유저 */
  user:     User | null;
  /** profiles 테이블 데이터 */
  profile:  Profile | null;
  /** 초기 세션 로딩 중 */
  loading:  boolean;
  /** 프로필 갱신 중 */
  profileLoading: boolean;

  /** 이메일+비밀번호 로그인 */
  signIn:   (email: string, password: string) => Promise<AuthError | null>;
  /** 이메일+비밀번호 회원가입 */
  signUp:   (email: string, password: string, displayName: string) => Promise<AuthError | null>;
  /** 로그아웃 */
  signOut:  () => Promise<void>;
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
  const [session,        setSession]        = useState<Session | null>(null);
  const [user,           setUser]           = useState<User | null>(null);
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── 프로필 로드 ──────────────────────────────────────────
  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        console.warn('[AuthContext] 프로필 로드 실패:', error.message);
      } else {
        setProfile(data as Profile);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  // ── 세션 초기화 + onAuthStateChange 리스너 ────────────────
  useEffect(() => {
    // 앱 시작 시 기존 세션 복원
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  // ── 로그인 ───────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  // ── 회원가입 ─────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string, password: string, displayName: string,
  ) => {
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

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      console.warn('[Google OAuth] URL 생성 실패:', error?.message);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success') {
      const url = result.url;
      // PKCE flow: code 파라미터 추출
      const qs = url.includes('?') ? url.split('?')[1] : url.split('#')[1] ?? '';
      const params = new URLSearchParams(qs);
      const code = params.get('code');

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        // Implicit flow fallback: hash에서 토큰 추출
        const hash = new URLSearchParams(url.split('#')[1] ?? '');
        const accessToken  = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    }
  }, []);

  // ── 비밀번호 변경 ─────────────────────────────────────────
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error;
  }, []);

  // ── 프로필 업데이트 ───────────────────────────────────────
  const updateProfile = useCallback(async (data: { display_name?: string }) => {
    if (!user) return '로그인이 필요합니다.';
    const { error } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return error.message;
    await loadProfile(user.id);
    return null;
  }, [user, loadProfile]);

  // ── 회원 탈퇴 ────────────────────────────────────────────
  const deleteAccount = useCallback(async () => {
    if (!user) return '로그인이 필요합니다.';

    // profiles 레코드 삭제 (CASCADE로 auth.users도 삭제됨)
    const { error: delError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (delError) return delError.message;

    // auth.users 삭제는 service_role key가 필요하므로
    // Edge Function 호출 또는 Supabase Dashboard에서 처리.
    // 현재는 세션만 종료합니다.
    await supabase.auth.signOut();
    return null;
  }, [user]);

  const value: AuthContextValue = {
    session, user, profile, loading, profileLoading,
    signIn, signUp, signOut, signInWithGoogle,
    updatePassword, updateProfile, deleteAccount, reloadProfile,
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
