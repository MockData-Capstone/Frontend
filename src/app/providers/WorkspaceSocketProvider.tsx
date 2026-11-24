import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { connectWorkspaceSocket, type WorkspaceConnection, type WsMessage } from '../../lib/websocket';
import {
  WorkspaceSocketContext,
  type WorkspaceMessageListener,
  type WorkspaceSocketContextValue,
} from './WorkspaceSocketContext';

// 그룹 화면에 있는 동안 Workspace 소켓을 하나만 열어 두고, 받은 통지를 하위 화면에 나눠 준다.
export function WorkspaceSocketProvider({
  workspaceId,
  onRejected,
  children,
}: {
  workspaceId: number;
  // 나가거나 내보내졌거나(4403) 그룹이 삭제됐다(4404).
  onRejected: (code: number) => void;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<WorkspaceMessageListener>());
  const connection = useRef<WorkspaceConnection | null>(null);
  const handleRejected = useEffectEvent((code: number) => onRejected(code));

  useEffect(() => {
      const socket = connectWorkspaceSocket(workspaceId, {
        onMessage: (message) => listeners.current.forEach((listener) => listener(message)),
        onOpenChange: (open) => setConnected(open),
        onRejected: (code) => handleRejected(code),
      });
      connection.current = socket;
      return () => { connection.current = null; socket(); };
    }, [workspaceId]);
  const send = useCallback((message: WsMessage) => connection.current?.send(message) ?? false, []);

  const subscribe = useCallback((listener: WorkspaceMessageListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<WorkspaceSocketContextValue>(
    () => ({ connected, subscribe, send }),
    [connected, subscribe, send],
  );

  return <WorkspaceSocketContext.Provider value={value}>{children}</WorkspaceSocketContext.Provider>;
}
