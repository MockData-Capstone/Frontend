import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useParams } from 'react-router-dom';
import { WorkspaceProvider } from '../../app/providers/WorkspaceProvider';
import { getErrorMessage } from '../../lib/authApi';
import { getWorkspace } from '../../lib/workspaceApi';
import type { WorkspaceDetail } from '../../types';
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
          <Outlet />
        </WorkspaceProvider>
      </main>
    </div>
  );
}
