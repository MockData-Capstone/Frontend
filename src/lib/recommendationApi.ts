import { api } from './api';
import type { Analysis, Recommendations } from '../types/search';

export function refreshesRecommendations(type: string): boolean {
  return type.startsWith('RECOMMENDATION_') || type.startsWith('CANDIDATE_');
}

export async function getRecommendations(workspaceId: number): Promise<Recommendations> {
  return (await api.get<Recommendations>(`/api/workspaces/${workspaceId}/recommendations`)).data;
}
export async function requestRecommendations(workspaceId: number): Promise<Analysis> {
  return (await api.post<Analysis>(`/api/workspaces/${workspaceId}/recommendations`)).data;
}
