import { isCancel } from 'axios';
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
export const WsClose = {
  BAD_REQUEST: 4400,
  // 토큰이 없거나 유효하지 않다. 다시 로그인한다.
  UNAUTHORIZED: 4401,
  // 접근 토큰이 만료됐다(연결 중에 만료돼도 닫힌다). 재발급받아 다시 접속한다.
  TOKEN_EXPIRED: 4402,
  // 멤버·참여자가 아니거나, 나가거나 내보내졌다.
  FORBIDDEN: 4403,
  // 대상(Workspace·투어)이 없거나 삭제·종료됐다.
  NOT_FOUND: 4404,
  // 같은 회원이 다른 탭에서 시그널링에 새로 접속했다. 이 연결로는 다시 접속하지 않는다.
  REPLACED: 4409,
} as const;

// API와 같은 서버. VITE_API_BASE_URL이 비어 있으면(폰 테스트 모드의 Vite 프록시) 지금 페이지 주소로 접속한다.
export const WS_BASE_URL = (BASE_URL || window.location.origin).replace(/^http/, 'ws');

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

// 끊긴 연결을 몇 번째로 다시 시도하는지에 따라 기다릴 시간
export function retryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
}

// 서버 시각 − 내 기기 시각. 가위바위보 마감·투어 진행 시간이 기기 시계와 어긋나지 않게 메시지의 sentAt으로 맞춘다.
let clockOffsetMs = 0;

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

export function syncServerClock(sentAt: string | undefined) {
  const serverTime = sentAt ? parseInstant(sentAt) : NaN;
  if (!Number.isNaN(serverTime)) clockOffsetMs = serverTime - Date.now();
}

export interface WorkspaceSocketHandlers {
  onMessage: (message: WsMessage) => void;
  onOpenChange: (open: boolean) => void;
  // 멤버가 아니게 됐거나(나감·내보내짐 4403) Workspace가 삭제됐다(4404). 다시 접속하지 않는다.
  onRejected: (code: number) => void;
}

export type WorkspaceConnection = (() => void) & { send: (message: WsMessage) => boolean };

// CHAT-01·02 Workspace 소켓 /ws/workspaces. 그룹 화면에 있는 동안 열어 둔다 —
// 미니게임 참가자는 이 소켓에 접속 중인 멤버만 고를 수 있고, 끊긴 채 10초가 지나면 게임에서 빠진다.
// 끊기면 다시 접속하고, 토큰이 만료돼 닫히면(4402) 재발급받아 다시 접속한다. 반환값을 부르면 닫는다.
export function connectWorkspaceSocket(
  workspaceId: number,
  handlers: WorkspaceSocketHandlers,
): WorkspaceConnection {
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
      syncServerClock(message.sentAt);
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
          refreshTokens(accessToken).then(open, (error: unknown) => {
            if (!closed && !isCancel(error)) forceLogout();
          });
          return;
        case WsClose.BAD_REQUEST:
        case WsClose.FORBIDDEN:
        case WsClose.NOT_FOUND:
          handlers.onRejected(event.code);
          return;
        default:
          timer = setTimeout(open, retryDelay(attempt++));
      }
    };
  };

  // StrictMode가 effect를 두 번 돌릴 때 열리기도 전에 닫히는 연결이 생기지 않게 한 틱 미룬다.
  timer = setTimeout(open, 0);

  const disconnect = () => {
    closed = true;
    clearTimeout(timer);
    socket?.close();
  };
  return Object.assign(disconnect, {
    send(message: WsMessage): boolean {
      if (closed || socket?.readyState !== WebSocket.OPEN) return false;
      try { socket.send(JSON.stringify(message)); return true; } catch { return false; }
    },
  });
}
