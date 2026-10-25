import { createContext } from 'react';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextValue {
  accessToken: string | null;
  // 로그인/회원가입 성공 시 호출. 토큰을 메모리에 저장하고 axios 인스턴스에도 반영한다.
  signIn: (tokens: AuthTokens) => void;
  // AUTH-03 보조(POST /api/auth/logout)로 refresh token을 폐기한 뒤 로컬 상태를 지운다.
  signOut: () => Promise<void>;
}

// TODO(기능명세서 7장 #28): 영속 저장 방식(localStorage/쿠키 등)은 아직 미결.
// 지금은 메모리(React state)에만 보관 — 새로고침하면 로그인 상태가 풀린다.
export const AuthContext = createContext<AuthContextValue | null>(null);
