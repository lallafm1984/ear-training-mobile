import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import NotationPracticeScreen from '../screens/NotationPracticeScreen';
import { generatePracticeScore, type PracticeScore } from '../lib/practiceScoreGenerator';
import { examNotationStore } from '../lib/examNotationStore';
import type { MainStackParamList } from '../navigation/MainStack';

// 네이티브 표시/계정 경계만 대체하고 화면의 effect, 입력 훅, 악보 변환은 실제 코드로 실행한다.
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  Volume2: 'Volume2',
  VolumeX: 'VolumeX',
  Eye: 'Eye',
  EyeOff: 'EyeOff',
  RotateCcw: 'RotateCcw',
  ChevronRight: 'ChevronRight',
  Music: 'Music',
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof React>('react');
    useEffect(effect, [effect]);
  },
}));
jest.mock('../lib', () => jest.requireActual('../lib/scoreUtils'));
jest.mock('../lib/practiceScoreGenerator', () => ({ generatePracticeScore: jest.fn() }));
jest.mock('../hooks/usePracticeHistory', () => ({
  usePracticeHistory: () => ({ addRecord: mockAddRecord }),
}));
jest.mock('../hooks/useSkillProfile', () => ({
  useSkillProfile: () => ({ applyEvaluation: mockApplyEvaluation, updateStreak: mockUpdateStreak }),
}));
jest.mock('../context', () => ({
  useAlert: () => ({ showAlert: mockShowAlert }),
  useSessionContentLog: () => ({ trackContentRun: mockTrackContentRun }),
}));
jest.mock('../components/AbcjsRenderer', () => 'AbcjsRenderer');
jest.mock('../components/PianoKeyboard', () => 'PianoKeyboard');
jest.mock('../components/DurationToolbar', () => 'DurationToolbar');
jest.mock('../components/BarMelodyStaffInput', () => 'BarMelodyStaffInput');
jest.mock('../components/GradingResult', () => 'GradingResult');

let mockParams: MainStackParamList['NotationPractice'];
const mockNavigation = { goBack: jest.fn() };
const mockTrackContentRun = jest.fn();
const mockAddRecord = jest.fn().mockResolvedValue(undefined);
const mockApplyEvaluation = jest.fn().mockResolvedValue(undefined);
const mockUpdateStreak = jest.fn().mockResolvedValue(undefined);
const mockShowAlert = jest.fn();
const mockGenerateScore = jest.mocked(generatePracticeScore);
let renderer: ReactTestRenderer | undefined;
const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function makeScore(useGrandStaff = false, timeSignature = '4/4'): PracticeScore {
  const beats = timeSignature === '3/4' ? 3 : 4;
  return {
    // 실제 생성기처럼 호출할 때마다 새로운 첫 음 객체를 반환한다.
    trebleNotes: Array.from({ length: beats * 4 }, (_, index) => ({
      id: `treble-${index}`,
      pitch: index % 2 === 0 ? 'C' : 'D',
      octave: 4,
      duration: '4',
      accidental: '',
    })),
    bassNotes: useGrandStaff
      ? Array.from({ length: beats * 4 }, (_, index) => ({
          id: `bass-${index}`,
          pitch: 'C',
          octave: 3,
          duration: '4',
          accidental: '',
        }))
      : [],
    keySignature: 'C',
    timeSignature,
    useGrandStaff,
  };
}

async function mount(strict = false) {
  await act(async () => {
    const screen = React.createElement(NotationPracticeScreen);
    renderer = create(strict ? React.createElement(React.StrictMode, null, screen) : screen);
  });
}

async function advanceGeneration() {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}

function findHosts(type: string) {
  return renderer!.root.findAll((node) => node.type === type);
}

function buttonWithLabel(label: string) {
  return findHosts('TouchableOpacity').find(
    (node) =>
      node.findAll((child) => String(child.type) === 'Text' && child.props.children === label)
        .length > 0,
  )!;
}

function answerAbc() {
  return findHosts('AbcjsRenderer').find((node) => node.props.selectedNote)?.props.abcString;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  mockParams = {
    category: 'melody',
    difficulty: 'beginner_1',
    practiceSettings: { timeSignature: '4/4', keySignature: 'C', tempo: 80 },
  };
  mockGenerateScore.mockImplementation((category, _difficulty, settings) =>
    makeScore(category === 'twoVoice', settings?.timeSignature),
  );
  examNotationStore.clear();
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete actGlobal.IS_REACT_ACT_ENVIRONMENT;
});

