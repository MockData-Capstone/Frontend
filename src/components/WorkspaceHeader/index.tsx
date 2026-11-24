import { Link, NavLink, useMatch } from 'react-router-dom';
import { useWorkspaceSocket } from '../../app/providers/useWorkspaceSocket';
import type { WorkspaceDetail } from '../../types';
import ConnectionBanner from '../ConnectionBanner';
import { HomeIcon } from '../Header';
import NotificationBell from '../Notification/NotificationBell';
import ProfileMenu from '../ProfileMenu';
import '../Header/Header.css';
import './WorkspaceHeader.css';

// 그룹 상단바 (UI v0.4.3 06~17). 함께 찾기는 그룹 홈(06)으로 간다. 집보기는 미니게임(13~16)으로 가고,
// 실시간 집보기 시청(17)에서도 켜져 보인다. 오른쪽: 그룹 이름(누르면 그룹 설정) · 멤버 수 · 알림 · 프로필 메뉴.
// 그룹 연결(WorkspaceSocketProvider) 안에서 그려져야 한다 — 끊김 안내 띠가 그룹 연결 상태를 받는다.
export default function WorkspaceHeader({ workspace }: { workspace: WorkspaceDetail }) {
  const { connected } = useWorkspaceSocket();
  const onTour = useMatch('/workspaces/:workspaceId/tour/*') !== null;

  return (
    <>
      <header className="site-header">
        <nav className="site-header__nav">
          <NavLink
            to={`/workspaces/${workspace.id}/search`}
            className={({ isActive }) =>
              `site-header__nav-link${isActive ? ' is-active' : ''}`
            }
          >
            함께 찾기
          </NavLink>
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

        {/* 그룹 안에서는 로고도 그룹 홈(함께 찾기 · 왼쪽에 그룹 대화)으로 간다. 동네 찾기(/)는 그룹 밖 화면이다. */}
        <Link to={`/workspaces/${workspace.id}/search`} className="site-header__logo" title="함께 찾기로 가기">
          <HomeIcon />
          <span>zipfit</span>
        </Link>

        <div className="workspace-header__meta">
          <Link
            to={`/workspaces/${workspace.id}/settings`}
            className="workspace-header__name"
            title="그룹 설정"
          >
            {workspace.name}
          </Link>
          <span className="workspace-header__count">멤버 {workspace.memberCount}명</span>
          <NotificationBell />
          <ProfileMenu />
        </div>
      </header>
      <ConnectionBanner workspaceConnected={connected} />
    </>
  );
}
