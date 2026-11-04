import { BASE_URL, forceLogout, getTokens, refreshTokens } from './api';
import { parseInstant } from './time';

// 모든 WebSocket 메시지의 공통 형식 (Backend common/websocket/WsMessage).
// 서버 → 클라이언트 { type, data, sentAt }. 실패한 요청은 보낸 연결에만 { type: 'ERROR', data: { code, message, requestId } }.
export interface WsMessage<T = unknown> {
  type: string;
  data: T;
  sentAt?: string;
}

// 서버가 연결을 닫을 때 쓰는 close code (Backend WsCloseCodes)
const CLOSE_BAD_REQUEST = 4400;
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_TOKEN_EXPIRED = 4402;
const CLOSE_FORBIDDEN = 4403;
const CLOSE_NOT_FOUND = 4404;

const WS_BASE_URL = BASE_URL.replace(/^http/, 'ws');
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

// 서버 시각 − 내 기기 시각. 가위바위보 마감 카운트다운이 기기 시계와 어긋나지 않게 메시지의 sentAt으로 맞춘다.
let clockOffsetMs = 0;

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

export interface WorkspaceSocketHandlers {
  onMessage: (message: WsMessage) => void;
  onOpenChange: (open: boolean) => void;
  // 멤버가 아니게 됐거나(나감·내보내짐 4403) Workspace가 삭제됐다(4404). 다시 접속하지 않는다.
  onRejected: (code: number) => void;
}

// CHAT-01·02 Workspace 소켓 /ws/workspaces. 그룹 화면에 있는 동안 열어 둔다 —
// 미니게임 참가자는 이 소켓에 접속 중인 멤버만 고를 수 있고, 끊긴 채 10초가 지나면 게임에서 빠진다.
// 끊기면 다시 접속하고, 토큰이 만료돼 닫히면(4402) 재발급받아 다시 접속한다. 반환값을 부르면 닫는다.
export function connectWorkspaceSocket(
  workspaceId: number,
  handlers: WorkspaceSocketHandlers,
): () => void {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let closed = false;

  const open = () => {
    const accessToken = getTokens()?.accessToken;
    if (closed || !accessToken) return;
    // 브라우저 WebSocket은 헤더를 붙일 수 없어서 토큰을 쿼리로 보낸다.
    const ws = new WebSocket(
      `${WS_BASE_URL}/ws/workspaces?workspaceId=${workspaceId}&token=${encodeURIComponent(accessToken)}`,
    );
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      handlers.onOpenChange(true);
    };

    ws.onmessage = (event) => {
      let message: WsMessage;
      try {
        message = JSON.parse(event.data as string) as WsMessage;
      } catch {
        return;
      }
      const sentAt = message.sentAt ? parseInstant(message.sentAt) : NaN;
      if (!Number.isNaN(sentAt)) clockOffsetMs = sentAt - Date.now();
      handlers.onMessage(message);
    };

    ws.onclose = (event) => {
      socket = null;
      if (closed) return;
      handlers.onOpenChange(false);
      switch (event.code) {
        case CLOSE_UNAUTHORIZED:
          forceLogout();
          return;
        case CLOSE_TOKEN_EXPIRED:
          refreshTokens().then(open, forceLogout);
          return;
        case CLOSE_BAD_REQUEST:
        case CLOSE_FORBIDDEN:
        case CLOSE_NOT_FOUND:
          handlers.onRejected(event.code);
          return;
        default:
          timer = setTimeout(open, RETRY_DELAYS_MS[Math.min(attempt++, RETRY_DELAYS_MS.length - 1)]);
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
