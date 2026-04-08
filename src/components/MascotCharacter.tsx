// ─────────────────────────────────────────────────────────────
// MascotCharacter — SVG 마스코트 캐릭터 (헤드폰 착용)
// 레벨(1-100)에 따라 외형이 변화한다.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import Svg, {
  Circle, Ellipse, Path, Rect, G, Defs, RadialGradient, Stop,
} from 'react-native-svg';
import { getMascotParams, type MascotParams } from '../lib/mascotConfig';

interface Props {
  size?: number;
  level?: number; // 1-100, defaults to 1
  happy?: boolean;
}

/* ── 음표 장식 위치 (최대 5개, 겹치지 않도록 고정 좌표) ── */
const NOTE_POSITIONS = [
  { cx: 82, cy: 14, size: 3, flagDir: 1 },
  { cx: 16, cy: 18, size: 2.2, flagDir: -1 },
  { cx: 88, cy: 30, size: 2.5, flagDir: 1 },
  { cx: 10, cy: 34, size: 2, flagDir: -1 },
  { cx: 50, cy: 6, size: 2.8, flagDir: 1 },
];

/* ── 눈 렌더링 (eyeStyle 0-9) ── */
function renderEyes(style: number, happy: boolean) {
  const color = '#1e1b4b';

  return (
    <G>
      <Path d="M 36 50 Q 40 46 44 50" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M 56 50 Q 60 46 64 50" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </G>
  );
}

/* ── 입 렌더링 (mouthStyle 0-9) ── */
function renderMouth(style: number) {
  const color = '#1e1b4b';
  switch (style) {
    case 0: // 작은 미소
      return <Path d="M 44 62 Q 50 66 56 62" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />;
    case 1: // 큰 미소
      return <Path d="M 42 61 Q 50 68 58 61" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />;
    case 2: // 작은 미소 (뉴비와 동일)
      return <Path d="M 44 62 Q 50 66 56 62" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />;
    case 3: // 고양이 입 (w)
      return <Path d="M 42 62 L 46 65 L 50 61 L 54 65 L 58 62" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />;
    case 4: // 쿨한 한쪽 입꼬리
      return <Path d="M 44 63 Q 52 63 58 60" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />;
    case 5: // 활짝 웃음 (넓은 호)
      return <Path d="M 40 60 Q 50 72 60 60" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
    case 6: // 혀 내밀기
      return (
        <G>
          <Path d="M 43 62 Q 50 67 57 62" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Ellipse cx={50} cy={67} rx={3} ry={2.5} fill="#f87171" />
        </G>
      );
    case 7: // 휘파람 (작은 원)
      return <Circle cx={50} cy={63} r={2.5} fill={color} />;
    case 8: // 노래 (타원형 벌린 입)
      return <Ellipse cx={50} cy={63} rx={5} ry={4} fill={color} />;
    case 9: // 레전드 (이빨 라인이 있는 미소)
      return (
        <G>
          <Path d="M 40 60 Q 50 70 60 60" fill="#fff" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M 42 62 L 58 62" fill="none" stroke={color} strokeWidth={1} />
        </G>
      );
    default:
      return <Path d="M 44 62 Q 50 66 56 62" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />;
  }
}

