import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import MapView from '../../components/Map';
import { getErrorMessage } from '../../lib/authApi';
import {
  getCandidate,
  getCandidates,
  removeCandidate,
  renameCandidate,
} from '../../lib/candidateApi';
import type { Candidate, CandidateRemovedData } from '../../types';
import { badgeLetter, formatPercent, gradeLabel, toMarkers, vehicleLabel } from './format';
import { applyCandidateMessage, isCandidateMessage } from './realtime';
import './CandidateDetail.css';

const NAME_MAX_LENGTH = 50; // Backend Candidate.NAME_MAX_LENGTH

// 다른 후보지로 이동하면 key로 다시 마운트해 이름 수정 중이던 상태 등을 버린다.
export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  return <CandidateDetail key={candidateId} candidateId={Number(candidateId)} />;
}

// 15 후보지 상세·입지 분석 (UI v0.4 §6). 경사 그래프·도보 시간은 API에 값이 없어 넣지 않았다.
function CandidateDetail({ candidateId }: { candidateId: number }) {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const navigate = useNavigate();
  const listPath = `/workspaces/${workspace.id}/candidates`;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [all, setAll] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // 보고 있는 후보지를 다른 멤버가 제외했다.
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 목록은 배지 글자(A·B·C)와 지도의 다른 후보지 마커에 쓴다.
    Promise.all([getCandidate(candidateId), getCandidates(workspace.id)])
      .then(([detail, list]) => {
        if (cancelled) return;
        setCandidate(detail);
        setAll(list);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '후보지 정보를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [candidateId, workspace.id]);

  // 다른 멤버의 이름 수정·제외·투표와 새 후보지를 바로 반영한다(지도 마커·배지 글자도 같이 바뀐다).
  useWorkspaceMessages((message) => {
    if (!isCandidateMessage(message)) return;
    const meId = me?.id ?? null;
    setAll((list) => applyCandidateMessage(list, message, meId));
    // 내가 [후보지 제외]를 누른 중이면(busy) 곧 목록으로 가므로 안내를 띄우지 않는다.
    if (
      message.type === 'CANDIDATE_REMOVED' &&
      (message.data as CandidateRemovedData).candidateId === candidateId &&
      !busy
    ) {
      setRemoved(true);
      return;
    }
    // 이 후보지에 대한 이름 수정·투표만 바뀌고, 다른 후보지 통지면 그대로 둔다.
    setCandidate(
      (current) =>
        current &&
        (applyCandidateMessage([current], message, meId).find(
          (c) => c.candidateId === current.candidateId,
        ) ??
          current),
    );
  });

  // 연결이 끊긴 동안 놓친 통지가 있을 수 있어 다시 붙으면 새로 불러온다. 목록과 상세는 같은 응답(CandidateResponse)이라
  // 목록 하나로 둘 다 맞추고, 목록에 이 후보지가 없으면 그사이 다른 멤버가 제외한 것이다.
  useWorkspaceReconnect(() => {
    getCandidates(workspace.id)
      .then((list) => {
        setAll(list);
        const latest = list.find((c) => c.candidateId === candidateId);
        if (latest) {
          setCandidate(latest);
          setError(null);
        } else if (candidate && !busy) {
          setRemoved(true);
        }
      })
      .catch(() => {});
  });

  const markers = useMemo(() => toMarkers(all), [all]);

  if (removed) {
    return (
      <div className="candidate-detail">
        <p className="candidate-detail__hint">다른 멤버가 이 후보지를 제외했어요.</p>
        <Link to={listPath} className="button button--secondary">
          후보지 목록으로
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="candidate-detail">
        <p className="candidate-detail__error">{error}</p>
        <Link to={listPath} className="button button--secondary">
          후보지 목록으로
        </Link>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="candidate-detail">
        <p className="candidate-detail__hint">불러오는 중...</p>
      </div>
    );
  }

  const index = all.findIndex((c) => c.candidateId === candidate.candidateId);
  // 이름 기본값이 장소명이라, 이름을 바꿨을 때만 원래 장소명을 붙인다.
  const subtitle = [
    index >= 0 ? `${badgeLetter(index)} 후보지` : null,
    candidate.placeName !== candidate.name ? candidate.placeName : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const { slope, vehicleAccess } = candidate.location;

  const startEditing = () => {
    setNameDraft(candidate.name);
    setActionError(null);
    setEditing(true);
  };

  const handleRename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name) return;
    if (name === candidate.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      setCandidate(await renameCandidate(candidate.candidateId, name));
      setEditing(false);
    } catch (err) {
      setActionError(getErrorMessage(err, '이름을 바꾸지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  // CAND-03 제외는 후보지를 추가한 멤버와 호스트만 할 수 있다(서버 NOT_CANDIDATE_OWNER).
  // 다른 멤버에게는 확인창 뒤에 거절당하지 않게 버튼을 끄고 이유를 툴팁으로 알린다.
  const canRemove =
    workspace.myRole === 'HOST' || (candidate.addedBy !== null && candidate.addedBy.userId === me?.id);

  const handleRemove = async () => {
    if (!window.confirm('이 후보지를 제외할까요? 이 후보지의 투표도 함께 지워져요.')) return;
    setBusy(true);
    setActionError(null);
    try {
      await removeCandidate(candidate.candidateId);
      navigate(listPath, { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err, '후보지를 제외하지 못했어요.'));
      setBusy(false);
    }
  };

  return (
    <div className="candidate-detail">
      <div className="candidate-detail__heading">
        {editing ? (
          <form className="candidate-detail__rename" onSubmit={handleRename}>
            <input
              className="candidate-detail__rename-input"
              aria-label="후보지 이름"
              value={nameDraft}
              maxLength={NAME_MAX_LENGTH}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <button
              type="submit"
              className="button button--primary"
              disabled={busy || !nameDraft.trim()}
            >
              저장
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              취소
            </button>
          </form>
        ) : (
          <h1 className="candidate-detail__title">{candidate.name}</h1>
        )}
        {subtitle && <p className="candidate-detail__subtitle">{subtitle}</p>}
      </div>

      {actionError && <p className="candidate-detail__error">{actionError}</p>}

      <div className="candidate-detail__columns">
        <section>
          <div className="candidate-detail__map">
            <MapView
              markers={markers}
              activeId={candidate.candidateId}
              onMarkerClick={(id) => {
                if (id !== candidate.candidateId) navigate(`${listPath}/${id}`);
              }}
            />
          </div>
          <div className="candidate-detail__map-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled
              title="준비 중인 기능이에요."
            >
              로드뷰 보기
            </button>
            <Link to={listPath} className="button button--secondary">
              후보지 목록
            </Link>
          </div>
        </section>

        <section>
          <div className="candidate-detail__card">
            <h2 className="candidate-detail__card-title">목적지까지 걷는 길</h2>
            {slope && slope.averagePercent !== null ? (
              <>
                {slope.destination && (
                  <p className="candidate-detail__destination">{slope.destination}</p>
                )}
                <div className="candidate-detail__numbers">
                  <div>
                    <p className="candidate-detail__number-label">평균 경사</p>
                    <p className="candidate-detail__number">
                      {formatPercent(slope.averagePercent)}
                    </p>
                  </div>
                  {slope.maxPercent !== null && (
                    <div>
                      <p className="candidate-detail__number-label">최대 경사</p>
                      <p className="candidate-detail__number">{formatPercent(slope.maxPercent)}</p>
                    </div>
                  )}
                </div>
                {slope.grade && (
                  <span className="candidate-detail__grade">{gradeLabel(slope.grade)}</span>
                )}
                {slope.estimated && (
                  <p className="candidate-detail__estimated">추정치 — 현장 확인 필요</p>
                )}
              </>
            ) : (
              <p className="candidate-detail__empty">경로 정보 없음</p>
            )}

            <h3 className="candidate-detail__section-title">차량 진입</h3>
            {vehicleAccess ? (
              <>
                <p className="candidate-detail__vehicle">{vehicleLabel(vehicleAccess.access)}</p>
                {vehicleAccess.reason && (
                  <p className="candidate-detail__reason">{vehicleAccess.reason}</p>
                )}
                {vehicleAccess.estimated && (
                  <p className="candidate-detail__estimated">추정치 — 현장 확인 필요</p>
                )}
              </>
            ) : (
              <p className="candidate-detail__empty">정보 없음</p>
            )}
            <p className="candidate-detail__note">일조·소음은 준비 중이에요.</p>

            <div className="candidate-detail__card-actions">
              <button
                type="button"
                className="button button--primary"
                disabled
                title="준비 중인 기능이에요."
              >
                후보지에서 보기
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={startEditing}
                disabled={editing || busy}
              >
                이름 수정
              </button>
            </div>
          </div>

          <button
            type="button"
            className="button button--danger candidate-detail__remove"
            onClick={handleRemove}
            disabled={busy || !canRemove}
            title={canRemove ? undefined : '후보지를 추가한 멤버나 호스트만 제외할 수 있어요.'}
          >
            후보지 제외
          </button>
        </section>
      </div>
    </div>
  );
}
