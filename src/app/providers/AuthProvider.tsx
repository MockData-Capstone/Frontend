import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { setAccessToken as setApiAccessToken } from '../../lib/api';
import { logout as logoutApi } from '../../lib/authApi';
import { AuthContext, type AuthContextValue, type AuthTokens } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // refreshToken은 렌더와 무관해서 state로 둘 필요 없음 — signOut 시점에만 읽는다.
  const refreshTokenRef = useRef<string | null>(null);

  const signIn = useCallback((tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    refreshTokenRef.current = tokens.refreshToken;
    setApiAccessToken(tokens.accessToken);
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {
        // 서버 로그아웃 실패해도 클라이언트 상태는 지운다.
      }
    }
    setAccessToken(null);
    refreshTokenRef.current = null;
    setApiAccessToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, signIn, signOut }),
    [accessToken, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
