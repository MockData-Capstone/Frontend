import type { AppNotification } from '../types/notification';
export function notificationPath(notification: AppNotification): string | null {
  if (!notification.linkActive || !Number.isSafeInteger(notification.workspaceId) || notification.workspaceId <= 0) return null;
  const base = `/workspaces/${notification.workspaceId}`;
  switch (notification.type) {
    case 'MEMBER_JOINED': return `${base}/settings`;
    case 'NEW_MESSAGE': case 'ANALYSIS_COMPLETED': return `${base}/search`;
    case 'TOUR_STARTED': return `${base}/tour`;
    case 'VOTE_NEEDED': return `${base}/votes`;
    default: return null;
  }
}
