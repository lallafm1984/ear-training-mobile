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
      { contentType: 'melody',   questionCount: 1, difficulty: 'beginner_1',    points: 50 },
      { contentType: 'interval', questionCount: 5, difficulty: 'interval_1',    points: 30 },
      { contentType: 'chord',    questionCount: 4, difficulty: 'chord_2',       points: 20 },
    ],
    playbackMode: 'korean_exam',
  },
  {
    id: 'intermediate',
    name: '중급 종합',
    description: '전 카테고리 중급 문항',
    icon: 'BookOpen',
    sections: [
      { contentType: 'melody',   questionCount: 1, difficulty: 'intermediate_1', points: 30 },
      { contentType: 'rhythm',   questionCount: 1, difficulty: 'rhythm_3',        points: 20 },
      { contentType: 'interval', questionCount: 3, difficulty: 'interval_2',      points: 20 },
      { contentType: 'chord',    questionCount: 3, difficulty: 'chord_2',         points: 20 },
      { contentType: 'key',      questionCount: 2, difficulty: 'key_2',           points: 10 },
    ],
    playbackMode: 'korean_exam',
  },
  {
    id: 'advanced',
    name: '고급 실전',
    description: '입시/자격증 대비 고급',
    icon: 'Trophy',
    sections: [
      { contentType: 'twoVoice', questionCount: 1, difficulty: 'bass_2',       points: 30 },
      { contentType: 'melody',   questionCount: 1, difficulty: 'advanced_1',   points: 20 },
      { contentType: 'rhythm',   questionCount: 1, difficulty: 'rhythm_5',     points: 15 },
      { contentType: 'interval', questionCount: 3, difficulty: 'interval_3',   points: 15 },
      { contentType: 'chord',    questionCount: 2, difficulty: 'chord_3',      points: 10 },
      { contentType: 'key',      questionCount: 2, difficulty: 'key_3',        points: 10 },
    ],
    playbackMode: 'korean_exam',
  },
  {
    id: 'interval_focus',
    name: '음정 집중',
    description: '음정 듣기 집중 훈련',
    icon: 'ArrowUpDown',
    sections: [
      { contentType: 'interval', questionCount: 5, difficulty: 'interval_1', points: 50 },
      { contentType: 'interval', questionCount: 5, difficulty: 'interval_2', points: 50 },
    ],
    playbackMode: 'practice',
  },
  {
    id: 'chord_focus',
    name: '화성 집중',
    description: '화음 듣기 집중 훈련',
    icon: 'Layers',
    sections: [
      { contentType: 'chord', questionCount: 5, difficulty: 'chord_2', points: 50 },
      { contentType: 'chord', questionCount: 5, difficulty: 'chord_3', points: 50 },
    ],
    playbackMode: 'practice',
  },
];
