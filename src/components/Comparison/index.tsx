import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import { getComparison } from '../../lib/comparisonApi';
import { useRoadviewAccess } from '../../hooks/useRoadviewAccess';
import { vehicleVerdict, vehicleVerdictSummary, type RoadviewState } from '../../lib/roadview';
import { badgeLetter, formatPercent, gradeLabel } from '../../pages/candidates/format';
import type { ComparisonResult, ComparisonRow } from '../../types/search';
import LoadState from '../LoadState';
import './Comparison.css';

type Row = { label: string; value: (item: ComparisonRow, roadview: RoadviewState) => string; strong?: boolean };

const ROWS: Row[] = [
  {
    label: '평균 경사',
    strong: true,
    value: (i) => (i.slope?.averagePercent != null ? formatPercent(i.slope.averagePercent) : '정보 없음'),
  },
  {
    label: '최대 경사',
    strong: true,
    value: (i) =>
      i.slope?.maxPercent != null
        ? `${formatPercent(i.slope.maxPercent)}${i.slope.grade ? ` · ${gradeLabel(i.slope.grade)}` : ''}`
        : '정보 없음',
  },
  {
    label: '차량 진입',
    // 1차 로드뷰 유무 + 2차 VLM(불법 주정차) 판정
    value: (i, roadview) =>
      vehicleVerdictSummary(vehicleVerdict(i.vehicleAccess, roadview), roadview).replace('차량 진입 ', ''),
  },
  { label: '경사 기준 목적지', value: (i) => i.slope?.destination ?? '—' },
  { label: '투표', value: (i) => `찬성 ${i.votes.agreeCount} · 반대 ${i.votes.disagreeCount}` },
];

// 09 후보지 비교 모달 (UI v0.4.3, CMP-01). 경사·차량 진입·목적지·투표를 열로 비교한다.
// 열 제목을 누르면 그 후보지를 선택(강조)한다. 투표·입지 분석이 바뀌면 다시 불러온다.
export default function ComparisonModal({ onClose }: { onClose: () => void }) {
  const { workspace } = useWorkspace();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const roadviewStates = useRoadviewAccess(
    (result?.items ?? []).map((i) => ({ id: i.candidateId, latitude: i.latitude, longitude: i.longitude })),
  );
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const load = () =>
    getComparison(workspace.id)
      .then((data) => {
        setResult(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, '비교표를 불러오지 못했어요.')));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  useWorkspaceMessages((message) => {
    if (['VOTE_UPDATED', 'CANDIDATE_ADDED', 'CANDIDATE_UPDATED', 'CANDIDATE_REMOVED'].includes(message.type)) void load();
  });

  useEffect(() => {
    const panel = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.showModal();
    return () => {
      panel?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const items = result?.items ?? [];
  const chosen = selected ?? items[0]?.candidateId ?? null;

  return createPortal(
    <dialog
      ref={dialog}
      className="compare-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="compare-modal__heading">
        <h2 id={titleId}>후보지 비교</h2>
        <button type="button" className="compare-modal__close" aria-label="비교 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="compare-modal__description">후보 동네의 경사·차량 진입·목적지·투표 결과를 비교해요.</p>

      {error && <LoadState status="error" onRetry={() => void load()} />}
      {!error && result === null && <LoadState status="loading" />}
      {result && items.length === 0 && <p className="compare-modal__empty">비교할 후보지가 없어요. 추천 위치를 후보지로 추가해 보세요.</p>}
      {items.length > 0 && (
        <div className="compare-modal__scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col" className="compare-table__corner">
                  비교 항목
                </th>
                {items.map((item, index) => (
                  <th key={item.candidateId} scope="col" className={item.candidateId === chosen ? 'is-chosen' : undefined}>
                    <button
                      type="button"
                      className="compare-table__pick"
                      aria-pressed={item.candidateId === chosen}
                      onClick={() => setSelected(item.candidateId)}
                    >
                      <span className={`letter-badge${item.candidateId === chosen ? ' letter-badge--outline' : ''}`}>
                        {badgeLetter(index)}
                      </span>
                      <span>
                        {item.name}
                        {item.candidateId === chosen && ' · 선택'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {items.map((item) => (
                    <td
                      key={item.candidateId}
                      className={`${item.candidateId === chosen ? 'is-chosen' : ''}${row.strong ? ' is-strong' : ''}`}
                    >
                      {row.value(item, roadviewStates[item.candidateId] ?? 'checking')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="compare-modal__note">
        경사·차량 진입은 추정치가 포함돼 있어요(현장 확인 필요).
        {result && ` 기준 시각 ${new Date(result.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
      </p>
      <div className="compare-modal__actions">
        <button type="button" className="button button--outline" onClick={onClose}>
          닫기
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
