import { useContext } from 'react';
import { WorkspaceContext } from './WorkspaceContext';

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace는 WorkspaceLayout(그룹 라우트) 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
