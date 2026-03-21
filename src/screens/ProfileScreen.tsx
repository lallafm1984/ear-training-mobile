import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User, Mail, Crown, LogOut, Trash2, Lock, ChevronRight,
  Check, X, Edit3, Shield, Zap,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { PLAN_NAME, PLAN_COLOR } from '../types/subscription';
import GenShopModal from '../components/GenShopModal';

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
// 서브 모달: 비밀번호 변경
// ─────────────────────────────────────────────────────────────

function ChangePasswordModal({
  visible, onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { updatePassword } = useAuth();
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = newPw.length >= 6 && newPw === confirm;

  const handle = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    const err = await updatePassword(newPw);
    setSaving(false);
    if (err) {
      Alert.alert('오류', err.message);
    } else {
      Alert.alert('완료', '비밀번호가 변경되었습니다.');
      setNewPw(''); setConfirm('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <Text style={styles.modalTitle}>비밀번호 변경</Text>

          <Text style={styles.modalFieldLabel}>새 비밀번호</Text>
          <TextInput
            style={styles.modalInput}
            value={newPw}
            onChangeText={setNewPw}
            placeholder="6자 이상"
            placeholderTextColor="#cbd5e1"
            secureTextEntry
            autoFocus
          />

          <Text style={styles.modalFieldLabel}>비밀번호 확인</Text>
          <TextInput
            style={[styles.modalInput, confirm && newPw !== confirm && { borderColor: '#ef4444' }]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="비밀번호를 다시 입력하세요"
            placeholderTextColor="#cbd5e1"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handle}
          />
          {confirm && newPw !== confirm && (
            <Text style={styles.errorText}>비밀번호가 일치하지 않습니다.</Text>
          )}

          <View style={[styles.modalBtnRow, { marginTop: 16 }]}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, (!isValid || saving) && { opacity: 0.5 }]}
              onPress={handle}
              disabled={!isValid || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSaveText}>변경</Text>}
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
  const { tier, subscriptionState, isExpired, genBalance } = useSubscription();

  const [showEditName, setShowEditName] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showGenShop, setShowGenShop] = useState(false);

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
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          onClose();
        },
      },
    ]);
  };

  // ── 회원 탈퇴 ────────────────────────────────────────────
  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.\n\n정말 탈퇴하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            const err = await deleteAccount();
            if (err) Alert.alert('오류', err);
            else onClose();
          },
        },
      ],
    );
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
        <Text style={styles.headerTitle}>계정 설정</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 프로필 카드 ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.avatarEditBtn}
              onPress={() => setShowEditName(true)}
            >
              <Edit3 size={12} color="#6366f1" />
            </TouchableOpacity>
          </View>
          {profileLoading ? (
            <ActivityIndicator color="#6366f1" style={{ marginTop: 8 }} />
          ) : (
            <>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
            </>
          )}

          {/* 플랜 배지 */}
          <TouchableOpacity
            style={[styles.planBadge, { backgroundColor: `${tierColor}18`, borderColor: `${tierColor}44` }]}
            onPress={tier === 'free' ? onGoToPaywall : undefined}
          >
            <Crown size={13} color={tierColor} />
            <Text style={[styles.planBadgeText, { color: tierColor }]}>
              {PLAN_NAME[tier]} 플랜
              {isExpired ? ' (만료)' : ''}
            </Text>
            {tier === 'free' && (
              <Text style={[styles.planUpgradeText, { color: tierColor }]}>업그레이드 →</Text>
            )}
          </TouchableOpacity>

          {expiresLabel && (
            <Text style={styles.expiresText}>만료일: {expiresLabel}</Text>
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
                onPress={() => Alert.alert(
                  '구독 취소',
                  'Google Play 또는 App Store에서 구독을 취소할 수 있습니다.',
                  [{ text: '확인' }],
                )}
              />
            )}
          </View>
        </View>

        {/* ── Gen 잔액 섹션 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gen 잔액</Text>
          <View style={styles.sectionCard}>
            <View style={styles.genRow}>
              <View style={styles.genLeft}>
                <Zap size={16} color="#6366f1" />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.genLabel}>현재 잔액</Text>
                  <Text style={styles.genDesc}>
                    {tier === 'premium'
                      ? '무제한 (Premium)'
                      : tier === 'pro'
                      ? '매일 오전 6시 +200 Gen 충전'
                      : '매일 오전 6시 +100 Gen 충전'}
                  </Text>
                </View>
              </View>
              <View style={styles.genRight}>
                <Text style={styles.genBalance}>
                  {tier === 'premium' ? '∞' : genBalance.toLocaleString()}
                </Text>
                {tier !== 'premium' && (
                  <TouchableOpacity
                    style={styles.genChargeBtn}
                    onPress={() => setShowGenShop(true)}
                  >
                    <Text style={styles.genChargeBtnText}>+ 충전</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
            <MenuItem
              icon={<Lock size={16} color="#64748b" />}
              label="비밀번호 변경"
              onPress={() => setShowChangePw(true)}
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
      <ChangePasswordModal
        visible={showChangePw}
        onClose={() => setShowChangePw(false)}
      />
      <GenShopModal
        visible={showGenShop}
        onClose={() => setShowGenShop(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { padding: 16, paddingBottom: 40 },

  // 프로필 카드
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#6366f1' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },

  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, marginBottom: 4,
  },
  planBadgeText: { fontSize: 13, fontWeight: 'bold' },
  planUpgradeText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  expiresText: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // 섹션
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: 'bold', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // Gen 잔액
  genRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  genLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  genLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  genDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  genRight: { alignItems: 'flex-end', gap: 6 },
  genBalance: { fontSize: 22, fontWeight: '800', color: '#6366f1' },
  genChargeBtn: {
    backgroundColor: '#6366f1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  genChargeBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },

  // 메뉴 아이템
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  menuIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  menuValue: { fontSize: 12, color: '#94a3b8', maxWidth: 120 },

  versionText: { fontSize: 11, color: '#cbd5e1', textAlign: 'center', marginTop: 8 },

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