/* ── 악세서리 렌더링 ── */
function renderAccessory(accessory: MascotParams['accessory'], p: MascotParams) {
  switch (accessory) {
    case 'headband':
      return (
        <G>
          {/* 리본 본체 */}
          <Path d="M 42 32 L 36 28 L 38 33 L 36 38 L 42 34 Z" fill="#fbbf24" />
          <Path d="M 42 32 L 48 28 L 46 33 L 48 38 L 42 34 Z" fill="#f59e0b" />
          <Circle cx={42} cy={33} r={2} fill="#fde68a" />
        </G>
      );
    case 'bowtie':
      return (
        <G>
          <Path d="M 44 72 L 50 75 L 56 72 L 50 69 Z" fill="#e11d48" stroke="#be123c" strokeWidth={0.8} />
          <Circle cx={50} cy={72} r={1.5} fill="#fbbf24" />
        </G>
      );
    case 'scarf':
      return (
        <G>
          <Path d="M 30 70 Q 50 76 70 70 Q 70 78 65 80 Q 50 82 35 80 Q 30 78 30 70 Z" fill="#ef4444" opacity={0.85} />
          <Path d="M 48 76 Q 46 84 44 88" fill="none" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
          <Path d="M 52 76 Q 50 82 49 86" fill="none" stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
        </G>
      );
    case 'sunglasses':
      return (
        <G>
          <Rect x={32} y={46} width={14} height={9} rx={3} fill="#1e293b" opacity={0.9} />
          <Rect x={54} y={46} width={14} height={9} rx={3} fill="#1e293b" opacity={0.9} />
          <Path d="M 46 50 L 54 50" fill="none" stroke="#1e293b" strokeWidth={1.5} />
          <Rect x={33} y={47} width={5} height={3} rx={1} fill="#fff" opacity={0.2} />
          <Rect x={55} y={47} width={5} height={3} rx={1} fill="#fff" opacity={0.2} />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d="M 36 30 L 38 22 L 44 28 L 50 18 L 56 28 L 62 22 L 64 30 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth={0.8} />
          <Circle cx={50} cy={26} r={1.5} fill="#ef4444" />
          <Circle cx={42} cy={28} r={1} fill="#3b82f6" />
          <Circle cx={58} cy={28} r={1} fill="#3b82f6" />
        </G>
      );
    case 'smallWings':
      return (
        <G opacity={0.7}>
          <Path d="M 18 56 Q 8 50 12 40 Q 16 46 20 50 Z" fill={p.bodyColor} />
          <Path d="M 82 56 Q 92 50 88 40 Q 84 46 80 50 Z" fill={p.bodyColor} />
        </G>
      );
    case 'bigWings':
      return (
        <G opacity={0.8}>
          <Path d="M 18 56 Q 2 46 6 30 Q 10 38 14 42 Q 8 34 10 24 Q 16 36 20 48 Z" fill={p.bodyColor} />
          <Path d="M 82 56 Q 98 46 94 30 Q 90 38 86 42 Q 92 34 90 24 Q 84 36 80 48 Z" fill={p.bodyColor} />
        </G>
      );
    case 'halo':
      return (
        <Ellipse cx={50} cy={20} rx={16} ry={4} fill="none" stroke="#fbbf24" strokeWidth={2.5} opacity={0.8} />
      );
    case 'fire':
      return (
        <G opacity={0.85}>
          <Path d="M 38 86 Q 36 78 40 74 Q 42 80 44 76 Q 46 82 50 72 Q 54 82 56 76 Q 58 80 60 74 Q 64 78 62 86 Z" fill="#f97316" />
          <Path d="M 42 86 Q 41 80 44 77 Q 46 82 50 75 Q 54 82 56 77 Q 59 80 58 86 Z" fill="#fbbf24" />
          <Path d="M 46 86 Q 46 82 50 78 Q 54 82 54 86 Z" fill="#fef3c7" />
        </G>
      );
    case 'none':
    default:
      return null;
  }
}

/* ── 음표 장식 렌더링 ── */
function renderDecorations(count: number, bodyColor: string) {
  if (count <= 0) return null;
  return (
    <G>
      {NOTE_POSITIONS.slice(0, count).map((pos, i) => (
        <G key={i} opacity={0.55 + i * 0.08}>
          <Circle cx={pos.cx} cy={pos.cy} r={pos.size} fill={bodyColor} />
          <Rect
            x={pos.cx + pos.size * 0.6}
            y={pos.cy - pos.size * 3}
            width={pos.size * 0.55}
            height={pos.size * 3}
            rx={pos.size * 0.25}
            fill={bodyColor}
          />
          <Path
            d={`M ${pos.cx + pos.size * 0.6 + pos.size * 0.55} ${pos.cy - pos.size * 3} Q ${pos.cx + pos.size * 0.6 + pos.size * 2.5 * pos.flagDir} ${pos.cy - pos.size * 3.5} ${pos.cx + pos.size * 0.6 + pos.size * 2.5 * pos.flagDir} ${pos.cy - pos.size * 2}`}
            fill="none"
            stroke={bodyColor}
            strokeWidth={pos.size * 0.4}
            strokeLinecap="round"
          />
        </G>
      ))}
    </G>
  );
}

