# 연습 설정 시트 (박자/조성/빠르기) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선율 받아쓰기, 2성부 받아쓰기의 CategoryPracticeScreen에 설정 버튼을 추가하여 박자/조성/빠르기를 사용자가 직접 선택할 수 있는 팝업(BottomSheet)을 제공하고, 선택된 설정이 악보 생성에 반영되도록 한다.

**Architecture:** CategoryPracticeScreen에 설정 상태를 관리하고 PracticeSettingsSheet 컴포넌트를 추가한다. 설정값은 navigation params로 NotationPracticeScreen에 전달되어 generatePracticeScore()에서 사용된다. 난이도별로 설정 가능한 범위가 달라지므로, 현재 설정에 따른 난이도 레이블을 동적으로 표시한다.

**Tech Stack:** React Native, TypeScript, 기존 BottomSheet 컴포넌트, 기존 CATEGORY_COLORS 테마

---

## 파일 구조

| 파일 | 작업 | 역할 |
|------|------|------|
| `src/components/PracticeSettingsSheet.tsx` | 생성 | 박자/조성/빠르기 설정 BottomSheet UI |
| `src/screens/CategoryPracticeScreen.tsx` | 수정 | 설정 상태 관리 + 설정 버튼 + PracticeSettingsSheet 연동 |
| `src/navigation/MainStack.tsx` | 수정 | NotationPractice params에 설정값 추가 |
| `src/screens/NotationPracticeScreen.tsx` | 수정 | 전달받은 설정값을 generatePracticeScore에 반영 |

---

## 데이터 흐름

```
CategoryPracticeScreen (설정 상태: timeSignature, keySignature, tempo)
    ↓ navigation.navigate('NotationPractice', { category, difficulty, practiceSettings })
NotationPracticeScreen
    ↓ generatePracticeScore(category, difficulty, practiceSettings)
    ↓ generateScore({ keySignature: settings.key, timeSignature: settings.time, ... })
AbcjsRenderer (tempo도 ABC 헤더에 반영)
```

---

## 설정 옵션 정의

**박자:** `'4/4' | '3/4' | '2/4' | '6/8' | '9/8'`

**조성 (30개):**

| 그룹 | 조성 목록 |
|------|-----------|
| 올림표 장조 | C, G, D, A, E, B, F#, C# |
| 올림표 단조 | Am, Em, Bm, F#m, C#m, G#m, D#m, A#m |
| 내림표 장조 | F, Bb, Eb, Ab, Db, Gb, Cb |
| 내림표 단조 | Dm, Gm, Cm, Fm, Bbm, Ebm, Abm |

**빠르기:** 60, 70, 80, 90, 100, 110, 120 (10 단위)

**기본값:** 박자 `4/4`, 조성 `C`, 빠르기 `80`

---

## 난이도 ↔ 설정 연동 방식

현재 난이도(부분연습 1~9단계)는 C장조/4/4박자 고정이다. 사용자가 설정을 변경하면:

1. **조성 변경 시**: 해당 조성으로 악보 생성 (기존 'C' 대신 사용자 선택 조성)
2. **박자 변경 시**: 해당 박자로 악보 생성 (기존 '4/4' 대신 사용자 선택 박자)
3. **빠르기 변경 시**: ABC 헤더의 Q: 필드에 반영하여 재생 속도 변경

난이도 라벨에 현재 설정을 서브텍스트로 표시한다:
- 예: `"2분/4분 기본"` → `"2분/4분 기본 · G장조 · 3/4 · ♩=100"`
- 기본값(C, 4/4, 80)과 다른 항목만 표시

---

### Task 1: PracticeSettings 타입 정의 및 navigation params 수정

**Files:**
- Modify: `src/navigation/MainStack.tsx:33`

- [ ] **Step 1: MainStack.tsx에 PracticeSettings 타입 추가 및 params 확장**

