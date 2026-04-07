/**
 * 조성 판별 콘텐츠 — 사용자 경험(UX) 관점 100회 테스트
 * 실행: npx ts-node scripts/testKeyQuestionsUX.ts
 */

// ─── questionGenerator.ts 로직 인라인 ───

interface KeyTemplate { name: string; abcKey: string; scaleNotes: string; }

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
  C_major: 'A_minor', A_minor: 'C_major',
  G_major: 'E_minor', E_minor: 'G_major',
  F_major: 'D_minor', D_minor: 'F_major',
  D_major: 'B_minor', B_minor: 'D_major',
  Bb_major: 'G_minor', G_minor: 'Bb_major',
  A_major: 'Fsh_minor', Fsh_minor: 'A_major',
  Eb_major: 'C_minor', C_minor: 'Eb_major',
  E_major: 'Csh_minor', Csh_minor: 'E_major',
  Ab_major: 'F_minor', F_minor: 'Ab_major',
  B_major: 'Gsh_minor', Gsh_minor: 'B_major',
  Db_major: 'Bb_minor', Bb_minor: 'Db_major',
  Gb_major: 'Eb_minor', Eb_minor: 'Gb_major',
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
  return scaleNotes.replace(/\|\]/g, '').replace(/\|/g, ' ').trim().split(/\s+/).filter(n => n.length > 0);
}

const PATTERN_NAMES = [
  '상행 스케일', '하행 스케일', '아르페지오 왕복', '순차+도약 종지',
  '5도 하행 종지', '도약+이끔음', '완전종지 접근', '분산화음 하행',
  '상행도약+순차하행', '동기 반복형',
];

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
let recentPatterns: number[] = [];

interface Question {
  correctAnswer: string;
  correctKey: string;
  choices: string[];
  abcNotation: string;
  prompt: string;
  patternIdx: number;
}

function generateKeyQuestion(difficulty: KeyDifficulty): Question {
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
  const last2Pat = recentPatterns.slice(-2);
  const patBlocked = last2Pat.length === 2 && last2Pat[0] === last2Pat[1] ? last2Pat[0] : null;
  const patPool = patBlocked !== null
    ? Array.from({ length: KEY_MELODY_PATTERNS.length }, (_, i) => i).filter(i => i !== patBlocked)
    : Array.from({ length: KEY_MELODY_PATTERNS.length }, (_, i) => i);
  const patternIdx = patPool[Math.floor(Math.random() * patPool.length)];
  recentPatterns.push(patternIdx);
  if (recentPatterns.length > 2) recentPatterns.shift();
  const melodyBody = KEY_MELODY_PATTERNS[patternIdx](scale);
  const abc = `X:1\nM:4/4\nL:1/4\nK:${key.abcKey}\n${melodyBody}`;

  if (difficulty === 'key_1') {
    const otherKeyId = pool.find(k => k !== keyId)!;
    return { correctAnswer: key.name, correctKey: keyId, choices: shuffle([key.name, KEY_TEMPLATES[otherKeyId].name]), abcNotation: abc, prompt: '멜로디를 듣고 장조/단조를 맞추세요.', patternIdx };
  }

  const wrongs: string[] = [];
  const usedKeys = new Set<string>([keyId]);
  const relativeKeyId = RELATIVE_KEYS[keyId];
  if (relativeKeyId && !usedKeys.has(relativeKeyId)) { usedKeys.add(relativeKeyId); wrongs.push(KEY_TEMPLATES[relativeKeyId].name); }
  for (const k of shuffle(pool.filter(k => !usedKeys.has(k)))) { if (wrongs.length >= 3) break; usedKeys.add(k); wrongs.push(KEY_TEMPLATES[k].name); }
  if (wrongs.length < 3) { for (const k of shuffle(Object.keys(KEY_TEMPLATES).filter(k => !usedKeys.has(k)))) { if (wrongs.length >= 3) break; wrongs.push(KEY_TEMPLATES[k].name); } }

  return { correctAnswer: key.name, correctKey: keyId, choices: shuffle([key.name, ...wrongs.slice(0, 3)]), abcNotation: abc, prompt: '멜로디를 듣고 조성을 맞추세요.', patternIdx };
}

// ─── ABC 유틸 ───

