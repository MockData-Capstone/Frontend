import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { getComparison, regenerateComparison } from '../../lib/comparisonApi';
import { slopeSummary, vehicleSummary } from '../../pages/candidates/format';
import { ErrorNotice, FeaturePage, WorkspaceLinks } from '../FeatureUI';

export default function Comparison() {
  const { workspace } = useWorkspace();
  const result = useResource(useCallback(() => getComparison(workspace.id), [workspace.id]));
  const [selected, setSelected] = useState<number[] | null>(null);
  const task = useTask();
  useWorkspaceMessages((message) => { if (message.type.startsWith('CANDIDATE_') || message.type === 'VOTE_UPDATED') void result.reload(); });
  useWorkspaceReconnect(() => { void result.reload(); });
  const ids = selected ?? result.data?.items.map((row) => row.candidateId) ?? [];
  const rows = result.data?.items.filter((row) => ids.includes(row.candidateId)) ?? [];
  return <FeaturePage title="후보지 비교" description="입지 정보와 멤버의 의견을 한눈에 비교하세요."><WorkspaceLinks id={workspace.id} />
    <ErrorNotice message={result.error} retry={() => { void result.reload(); }} /><ErrorNotice message={task.error} />
    <section className="feature-card"><div className="feature-actions">
      {result.data?.items.map((row) => <label className="feature-check" key={row.candidateId}><input type="checkbox" checked={ids.includes(row.candidateId)} onChange={(event) => setSelected(event.target.checked ? [...ids, row.candidateId] : ids.filter((id) => id !== row.candidateId))} />{row.name}</label>)}
      <button className="button button--secondary" disabled={task.busy || ids.length === 0} onClick={() => void task.run(() => regenerateComparison(workspace.id, ids), async () => { await result.reload(); })}>최신 정보로 갱신</button></div>
      {rows.length === 0 ? <p className="feature-muted">비교할 후보지를 선택해주세요. 후보지가 없다면 먼저 추천 결과에서 추가해주세요.</p> : <div className="feature-table-wrap"><table className="feature-table"><caption>선택한 후보지의 경사·차량 진입·투표</caption><thead><tr><th>후보지</th><th>경사</th><th>차량 진입</th><th>투표</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.candidateId}><th scope="row"><Link to={`/workspaces/${workspace.id}/candidates/${row.candidateId}`}>{row.name}</Link></th><td>{slopeSummary(row.slope)}{row.slope?.estimated && <small> · 추정치</small>}</td><td>{vehicleSummary(row.vehicleAccess)}{row.vehicleAccess?.estimated && <small> · 추정치</small>}</td><td>찬성 {row.votes.agreeCount} / 반대 {row.votes.disagreeCount}{row.votes.split && <p>의견이 나뉘었어요.</p>}</td></tr>)}
      </tbody></table></div>}
    </section></FeaturePage>;
}
