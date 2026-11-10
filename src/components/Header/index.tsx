import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useToast } from '../Toast/useToast';
import Avatar from '../Avatar';
import ConnectionBanner from '../ConnectionBanner';
import NotificationBell from '../Notification/NotificationBell';
import './Header.css';

// 상단바: 동네 찾기 탭 / zipfit 로고 / 로그인·회원가입(로그인 후에는 내 그룹·알림 종·아바타)
// 상단바 바로 아래에 실시간 끊김 안내 띠(알림 연결이 3초 넘게 끊겼을 때)를 둔다.
// TODO(AUTH-04): 내 정보(13) 화면이 생기면 아바타를 그 화면 링크로 바꾸고 로그아웃 버튼을 그쪽으로 옮긴다.
export default function Header() {
  const { accessToken, me, signOut } = useAuth();
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      showToast('로그아웃하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <nav className="site-header__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `site-header__nav-link${isActive ? ' is-active' : ''}`
            }
          >
            동네 찾기
          </NavLink>
        </nav>

        <Link to="/" className="site-header__logo">
          <HomeIcon />
          <span>zipfit</span>
        </Link>

        {accessToken ? (
          <div className="site-header__member">
            <NavLink
              to="/workspaces"
              className={({ isActive }) =>
                `site-header__member-link${isActive ? ' is-active' : ''}`
              }
            >
              내 그룹
            </NavLink>
            <NotificationBell />
            {me && <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} />}
            <button type="button" className="site-header__signout" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        ) : (
          <div className="site-header__auth">
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `site-header__auth-link${isActive ? ' is-active' : ''}`
              }
            >
              로그인
            </NavLink>
            <span className="site-header__auth-divider" aria-hidden="true" />
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                `site-header__auth-link${isActive ? ' is-active' : ''}`
              }
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
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
