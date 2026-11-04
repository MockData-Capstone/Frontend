import { useContext, useEffect, useEffectEvent } from 'react';
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
