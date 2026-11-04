/**
 * 화성진행·종지 재생용 4성부(SATB) 성부 배치 엔진
 *
 * 객관식 화성진행·종지 문제는 로마숫자 열(I–IV–V–I 등)을 소리로 들려준다. 예전에는 모든 화음을
 * 근음·3음·5음 순서로 같은 모양으로 쌓아 재생했기 때문에 화음이 바뀔 때마다 베이스–소프라노가
 * 병행 5도로 움직이고, 이끔음이 내려가고, 정격종지의 소프라노가 2̂→5̂로 끝났다(교재 기준 불완전종지).
 *
 * 이 모듈은 음악이론 교재의 성부 진행 규칙(Milne, *Fundamentals, Function, and Form* 14·17·22장)을
 * 비용 함수로 두고, 동적 계획법으로 진행 전체의 최소 비용 배치를 찾는다.
 *  · 금지(큰 비용): 병행 완전5도·8도·유니즌, 이끔음 중복, 소프라노 이끔음의 비상행 해결, 성부 교차
 *  · 선호(작은 비용): 공통음 유지·근접 진행, 근음 중복, 베이스와 반진행, 성부 겹침 회피,
 *    단조 증2도 회피, 내성 이끔음 상행, 완전 화음(5음 생략은 비용)
 *  · 종지 옵션: 정격종지(V→I)는 소프라노가 1̂로 끝난다(완전 정격종지, PAC)
 *
 * 입력은 "으뜸음 MIDI + 각 화음의 반음 간격 [근음, 3음, 5음(, 7음)]"을 받는다. 기본은 베이스=근음(기본 위치)이고,
 * ChordSpec 으로 전위(베이스에 둘 구성음)와 7화음을 지정할 수 있다(교재 18·23장: 7음은 2도 하행 해결).
 * 조표·음이름 철자는 호출 쪽(questionGenerator)에서 처리한다. 순수 함수이며 React Native 의존이 없다.
 */

export interface VoicedChord {
  bass: number;
  tenor: number;
  alto: number;
  soprano: number;
}

/** 화음 하나의 명세: 구성음 간격 + 베이스에 둘 구성음(0 근음·1 3음·2 5음·3 7음) */
export interface ChordSpec {
  /** 으뜸음 기준 반음 간격 [근음, 3음, 5음] 또는 [근음, 3음, 5음, 7음] */
  intervals: number[];
  /** 전위: 베이스 성부에 둘 구성음 인덱스 (기본 0 = 기본 위치) */
  bassMember?: number;
}

export interface RealizeProgressionOptions {
  /** 각 화음 — 반음 간격 배열(기본 위치) 또는 ChordSpec(전위·7화음) */
  chords: Array<number[] | ChordSpec>;
  tonicMidi: number;
  /** 단조이면 6̂–♯7̂ 증2도 진행을 피한다 */
  minor?: boolean;
  /** 마지막 화음의 소프라노를 으뜸음으로 고정 (완전 정격종지) — finalSopranoMembers: [0] 과 같다 */
  sopranoEndsOnTonic?: boolean;
  /**
   * 마지막 화음의 소프라노에 허용할 구성음 인덱스. [0] = 1̂(PAC), [1, 2] = 3̂·5̂(불완전 정격종지, IAC).
   * sopranoEndsOnTonic 보다 우선한다.
   */
  finalSopranoMembers?: number[];
  /** 테스트용 난수 소스 (기본 Math.random) */
  random?: () => number;
}

/** 성부 음역 (MIDI). 합창 기보 관행의 안전 음역 */
export const VOICE_RANGES = {
  bass: [40, 60] as const, // E2–C4
  tenor: [48, 67] as const, // C3–G4
  alto: [55, 74] as const, // G3–D5
  soprano: [60, 79] as const, // C4–G5
};