/* ── 귀 렌더링 (5종) ── */
function renderEars(earType: number, bodyColor: string) {
  switch (earType) {
    case 1: // 둥근 귀
      return (
        <G>
          <Circle cx={28} cy={30} r={8} fill={bodyColor} />
          <Circle cx={28} cy={30} r={5} fill={bodyColor} opacity={0.6} />
          <Circle cx={72} cy={30} r={8} fill={bodyColor} />
          <Circle cx={72} cy={30} r={5} fill={bodyColor} opacity={0.6} />
        </G>
      );
    case 2: // 고양이 귀
      return (
        <G>
          <Path d="M 24 36 L 20 16 L 36 28 Z" fill={bodyColor} />
          <Path d="M 26 33 L 23 19 L 34 29 Z" fill={bodyColor} opacity={0.5} />
          <Path d="M 76 36 L 80 16 L 64 28 Z" fill={bodyColor} />
          <Path d="M 74 33 L 77 19 L 66 29 Z" fill={bodyColor} opacity={0.5} />
        </G>
      );
    case 3: // 토끼 귀
      return (
        <G>
          <Ellipse cx={32} cy={16} rx={6} ry={14} fill={bodyColor} />
          <Ellipse cx={32} cy={16} rx={3.5} ry={10} fill="#fca5a5" opacity={0.5} />
          <Ellipse cx={68} cy={16} rx={6} ry={14} fill={bodyColor} />
          <Ellipse cx={68} cy={16} rx={3.5} ry={10} fill="#fca5a5" opacity={0.5} />
        </G>
      );
    case 4: // 곰 귀
      return (
        <G>
          <Circle cx={26} cy={28} r={10} fill={bodyColor} />
          <Circle cx={26} cy={28} r={6} fill={bodyColor} opacity={0.4} />
          <Circle cx={74} cy={28} r={10} fill={bodyColor} />
          <Circle cx={74} cy={28} r={6} fill={bodyColor} opacity={0.4} />
        </G>
      );
    default:
      return null;
  }
}

/* ── 볼 장식 렌더링 (5종) ── */
function renderCheekDecor(cheekDecor: number, blushColor: string) {
  switch (cheekDecor) {
    case 1: // 점
      return (
        <G>
          <Circle cx={32} cy={58} r={1.5} fill={blushColor} />
          <Circle cx={68} cy={58} r={1.5} fill={blushColor} />
        </G>
      );
    case 2: // 별
      return (
        <G opacity={0.7}>
          <Path d="M 31 57 L 31.8 59 L 34 59.2 L 32.3 60.5 L 32.8 62.5 L 31 61.3 L 29.2 62.5 L 29.7 60.5 L 28 59.2 L 30.2 59 Z" fill={blushColor} />
          <Path d="M 69 57 L 69.8 59 L 72 59.2 L 70.3 60.5 L 70.8 62.5 L 69 61.3 L 67.2 62.5 L 67.7 60.5 L 66 59.2 L 68.2 59 Z" fill={blushColor} />
        </G>
      );
    case 3: // 하트
      return (
        <G opacity={0.6}>
          <Path d="M 31 58 C 31 56.5 29 56 29 57.5 C 29 58.5 31 60 31 60 C 31 60 33 58.5 33 57.5 C 33 56 31 56.5 31 58 Z" fill="#f87171" />
          <Path d="M 69 58 C 69 56.5 67 56 67 57.5 C 67 58.5 69 60 69 60 C 69 60 71 58.5 71 57.5 C 71 56 69 56.5 69 58 Z" fill="#f87171" />
        </G>
      );
    case 4: // 반짝이
      return (
        <G opacity={0.6}>
          <Path d="M 31 56 L 31.5 58 L 33.5 58.5 L 31.5 59 L 31 61 L 30.5 59 L 28.5 58.5 L 30.5 58 Z" fill={blushColor} />
          <Path d="M 69 56 L 69.5 58 L 71.5 58.5 L 69.5 59 L 69 61 L 68.5 59 L 66.5 58.5 L 68.5 58 Z" fill={blushColor} />
        </G>
      );
    default:
      return null;
  }
}

