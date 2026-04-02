import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// SecureStore 어댑터 (네이티브) / localStorage 어댑터 (웹)
// ─────────────────────────────────────────────────────────────

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === 'web'
  ? undefined  // 웹: supabase 기본 localStorage 사용
  : ExpoSecureStoreAdapter;

// ─────────────────────────────────────────────────────────────
// Supabase 클라이언트
// ─────────────────────────────────────────────────────────────

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: storage as any,
    autoRefreshToken:     true,
    persistSession:       true,
    detectSessionInUrl:   false,
  },
});

// ─────────────────────────────────────────────────────────────
// Database 타입 (profiles 테이블)
// ─────────────────────────────────────────────────────────────

export interface Profile {
  id:                    string;   // auth.users.id
  email:                 string;
  display_name:          string | null;
  avatar_url:            string | null;
  tier:                  'free' | 'pro';
  subscription_expires_at: string | null;
  monthly_download_count:  number;
  download_reset_month:    string;
  created_at:            string;
  updated_at:            string;
}
