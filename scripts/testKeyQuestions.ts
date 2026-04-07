/**
 * 조성 판별 콘텐츠 100회 테스트 스크립트 (개선 후 검증 v2)
 * 실행: npx ts-node scripts/testKeyQuestions.ts
 */

// ─── questionGenerator.ts 로직 인라인 (Node 환경용) ───

interface KeyTemplate {
  name: string;
  abcKey: string;
  scaleNotes: string;
}

const KEY_TEMPLATES: Record<string, KeyTemplate> = {
  C_major: { name: 'C장조 (C Major)', abcKey: 'C', scaleNotes: 'C D E F | G A B c |]' },
  A_minor: { name: 'A단조 (A minor)', abcKey: 'Am', scaleNotes: 'A, B, C D | E F ^G A |]' },
  G_major: { name: 'G장조 (G Major)', abcKey: 'G', scaleNotes: 'G, A, B, C | D E ^F G |]' },
  E_minor: { name: 'E단조 (E minor)', abcKey: 'Em', scaleNotes: 'E, F, G, A, | B, C ^D E |]' },
  F_major: { name: 'F장조 (F Major)', abcKey: 'F', scaleNotes: 'F, G, A, _B, | C D E F |]' },
  D_minor: { name: 'D단조 (D minor)', abcKey: 'Dm', scaleNotes: 'D, E, F, G, | A, _B, ^C D |]' },
  D_major: { name: 'D장조 (D Major)', abcKey: 'D', scaleNotes: 'D, E, ^F, G, | A, B, ^C D |]' },
  B_minor: { name: 'B단조 (B minor)', abcKey: 'Bm', scaleNotes: 'B, C D E | F G ^A B |]' },
  Bb_major: { name: 'B♭장조 (B♭ Major)', abcKey: 'Bb', scaleNotes: '_B, C D _E | F G A _B |]' },
  G_minor: { name: 'G단조 (G minor)', abcKey: 'Gm', scaleNotes: 'G, A, _B, C | D _E ^F G |]' },
  E_major: { name: 'E장조 (E Major)', abcKey: 'E', scaleNotes: 'E, ^F, ^G, A, | B, ^C ^D E |]' },
  Csh_minor: { name: 'C♯단조 (C♯ minor)', abcKey: 'C#m', scaleNotes: '^C, ^D, E, ^F, | ^G, A, ^B, ^C |]' },
  Ab_major: { name: 'A♭장조 (A♭ Major)', abcKey: 'Ab', scaleNotes: '_A, _B, C _D | _E F G _A |]' },
  F_minor: { name: 'F단조 (F minor)', abcKey: 'Fm', scaleNotes: 'F, G, _A, _B, | C _D =E F |]' },
  B_major: { name: 'B장조 (B Major)', abcKey: 'B', scaleNotes: 'B, ^C ^D E | ^F ^G ^A B |]' },
  Gsh_minor: { name: 'G♯단조 (G♯ minor)', abcKey: 'G#m', scaleNotes: '^G, ^A, B, ^C | ^D E ^^F ^G |]' },
  Db_major: { name: 'D♭장조 (D♭ Major)', abcKey: 'Db', scaleNotes: '_D, _E, F, _G, | _A, _B, C _D |]' },
  Bb_minor: { name: 'B♭단조 (B♭ minor)', abcKey: 'Bbm', scaleNotes: '_B, C _D _E | F _G A _B |]' },
  Gb_major: { name: 'G♭장조 (G♭ Major)', abcKey: 'Gb', scaleNotes: '_G, _A, _B, _C | _D _E F _G |]' },
  Eb_minor: { name: 'E♭단조 (E♭ minor)', abcKey: 'Ebm', scaleNotes: '_E, F, _G, _A, | _B, _C D _E |]' },
  A_major: { name: 'A장조 (A Major)', abcKey: 'A', scaleNotes: 'A, B, ^C D | E ^F ^G A |]' },
  Fsh_minor: { name: 'F♯단조 (F♯ minor)', abcKey: 'F#m', scaleNotes: '^F, ^G, A, B, | ^C D ^E ^F |]' },
  Eb_major: { name: 'E♭장조 (E♭ Major)', abcKey: 'Eb', scaleNotes: '_E, F, G, _A, | _B, C D _E |]' },
  C_minor: { name: 'C단조 (C minor)', abcKey: 'Cm', scaleNotes: 'C, D, _E, F, | G, _A, =B, C |]' },
};

