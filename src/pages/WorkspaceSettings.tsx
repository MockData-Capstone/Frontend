import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import { useWorkspace } from '../app/providers/useWorkspace';
import { useWorkspaceMessages } from '../app/providers/useWorkspaceSocket';
import Avatar from '../components/Avatar';
import Dialog from '../components/Dialog';
import { useToast } from '../components/Toast/useToast';
import { getErrorMessage } from '../lib/authApi';
import { inviteLink } from '../lib/invite';
import { getCurrentInvitation, getMembers, issueInvitation } from '../lib/workspaceApi';
import { delegateHost, deleteWorkspace, kickMember, leaveWorkspace, updateWorkspace } from '../lib/workspaceSettingsApi';
import type { Invitation, WorkspaceMember } from '../types';
import './WorkspaceSettings.css';

const MEMBER_EVENTS = new Set(['MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_KICKED', 'HOST_CHANGED', 'MEMBER_ONLINE', 'MEMBER_OFFLINE']);

type Pending =
  | { kind: 'delegate' | 'kick'; member: WorkspaceMember }
  | { kind: 'leave' | 'delete' };

// 11 Workspace 설정 · 멤버 (UI v0.4.3, WS-03·04, MEM-01·03~06)
// 왼쪽: 그룹 정보 수정 / 초대·권한(초대 링크 관리, 호스트 위임) / 그룹 나가기·삭제
// 오른쪽: 멤버 목록 — 호스트는 멤버마다 [호스트 넘기기]·[내보내기]
export default function WorkspaceSettings() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isHost = workspace.myRole === 'HOST';
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  const [saving, setSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null | undefined>(undefined);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const membersRef = useRef<HTMLElement>(null);

  const loadMembers = useCallback(() => {
    getMembers(workspace.id)
      .then((list) => {
        setMembers(list);
        setMembersError(null);
      })
      .catch((err) => setMembersError(getErrorMessage(err, '멤버를 불러오지 못했어요.')));
  }, [workspace.id]);

  useEffect(loadMembers, [loadMembers]);

  useWorkspaceMessages((message) => {
    if (MEMBER_EVENTS.has(message.type)) loadMembers();
  });

  const nameTrimmed = name.trim();
  const infoChanged = nameTrimmed !== workspace.name || description.trim() !== (workspace.description ?? '');

  const saveInfo = async (event: FormEvent) => {
    event.preventDefault();
    if (!nameTrimmed || nameTrimmed.length > 30) {
      setInfoError('그룹 이름은 1~30자로 입력해주세요.');
      return;
    }
    if (description.trim().length > 200) {
      setInfoError('그룹 소개는 200자 이내로 입력해주세요.');
      return;
    }
    setSaving(true);
    setInfoError(null);
    try {
      await updateWorkspace(workspace.id, { name: nameTrimmed, description: description.trim() });
      showToast('그룹 정보를 저장했어요.');
    } catch (err) {
      setInfoError(getErrorMessage(err, '그룹 정보를 저장하지 못했어요.'));
    } finally {
      setSaving(false);
    }
  };

  const openInvite = async () => {
    setInviteOpen((open) => !open);
    if (invitation !== undefined) return;
    try {
      setInvitation(await getCurrentInvitation(workspace.id));
    } catch (err) {
      setInviteError(getErrorMessage(err, '초대 링크를 불러오지 못했어요.'));
    }
  };

  const issue = async () => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      setInvitation(await issueInvitation(workspace.id));
      showToast('새 초대 링크를 만들었어요. 이전 링크는 더 쓸 수 없어요.');
    } catch (err) {
      setInviteError(getErrorMessage(err, '초대 링크를 만들지 못했어요.'));
    } finally {
      setInviteBusy(false);
    }
  };

  const copy = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(inviteLink(invitation.token));
      showToast('초대 링크를 복사했어요.');
    } catch {
      setInviteError('복사하지 못했어요. 링크를 직접 선택해 복사해주세요.');
    }
  };

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      switch (pending.kind) {
        case 'delegate':
          await delegateHost(workspace.id, pending.member.userId);
          showToast(`${pending.member.nickname}님에게 호스트를 넘겼어요.`);
          break;
        case 'kick':
          await kickMember(workspace.id, pending.member.userId);
          showToast(`${pending.member.nickname}님을 내보냈어요.`);
          break;
        case 'leave':
          await leaveWorkspace(workspace.id);
          navigate('/workspaces', { replace: true });
          return;
        case 'delete':
          await deleteWorkspace(workspace.id);
          navigate('/workspaces', { replace: true });
          return;
      }
      setPending(null);
      loadMembers();
    } catch (err) {
      setPending(null);
      setActionError(getErrorMessage(err, '처리하지 못했어요. 잠시 후 다시 시도해주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const dialog = pending && dialogText(pending, workspace.name);

  return (
    <div className="settings-page">
      <div className="page-head">
        <h1 className="page-head__title">그룹 설정</h1>
        <p className="page-head__desc">그룹 정보와 초대 링크, 멤버를 관리하세요.</p>
      </div>

      {actionError && (
        <p className="settings-page__error" role="alert">
          {actionError}
        </p>
      )}

      <div className="settings-page__grid">
        <section className="card settings-card" aria-label="그룹 정보">
          <form onSubmit={saveInfo} noValidate>
            <h2 className="card__title">그룹 정보</h2>
            <label className="field settings-card__field">
              <span className="field__label">그룹 이름</span>
              <input
                className="field__input"
                value={name}
                maxLength={30}
                onChange={(event) => setName(event.target.value)}
                disabled={!isHost}
              />
            </label>
            <label className="field settings-card__field">
              <span className="field__label">그룹 소개</span>
              <input
                className="field__input"
                value={description}
                maxLength={200}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!isHost}
              />
            </label>
            {infoError && (
              <p className="field__error" role="alert">
                {infoError}
              </p>
            )}
            {isHost ? (
              <button
                type="submit"
                className="button button--primary button--lg button--block"
                disabled={saving || !infoChanged}
              >
                {saving ? '저장 중…' : '그룹 정보 저장'}
              </button>
            ) : (
              <p className="field__hint">그룹 정보는 호스트만 바꿀 수 있어요.</p>
            )}
          </form>

          <hr className="settings-card__divider" />
          <h2 className="card__subtitle">초대 · 권한</h2>
          <div className="settings-card__stack">
            <button type="button" className="button button--outline button--block" aria-expanded={inviteOpen} onClick={() => void openInvite()}>
              초대 링크 관리
            </button>
            {inviteOpen && (
              <div className="settings-card__invite">
                {invitation === undefined && !inviteError && <p className="field__hint">불러오는 중…</p>}
                {invitation === null && <p className="field__hint">사용할 수 있는 초대 링크가 없어요. 새로 만들어주세요.</p>}
                {invitation && (
                  <>
                    <input className="field__input" readOnly value={inviteLink(invitation.token)} aria-label="초대 링크" onFocus={(e) => e.target.select()} />
                    <p className="field__hint">만료: {new Date(invitation.expiresAt).toLocaleString('ko-KR')}</p>
                  </>
                )}
                {inviteError && (
                  <p className="field__error" role="alert">
                    {inviteError}
                  </p>
                )}
                <div className="settings-card__row">
                  <button type="button" className="button button--secondary" onClick={() => void copy()} disabled={!invitation}>
                    초대 링크 복사
                  </button>
                  <button type="button" className="button button--secondary" onClick={() => void issue()} disabled={inviteBusy}>
                    {inviteBusy ? '만드는 중…' : '새 링크 발급'}
                  </button>
                </div>
              </div>
            )}
            {isHost && (
              <button
                type="button"
                className="button button--outline button--block"
                onClick={() => membersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                호스트 위임
              </button>
            )}
          </div>

          <hr className="settings-card__divider" />
          <h2 className="card__subtitle">그룹 나가기 · 삭제</h2>
          {isHost ? (
            <>
              <p className="settings-card__desc">호스트는 권한을 넘긴 후 그룹에서 나갈 수 있어요.</p>
              <button
                type="button"
                className="button button--outline-danger button--block"
                onClick={() => setPending({ kind: 'delete' })}
              >
                그룹 삭제
              </button>
            </>
          ) : (
            <>
              <p className="settings-card__desc">나가면 이 그룹의 대화와 후보지를 볼 수 없어요.</p>
              <button
                type="button"
                className="button button--outline-danger button--block"
                onClick={() => setPending({ kind: 'leave' })}
              >
                그룹 나가기
              </button>
            </>
          )}
        </section>

        <section ref={membersRef} className="card settings-card" aria-labelledby="members-title">
          <h2 id="members-title" className="card__title">
            멤버 {members?.length ?? workspace.memberCount}명
          </h2>
          {membersError && (
            <p className="field__error" role="alert">
              {membersError}
            </p>
          )}
          {members === null && !membersError && <p className="field__hint">불러오는 중…</p>}
          <ul className="member-list">
            {members?.map((member) => {
              const self = member.userId === me?.id;
              return (
                <li key={member.userId} className="member-list__item">
                  <Avatar nickname={member.nickname} profileImageUrl={member.profileImageUrl} />
                  <div className="member-list__who">
                    <span className="member-list__name">
                      {member.nickname}
                      {self && <span className="member-list__me"> (나)</span>}
                    </span>
                    <span className="member-list__state">{member.online === false ? '오프라인' : '접속 중'}</span>
                  </div>
                  {member.role === 'HOST' ? (
                    <span className="member-list__role member-list__role--host">호스트</span>
                  ) : (
                    <>
                      <span className="member-list__role">멤버</span>
                      {isHost && (
                        <>
                          <button
                            type="button"
                            className="button button--outline button--sm"
                            onClick={() => setPending({ kind: 'delegate', member })}
                          >
                            호스트 넘기기
                          </button>
                          <button
                            type="button"
                            className="member-list__kick"
                            onClick={() => setPending({ kind: 'kick', member })}
                          >
                            내보내기
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {dialog && (
        <Dialog
          open
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirm}
          busyLabel="처리하는 중"
          tone={dialog.danger ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={() => void runPending()}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

function dialogText(pending: Pending, groupName: string) {
  switch (pending.kind) {
    case 'delegate':
      return {
        title: `${pending.member.nickname}님에게 호스트를 넘길까요?`,
        description: '넘기면 나는 멤버가 되고, 그룹 정보 수정·멤버 내보내기는 새 호스트만 할 수 있어요.',
        confirm: '호스트 넘기기',
        danger: false,
      };
    case 'kick':
      return {
        title: `${pending.member.nickname}님을 내보낼까요?`,
        description: '내보낸 멤버는 초대 링크로 다시 들어올 수 있어요.',
        confirm: '내보내기',
        danger: true,
      };
    case 'leave':
      return {
        title: `'${groupName}'에서 나갈까요?`,
        description: '나가면 이 그룹의 대화·후보지·투표를 볼 수 없어요.',
        confirm: '그룹 나가기',
        danger: true,
      };
    case 'delete':
      return {
        title: `'${groupName}'을(를) 삭제할까요?`,
        description: '그룹의 대화·후보지·투표가 모두 지워지고 되돌릴 수 없어요. 모든 멤버가 그룹에서 나가게 돼요.',
        confirm: '그룹 삭제',
        danger: true,
      };
  }
}
