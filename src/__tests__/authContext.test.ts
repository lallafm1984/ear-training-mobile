import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth, type AuthContextValue } from '../context/AuthContext';
import { allLocalDataKeys } from '../lib/localProfileStorage';

jest.mock('react-native', () => ({
  Linking: {
    addEventListener: () => ({ remove: jest.fn() }),
    getInitialURL: async () => null,
  },
}));
jest.mock('../lib', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      getSession: async () => ({ data: { session: mockSession } }),
      signOut: () => mockSignOut(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  createOAuthCallbackProcessor: () => ({ process: jest.fn() }),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiRemove: (...args: unknown[]) => mockMultiRemove(...args),
}));
jest.mock('../i18n', () => ({ t: (key: string) => key }));
jest.mock('../lib/revenueCat', () => ({ logoutRevenueCat: () => mockLogoutRevenueCat() }));
jest.mock('../lib/logger', () => ({ logger: { warn: jest.fn(), debug: jest.fn() } }));
jest.mock('../context/AlertContext', () => ({
  useAlert: () => ({ showAlert: mockShowAlert }),
}));

const mockShowAlert = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSignOut = jest.fn();
const mockMultiRemove = jest.fn();
const mockLogoutRevenueCat = jest.fn();
let mockSession: { user: { id: string } } | null;
let auth: AuthContextValue;
let renderer: ReactTestRenderer;

function Consumer() {
  auth = useAuth();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockSession = { user: { id: 'existing-user' } };
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'existing-user' } }) }) }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  });
  mockRpc.mockResolvedValue({ error: null });
  mockMultiRemove.mockResolvedValue(undefined);
  mockLogoutRevenueCat.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue({ error: null });
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

async function mount() {
  await act(async () => {
    renderer = create(React.createElement(AuthProvider, null, React.createElement(Consumer)));
  });
  mockFrom.mockClear();
}

it('인증 계정 삭제가 실패하면 기존 프로필·로컬 기록·로그인을 보존하고 오류를 반환한다', async () => {
  await mount();
  mockRpc.mockResolvedValue({ error: { message: '계정 삭제 실패' } });
  expect(await auth.deleteAccount()).toBe('계정 삭제 실패');
  expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockMultiRemove).not.toHaveBeenCalled();
  expect(mockLogoutRevenueCat).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('서버 삭제가 완료된 다음 본인 로컬 데이터와 세션만 정리한다', async () => {
  await mount();
  let completeDeletion!: (value: { error: null }) => void;
  mockRpc.mockReturnValue(new Promise((resolve) => (completeDeletion = resolve)));
  const deletion = auth.deleteAccount();
  expect(mockMultiRemove).not.toHaveBeenCalled();
  completeDeletion({ error: null });
  expect(await deletion).toBeNull();
  expect(mockMultiRemove).toHaveBeenCalledWith([
    ...allLocalDataKeys('existing-user'),
    '@melodygen_onboarding_done',
  ]);
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockLogoutRevenueCat).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('게스트는 서버나 로컬 데이터를 삭제하지 않는다', async () => {
  mockSession = null;
  await mount();
  expect(await auth.deleteAccount()).toBe('common:error.loginRequired');
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockMultiRemove).not.toHaveBeenCalled();
});
