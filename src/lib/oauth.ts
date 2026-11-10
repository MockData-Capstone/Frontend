import { api } from './api';

export type SocialProvider = 'kakao' | 'google';
export type OAuthIntent = { provider: SocialProvider; mode: 'login' | 'link'; state: string; startedAt: number };
const KEY = 'zipfit.oauth-intent';

export function validateOAuthIntent(raw: string | null, provider: SocialProvider, state: string | null, now = Date.now()): OAuthIntent {
  let intent: OAuthIntent | null = null;
  try { intent = raw ? JSON.parse(raw) as OAuthIntent : null; } catch { /* invalid saved state */ }
  if (!intent || !state || intent.state !== state || intent.provider !== provider ||
      !['login', 'link'].includes(intent.mode) || !Number.isFinite(intent.startedAt) ||
      now - intent.startedAt > 10 * 60 * 1000 || now < intent.startedAt) {
    throw new Error('로그인 요청이 만료되었거나 일치하지 않아요. 다시 시작해주세요.');
  }
  return intent;
}
export async function createOAuthAuthorizeUrl(provider: SocialProvider, mode: OAuthIntent['mode'] = 'login'): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/api/auth/${provider}/authorize-url`);
  const url = new URL(data.url);
  if (url.protocol !== 'https:') throw new Error('소셜 로그인 주소를 확인할 수 없어요.');
  const intent: OAuthIntent = { provider, mode, state: crypto.randomUUID(), startedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(intent));
  url.searchParams.set('state', intent.state);
  return url.href;
}
export async function beginOAuth(provider: SocialProvider, mode: OAuthIntent['mode'] = 'login'): Promise<void> {
  window.location.assign(await createOAuthAuthorizeUrl(provider, mode));
}
export function consumeOAuthIntent(provider: SocialProvider, state: string | null): OAuthIntent {
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return validateOAuthIntent(raw, provider, state);
}
