// 알림 타입 (api.md "알림·브라우저 알림", 백엔드 NotificationResponse·NotificationDtos와 같은 모양)

export type NotificationType =
  | 'MEMBER_JOINED'
  | 'NEW_MESSAGE'
  | 'ANALYSIS_COMPLETED'
  | 'VOTE_NEEDED'
  | 'TOUR_STARTED';

// 브라우저 Notification과 이름이 겹치지 않게 AppNotification이라고 부른다.
export interface AppNotification {
  notificationId: number;
  type: NotificationType;
  workspaceId: number;
  workspaceName: string;
  // 서버가 만든 문구
  message: string;
  // VOTE_NEEDED는 후보지 ID, TOUR_STARTED는 투어 ID. 나머지는 null
  targetId: number | null;
  // 묶인 건수 (새 메시지 알림만 1보다 크다)
  count: number;
  read: boolean;
  // 대상이 삭제되면 false
  linkActive: boolean;
  createdAt: string;
  // 묶음 알림은 마지막 메시지 시각
  updatedAt: string;
}

// 알림함 — GET /api/notifications
export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
  hasNext: boolean;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface ReadNotificationResult {
  notificationId: number;
  unreadCount: number;
}

export interface ReadAllNotificationsResult {
  updatedCount: number;
  unreadCount: number;
}

export interface PushPublicKey {
  publicKey: string | null;
  enabled: boolean;
}

// 서비스 워커의 PushSubscription.toJSON()을 그대로 보낸다.
export interface PushSubscriptionRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSubscriptionResult {
  subscriptionId: number;
  endpoint: string;
}

// 알림 연결 NOTIFICATION_CREATED의 data
export interface NotificationCreatedData {
  notification: AppNotification;
  unreadCount: number;
}

// 알림 연결 NOTIFICATION_READ의 data (다른 탭·기기의 읽음 처리)
export interface NotificationReadData {
  notificationIds: number[];
  unreadCount: number;
}
