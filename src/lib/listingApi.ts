import { api } from './api';
import type { ListingLinks } from '../types/search';
export async function getListingLinks(workspaceId: number, candidateId: number): Promise<ListingLinks> {
  return (await api.get<ListingLinks>(`/api/workspaces/${workspaceId}/listing-links`, { params: { candidateId } })).data;
}
export function safeExternalUrl(url: string): string | null {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; }
  catch { return null; }
}
