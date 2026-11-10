import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../app/providers/useWorkspaceSocket';
import { ErrorNotice, FeaturePage, WorkspaceLinks } from '../components/FeatureUI';
import { useResource } from '../hooks/useResource';
import { useTask } from '../hooks/useTask';
import { acceptSuggestion, emptyCondition, getConditions, getSuggestions, saveConditions, validateCondition } from '../lib/conditionApi';
import type { ConditionView, HouseCondition } from '../types/search';

export default function Conditions() {
  const { workspace } = useWorkspace();
  const result = useResource(useCallback(async () => ({ view: await getConditions(workspace.id), suggestions: await getSuggestions(workspace.id) }), [workspace.id]));
  const task = useTask();
  const [revision, setRevision] = useState(0);
  const [changed, setChanged] = useState(false);
  useWorkspaceMessages((message) => { if (['CONDITION_UPDATED', 'CONDITION_SUGGESTION_ACCEPTED', 'RECOMMENDATION_COMPLETED', 'CANDIDATE_ADDED', 'CANDIDATE_REMOVED'].includes(message.type)) setChanged(true); });
  useWorkspaceReconnect(() => setChanged(true));
  return <FeaturePage title="집 조건 확정" description="금액은 만원, 면적은 ㎡로 입력하세요. 비워 둔 항목은 제한하지 않아요."><WorkspaceLinks id={workspace.id} />
    <ErrorNotice message={result.error} retry={() => { void result.reload(); }} />
    {changed && <p className="feature-success">조건이나 추천 결과가 갱신됐어요. 입력을 유지하고 있으니, 최신 조건 불러오기로 확인해주세요.</p>}
    {result.data && <ConditionEditor key={revision} workspaceId={workspace.id} initial={result.data.view} onReload={async () => {
      const latest = await result.reload(); if (latest) { setRevision((value) => value + 1); setChanged(false); }
    }} />}
    <section className="feature-card"><h2>입지에 따른 조건 제안</h2><ErrorNotice message={task.error} />
      {result.data?.suggestions.length === 0 && <p>현재 후보지에서 제안할 조건이 없어요.</p>}
      <ul className="feature-list">{result.data?.suggestions.map((suggestion) => <li key={suggestion.type}><h3>{suggestion.message}</h3>
        {suggestion.evidence.map((evidence) => <p key={evidence.candidateId}><Link to={`/workspaces/${workspace.id}/candidates/${evidence.candidateId}`}>{evidence.candidateName}</Link> · {evidence.detail}</p>)}
        <button className="button button--secondary" disabled={task.busy || suggestion.accepted} onClick={() => void task.run(() => acceptSuggestion(workspace.id, suggestion.type), async () => { await result.reload(); setChanged(true); })}>{suggestion.accepted ? '수락한 제안' : '제안 수락'}</button>
      </li>)}</ul>
    </section></FeaturePage>;
}

function ConditionEditor({ workspaceId, initial, onReload }: { workspaceId: number; initial: ConditionView; onReload: () => Promise<void> }) {
  const values = initial.condition ?? initial.draft;
  const base = Object.fromEntries(Object.keys(emptyCondition).map((key) => [key, values?.[key as keyof HouseCondition] ?? null])) as unknown as HouseCondition;
  const [form, setForm] = useState<HouseCondition>(base);
  const [saved, setSaved] = useState<HouseCondition>(base);
  const [exists, setExists] = useState(Boolean(initial.condition));
  const [success, setSuccess] = useState(false);
  const task = useTask();
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const submit = (event: FormEvent) => {
    event.preventDefault(); const error = validateCondition(form); if (error) { task.setError(error); return; }
    void task.run(() => saveConditions(workspaceId, form, exists), () => { setExists(true); setSaved(form); setSuccess(true); });
  };
  return <section className="feature-card"><h2>{exists ? '확정한 조건 수정' : '조건 확정하기'}</h2>
    {initial.condition && <p className="feature-muted">마지막 수정: {initial.condition.lastModifiedBy.nickname}</p>}
    <ErrorNotice message={task.error} />{success && <p role="status" className="feature-success">조건을 저장했어요. <Link to={`/workspaces/${workspaceId}/listings`}>매물 찾기</Link></p>}
    <form className="feature-form" onSubmit={submit}>
      {([
        ['보증금 (만원)', 'depositMin', 'depositMax', 1000000, 1],
        ['월세 (만원)', 'monthlyRentMin', 'monthlyRentMax', 10000, 1],
        ['면적 (㎡)', 'areaMin', 'areaMax', 1000, 'any'],
      ] as const).map(([label, low, high, max, step]) => <fieldset key={low}><legend>{label}</legend><div className="feature-pair">{([low, high] as const).map((key, index) => <label key={key}>{index === 0 ? '최소' : '최대'}<input aria-label={`${label} ${index === 0 ? '최소' : '최대'}`} type="number" min={0} max={max} step={step} value={form[key] ?? ''} onChange={(event) => { setSuccess(false); setForm({ ...form, [key]: event.target.value === '' ? null : Number(event.target.value) }); }} /></label>)}</div></fieldset>)}
      <label>방 구조<select value={form.roomType ?? ''} onChange={(event) => { setSuccess(false); setForm({ ...form, roomType: (event.target.value || null) as HouseCondition['roomType'] }); }}><option value="">제한 없음</option><option value="ONE_ROOM">원룸</option><option value="TWO_ROOM">투룸</option><option value="THREE_ROOM_OR_MORE">쓰리룸 이상</option></select></label>
      {(['avoidSlope', 'needVehicleAccess'] as const).map((key) => <label key={key}>{key === 'avoidSlope' ? '오르막 회피' : '차량 진입 필요'}<select value={form[key] === null ? '' : String(form[key])} onChange={(event) => { setSuccess(false); setForm({ ...form, [key]: event.target.value === '' ? null : event.target.value === 'true' }); }}><option value="">미정</option><option value="true">예</option><option value="false">아니요</option></select></label>)}
      <div className="feature-actions"><button className="button button--primary" disabled={task.busy}>{task.busy ? '저장 중...' : exists ? '조건 수정 저장' : '조건 확정'}</button>
        <button type="button" className="button button--secondary" disabled={task.busy || dirty} onClick={() => { void onReload(); }}>최신 조건 불러오기</button></div>
      {dirty && <p className="feature-muted">저장하지 않은 변경이 있어요. 최신 조건을 불러오려면 먼저 저장하거나 <button type="button" className="button button--secondary" onClick={() => setForm(saved)}>입력 되돌리기</button>를 눌러주세요.</p>}
    </form></section>;
}