type KeyDifficulty = 'key_1' | 'key_2' | 'key_3';

const KEY_POOLS: Record<KeyDifficulty, string[]> = {
  key_1: ['C_major', 'A_minor'],
  key_2: ['C_major', 'A_minor', 'G_major', 'E_minor', 'F_major', 'D_minor', 'D_major', 'B_minor', 'Bb_major', 'G_minor'],
  key_3: Object.keys(KEY_TEMPLATES),
};

const RELATIVE_KEYS: Record<string, string> = {
  C_major: 'A_minor',      A_minor: 'C_major',
  G_major: 'E_minor',      E_minor: 'G_major',
  F_major: 'D_minor',      D_minor: 'F_major',
  D_major: 'B_minor',      B_minor: 'D_major',
  Bb_major: 'G_minor',     G_minor: 'Bb_major',
  A_major: 'Fsh_minor',    Fsh_minor: 'A_major',
  Eb_major: 'C_minor',     C_minor: 'Eb_major',
  E_major: 'Csh_minor',    Csh_minor: 'E_major',
  Ab_major: 'F_minor',     F_minor: 'Ab_major',
  B_major: 'Gsh_minor',    Gsh_minor: 'B_major',
  Db_major: 'Bb_minor',    Bb_minor: 'Db_major',
  Gb_major: 'Eb_minor',    Eb_minor: 'Gb_major',
};

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function parseScale(scaleNotes: string): string[] {
  return scaleNotes
    .replace(/\|\]/g, '')
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(n => n.length > 0);
}

const KEY_MELODY_PATTERNS: ((s: string[]) => string)[] = [
  (s) => `${s[0]} ${s[1]} ${s[2]} ${s[3]} | ${s[4]} ${s[5]} ${s[6]} ${s[7]} |]`,
  (s) => `${s[7]} ${s[6]} ${s[5]} ${s[4]} | ${s[3]} ${s[2]} ${s[1]} ${s[0]} |]`,
  (s) => `${s[0]} ${s[2]} ${s[4]} ${s[7]} | ${s[5]} ${s[3]} ${s[1]} ${s[0]} |]`,
  (s) => `${s[0]} ${s[1]} ${s[2]} ${s[3]} | ${s[4]}2 ${s[2]} ${s[0]} |]`,
  (s) => `${s[4]} ${s[3]} ${s[2]} ${s[1]} | ${s[0]}2 z2 |]`,
  (s) => `${s[0]} ${s[2]} ${s[4]} ${s[5]} | ${s[4]} ${s[2]} ${s[6]} ${s[7]} |]`,
  (s) => `${s[0]}2 ${s[3]} ${s[4]} | ${s[5]} ${s[6]} ${s[7]}2 |]`,
  (s) => `${s[0]} ${s[4]} ${s[2]} ${s[7]} | ${s[4]} ${s[2]} ${s[0]}2 |]`,
  (s) => `${s[0]} ${s[4]} ${s[5]} ${s[6]} | ${s[7]} ${s[5]} ${s[3]} ${s[0]} |]`,
  (s) => `${s[0]} ${s[1]} ${s[2]} ${s[0]} | ${s[2]} ${s[3]} ${s[4]}2 |]`,
];

let recentKeys: string[] = [];

interface ChoiceQuestion {
  correctAnswer: string;
  correctKey: string;
  choices: string[];
  abcNotation: string;
  prompt: string;
  patternIdx: number;
}

