import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import './Header.css';

// 상단바: 동네 찾기 탭 / zipfit 로고 / 로그인·회원가입(또는 로그아웃)
// TODO(AUTH-04, MEM-03): 로그인 상태 우측을 "내 그룹" 선택 + 프로필 아바타로 교체 (지금은 로그아웃 버튼만)
export default function Header() {
  const { accessToken, signOut } = useAuth();

  return (
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
        <button type="button" className="site-header__signout" onClick={signOut}>
          로그아웃
        </button>
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
  );
}

function HomeIcon() {
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
