import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { TourConnection, TourSnapshot } from '../../lib/webrtc';
import { serverNow } from '../../lib/websocket';

const noopUnsubscribe = () => {};

// TourConnection의 상태(시그널링·상대별 연결·받은 영상)를 렌더에 쓴다. 연결 전에는 null.
export function useTourSnapshot(connection: TourConnection | null): TourSnapshot | null {
  const subscribe = useCallback(
    (onChange: () => void) => connection?.subscribe(onChange) ?? noopUnsubscribe,
    [connection],
  );
  const getSnapshot = useCallback(() => connection?.getSnapshot() ?? null, [connection]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

// 1초마다 바뀌는 현재 시각. 진행 시간은 서버 시각, 연결 시간은 기기 시각으로 잰다.
export function useNow(active: boolean, clock: () => number = serverNow): number {
  const [now, setNow] = useState(clock);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(timer);
  }, [active, clock]);

  return now;
}
