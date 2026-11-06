import type { WorkspaceDetail } from '../types';
import { api } from './api';
import type { UpdateWorkspaceRequest } from '../types/workspaceSettings';

// 그룹 설정 (api.md "그룹·멤버·초대" 중 lib/workspaceApi.ts에 없는 기능)

// 그룹 수정 — PATCH /api/workspaces/{workspaceId}. 보낸 필드만 바뀐다. description: ""이면 소개를 지운다.
export async function updateWorkspace(
  workspaceId: number,
  changes: UpdateWorkspaceRequest,
): Promise<WorkspaceDetail> {
  const { data } = await api.patch<WorkspaceDetail>(`/api/workspaces/${workspaceId}`, changes);
  return data;
}

// 그룹 삭제 — DELETE /api/workspaces/{workspaceId} → 204
export async function deleteWorkspace(workspaceId: number): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}`);
}

// 호스트 위임 — PATCH /api/workspaces/{workspaceId}/host → 그룹 상세
export async function delegateHost(workspaceId: number, userId: number): Promise<WorkspaceDetail> {
  const { data } = await api.patch<WorkspaceDetail>(`/api/workspaces/${workspaceId}/host`, { userId });
  return data;
}

// 멤버 내보내기 (기존 초대 링크도 모두 무효) — DELETE /api/workspaces/{workspaceId}/members/{userId} → 204
export async function kickMember(workspaceId: number, userId: number): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}/members/${userId}`);
}

// 그룹 나가기 — DELETE /api/workspaces/{workspaceId}/members/me → 204
export async function leaveWorkspace(workspaceId: number): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}/members/me`);
}
