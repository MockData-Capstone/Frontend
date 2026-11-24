import { useContext, useEffect, useEffectEvent, useRef } from 'react';
import { WorkspaceSocketContext, type WorkspaceMessageListener } from './WorkspaceSocketContext';

export function useWorkspaceSocket() {
  const ctx = useContext(WorkspaceSocketContext);
  if (!ctx) {
    throw new Error('useWorkspaceSocket은 WorkspaceLayout(그룹 라우트) 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}

// Workspace 소켓 통지를 받을 때마다 listener를 부른다. listener는 렌더마다 새로 만들어도 된다.
export function useWorkspaceMessages(listener: WorkspaceMessageListener) {
  const { subscribe } = useWorkspaceSocket();
  const onMessage = useEffectEvent(listener);
  useEffect(() => subscribe((message) => onMessage(message)), [subscribe]);
}

// 화면을 연 뒤 Workspace 소켓이 붙을 때마다 onConnect를 부른다 — 끊겼다 다시 붙을 때, 그리고 화면이 연결보다
// 먼저 열렸으면 첫 연결 때. 그사이 놓친 통지가 있을 수 있어 목록을 다시 불러오는 데 쓴다.
// 이미 연결된 채로 화면을 열었으면 처음 불러온 값이 최신이라 부르지 않는다.
export function useWorkspaceReconnect(onConnect: () => void) {
  const { connected } = useWorkspaceSocket();
  const handleConnect = useEffectEvent(onConnect);
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) handleConnect();
    wasConnected.current = connected;
  }, [connected]);
}
