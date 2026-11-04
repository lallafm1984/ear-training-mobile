import React, { useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../context/AlertContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { modalCardWidth } from '../lib/layout';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeSupportedLanguage,
} from '../i18n/language';
import { COLORS } from '../theme/colors';

export default function LanguagePickerModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation(['profile', 'common']);
  const { showAlert } = useAlert();
  const layout = useResponsiveLayout();
  const [selected, setSelected] = useState(
    () => normalizeSupportedLanguage(i18n.language) ?? DEFAULT_LANGUAGE,
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const apply = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await i18n.changeLanguage(selected);
      onClose();
    } catch {
      showAlert({
        title: t('profile:alert.error'),
        message: t('profile:language.error'),
        type: 'error',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common:button.close')}
        />
        <View
          style={[styles.card, { width: modalCardWidth(layout.width, 48) }]}
          accessibilityViewIsModal
        >
          <ScrollView bounces={false}>
            <Text style={styles.title}>{t('profile:language.title')}</Text>
            <Text style={styles.description}>{t('profile:language.choose')}</Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {SUPPORTED_LANGUAGES.map((language) => (
                <Pressable
                  key={language}
                  accessibilityRole="radio"
                  accessibilityLabel={t(`profile:language.${language}`)}
                  accessibilityState={{ checked: selected === language, disabled: saving }}
                  disabled={saving}
                  onPress={() => setSelected(language)}
                  style={[styles.option, selected === language && styles.optionSelected]}
                >
                  <Text style={styles.optionText}>{t(`profile:language.${language}`)}</Text>
                  <View style={[styles.radio, selected === language && styles.radioSelected]}>
                    {selected === language && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.cancelButton]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t('common:button.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={apply}
              disabled={saving}
              style={[styles.button, styles.applyButton, saving && styles.disabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              <Text style={styles.applyText}>{t('profile:language.apply')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgOverlay,
    padding: 24,
  },
  card: { maxHeight: '90%', backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.slate800 },
  description: { fontSize: 14, lineHeight: 21, color: COLORS.slate600, marginTop: 8 },
  options: { marginTop: 20, gap: 8 },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.slate50,
  },
  optionSelected: { backgroundColor: COLORS.primary50 },
  optionText: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.slate800 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.slate500 },
  radioSelected: { borderColor: COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary600 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  button: {
    flex: 1,
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cancelButton: { backgroundColor: COLORS.slate100 },
  applyButton: { backgroundColor: COLORS.primary600 },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.slate700 },
  applyText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  disabled: { opacity: 0.6 },
});
