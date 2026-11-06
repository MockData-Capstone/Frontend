// 초대 링크 (MEM-01·02). 백엔드는 토큰만 주고 링크 주소는 프론트가 정한다 — {지금 주소}/invite/{token}
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

// 초대 링크로 들어와 로그인·가입하러 간 사이 토큰을 기억한다 ("로그인 후 참여를 이어서", MEM-02).
// 카카오 로그인은 페이지를 떠났다 돌아오므로, 같은 탭에서 유지되는 sessionStorage에 둔다.
const PENDING_KEY = 'zipfit.pendingInvite';

export function rememberInvite(token: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, token);
  } catch {
    // 저장이 막힌 브라우저면 로그인 뒤 초대 링크를 다시 열어야 한다.
  }
}

export function pendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 위와 같음
  }
}
