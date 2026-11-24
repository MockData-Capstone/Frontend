import { api } from './api';
import type {
  AcceptInvitationResult,
  Invitation,
  InvitationPreview,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceSummary,
} from '../types';

// WS-01 Workspace 생성 (만든 사람이 호스트) — POST /api/workspaces
export async function createWorkspace(payload: {
  name: string;
  description: string | null;
}): Promise<WorkspaceDetail> {
  const { data } = await api.post<WorkspaceDetail>('/api/workspaces', payload);
  return data;
}

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

// MEM-01 초대 링크 발급 (호스트). 이전 링크는 바로 무효가 된다 — POST /api/workspaces/{workspaceId}/invitations
export async function issueInvitation(workspaceId: number): Promise<Invitation> {
  const { data } = await api.post<Invitation>(`/api/workspaces/${workspaceId}/invitations`);
  return data;
}

// MEM-01 보조 지금 쓸 수 있는 초대 링크 (호스트, 없으면 null) — GET /api/workspaces/{workspaceId}/invitations/current
export async function getCurrentInvitation(workspaceId: number): Promise<Invitation | null> {
  const { data } = await api.get<{ invitation: Invitation | null }>(
    `/api/workspaces/${workspaceId}/invitations/current`,
  );
  return data.invitation;
}

// MEM-02 보조 초대 정보 (로그인 없이 조회, 만료·무효 링크면 410 INVITATION_EXPIRED) — GET /api/invitations/{token}
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const { data } = await api.get<InvitationPreview>(
    `/api/invitations/${encodeURIComponent(token)}`,
  );
  return data;
}

// MEM-02 초대 수락 (이미 멤버면 등록하지 않고 같은 workspaceId) — POST /api/invitations/{token}/accept
export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  const { data } = await api.post<AcceptInvitationResult>(
    `/api/invitations/${encodeURIComponent(token)}/accept`,
  );
  return data;
}

// MEM-03 멤버 목록 (참여 순) — GET /api/workspaces/{workspaceId}/members
export async function getMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  const { data } = await api.get<{ items: WorkspaceMember[] }>(
    `/api/workspaces/${workspaceId}/members`,
  );
  return data.items;
}