function generateKeyQuestion(difficulty: KeyDifficulty): ChoiceQuestion {
  const pool = KEY_POOLS[difficulty];

  let available: string[];
  if (pool.length <= 3) {
    const last2 = recentKeys.slice(-2);
    const blocked = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
    available = blocked ? pool.filter(k => k !== blocked) : pool;
  } else {
    available = pool.filter(k => !recentKeys.includes(k));
    if (available.length < 2) available = pool;
  }
  const keyId = available[Math.floor(Math.random() * available.length)];
  recentKeys.push(keyId);
  if (recentKeys.length > 2) recentKeys.shift();

  const key = KEY_TEMPLATES[keyId];

  const scale = parseScale(key.scaleNotes);
  const patternIdx = Math.floor(Math.random() * KEY_MELODY_PATTERNS.length);
  const pattern = KEY_MELODY_PATTERNS[patternIdx];
  const melodyBody = pattern(scale);
  const abc = `X:1\nM:4/4\nL:1/4\nK:${key.abcKey}\n${melodyBody}`;

  // key_1: 2지선다
  if (difficulty === 'key_1') {
    const otherKeyId = pool.find(k => k !== keyId)!;
    return {
      correctAnswer: key.name,
      correctKey: keyId,
      choices: shuffle([key.name, KEY_TEMPLATES[otherKeyId].name]),
      abcNotation: abc,
      prompt: '멜로디를 듣고 장조/단조를 맞추세요.',
      patternIdx,
    };
  }

  // key_2/key_3: 나란한조 우선 오답
  const wrongs: string[] = [];
  const usedKeys = new Set<string>([keyId]);

  const relativeKeyId = RELATIVE_KEYS[keyId];
  if (relativeKeyId && !usedKeys.has(relativeKeyId)) {
    usedKeys.add(relativeKeyId);
    wrongs.push(KEY_TEMPLATES[relativeKeyId].name);
  }

  for (const k of shuffle(pool.filter(k => !usedKeys.has(k)))) {
    if (wrongs.length >= 3) break;
    usedKeys.add(k);
    wrongs.push(KEY_TEMPLATES[k].name);
  }

  if (wrongs.length < 3) {
    const outside = Object.keys(KEY_TEMPLATES).filter(k => !usedKeys.has(k));
    for (const k of shuffle(outside)) {
      if (wrongs.length >= 3) break;
      wrongs.push(KEY_TEMPLATES[k].name);
    }
  }

  return {
    correctAnswer: key.name,
    correctKey: keyId,
    choices: shuffle([key.name, ...wrongs.slice(0, 3)]),
    abcNotation: abc,
    prompt: '멜로디를 듣고 조성을 맞추세요.',
    patternIdx,
  };
}

// ─── 분석 함수 ───

interface TestResult {
  difficulty: KeyDifficulty;
  questions: ChoiceQuestion[];
}

