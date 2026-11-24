// 멤버의 접속 여부(online)와 MEMBER_ONLINE·MEMBER_OFFLINE의 data(MemberOnlineChangedData)는
// types/index.ts의 WorkspaceMember 쪽에 둔다 (fix/backend-integration).

// 그룹 수정 — PATCH /api/workspaces/{workspaceId}. 보낸 필드만 바뀐다. description: ""이면 소개를 지운다.
export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
}

// 그룹 연결 통지 data (realtime.md, 백엔드 WorkspaceService·MemberService의 record와 같은 모양)
export interface MemberRemovedData {
  userId: number;
}

export interface HostChangedData {
  previousHostUserId: number;
  newHostUserId: number;
}

export interface WorkspaceUpdatedData {
  workspaceId: number;
  name: string;
  description: string | null;
}

export interface WorkspaceDeletedData {
  workspaceId: number;
}
