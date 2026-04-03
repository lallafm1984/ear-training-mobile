import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { X, Copy } from 'lucide-react-native';

interface AbcNotationModalProps {
  visible: boolean;
  onClose: () => void;
  abcString: string;
  onCopy: () => void;
}

const AbcNotationModal: React.FC<AbcNotationModalProps> = ({
  visible,
  onClose,
  abcString,
  onCopy,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.abcModalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.abcModalCard}>
          <View style={styles.abcModalHeader}>
            <Text style={styles.abcModalTitle}>ABC Notation</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.abcModalCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <Text style={styles.abcModalHint}>
            생성된 악보의 ABC 표기법입니다. (테스트용)
          </Text>
          <ScrollView
            style={styles.abcModalScroll}
            contentContainerStyle={styles.abcModalScrollContent}
            nestedScrollEnabled
          >
            <Text selectable style={styles.abcModalText}>
              {abcString}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.abcModalCopyBtn}
            onPress={onCopy}
            activeOpacity={0.85}
          >
            <Copy size={16} color="#ffffff" />
            <Text style={styles.abcModalCopyBtnText}>텍스트 전체 복사</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  abcModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  abcModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  abcModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  abcModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  abcModalCloseBtn: {
    padding: 4,
  },
  abcModalHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  abcModalScroll: {
    maxHeight: 360,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  abcModalScrollContent: {
    padding: 12,
    paddingBottom: 16,
  },
  abcModalText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#334155',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  abcModalCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
  },
  abcModalCopyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AbcNotationModal;
