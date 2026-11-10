import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import { getTokens, refreshTokens, setTokens, subscribeTokens } from '../../lib/api';
import { getMe, logout as logoutApi } from '../../lib/authApi';
import LoadState from '../../components/LoadState';
import type { MeResponse } from '../../types';
import { AuthContext, type AuthContextValue, type AuthTokens } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(
    () => getTokens()?.accessToken ?? null,
  );
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'ready' | 'error'>(
    () => getTokens() ? 'ready' : 'loading',
  );
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  // api.ts가 토큰의 단일 source다 — 401 인터셉터가 거기서 바로 로그아웃시킬 수 있어서다.
  // 여기서는 렌더에 쓸 accessToken만 거울처럼 맞춘다.
  useEffect(
    () =>
      subscribeTokens((tokens) => {
        setAccessTokenState(tokens?.accessToken ?? null);
        if (!tokens) setMe(null);
      }),
    [],
  );

  useEffect(() => {
    if (getTokens()) return;
    let cancelled = false;
    // StrictMode의 두 effect도 api.ts의 같은 재발급 요청을 공유한다.
    refreshTokens().then(
      () => { if (!cancelled) setSessionStatus('ready'); },
      (error: unknown) => {
        if (cancelled) return;
        // 쿠키가 없거나 만료된 방문자는 정상적인 비로그인 상태다.
        const anonymous = axios.isAxiosError(error) && error.response?.status === 401;
        setSessionStatus(anonymous ? 'ready' : 'error');
      },
    );
    return () => { cancelled = true; };
  }, [restoreAttempt]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      // 실패해도 헤더 아바타만 안 보일 뿐이라 이전 값을 그대로 둔다.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const signIn = useCallback((tokens: AuthTokens) => {
    setTokens(tokens);
  }, []);

  const signOut = useCallback(() => logoutApi(), []);

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, me, signIn, signOut }),
    [accessToken, me, signIn, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {sessionStatus === 'ready' ? children : (
        <LoadState
          status={sessionStatus}
          onRetry={() => {
            setSessionStatus('loading');
            setRestoreAttempt((attempt) => attempt + 1);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}
