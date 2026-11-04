import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import RhythmTapScreen from '../screens/RhythmTapScreen';
import type { ClickTrackOptions, ClickTrackState } from '../components/AbcjsRenderer';
import { beatMsFor } from '../lib/rhythmTap';
import type { RhythmTapDifficulty } from '../types/content';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
      interpolate() {
        return 'color';
      }
    },
    spring: jest.fn(),
    timing: jest.fn(),
    parallel: () => ({ start: jest.fn() }),
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  Play: 'Play',
  Square: 'Square',
  Hand: 'Hand',
  RotateCcw: 'RotateCcw',
  ChevronRight: 'ChevronRight',
  Volume2: 'Volume2',
  Share2: 'Share2',
  Check: 'Check',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ko' } }),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { difficulty: mockDifficulty } }),
  useNavigation: () => mockNavigation,
}));
jest.mock('../context', () => ({
  useAlert: () => ({ showAlert: mockShowAlert }),
  useSessionContentLog: () => ({ trackContentRun: mockTrackContentRun }),
}));
jest.mock('../hooks/usePracticeHistory', () => ({
  usePracticeHistory: () => ({ addRecord: jest.fn() }),
}));
jest.mock('../hooks/useSkillProfile', () => ({
  useSkillProfile: () => ({ applyEvaluation: jest.fn(), updateStreak: jest.fn() }),
}));
jest.mock('../hooks/useMascotExp', () => ({ useMascotExp: () => ({ level: 1 }) }));
jest.mock('../components/ShareCardModal', () => 'ShareCardModal');
jest.mock('../components/AbcjsRenderer', () => {
  const ReactActual = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: object, ref) => {
      ReactActual.useImperativeHandle(ref, () => mockAudio);
      return ReactActual.createElement('AbcjsRenderer', props);
    }),
  };
});

let mockDifficulty: RhythmTapDifficulty;
const mockNavigation = { goBack: jest.fn() };
const mockShowAlert = jest.fn();
const mockTrackContentRun = jest.fn();
const mockAudio = {
  togglePlay: jest.fn(),
  stopPlay: jest.fn(),
  playClickTrack: jest.fn<void, [ClickTrackOptions]>(),
  stopClickTrack: jest.fn(),
};
let renderer: ReactTestRenderer;

function button(label: string) {
  return renderer.root
    .findAllByType('TouchableOpacity' as React.ElementType)
    .find((node) =>
      node.findAllByType('Text' as React.ElementType).some((text) => text.props.children === label),
    )!;
}

function clickTrackState(state: ClickTrackState) {
  renderer.root.findByType('AbcjsRenderer' as React.ElementType).props.onClickTrackState(state);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-04T06:00:00Z'));
  jest.clearAllMocks();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each([
  ['tap_1', 4, 4],
  ['tap_5', 3, 4],
  ['tap_6', 6, 8],
] as const)('%s: 4/4·3/4·6/8의 실제 클릭 간격과 채점 시계가 같다', async (difficulty, top, btm) => {
  mockDifficulty = difficulty;
  await act(async () => {
    renderer = create(React.createElement(RhythmTapScreen));
  });
  await act(async () => button('rhythmTap:listen.start').props.onPress());
  const options = mockAudio.playClickTrack.mock.calls[0][0];
  expect(options.top).toBe(top);
  expect(options.btm).toBe(btm);
  expect((60000 / options.tempo) * (4 / options.btm!)).toBe(
    beatMsFor(options.tempo, `${top}/${btm}`),
  );

  const beatMs = beatMsFor(options.tempo, `${top}/${btm}`);
  await act(async () => {
    clickTrackState({ isPlaying: true, leadMs: 80, beatMs, beatsPerBar: top, countInBars: 1 });
    jest.advanceTimersByTime(Math.ceil(80 + top * beatMs) + 40);
  });
  const text = renderer.root.findAllByType('Text' as React.ElementType);
  expect(text.some((node) => node.props.children === 'rhythmTap:tap.go')).toBe(true);
  await act(async () => button('rhythmTap:tap.cancel').props.onPress());
  await act(async () => clickTrackState({ isPlaying: false }));
  expect(button('rhythmTap:listen.start')).toBeDefined();
  expect(mockShowAlert).not.toHaveBeenCalled();
});

it('듣기 자동 재생 전에 탭을 시작하면 예약된 정답 재생이 클릭 트랙에 겹치지 않는다', async () => {
  mockDifficulty = 'tap_1';
  await act(async () => {
    renderer = create(React.createElement(RhythmTapScreen));
  });
  await act(async () => button('rhythmTap:listen.start').props.onPress());
  await act(async () => jest.advanceTimersByTime(600));
  expect(mockAudio.togglePlay).not.toHaveBeenCalled();
  expect(mockAudio.playClickTrack).toHaveBeenCalledTimes(1);
});

it.each(['tap_1', 'tap_5', 'tap_6'] as const)(
  '%s: 마지막 박 이후에는 다음 마디의 1을 표시하지 않고 입력 종료를 알린다',
  async (difficulty) => {
    mockDifficulty = difficulty;
    await act(async () => {
      renderer = create(React.createElement(RhythmTapScreen));
    });
    await act(async () => button('rhythmTap:listen.start').props.onPress());
    const options = mockAudio.playClickTrack.mock.calls[0][0];
    const top = options.top!;
    const beatMs = beatMsFor(options.tempo, `${top}/${options.btm}`);
    const totalBeats = top * (1 + options.bars);
    await act(async () => {
      clickTrackState({ isPlaying: true, leadMs: 80, beatMs, beatsPerBar: top, countInBars: 1 });
      jest.advanceTimersByTime(Math.ceil(80 + (totalBeats - 0.5) * beatMs));
    });
    expect(renderer.root.findByProps({ testID: 'rhythm-tap-count' }).props.children).toBe(top);
    await act(async () => jest.advanceTimersByTime(Math.ceil(beatMs / 2) + 80));
    expect(renderer.root.findAllByProps({ testID: 'rhythm-tap-count' })).toHaveLength(0);
    expect(
      renderer.root
        .findAllByType('Text' as React.ElementType)
        .some((node) => node.props.children === 'rhythmTap:tap.done'),
    ).toBe(true);
    // 채점용 여유 시간에도 종료 신호를 유지한다.
    await act(async () => jest.advanceTimersByTime(300));
    expect(renderer.root.findAllByProps({ testID: 'rhythm-tap-count' })).toHaveLength(0);
  },
);