const PARALLEL_COST = 1000;
const CONTRARY_PERFECT_COST = 200;
const SOPRANO_LEADING_TONE_COST = 500;
const INNER_LEADING_TONE_COST = 25;
const OVERLAP_COST = 60;
const HIDDEN_PERFECT_COST = 40;
const AUG_SECOND_COST = 80;
const SEVENTH_RESOLUTION_COST = 300;
const INVERTED_BASS_DOUBLING_COST = 20;

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

const isPerfect = (ic: number): boolean => ic === 0 || ic === 7;

function pitchesInRange(pc: number, range: readonly [number, number]): number[] {
  const out: number[] = [];
  for (let m = range[0]; m <= range[1]; m++) if (mod12(m) === pc) out.push(m);
  return out;
}

interface Candidate extends VoicedChord {
  cost: number;
}

function voicesOf(c: VoicedChord): number[] {
  return [c.bass, c.tenor, c.alto, c.soprano];
}

/**
 * 한 화음의 가능한 배치 후보(베이스=지정 구성음, 상3성은 화음음)와 정적 비용.
 *  · 3음은 반드시 포함, 5음 생략은 비용. 이끔음 중복 금지
 *  · 7화음: 근음·3음·7음 필수, 5음 생략은 가벼운 비용(관행적 V7 = 근음 중복·5음 생략)
 *  · 전위: 베이스 음 중복은 비용 (3음 베이스 중복 회피)
 *  · 인접 상성부 간격 ≤ 옥타브, 성부 교차 금지(유니즌은 비용)
 */
function buildCandidates(
  pcs: number[],
  bassPc: number,
  leadingTonePc: number,
  preferredSopranoPc: number | null,
  random: () => number,
): Candidate[] {
  const [rootPc, thirdPc, fifthPc, seventhPc] = pcs;
  const isSeventh = pcs.length >= 4;
  const inverted = bassPc !== rootPc;
  const tenors = pcs.flatMap((pc) => pitchesInRange(pc, VOICE_RANGES.tenor));
  const altos = pcs.flatMap((pc) => pitchesInRange(pc, VOICE_RANGES.alto));
  const sopranos = pcs.flatMap((pc) => pitchesInRange(pc, VOICE_RANGES.soprano));
  const out: Candidate[] = [];

  for (const bass of pitchesInRange(bassPc, VOICE_RANGES.bass)) {
    for (const tenor of tenors) {
      if (tenor <= bass || tenor - bass > 24) continue;
      for (const alto of altos) {
        if (alto < tenor || alto - tenor > 12) continue;
        for (const soprano of sopranos) {
          if (soprano < alto || soprano - alto > 12) continue;

          const counts = new Map<number, number>();
          for (const p of [bass, tenor, alto, soprano]) {
            const pc = mod12(p);
            counts.set(pc, (counts.get(pc) ?? 0) + 1);
          }
          if (!counts.has(thirdPc)) continue; // 3음 생략 금지 (장·단 구분이 사라짐)
          if (!counts.has(rootPc)) continue; // 근음 생략 금지
          if ((counts.get(leadingTonePc) ?? 0) >= 2) continue; // 이끔음 중복 금지
          if (isSeventh) {
            if (!counts.has(seventhPc)) continue; // 7음 생략 금지 (7화음의 정체)
            if ((counts.get(seventhPc) ?? 0) >= 2) continue; // 7음 중복 금지 (해결 시 병행 8도)
          }

          let cost = 0;
          if (!counts.has(fifthPc)) cost += isSeventh ? 5 : 25; // 5음 생략 (허용하되 비용)
          if ((counts.get(thirdPc) ?? 0) >= 2) cost += 10; // 3음 중복 (기만종지 등에서 허용)
          if ((counts.get(fifthPc) ?? 0) >= 2) cost += 5;
          if ((counts.get(rootPc) ?? 0) >= 3) cost += 15;
          if (inverted && (counts.get(bassPc) ?? 0) >= 2) cost += INVERTED_BASS_DOUBLING_COST;
          if (tenor === alto || alto === soprano) cost += 15; // 유니즌
          if (soprano < 62 || soprano > 77) cost += 4; // 소프라노 극단 음역
          if (bass < 43) cost += (43 - bass) * 0.5;
          if (bass > 55) cost += (bass - 55) * 0.5;
          if (preferredSopranoPc !== null && mod12(soprano) !== preferredSopranoPc) cost += 6;
          cost += random() * 3; // 같은 진행이라도 매번 조금 다른 배치가 나오게

          out.push({ bass, tenor, alto, soprano, cost });
        }
      }
    }
  }
  return out;
}

