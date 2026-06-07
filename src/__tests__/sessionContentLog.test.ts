import {
  buildSessionContentLogInsert,
  buildSessionContentSummary,
  createSessionContentCounters,
  hasContentRuns,
  recordContentRun,
} from '../lib/sessionContentLog';

describe('session content log summary', () => {
  it('counts content runs by content, difficulty, and source', () => {
    const counters = createSessionContentCounters();

    expect(hasContentRuns(counters)).toBe(false);

    recordContentRun(counters, {
      contentType: 'interval',
      difficulty: 'interval_1',
      source: 'choice_practice',
    });
    recordContentRun(counters, {
      contentType: 'interval',
      difficulty: 'interval_1',
      source: 'choice_practice',
    });
    recordContentRun(counters, {
      contentType: 'rhythm',
      difficulty: 'rhythm_2',
      source: 'notation_practice',
    });

    expect(hasContentRuns(counters)).toBe(true);
    expect(counters.totalRuns).toBe(3);
    expect(counters.byContent).toEqual({ interval: 2, rhythm: 1 });
    expect(counters.byContentDifficulty).toEqual({
      'interval:interval_1': 2,
      'rhythm:rhythm_2': 1,
    });
    expect(counters.bySource).toEqual({ choice_practice: 2, notation_practice: 1 });
  });

  it('builds a minimal session summary payload', () => {
    const counters = createSessionContentCounters();
    recordContentRun(counters, {
      contentType: 'key',
      difficulty: 'key_1',
      source: 'mock_exam',
    });

    expect(
      buildSessionContentSummary({
        appVersion: '1.1.0',
        counters,
        endedAt: '2026-05-18T03:10:30.000Z',
        locale: 'ko',
        sessionId: 'session-1',
        startedAt: '2026-05-18T03:10:00.000Z',
        userId: 'user-1',
      }),
    ).toEqual({
      appVersion: '1.1.0',
      byContent: { key: 1 },
      byContentDifficulty: { 'key:key_1': 1 },
      bySource: { mock_exam: 1 },
      durationSec: 30,
      endedAt: '2026-05-18T03:10:30.000Z',
      event: 'session_content_summary',
      locale: 'ko',
      sessionId: 'session-1',
      startedAt: '2026-05-18T03:10:00.000Z',
      totalRuns: 1,
      userId: 'user-1',
    });
  });

  it('maps a session summary to the session_content_logs insert shape', () => {
    const summary = buildSessionContentSummary({
      appVersion: '1.1.0',
      counters: {
        byContent: { rhythm: 2 },
        byContentDifficulty: { 'rhythm:rhythm_2': 2 },
        bySource: { notation_practice: 2 },
        totalRuns: 2,
      },
      endedAt: '2026-05-18T03:10:45.000Z',
      locale: 'ja',
      sessionId: 'session-2',
      startedAt: '2026-05-18T03:10:00.000Z',
      userId: 'user-2',
    });

    expect(buildSessionContentLogInsert(summary)).toEqual({
      app_version: '1.1.0',
      by_content: { rhythm: 2 },
      by_content_difficulty: { 'rhythm:rhythm_2': 2 },
      by_source: { notation_practice: 2 },
      duration_sec: 45,
      ended_at: '2026-05-18T03:10:45.000Z',
      locale: 'ja',
      session_id: 'session-2',
      started_at: '2026-05-18T03:10:00.000Z',
      total_runs: 2,
      user_id: 'user-2',
    });
  });
});