```typescript
// MainStack.tsx의 import 아래에 추가
export interface PracticeSettings {
  timeSignature: string;
  keySignature: string;
  tempo: number;
}

// MainStackParamList 수정
NotationPractice: {
  category: ContentCategory;
  difficulty: ContentDifficulty;
  practiceSettings?: PracticeSettings;
};
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 타입 에러 없음 (practiceSettings는 optional이므로 기존 코드 호환)

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MainStack.tsx
git commit -m "feat: PracticeSettings 타입 정의 및 NotationPractice params 확장"
```

---

### Task 2: PracticeSettingsSheet 컴포넌트 생성

**Files:**
- Create: `src/components/PracticeSettingsSheet.tsx`

- [ ] **Step 1: PracticeSettingsSheet 컴포넌트 작성**

기존 `SettingsSheet.tsx`(ScoreEditor) 패턴을 참고하여 박자/조성/빠르기 설정 UI를 구현한다.

```typescript
// src/components/PracticeSettingsSheet.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import BottomSheet from './BottomSheet';
import { COLORS } from '../theme/colors';
import type { PracticeSettings } from '../navigation/MainStack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── 옵션 정의 ──
const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8'];

const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

const TEMPOS = [60, 70, 80, 90, 100, 110, 120];

const KEY_DISPLAY: Record<string, string> = {
  C: 'C', G: 'G', D: 'D', A: 'A', E: 'E', B: 'B', 'F#': 'F#', 'C#': 'C#',
  F: 'F', Bb: 'B♭', Eb: 'E♭', Ab: 'A♭', Db: 'D♭', Gb: 'G♭', Cb: 'C♭',
  Am: 'Am', Em: 'Em', Bm: 'Bm', 'F#m': 'F#m', 'C#m': 'C#m', 'G#m': 'G#m', 'D#m': 'D#m', 'A#m': 'A#m',
  Dm: 'Dm', Gm: 'Gm', Cm: 'Cm', Fm: 'Fm', Bbm: 'B♭m', Ebm: 'E♭m', Abm: 'A♭m',
};

// 조표 개수 표시
const KEY_ACCIDENTAL: Record<string, string> = {
  C: '', G: '#1', D: '#2', A: '#3', E: '#4', B: '#5', 'F#': '#6', 'C#': '#7',
  F: '♭1', Bb: '♭2', Eb: '♭3', Ab: '♭4', Db: '♭5', Gb: '♭6', Cb: '♭7',
  Am: '', Em: '#1', Bm: '#2', 'F#m': '#3', 'C#m': '#4', 'G#m': '#5', 'D#m': '#6', 'A#m': '#7',
  Dm: '♭1', Gm: '♭2', Cm: '♭3', Fm: '♭4', Bbm: '♭5', Ebm: '♭6', Abm: '♭7',
};

interface PracticeSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: PracticeSettings;
  onChangeSettings: (settings: PracticeSettings) => void;
  accentColor: string;    // 카테고리 메인 색상
  accentBg: string;       // 카테고리 배경 색상
}

export default function PracticeSettingsSheet({
  open, onClose, settings, onChangeSettings, accentColor, accentBg,
}: PracticeSettingsSheetProps) {
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>(
    settings.keySignature.includes('m') ? 'minor' : 'major'
  );

  const update = (patch: Partial<PracticeSettings>) => {
    onChangeSettings({ ...settings, ...patch });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="연습 설정">
      {/* 박자 */}
      <View style={styles.group}>
        <Text style={styles.label}>박자</Text>
        <View style={styles.chipRow}>
          {TIME_SIGNATURES.map(t => {
            const active = settings.timeSignature === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => update({ timeSignature: t })}
                style={[
                  styles.chip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 조성 */}
      <View style={styles.group}>
        <Text style={styles.label}>조성</Text>
        {/* 장조/단조 탭 */}
        <View style={styles.keyModeTabRow}>
          <TouchableOpacity
            onPress={() => setKeyMode('major')}
            style={[styles.keyModeTab, keyMode === 'major' && styles.keyModeTabActive]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'major' && styles.keyModeTabTextActive]}>
              장조 (Major)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setKeyMode('minor')}
            style={[styles.keyModeTab, keyMode === 'minor' && styles.keyModeTabActive]}
          >
            <Text style={[styles.keyModeTabText, keyMode === 'minor' && styles.keyModeTabTextActive]}>
              단조 (Minor)
            </Text>
          </TouchableOpacity>
        </View>
        {/* 조성 그리드 */}
        <View style={styles.keyGrid}>
          {(keyMode === 'major' ? MAJOR_KEYS : MINOR_KEYS).map(k => {
            const active = settings.keySignature === k;
            const acc = KEY_ACCIDENTAL[k] ?? '';
            return (
              <TouchableOpacity
                key={k}
                onPress={() => update({ keySignature: k })}
                style={[
                  styles.keyChip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.keyChipMain, active && { color: '#fff' }]}>
                  {KEY_DISPLAY[k] ?? k}
                </Text>
                {acc ? (
                  <Text style={[styles.keyChipSub, active && { color: '#c7d2fe' }]}>{acc}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 빠르기 */}
      <View style={styles.group}>
        <Text style={styles.label}>빠르기 (BPM)</Text>
        <View style={styles.chipRow}>
          {TEMPOS.map(bpm => {
            const active = settings.tempo === bpm;
            return (
              <TouchableOpacity
                key={bpm}
                onPress={() => update({ tempo: bpm })}
                style={[
                  styles.chip,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>
                  {bpm}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 10 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '700', color: '#475569' },

  keyModeTabRow: {
    flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8,
    padding: 2, marginBottom: 8,
  },
  keyModeTab: {
    flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
  },
  keyModeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  keyModeTabText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  keyModeTabTextActive: { color: '#1e293b' },

  keyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  keyChip: {
    width: (SCREEN_WIDTH - 32 - 5 * 4) / 5,
    paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  keyChipMain: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  keyChipSub: { fontSize: 8, color: '#94a3b8', marginTop: 0 },
});
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 타입 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/components/PracticeSettingsSheet.tsx
git commit -m "feat: PracticeSettingsSheet 컴포넌트 생성 (박자/조성/빠르기)"
```

