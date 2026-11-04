import type { ReactNode } from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from './WorkspaceContext';

// 불러오기는 WorkspaceLayout이 하고, 여기서는 결과만 하위 라우트에 공급한다.
export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
