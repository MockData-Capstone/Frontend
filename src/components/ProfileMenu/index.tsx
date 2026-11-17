import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import Avatar from '../Avatar';
import { useToast } from '../Toast/useToast';
import './ProfileMenu.css';

// 07-01 프로필 메뉴: 상단 오른쪽 내 아이콘 → [내 정보] / [로그아웃] (UI v0.4.3, AUTH-04)
export default function ProfileMenu() {
  const { me, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [openPath, setOpenPath] = useState(pathname);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 다른 화면으로 가면 닫는다
  if (openPath !== pathname) {
    setOpenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!me) return null;

  async function handleSignOut() {
    setSigningOut(true);
    // 흐름도 07 "프로필 메뉴 → 로그아웃 → 공개 지도": 로그인이 필요한 화면에서 먼저 나와야
    // 로그인 보호(RequireAuth)가 로그인 화면으로 보내지 않는다.
    navigate('/', { replace: true });
    try {
      await signOut();
    } catch {
      showToast('로그아웃하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div ref={rootRef} className="profile-menu">
      <button
        type="button"
        className="profile-menu__button"
        aria-label="내 계정 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} />
      </button>
      {open && (
        <div className="profile-menu__panel" role="menu" aria-label="내 계정">
          <p className="profile-menu__title">내 계정</p>
          <button type="button" role="menuitem" className="profile-menu__item" onClick={() => navigate('/account')}>
            내 정보
          </button>
          <button
            type="button"
            role="menuitem"
            className="profile-menu__item"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
          >
            {signingOut ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      )}
    </div>
  );
}
