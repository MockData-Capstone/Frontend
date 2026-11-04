import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { WorkspaceProvider } from '../../app/providers/WorkspaceProvider';
import { WorkspaceSocketProvider } from '../../app/providers/WorkspaceSocketProvider';
import { useWorkspaceMessages } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import { getWorkspace } from '../../lib/workspaceApi';
import type { MiniGame, WorkspaceDetail } from '../../types';
import WorkspaceHeader from '../WorkspaceHeader';
import './WorkspaceLayout.css';

// /workspaces/:workspaceId 하위 라우트의 공통 틀. 그룹이 바뀌면 key로 다시 마운트해 이전 그룹 상태를 버린다.
export default function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <WorkspaceShell key={workspaceId} workspaceId={Number(workspaceId)} />;
}

// 그룹 홈(11)이 아직 없어서 그룹에 들어오면 후보지 목록(14)으로 보낸다.
export function WorkspaceIndexRedirect() {
  return <Navigate to="candidates" replace />;
}

function WorkspaceShell({ workspaceId }: { workspaceId: number }) {
  const navigate = useNavigate();
  const validId = Number.isInteger(workspaceId) && workspaceId > 0;
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    getWorkspace(workspaceId)
      .then((data) => {
        if (!cancelled) setWorkspace(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '그룹 정보를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, validId]);

  if (!validId || error) {
    return (
      <div className="workspace-layout__status">
        <p>{validId ? error : '잘못된 그룹 주소예요.'}</p>
        <Link to="/workspaces">내 그룹으로 돌아가기</Link>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="workspace-layout__status">
        <p>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="page page--workspace">
      <WorkspaceHeader workspace={workspace} />
      <main className="workspace-layout__main">
        <WorkspaceProvider value={{ workspace }}>
          {/* 나가거나 내보내졌거나(4403) 그룹이 삭제되면(4404) 서버가 소켓을 닫는다 — 내 그룹 목록으로 보낸다. */}
          <WorkspaceSocketProvider
            workspaceId={workspace.id}
            onRejected={() => navigate('/workspaces', { replace: true })}
          >
            <GameStartRedirect workspaceId={workspace.id} />
            <Outlet />
          </WorkspaceSocketProvider>
        </WorkspaceProvider>
      </main>
    </div>
  );
}

// 미니게임 참가자로 뽑히면 어느 화면에 있든 게임 화면으로 데려간다 — 가위바위보는 10초 안에 내야 해서다.
// 참가자가 아닌 멤버는 보던 화면에 두고, 헤더 [집보기] 탭으로 들어오게 한다.
function GameStartRedirect({ workspaceId }: { workspaceId: number }) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const gamePath = `/workspaces/${workspaceId}/minigame`;

  useWorkspaceMessages((message) => {
    if (message.type !== 'GAME_STARTED' || !me || pathname === gamePath) return;
    const game = message.data as MiniGame;
    if (game.participants.some((p) => p.userId === me.id)) navigate(gamePath);
  });

  return null;
}
