import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useNotifications } from '../components/Notification/useNotifications';
import PushPreferences from '../components/Notification/PushPreferences';
import { ErrorNotice, FeaturePage } from '../components/FeatureUI';
import { useResource } from '../hooks/useResource';
import { useTask } from '../hooks/useTask';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/notificationApi';
import { notificationPath } from '../lib/notificationLinks';
import type { AppNotification } from '../types/notification';
import { parseInstant } from '../lib/time';

export default function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  return <div className="page"><Header /><FeaturePage title="알림함" description="그룹 소식과 함께 집을 찾는 진행 상황을 확인하세요.">
    <div className="feature-actions"><label className="feature-check"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />읽지 않은 알림만</label></div>
    <NotificationList key={String(unreadOnly)} unreadOnly={unreadOnly} /><PushPreferences />
  </FeaturePage></div>;
}
function NotificationList({ unreadOnly }: { unreadOnly: boolean }) {
  const result = useResource(useCallback(() => getNotifications({ unreadOnly }), [unreadOnly]));
  const task = useTask();
  const navigate = useNavigate();
  const { subscribe, setUnreadCount, socketConnected } = useNotifications();
  const previousConnected = useRef(socketConnected);
  const { reload } = result;
  useEffect(() => subscribe(() => { void reload(); }), [subscribe, reload]);
  useEffect(() => {
    if (socketConnected && !previousConnected.current) void reload();
    previousConnected.current = socketConnected;
  }, [socketConnected, reload]);
  const read = (item: AppNotification, open: boolean) => void task.run(async () => {
    const response = await markNotificationRead(item.notificationId); setUnreadCount(response.unreadCount);
    const path = notificationPath(item);
    if (open && path) navigate(path); else await reload();
  });
  return <section className="feature-card"><div className="feature-actions"><h2>그룹 소식</h2><button className="button button--secondary" disabled={task.busy || result.loading || !result.data?.unreadCount} onClick={() => void task.run(markAllNotificationsRead, async (response) => { setUnreadCount(response.unreadCount); await reload(); })}>모두 읽음</button><button className="button button--secondary" disabled={result.loading} onClick={() => { void reload(); }}>새로고침</button></div>
    <ErrorNotice message={result.error} retry={() => { void reload(); }} /><ErrorNotice message={task.error} />
    {result.loading && !result.data && <p>알림을 불러오는 중...</p>}
    {result.data?.items.length === 0 && <p>표시할 알림이 없어요.</p>}
    <ul className="feature-list">{result.data?.items.map((item) => <li key={item.notificationId}><span className="feature-badge">{item.read ? '읽음' : '새 알림'}</span><strong> {item.workspaceName}</strong><p>{item.message}</p><p className="feature-muted">{new Date(parseInstant(item.updatedAt)).toLocaleString('ko-KR')}</p>
      <div className="feature-actions">{notificationPath(item) ? <button className="button button--primary" disabled={task.busy} onClick={() => read(item, true)}>관련 화면 보기</button> : <span className="feature-muted">대상이 삭제되어 이동할 수 없어요.</span>}{!item.read && <button className="button button--secondary" disabled={task.busy} onClick={() => read(item, false)}>읽음 처리</button>}</div>
    </li>)}</ul>
    {result.data?.hasNext && <button className="button button--secondary" disabled={task.busy || result.loading} onClick={() => void task.run(() => getNotifications({ unreadOnly, cursor: result.data!.nextCursor }), (page) => {
      result.setData((current) => ({ ...page, items: [...new Map([...(current?.items ?? []), ...page.items].map((item) => [item.notificationId, item])).values()] }));
    })}>이전 알림 더 보기</button>}
  </section>;
}
