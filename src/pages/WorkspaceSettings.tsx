import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import { useWorkspace } from '../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../app/providers/useWorkspaceSocket';
import Dialog from '../components/Dialog';
import Avatar from '../components/Avatar';
import { ErrorNotice, FeaturePage } from '../components/FeatureUI';
import { useResource } from '../hooks/useResource';
import { useTask } from '../hooks/useTask';
import { getMembers } from '../lib/workspaceApi';
import { delegateHost, deleteWorkspace, kickMember, leaveWorkspace, updateWorkspace as saveWorkspace } from '../lib/workspaceSettingsApi';
import type { WorkspaceMember } from '../types';

type Action = { type: 'delete' | 'leave' } | { type: 'kick' | 'delegate'; member: WorkspaceMember };
export default function WorkspaceSettings() {
  const { workspace, updateWorkspace } = useWorkspace();
  const { me } = useAuth();
  const navigate = useNavigate();
  const members = useResource(useCallback(() => getMembers(workspace.id), [workspace.id]));
  const task = useTask();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const isHost = workspace.myRole === 'HOST';
  useWorkspaceMessages((message) => { if (message.type.startsWith('MEMBER_') || message.type === 'HOST_CHANGED') void members.reload(); });
  useWorkspaceReconnect(() => { void members.reload(); });
  const ask = (action: Action) => { task.setError(null); setConfirmation(''); setPending(action); };
  const confirm = () => {
    if (!pending) return;
    void task.run(async () => {
      switch (pending.type) {
        case 'delete': await deleteWorkspace(workspace.id); navigate('/workspaces', { replace: true }); return;
        case 'leave': await leaveWorkspace(workspace.id); navigate('/workspaces', { replace: true }); return;
        case 'delegate': updateWorkspace(await delegateHost(workspace.id, pending.member.userId)); break;
        case 'kick': await kickMember(workspace.id, pending.member.userId); break;
      }
      setPending(null); await members.reload(); setNotice('그룹 설정을 변경했어요.');
    });
  };
  const title = pending?.type === 'delete' ? '그룹 삭제' : pending?.type === 'leave' ? '그룹 나가기' : pending?.type === 'kick' ? `${pending.member.nickname} 님 내보내기` : pending?.type === 'delegate' ? `${pending.member.nickname} 님에게 호스트 위임` : '';
  const warning = pending?.type === 'delete' ? `모든 대화, 후보지와 그룹 기록이 삭제됩니다. 확인하려면 그룹 이름 '${workspace.name}'을 입력해주세요.` : pending?.type === 'kick' ? '이 멤버는 그룹에 접근할 수 없으며 기존 초대 링크도 모두 무효가 됩니다.' : pending?.type === 'delegate' ? '이후 그룹 수정·삭제와 멤버 관리는 새 호스트가 담당합니다.' : '그룹에서 나가면 후보지·대화에 접근할 수 없고 내 투표가 집계에서 제외됩니다.';
  return <FeaturePage title="그룹 설정" description="그룹 정보와 참여 멤버를 관리하세요.">
    <div className="feature-links"><Link to={`/workspaces/${workspace.id}/search`}>함께 찾기로</Link><Link to={`/workspaces/${workspace.id}/invite`}>친구 초대</Link><Link to="/workspaces">내 그룹</Link></div>
    <ErrorNotice message={task.error} />{notice && <p role="status" className="feature-success">{notice}</p>}
    <section className="feature-card"><h2>그룹 정보</h2>{!isHost && <p>그룹 정보는 호스트만 수정할 수 있어요.</p>}
      <form className="feature-form" onSubmit={(event) => { event.preventDefault(); void task.run(() => saveWorkspace(workspace.id, { name: name.trim(), description: description.trim() }), (value) => { updateWorkspace(value); setNotice('그룹 정보를 저장했어요.'); }); }}>
        <label>그룹 이름<input required maxLength={30} value={name} disabled={!isHost || task.busy} onChange={(event) => setName(event.target.value)} /></label>
        <label>소개<textarea maxLength={200} value={description} disabled={!isHost || task.busy} onChange={(event) => setDescription(event.target.value)} /></label>
        {isHost && <button className="button button--primary" disabled={task.busy || !name.trim()}>그룹 정보 저장</button>}
      </form></section>
    <section className="feature-card"><h2>멤버 {members.data?.length ?? workspace.memberCount}명</h2><ErrorNotice message={members.error} retry={() => { void members.reload(); }} />
      <ul className="feature-list">{members.data?.map((member) => <li key={member.userId}><div className="feature-actions"><Avatar nickname={member.nickname} profileImageUrl={member.profileImageUrl} /><strong>{member.nickname}{member.userId === me?.id ? ' · 나' : ''}</strong><span className="feature-badge">{member.role === 'HOST' ? '호스트' : '멤버'}</span><span className="feature-muted">{member.online ? '접속 중' : '오프라인'}</span>
        {isHost && member.role !== 'HOST' && <><button className="button button--secondary" disabled={task.busy} onClick={() => ask({ type: 'delegate', member })}>호스트 위임</button><button className="button button--danger" disabled={task.busy} onClick={() => ask({ type: 'kick', member })}>내보내기</button></>}
      </div></li>)}</ul>
    </section><section className="feature-card"><h2>{isHost ? '그룹 삭제' : '그룹 나가기'}</h2>
      {isHost ? <><p>그룹을 유지하고 나가려면 먼저 다른 멤버에게 호스트를 위임해주세요.</p><button className="button button--danger" disabled={task.busy} onClick={() => ask({ type: 'delete' })}>그룹 삭제</button></> : <button className="button button--danger" disabled={task.busy} onClick={() => ask({ type: 'leave' })}>그룹 나가기</button>}
    </section>
    <Dialog open={Boolean(pending)} title={title} description={warning} confirmLabel="확인" tone="danger" busy={task.busy} confirmDisabled={pending?.type === 'delete' && confirmation !== workspace.name} onClose={() => setPending(null)} onConfirm={confirm}>
      {pending?.type === 'delete' && <label className="feature-form">그룹 이름 확인<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}<ErrorNotice message={task.error} />
    </Dialog>
  </FeaturePage>;
}
