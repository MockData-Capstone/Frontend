import { createContext } from 'react';
import type { WsMessage } from '../../lib/websocket';

export type WorkspaceMessageListener = (message: WsMessage) => void;

export interface WorkspaceSocketContextValue {
  // Workspace 소켓이 열려 있는지. 미니게임은 이 소켓에 접속 중인 멤버만 참여할 수 있다.
  connected: boolean;
  // 받은 통지를 listener에 넘긴다. 반환값을 부르면 구독을 끊는다.
  subscribe: (listener: WorkspaceMessageListener) => () => void;
}

// WorkspaceLayout(그룹 라우트) 안에서만 값이 있다.
export const WorkspaceSocketContext = createContext<WorkspaceSocketContextValue | null>(null);
