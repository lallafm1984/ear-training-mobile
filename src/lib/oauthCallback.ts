export type OAuthCallbackPayload =
  | { type: 'code'; code: string }
  | { type: 'tokens'; accessToken: string; refreshToken: string }
  | { type: 'error'; code: string | null; description: string }
  | { type: 'none' };

interface OAuthSessionClient {
  exchangeCodeForSession: (code: string) => Promise<{ error: { message: string } | null }>;
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ error: { message: string } | null }>;
}

export interface OAuthCallbackProcessor {
  process: (url: string) => Promise<boolean>;
  reset: () => void;
}

function paramsFromUrlPart(value: string | undefined): URLSearchParams {
  return new URLSearchParams(value ?? '');
}

/**
 * Supabase OAuth redirects can use query parameters (PKCE) or hash parameters
 * (implicit flow). Parse both so Android warm/cold deep links share one path.
 */
export function parseOAuthCallbackUrl(url: string): OAuthCallbackPayload {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  const queryParams = paramsFromUrlPart(query);
  const hashParams = paramsFromUrlPart(hash);
  const read = (key: string) => queryParams.get(key) ?? hashParams.get(key);

  const errorCode = read('error_code') ?? read('error');
  const errorDescription = read('error_description');
  if (errorCode || errorDescription) {
    return {
      type: 'error',
      code: errorCode,
      description: errorDescription ?? errorCode ?? 'OAuth callback failed',
    };
  }

  const code = read('code');
  if (code) return { type: 'code', code };

  const accessToken = read('access_token');
  const refreshToken = read('refresh_token');
  if (accessToken && refreshToken) {
    return { type: 'tokens', accessToken, refreshToken };
  }

  return { type: 'none' };
}

/** Returns true only when the URL contained and completed an OAuth callback. */
export async function establishSessionFromOAuthCallback(
  url: string,
  client: OAuthSessionClient,
): Promise<boolean> {
  const payload = parseOAuthCallbackUrl(url);

  if (payload.type === 'none') return false;
  if (payload.type === 'error') {
    throw new Error(payload.description);
  }

  const { error } =
    payload.type === 'code'
      ? await client.exchangeCodeForSession(payload.code)
      : await client.setSession({
          access_token: payload.accessToken,
          refresh_token: payload.refreshToken,
        });

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Linking 이벤트와 WebBrowser 결과가 같은 callback을 동시에 전달해도
 * Supabase의 일회용 code/refresh token을 한 번만 사용한다.
 */
export function createOAuthCallbackProcessor(
  client: OAuthSessionClient,
  onError: (error: unknown) => void,
): OAuthCallbackProcessor {
  let callbackPromise: Promise<boolean> | null = null;

  return {
    process: (url: string) => {
      if (parseOAuthCallbackUrl(url).type === 'none') return Promise.resolve(false);
      if (callbackPromise) return callbackPromise;

      callbackPromise = establishSessionFromOAuthCallback(url, client).catch((error) => {
        onError(error);
        return false;
      });
      return callbackPromise;
    },
    reset: () => {
      callbackPromise = null;
    },
  };
}
