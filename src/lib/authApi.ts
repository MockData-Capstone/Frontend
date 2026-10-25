import { api } from './api';

// 엔드포인트는 노션 ZIPFIT API명세서(auth 카테고리) 기준. 전부 "시작 전" 상태라
// 아직 백엔드에 실제로 존재하지 않을 수 있다. 요청/응답 JSON 필드명은 API명세서에
// 스키마까지는 없어서(설명 텍스트만 있음) 기능명세서 입력값 기준으로 추정한 값이다.

export interface SignUpRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

// AUTH-01 회원가입 — POST /api/auth/signup
// 설명에 토큰 발급 언급이 없어, 가입 후 토큰이 바로 오는지는 불확실하다.
// (호출부에서 가입 성공 후 별도로 login()을 호출해 토큰을 받는다.)
export async function signUp(payload: SignUpRequest): Promise<void> {
  await api.post('/api/auth/signup', payload);
}

// AUTH-01 보조 — GET /api/auth/email-availability?email=
export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await api.get<{ available: boolean }>(
    '/api/auth/email-availability',
    { params: { email } },
  );
  return data.available;
}

// AUTH-03 로그인 — POST /api/auth/login
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload);
  return data;
}

// AUTH-03 보조 — POST /api/auth/logout (refresh token 폐기)
export async function logout(refreshToken: string): Promise<void> {
  await api.post('/api/auth/logout', { refreshToken });
}

// AUTH-02 보조 — GET /api/auth/kakao/authorize-url
// 서버가 생성한 카카오 인가 URL을 반환한다. 앱 키를 FE에 두지 않기 위함.
export async function getKakaoAuthorizeUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>('/api/auth/kakao/authorize-url');
  return data.url;
}

// AUTH-02 카카오 로그인·가입 — POST /api/auth/kakao
// - LOGIN: 이미 가입한 회원 → tokens로 바로 로그인.
// - SIGNUP_REQUIRED: 처음 온 회원 → signup 정보로 가입 화면(개인정보 동의·닉네임)을 띄우고
//   signupSocial()로 가입을 마친다. signupToken은 10분 뒤 만료된다.
// 카카오 이메일은 선택 동의라 없어도 가입할 수 있다.
export interface SocialSignupInfo {
  signupToken: string;
  nickname: string | null; // 카카오 닉네임(기본값). 없을 수 있다.
  nicknameAvailable: boolean; // false면 새 닉네임을 입력받는다.
  email: string | null;
  profileImageUrl: string | null;
}

export type SocialLoginResult =
  | { status: 'LOGIN'; tokens: AuthResponse }
  | { status: 'SIGNUP_REQUIRED'; signup: SocialSignupInfo };

export async function exchangeKakaoCode(code: string): Promise<SocialLoginResult> {
  const { data } = await api.post<SocialLoginResult>('/api/auth/kakao', { code });
  return data;
}

// AUTH-02 소셜 최초 가입 — POST /api/auth/signup/social (201 + 토큰)
// 409 DUPLICATE_NICKNAME: 닉네임 중복 / 401 INVALID_SIGNUP_TOKEN: 가입 토큰 만료 → 카카오 로그인부터 다시.
export async function signupSocial(payload: {
  signupToken: string;
  nickname: string;
  privacyAgreed: boolean;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/signup/social', payload);
  return data;
}

// 백엔드 에러 응답 { code, message } 에서 code를 꺼낸다.
export function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    return (err as { response?: { data?: { code?: string } } }).response?.data?.code;
  }
  return undefined;
}

// AUTH-08 카카오 계정 연동 확인 — POST /api/auth/kakao/link
// TODO(AUTH-08, P1): 백엔드 미구현. 자체 가입(AUTH-01)이 생긴 뒤 연동 비밀번호 입력 UI와 함께 붙인다.
export async function kakaoLink(
  linkToken: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/kakao/link', {
    linkToken,
    password,
  });
  return data;
}
