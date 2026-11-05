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

// 로그인한 동안 안 읽은 알림 수를 들고 알림 연결을 열어 둔다 (realtime.md "알림 연결").
// 안 읽은 개수는 앱에 들어올 때(로그인 직후)와 연결이 다시 붙은 직후 부르고,
// 그 사이에는 NOTIFICATION_CREATED·NOTIFICATION_READ의 unreadCount로 맞춘다.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const loggedIn = accessToken !== null;
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
    if (!loggedIn) return;
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
  }, [loggedIn, refreshUnreadCount]);

  const subscribe = useCallback((listener: NotificationMessageListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const setUnreadCount = useCallback((count: number) => setUnreadCountState(count), []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount: loggedIn ? unreadCount : null,
      setUnreadCount,
      refreshUnreadCount,
      socketActive: loggedIn,
      socketConnected,
      subscribe,
    }),
    [loggedIn, unreadCount, setUnreadCount, refreshUnreadCount, socketConnected, subscribe],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
