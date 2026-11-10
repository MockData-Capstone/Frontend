import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { useResource } from '../../hooks/useResource';
import { getCandidates } from '../../lib/candidateApi';
import { getListingLinks, safeExternalUrl } from '../../lib/listingApi';
import type { ListingCondition } from '../../types/search';
import { ErrorNotice, FeaturePage, WorkspaceLinks } from '../FeatureUI';

const labels: Record<ListingCondition, string> = { LOCATION: '위치', DEPOSIT: '보증금', MONTHLY_RENT: '월세', ROOM_TYPE: '방 구조', AREA: '면적' };
export default function Listing() {
  const { workspace } = useWorkspace();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(Number(params.get('candidateId')) || 0);
  const candidates = useResource(useCallback(() => getCandidates(workspace.id), [workspace.id]));
  useWorkspaceMessages((message) => { if (message.type.startsWith('CANDIDATE_')) void candidates.reload(); });
  useWorkspaceReconnect(() => { void candidates.reload(); });
  const candidateId = candidates.data?.some((item) => item.candidateId === selected) ? selected : candidates.data?.[0]?.candidateId;
  return <FeaturePage title="매물 찾기" description="확정한 조건과 후보지로 매물 사이트의 검색을 시작하세요."><WorkspaceLinks id={workspace.id} />
    <ErrorNotice message={candidates.error} retry={() => { void candidates.reload(); }} />
    <section className="feature-card"><label>검색할 후보지<select className="feature-select" value={candidateId ?? ''} onChange={(event) => setSelected(Number(event.target.value))}><option value="" disabled>후보지 선택</option>{candidates.data?.map((item) => <option key={item.candidateId} value={item.candidateId}>{item.name}</option>)}</select></label></section>
    {candidateId ? <ListingResult key={candidateId} workspaceId={workspace.id} candidateId={candidateId} /> : !candidates.loading && <p>추가된 후보지가 없어요. <Link to={`/workspaces/${workspace.id}/search`}>추천받기</Link></p>}
  </FeaturePage>;
}
function ListingResult({ workspaceId, candidateId }: { workspaceId: number; candidateId: number }) {
  const result = useResource(useCallback(() => getListingLinks(workspaceId, candidateId), [workspaceId, candidateId]));
  useWorkspaceMessages((message) => { if (message.type === 'CONDITION_UPDATED') void result.reload(); });
  useWorkspaceReconnect(() => { void result.reload(); });
  return <><ErrorNotice message={result.error} retry={() => { void result.reload(); }} />{result.error && <Link to={`/workspaces/${workspaceId}/conditions`}>집 조건 확인·확정하기</Link>}
    <div className="feature-grid">{result.data?.links.map((link) => {
      const url = safeExternalUrl(link.url);
      return <section key={link.site} className="feature-card"><h2>{link.siteName}</h2><p>반영된 조건: {link.appliedConditions.map((item) => labels[item]).join(', ') || '없음'}</p>
        {link.excludedConditions.length > 0 && <p>사이트에서 직접 설정해주세요: {link.excludedConditions.map((item) => labels[item]).join(', ')}</p>}
        {link.fallback && <p className="feature-muted">검색 링크 대신 사이트 홈으로 이동해요.</p>}
        {url ? <a className="button button--primary" href={url} target="_blank" rel="noopener noreferrer">{link.siteName}에서 찾기 ↗</a> : <p role="alert">현재 검색 링크를 열 수 없어요.</p>}
      </section>;
    })}</div></>;
}
