import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../app/providers/useAuth';
import type { WsMessage } from '../../lib/websocket';
import { getUnreadCount } from '../../lib/notificationApi';
import { connectNotificationSocket } from '../../lib/notificationSocket';
import type { NotificationCreatedData, NotificationReadData } from '../../types/notification';
import {
  NotificationContext,
  type NotificationContextValue,
  type NotificationMessageListener,
} from './NotificationContext';

// 알림 백엔드(/ws/notifications, /api/notifications/*)가 아직 없어서 기본으로 꺼 둔다.
// 꺼져 있으면 연결을 열지 않고 안 읽은 개수도 부르지 않는다 — 끊김 안내 띠가 늘 떠 있지 않고, 알림 종은 배지 없이 보인다.
// 백엔드가 준비되면 .env.local에 VITE_NOTIFICATIONS=on 을 넣어 켠다.
const NOTIFICATIONS_ENABLED = import.meta.env.VITE_NOTIFICATIONS === 'on';

// 로그인한 동안 안 읽은 알림 수를 들고 알림 연결을 열어 둔다 (realtime.md "알림 연결").
// 안 읽은 개수는 앱에 들어올 때(로그인 직후)와 연결이 다시 붙은 직후 부르고,
// 그 사이에는 NOTIFICATION_CREATED·NOTIFICATION_READ의 unreadCount로 맞춘다.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const active = accessToken !== null && NOTIFICATIONS_ENABLED;
  const [unreadCount, setUnreadCountState] = useState<number | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const listeners = useRef(new Set<NotificationMessageListener>());

  const refreshUnreadCount = useCallback(() => {
    getUnreadCount()
      .then(setUnreadCountState)
      // 실패하면 배지만 이전 값으로 둔다.
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getUnreadCount()
      .then((count) => {
        if (!cancelled) setUnreadCountState(count);
      })
      .catch(() => {});

    const disconnect = connectNotificationSocket({
      onMessage: (message: WsMessage) => {
        if (message.type === 'NOTIFICATION_CREATED') {
          setUnreadCountState((message.data as NotificationCreatedData).unreadCount);
        } else if (message.type === 'NOTIFICATION_READ') {
          setUnreadCountState((message.data as NotificationReadData).unreadCount);
        } else {
          return;
        }
        listeners.current.forEach((listener) => listener(message));
      },
      onOpenChange: setSocketConnected,
      onReconnected: refreshUnreadCount,
    });

    return () => {
      cancelled = true;
      disconnect();
      setSocketConnected(false);
      setUnreadCountState(null);
    };
  }, [active, refreshUnreadCount]);

  const subscribe = useCallback((listener: NotificationMessageListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const setUnreadCount = useCallback((count: number) => setUnreadCountState(count), []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount: active ? unreadCount : null,
      setUnreadCount,
      refreshUnreadCount,
      socketActive: active,
      socketConnected,
      subscribe,
    }),
    [active, unreadCount, setUnreadCount, refreshUnreadCount, socketConnected, subscribe],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
