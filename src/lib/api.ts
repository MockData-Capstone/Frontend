import axios from 'axios';

// JWT 헤더 자동 첨부 axios 인스턴스.
// TODO: 401 응답 시 refresh 토큰으로 재시도하는 인터셉터 추가 (AUTH-09, 토큰 구조는 기능명세서 7장 #28 기준 미결)
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

// accessToken은 AuthProvider가 메모리(React state)로만 들고 있고, 요청 시 여기로 주입한다.
// 새로고침하면 로그인 상태가 풀린다 — 영속 저장 방식(localStorage/쿠키)은 아직 팀 미결 사항.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
