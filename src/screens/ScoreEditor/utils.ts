import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NoteDuration } from '../../lib';
import type { SavedScore } from './types';

const STORAGE_KEY = 'melodygen_scores';

// ── 쉼표 채우기 유틸 ──
export function fillWithRests(sixteenths: number): NoteDuration[] {
  if (sixteenths <= 0) return [];
  const OPTIONS: [NoteDuration, number][] = [
    ['1', 16], ['2.', 12], ['2', 8], ['4.', 6], ['4', 4], ['8.', 3], ['8', 2], ['16', 1],
  ];
  const result: NoteDuration[] = [];
  let rem = sixteenths;
  for (const [dur, s] of OPTIONS) {
    while (rem >= s) { result.push(dur); rem -= s; }
  }
  return result;
}

export async function getSavedScores(): Promise<SavedScore[]> {
  try {
    const j = await AsyncStorage.getItem(STORAGE_KEY);
    return j ? JSON.parse(j) : [];
  } catch {
    return [];
  }
}

export async function persistScores(s: SavedScore[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
