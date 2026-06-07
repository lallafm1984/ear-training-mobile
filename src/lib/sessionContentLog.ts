import type { ContentCategory, ContentDifficulty } from '../types/content';

export type ContentRunSource = 'choice_practice' | 'notation_practice' | 'mock_exam';

export interface ContentRunInput {
  contentType: ContentCategory;
  difficulty: ContentDifficulty;
  source: ContentRunSource;
}

export interface SessionContentCounters {
  totalRuns: number;
  byContent: Partial<Record<ContentCategory, number>>;
  byContentDifficulty: Record<string, number>;
  bySource: Partial<Record<ContentRunSource, number>>;
}

export interface SessionContentSummary {
  event: 'session_content_summary';
  userId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  appVersion: string;
  locale: string;
  totalRuns: number;
  byContent: Partial<Record<ContentCategory, number>>;
  byContentDifficulty: Record<string, number>;
  bySource: Partial<Record<ContentRunSource, number>>;
}

export interface SessionContentLogInsert {
  app_version: string;
  by_content: Partial<Record<ContentCategory, number>>;
  by_content_difficulty: Record<string, number>;
  by_source: Partial<Record<ContentRunSource, number>>;
  duration_sec: number;
  ended_at: string;
  locale: string;
  session_id: string;
  started_at: string;
  total_runs: number;
  user_id: string;
}

export function createSessionContentCounters(): SessionContentCounters {
  return {
    totalRuns: 0,
    byContent: {},
    byContentDifficulty: {},
    bySource: {},
  };
}

export function recordContentRun(counters: SessionContentCounters, input: ContentRunInput): void {
  const difficultyKey = `${input.contentType}:${input.difficulty}`;

  counters.totalRuns += 1;
  counters.byContent[input.contentType] = (counters.byContent[input.contentType] ?? 0) + 1;
  counters.byContentDifficulty[difficultyKey] =
    (counters.byContentDifficulty[difficultyKey] ?? 0) + 1;
  counters.bySource[input.source] = (counters.bySource[input.source] ?? 0) + 1;
}

export function hasContentRuns(counters: SessionContentCounters): boolean {
  return counters.totalRuns > 0;
}

export function buildSessionContentSummary({
  appVersion,
  counters,
  endedAt,
  locale,
  sessionId,
  startedAt,
  userId,
}: {
  appVersion: string;
  counters: SessionContentCounters;
  endedAt: string;
  locale: string;
  sessionId: string;
  startedAt: string;
  userId: string;
}): SessionContentSummary {
  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();

  return {
    event: 'session_content_summary',
    userId,
    sessionId,
    startedAt,
    endedAt,
    durationSec: Math.max(0, Math.round(durationMs / 1000)),
    appVersion,
    locale,
    totalRuns: counters.totalRuns,
    byContent: { ...counters.byContent },
    byContentDifficulty: { ...counters.byContentDifficulty },
    bySource: { ...counters.bySource },
  };
}

export function buildSessionContentLogInsert(
  summary: SessionContentSummary,
): SessionContentLogInsert {
  return {
    app_version: summary.appVersion,
    by_content: summary.byContent,
    by_content_difficulty: summary.byContentDifficulty,
    by_source: summary.bySource,
    duration_sec: summary.durationSec,
    ended_at: summary.endedAt,
    locale: summary.locale,
    session_id: summary.sessionId,
    started_at: summary.startedAt,
    total_runs: summary.totalRuns,
    user_id: summary.userId,
  };
}