test.each([
  ['melody', 'beginner_1'],
  ['twoVoice', 'bass_1'],
  ['rhythm', 'rhythm_1'],
  ['barMelody', 'bar_1'],
] as const)(
  '%s 화면은 첫 문제 생성 후 대기해도 로딩으로 돌아가지 않는다',
  async (category, difficulty) => {
    mockParams.category = category;
    mockParams.difficulty = difficulty;
    mockGenerateScore.mockImplementation(
      jest.requireActual<typeof import('../lib/practiceScoreGenerator')>(
        '../lib/practiceScoreGenerator',
      ).generatePracticeScore,
    );
    await mount();
    expect(findHosts('ActivityIndicator')).toHaveLength(1);

    // 각 타이머 뒤 React 갱신을 완료해야 500ms마다 재발하던 생성 루프를 잡을 수 있다.
    for (let index = 0; index < 8; index++) await advanceGeneration();

    expect(mockGenerateScore).toHaveBeenCalledTimes(1);
    expect(mockTrackContentRun).toHaveBeenCalledTimes(1);
    expect(findHosts('ActivityIndicator')).toHaveLength(0);
  },
);

test.each(['melody', 'twoVoice'] as const)(
  '%s 입력과 재생 상태 변경 후 답안을 유지하고, 제출 후 다음 문제만 새로 생성한다',
  async (category) => {
    mockParams.category = category;
    await mount();
    await advanceGeneration();
    expect(findHosts('ActivityIndicator')).toHaveLength(0);
    const initialAnswer = answerAbc();

    await act(async () => findHosts('PianoKeyboard')[0].props.onKeyPress('E', 4, ''));
    if (category === 'twoVoice') {
      expect(buttonWithLabel('practice:notation.submit').props.disabled).toBe(true);
      await act(async () => buttonWithLabel('practice:notation.bass').props.onPress());
      await act(async () => findHosts('PianoKeyboard')[0].props.onKeyPress('G', 3, ''));
    }
    const editedAnswer = answerAbc();
    expect(editedAnswer).not.toBe(initialAnswer);
    await act(async () => {
      findHosts('AbcjsRenderer')
        .find((node) => node.props.prependMetronome)!
        .props.onPlayStateChange(false);
      renderer!.update(React.createElement(NotationPracticeScreen));
    });
    for (let index = 0; index < 4; index++) await advanceGeneration();
    expect(answerAbc()).toBe(editedAnswer);
    expect(mockGenerateScore).toHaveBeenCalledTimes(1);

    await act(async () => buttonWithLabel('practice:notation.submit').props.onPress());
    await act(async () => mockShowAlert.mock.calls[0][0].buttons[1].onPress());
    expect(findHosts('GradingResult')).toHaveLength(1);
    expect(mockAddRecord).toHaveBeenCalledTimes(1);
    await act(async () => buttonWithLabel('practice:choice.nextQuestion').props.onPress());
    for (let index = 0; index < 4; index++) await advanceGeneration();
    expect(mockGenerateScore).toHaveBeenCalledTimes(2);
    expect(mockTrackContentRun).toHaveBeenCalledTimes(2);
    expect(findHosts('ActivityIndicator')).toHaveLength(0);
    expect(answerAbc()).toBe(initialAnswer);
  },
);

test('모의시험은 저장된 악보를 한 번만 불러오며 연습 문제를 생성하지 않는다', async () => {
  mockParams.examMode = true;
  examNotationStore.setScore(makeScore(), 0);
  const getScore = jest.spyOn(examNotationStore, 'getScore');
  await mount();
  for (let index = 0; index < 5; index++) await advanceGeneration();
  expect(getScore).toHaveBeenCalledTimes(1);
  expect(mockGenerateScore).not.toHaveBeenCalled();
  expect(mockTrackContentRun).not.toHaveBeenCalled();
  expect(findHosts('ActivityIndicator')).toHaveLength(0);
});

test('생성 대기 중 화면을 닫으면 악보 생성과 실행 집계를 취소한다', async () => {
  await mount();
  await act(async () => renderer!.unmount());
  renderer = undefined;
  await advanceGeneration();
  expect(mockGenerateScore).not.toHaveBeenCalled();
  expect(mockTrackContentRun).not.toHaveBeenCalled();
});

test('생성 대기 중 박자가 바뀌면 이전 요청을 취소하고 새 설정으로 한 번만 생성한다', async () => {
  await mount();
  mockParams = {
    ...mockParams,
    practiceSettings: { timeSignature: '3/4', keySignature: 'C', tempo: 100 },
  };
  await act(async () => renderer!.update(React.createElement(NotationPracticeScreen)));
  for (let index = 0; index < 4; index++) await advanceGeneration();
  expect(mockGenerateScore).toHaveBeenCalledTimes(1);
  expect(mockGenerateScore).toHaveBeenLastCalledWith(
    'melody',
    'beginner_1',
    mockParams.practiceSettings,
  );
  expect(answerAbc()).toContain('M: 3/4');
  expect(answerAbc()).toContain('Q: 1/4=100');
});

test('StrictMode의 초기 effect 재실행에도 문제와 집계가 중복되지 않는다', async () => {
  await mount(true);
  for (let index = 0; index < 4; index++) await advanceGeneration();
  expect(mockGenerateScore).toHaveBeenCalledTimes(1);
  expect(mockTrackContentRun).toHaveBeenCalledTimes(1);
  expect(findHosts('ActivityIndicator')).toHaveLength(0);
});
