import { createContext } from 'react';

// TODO(F-01, 인증): 로그인 상태, JWT access/refresh 관리
export const AuthContext = createContext<null>(null);
