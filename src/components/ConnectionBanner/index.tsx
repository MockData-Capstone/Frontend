import { useEffect, useState } from 'react';
import { useNotifications } from '../Notification/useNotifications';
import './ConnectionBanner.css';

const SHOW_AFTER_MS = 3000;

// 실시간 끊김 안내 띠 (realtime.md). 그룹 연결이나 알림 연결이 3초 넘게 끊겨 있으면 상단바 바로 아래에 보여준다.
// 3초 안에 다시 붙으면 띄우지 않는다. 그룹 안이면 workspaceConnected(useWorkspaceSocket().connected)를 넘긴다.
export default function ConnectionBanner({ workspaceConnected }: { workspaceConnected?: boolean }) {
  const { socketActive, socketConnected } = useNotifications();
  const down = (socketActive && !socketConnected) || workspaceConnected === false;
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setWaited(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setWaited(false);
    };
  }, [down]);

  if (!down || !waited) return null;
  return (
    <div className="connection-banner" role="status">
      <span className="connection-banner__dot" aria-hidden="true" />
      실시간 연결이 끊겼어요. 다시 연결하는 중…
    </div>
  );
}
