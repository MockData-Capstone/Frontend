import { Link, NavLink, useMatch } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspaceSocket } from '../../app/providers/useWorkspaceSocket';
import type { WorkspaceDetail } from '../../types';
import Avatar from '../Avatar';
import ConnectionBanner from '../ConnectionBanner';
import { HomeIcon } from '../Header';
import NotificationBell from '../Notification/NotificationBell';
import '../Header/Header.css';
import './WorkspaceHeader.css';

// 헤더 C (UI v0.4 §3). 함께 찾기(11)는 화면이 아직 없어 비활성. 집보기는 미니게임(19~22)으로 가고,
// 실시간 집보기 시청(23)에서도 켜져 보인다.
// 그룹 연결(WorkspaceSocketProvider) 안에서 그려져야 한다 — 끊김 안내 띠가 그룹 연결 상태를 받는다.
export default function WorkspaceHeader({ workspace }: { workspace: WorkspaceDetail }) {
  const { me } = useAuth();
  const { connected } = useWorkspaceSocket();
  const onTour = useMatch('/workspaces/:workspaceId/tour/*') !== null;

  return (
    <>
      <header className="site-header">
        <nav className="site-header__nav">
          <NavLink to={`/workspaces/${workspace.id}/search`} className={({ isActive }) => `site-header__nav-link${isActive ? ' is-active' : ''}`}>함께 찾기</NavLink>
          <NavLink
            to={`/workspaces/${workspace.id}/candidates`}
            className={({ isActive }) =>
              `site-header__nav-link${isActive ? ' is-active' : ''}`
            }
          >
            후보지
          </NavLink>
          <NavLink
            to={`/workspaces/${workspace.id}/minigame`}
            className={({ isActive }) =>
              `site-header__nav-link${isActive || onTour ? ' is-active' : ''}`
            }
          >
            집보기
          </NavLink>
        </nav>

        <Link to="/" className="site-header__logo">
          <HomeIcon />
          <span>zipfit</span>
        </Link>

        <div className="workspace-header__meta">
          <span className="workspace-header__name">{workspace.name}</span>
          <span className="workspace-header__count">멤버 {workspace.memberCount}명</span>
          <NotificationBell />
          <Link to="/account" aria-label="내 정보">{me ? <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} /> : '내 정보'}</Link>
        </div>
      </header>
      <ConnectionBanner workspaceConnected={connected} />
    </>
  );
}
