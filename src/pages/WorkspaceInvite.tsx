import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import { getErrorMessage } from '../lib/authApi';
import { inviteLink } from '../lib/invite';
import { parseInstant } from '../lib/time';
import { getCurrentInvitation, getWorkspace, issueInvitation } from '../lib/workspaceApi';
import type { Invitation, WorkspaceDetail } from '../types';
import './Group.css';

const expiryLabel = (expiresAt: string) =>
  new Date(parseInstant(expiresAt)).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function WorkspaceInvitePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <WorkspaceInvite key={workspaceId} workspaceId={Number(workspaceId)} />;
}

// 10 그룹 생성 완료·친구 초대 (MEM-01, UI v0.4 §6). 백엔드에 짧은 초대 코드가 없어 시안의 "초대 코드" 칸은 빼고
// 초대 링크만 보여준다. 링크는 들어올 때 지금 링크를 받고, 없으면 새로 만든다(호스트만, 7일 뒤 만료).
function WorkspaceInvite({ workspaceId }: { workspaceId: number }) {
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // StrictMode가 effect를 두 번 돌려도 링크를 두 번 만들지 않게 한 틱 미룬다 — 새로 만들면 이전 링크가 무효가 된다.
    const timer = setTimeout(async () => {
      try {
        const detail = await getWorkspace(workspaceId);
        if (cancelled) return;
        setWorkspace(detail);
        if (detail.myRole !== 'HOST') return;
        const current = (await getCurrentInvitation(workspaceId)) ?? (await issueInvitation(workspaceId));
        if (!cancelled) setInvitation(current);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, '초대 링크를 불러오지 못했어요.'));
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspaceId]);

  const link = invitation ? inviteLink(invitation.token) : '';

  const copy = async () => {
    setNotice(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드는 HTTPS·localhost에서만 쓸 수 있다. 그 밖에서는 링크를 골라 두고 직접 복사하게 한다.
      linkRef.current?.select();
      setNotice('링크를 선택해 두었어요. 직접 복사해 주세요.');
    }
  };

  const reissue = async () => {
    if (!window.confirm('새 링크를 만들면 이전 링크로는 더 이상 참여할 수 없어요. 새로 만들까요?')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setCopied(false);
    try {
      setInvitation(await issueInvitation(workspaceId));
      setNotice('새 링크를 만들었어요. 이전 링크는 더 이상 쓸 수 없어요.');
    } catch (err) {
      setError(getErrorMessage(err, '새 링크를 만들지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page--group">
      <Header />
      <main className="group-page">
        <div className="group-page__heading">
          <h1 className="group-page__title">그룹을 만들었어요</h1>
          <p className="group-page__subtitle">초대 링크를 보내 친구들을 초대하세요.</p>
        </div>

        <section className="group-card">
          {!workspace ? (
            error ? (
              <>
                <p className="group-error">{error}</p>
                <Link to="/workspaces" className="button button--secondary group-card__submit">
                  내 그룹으로
                </Link>
              </>
            ) : (
              <p className="group-hint">불러오는 중...</p>
            )
          ) : (
            <>
              <h2 className="group-card__name">{workspace.name}</h2>

              {workspace.myRole === 'HOST' ? (
                <>
                  <label className="group-field">
                    <span className="group-field__label">초대 링크</span>
                    <input
                      ref={linkRef}
                      className="group-field__input"
                      value={link || '초대 링크를 만드는 중...'}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <div className="group-actions">
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={copy}
                      disabled={!invitation || busy}
                    >
                      {copied ? '복사했어요' : '초대 링크 복사'}
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={reissue}
                      disabled={!invitation || busy}
                    >
                      새 링크 발급
                    </button>
                  </div>
                  {notice && <p className="group-notice">{notice}</p>}
                  {error && <p className="group-error">{error}</p>}
                  <p className="group-info">
                    링크를 받은 친구는 로그인 후 그룹에 참여할 수 있어요.
                    {invitation && ` 링크는 ${expiryLabel(invitation.expiresAt)}까지 쓸 수 있어요.`}
                  </p>
                </>
              ) : (
                <p className="group-info">초대 링크는 그룹 호스트만 만들 수 있어요.</p>
              )}

              {/* 그룹 홈(11)이 아직 없어 들어가면 후보지 목록으로 간다 (WorkspaceIndexRedirect) */}
              <Link
                to={`/workspaces/${workspace.id}`}
                className="button button--primary group-card__submit"
              >
                그룹으로 들어가기
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
