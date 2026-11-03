// ─────────────────────────────────────────────────────────────
// ShareCardModal — 결과 공유 카드 미리보기 + 이미지/텍스트 공유
// ─────────────────────────────────────────────────────────────

import React, { useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { X, ImageIcon, MessageSquareText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme/colors';
import { useAlert } from '../context';
import { logger } from '../lib/logger';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  SHARE_STORE_URL,
  buildShareText,
  shareCardFileName,
  type ShareCardData,
} from '../lib/shareCard';
import ShareResultCard from './ShareResultCard';

interface Props {
  /** null이면 닫힌 상태 */
  data: ShareCardData | null;
  onClose: () => void;
}

export default function ShareCardModal({ data, onClose }: Props) {
  const { t } = useTranslation(['share', 'common']);
  const { showAlert } = useAlert();
  const layout = useResponsiveLayout();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState<'image' | 'text' | null>(null);

  const shareText = useCallback(async () => {
    if (!data) return;
    const message = buildShareText(data, {
      brand: t('share:card.brand'),
      footer: t('share:text.footer'),
      storeUrl: SHARE_STORE_URL,
    });
    await Share.share({ message });
  }, [data, t]);

  const handleShareImage = useCallback(async () => {
    if (!data || busy) return;
    setBusy('image');
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await shareText();
        return;
      }
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        fileName: shareCardFileName(data.kind),
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: t('share:modal.dialogTitle'),
      });
    } catch (e) {
      logger.warn('[share] 이미지 공유 실패:', e);
      showAlert({
        title: t('share:error.title'),
        message: t('share:error.message'),
        type: 'error',
      });
    } finally {
      setBusy(null);
    }
  }, [busy, data, shareText, showAlert, t]);

  const handleShareText = useCallback(async () => {
    if (!data || busy) return;
    setBusy('text');
    try {
      await shareText();
    } catch (e) {
      logger.warn('[share] 텍스트 공유 실패:', e);
      showAlert({
        title: t('share:error.title'),
        message: t('share:error.message'),
        type: 'error',
      });
    } finally {
      setBusy(null);
    }
  }, [busy, data, shareText, showAlert, t]);

  return (
    <Modal
      visible={data !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, layout.sheetStyle]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('share:modal.title')}</Text>
              <Text style={styles.hint}>{t('share:modal.hint')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={COLORS.slate500} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            {data && (
              <View ref={cardRef} collapsable={false} style={styles.captureArea}>
                <ShareResultCard data={data} />
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, busy !== null && styles.btnDisabled]}
              onPress={handleShareImage}
              disabled={busy !== null}
              activeOpacity={0.85}
            >
              {busy === 'image' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ImageIcon size={18} color="#fff" />
              )}
              <Text style={styles.primaryBtnText}>{t('share:modal.image')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, busy !== null && styles.btnDisabled]}
              onPress={handleShareText}
              disabled={busy !== null}
              activeOpacity={0.85}
            >
              {busy === 'text' ? (
                <ActivityIndicator color={COLORS.primary600} />
              ) : (
                <MessageSquareText size={18} color={COLORS.primary600} />
              )}
              <Text style={styles.ghostBtnText}>{t('share:modal.text')}</Text>
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
    backgroundColor: COLORS.bgOverlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgPrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate800 },
  hint: { fontSize: 12, color: COLORS.slate500, marginTop: 2 },
  closeBtn: { padding: 4 },
  previewScroll: { flexGrow: 0 },
  previewContent: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  captureArea: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    backgroundColor: COLORS.bgCard,
  },
  actions: { paddingHorizontal: 20, marginTop: 16, gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary600,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.primary50,
    borderWidth: 1,
    borderColor: COLORS.primary200,
  },
  ghostBtnText: { color: COLORS.primary700, fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
});
