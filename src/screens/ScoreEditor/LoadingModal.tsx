import React from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styles } from './styles';

interface LoadingModalProps {
  visible: boolean;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ visible }) => {
  const { t } = useTranslation('editor');
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.aiLoadingOverlay}>
        <View style={styles.aiLoadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.aiLoadingTitle}>{t('loading.title')}</Text>
          <Text style={styles.aiLoadingSubtitle}>{t('loading.subtitle')}</Text>
          <View style={styles.aiLoadingDots}>
            <View style={[styles.aiLoadingDot, { backgroundColor: '#6366f1' }]} />
            <View style={[styles.aiLoadingDot, { backgroundColor: '#818cf8' }]} />
            <View style={[styles.aiLoadingDot, { backgroundColor: '#a5b4fc' }]} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LoadingModal;
