import type { MeResponse } from '../types';
import { api } from './api';

// 내 정보 수정·연결·탈퇴 (api.md "내 정보·인증"). 내 정보 조회·로그아웃·카카오 연결 시작 주소는
// lib/authApi.ts의 getMe·logout·getKakaoAuthorizeUrl을 쓴다.
// 닉네임 중복 확인은 lib/authApi.ts의 checkNicknameAvailability 하나만 둔다 — 화면에서는 hooks/useNicknameAvailability를 쓴다.

// 닉네임 수정 (2~20자) — PATCH /api/users/me
export async function updateNickname(nickname: string): Promise<MeResponse> {
  const { data } = await api.patch<MeResponse>('/api/users/me', { nickname });
  return data;
}

// 비밀번호 변경 (새 비밀번호는 영문과 숫자를 포함한 8~64자) — PATCH /api/users/me
export async function changePassword(currentPassword: string, newPassword: string): Promise<MeResponse> {
  const { data } = await api.patch<MeResponse>('/api/users/me', { currentPassword, newPassword });
  return data;
}

// api의 기본 Content-Type이 JSON이라 그대로 보내면 axios가 FormData를 JSON({"image":{}})으로 바꿔 보낸다.
// 백엔드는 image가 없으면 기본 이미지로 되돌리므로 사진이 올라가지 않고 지워진다 — 사진 요청은 multipart로 지정한다.
// (브라우저에서는 axios가 이 값을 지우고 브라우저가 boundary를 붙인 Content-Type을 넣는다.)
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// 프로필 사진 변경 — PATCH /api/users/me/profile-image (multipart/form-data, 파일 필드 image)
export async function updateProfileImage(file: File): Promise<MeResponse> {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.patch<MeResponse>('/api/users/me/profile-image', form, MULTIPART);
  return data;
}

// 기본 이미지로 — 같은 주소로 image 없이 보낸다
export async function resetProfileImage(): Promise<MeResponse> {
  const { data } = await api.patch<MeResponse>('/api/users/me/profile-image', new FormData(), MULTIPART);
  return data;
}

// 구글 연결 시작 — GET /api/auth/google/authorize-url → 받은 주소로 이동한다
export async function getGoogleAuthorizeUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>('/api/auth/google/authorize-url');
  return data.url;
}

// 카카오·구글 연결 (이메일로 가입한 회원만) — POST /api/users/me/social/{provider}
export async function linkSocialAccount(
  provider: 'kakao' | 'google',
  code: string,
  password: string,
): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>(`/api/users/me/social/${provider}`, { code, password });
  return data;
}

// 회원 탈퇴 — DELETE /api/users/me → 204
export async function withdraw(): Promise<void> {
  await api.delete('/api/users/me');
}
