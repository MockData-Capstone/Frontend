import type { NicknameStatus } from '../hooks/useNicknameAvailability';

// 닉네임 입력 아래에 실시간 중복확인 상태를 보여준다 (GET /api/auth/nickname-availability).
export default function NicknameHint({ status }: { status: NicknameStatus }) {
  if (status === 'checking') {
    return <p className="auth-field__hint">확인 중...</p>;
  }
  if (status === 'available') {
    return <p className="auth-field__hint auth-field__hint--ok">사용할 수 있는 닉네임이에요.</p>;
  }
  if (status === 'unavailable') {
    return <p className="auth-field__hint auth-field__hint--bad">이미 사용 중인 닉네임이에요.</p>;
  }
  return null;
}
