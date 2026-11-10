import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { WorkspaceProvider } from '../../app/providers/WorkspaceProvider';
import { WorkspaceSocketProvider } from '../../app/providers/WorkspaceSocketProvider';
import { useWorkspaceMessages, useWorkspaceSocket } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import { getWorkspace } from '../../lib/workspaceApi';
import type { MiniGame, WorkspaceDetail } from '../../types';
import type {
  HostChangedData,
  MemberRemovedData,
  WorkspaceUpdatedData,
} from '../../types/workspaceSettings';
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
      <WorkspaceProvider value={{ workspace }}>
        {/* 나가거나 내보내졌거나(4403) 그룹이 삭제되면(4404) 서버가 소켓을 닫는다 — 내 그룹 목록으로 보낸다. */}
        <WorkspaceSocketProvider
          workspaceId={workspace.id}
          onRejected={() => navigate('/workspaces', { replace: true })}
        >
          {/* 헤더도 그룹 연결 안에 둔다 — 상단바 아래 끊김 안내 띠가 그룹 연결 상태를 받는다. */}
          <WorkspaceHeader workspace={workspace} />
          <WorkspaceDetailSync workspaceId={workspace.id} onChange={setWorkspace} />
          <GameStartRedirect workspaceId={workspace.id} />
          <main className="workspace-layout__main">
            <Outlet />
          </main>
        </WorkspaceSocketProvider>
      </WorkspaceProvider>
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

// 그룹 연결 통지로 그룹 상세(상단바 이름·인원, 내 역할)를 바로 맞춘다. 들어올 때 한 번만 불러오기 때문에,
// 이게 없으면 다른 멤버가 들어오고 나가거나 그룹 이름이 바뀌어도 새로고침 전까지 상단바가 그대로다.
// 통지만으로 맞출 수 없을 때는 상세를 새로 불러온다:
// - 연결이 다시 붙은 직후: 끊긴 동안 놓친 통지(입장·퇴장·이름 변경)가 있을 수 있다.
// - HOST_CHANGED: 통지에는 사용자 ID만 있어서 host(닉네임·사진)를 채울 수 없다.
function WorkspaceDetailSync({
  workspaceId,
  onChange,
}: {
  workspaceId: number;
  onChange: (update: (current: WorkspaceDetail | null) => WorkspaceDetail | null) => void;
}) {
  const { me } = useAuth();
  const { connected } = useWorkspaceSocket();
  const openedBefore = useRef(false);

  // 실패하면 지금 값을 그대로 둔다 — 다음 재연결이나 통지 때 다시 맞춘다.
  const resync = () => {
    getWorkspace(workspaceId)
      .then((data) => onChange(() => data))
      .catch(() => {});
  };
  const resyncAfterReconnect = useEffectEvent(resync);

  // 다시 붙은 직후에만 새로 불러온다. 첫 연결은 WorkspaceShell이 막 불러온 직후라 건너뛴다.
  useEffect(() => {
    if (!connected) return;
    if (openedBefore.current) resyncAfterReconnect();
    openedBefore.current = true;
  }, [connected]);

  useWorkspaceMessages((message) => {
    const update = (fn: (current: WorkspaceDetail) => WorkspaceDetail) =>
      onChange((current) => (current ? fn(current) : current));
    switch (message.type) {
      case 'WORKSPACE_UPDATED': {
        const data = message.data as WorkspaceUpdatedData;
        update((w) => (w.id === data.workspaceId ? { ...w, name: data.name, description: data.description } : w));
        return;
      }
      case 'MEMBER_JOINED':
        update((w) => ({ ...w, memberCount: w.memberCount + 1 }));
        return;
      case 'MEMBER_LEFT':
        update((w) => ({ ...w, memberCount: Math.max(0, w.memberCount - 1) }));
        return;
      case 'MEMBER_KICKED': {
        // 내가 대상이면 아무것도 하지 않는다(곧 4403으로 닫혀 내 그룹 목록으로 간다).
        if ((message.data as MemberRemovedData).userId === me?.id) return;
        update((w) => ({ ...w, memberCount: Math.max(0, w.memberCount - 1) }));
        return;
      }
      case 'HOST_CHANGED': {
        const data = message.data as HostChangedData;
        // 내 역할은 바로 바꾸고, 새 호스트의 닉네임·사진(host)은 상세를 새로 불러와 채운다.
        if (data.newHostUserId === me?.id) update((w) => ({ ...w, myRole: 'HOST' }));
        else if (data.previousHostUserId === me?.id) update((w) => ({ ...w, myRole: 'MEMBER' }));
        resync();
        return;
      }
    }
  });

  return null;
}
