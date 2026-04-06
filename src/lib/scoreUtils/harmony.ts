// ────────────────────────────────────────────────────────────────
// Harmony & progression utilities
// ────────────────────────────────────────────────────────────────

export function generateProgression(measures: number, isMinor: boolean = false): number[] {
  const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // ── 4마디 패턴 ──
  const major4: number[][] = [
    [0, 3, 4, 0], [0, 1, 4, 0], [0, 5, 1, 4], [0, 5, 3, 4],
    [0, 4, 5, 3], [0, 3, 1, 4], [0, 3, 0, 4], [0, 2, 5, 4],
    [0, 4, 6, 0], [0, 6, 4, 0],
    [0, 5, 1, 4], [0, 1, 2, 3], [0, 5, 3, 1],
  ];

  const minor4: number[][] = [
    [0, 3, 4, 0], [0, 1, 4, 0], [0, 5, 3, 4], [0, 3, 5, 4],
    [0, 2, 4, 0], [0, 5, 1, 4],
    [0, 6, 2, 4], [0, 2, 5, 4], [0, 3, 6, 4], [0, 5, 2, 4],
    [0, 6, 4, 0], [0, 3, 0, 4],
  ];

  // ── 8마디 패턴 ──
  const major8: number[][] = [
    [0, 5, 1, 4, 0, 3, 4, 0], [0, 3, 4, 0, 0, 1, 4, 0],
    [0, 2, 5, 4, 0, 3, 1, 4], [0, 5, 3, 4, 0, 1, 4, 0],
    [0, 3, 6, 2, 5, 1, 4, 0], [0, 5, 3, 1, 0, 5, 4, 0],
    [0, 1, 2, 3, 4, 5, 4, 0],
    [0, 3, 4, 5, 0, 1, 4, 0], [0, 4, 5, 3, 0, 5, 4, 0],
  ];

  const minor8: number[][] = [
    [0, 3, 4, 0, 0, 5, 4, 0], [0, 5, 1, 4, 0, 3, 4, 0],
    [0, 2, 5, 4, 0, 3, 4, 0],
    [0, 3, 6, 2, 5, 1, 4, 0], [0, 6, 2, 5, 0, 3, 4, 0],
    [0, 3, 4, 5, 0, 1, 4, 0], [0, 5, 3, 4, 0, 6, 4, 0],
  ];

  const patterns4 = isMinor ? minor4 : major4;
  const patterns8 = isMinor ? minor8 : major8;

  const result: number[] = [];

  if (measures >= 8 && Math.random() < 0.6) {
    const pat8 = rand(patterns8);
    for (const c of pat8) {
      if (result.length < measures) result.push(c);
    }
    while (result.length < measures) {
      for (const c of rand(patterns4)) {
        if (result.length < measures) result.push(c);
      }
    }
  } else {
    let lastPatIdx = -1;
    while (result.length < measures) {
      let patIdx: number;
      do {
        patIdx = Math.floor(Math.random() * patterns4.length);
      } while (patIdx === lastPatIdx && patterns4.length > 1);
      lastPatIdx = patIdx;
      for (const c of patterns4[patIdx]) {
        if (result.length < measures) result.push(c);
      }
    }
  }

  if (measures >= 8) {
    for (let i = 3; i < measures - 1; i += 4) {
      result[i] = 4;
    }
  }
  if (measures >= 2) {
    result[measures - 2] = 4;
    result[measures - 1] = 0;
  } else if (measures === 1) {
    result[0] = 0;
  }
  return result;
}

/**
 * 강박 16분음표 오프셋 집합 반환.
 */
export function getStrongBeatOffsets(timeSignature: string): Set<number> {
  const [topStr, botStr] = (timeSignature || '4/4').split('/');
  const top = parseInt(topStr, 10) || 4;
  const bot = parseInt(botStr, 10) || 4;
  const isCompound = bot === 8 && top % 3 === 0 && top >= 6;
  if (isCompound) {
    const groups = Math.round((top / 3) * (16 / bot) * 3 / 6);
    const s = new Set<number>();
    for (let g = 0; g < groups; g++) s.add(g * 6);
    return s;
  }
  if (top === 4 && bot === 4) return new Set([0, 8]);
  if (top === 3 && bot === 4) return new Set([0]);
  if (top === 2 && bot === 4) return new Set([0]);
  if (top === 2 && bot === 2) return new Set([0]);
  return new Set([0]);
}
