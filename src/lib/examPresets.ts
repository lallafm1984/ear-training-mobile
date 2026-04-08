// ─────────────────────────────────────────────────────────────
// 모의시험 프리셋 정의
// ─────────────────────────────────────────────────────────────

import type { ExamPreset } from '../types/exam';

export const EXAM_PRESETS: ExamPreset[] = [
  {
    id: 'basic',
    name: '기초 종합',
    description: '선율 + 음정 + 화성 기초',
    icon: 'GraduationCap',
    sections: [
      { contentType: 'melody', questionCount: 3, difficulty: 'beginner_1' },
      { contentType: 'interval', questionCount: 4, difficulty: 'interval_1' },
      { contentType: 'chord', questionCount: 3, difficulty: 'chord_2' },
    ],
    playbackMode: 'korean_exam',
  },
  {
    id: 'intermediate',
    name: '중급 종합',
    description: '전 카테고리 중급 문항',
    icon: 'BookOpen',
    sections: [
      { contentType: 'melody', questionCount: 2, difficulty: 'intermediate_1' },
      { contentType: 'rhythm', questionCount: 2, difficulty: 'rhythm_3' },
      { contentType: 'interval', questionCount: 3, difficulty: 'interval_2' },
      { contentType: 'chord', questionCount: 3, difficulty: 'chord_2' },
      { contentType: 'key', questionCount: 2, difficulty: 'key_2' },
    ],
    playbackMode: 'korean_exam',
  },
  {
    id: 'advanced',
    name: '고급 실전',
    description: '입시/자격증 대비 고급',
    icon: 'Trophy',
    sections: [
      { contentType: 'melody', questionCount: 2, difficulty: 'advanced_1' },
      { contentType: 'rhythm', questionCount: 2, difficulty: 'rhythm_5' },
      { contentType: 'interval', questionCount: 3, difficulty: 'interval_3' },
      { contentType: 'chord', questionCount: 3, difficulty: 'chord_3' },
      { contentType: 'key', questionCount: 2, difficulty: 'key_3' },
      { contentType: 'twoVoice', questionCount: 2, difficulty: 'bass_2' },
    ],
    playbackMode: 'korean_exam',
  },
  {
    id: 'interval_focus',
    name: '음정 집중',
    description: '음정 듣기 집중 훈련',
    icon: 'ArrowUpDown',
    sections: [
      { contentType: 'interval', questionCount: 5, difficulty: 'interval_1' },
      { contentType: 'interval', questionCount: 5, difficulty: 'interval_2' },
    ],
    playbackMode: 'practice',
  },
  {
    id: 'chord_focus',
    name: '화성 집중',
    description: '화음 듣기 집중 훈련',
    icon: 'Layers',
    sections: [
      { contentType: 'chord', questionCount: 5, difficulty: 'chord_2' },
      { contentType: 'chord', questionCount: 5, difficulty: 'chord_3' },
    ],
    playbackMode: 'practice',
  },
];
