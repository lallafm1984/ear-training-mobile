import React from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { styles } from './styles';

interface LoadingModalProps {
  visible: boolean;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ visible }) => {
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
          <Text style={styles.aiLoadingTitle}>AI가 악보를 생성 중입니다</Text>
          <Text style={styles.aiLoadingSubtitle}>잠시만 기다려주세요...</Text>
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
