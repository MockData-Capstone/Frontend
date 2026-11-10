import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../app/providers/useWorkspaceSocket';
import Chat from '../components/Chat';
import { ErrorNotice, FeaturePage, WorkspaceLinks } from '../components/FeatureUI';
import { useResource } from '../hooks/useResource';
import { useTask } from '../hooks/useTask';
import { getRecommendations, refreshesRecommendations, requestRecommendations } from '../lib/recommendationApi';
import { addCandidate } from '../lib/candidateApi';

export default function WorkspaceSearch() {
  const { workspace } = useWorkspace();
  const result = useResource(useCallback(() => getRecommendations(workspace.id), [workspace.id]));
  const task = useTask();
  const working = result.data?.analysis?.status === 'IN_PROGRESS';
  const { reload } = result;
  useWorkspaceMessages((message) => {
    if (refreshesRecommendations(message.type)) void reload();
  });
  useWorkspaceReconnect(() => { void reload(); });
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => { void reload(); }, 5000);
    return () => clearInterval(timer);
  }, [working, reload]);

  return <FeaturePage title="함께 찾기" description="대화를 바탕으로 동네를 추천받고 마음에 드는 곳을 후보지에 모으세요.">
    <WorkspaceLinks id={workspace.id} />
    <div className="feature-grid"><Chat /><section className="feature-card">
      <h2>추천 위치</h2><p className="feature-muted">추천과 입지 정보는 참고 자료예요. 실제 현장과 매물 정보를 함께 확인해주세요.</p>
      <button className="button button--primary" disabled={task.busy || working || result.loading} onClick={() => void task.run(() => requestRecommendations(workspace.id), async (analysis) => {
        result.setData((current) => ({ analysis, items: current?.items ?? [] }));
        await reload();
      })}>{working ? '대화를 분석하고 있어요...' : '대화로 위치 추천받기'}</button>
      <ErrorNotice message={result.error} retry={() => { void reload(); }} /><ErrorNotice message={task.error} />
      {result.data?.analysis?.status === 'FAILED' && <ErrorNotice message={result.data.analysis.failureMessage ?? '분석하지 못했어요. 대화를 보충하고 다시 시도해주세요.'} />}
      {result.data?.analysis?.conditions && <div className="feature-success"><strong>대화에서 찾은 조건</strong><p>{result.data.analysis.conditions.region ?? '지역 미정'} · 목적지: {result.data.analysis.conditions.destinations.join(', ') || '미정'}</p><Link to={`/workspaces/${workspace.id}/conditions`}>조건 확인·수정하기</Link></div>}
      {!working && result.data?.items.length === 0 && <p className="feature-muted">아직 추천 위치가 없어요. 대화를 남기고 분석을 요청해주세요.</p>}
      <ul className="feature-list">{result.data?.items.map((item) => <li key={item.recommendationId}><h3>{item.placeName}</h3><p>{item.reason}</p>
        {item.latitude === null && <p className="feature-muted">좌표 정보가 없어 후보지에 추가할 수 없어요.</p>}
        {item.candidateId ? <Link to={`/workspaces/${workspace.id}/candidates/${item.candidateId}`}>추가한 후보지 보기</Link> :
          <button className="button button--secondary" disabled={task.busy || item.latitude === null || item.longitude === null || item.addedAsCandidate} onClick={() => void task.run(() => addCandidate(workspace.id, item.recommendationId), async () => { await reload(); })}>후보지에 추가</button>}
      </li>)}</ul>
    </section></div>
  </FeaturePage>;
}
