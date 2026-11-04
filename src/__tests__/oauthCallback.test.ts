import {
  createOAuthCallbackProcessor,
  establishSessionFromOAuthCallback,
  parseOAuthCallbackUrl,
} from '../lib/oauthCallback';

describe('parseOAuthCallbackUrl', () => {
  it('PKCE code를 query에서 읽는다', () => {
    expect(parseOAuthCallbackUrl('melodygen:///?code=auth-code')).toEqual({
      type: 'code',
      code: 'auth-code',
    });
  });

  it('implicit flow 토큰을 hash에서 읽는다', () => {
    expect(
      parseOAuthCallbackUrl('melodygen:///#access_token=access-token&refresh_token=refresh-token'),
    ).toEqual({
      type: 'tokens',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('토큰이 query로 전달되어도 읽는다', () => {
    expect(
      parseOAuthCallbackUrl('melodygen:///?access_token=access-token&refresh_token=refresh-token'),
    ).toEqual({
      type: 'tokens',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('OAuth 오류 설명을 디코딩한다', () => {
    expect(
      parseOAuthCallbackUrl('melodygen:///#error=access_denied&error_description=User%20cancelled'),
    ).toEqual({
      type: 'error',
      code: 'access_denied',
      description: 'User cancelled',
    });
  });

  it('인증 정보가 없는 일반 딥링크는 무시한다', () => {
    expect(parseOAuthCallbackUrl('melodygen:///practice')).toEqual({ type: 'none' });
    expect(parseOAuthCallbackUrl('melodygen:///#access_token=partial')).toEqual({ type: 'none' });
  });
});

describe('establishSessionFromOAuthCallback', () => {
  const createClient = () => ({
    exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
    setSession: jest.fn().mockResolvedValue({ error: null }),
  });

  it('PKCE callback을 세션으로 교환한다', async () => {
    const client = createClient();

    await expect(
      establishSessionFromOAuthCallback('melodygen:///?code=auth-code', client),
    ).resolves.toBe(true);

    expect(client.exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
    expect(client.setSession).not.toHaveBeenCalled();
  });

  it('implicit callback 토큰으로 세션을 설정한다', async () => {
    const client = createClient();

    await expect(
      establishSessionFromOAuthCallback(
        'melodygen:///#access_token=access-token&refresh_token=refresh-token',
        client,
      ),
    ).resolves.toBe(true);

    expect(client.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('OAuth callback 오류를 호출자에게 전달한다', async () => {
    const client = createClient();

    await expect(
      establishSessionFromOAuthCallback(
        'melodygen:///#error=server_error&error_description=Sign-in%20failed',
        client,
      ),
    ).rejects.toThrow('Sign-in failed');

    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(client.setSession).not.toHaveBeenCalled();
  });

  it('Supabase 세션 생성 오류를 호출자에게 전달한다', async () => {
    const client = createClient();
    client.setSession.mockResolvedValue({ error: { message: 'Invalid refresh token' } });

    await expect(
      establishSessionFromOAuthCallback(
        'melodygen:///#access_token=access-token&refresh_token=refresh-token',
        client,
      ),
    ).rejects.toThrow('Invalid refresh token');
  });

  it('인증 callback이 아니면 Supabase를 호출하지 않는다', async () => {
    const client = createClient();

    await expect(establishSessionFromOAuthCallback('melodygen:///practice', client)).resolves.toBe(
      false,
    );

    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(client.setSession).not.toHaveBeenCalled();
  });
});

describe('createOAuthCallbackProcessor', () => {
  const callbackUrl = 'melodygen:///#access_token=access-token&refresh_token=refresh-token';

  it('Linking과 WebBrowser가 같은 callback을 전달해도 세션을 한 번만 생성한다', async () => {
    let resolveSession!: (value: { error: null }) => void;
    const client = {
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
      setSession: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
      ),
    };
    const onError = jest.fn();
    const processor = createOAuthCallbackProcessor(client, onError);

    const linkingResult = processor.process(callbackUrl);
    const webBrowserResult = processor.process(callbackUrl);

    expect(linkingResult).toBe(webBrowserResult);
    expect(client.setSession).toHaveBeenCalledTimes(1);

    resolveSession({ error: null });
    await expect(linkingResult).resolves.toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('새 로그인 시작 시 reset한 뒤 다음 callback을 처리한다', async () => {
    const client = {
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
      setSession: jest.fn().mockResolvedValue({ error: null }),
    };
    const processor = createOAuthCallbackProcessor(client, jest.fn());

    await processor.process(callbackUrl);
    processor.reset();
    await processor.process('melodygen:///#access_token=next-access&refresh_token=next-refresh');

    expect(client.setSession).toHaveBeenCalledTimes(2);
  });

  it('세션 생성 실패를 한 번만 알리고 false를 반환한다', async () => {
    const client = {
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
      setSession: jest.fn().mockResolvedValue({ error: { message: 'Invalid token' } }),
    };
    const onError = jest.fn();
    const processor = createOAuthCallbackProcessor(client, onError);

    await expect(processor.process(callbackUrl)).resolves.toBe(false);
    await expect(processor.process(callbackUrl)).resolves.toBe(false);

    expect(client.setSession).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toEqual(new Error('Invalid token'));
  });
});