---

### Task 3: CategoryPracticeScreen에 설정 상태 및 설정 버튼 추가

**Files:**
- Modify: `src/screens/CategoryPracticeScreen.tsx`

- [ ] **Step 1: import 및 설정 상태 추가**

CategoryPracticeScreen 상단에 PracticeSettingsSheet import를 추가하고, melody/twoVoice 카테고리일 때만 설정 상태와 시트 열기/닫기 상태를 관리한다.

```typescript
// import 추가
import { Settings2 } from 'lucide-react-native';
import PracticeSettingsSheet from '../components/PracticeSettingsSheet';
import type { PracticeSettings } from '../navigation/MainStack';

// 컴포넌트 안에 상태 추가 (selectedDiff 아래)
const showSettings = category === 'melody' || category === 'twoVoice';
const [settingsOpen, setSettingsOpen] = useState(false);
const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
  timeSignature: '4/4',
  keySignature: 'C',
  tempo: 80,
});
```

- [ ] **Step 2: 설정 버튼 UI 추가**

난이도 선택 섹션 타이틀 옆에 설정 아이콘 버튼을 추가한다. `showSettings`가 true일 때만 렌더링한다.

```typescript
{/* 난이도 선택 헤더 — 기존 <Text style={styles.sectionTitle}>난이도 선택</Text> 를 교체 */}
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>난이도 선택</Text>
  {showSettings && (
    <TouchableOpacity
      onPress={() => setSettingsOpen(true)}
      style={[styles.settingsBtn, { backgroundColor: colors.bg }]}
      hitSlop={8}
    >
      <Settings2 size={16} color={colors.main} />
      <Text style={[styles.settingsBtnText, { color: colors.main }]}>설정</Text>
    </TouchableOpacity>
  )}
</View>
```

- [ ] **Step 3: 현재 설정 요약 표시**

설정 버튼 아래에 현재 설정이 기본값과 다를 때 요약을 표시한다.

