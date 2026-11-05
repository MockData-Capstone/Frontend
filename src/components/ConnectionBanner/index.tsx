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
  // 이 화면에서 한 번이라도 모두 연결됐는지. 처음 접속이 늦을 때는 한 번도 붙은 적이 없으니
  // "끊겼어요" 대신 "연결하는 중"이라고 한다.
  const [connectedOnce, setConnectedOnce] = useState(!down);
  if (!down && !connectedOnce) setConnectedOnce(true);

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
      {connectedOnce ? '실시간 연결이 끊겼어요. 다시 연결하는 중…' : '실시간으로 연결하는 중이에요…'}
    </div>
  );
}
