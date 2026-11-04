import { createContext } from 'react';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextValue {
  accessToken: string | null;
  // 로그인/회원가입 성공 시 호출. 토큰을 api.ts 모듈 상태에 저장한다.
  signIn: (tokens: AuthTokens) => void;
  // AUTH-03 보조(POST /api/auth/logout)로 refresh token을 폐기한 뒤 로컬 상태를 지운다.
  signOut: () => Promise<void>;
}

// TODO(기능명세서 7장 #28): 영속 저장 방식(localStorage/쿠키 등)은 아직 미결.
// 실제 보관은 lib/api.ts의 모듈 메모리가 한다 — 여기 accessToken은 렌더용 거울.
export const AuthContext = createContext<AuthContextValue | null>(null);
