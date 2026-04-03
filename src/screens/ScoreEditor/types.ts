import type { ScoreState } from '../../lib';

export interface SavedScore {
  id: string;
  title: string;
  state: ScoreState;
  savedAt: string;
}
