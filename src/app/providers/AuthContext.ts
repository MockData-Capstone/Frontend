import { createContext } from 'react';
import type { MeResponse } from '../../types';
import type { Tokens } from '../../lib/api';

export type AuthTokens = Tokens;

export interface AuthContextValue {
  accessToken: string | null;
  // AUTH-04 내 정보. 로그인 직후 받아오기 전까지는 accessToken이 있어도 null이다.
  me: MeResponse | null;
  // 로그인/회원가입 성공 시 호출. 토큰을 api.ts 모듈 상태에 저장한다.
  signIn: (tokens: AuthTokens) => void;
  // AUTH-03 보조(POST /api/auth/logout)로 refresh token을 폐기한 뒤 로컬 상태를 지운다.
  signOut: () => Promise<void>;
}

// 재발급 토큰은 httpOnly 쿠키, 접근 토큰은 lib/api.ts의 메모리에만 둔다.
// AuthProvider가 쿠키로 세션을 복원한 뒤 하위 화면을 렌더한다.
export const AuthContext = createContext<AuthContextValue | null>(null);
