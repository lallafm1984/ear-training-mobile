import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Music2, Check, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';
import LegalModal from '../components/LegalModal';
import type { LegalType } from '../components/LegalModal';

import GoogleLogo from '../components/GoogleLogo';

export default function LoginScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [legalType, setLegalType] = useState<LegalType | null>(null);

  const allAgreed = agreeTerms && agreePrivacy;

  const handleGoogle = async () => {
    if (!allAgreed) return;
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 로고 */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Music2 size={36} color="#6366f1" />
          </View>
          <Text style={styles.logoTitle}>MelodyGen</Text>
          <Text style={styles.logoSub}>{t('auth:login.tagline')}</Text>
        </View>

        {/* 약관 동의 */}
        <View style={styles.agreeSection}>
          {/* 전체 동의 */}
          <TouchableOpacity style={styles.agreeAllRow} onPress={toggleAll} activeOpacity={0.7}>
            <View style={[styles.checkbox, allAgreed && styles.checkboxChecked]}>
              {allAgreed && <Check size={12} color="#fff" />}
            </View>
            <Text style={styles.agreeAllText}>{t('auth:login.agreeAll')}</Text>
          </TouchableOpacity>

          <View style={styles.agreeDivider} />

          {/* 이용약관 */}
          <View style={styles.agreeRow}>
            <TouchableOpacity
              style={styles.agreeLeft}
              onPress={() => setAgreeTerms(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Check size={12} color="#fff" />}
              </View>
              <Text style={styles.agreeText}>{t('auth:login.termsAgree')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLegalType('terms')} hitSlop={8}>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* 개인정보처리방침 */}
          <View style={styles.agreeRow}>
            <TouchableOpacity
              style={styles.agreeLeft}
              onPress={() => setAgreePrivacy(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreePrivacy && styles.checkboxChecked]}>
                {agreePrivacy && <Check size={12} color="#fff" />}
              </View>
              <Text style={styles.agreeText}>{t('auth:login.privacyAgree')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLegalType('privacy')} hitSlop={8}>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Google 로그인 버튼 */}
        <TouchableOpacity
          style={[styles.googleBtn, (!allAgreed || loading) && { opacity: 0.4 }]}
          onPress={handleGoogle}
          disabled={!allAgreed || loading}
        >
          {loading
            ? <ActivityIndicator color="#374151" size="small" />
            : <GoogleLogo size={20} />}
          <Text style={styles.googleBtnText}>{t('auth:login.googleButton')}</Text>
        </TouchableOpacity>

        {!allAgreed && (
          <Text style={styles.agreeHint}>{t('auth:login.agreeHint')}</Text>
        )}
      </View>

      {/* 약관 모달 */}
      {legalType && (
        <LegalModal
          visible
          type={legalType}
          onClose={() => setLegalType(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },

  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logoIcon: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  logoTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: '#94a3b8', marginTop: 6 },

  // 약관 동의
  agreeSection: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 20,
  },
  agreeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  agreeAllText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  agreeDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  agreeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  agreeText: {
    fontSize: 13,
    color: '#475569',
  },
  agreeRequired: {
    color: '#6366f1',
    fontWeight: '700',
  },
  agreeHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 10,
  },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 16, height: 56,
    width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