/* ── 배경 렌더링 (티어별) ── */
function renderBackground(tier: number, bodyColor: string) {
  const o = 0.15; // 투명도
  switch (tier) {
    case 0: // 없음
      return null;
    case 1: // 연한 원
      return <Circle cx={50} cy={50} r={46} fill={bodyColor} opacity={0.1} />;
    case 2: // 작은 별 흩뿌림
      return (
        <G opacity={o}>
          <Path d="M 12 12 L 13 15 L 16 15 L 13.5 17 L 14.5 20 L 12 18 L 9.5 20 L 10.5 17 L 8 15 L 11 15 Z" fill={bodyColor} />
          <Path d="M 85 8 L 86 11 L 89 11 L 86.5 13 L 87.5 16 L 85 14 L 82.5 16 L 83.5 13 L 81 11 L 84 11 Z" fill={bodyColor} />
          <Path d="M 8 78 L 9 81 L 12 81 L 9.5 83 L 10.5 86 L 8 84 L 5.5 86 L 6.5 83 L 4 81 L 7 81 Z" fill={bodyColor} />
          <Path d="M 90 75 L 91 78 L 94 78 L 91.5 80 L 92.5 83 L 90 81 L 87.5 83 L 88.5 80 L 86 78 L 89 78 Z" fill={bodyColor} />
        </G>
      );
    case 3: // 구름
      return (
        <G opacity={0.12}>
          <Circle cx={14} cy={86} r={8} fill={bodyColor} />
          <Circle cx={22} cy={84} r={6} fill={bodyColor} />
          <Circle cx={8} cy={84} r={5} fill={bodyColor} />
          <Circle cx={82} cy={10} r={7} fill={bodyColor} />
          <Circle cx={90} cy={8} r={5} fill={bodyColor} />
        </G>
      );
    case 4: // 음표 패턴
      return (
        <G opacity={o}>
          <Circle cx={10} cy={14} r={2.5} fill={bodyColor} />
          <Rect x={12} y={6} width={1.5} height={8} rx={0.7} fill={bodyColor} />
          <Circle cx={88} cy={80} r={2.5} fill={bodyColor} />
          <Rect x={90} y={72} width={1.5} height={8} rx={0.7} fill={bodyColor} />
          <Circle cx={8} cy={70} r={2} fill={bodyColor} />
          <Rect x={9.5} y={64} width={1.2} height={6} rx={0.6} fill={bodyColor} />
        </G>
      );
    case 5: // 하트
      return (
        <G opacity={o}>
          <Path d="M 12 14 C 12 12 10 11 10 12.5 C 10 13.5 12 15.5 12 15.5 C 12 15.5 14 13.5 14 12.5 C 14 11 12 12 12 14 Z" fill={bodyColor} />
          <Path d="M 88 82 C 88 80 86 79 86 80.5 C 86 81.5 88 83.5 88 83.5 C 88 83.5 90 81.5 90 80.5 C 90 79 88 80 88 82 Z" fill={bodyColor} />
          <Path d="M 6 52 C 6 50 4 49 4 50.5 C 4 51.5 6 53.5 6 53.5 C 6 53.5 8 51.5 8 50.5 C 8 49 6 50 6 52 Z" fill={bodyColor} />
        </G>
      );
    case 6: // 다이아몬드
      return (
        <G opacity={o}>
          <Path d="M 10 16 L 13 20 L 10 24 L 7 20 Z" fill={bodyColor} />
          <Path d="M 88 76 L 91 80 L 88 84 L 85 80 Z" fill={bodyColor} />
          <Path d="M 90 14 L 93 18 L 90 22 L 87 18 Z" fill={bodyColor} />
        </G>
      );
    case 7: // 빛줄기
      return (
        <G opacity={0.1}>
          <Path d="M 50 0 L 52 40 L 48 40 Z" fill={bodyColor} />
          <Path d="M 50 0 L 70 35 L 66 37 Z" fill={bodyColor} />
          <Path d="M 50 0 L 30 35 L 34 37 Z" fill={bodyColor} />
          <Path d="M 50 0 L 85 25 L 82 28 Z" fill={bodyColor} />
          <Path d="M 50 0 L 15 25 L 18 28 Z" fill={bodyColor} />
        </G>
      );
    case 8: // 동심원
      return (
        <G opacity={0.08}>
          <Circle cx={50} cy={50} r={46} fill="none" stroke={bodyColor} strokeWidth={2} />
          <Circle cx={50} cy={50} r={38} fill="none" stroke={bodyColor} strokeWidth={1.5} />
          <Circle cx={50} cy={50} r={30} fill="none" stroke={bodyColor} strokeWidth={1} />
        </G>
      );
    case 9: // 무지개 링
      return (
        <G opacity={0.12}>
          <Circle cx={50} cy={50} r={46} fill="none" stroke="#ef4444" strokeWidth={2} />
          <Circle cx={50} cy={50} r={43} fill="none" stroke="#f97316" strokeWidth={2} />
          <Circle cx={50} cy={50} r={40} fill="none" stroke="#eab308" strokeWidth={2} />
          <Circle cx={50} cy={50} r={37} fill="none" stroke="#22c55e" strokeWidth={2} />
          <Circle cx={50} cy={50} r={34} fill="none" stroke="#3b82f6" strokeWidth={2} />
        </G>
      );
    default:
      return null;
  }
}


