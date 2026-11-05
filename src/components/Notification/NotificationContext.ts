import { createContext } from 'react';
import type { WsMessage } from '../../lib/websocket';

export type NotificationMessageListener = (message: WsMessage) => void;

export interface NotificationContextValue {
  // 안 읽은 알림 수. 아직 모르거나 로그인 전이면 null(배지를 숨긴다).
  unreadCount: number | null;
  // 서버가 준 unreadCount로 배지를 맞출 때 (읽음 처리 응답 등)
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => void;
  // 알림 연결을 열어 둬야 하는 상태(로그인)인지, 지금 열려 있는지. 끊김 안내 띠가 쓴다.
  socketActive: boolean;
  socketConnected: boolean;
  // 알림 연결 통지를 받는다. 반환값을 부르면 구독을 끊는다.
  subscribe: (listener: NotificationMessageListener) => () => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);
