import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { getErrorMessage } from '../lib/authApi';
import { getMyWorkspaces } from '../lib/workspaceApi';
import type { WorkspaceSummary } from '../types';
import './WorkspaceList.css';

// 08 내 그룹 목록 (UI v0.4 §6). 그룹이 여러 개일 때 모양은 미결(Q13)이라 참여한 그룹을 모두 카드로 나열한다.
export default function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyWorkspaces()
      .then((data) => {
        if (!cancelled) setWorkspaces(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '그룹 목록을 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page page--workspace-list">
      <Header />
      <main className="workspace-list">
        <h1 className="workspace-list__title">함께 집을 찾을 그룹을 선택하세요</h1>
        <p className="workspace-list__subtitle">
          그룹에 들어가면 멤버들과 지도와 후보지를 함께 볼 수 있어요.
        </p>

        {error && <p className="workspace-list__error">{error}</p>}
        {!error && !workspaces && <p className="workspace-list__hint">불러오는 중...</p>}
        {workspaces?.length === 0 && (
          <p className="workspace-list__hint">아직 참여한 그룹이 없어요.</p>
        )}

        <div className="workspace-list__grid">
          {workspaces?.map((ws) => (
            <section key={ws.id} className="workspace-card">
              <p className="workspace-card__eyebrow">내가 참여한 그룹</p>
              <h2 className="workspace-card__name">{ws.name}</h2>
              <p className="workspace-card__meta">멤버 {ws.memberCount}명</p>
              <Link
                to={`/workspaces/${ws.id}`}
                className="button button--primary workspace-card__button"
              >
                그룹 들어가기
              </Link>
            </section>
          ))}
          <section className="workspace-card">
            <p className="workspace-card__eyebrow">새로운 시작</p>
            <h2 className="workspace-card__name">새 그룹 만들기</h2>
            <p className="workspace-card__meta">함께 집을 찾을 멤버들과 그룹을 시작하세요.</p>
            <Link to="/workspaces/new" className="button button--primary workspace-card__button">
              새 그룹 만들기
            </Link>
          </section>
        </div>

        <p className="workspace-list__browse">그룹 선택 전에도 동네 지도를 둘러볼 수 있어요.</p>
        <Link to="/" className="button button--secondary workspace-list__browse-button">
          지도 둘러보기
        </Link>
      </main>
    </div>
  );
}
