import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../lib/authApi';

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const fetchVersion = useCallback(async (version: number) => {
    try {
      const value = await load();
      if (version === generation.current) { setData(value); setError(null); }
      return value;
    } catch (err) {
      if (version === generation.current) setError(getErrorMessage(err, '불러오지 못했어요. 다시 시도해주세요.'));
      return undefined;
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [load]);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchVersion(++generation.current);
  }, [fetchVersion]);
  useEffect(() => {
    void fetchVersion(++generation.current);
    return () => { generation.current += 1; };
  }, [fetchVersion]);
  return { data, setData, error, loading, reload };
}
