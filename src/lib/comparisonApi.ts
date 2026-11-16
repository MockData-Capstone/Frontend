import { api } from './api';
import type { ComparisonResult } from '../types/search';
export async function getComparison(workspaceId: number): Promise<ComparisonResult> {
  return (await api.get<ComparisonResult>(`/api/workspaces/${workspaceId}/comparisons`)).data;
}
export async function regenerateComparison(workspaceId: number, candidateIds: number[]): Promise<ComparisonResult> {
  return (await api.post<ComparisonResult>(`/api/workspaces/${workspaceId}/comparisons`, undefined,
    { params: { candidateIds: candidateIds.join(',') } })).data;
}
