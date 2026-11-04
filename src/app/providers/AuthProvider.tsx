import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTokens, setTokens, subscribeTokens } from '../../lib/api';
import { logout as logoutApi } from '../../lib/authApi';
import { AuthContext, type AuthContextValue, type AuthTokens } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(
    () => getTokens()?.accessToken ?? null,
  );

  // api.ts가 토큰의 단일 source다 — 401 인터셉터가 거기서 바로 로그아웃시킬 수 있어서다.
  // 여기서는 렌더에 쓸 accessToken만 거울처럼 맞춘다.
  useEffect(() => subscribeTokens((tokens) => setAccessTokenState(tokens?.accessToken ?? null)), []);

  const signIn = useCallback((tokens: AuthTokens) => {
    setTokens(tokens);
  }, []);

  const signOut = useCallback(async () => {
    const current = getTokens();
    if (current) {
      try {
        await logoutApi(current.refreshToken);
      } catch {
        // 서버 로그아웃 실패해도 클라이언트 상태는 지운다.
      }
    }
    setTokens(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, signIn, signOut }),
    [accessToken, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
