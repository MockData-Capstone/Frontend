import { useEffect, useRef, useState } from 'react';
import { checkNicknameAvailability } from '../lib/authApi';

export type NicknameStatus = 'idle' | 'checking' | 'available' | 'unavailable';

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 500;

// AUTH-01·02 보조(GET /api/auth/nickname-availability) 실시간 체크.
// 입력이 멈추고 500ms 뒤 자동으로 호출한다 — 별도 "중복확인" 버튼 없음.
export function useNicknameAvailability(nickname: string): NicknameStatus {
  const trimmed = nickname.trim();
  const [status, setStatus] = useState<NicknameStatus>('idle');
  const requestId = useRef(0);

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) {
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setStatus('checking');
      checkNicknameAvailability(trimmed)
        .then((available) => {
          if (requestId.current === id) setStatus(available ? 'available' : 'unavailable');
        })
        .catch(() => {
          if (requestId.current === id) setStatus('idle');
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // 너무 짧으면(2자 미만) 진행 중이던 요청과 무관하게 항상 idle로 보여준다.
  return trimmed.length < MIN_LENGTH ? 'idle' : status;
}
