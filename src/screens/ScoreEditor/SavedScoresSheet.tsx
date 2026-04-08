import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Save, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../../components/BottomSheet';
import type { SavedScore } from './types';
import { styles } from './styles';

interface SavedScoresSheetProps {
  open: boolean;
  onClose: () => void;
  savedScores: SavedScore[];
  onSave: () => void;
  onLoad: (score: SavedScore) => void;
  onDelete: (id: string) => void;
}

export default function SavedScoresSheet({
  open,
  onClose,
  savedScores,
  onSave,
  onLoad,
  onDelete,
}: SavedScoresSheetProps) {
  const { t } = useTranslation('editor');
  return (
    <BottomSheet open={open} onClose={onClose} title={t('savedScores.title')}>
      <TouchableOpacity
        style={[styles.bsPrimaryBtn, { backgroundColor: '#10b981', marginBottom: 16 }]}
        onPress={onSave}
      >
        <Save size={15} color="#fff" />
        <Text style={styles.bsPrimaryBtnText}>{t('savedScores.saveCurrent')}</Text>
      </TouchableOpacity>

      {savedScores.length === 0 ? (
        <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginVertical: 24 }}>
          {t('savedScores.empty')}
        </Text>
      ) : (
        savedScores.map(s => (
          <View key={s.id} style={styles.savedCard}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>
              {s.title}
            </Text>
            <Text style={{ fontSize: 11, color: '#94a3b8', marginVertical: 4 }}>
              {s.state.keySignature} · {s.state.timeSignature} · {s.state.tempo}BPM ·{' '}
              {new Date(s.savedAt).toLocaleDateString('ko-KR')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => onLoad(s)}
                style={[styles.savedBtn, { flex: 1, backgroundColor: '#eef2ff' }]}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6366f1' }}>{t('savedScores.open')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(s.id)}
                style={[styles.savedBtn, { backgroundColor: '#fef2f2' }]}
              >
                <Trash2 size={13} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </BottomSheet>
  );
}
