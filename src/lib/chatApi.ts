import { api } from './api';
import type { ChatMessage, CursorPage } from '../types/search';

export async function getMessages(workspaceId: number, cursor: { before?: string; after?: string } = {}) {
  const { data } = await api.get<CursorPage<ChatMessage>>(`/api/workspaces/${workspaceId}/messages`, {
    params: { ...cursor, size: 50 },
  });
  return data;
}

// HTTP 조회와 실시간 통지가 겹쳐도 한 메시지는 한 번만 표시한다.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map(current.map((message) => [message.messageId, message]));
  incoming.forEach((message) => messages.set(message.messageId, message));
  return [...messages.values()].sort((a, b) => a.messageId - b.messageId);
}
