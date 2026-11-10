import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotifications } from './useNotifications';
import './NotificationBell.css';

// 알림함 패널(E2)을 만들기 전까지는 다른 미구현 버튼처럼 비활성 + "준비 중" 툴팁으로 둔다(빈 패널이 열리지 않게).
// 패널을 만들면 true로 바꾼다.
const PANEL_READY = false;

// 알림 종 + 안 읽은 알림 수 배지 (0이면 숨김, 100 이상이면 "99+").
// 누르면 종 아래에 알림 패널이 열리고 닫힌다.
export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // 다른 화면으로 가면 닫는다. 연 화면으로 돌아와도(뒤로 가기·탭 이동) 다시 열리지 않는다.
  const [openPath, setOpenPath] = useState(pathname);
  if (openPath !== pathname) {
    setOpenPath(pathname);
    setOpen(false);
  }
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const count = unreadCount ?? 0;
  const badge = count >= 100 ? '99+' : String(count);

  return (
    <div ref={rootRef} className="notification-bell">
      <button
        type="button"
        className={`notification-bell__button${open ? ' is-open' : ''}`}
        aria-label={count > 0 ? `알림, 안 읽은 알림 ${badge}개` : '알림'}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!PANEL_READY}
        title={PANEL_READY ? undefined : '준비 중인 기능이에요.'}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        {count > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="notification-bell__panel" role="dialog" aria-label="알림" />}
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