```typescript
{/* 설정 요약 — showSettings이고 기본값이 아닐 때 */}
{showSettings && (
  practiceSettings.timeSignature !== '4/4' ||
  practiceSettings.keySignature !== 'C' ||
  practiceSettings.tempo !== 80
) && (
  <View style={[styles.settingsSummary, { backgroundColor: colors.bg, borderColor: colors.main + '30' }]}>
    <Text style={[styles.settingsSummaryText, { color: colors.main }]}>
      {[
        practiceSettings.timeSignature !== '4/4' && practiceSettings.timeSignature,
        practiceSettings.keySignature !== 'C' && practiceSettings.keySignature,
        practiceSettings.tempo !== 80 && `♩=${practiceSettings.tempo}`,
      ].filter(Boolean).join(' · ')}
    </Text>
  </View>
)}
```

- [ ] **Step 4: handleStart에 설정값 전달**

handleStart 함수에서 navigation params에 practiceSettings를 추가한다.

```typescript
// 기존 handleStart에서 melody/twoVoice 분기 수정
if (category === 'melody' || category === 'twoVoice' || category === 'rhythm') {
  navigation.navigate('NotationPractice', {
    category,
    difficulty: selectedDiff,
    ...(showSettings && { practiceSettings }),
  });
}
```

- [ ] **Step 5: PracticeSettingsSheet 렌더링 추가**

return JSX 맨 아래(SafeAreaView 닫기 직전)에 추가한다.

```typescript
{showSettings && (
  <PracticeSettingsSheet
    open={settingsOpen}
    onClose={() => setSettingsOpen(false)}
    settings={practiceSettings}
    onChangeSettings={setPracticeSettings}
    accentColor={colors.main}
    accentBg={colors.bg}
  />
)}
```

- [ ] **Step 6: 스타일 추가**

```typescript
// StyleSheet에 추가
sectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
settingsBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
},
settingsBtnText: {
  fontSize: 12,
  fontWeight: '700',
},
settingsSummary: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 10,
  borderWidth: 1,
},
settingsSummaryText: {
  fontSize: 12,
  fontWeight: '600',
},
```

- [ ] **Step 7: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 타입 에러 없음

- [ ] **Step 8: Commit**

```bash
git add src/screens/CategoryPracticeScreen.tsx
git commit -m "feat: CategoryPracticeScreen에 연습 설정 버튼 및 시트 연동"
```

---

### Task 4: NotationPracticeScreen에서 설정값을 악보 생성에 반영

**Files:**
- Modify: `src/screens/NotationPracticeScreen.tsx:61-155, 354-377`

- [ ] **Step 1: PracticeSettings import 및 params 수신**

```typescript
// import 추가
import type { PracticeSettings } from '../navigation/MainStack';

// route.params에서 설정값 추출 (line 288 부근)
const { category, difficulty, practiceSettings } = route.params;
```

- [ ] **Step 2: generatePracticeScore 함수 시그니처 수정**

세 번째 파라미터로 `practiceSettings`를 받아서 악보 생성에 반영한다.