interface TransitionContext {
  leadingTonePc: number;
  /** 다음 화음이 이끔음 해결 대상(으뜸화음 또는 vi/VI)인가 */
  resolvesLeadingTone: boolean;
  /** 단조의 6̂ (증2도 검사용). 장조면 null */
  minorSixthPc: number | null;
  /** 앞 화음이 7화음이면 그 7음 pc — 같은 성부가 2도 아래로 해결해야 한다. 아니면 null */
  prevSeventhPc: number | null;
}

/**
 * 두 화음 사이의 성부 진행 비용. 병행 완전음정은 사실상 금지 수준의 비용을 준다.
 */
function transitionCost(prev: VoicedChord, cur: VoicedChord, ctx: TransitionContext): number {
  const pv = voicesOf(prev);
  const cv = voicesOf(cur);
  let cost = 0;

  // 병행 완전5도·8도·유니즌 (모든 성부 쌍). 둘 다 같은 방향으로 움직여야 병행이다.
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const ip = mod12(pv[j] - pv[i]);
      const ic = mod12(cv[j] - cv[i]);
      if (!isPerfect(ip) || ip !== ic) continue;
      const di = cv[i] - pv[i];
      const dj = cv[j] - pv[j];
      if (di === 0 || dj === 0) continue; // 한 성부만 옥타브 도약 — 병행 아님
      cost += Math.sign(di) === Math.sign(dj) ? PARALLEL_COST : CONTRARY_PERFECT_COST;
    }
  }

  // 숨은 5도·8도: 외성이 유사진행으로 완전음정에 도달하면서 소프라노가 도약
  const dS = cur.soprano - prev.soprano;
  const dB = cur.bass - prev.bass;
  if (
    isPerfect(mod12(cur.soprano - cur.bass)) &&
    dS !== 0 &&
    dB !== 0 &&
    Math.sign(dS) === Math.sign(dB) &&
    Math.abs(dS) > 2
  ) {
    cost += HIDDEN_PERFECT_COST;
  }

  // 성부 겹침 (overlap): 이웃 성부가 직전에 있던 자리를 넘어가지 않는다
  if (cur.tenor < prev.bass || cur.bass > prev.tenor) cost += OVERLAP_COST;
  if (cur.alto < prev.tenor || cur.tenor > prev.alto) cost += OVERLAP_COST;
  if (cur.soprano < prev.alto || cur.alto > prev.soprano) cost += OVERLAP_COST;

  // 이동량 — 공통음 유지·근접 진행 선호, 베이스는 도약이 자연스러우니 가볍게
  const dT = cur.tenor - prev.tenor;
  const dA = cur.alto - prev.alto;
  cost += Math.abs(dT) + Math.abs(dA) + Math.abs(dS) * 1.2 + Math.abs(dB) * 0.3;
  if (Math.abs(dS) > 5) cost += 8;
  if (Math.abs(dS) > 9) cost += 20;
  if (Math.abs(dT) > 7) cost += 10;
  if (Math.abs(dA) > 7) cost += 10;

  // 이끔음 해결: 소프라노는 반드시 1̂로 상행, 내성은 상행 선호(완전 화음을 위해 5̂로 내려갈 수 있음)
  if (ctx.resolvesLeadingTone) {
    const inner: Array<[number, number]> = [
      [prev.tenor, cur.tenor],
      [prev.alto, cur.alto],
    ];
    if (mod12(prev.soprano) === ctx.leadingTonePc && dS !== 1) cost += SOPRANO_LEADING_TONE_COST;
    for (const [p, c] of inner) {
      if (mod12(p) === ctx.leadingTonePc && c - p !== 1) cost += INNER_LEADING_TONE_COST;
    }
  }

  // 7화음의 7음은 2도(반음 1~2개) 하행 해결 — 어느 성부에 있든 적용 (베이스 포함, 4/2 전위)
  if (ctx.prevSeventhPc !== null) {
    for (let v = 0; v < 4; v++) {
      if (mod12(pv[v]) !== ctx.prevSeventhPc) continue;
      const d = cv[v] - pv[v];
      if (d !== -1 && d !== -2) cost += SEVENTH_RESOLUTION_COST;
    }
  }

  // 단조: 6̂ ↔ ♯7̂ 증2도 진행 회피
  if (ctx.minorSixthPc !== null) {
    for (let v = 0; v < 4; v++) {
      const a = mod12(pv[v]);
      const b = mod12(cv[v]);
      if (
        (a === ctx.minorSixthPc && b === ctx.leadingTonePc) ||
        (a === ctx.leadingTonePc && b === ctx.minorSixthPc)
      ) {
        cost += AUG_SECOND_COST;
      }
    }
  }

  // 베이스가 순차진행하면 소프라노는 반진행 선호
  if (dB !== 0 && Math.abs(dB) <= 2 && dS !== 0 && Math.sign(dS) !== Math.sign(dB)) cost -= 5;

  return cost;
}

