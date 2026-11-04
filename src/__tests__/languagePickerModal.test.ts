import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import LanguagePickerModal from '../components/LanguagePickerModal';

jest.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFillObject: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', changeLanguage: mockChangeLanguage },
  }),
}));
jest.mock('../context/AlertContext', () => ({
  useAlert: () => ({ showAlert: mockShowAlert }),
}));

const mockChangeLanguage = jest.fn();
const mockClose = jest.fn();
const mockShowAlert = jest.fn();
let renderer: ReactTestRenderer;

function option(language: string) {
  return renderer.root.findByProps({
    accessibilityRole: 'radio',
    accessibilityLabel: `profile:language.${language}`,
  });
}

function button(label: string) {
  return renderer.root
    .findAllByType('Pressable' as React.ElementType)
    .find((node) =>
      node.findAllByType('Text' as React.ElementType).some((text) => text.props.children === label),
    )!;
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockChangeLanguage.mockResolvedValue(undefined);
  await act(async () => {
    renderer = create(React.createElement(LanguagePickerModal, { onClose: mockClose }));
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('현재 언어를 선택한 상태로 열고 언어를 바로 변경하지 않는다', () => {
  expect(option('ko').props.accessibilityState.checked).toBe(true);
  expect(option('en').props.accessibilityState.checked).toBe(false);
  expect(option('ja').props.accessibilityState.checked).toBe(false);
  expect(mockChangeLanguage).not.toHaveBeenCalled();
});

it('언어를 선택하는 동안은 보류하고 적용 버튼을 눌러야 변경한다', async () => {
  await act(async () => option('ja').props.onPress());
  expect(option('ja').props.accessibilityState.checked).toBe(true);
  expect(mockChangeLanguage).not.toHaveBeenCalled();
  await act(async () => button('profile:language.apply').props.onPress());
  expect(mockChangeLanguage).toHaveBeenCalledWith('ja');
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it('취소하거나 Android 뒤로가기로 닫으면 언어를 변경하지 않는다', async () => {
  await act(async () => option('en').props.onPress());
  await act(async () => button('common:button.cancel').props.onPress());
  await act(async () =>
    renderer.root.findByType('Modal' as React.ElementType).props.onRequestClose(),
  );
  expect(mockChangeLanguage).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(2);
});

it('변경 실패 시 창을 유지하고 재시도할 수 있다', async () => {
  mockChangeLanguage.mockRejectedValueOnce(new Error('변경 실패'));
  await act(async () => button('profile:language.apply').props.onPress());
  expect(mockClose).not.toHaveBeenCalled();
  expect(mockShowAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  expect(button('profile:language.apply').props.disabled).toBe(false);
});

it('적용 버튼을 빠르게 연속 눌러도 한 번만 변경한다', async () => {
  let complete!: () => void;
  mockChangeLanguage.mockReturnValue(new Promise<void>((resolve) => (complete = resolve)));
  await act(async () => {
    const apply = button('profile:language.apply').props.onPress;
    void apply();
    void apply();
  });
  expect(mockChangeLanguage).toHaveBeenCalledTimes(1);
  await act(async () => complete());
  expect(mockClose).toHaveBeenCalledTimes(1);
});
