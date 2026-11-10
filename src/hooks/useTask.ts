import { useCallback, useRef, useState } from 'react';
import { getErrorMessage } from '../lib/authApi';

export function useTask() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(work: () => Promise<T>, success?: (value: T) => void | Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try { const value = await work(); await success?.(value); }
    catch (err) { setError(getErrorMessage(err, err instanceof Error ? err.message : '요청하지 못했어요. 다시 시도해주세요.')); }
    finally { lock.current = false; setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}
