import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages } from '../../app/providers/useWorkspaceSocket';
import MapView from '../../components/Map';
import { getErrorMessage } from '../../lib/authApi';
import { getCandidates } from '../../lib/candidateApi';
import type { Candidate } from '../../types';
import { badgeLetter, slopeSummary, toMarkers, vehicleSummary } from './format';
import { applyCandidateMessage, isCandidateMessage } from './realtime';
import './CandidateList.css';

// 14 후보지 목록 (UI v0.4 §6). 대화 탭과 비교·투표·조건 확정은 해당 화면이 생기면 연결한다.
export default function CandidateList() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCandidates(workspace.id)
      .then((data) => {
        if (!cancelled) setCandidates(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '후보지 목록을 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  // 다른 멤버의 후보지 추가·이름 수정·제외, 투표를 바로 반영한다. 불러오기 전이면 불러온 목록이 최신이다.
  useWorkspaceMessages((message) => {
    if (!isCandidateMessage(message)) return;
    setCandidates((list) => list && applyCandidateMessage(list, message, me?.id ?? null));
  });

  const markers = useMemo(() => toMarkers(candidates ?? []), [candidates]);
  // 떠날 때는 지금 강조된 게 자기일 때만 지운다 — 마커→카드로 빠르게 옮기면 마커의
  // mouseleave가 카드의 mouseenter보다 늦게 와서 방금 켠 강조를 꺼 버리기 때문이다.
  const hover = (id: number, hovering: boolean) =>
    setActiveId((current) => (hovering ? id : current === id ? null : current));
  const detailPath = (candidateId: number) =>
    `/workspaces/${workspace.id}/candidates/${candidateId}`;
  const count = candidates?.length;

  return (
    <div className="candidate-map-layout">
      <aside className="candidate-panel">
        <div className="candidate-panel__head">
          <h1 className="candidate-panel__title">
            {count === undefined ? '후보지' : `후보지 ${count}곳`}
          </h1>
          <div className="candidate-panel__tabs">
            <button
              type="button"
              className="candidate-panel__tab"
              disabled
              title="준비 중인 화면이에요."
            >
              대화
            </button>
            <span className="candidate-panel__tab is-active">후보지 {count ?? ''}</span>
          </div>
        </div>

        <div className="candidate-panel__body">
          {error && <p className="candidate-panel__error">{error}</p>}
          {!error && !candidates && <p className="candidate-panel__hint">불러오는 중...</p>}
          {candidates?.length === 0 && (
            <p className="candidate-panel__hint">아직 추가된 후보지가 없어요.</p>
          )}
          {candidates && candidates.length > 0 && (
            <ul className="candidate-panel__cards">
              {candidates.map((c, i) => {
                const { slope, vehicleAccess } = c.location;
                const estimated = Boolean(slope?.estimated || vehicleAccess?.estimated);
                return (
                  <li key={c.candidateId}>
                    <Link
                      to={detailPath(c.candidateId)}
                      className={`candidate-card${activeId === c.candidateId ? ' is-active' : ''}`}
                      onMouseEnter={() => hover(c.candidateId, true)}
                      onMouseLeave={() => hover(c.candidateId, false)}
                      onFocus={() => hover(c.candidateId, true)}
                      onBlur={() => hover(c.candidateId, false)}
                    >
                      <span className="candidate-badge">{badgeLetter(i)}</span>
                      <span className="candidate-card__body">
                        <span className="candidate-card__name">{c.name}</span>
                        {/* 이름 기본값이 장소명이라, 이름을 바꿨을 때만 원래 장소명을 보여준다. */}
                        {c.placeName !== c.name && (
                          <span className="candidate-card__place">{c.placeName}</span>
                        )}
                        <span className="candidate-card__slope">{slopeSummary(slope)}</span>
                        <span className="candidate-card__vehicle">
                          {vehicleSummary(vehicleAccess)}
                        </span>
                        <span className="candidate-card__footer">
                          <span>
                            찬성 {c.votes.agreeCount} · 반대 {c.votes.disagreeCount}
                          </span>
                          {estimated && <span>추정치</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="candidate-panel__actions">
          <div className="candidate-panel__action-row">
            <button
              type="button"
              className="button button--secondary"
              disabled
              title="준비 중인 화면이에요."
            >
              후보지 비교
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled
              title="준비 중인 화면이에요."
            >
              투표하기
            </button>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled
            title="준비 중인 화면이에요."
          >
            조건 확정
          </button>
        </div>
      </aside>

      <div className="candidate-map-layout__map">
        <MapView
          markers={markers}
          activeId={activeId}
          onMarkerClick={(id) => navigate(detailPath(id))}
          onMarkerHover={hover}
          controls
        />
      </div>
    </div>
  );
}
