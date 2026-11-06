import { api } from './api';
import type {
  NotificationPage,
  PushPublicKey,
  PushSubscriptionRequest,
  PushSubscriptionResult,
  ReadAllNotificationsResult,
  ReadNotificationResult,
  UnreadCountResponse,
} from '../types/notification';

// 알림·브라우저 알림 (api.md).

// 알림함 (기본 20개, 최대 100, 마지막으로 갱신된 순) — GET /api/notifications?cursor=&size=&unreadOnly=
export async function getNotifications(
  options: { cursor?: string | null; size?: number; unreadOnly?: boolean } = {},
): Promise<NotificationPage> {
  const { data } = await api.get<NotificationPage>('/api/notifications', {
    params: {
      cursor: options.cursor ?? undefined,
      size: options.size,
      unreadOnly: options.unreadOnly,
    },
  });
  return data;
}

// 안 읽은 개수 — 앱에 들어올 때와 실시간 연결이 다시 붙은 직후 부른다
export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<UnreadCountResponse>('/api/notifications/unread-count');
  return data.unreadCount;
}

// 읽음 처리 — PATCH /api/notifications/{notificationId}/read
export async function markNotificationRead(notificationId: number): Promise<ReadNotificationResult> {
  const { data } = await api.patch<ReadNotificationResult>(`/api/notifications/${notificationId}/read`);
  return data;
}

// 모두 읽음 — PATCH /api/notifications/read-all
export async function markAllNotificationsRead(): Promise<ReadAllNotificationsResult> {
  const { data } = await api.patch<ReadAllNotificationsResult>('/api/notifications/read-all');
  return data;
}

// 푸시 공개키 — GET /api/push-subscriptions/vapid-public-key
export async function getPushPublicKey(): Promise<PushPublicKey> {
  const { data } = await api.get<PushPublicKey>('/api/push-subscriptions/vapid-public-key');
  return data;
}

// 푸시 구독 등록 (같은 endpoint면 갱신) — POST /api/push-subscriptions → 201
export async function registerPushSubscription(
  subscription: PushSubscriptionRequest,
): Promise<PushSubscriptionResult> {
  const { data } = await api.post<PushSubscriptionResult>('/api/push-subscriptions', subscription);
  return data;
}

// 푸시 구독 해제 — DELETE /api/push-subscriptions?endpoint= → 204
export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  await api.delete('/api/push-subscriptions', { params: { endpoint } });
}
