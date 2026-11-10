import { createContext } from 'react';
import type { WorkspaceDetail } from '../../types';

export interface WorkspaceContextValue {
  workspace: WorkspaceDetail;
  updateWorkspace: (workspace: WorkspaceDetail) => void;
}

// WorkspaceLayout(그룹 라우트) 안에서만 값이 있다.
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
