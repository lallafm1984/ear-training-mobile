import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Dimensions,
} from 'react-native';
import { Crown, Lock, X, Check } from 'lucide-react-native';
import { PLAN_NAME, PLAN_COLOR } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type UpgradeReason =
  | 'grand_staff'
  | 'exam_mode'
  | 'difficulty'
  | 'measures'
  | 'edit_notes'
  | 'download_audio'
  | 'download_image'
  | 'save_scores'
  | 'key_signature'
  | 'time_signature';

const REASON_INFO: Record<UpgradeReason, {
  title: string;
  description: string;
  benefits: string[];
}> = {
  grand_staff: {
    title: '큰보표 (Grand Staff)',
    description: '피아노 악보를 위한 높은음자리 + 낮은음자리 큰보표는 Pro에서 사용 가능합니다.',
    benefits: ['큰보표 악보 생성', '베이스 성부 동시 입력', '고급 편집 기능'],
  },
  exam_mode: {
    title: '시험 모드',
    description: '실제 시험과 같은 환경의 마디별 재생 모드는 Pro에서 사용 가능합니다.',
    benefits: ['시험 모드 재생', '구간 대기 시간 설정', '실제 시험 환경 구성'],
  },
  difficulty: {
    title: '중급·고급 난이도',
    description: '초급 이상의 난이도는 Pro에서 사용 가능합니다.',
    benefits: ['중급: 8분음표·임시표·3연음', '고급: 16분음표·아르페지오', '모든 난이도 선택'],
  },
  measures: {
    title: '8마디 이상 생성',
    description: '4마디 초과 악보 생성은 Pro에서 사용 가능합니다.',
    benefits: ['8·12·16마디 악보 생성', '긴 청음 문제 출제', '다양한 구성 연습'],
  },
  edit_notes: {
    title: '음표 편집',
    description: '생성된 악보의 음표 수정은 Pro 플랜에서 사용할 수 있습니다.',
    benefits: ['음표 음정·길이 수정', '개별 음표 삭제', '세밀한 악보 편집'],
  },
  download_audio: {
    title: '음원 다운로드',
    description: '청음 음원(MP3) 다운로드는 Pro 플랜 전용 기능입니다.',
    benefits: ['MP3 음원 무제한 다운로드', '음원·악보 이미지 무제한 저장', '음표 편집 기능 포함'],
  },
  download_image: {
    title: '악보 이미지 저장',
    description: '악보 이미지(PNG) 저장은 Pro 플랜 전용 기능입니다.',
    benefits: ['PNG 이미지 무제한 갤러리 저장', 'MP3 음원 무제한 다운로드', '음표 편집 기능 포함'],
  },
  save_scores: {
    title: '악보 저장 한도 초과',
    description: '현재 플랜의 악보 저장 한도를 초과했습니다.\nFree: 5개 · Pro: 20개',
    benefits: ['Pro: 최대 20개 악보 저장', '저장된 악보 언제든 불러오기', '모든 기능 잠금 해제'],
  },
  key_signature: {
    title: '다양한 조성',
    description: 'Free 플랜에서는 다장조(C)만 사용할 수 있습니다.\nPro에서 모든 장조·단조를 이용해보세요.',
    benefits: ['24개 장조·단조 모두 사용', '5도권 전체 조성 연습', '실전 시험 대비 필수'],
  },
  time_signature: {
    title: '다양한 박자',
    description: 'Free 플랜에서는 4/4박자만 사용할 수 있습니다.\nPro에서 모든 박자를 이용해보세요.',
    benefits: ['3/4, 6/8, 12/8 등 전체 박자', '복합 박자 연습', '다양한 리듬 패턴 훈련'],
  },
};

interface UpgradeModalProps {
  visible: boolean;
  reason: UpgradeReason;
  onClose: () => void;
  /** 요금제 화면으로 이동 콜백 */
  onGoToPaywall: () => void;
}

export default function UpgradeModal({ visible, reason, onClose, onGoToPaywall }: UpgradeModalProps) {
  const info = REASON_INFO[reason];
  const tierColor = PLAN_COLOR.pro;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container}>
          {/* 닫기 버튼 */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* 자물쇠 아이콘 */}
          <View style={[styles.iconWrap, { backgroundColor: `${tierColor}22` }]}>
            <Lock size={28} color={tierColor} />
          </View>

          {/* 제목 */}
          <Text style={styles.title}>{info.title}</Text>
          <View style={[styles.tierBadge, { backgroundColor: `${tierColor}22` }]}>
            <Crown size={11} color={tierColor} />
            <Text style={[styles.tierBadgeText, { color: tierColor }]}>
              Pro 이상
            </Text>
          </View>
          <Text style={styles.description}>{info.description}</Text>

          {/* 혜택 목록 */}
          <View style={styles.benefitList}>
            {info.benefits.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Check size={13} color="#10b981" />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {/* CTA 버튼 */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: tierColor }]}
            onPress={() => { onClose(); onGoToPaywall(); }}
          >
            <Crown size={15} color="#fff" />
            <Text style={styles.ctaBtnText}>
              Pro 플랜 시작하기
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>나중에 하기</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitList: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#1e293b',
  },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
