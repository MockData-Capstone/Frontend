import { api } from './api';
import type { Candidate } from '../types';

// CAND-02 후보지 목록 (입지 정보·투표 집계 요약 포함) — GET /api/workspaces/{workspaceId}/candidates
export async function getCandidates(workspaceId: number): Promise<Candidate[]> {
  const { data } = await api.get<{ items: Candidate[] }>(
    `/api/workspaces/${workspaceId}/candidates`,
  );
  return data.items;
}

// CAND-02 후보지 상세, LOC-03 입지 정보 — GET /api/candidates/{candidateId}
export async function getCandidate(candidateId: number): Promise<Candidate> {
  const { data } = await api.get<Candidate>(`/api/candidates/${candidateId}`);
  return data;
}

// CAND-04 후보지 이름 수정 (최대 50자) — PATCH /api/candidates/{candidateId}
export async function renameCandidate(candidateId: number, name: string): Promise<Candidate> {
  const { data } = await api.patch<Candidate>(`/api/candidates/${candidateId}`, { name });
  return data;
}

// CAND-03 후보지 제외 (추가한 멤버 또는 호스트만) — DELETE /api/candidates/{candidateId}
export async function removeCandidate(candidateId: number): Promise<void> {
  await api.delete(`/api/candidates/${candidateId}`);
}
