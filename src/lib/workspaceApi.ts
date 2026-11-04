import { api } from './api';
import type { WorkspaceDetail, WorkspaceSummary } from '../types';

// WS-02 내 Workspace 목록 (최근 활동순) — GET /api/workspaces
export async function getMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data } = await api.get<{ items: WorkspaceSummary[] }>('/api/workspaces');
  return data.items;
}

// WS-02 Workspace 상세 — GET /api/workspaces/{workspaceId}
export async function getWorkspace(workspaceId: number): Promise<WorkspaceDetail> {
  const { data } = await api.get<WorkspaceDetail>(`/api/workspaces/${workspaceId}`);
  return data;
}