/* ── 메인 컴포넌트 ── */
export default function MascotCharacter({ size = 100, level = 1, happy = false }: Props) {
  const p = getMascotParams(level);
  const clamped = Math.max(1, Math.min(60, level));
  const tier = Math.min(9, Math.floor((clamped - 1) / 6));

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* 그라디언트 정의 (오라용) */}
      {p.hasAura && (
        <Defs>
          <RadialGradient id={`aura_${level}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={p.bodyColor} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={p.bodyColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
      )}

      {/* 배경 */}
      {renderBackground(tier, p.bodyColor)}

      {/* 오라 */}
      {p.hasAura && (
        <Circle cx={50} cy={56} r={46} fill={`url(#aura_${level})`} />
      )}

      {/* 악세서리 (뒤쪽: 날개, 불꽃, 스카프) */}
      {(p.accessory === 'smallWings' || p.accessory === 'bigWings' || p.accessory === 'fire' || p.accessory === 'scarf') && renderAccessory(p.accessory, p)}

      {/* 귀 (몸통 뒤에) */}
      {renderEars(p.earType, p.bodyColor)}

      {/* 몸통 */}
      <Circle cx={50} cy={56} r={32} fill={p.bodyColor} />

      {/* 얼굴 안쪽 */}
      <Circle cx={50} cy={54} r={26} fill={p.innerColor} />

      {/* 눈 */}
      {renderEyes(p.eyeStyle, happy)}

      {/* 입 */}
      {renderMouth(p.mouthStyle)}

      {/* 볼 터치 */}
      <Ellipse cx={34} cy={58} rx={4} ry={2.5} fill={p.blushColor} opacity={0.5} />
      <Ellipse cx={66} cy={58} rx={4} ry={2.5} fill={p.blushColor} opacity={0.5} />

      {/* 볼 장식 */}
      {renderCheekDecor(p.cheekDecor, p.blushColor)}

      {/* 악세서리 (앞쪽: 선글라스, 왕관, 헤드밴드, 나비넥타이) */}
      {p.accessory !== 'smallWings' && p.accessory !== 'bigWings' && p.accessory !== 'fire' && p.accessory !== 'scarf' && p.accessory !== 'none' && p.accessory !== 'halo' && renderAccessory(p.accessory, p)}

      {/* 헤드폰 밴드 */}
      <Path
        d="M 22 44 Q 22 18 50 18 Q 78 18 78 44"
        fill="none"
        stroke={p.headphoneColor}
        strokeWidth={3.5}
        strokeLinecap="round"
      />

      {/* 헤드폰 좌우 */}
      <Rect x={14} y={38} width={12} height={16} rx={5} fill={p.headphoneColor} />
      <Rect x={16} y={40} width={8} height={12} rx={3.5} fill={p.headphoneInner} />
      <Rect x={74} y={38} width={12} height={16} rx={5} fill={p.headphoneColor} />
      <Rect x={76} y={40} width={8} height={12} rx={3.5} fill={p.headphoneInner} />

      {/* 헤일로 (최상위) */}
      {p.accessory === 'halo' && renderAccessory(p.accessory, p)}

      {/* 음표 장식 */}
      {renderDecorations(p.decorCount, p.bodyColor)}
    </Svg>
  );
}
