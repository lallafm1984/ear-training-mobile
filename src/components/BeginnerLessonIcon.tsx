// ─────────────────────────────────────────────────────────────
// BeginnerLessonIcon — 귀 열기 코스 레슨 아이콘 (lucide 이름 → 컴포넌트)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import {
  ArrowUpDown,
  Timer,
  MoveVertical,
  Sun,
  Drum,
  Music,
  GraduationCap,
} from 'lucide-react-native';
import type { BeginnerLesson } from '../lib/beginnerCourse';

const ICONS = { ArrowUpDown, Timer, MoveVertical, Sun, Drum, Music, GraduationCap } as const;

interface Props {
  lesson: BeginnerLesson;
  size?: number;
  color?: string;
}

export default function BeginnerLessonIcon({ lesson, size = 22, color }: Props) {
  const Icon = ICONS[lesson.icon];
  return <Icon size={size} color={color ?? lesson.color} />;
}
