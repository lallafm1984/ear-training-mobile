import {
  RHYTHM_TAP_LEVELS,
  beatMsFor,
  buildRhythmTapQuestionFromNotes,
  computeOnsets,
  ensureStartsWithNote,
  generateRhythmTapQuestion,
  gradeTaps,
  tapScoreToEvaluation,
  tapScoreToRating,
  toleranceFor,
} from '../lib/rhythmTap';
import type { ScoreNote } from '../lib/scoreUtils';

const note = (
  duration: ScoreNote['duration'],
  rest = false,
  extra: Partial<ScoreNote> = {},
): ScoreNote => ({
  id: `n${Math.random()}`,
  pitch: rest ? 'rest' : 'B',
  octave: 4,
  accidental: '',
  duration,
  ...extra,
});

describe('computeOnsets', () => {
  it('4/4 ♩=60에서 4분음표는 1000ms 간격 타점이 된다', () => {
    const { onsetsMs, totalMs } = computeOnsets(
      [note('4'), note('4'), note('4'), note('4')],
      60,
      '4/4',
    );
    expect(onsetsMs).toEqual([0, 1000, 2000, 3000]);
    expect(totalMs).toBe(4000);
  });

  it('쉼표는 타점이 아니고 붙임줄로 이어진 음표도 새 타점이 아니다', () => {
    const { onsetsMs } = computeOnsets(
      [note('4'), note('4', true), note('8'), note('8', false, { tie: true }), note('2')],
      120,
      '4/4',
    );
    // ♩=120 → 4분 500ms, 8분 250ms
    expect(onsetsMs).toEqual([0, 1000, 1500]);
  });

  it('셋잇단음표는 묶음 길이를 균등 분할한다', () => {
    const { onsetsMs } = computeOnsets(
      [note('8', false, { tuplet: '3', tupletSpan: '4' }), note('8'), note('8'), note('4')],
      60,
      '4/4',
    );
    expect(onsetsMs.map((v) => Math.round(v))).toEqual([0, 333, 667, 1000]);
  });
});

describe('toleranceFor', () => {
  it('박의 25%를 기본으로 하되 가장 짧은 간격의 45%를 넘지 않는다', () => {
    expect(toleranceFor([0, 750, 1500], 750)).toBe(188);
    // 16분음표 간격 188ms → 45% = 84.6 → 하한 90
    expect(toleranceFor([0, 188, 375], 750)).toBe(90);
    expect(toleranceFor([0], 1000)).toBe(220);
  });
});

describe('gradeTaps', () => {
  const onsets = [0, 500, 1000, 1500];

  it('모든 타점을 정확히 치면 100점', () => {
    const g = gradeTaps(onsets, [5, 498, 1010, 1495], 120);
    expect(g.score).toBe(100);
    expect(g.matched).toBe(4);
    expect(g.extra).toBe(0);
    g.matches.forEach((m) => expect(m.status).toBe('perfect'));
  });

  it('빠르거나 늦은 탭은 부분 점수, 놓치면 0점 처리', () => {
    const g = gradeTaps(onsets, [0, 600, 1000], 120);
    expect(g.matches.map((m) => m.status)).toEqual(['perfect', 'late', 'perfect', 'miss']);
    // (1 + 0.6 + 1 + 0) / 4 = 65
    expect(g.score).toBe(65);
    expect(g.matched).toBe(3);
  });

  it('추가 탭은 감점하고 0 아래로 내려가지 않는다', () => {
    const g = gradeTaps(onsets, [0, 250, 500, 750, 1000, 1500], 100);
    expect(g.extra).toBe(2);
    expect(g.extraTapsMs).toEqual([250, 750]);
    // 100 - 2 * 12.5 = 75
    expect(g.score).toBe(75);
    expect(gradeTaps([0], [300, 600, 900, 1200], 100).score).toBe(0);
  });

  it('한 탭은 한 타점에만 짝지어진다', () => {
    const g = gradeTaps([0, 100], [50], 120);
    expect(g.matched).toBe(1);
    expect(g.matches[0].status).not.toBe('miss');
    expect(g.matches[1].status).toBe('miss');
  });

  it('타점이 없으면 0점', () => {
    expect(gradeTaps([], [0], 100).score).toBe(0);
  });
});

describe('문제 생성', () => {
  it('난이도별 설정에 맞는 마디 수·템포·허용 오차로 문제를 만든다', () => {
    (Object.keys(RHYTHM_TAP_LEVELS) as (keyof typeof RHYTHM_TAP_LEVELS)[]).forEach((diff) => {
      for (let i = 0; i < 10; i++) {
        const q = generateRhythmTapQuestion(diff);
        const cfg = RHYTHM_TAP_LEVELS[diff];
        expect(q.measures).toBe(cfg.measures);
        expect(q.tempo).toBe(cfg.tempo);
        expect(q.beatMs).toBe(beatMsFor(cfg.tempo, cfg.timeSignature));
        expect(q.totalMs).toBe(Math.round(q.beatMs * 4 * cfg.measures));
        expect(q.onsetsMs.length).toBeGreaterThanOrEqual(2);
        expect(q.onsetsMs[0]).toBe(0);
        expect(q.toleranceMs).toBeGreaterThanOrEqual(90);
        expect(q.abc).toMatch(/M: ?4\/4/);
        expect(q.abc).toMatch(new RegExp(`Q: ?1/4=${cfg.tempo}`));
      }
    });
  });

  it('주어진 음표로 문제를 만들면 타점이 음표 위치와 일치한다', () => {
    const q = buildRhythmTapQuestionFromNotes('tap_1', [note('2'), note('4'), note('4', true)]);
    expect(q.onsetsMs).toEqual([0, 1500]);
    expect(q.totalMs).toBe(3000);
  });
});

describe('ensureStartsWithNote', () => {
  it('첫 음이 쉼표면 첫 음표와 자리를 바꾼다', () => {
    const rest = note('4', true);
    const a = note('8');
    const b = note('4');
    expect(ensureStartsWithNote([rest, a, b]).map((n) => n.id)).toEqual([a.id, rest.id, b.id]);
    expect(ensureStartsWithNote([a, rest, b]).map((n) => n.id)).toEqual([a.id, rest.id, b.id]);
    expect(ensureStartsWithNote([rest])).toHaveLength(1);
  });
});

describe('점수 변환', () => {
  it('평균 점수를 자기 평가와 난이도 평가로 바꾼다', () => {
    expect(tapScoreToRating(95)).toBe(5);
    expect(tapScoreToRating(80)).toBe(4);
    expect(tapScoreToRating(60)).toBe(3);
    expect(tapScoreToRating(40)).toBe(2);
    expect(tapScoreToRating(10)).toBe(1);
    expect(tapScoreToEvaluation(90)).toBe('easy');
    expect(tapScoreToEvaluation(60)).toBe('normal');
    expect(tapScoreToEvaluation(30)).toBe('hard');
  });
});
