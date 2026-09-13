import type { ReactNode } from 'react';
import { WorkspaceContext } from './WorkspaceContext';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return <WorkspaceContext.Provider value={null}>{children}</WorkspaceContext.Provider>;
}
