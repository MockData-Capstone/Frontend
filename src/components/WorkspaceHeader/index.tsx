import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import type { WorkspaceDetail } from '../../types';
import Avatar from '../Avatar';
import { HomeIcon } from '../Header';
import '../Header/Header.css';
import './WorkspaceHeader.css';

// 헤더 C (UI v0.4 §3). 함께 찾기(11)는 화면이 아직 없어 비활성. 집보기는 미니게임(19~22)으로 간다.
export default function WorkspaceHeader({ workspace }: { workspace: WorkspaceDetail }) {
  const { me } = useAuth();

  return (
    <header className="site-header">
      <nav className="site-header__nav">
        <button
          type="button"
          className="site-header__nav-link workspace-header__tab-disabled"
          disabled
          title="준비 중인 화면이에요."
        >
          함께 찾기
        </button>
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
            `site-header__nav-link${isActive ? ' is-active' : ''}`
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
        {me && <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} />}
      </div>
    </header>
  );
}