function toSpec(chord: number[] | ChordSpec): ChordSpec {
  return Array.isArray(chord) ? { intervals: chord, bassMember: 0 } : chord;
}

/**
 * 로마숫자 진행을 4성부로 배치한다. 반환 배열은 입력 화음 순서와 같다.
 */
export function realizeProgression(opts: RealizeProgressionOptions): VoicedChord[] {
  const random = opts.random ?? Math.random;
  const tonicPc = mod12(opts.tonicMidi);
  const leadingTonePc = mod12(opts.tonicMidi + 11);
  const submediantPc = mod12(opts.tonicMidi + (opts.minor ? 8 : 9));
  const minorSixthPc = opts.minor ? submediantPc : null;

  const specs = opts.chords.map(toSpec);
  const pcsList = specs.map((spec) =>
    spec.intervals.slice(0, 4).map((i) => mod12(opts.tonicMidi + i)),
  );
  if (pcsList.length === 0) return [];
  const bassPcs = specs.map((spec, i) => {
    const member = Math.min(spec.bassMember ?? 0, pcsList[i].length - 1);
    return pcsList[i][member];
  });

  const firstPreferred = pcsList[0][Math.min(2, Math.floor(random() * 3))];
  const last = pcsList.length - 1;
  const finalMembers = opts.finalSopranoMembers ?? (opts.sopranoEndsOnTonic ? [0] : null);
  const layers = pcsList.map((pcs, idx) => {
    let cands = buildCandidates(
      pcs,
      bassPcs[idx],
      leadingTonePc,
      idx === 0 ? firstPreferred : null,
      random,
    );
    if (idx === last && finalMembers) {
      const allowed = new Set(finalMembers.map((m) => pcs[Math.min(m, pcs.length - 1)]));
      const filtered = cands.filter((c) => allowed.has(mod12(c.soprano)));
      if (filtered.length > 0) cands = filtered;
    }
    return cands;
  });

  // Viterbi: 누적 최소 비용 + 역추적 포인터
  let best = layers[0].map((c) => c.cost);
  const back: number[][] = [];
  for (let i = 1; i < layers.length; i++) {
    const prevLayer = layers[i - 1];
    const curLayer = layers[i];
    const ctx: TransitionContext = {
      leadingTonePc,
      resolvesLeadingTone:
        pcsList[i - 1].includes(leadingTonePc) &&
        (pcsList[i][0] === tonicPc || pcsList[i][0] === submediantPc),
      minorSixthPc,
      prevSeventhPc: pcsList[i - 1].length >= 4 ? pcsList[i - 1][3] : null,
    };
    const next = new Array<number>(curLayer.length).fill(Infinity);
    const ptr = new Array<number>(curLayer.length).fill(0);
    for (let j = 0; j < curLayer.length; j++) {
      const cur = curLayer[j];
      for (let k = 0; k < prevLayer.length; k++) {
        const c = best[k] + transitionCost(prevLayer[k], cur, ctx);
        if (c < next[j]) {
          next[j] = c;
          ptr[j] = k;
        }
      }
      next[j] += cur.cost;
    }
    best = next;
    back.push(ptr);
  }

  let idx = 0;
  for (let j = 1; j < best.length; j++) if (best[j] < best[idx]) idx = j;
  const path: number[] = [idx];
  for (let i = back.length - 1; i >= 0; i--) {
    idx = back[i][idx];
    path.unshift(idx);
  }
  return path.map((j, i) => {
    const { bass, tenor, alto, soprano } = layers[i][j];
    return { bass, tenor, alto, soprano };
  });
}

