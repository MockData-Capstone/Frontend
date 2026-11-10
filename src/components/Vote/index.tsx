import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { getVotes, submitVote } from '../../lib/voteApi';
import { ErrorNotice, FeaturePage, WorkspaceLinks } from '../FeatureUI';

export default function Vote() {
  const { workspace } = useWorkspace();
  const result = useResource(useCallback(() => getVotes(workspace.id), [workspace.id]));
  const task = useTask();
  useWorkspaceMessages((message) => { if (message.type === 'VOTE_UPDATED' || message.type.startsWith('CANDIDATE_') || message.type.startsWith('MEMBER_')) void result.reload(); });
  useWorkspaceReconnect(() => { void result.reload(); });
  return <FeaturePage title="후보지 투표" description="각 후보지에 찬성 또는 반대하고, 언제든 내 의견을 바꿀 수 있어요."><WorkspaceLinks id={workspace.id} />
    <ErrorNotice message={result.error} retry={() => { void result.reload(); }} /><ErrorNotice message={task.error} retry={() => { void result.reload(); }} />
    {result.data?.length === 0 && <p>아직 후보지가 없어요. <Link to={`/workspaces/${workspace.id}/search`}>추천받기</Link></p>}
    <div className="feature-grid">{result.data?.map((row) => <section className="feature-card" key={row.candidateId}>
      <h2><Link to={`/workspaces/${workspace.id}/candidates/${row.candidateId}`}>{row.candidateName}</Link></h2><p>찬성 {row.agreeCount} · 반대 {row.disagreeCount}</p>
      <div className="feature-actions">{(['AGREE', 'DISAGREE'] as const).map((choice) => <button key={choice} className="button button--secondary" aria-pressed={row.myChoice === choice} disabled={task.busy || row.myChoice === choice} onClick={() => void task.run(() => submitVote(row.candidateId, choice, row.myChoice), async () => { await result.reload(); })}>{choice === 'AGREE' ? '찬성' : '반대'}</button>)}</div>
      {row.split && <p className="feature-muted">의견이 나뉘었어요. 대화로 이유를 나눠보세요.</p>}
      <ul className="feature-list">{row.votes.map((vote) => <li key={vote.userId}>{vote.nickname} · {vote.choice === 'AGREE' ? '찬성' : '반대'}</li>)}</ul>
    </section>)}</div></FeaturePage>;
}