```typescript
function generatePracticeScore(
  category: ContentCategory,
  difficulty: ContentDifficulty,
  practiceSettings?: PracticeSettings,
): PracticeScore {
  if (category === 'melody') {
    const level = melodyDifficultyToLevel(difficulty);
    const trackOpts = buildGeneratorOptions('partPractice', level);

    // 사용자 설정으로 오버라이드
    const keySignature = practiceSettings?.keySignature ?? trackOpts.keySignature;
    const timeSignature = practiceSettings?.timeSignature ?? trackOpts.timeSignature;

    const result = generateScore({
      keySignature,
      timeSignature,
      difficulty: trackOpts.difficulty,
      measures: trackOpts.measures,
      useGrandStaff: false,
      practiceMode: 'part',
      partPracticeLevel: level,
    });
    return {
      trebleNotes: result.trebleNotes,
      bassNotes: [],
      keySignature,
      timeSignature,
      useGrandStaff: false,
      barsPerStaff: level <= 2 ? 4 : level >= 4 ? 2 : undefined,
      disableTies: level <= 5,
    };
  }

  if (category === 'rhythm') {
    // rhythm은 설정 없이 기존 로직 유지 (rhythm 카테고리에서는 설정 미노출)
    const level = rhythmDifficultyToLevel(difficulty);
    const trackOpts = buildGeneratorOptions('partPractice', level);
    const result = generateScore({
      keySignature: 'C',
      timeSignature: trackOpts.timeSignature,
      difficulty: trackOpts.difficulty,
      measures: 4,
      useGrandStaff: false,
      practiceMode: 'part',
      partPracticeLevel: level,
    });
    const rhythmNotes: ScoreNote[] = result.trebleNotes.map(n =>
      n.pitch === 'rest'
        ? n
        : { ...n, pitch: 'B' as PitchName, octave: 4, accidental: '' as Accidental }
    );
    return {
      trebleNotes: rhythmNotes,
      bassNotes: [],
      keySignature: 'C',
      timeSignature: trackOpts.timeSignature,
      useGrandStaff: false,
      barsPerStaff: 4,
      disableTies: level < 5,
    };
  }

  // twoVoice — 사용자 설정 반영
  const diffMap: Record<string, Difficulty> = {
    bass_1: 'beginner_3', bass_2: 'intermediate_1',
    bass_3: 'intermediate_3', bass_4: 'advanced_1',
  };
  const bassDiffMap: Record<string, BassDifficulty> = {
    bass_1: 'bass_1', bass_2: 'bass_2', bass_3: 'bass_3', bass_4: 'bass_4',
  };

  const keySignature = practiceSettings?.keySignature ?? 'C';
  const timeSignature = practiceSettings?.timeSignature ?? '4/4';

  const result = generateScore({
    keySignature,
    timeSignature,
    difficulty: diffMap[difficulty] ?? 'beginner_3',
    bassDifficulty: bassDiffMap[difficulty] ?? 'bass_1',
    measures: 4,
    useGrandStaff: true,
  });
  return {
    trebleNotes: result.trebleNotes,
    bassNotes: result.bassNotes,
    keySignature,
    timeSignature,
    useGrandStaff: true,
    barsPerStaff: 2,
  };
}
```

- [ ] **Step 3: generate() 콜백에서 practiceSettings 전달**

```typescript
// generate useCallback 수정 (line 354 부근)
const generate = useCallback(() => {
  setIsGenerating(true);
  setHideNotes(true);
  setSelfRating(0);
  setRated(false);
  setIsPlaying(false);
  setUserInput([]);
  setSubmitted(false);
  setRhythmResults([]);
  setCorrectCounts([]);
  setMelodySubmitted(false);
  setGradingResult(null);
  noteInput.selectNote(null);

  setTimeout(() => {
    const newScore = generatePracticeScore(category, difficulty, practiceSettings);
    setScore(newScore);
    if (category === 'melody' || category === 'twoVoice') {
      const first = newScore.trebleNotes[0] ?? null;
      noteInput.reset(first ? { ...first, tie: false } : null);
    }
    setIsGenerating(false);
  }, 500);
}, [category, difficulty, practiceSettings]);
```

- [ ] **Step 4: 빠르기(tempo)를 ABC 헤더에 반영**

ABC 생성 시 tempo를 전달해야 한다. NotationPracticeScreen에서 generateAbc 호출 부분을 확인하고, practiceSettings?.tempo를 전달한다.

이 부분은 generateAbc 함수의 기존 tempo 파라미터 또는 ABC 문자열의 Q: 필드를 확인하여 반영한다. 현재 generateAbc에 tempo 옵션이 있다면 그대로 사용하고, 없다면 ABC 문자열에 `Q:1/4=${tempo}` 를 삽입한다.

```typescript
// ABC 생성 시 tempo 반영 — generateAbc 호출부에서
// 기존: generateAbc(score.trebleNotes, ...)
// score가 사용되는 곳에서 practiceSettings?.tempo를 활용
```

