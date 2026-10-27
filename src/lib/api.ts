import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 토큰은 여기 모듈 메모리에만 둔다(영속 저장 방식은 기능명세서 7장 #28 기준 미결).
// AuthProvider는 subscribeTokens로 구독해서 React state를 거울처럼 맞춘다 —
// 401 인터셉터처럼 React 트리 밖에서도 로그아웃을 트리거할 수 있어야 해서다.
let tokens: Tokens | null = null;
const listeners = new Set<(tokens: Tokens | null) => void>();

export function getTokens(): Tokens | null {
  return tokens;
}

export function setTokens(next: Tokens | null) {
  tokens = next;
  listeners.forEach((listener) => listener(tokens));
}

export function subscribeTokens(listener: (tokens: Tokens | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function forceLogout() {
  setTokens(null);
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
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
    const currentRefreshToken = tokens?.refreshToken;

    if (isExpired && currentRefreshToken && !original._retried) {
      original._retried = true;
      try {
        // 인터셉터 재귀를 피하려고 `api` 대신 별도 axios 인스턴스로 호출한다.
        const { data } = await axios.post<Tokens>(`${BASE_URL}/api/auth/token/refresh`, {
          refreshToken: currentRefreshToken,
        });
        setTokens(data);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        forceLogout();
        return Promise.reject(refreshError);
      }
    }

    forceLogout();
    return Promise.reject(error);
  },
);
