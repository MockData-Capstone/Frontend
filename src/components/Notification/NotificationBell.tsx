import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../lib/authApi';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../lib/notificationApi';
import { notificationPath } from '../../lib/notificationLinks';
import { formatRelativeTime } from '../../lib/relativeTime';
import type { AppNotification } from '../../types/notification';
import { useNotifications } from './useNotifications';
import './NotificationBell.css';

// 알림 종 + 안 읽은 알림 수 배지 (0이면 숨김, 100 이상이면 "99+").
// 누르면 알림함(NOTI-02)이 열린다: 최근 알림 목록, 하나 읽음(누르면 해당 화면으로), 모두 읽음, 더 보기.
export default function NotificationBell() {
  const { unreadCount, setUnreadCount, subscribe } = useNotifications();
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
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        {count > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          onClose={() => setOpen(false)}
          setUnreadCount={setUnreadCount}
          subscribe={subscribe}
        />
      )}
    </div>
  );
}

function NotificationPanel({
  onClose,
  setUnreadCount,
  subscribe,
}: {
  onClose: () => void;
  setUnreadCount: (count: number) => void;
  subscribe: ReturnType<typeof useNotifications>['subscribe'];
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    getNotifications({ size: 20 })
      .then((page) => {
        setItems(page.items);
        setCursor(page.nextCursor);
        setHasNext(page.hasNext);
        setUnreadCount(page.unreadCount);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, '알림을 불러오지 못했어요.')));
  }, [setUnreadCount]);

  useEffect(load, [load]);

  // 열려 있는 동안 새 알림·다른 기기의 읽음 처리가 오면 목록을 다시 받는다
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === 'NOTIFICATION_CREATED' || message.type === 'NOTIFICATION_READ') load();
      }),
    [subscribe, load],
  );

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await getNotifications({ cursor, size: 20 });
      setItems((current) => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (err) {
      setError(getErrorMessage(err, '알림을 더 불러오지 못했어요.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const open = async (item: AppNotification) => {
    if (!item.read) {
      try {
        const res = await markNotificationRead(item.notificationId);
        setUnreadCount(res.unreadCount);
        setItems((current) => current?.map((n) => (n.notificationId === item.notificationId ? { ...n, read: true } : n)) ?? null);
      } catch {
        // 읽음 처리에 실패해도 이동은 한다 — 다음에 열 때 다시 읽음 처리된다.
      }
    }
    const path = notificationPath(item);
    if (path) {
      onClose();
      navigate(path);
    }
  };

  const readAll = async () => {
    try {
      const res = await markAllNotificationsRead();
      setUnreadCount(res.unreadCount);
      setItems((current) => current?.map((n) => ({ ...n, read: true })) ?? null);
    } catch (err) {
      setError(getErrorMessage(err, '모두 읽음 처리하지 못했어요.'));
    }
  };

  const hasUnread = items?.some((n) => !n.read) ?? false;

  return (
    <div className="notification-bell__panel" role="dialog" aria-label="알림">
      <div className="notification-panel__head">
        <h2 className="notification-panel__title">알림</h2>
        <button type="button" className="notification-panel__read-all" onClick={() => void readAll()} disabled={!hasUnread}>
          모두 읽음
        </button>
      </div>
      {error && (
        <p className="notification-panel__status notification-panel__status--error" role="alert">
          {error}
        </p>
      )}
      {items === null && !error && <p className="notification-panel__status">불러오는 중…</p>}
      {items?.length === 0 && <p className="notification-panel__status">새 알림이 없어요.</p>}
      {items && items.length > 0 && (
        <ul className="notification-panel__list">
          {items.map((item) => {
            const path = notificationPath(item);
            return (
              <li key={item.notificationId}>
                <button
                  type="button"
                  className={`notification-panel__item${item.read ? '' : ' is-unread'}`}
                  onClick={() => void open(item)}
                  aria-disabled={!path && item.read}
                >
                  <span className="notification-panel__group">{item.workspaceName}</span>
                  <span className="notification-panel__message">
                    {item.message}
                    {item.count > 1 && <span className="notification-panel__count"> ({item.count})</span>}
                  </span>
                  <span className="notification-panel__time">
                    {formatRelativeTime(item.updatedAt)}
                    {!item.linkActive && ' · 삭제된 항목'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasNext && (
        <button type="button" className="notification-panel__more" onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      )}
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
