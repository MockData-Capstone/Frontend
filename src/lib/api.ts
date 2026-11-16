import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export interface Tokens {
  accessToken: string;
}

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 접근 토큰만 메모리에 둔다. 재발급 토큰은 서버의 httpOnly 쿠키로 브라우저가 관리한다.
// AuthProvider는 subscribeTokens로 구독해서 React state를 거울처럼 맞춘다 —
// 401 인터셉터처럼 React 트리 밖에서도 로그아웃을 트리거할 수 있어야 해서다.
let tokens: Tokens | null = null;
let sessionVersion = 0;
const listeners = new Set<(tokens: Tokens | null) => void>();

export function getTokens(): Tokens | null {
  return tokens;
}

export function setTokens(next: Tokens | null) {
  sessionVersion += 1;
  tokens = next;
  listeners.forEach((listener) => listener(tokens));
}

export function subscribeTokens(listener: (tokens: Tokens | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function forceLogout() {
  setTokens(null);
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

let refreshing: Promise<Tokens> | null = null;
let signingOut: Promise<void> | null = null;

// 새로고침·HTTP 401·소켓 4402가 겹쳐도 쿠키 rotation 요청은 한 번만 보낸다.
export function refreshTokens(expiredAccessToken?: string): Promise<Tokens> {
  if (signingOut) {
    return Promise.reject(new axios.CanceledError('로그아웃 중입니다.'));
  }
  // 늦게 도착한 만료 응답이면 다른 요청이 이미 받은 새 접근 토큰을 재사용한다.
  if (expiredAccessToken && tokens && tokens.accessToken !== expiredAccessToken) {
    return Promise.resolve(tokens);
  }
  if (refreshing) return refreshing;

  const version = sessionVersion;
  // 인터셉터 재귀를 피하려고 `api` 대신 별도 axios 인스턴스로 호출한다.
  refreshing = axios
    .post<Tokens>(`${BASE_URL}/api/auth/token/refresh`, undefined, { withCredentials: true })
    .then(({ data }) => {
      if (version !== sessionVersion) {
        throw new axios.CanceledError('로그인 상태가 변경되었습니다.');
      }
      setTokens(data);
      return data;
    })
    .catch((error: unknown) => {
      if (version !== sessionVersion) {
        throw new axios.CanceledError('로그인 상태가 변경되었습니다.');
      }
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// 진행 중인 rotation을 먼저 끝내야 가장 최근 쿠키를 폐기할 수 있다.
// 서버 요청이 실패하면 로그인 상태를 유지해 사용자가 로그아웃을 다시 시도할 수 있게 한다.
export function endSession(): Promise<void> {
  signingOut ??= (async () => {
    await refreshing?.catch(() => {});
    await axios.post(`${BASE_URL}/api/auth/logout`, undefined, { withCredentials: true });
    setTokens(null);
  })().finally(() => {
    signingOut = null;
  });
  return signingOut;
}

api.interceptors.request.use((config) => {
  if (tokens) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// 401 AUTH_TOKEN_EXPIRED: refresh 토큰으로 재발급 후 원래 요청을 한 번만 재시도한다.
// 그 외 401(또는 refresh 자체 실패)은 로그인 세션을 지우고 /login으로 보낸다.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status !== 401 || !original) {
      return Promise.reject(error);
    }

    const isExpired = code === 'AUTH_TOKEN_EXPIRED';

    if (isExpired && tokens && !original._retried) {
      original._retried = true;
      try {
        const authorization = original.headers.Authorization;
        const expiredToken = typeof authorization === 'string' ? authorization.slice(7) : undefined;
        const next = await refreshTokens(expiredToken);
        original.headers.Authorization = `Bearer ${next.accessToken}`;
        return api(original);
      } catch (refreshError) {
        if (!axios.isCancel(refreshError)) forceLogout();
        return Promise.reject(refreshError);
      }
    }

    // 로그인 실패 등 공개 API의 401은 해당 화면에서 처리한다.
    if (tokens && original.headers.Authorization === `Bearer ${tokens.accessToken}`) {
      forceLogout();
    }
    return Promise.reject(error);
  },
);
