import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import ConnectionBanner from '../ConnectionBanner';
import NotificationBell from '../Notification/NotificationBell';
import ProfileMenu from '../ProfileMenu';
import './Header.css';

// 공개 상단바 (UI v0.4.3 01·04·12): 동네 찾기 탭 / zipfit 로고 / 로그인 · 회원가입
// 로그인 후에는 [내 그룹] · 알림 종 · 내 아이콘(프로필 메뉴: 내 정보 / 로그아웃).
// 상단바 바로 아래에 실시간 끊김 안내 띠(알림 연결이 3초 넘게 끊겼을 때)를 둔다.
export default function Header({ tab = 'explore' }: { tab?: 'explore' | 'groups' }) {
  const { accessToken } = useAuth();

  return (
    <>
      <header className="site-header">
        <nav className="site-header__nav">
          {tab === 'groups' ? (
            <NavLink
              to="/workspaces"
              end
              className={({ isActive }) => `site-header__nav-link${isActive ? ' is-active' : ''}`}
            >
              내 그룹
            </NavLink>
          ) : (
            <NavLink
              to="/"
              end
              className={({ isActive }) => `site-header__nav-link${isActive ? ' is-active' : ''}`}
            >
              동네 찾기
            </NavLink>
          )}
        </nav>

        <Link to="/" className="site-header__logo">
          <HomeIcon />
          <span>zipfit</span>
        </Link>

        {accessToken ? (
          <div className="site-header__member">
            {tab === 'groups' ? (
              <NavLink
                to="/account"
                className={({ isActive }) => `site-header__member-link${isActive ? ' is-active' : ''}`}
              >
                내 정보
              </NavLink>
            ) : (
              <NavLink
                to="/workspaces"
                className={({ isActive }) => `site-header__member-link${isActive ? ' is-active' : ''}`}
              >
                내 그룹
              </NavLink>
            )}
            <NotificationBell />
            <ProfileMenu />
          </div>
        ) : (
          <div className="site-header__auth">
            <NavLink
              to="/login"
              className={({ isActive }) => `site-header__auth-link${isActive ? ' is-active' : ''}`}
            >
              로그인
            </NavLink>
            <span className="site-header__auth-divider" aria-hidden="true">
              /
            </span>
            <NavLink
              to="/signup"
              className={({ isActive }) => `site-header__auth-link${isActive ? ' is-active' : ''}`}
            >
              회원가입
            </NavLink>
          </div>
        )}
      </header>
      <ConnectionBanner />
    </>
  );
}

export function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