function analyzeResults(result: TestResult) {
  const { difficulty, questions } = result;
  const pool = KEY_POOLS[difficulty];

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  난이도: ${difficulty} (풀 크기: ${pool.length}개 조성)`);
  console.log(`  테스트 횟수: ${questions.length}회`);
  console.log(`${'═'.repeat(70)}`);

  // 1. 보기 수 검증
  const choiceCounts = new Map<number, number>();
  for (const q of questions) {
    const cnt = q.choices.length;
    choiceCounts.set(cnt, (choiceCounts.get(cnt) || 0) + 1);
  }
  console.log(`\n📋 [1] 보기 수`);
  for (const [cnt, freq] of choiceCounts) {
    console.log(`  ${cnt}지선다: ${freq}회`);
  }

  // 2. 연속 동일 정답
  let maxConsecutive = 1;
  let curConsecutive = 1;
  for (let i = 1; i < questions.length; i++) {
    if (questions[i].correctKey === questions[i - 1].correctKey) {
      curConsecutive++;
      if (curConsecutive > maxConsecutive) maxConsecutive = curConsecutive;
    } else {
      curConsecutive = 1;
    }
  }
  console.log(`\n🔄 [2] 최대 연속 동일 정답: ${maxConsecutive}회 ${maxConsecutive <= 2 ? '✅' : '⚠️'}`);

  // 3. 멜로디 패턴 다양성
  const abcPatterns = new Set(questions.map(q => q.abcNotation));
  console.log(`\n🎵 [3] 고유 ABC 패턴 수: ${abcPatterns.size}개`);

  // 4. 나란한조 오답 포함률 (key_2/key_3만)
  if (difficulty !== 'key_1') {
    let relativeInChoices = 0;
    for (const q of questions) {
      const relId = RELATIVE_KEYS[q.correctKey];
      if (relId && q.choices.includes(KEY_TEMPLATES[relId].name)) {
        relativeInChoices++;
      }
    }
    const relPct = ((relativeInChoices / questions.length) * 100).toFixed(1);
    console.log(`\n🎭 [4] 나란한조 오답 포함률: ${relativeInChoices}/${questions.length} (${relPct}%) ${Number(relPct) >= 90 ? '✅' : '⚠️'}`);
  }

  // 5. 보기 검증
  let dupCount = 0;
  let missingCorrect = 0;
  for (const q of questions) {
    if (!q.choices.includes(q.correctAnswer)) missingCorrect++;
    if (new Set(q.choices).size !== q.choices.length) dupCount++;
  }
  console.log(`\n✅ [5] 검증: 정답누락=${missingCorrect}, 보기중복=${dupCount}`);

  // 6. ABC 박자 검증
  let beatErrors = 0;
  for (const q of questions) {
    const body = q.abcNotation.split('\n').pop() || '';
    const measures = body.replace(/\|\]/g, '').split('|').filter(m => m.trim());
    for (const measure of measures) {
      const beats = countBeats(measure.trim());
      if (Math.abs(beats - 4) > 0.01) beatErrors++;
    }
  }
  console.log(`  박자오류=${beatErrors}개 마디 ${beatErrors === 0 ? '✅' : '❌'}`);
}

function countBeats(measure: string): number {
  let beats = 0;
  const tokens = measure.match(/(?:[_^=]*[A-Ga-g][,']*\d*(?:\/\d+)?|z\d*(?:\/\d+)?)/g);
  if (!tokens) return 0;
  for (const token of tokens) {
    const durMatch = token.match(/(\d+)(?:\/(\d+))?$/);
    if (durMatch) {
      const num = parseInt(durMatch[1], 10);
      const den = durMatch[2] ? parseInt(durMatch[2], 10) : 1;
      beats += num / den;
    } else {
      beats += 1;
    }
  }
  return beats;
}

// ─── 메인 실행 ───

function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║      조성 판별 콘텐츠 100회 테스트 — 이슈 #2/#3 개선 검증         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const difficulties: KeyDifficulty[] = ['key_1', 'key_2', 'key_3'];

  for (const diff of difficulties) {
    recentKeys = [];
    const questions: ChoiceQuestion[] = [];
    for (let i = 0; i < 100; i++) {
      questions.push(generateKeyQuestion(diff));
    }
    analyzeResults({ difficulty: diff, questions });
  }

  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('  📈 전체 개선 요약');
  console.log(`${'═'.repeat(70)}`);
  console.log(`
  ┌──────────────────────┬─────────────────────┬─────────────────────┐
  │ 항목                 │ 개선 전             │ 개선 후             │
  ├──────────────────────┼─────────────────────┼─────────────────────┤
  │ 멜로디 패턴 수       │ 1가지/조성          │ 10가지/조성         │
  │ 단조 스케일          │ 자연/화성 혼용      │ 화성단음계 통일     │
  │ 연속 중복 방지       │ 없음                │ ≤2회                │
  │ key_1 보기 수        │ 4지선다(풀 외 오답) │ 2지선다(장/단 집중) │
  │ key_2/3 나란한조     │ 34% / 9%            │ ~100% (우선 배치)   │
  └──────────────────────┴─────────────────────┴─────────────────────┘
  `);
}

main();
