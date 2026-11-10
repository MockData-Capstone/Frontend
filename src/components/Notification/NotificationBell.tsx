import { Link } from 'react-router-dom';
import { useNotifications } from './useNotifications';
import './NotificationBell.css';

// 알림 종 + 안 읽은 알림 수 배지 (0이면 숨김, 100 이상이면 "99+").
// 전체 알림함으로 이동한다.
export default function NotificationBell() {
  const { unreadCount } = useNotifications();

  const count = unreadCount ?? 0;
  const badge = count >= 100 ? '99+' : String(count);

  return (
    <div className="notification-bell">
      <Link
        to="/notifications"
        className="notification-bell__button"
        aria-label={count > 0 ? `알림, 안 읽은 알림 ${badge}개` : '알림'}
      >
        <BellIcon />
        {count > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </Link>
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
