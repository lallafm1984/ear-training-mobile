import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Sparkles, X, Crown } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AdModalProps {
  visible: boolean;
  onClose: () => void;
  /** 광고 시청 완료 콜백 */
  onAdWatched?: () => void;
  /** 업그레이드 버튼 클릭 콜백 */
  onUpgrade?: () => void;
}

/** 광고 스킵 가능까지 남은 초 */
const AD_SKIP_SECONDS = 5;

/**
 * 무료 유저 전면 광고 모달.
 * 실제 AdMob 연동 전까지 모의(Mock) 광고 UI를 표시합니다.
 * AdMob 연동 시 이 컴포넌트 내부에서 InterstitialAd.show()를 호출하세요.
 */
export default function AdModal({ visible, onClose, onAdWatched, onUpgrade }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(AD_SKIP_SECONDS);
  const [canSkip, setCanSkip]         = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(AD_SKIP_SECONDS);
      setCanSkip(false);
      progressAnim.setValue(0);
      return;
    }

    // 프로그레스 바 애니메이션
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: AD_SKIP_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    // 카운트다운
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  const handleSkip = () => {
    if (!canSkip) return;
    onAdWatched?.();
    onClose();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={canSkip ? handleSkip : undefined}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 광고 라벨 */}
          <View style={styles.adLabelRow}>
            <Text style={styles.adLabel}>광고</Text>
            <Text style={styles.adLabelSub}>MelodyGen 무료 버전</Text>
          </View>

          {/* ── 모의 광고 배너 영역 ──
              실제 AdMob 연동 시 이 View를 AdMob 컴포넌트로 교체하세요.
              예: <InterstitialAd unitId="ca-app-pub-xxx" ... /> */}
          <View style={styles.adBanner}>
            <Sparkles size={48} color="#6366f1" />
            <Text style={styles.adBannerTitle}>MelodyGen Pro</Text>
            <Text style={styles.adBannerBody}>
              광고 없이 무제한 청음 훈련{'\n'}모든 난이도 · 큰보표 · 음원 다운로드
            </Text>
            {/* ── AdMob 실제 광고 영역 (주석 처리된 플레이스홀더) ──
            <BannerAd
              unitId={TestIds.BANNER}
              size={BannerAdSize.FULL_BANNER}
            />
            */}
          </View>

          {/* 프로그레스 바 */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>

          {/* 하단 버튼 영역 */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.upgradeBtn]}
              onPress={() => { onClose(); onUpgrade?.(); }}
            >
              <Crown size={14} color="#fff" />
              <Text style={styles.upgradeBtnText}>Pro로 광고 제거</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkip}
              disabled={!canSkip}
              style={[styles.skipBtn, !canSkip && styles.skipBtnDisabled]}
            >
              {canSkip ? (
                <>
                  <X size={14} color="#64748b" />
                  <Text style={styles.skipBtnText}>건너뛰기</Text>
                </>
              ) : (
                <Text style={styles.skipCountText}>{secondsLeft}초 후 건너뛰기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  adLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  adLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#94a3b8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adLabelSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  adBanner: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: '#f8f7ff',
    gap: 12,
  },
  adBannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  adBannerBody: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#e2e8f0',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#6366f1',
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  upgradeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipBtnDisabled: {
    opacity: 0.5,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748b',
  },
  skipCountText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
});
