// ─────────────────────────────────────────────────────────────
// mascotConfig — 마스코트 진화 시스템 (EXP / 레벨 / 비주얼)
// ─────────────────────────────────────────────────────────────

// EXP 시스템:
// 일일 목표 카테고리 완료 = 2 EXP, 5개 전부 완료 = +10 EXP 보너스
// 100 EXP = 1 레벨 업, 최대 레벨 100 (총 9,900 EXP)

const EXP_PER_LEVEL = 100;
const MAX_LEVEL = 60;

/** 10단계 스테이지 이름 */
export const STAGE_NAMES: string[] = [
  '뉴비', '초보', '학생', '연습생', '연주자',
  '음악가', '전문가', '마스터', '거장', '전설',
];

/** 총 EXP로 현재 레벨 계산 (1-100) */
export function getLevel(totalExp: number): number {
  if (totalExp < 0) return 1;
  const level = Math.floor(totalExp / EXP_PER_LEVEL) + 1;
  return Math.min(level, MAX_LEVEL);
}

/** 다음 레벨까지의 진행도 */
export function getExpForNextLevel(totalExp: number): {
  current: number;
  needed: number;
  progress: number;
} {
  const level = getLevel(totalExp);
  if (level >= MAX_LEVEL) {
    return { current: EXP_PER_LEVEL, needed: EXP_PER_LEVEL, progress: 1 };
  }
  const current = totalExp % EXP_PER_LEVEL;
  return { current, needed: EXP_PER_LEVEL, progress: current / EXP_PER_LEVEL };
}

export interface MascotParams {
  bodyColor: string;
  innerColor: string;
  blushColor: string;
  headphoneColor: string;
  headphoneInner: string;
  eyeStyle: number;   // 0-9
  mouthStyle: number; // 0-9
  earType: number;    // 0=none, 1=round, 2=cat, 3=bunny, 4=bear
  cheekDecor: number; // 0=none, 1=dot, 2=star, 3=heart, 4=sparkle, 5=music
  accessory:
    | 'none'
    | 'headband'
    | 'bowtie'
    | 'scarf'
    | 'sunglasses'
    | 'crown'
    | 'smallWings'
    | 'bigWings'
    | 'halo'
    | 'fire';
  decorCount: number; // 0-5
  hasAura: boolean;
}

/**
 * 레벨(1-100)에 따라 마스코트 시각 파라미터를 반환한다.
 * 10단계 티어로 나뉘며, 각 티어마다 색상/눈/입/악세서리가 달라진다.
 */
export function getMascotParams(level: number): MascotParams {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, level));

  // 티어 0-9 (레벨 1-6 → 0, 7-12 → 1, ..., 55-60 → 9)
  const tier = Math.min(9, Math.floor((clamped - 1) / 6));

  // 귀 타입: 티어별 (0=없음, 1=둥근귀, 2=고양이귀, 3=토끼귀, 4=곰귀)
  const EAR_BY_TIER = [0, 0, 1, 2, 1, 3, 4, 2, 4, 3];
  // 악세서리: 티어별
  const ACC_BY_TIER: MascotParams['accessory'][] = [
    'none', 'none', 'none', 'scarf', 'none',
    'crown', 'smallWings', 'bigWings', 'halo', 'fire',
  ];

  const BODY_COLORS = [
    { body: '#6366f1', inner: '#818cf8', blush: '#c084fc', hpDark: '#312e81', hpLight: '#4338ca' },
    { body: '#3b82f6', inner: '#60a5fa', blush: '#93c5fd', hpDark: '#1e3a5f', hpLight: '#2563eb' },
    { body: '#22c55e', inner: '#4ade80', blush: '#86efac', hpDark: '#14532d', hpLight: '#16a34a' },
    { body: '#14b8a6', inner: '#2dd4bf', blush: '#99f6e4', hpDark: '#134e4a', hpLight: '#0d9488' },
    { body: '#f97316', inner: '#fb923c', blush: '#fdba74', hpDark: '#7c2d12', hpLight: '#ea580c' },
    { body: '#ec4899', inner: '#f472b6', blush: '#f9a8d4', hpDark: '#831843', hpLight: '#db2777' },
    { body: '#ef4444', inner: '#f87171', blush: '#fca5a5', hpDark: '#7f1d1d', hpLight: '#dc2626' },
    { body: '#a855f7', inner: '#c084fc', blush: '#d8b4fe', hpDark: '#581c87', hpLight: '#9333ea' },
    { body: '#eab308', inner: '#facc15', blush: '#fde68a', hpDark: '#713f12', hpLight: '#ca8a04' },
    { body: '#e2e8f0', inner: '#f8fafc', blush: '#fbbf24', hpDark: '#334155', hpLight: '#94a3b8' },
  ];

  const subLevel = ((clamped - 1) % 6) + 1; // 1-6
  const c = BODY_COLORS[tier];

  return {
    bodyColor: c.body,
    innerColor: c.inner,
    blushColor: c.blush,
    headphoneColor: c.hpDark,
    headphoneInner: c.hpLight,
    eyeStyle: 0,
    mouthStyle: tier,
    earType: EAR_BY_TIER[tier],
    cheekDecor: subLevel <= 2 ? 0 : subLevel <= 4 ? 1 : 2,
    accessory: ACC_BY_TIER[tier],
    decorCount: Math.min(5, subLevel - 1),
    hasAura: tier >= 7,
    // 각 티어의 6번째 레벨(6,12,18,...,60): 선글라스
    ...(subLevel === 6 && { accessory: 'sunglasses' as const }),
  };
}
