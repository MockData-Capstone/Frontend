import { forceLogout, getTokens, refreshTokens } from './api';
import { retryDelay, WS_BASE_URL, WsClose, type WsMessage } from './websocket';

// 알림 연결 /ws/notifications (realtime.md). 로그인한 동안 늘 열어 두고, 서버가 보내기만 한다.
// 닫힘 처리는 lib/websocket.ts의 그룹 연결과 같다: 4401 로그아웃, 4402 연장 후 다시 접속,
// 4400은 다시 접속하지 않고, 그 밖의 끊김은 retryDelay 간격으로 다시 연결한다.

export interface NotificationSocketHandlers {
  onMessage: (message: WsMessage) => void;
  onOpenChange: (open: boolean) => void;
  // 끊겼다가 다시 붙었다. 놓친 알림이 있을 수 있어 안 읽은 개수를 새로 불러온다.
  onReconnected: () => void;
}

// 반환값을 부르면 닫는다.
export function connectNotificationSocket(handlers: NotificationSocketHandlers): () => void {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let closed = false;
  let openedBefore = false;

  const open = () => {
    const accessToken = getTokens()?.accessToken;
    if (closed || !accessToken) return;
    // 브라우저 WebSocket은 헤더를 붙일 수 없어서 토큰을 쿼리로 보낸다.
    const ws = new WebSocket(`${WS_BASE_URL}/ws/notifications?token=${encodeURIComponent(accessToken)}`);
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      handlers.onOpenChange(true);
      if (openedBefore) handlers.onReconnected();
      openedBefore = true;
    };

    ws.onmessage = (event) => {
      let message: WsMessage;
      try {
        message = JSON.parse(event.data as string) as WsMessage;
      } catch {
        return;
      }
      handlers.onMessage(message);
    };

    ws.onclose = (event) => {
      socket = null;
      if (closed) return;
      handlers.onOpenChange(false);
      switch (event.code) {
        case WsClose.UNAUTHORIZED:
          forceLogout();
          return;
        case WsClose.TOKEN_EXPIRED:
          refreshTokens().then(open, forceLogout);
          return;
        case WsClose.BAD_REQUEST:
          return;
        default:
          timer = setTimeout(open, retryDelay(attempt++));
      }
    };
  };

  // StrictMode가 effect를 두 번 돌릴 때 열리기도 전에 닫히는 연결이 생기지 않게 한 틱 미룬다.
  timer = setTimeout(open, 0);

  return () => {
    closed = true;
    clearTimeout(timer);
    socket?.close();
  };
}
