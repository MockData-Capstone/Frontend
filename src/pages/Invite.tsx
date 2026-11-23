import { useEffect, useEffectEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Avatar from '../components/Avatar';
import Header from '../components/Header';
import PolicyFooter from '../components/PolicyFooter';
import { getErrorCode, getErrorMessage, getKakaoAuthorizeUrl } from '../lib/authApi';
import { clearPendingInvite, pendingInvite, rememberInvite } from '../lib/invite';
import { acceptInvitation, getInvitationPreview } from '../lib/workspaceApi';
import type { InvitationPreview } from '../types';
import './Group.css';

interface InviteError {
  title: string;
  text: string;
}

// 07-07 만료된 초대 / 07-08 사용할 수 없는 초대 (MEM-02). 만료·무효 링크는 410 INVITATION_EXPIRED, 없는 링크는 404
function inviteError(err: unknown, fallback: string): InviteError {
  const code = getErrorCode(err);
  if (code === 'INVITATION_EXPIRED') {
    return {
      title: '초대 링크가 만료됐어요',
      text: '초대한 사람에게 새 링크를 요청해 주세요. 기존 링크로는 그룹에 참여할 수 없어요.',
    };
  }
  if (code === 'NOT_FOUND' || code === 'INVITATION_NOT_FOUND' || code === 'WORKSPACE_NOT_FOUND') {
    return {
      title: '초대 링크를 사용할 수 없어요',
      text: '새 링크가 발급되었거나 유효하지 않은 링크예요. 초대한 사람에게 링크를 다시 확인해 주세요.',
    };
  }
  return { title: fallback, text: getErrorMessage(err, '잠시 후 다시 시도해 주세요.') };
}

export default function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  return <Invite key={token} token={token} />;
}

// 04 초대 링크 진입 (MEM-02, UI v0.4 §6). 초대 정보는 로그인 없이 보여주고, 로그인·가입을 마치고 돌아오면
// 바로 참여시켜 그 그룹으로 들어간다(UI명세 Q4). 이미 멤버면 그대로 들어간다.
function Invite({ token }: { token: string }) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const loggedIn = Boolean(accessToken);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<InviteError | null>(null);
  const [joining, setJoining] = useState(false);
  // 07-09 이미 참여한 그룹: 다시 가입하지 않고 그룹으로 보낸다
  const [alreadyIn, setAlreadyIn] = useState<number | null>(null);
  // 로그인하러 가기 전에 기억해 둔 링크로 돌아왔으면(메인 → 여기) 버튼 없이 바로 참여한다.
  const [resumeJoin] = useState(() => pendingInvite() === token);

  useEffect(() => {
    let cancelled = false;
    getInvitationPreview(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(inviteError(err, '초대 정보를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // 로그인 전이면 이 링크를 기억해 둔다. 상단바의 로그인·회원가입으로 가도 로그인 뒤 참여가 이어진다.
  useEffect(() => {
    if (preview && !loggedIn) rememberInvite(token);
  }, [preview, loggedIn, token]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const { workspaceId, alreadyMember } = await acceptInvitation(token);
      clearPendingInvite();
      if (alreadyMember) {
        setAlreadyIn(workspaceId);
        setJoining(false);
        return;
      }
      // 그룹 주소로 가면 그룹 홈(11)이 열린다.
      navigate(`/workspaces/${workspaceId}`, { replace: true });
    } catch (err) {
      clearPendingInvite();
      setError(inviteError(err, '그룹에 참여하지 못했어요.'));
      setJoining(false);
    }
  };

  const resume = useEffectEvent(() => {
    void join();
  });

  useEffect(() => {
    if (!loggedIn || !resumeJoin) return;
    // StrictMode가 effect를 두 번 돌려도 참여 요청이 한 번만 가도록 한 틱 미룬다.
    const timer = setTimeout(() => resume(), 0);
    return () => clearTimeout(timer);
  }, [loggedIn, resumeJoin]);

  const loginWithKakao = async () => {
    rememberInvite(token);
    try {
      window.location.href = await getKakaoAuthorizeUrl();
    } catch (err) {
      setError(inviteError(err, '카카오 로그인을 시작하지 못했어요.'));
    }
  };

  const loginWithEmail = () => {
    rememberInvite(token);
    navigate('/login');
  };

  const others = preview ? preview.memberCount - 1 : 0;

  return (
    <div className="page page--group">
      <Header />
      <main className="group-page">
        {!error && alreadyIn === null && (
          <div className="group-page__heading">
            <h1 className="group-page__title">친구가 집 찾기 그룹에 초대했어요</h1>
            <p className="group-page__subtitle">로그인하고 친구들과 함께 조건을 정해보세요.</p>
          </div>
        )}

        <section className="group-card group-card--narrow">
          {error ? (
            <>
              <p className="group-card__eyebrow">그룹 초대</p>
              <p className="group-card__name">{error.title}</p>
              <p className="group-card__desc">{error.text}</p>
              <Link to="/" className="button button--primary group-card__submit">
                지도 둘러보기
              </Link>
            </>
          ) : alreadyIn !== null ? (
            <>
              <p className="group-card__eyebrow">그룹 초대</p>
              <p className="group-card__name">이미 참여한 그룹이에요</p>
              <p className="group-card__desc">
                {preview?.workspaceName}
                <br />
                다시 가입하지 않고 바로 이어서 집을 찾아보세요.
              </p>
              <Link to={`/workspaces/${alreadyIn}`} className="button button--primary group-card__submit">
                그룹으로 이동
              </Link>
            </>
          ) : !preview ? (
            <p className="group-hint">불러오는 중...</p>
          ) : (
            <>
              <p className="group-card__eyebrow">초대받은 그룹</p>
              <h2 className="group-card__name">{preview.workspaceName}</h2>
              <p className="group-card__desc">함께 조건을 정하고 후보지를 비교하는 공간이에요.</p>
              {/* 흐름도 02: 멤버 아바타 + "외 N명". 초대 정보에는 멤버 목록이 없어 호스트 아바타만 그리고,
                  호스트 이름은 마우스를 올렸을 때와 화면 낭독기로 알려준다. */}
              <div className="group-members">
                <span
                  role="img"
                  aria-label={`호스트 ${preview.hostNickname}`}
                  title={`호스트 ${preview.hostNickname}`}
                >
                  <Avatar nickname={preview.hostNickname} profileImageUrl={null} />
                </span>
                {others > 0 && <span>외 {others}명</span>}
              </div>

              {loggedIn ? (
                <button
                  type="button"
                  className="button button--primary group-card__submit"
                  onClick={join}
                  disabled={joining}
                >
                  {joining ? '참여하는 중...' : '그룹 참여하기'}
                </button>
              ) : (
                // 시안(흐름도 02)에는 카카오 버튼만 있지만, 이메일로 가입한 회원도 바로 찾을 수 있게 보조 버튼을 둔다.
                <div className="group-login">
                  <button type="button" className="button button--primary" onClick={loginWithKakao}>
                    카카오로 로그인하고 참여하기
                  </button>
                  <button type="button" className="button button--secondary" onClick={loginWithEmail}>
                    이메일로 로그인하고 참여하기
                  </button>
                </div>
              )}
              <p className="group-note">초대 링크를 이용한 참여는 로그인 후 완료돼요.</p>
            </>
          )}
        </section>
      </main>
      <PolicyFooter />
    </div>
  );
}