> **Note:** 이 부분은 generateAbc의 현재 시그니처에 따라 구현 방식이 달라진다. 구현 시 `generateAbc` 함수를 확인하여 tempo 파라미터가 있으면 활용하고, 없으면 반환된 ABC 문자열의 첫 줄에 `Q:1/4=${tempo}\n`를 삽입하는 방식으로 처리한다.

- [ ] **Step 5: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 타입 에러 없음

- [ ] **Step 6: Commit**

```bash
git add src/screens/NotationPracticeScreen.tsx
git commit -m "feat: NotationPracticeScreen에서 사용자 설정(박자/조성/빠르기) 반영"
```

---

### Task 5: 난이도 라벨에 설정 요약 표시

**Files:**
- Modify: `src/screens/CategoryPracticeScreen.tsx`

- [ ] **Step 1: 난이도 항목에 설정 요약 서브텍스트 추가**

난이도 목록의 각 항목(diffItem) 라벨 아래에, 현재 설정이 기본값과 다를 때 서브텍스트를 표시한다.

```typescript
// diffItem 안의 diffLabel Text 컴포넌트 아래에 추가
{showSettings && (
  practiceSettings.timeSignature !== '4/4' ||
  practiceSettings.keySignature !== 'C' ||
  practiceSettings.tempo !== 80
) && (
  <Text style={styles.diffSettingsHint} numberOfLines={1}>
    {[
      practiceSettings.keySignature !== 'C' && practiceSettings.keySignature,
      practiceSettings.timeSignature !== '4/4' && practiceSettings.timeSignature,
      practiceSettings.tempo !== 80 && `♩=${practiceSettings.tempo}`,
    ].filter(Boolean).join(' · ')}
  </Text>
)}
```

```typescript
// 스타일 추가
diffSettingsHint: {
  fontSize: 10,
  color: COLORS.slate400,
  marginTop: 2,
},
```

> **설계 의도:** 난이도 자체는 기존 9단계 그대로 유지하되, 설정이 적용된 상태임을 시각적으로 인지할 수 있도록 한다. 동일 난이도라도 조성/박자 변경으로 실질적 체감 난이도가 달라지므로, 사용자에게 현재 적용 설정을 상기시킨다.

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/screens/CategoryPracticeScreen.tsx
git commit -m "feat: 난이도 항목에 현재 설정 요약 서브텍스트 표시"
```

---

### Task 6: PROJECT_INDEX.md 업데이트

**Files:**
- Modify: `PROJECT_INDEX.md`

- [ ] **Step 1: 컴포넌트 섹션에 PracticeSettingsSheet 추가**

PROJECT_INDEX.md의 컴포넌트 목록에 새로 생성한 `PracticeSettingsSheet.tsx`를 추가한다.

- [ ] **Step 2: Commit**

```bash
git add PROJECT_INDEX.md
git commit -m "docs: PROJECT_INDEX에 PracticeSettingsSheet 추가"
```

---

## 구현 순서 요약

1. **Task 1:** PracticeSettings 타입 + navigation params 확장
2. **Task 2:** PracticeSettingsSheet UI 컴포넌트 생성
3. **Task 3:** CategoryPracticeScreen에 설정 버튼/시트/상태 연동
4. **Task 4:** NotationPracticeScreen에서 설정값 → 악보 생성 반영
5. **Task 5:** 난이도 라벨에 설정 요약 서브텍스트
6. **Task 6:** PROJECT_INDEX.md 업데이트

## 고려사항

- **rhythm 카테고리**는 설정 미노출 (리듬 훈련은 조성/빠르기가 무의미)
- **melody, twoVoice** 카테고리만 설정 버튼 표시
- **기본값**(C, 4/4, 80)은 기존 동작과 100% 동일하므로 하위 호환성 보장
- **빠르기**는 재생 속도에만 영향 (악보 내용 자체는 변하지 않음)
- **조성 변경 시** generateScore 내부의 조성 처리 로직이 이미 임의 조성을 지원하므로 (종합연습에서 사용 중) 추가 작업 불필요