/** ABC 음표 → 대략적 MIDI 번호 (음역대 분석용) */
function abcNoteToMidi(note: string): number | null {
  const m = note.match(/^([_^=]*)([A-Ga-g])([,']*)/);
  if (!m) return null;
  const [, accStr, letter, octStr] = m;

  const baseMap: Record<string, number> = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
  const upper = letter.toUpperCase();
  let midi = baseMap[upper] ?? 60;

  // 소문자 = 옥타브 위
  if (letter === letter.toLowerCase() && letter !== letter.toUpperCase()) midi += 12;

  for (const ch of octStr) {
    if (ch === ',') midi -= 12;
    else if (ch === "'") midi += 12;
  }

  for (const ch of accStr) {
    if (ch === '^') midi += 1;
    else if (ch === '_') midi -= 1;
  }

  return midi;
}

/** ABC body에서 음표 토큰 추출 */
function extractNotes(abcBody: string): string[] {
  return (abcBody.match(/[_^=]*[A-Ga-g][,']*\d*(?:\/\d+)?/g) || [])
    .map(t => t.replace(/\d+(\/\d+)?$/, ''));
}

/** 연속 두 음 사이 반음 수 */
function intervalSemitones(n1: string, n2: string): number | null {
  const m1 = abcNoteToMidi(n1);
  const m2 = abcNoteToMidi(n2);
  if (m1 === null || m2 === null) return null;
  return Math.abs(m2 - m1);
}

// ─── 분석 ───

function analyze(difficulty: KeyDifficulty, questions: Question[]) {
  const pool = KEY_POOLS[difficulty];
  const diffLabel = { key_1: '1단계 · 나란한조 (C/Am)', key_2: '2단계 · ♯♭ 1~3개', key_3: '3단계 · 24조성 전체' }[difficulty];
  const issues: string[] = [];

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${diffLabel}  (${questions.length}회 테스트)`);
  console.log(`${'═'.repeat(70)}`);

  // ──── A. 기본 품질 검증 ────
  console.log(`\n  [A] 기본 품질 검증`);
  let beatErrors = 0, dupChoices = 0, missingCorrect = 0;
  for (const q of questions) {
    if (!q.choices.includes(q.correctAnswer)) missingCorrect++;
    if (new Set(q.choices).size !== q.choices.length) dupChoices++;
    const body = q.abcNotation.split('\n').pop() || '';
    for (const m of body.replace(/\|\]/g, '').split('|').filter(x => x.trim())) {
      const beats = countBeats(m.trim());
      if (Math.abs(beats - 4) > 0.01) beatErrors++;
    }
  }
  console.log(`      정답 누락: ${missingCorrect}  보기 중복: ${dupChoices}  박자 오류: ${beatErrors}마디`);
  console.log(`      → ${missingCorrect + dupChoices + beatErrors === 0 ? '✅ 전체 통과' : '❌ 오류 있음'}`);

  // ──── B. 사용자 불만 포인트 분석 ────
  console.log(`\n  [B] 사용자 불만 포인트 분석`);

  // B-1. "같은 문제만 나온다" — 연속 동일 정답+동일 패턴
  let sameKeyAndPattern = 0;
  for (let i = 1; i < questions.length; i++) {
    if (questions[i].correctKey === questions[i - 1].correctKey && questions[i].patternIdx === questions[i - 1].patternIdx) {
      sameKeyAndPattern++;
    }
  }
  console.log(`\n    B-1. "같은 문제만 나온다" 체감`);
  console.log(`         연속 동일(조성+패턴): ${sameKeyAndPattern}회 / ${questions.length - 1}`);
  if (sameKeyAndPattern > 0) issues.push(`연속 동일 문제(조성+패턴 모두 같음) ${sameKeyAndPattern}회 발생`);
  else console.log(`         ✅ 연속 동일 문제 없음`);

  // B-2. "너무 쉽다/어렵다" — 보기 난이도 분석
  console.log(`\n    B-2. 보기 변별력 분석`);

  // 오답 중 풀 외부 비율 (풀 외부 = 사용자가 한 번도 안 배운 조성 → 소거법으로 제거 가능)
  let outsidePoolWrongs = 0, totalWrongs = 0;
  const poolNames = pool.map(k => KEY_TEMPLATES[k].name);
  for (const q of questions) {
    for (const c of q.choices) {
      if (c !== q.correctAnswer) {
        totalWrongs++;
        if (!poolNames.includes(c)) outsidePoolWrongs++;
      }
    }
  }
  if (totalWrongs > 0) {
    const outsidePct = ((outsidePoolWrongs / totalWrongs) * 100).toFixed(1);
    console.log(`         풀 외부 오답 비율: ${outsidePoolWrongs}/${totalWrongs} (${outsidePct}%)`);
    if (Number(outsidePct) > 20) {
      issues.push(`오답의 ${outsidePct}%가 풀 외부 조성 → 소거법으로 쉽게 제거 가능`);
    }
  }

  // 장/단 혼합 오답 비율 (정답이 장조인데 오답이 전부 단조면 헷갈릴 이유가 없음)
  let sameTypeWrong = 0;
  for (const q of questions) {
    const isCorrectMajor = q.correctKey.includes('major');
    for (const c of q.choices) {
      if (c === q.correctAnswer) continue;
      const isMajor = c.includes('장조') || c.includes('Major');
      if (isMajor === isCorrectMajor) sameTypeWrong++;
    }
  }
  const sameTypePct = totalWrongs > 0 ? ((sameTypeWrong / totalWrongs) * 100).toFixed(1) : '0';
  console.log(`         동일 성격(장↔장, 단↔단) 오답 비율: ${sameTypeWrong}/${totalWrongs} (${sameTypePct}%)`);
  if (Number(sameTypePct) < 20) {
    issues.push(`동일 성격 오답이 ${sameTypePct}%로 낮음 → "장조/단조만 구별하면 되는" 쉬운 문제가 많을 수 있음`);
  }

  // B-3. "멜로디가 다 비슷하게 들린다" — 패턴 다양성
  console.log(`\n    B-3. 멜로디 다양성`);
  const patternCounts: Record<number, number> = {};
  for (const q of questions) patternCounts[q.patternIdx] = (patternCounts[q.patternIdx] || 0) + 1;
  const maxPatternPct = Math.max(...Object.values(patternCounts)) / questions.length * 100;
  const minPatternPct = Math.min(...Object.values(patternCounts)) / questions.length * 100;
  console.log(`         패턴 편차: 최다 ${maxPatternPct.toFixed(0)}% / 최소 ${minPatternPct.toFixed(0)}%`);
  const uniqueAbc = new Set(questions.map(q => q.abcNotation)).size;
  console.log(`         고유 ABC: ${uniqueAbc}개 / ${questions.length}문제`);

  // B-4. "음이 너무 높거나 낮다" — 음역대 분석
  console.log(`\n    B-4. 음역대 분석`);
  let totalMin = 127, totalMax = 0;
  const keyRanges: Record<string, { min: number; max: number }> = {};
  for (const q of questions) {
    const body = q.abcNotation.split('\n').pop() || '';
    const notes = extractNotes(body);
    for (const n of notes) {
      const midi = abcNoteToMidi(n);
      if (midi === null) continue;
      if (midi < totalMin) totalMin = midi;
      if (midi > totalMax) totalMax = midi;
      if (!keyRanges[q.correctKey]) keyRanges[q.correctKey] = { min: 127, max: 0 };
      if (midi < keyRanges[q.correctKey].min) keyRanges[q.correctKey].min = midi;
      if (midi > keyRanges[q.correctKey].max) keyRanges[q.correctKey].max = midi;
    }
  }
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midiToName = (m: number) => `${noteNames[m % 12]}${Math.floor(m / 12) - 1}`;
  console.log(`         전체 음역: ${midiToName(totalMin)} ~ ${midiToName(totalMax)} (${totalMax - totalMin}반음)`);

  // 극단적 음역대 조성 확인
  const extremeKeys: string[] = [];
  for (const [key, range] of Object.entries(keyRanges)) {
    if (range.min < 48) extremeKeys.push(`${KEY_TEMPLATES[key].name}: 최저 ${midiToName(range.min)} (낮음)`);
    if (range.max > 84) extremeKeys.push(`${KEY_TEMPLATES[key].name}: 최고 ${midiToName(range.max)} (높음)`);
  }
  if (extremeKeys.length > 0) {
    console.log(`         ⚠️  극단 음역대:`);
    for (const e of extremeKeys) console.log(`            - ${e}`);
    issues.push(`일부 조성의 음역대가 극단적 (${extremeKeys.length}건)`);
  } else {
    console.log(`         ✅ 모든 조성이 적절한 음역대`);
  }

  // B-5. "도약이 너무 크다" — 최대 음정 도약
  console.log(`\n    B-5. 최대 음정 도약`);
  let maxLeap = 0;
  let maxLeapExample = '';
  for (const q of questions) {
    const body = q.abcNotation.split('\n').pop() || '';
    const notes = extractNotes(body);
    for (let i = 1; i < notes.length; i++) {
      const leap = intervalSemitones(notes[i - 1], notes[i]);
      if (leap !== null && leap > maxLeap) {
        maxLeap = leap;
        maxLeapExample = `${notes[i - 1]}→${notes[i]} (${KEY_TEMPLATES[q.correctKey].name}, 패턴 ${PATTERN_NAMES[q.patternIdx]})`;
      }
    }
  }
  console.log(`         최대 도약: ${maxLeap}반음 — ${maxLeapExample}`);
  if (maxLeap > 14) {
    issues.push(`최대 도약 ${maxLeap}반음 → 9도 이상 도약이 부자연스러울 수 있음`);
  }

  // 각 패턴별 평균 최대 도약
  const patternMaxLeaps: Record<number, number[]> = {};
  for (const q of questions) {
    const body = q.abcNotation.split('\n').pop() || '';
    const notes = extractNotes(body);
    let mxLeap = 0;
    for (let i = 1; i < notes.length; i++) {
      const leap = intervalSemitones(notes[i - 1], notes[i]);
      if (leap !== null && leap > mxLeap) mxLeap = leap;
    }
    if (!patternMaxLeaps[q.patternIdx]) patternMaxLeaps[q.patternIdx] = [];
    patternMaxLeaps[q.patternIdx].push(mxLeap);
  }
  console.log(`         패턴별 평균 최대 도약:`);
  for (let i = 0; i < 10; i++) {
    const leaps = patternMaxLeaps[i] || [];
    if (leaps.length === 0) continue;
    const avg = (leaps.reduce((a, b) => a + b, 0) / leaps.length).toFixed(1);
    const max = Math.max(...leaps);
    console.log(`           ${PATTERN_NAMES[i].padEnd(16)} 평균 ${avg}반음, 최대 ${max}반음`);
  }

  // B-6. "보기 텍스트가 너무 길다/읽기 어렵다"
  console.log(`\n    B-6. 보기 텍스트 길이`);
  let maxChoiceLen = 0, totalChoiceLen = 0, choiceCount = 0;
  for (const q of questions) {
    for (const c of q.choices) {
      const len = c.length;
      if (len > maxChoiceLen) maxChoiceLen = len;
      totalChoiceLen += len;
      choiceCount++;
    }
  }
  const avgChoiceLen = (totalChoiceLen / choiceCount).toFixed(1);
  console.log(`         평균 ${avgChoiceLen}자, 최대 ${maxChoiceLen}자`);
  if (maxChoiceLen > 25) {
    issues.push(`보기 텍스트 최대 ${maxChoiceLen}자 → 모바일에서 줄바꿈 발생 가능`);
  }

  // B-7. "정답 위치가 편향된다"
  console.log(`\n    B-7. 정답 위치 편향`);
  const numChoices = questions[0].choices.length;
  const posDist = new Array(numChoices).fill(0);
  for (const q of questions) {
    const idx = q.choices.indexOf(q.correctAnswer);
    if (idx >= 0) posDist[idx]++;
  }
  const expectedPosPct = 100 / numChoices;
  let positionBias = false;
  for (let i = 0; i < numChoices; i++) {
    const pct = (posDist[i] / questions.length * 100).toFixed(1);
    const label = String.fromCharCode(65 + i);
    const biased = Math.abs(Number(pct) - expectedPosPct) > 12;
    if (biased) positionBias = true;
    console.log(`         ${label}: ${posDist[i]}회 (${pct}%) ${biased ? '⚠️ 편향' : ''}`);
  }
  if (positionBias) issues.push('정답 위치 편향 감지 (±12% 초과)');

  // B-8. 연속 동일 패턴 (조성은 달라도 패턴이 같으면 단조로움)
  console.log(`\n    B-8. 연속 동일 패턴 (다른 조성이라도)`);
  let maxConsecPattern = 1, curConsec = 1;
  for (let i = 1; i < questions.length; i++) {
    if (questions[i].patternIdx === questions[i - 1].patternIdx) {
      curConsec++;
      if (curConsec > maxConsecPattern) maxConsecPattern = curConsec;
    } else { curConsec = 1; }
  }
  console.log(`         최대 연속 동일 패턴: ${maxConsecPattern}회`);
  if (maxConsecPattern >= 4) {
    issues.push(`동일 패턴이 ${maxConsecPattern}회 연속 → 사용자가 "같은 곡만 나온다"고 느낄 수 있음`);
  }

  // ──── C. 불만 요약 ────
  console.log(`\n  [C] 사용자 불만 예상 요약`);
  if (issues.length === 0) {
    console.log(`      ✅ 특이사항 없음`);
  } else {
    for (let i = 0; i < issues.length; i++) {
      console.log(`      ${i + 1}. ${issues[i]}`);
    }
  }

  return issues;
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
    } else { beats += 1; }
  }
  return beats;
}

// ─── 메인 ───

function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     조성 판별 — 사용자 경험(UX) 관점 난이도별 100회 테스트         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allIssues: string[] = [];
  const difficulties: KeyDifficulty[] = ['key_1', 'key_2', 'key_3'];

  for (const diff of difficulties) {
    recentKeys = [];
    recentPatterns = [];
    const questions: Question[] = [];
    for (let i = 0; i < 100; i++) questions.push(generateKeyQuestion(diff));
    const issues = analyze(diff, questions);
    allIssues.push(...issues.map(s => `[${diff}] ${s}`));
  }

  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('  🎯 전체 불만 사항 종합 (우선순위 정렬)');
  console.log(`${'═'.repeat(70)}`);
  if (allIssues.length === 0) {
    console.log('  ✅ 모든 난이도에서 특이사항 없음');
  } else {
    for (let i = 0; i < allIssues.length; i++) {
      console.log(`  ${i + 1}. ${allIssues[i]}`);
    }
  }
}

main();