/**
 * 배치 결과의 규칙 위반 목록 (테스트·QA용). 비어 있으면 통과.
 *  · parallel: 병행 완전5도·8도·유니즌  · crossing: 성부 교차  · spacing: 상성부 간격 > 옥타브
 *  · range: 음역 밖  · leadingTone: 소프라노 이끔음이 1̂로 상행하지 않음 (resolveIdx 에 지정한 전환만)
 *  · seventh: 앞 화음의 7음(seventhPcs[i-1])을 가진 성부가 2도 하행하지 않음
 */
export function voiceLeadingIssues(
  chords: VoicedChord[],
  opts: {
    leadingTonePc?: number;
    resolveIdx?: number[];
    /** 화음별 7음 pc (7화음이 아니면 null) */
    seventhPcs?: Array<number | null>;
  } = {},
): string[] {
  const issues: string[] = [];
  const names = ['B', 'T', 'A', 'S'];
  const ranges = [VOICE_RANGES.bass, VOICE_RANGES.tenor, VOICE_RANGES.alto, VOICE_RANGES.soprano];
  chords.forEach((c, i) => {
    const v = voicesOf(c);
    v.forEach((p, k) => {
      if (p < ranges[k][0] || p > ranges[k][1]) issues.push(`range:${i}:${names[k]}`);
    });
    if (!(v[0] < v[1] && v[1] <= v[2] && v[2] <= v[3])) issues.push(`crossing:${i}`);
    if (v[2] - v[1] > 12 || v[3] - v[2] > 12) issues.push(`spacing:${i}`);
    if (i === 0) return;
    const pv = voicesOf(chords[i - 1]);
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        const ip = mod12(pv[b] - pv[a]);
        const ic = mod12(v[b] - v[a]);
        const da = v[a] - pv[a];
        const db = v[b] - pv[b];
        if (isPerfect(ip) && ip === ic && da !== 0 && db !== 0 && Math.sign(da) === Math.sign(db)) {
          issues.push(`parallel:${i}:${names[a]}${names[b]}:${ic === 0 ? '8' : '5'}`);
        }
      }
    }
    if (
      opts.leadingTonePc !== undefined &&
      opts.resolveIdx?.includes(i) &&
      mod12(pv[3]) === opts.leadingTonePc &&
      v[3] - pv[3] !== 1
    ) {
      issues.push(`leadingTone:${i}`);
    }
    const seventhPc = opts.seventhPcs?.[i - 1];
    if (seventhPc !== undefined && seventhPc !== null) {
      for (let k = 0; k < 4; k++) {
        if (mod12(pv[k]) !== seventhPc) continue;
        const d = v[k] - pv[k];
        if (d !== -1 && d !== -2) issues.push(`seventh:${i}:${names[k]}`);
      }
    }
  });
  return issues;
}
