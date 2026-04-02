import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User, Mail, Crown, LogOut, Trash2, ChevronRight,
  Check, X, Shield,
} from 'lucide-react-native';
import { useAlert, useAuth, useSubscription } from '../context';
import { PLAN_NAME, PLAN_COLOR } from '../types';

interface ProfileScreenProps {
  onClose: () => void;
  onGoToPaywall: () => void;
}

// ─────────────────────────────────────────────────────────────
// 서브 모달: 닉네임 편집
// ─────────────────────────────────────────────────────────────

function EditNameModal({
  visible, currentName, onSave, onClose,
}: {
  visible: boolean;
  currentName: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (name.trim().length < 2 || saving) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <Text style={styles.modalTitle}>닉네임 변경</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder="2자 이상 입력"
            placeholderTextColor="#cbd5e1"
            autoFocus
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handle}
          />
          <Text style={styles.modalHint}>{name.trim().length} / 20자</Text>
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, (name.trim().length < 2 || saving) && { opacity: 0.5 }]}
              onPress={handle}
              disabled={name.trim().length < 2 || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSaveText}>저장</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────────
// 메인 ProfileScreen
// ─────────────────────────────────────────────────────────────

export default function ProfileScreen({ onClose, onGoToPaywall }: ProfileScreenProps) {
  const { user, profile, signOut, updateProfile, deleteAccount, profileLoading } = useAuth();
  const { tier, subscriptionState, isExpired } = useSubscription();

  const { showAlert } = useAlert();

  const [showEditName, setShowEditName] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const tierColor = PLAN_COLOR[tier];
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? '사용자';
  const email = user?.email ?? '';

  // ── 구독 만료일 포맷 ──────────────────────────────────────
  const expiresLabel = (() => {
    if (tier === 'free') return null;
    if (!subscriptionState.expiresAt) return null;
    return new Date(subscriptionState.expiresAt).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  })();

  // ── 로그아웃 ─────────────────────────────────────────────
  const handleSignOut = () => {
    showAlert({
      title: '로그아웃',
      message: '정말 로그아웃 하시겠습니까?',
      type: 'warning',
      buttons: [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          onClose();
        }},
      ],
    });
  };

  // ── 회원 탈퇴 ────────────────────────────────────────────
  const handleDeleteAccount = () => {
    showAlert({
      title: '회원 탈퇴',
      message: '계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.\n\n정말 탈퇴하시겠습니까?',
      type: 'warning',
      buttons: [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴하기', style: 'destructive', onPress: async () => {
          const err = await deleteAccount();
          if (err) showAlert({ title: '오류', message: err, type: 'error' });
          else onClose();
        }},
      ],
    });
  };

  // ─── 섹션 아이템 헬퍼 ─────────────────────────────────────
  const MenuItem = ({
    icon, label, value, onPress, danger = false, disabled = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.menuItem, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconWrap, danger && { backgroundColor: '#fef2f2' }]}>
        {icon}
      </View>
      <Text style={[styles.menuLabel, danger && { color: '#ef4444' }]}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      {onPress && <ChevronRight size={14} color={danger ? '#ef4444' : '#cbd5e1'} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 프로필 히어로 카드 ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardAccent} />
          {profileLoading ? (
            <ActivityIndicator color="#6366f1" style={{ padding: 24 }} />
          ) : (
            <View style={styles.profileCardBody}>
              <View style={styles.profileInitialBadge}>
                <Text style={styles.profileInitialText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileTextBlock}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileEmail}>{email}</Text>
                <TouchableOpacity
                  style={[styles.planBadge, { backgroundColor: `${tierColor}18`, borderColor: `${tierColor}40` }]}
                  onPress={tier === 'free' ? onGoToPaywall : undefined}
                  activeOpacity={tier === 'free' ? 0.7 : 1}
                >
                  <Crown size={11} color={tierColor} />
                  <Text style={[styles.planBadgeText, { color: tierColor }]}>
                    {PLAN_NAME[tier]}{isExpired ? ' (만료)' : ''}
                  </Text>
                </TouchableOpacity>
                {expiresLabel && (
                  <Text style={styles.expiresText}>만료일: {expiresLabel}</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── 구독 섹션 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>구독</Text>
          <View style={styles.sectionCard}>
            <MenuItem
              icon={<Crown size={16} color={tierColor} />}
              label="요금제 관리"
              value={PLAN_NAME[tier]}
              onPress={() => { onClose(); onGoToPaywall(); }}
            />
            {tier !== 'free' && (
              <MenuItem
                icon={<Shield size={16} color="#64748b" />}
                label="구독 취소"
                value="스토어에서 관리"
                onPress={() => showAlert({
                  title: '구독 취소',
                  message: 'Google Play 또는 App Store에서 구독을 취소할 수 있습니다.',
                  type: 'info',
                })}
              />
            )}
          </View>
        </View>

        {/* ── 계정 섹션 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>
          <View style={styles.sectionCard}>
            <MenuItem
              icon={<User size={16} color="#64748b" />}
              label="닉네임 변경"
              value={displayName}
              onPress={() => setShowEditName(true)}
            />
            <MenuItem
              icon={<Mail size={16} color="#64748b" />}
              label="이메일"
              value={email}
            />
          </View>
        </View>

        {/* ── 기타 섹션 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기타</Text>
          <View style={styles.sectionCard}>
            <MenuItem
              icon={<LogOut size={16} color="#64748b" />}
              label={signingOut ? '로그아웃 중...' : '로그아웃'}
              onPress={handleSignOut}
              disabled={signingOut}
            />
            <MenuItem
              icon={<Trash2 size={16} color="#ef4444" />}
              label="회원 탈퇴"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        <Text style={styles.versionText}>MelodyGen v1.0.0</Text>
      </ScrollView>

      {/* 서브 모달들 */}
      <EditNameModal
        visible={showEditName}
        currentName={displayName}
        onSave={name => updateProfile({ display_name: name }).then(() => { })}
        onClose={() => setShowEditName(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 4 },

  // 프로필 히어로 카드
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  profileCardAccent: {
    height: 6,
    backgroundColor: '#6366f1',
  },
  profileCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  profileInitialBadge: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  profileInitialText: {
    fontSize: 22, fontWeight: '800', color: '#6366f1',
  },
  profileTextBlock: { flex: 1, gap: 4 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  profileEmail: { fontSize: 12, color: '#94a3b8', marginBottom: 6 },

  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  planBadgeText: { fontSize: 12, fontWeight: '700' },
  planUpgradeText: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  expiresText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // 섹션
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Gen 잔액
  genRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  genLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  genLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  genDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  genRight: { alignItems: 'flex-end', gap: 8 },
  genBalance: { fontSize: 26, fontWeight: '800', color: '#6366f1' },
  genChargeBtn: {
    backgroundColor: '#6366f1', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  genChargeBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },

  // 메뉴 아이템
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 14,
  },
  menuIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  menuValue: { fontSize: 12, color: '#94a3b8', maxWidth: 130 },

  versionText: { fontSize: 11, color: '#cbd5e1', textAlign: 'center', marginTop: 16 },

  // 공통 모달
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: '#ffffff',
    borderRadius: 20, padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  modalInput: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b', marginBottom: 4,
  },
  modalHint: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginBottom: 16 },
  errorText: { fontSize: 11, color: '#ef4444', marginBottom: 8 },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  modalSaveBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#6366f1', alignItems: 'center',
  },
  modalSaveText: { fontSize: 14, fontWeight: 'bold', color: '#ffffff' },
});
