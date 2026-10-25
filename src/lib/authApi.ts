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
// 성공: 로그인/가입 처리 후 토큰 발급.
// 409: 같은 이메일의 자체 계정이 이미 있음 → linkToken 받아서 kakaoLink()로 연동 필요.
// 403: 카카오 이메일 제공 동의를 안 함.
export interface KakaoLoginConflict {
  type: 'ACCOUNT_LINK_REQUIRED';
  linkToken: string;
}

export async function exchangeKakaoCode(
  code: string,
): Promise<AuthResponse | KakaoLoginConflict> {
  try {
    const { data } = await api.post<AuthResponse>('/api/auth/kakao', { code });
    return data;
  } catch (err) {
    if (isAxiosErrorWithStatus(err, 409)) {
      const linkToken = (err.response?.data as { linkToken?: string })?.linkToken;
      if (linkToken) {
        return { type: 'ACCOUNT_LINK_REQUIRED', linkToken };
      }
    }
    throw err;
  }
}

// AUTH-02 카카오 계정 연동 확인 — POST /api/auth/kakao/link
// TODO(AUTH-08): 연동 비밀번호 입력 UI는 아직 없음. exchangeKakaoCode가
// ACCOUNT_LINK_REQUIRED를 반환했을 때 이 함수로 연동을 마무리해야 한다.
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

function isAxiosErrorWithStatus(
  err: unknown,
  status: number,
): err is { response?: { status: number; data?: unknown } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { status?: number } }).response?.status === status
  );
}
