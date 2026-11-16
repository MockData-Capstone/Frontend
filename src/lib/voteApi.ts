import { api } from './api';
import type { CandidateVotes, VoteChoice } from '../types';
export async function getVotes(workspaceId: number): Promise<CandidateVotes[]> {
  return (await api.get<{ items: CandidateVotes[] }>(`/api/workspaces/${workspaceId}/votes`)).data.items;
}
export async function submitVote(candidateId: number, choice: VoteChoice, previous: VoteChoice | null): Promise<CandidateVotes> {
  return previous === null
    ? (await api.post<CandidateVotes>(`/api/candidates/${candidateId}/votes`, { choice })).data
    : (await api.patch<CandidateVotes>(`/api/candidates/${candidateId}/votes/me`, { choice })).data;
}
