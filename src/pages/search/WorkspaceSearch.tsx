import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages } from '../../app/providers/useWorkspaceSocket';
import { ChatComposer, ChatMessageList } from '../../components/Chat';
import ComparisonModal from '../../components/Comparison';
import ConditionChips from '../../components/ConditionChips';
import MapView, { type MapMarker } from '../../components/Map';
import { useToast } from '../../components/Toast/useToast';
import VoteModal from '../../components/Vote';
import { useChat } from '../../hooks/useChat';
import { useGroupConditions } from '../../hooks/useGroupConditions';
import { useRoadviewAccess } from '../../hooks/useRoadviewAccess';
import { getErrorMessage } from '../../lib/authApi';
import { acceptSuggestion, getSuggestions } from '../../lib/conditionApi';
import { searchPlaces } from '../../lib/kakaoMap';
import { vehicleVerdict, vehicleVerdictSummary } from '../../lib/roadview';
import type { Candidate } from '../../types';
import type { Suggestion } from '../../types/search';
import { badgeLetter, slopeSummary, toMarkers } from '../candidates/format';
import AiFeed from './AiFeed';
import AnalysisDoneDialog from './AnalysisDoneDialog';
import ConditionBox from './ConditionBox';
import { useRecommendations } from './useRecommendations';
import { useWorkspaceCandidates } from './useWorkspaceCandidates';
import '../candidates/CandidateList.css';
import './WorkspaceSearch.css';

const KAKAO_JS_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY;

export type GroupTab = 'chat' | 'candidates' | 'ai';

// 06 그룹 홈 (UI v0.4.3). 왼쪽 패널은 [대화 | 후보지 N | ZIPFIT AI] 탭, 가운데는 지도, 오른쪽 위에 저장한 후보지 카드.
// - 대화(06): 멤버 대화 · 대화에서 논의 중인 조건 · [대화 분석하기] · 입력창 (CHAT-01·02, REC-01)
// - 후보지(08): 후보지 카드(평균 경사·차량 진입·투표) · [후보지 비교] [투표하기] [조건 검토·확정] (CAND, VOTE, CMP)
// - ZIPFIT AI(06-A): 공유 분석 결과 — 추출 조건 · 추천 이유 · 추가 제안 (REC-01~03)
// 상단 조건 칩은 그룹 조건(COND-01)을 바로 고친다. 분석이 끝나면 완료 팝업(06-B)을 띄운다.
export default function WorkspaceSearch({ tab: routeTab }: { tab?: 'candidates' }) {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // 후보지 상세의 [후보지에서 보기]로 오면 그 후보지를 선택해 둔다
  const focusId = (location.state as { focus?: number } | null)?.focus ?? null;
  const tab: GroupTab = routeTab ?? (params.get('tab') === 'ai' ? 'ai' : 'chat');
  const meId = me?.id ?? null;
  const chat = useChat(workspace.id, meId);
  const recommendations = useRecommendations(workspace.id);
  const conditions = useGroupConditions(workspace.id);
  const { candidates, error: candidatesError } = useWorkspaceCandidates(workspace.id, meId);
  // 차량 진입 1차 판단: 후보지 반경 안에 로드뷰가 있는지
  const roadviewStates = useRoadviewAccess(
    (candidates ?? []).map((c) => ({ id: c.candidateId, latitude: c.latitude, longitude: c.longitude })),
  );
  const vehicleText = (c: Candidate) => {
    const state = roadviewStates[c.candidateId] ?? 'checking';
    return vehicleVerdictSummary(vehicleVerdict(c.location.vehicleAccess, state), state);
  };
  // 지도 마커 id는 후보지 candidateId, 추천 위치 -recommendationId (둘이 겹치지 않게)
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(focusId);
  const [focus, setFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [keyword, setKeyword] = useState('');
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [modal, setModal] = useState<'vote' | 'compare' | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [later, setLater] = useState<Suggestion['type'][]>([]);
  const [accepting, setAccepting] = useState<Suggestion['type'] | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const searchId = useRef(0);
  const watching = useRef(false);

  const base = `/workspaces/${workspace.id}`;
  const { analysis, items } = recommendations;
  const inProgress = recommendations.requesting || analysis?.status === 'IN_PROGRESS';

  // 분석을 지켜보던 중(진행 중을 본 뒤) 완료되면 06-B 팝업을 한 번 띄운다
  useEffect(() => {
    if (inProgress) watching.current = true;
    else if (watching.current && analysis?.status === 'COMPLETED') {
      watching.current = false;
      setDoneOpen(true);
    } else if (analysis?.status === 'FAILED') watching.current = false;
  }, [inProgress, analysis?.status]);

  const loadSuggestions = () =>
    getSuggestions(workspace.id)
      .then(setSuggestions)
      .catch(() => {});
  useEffect(() => {
    void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);
  useWorkspaceMessages((message) => {
    if (['RECOMMENDATION_COMPLETED', 'CONDITION_SUGGESTION_ACCEPTED', 'CANDIDATE_ADDED', 'CANDIDATE_UPDATED', 'CANDIDATE_REMOVED'].includes(message.type)) {
      void loadSuggestions();
    }
  });

  const markers = useMemo<MapMarker[]>(
    () => [
      ...toMarkers(candidates ?? []),
      // 후보지로 추가한 추천 위치는 후보지 마커로 보이니 따로 그리지 않는다.
      ...items.flatMap((item, i): MapMarker[] =>
        !item.addedAsCandidate && item.latitude !== null && item.longitude !== null
          ? [
              {
                id: -item.recommendationId,
                label: String(i + 1),
                name: item.placeName,
                latitude: item.latitude,
                longitude: item.longitude,
                tone: 'muted',
              },
            ]
          : [],
      ),
    ],
    [candidates, items],
  );

  // 떠날 때는 지금 강조된 게 자기일 때만 지운다
  const hover = (id: number, hovering: boolean) =>
    setActiveMarker((current) => (hovering ? id : current === id ? null : current));

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed || !KAKAO_JS_KEY) return;
    const id = ++searchId.current;
    setSearchNote(null);
    try {
      const [first] = await searchPlaces(KAKAO_JS_KEY, trimmed, 1);
      if (searchId.current !== id) return;
      if (first) setFocus({ latitude: first.latitude, longitude: first.longitude });
      else setSearchNote('검색 결과가 없어요.');
    } catch {
      if (searchId.current === id) setSearchNote('검색하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const accept = async (type: Suggestion['type']) => {
    setAccepting(type);
    try {
      setSuggestions(await acceptSuggestion(workspace.id, type));
      showToast('제안을 조건 초안에 넣었어요. 조건 검토에서 확정해 주세요.');
    } catch (err) {
      showToast(getErrorMessage(err, '제안을 수락하지 못했어요.'));
    } finally {
      setAccepting(null);
    }
  };

  const hasChat = chat.messages.length > 0;
  const count = candidates?.length;
  const recommendedCount = items.filter((i) => !i.addedAsCandidate).length;
  const chosen = selected ?? (activeMarker !== null && activeMarker > 0 ? activeMarker : null);
  const title = tab === 'ai' ? 'ZIPFIT AI' : tab === 'candidates' ? (count === undefined ? '후보지' : `후보지 ${count}곳`) : '대화';
  const visibleSuggestions = suggestions.filter((s) => !later.includes(s.type));

  return (
    <div className="search-layout">
      <div className="search-toolbar">
        <form className="search-toolbar__search" role="search" onSubmit={search}>
          <SearchIcon />
          <input
            type="search"
            className="search-toolbar__input"
            placeholder="지역, 지하철역, 학교 검색"
            aria-label="지역, 지하철역, 학교 검색"
            enterKeyHint="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={!KAKAO_JS_KEY}
          />
        </form>
        <ConditionChips
          value={conditions.current}
          disabled={!conditions.loaded}
          onApply={async (next) => {
            try {
              await conditions.save(next);
              showToast('그룹 조건을 바꿨어요. 모든 멤버에게 공유돼요.');
            } catch (err) {
              throw new Error(getErrorMessage(err, err instanceof Error ? err.message : '조건을 저장하지 못했어요.'), { cause: err });
            }
          }}
        />
        {searchNote && (
          <p className="search-toolbar__note" role="status">
            {searchNote}
          </p>
        )}
      </div>

      <div className="search-layout__body">
        <aside className="candidate-panel search-panel">
          <div className="candidate-panel__head">
            <div className="search-panel__title-row">
              <h1 className="candidate-panel__title">{title}</h1>
              <Link to={`${base}/settings`} className="search-panel__settings">
                그룹 설정
              </Link>
            </div>
            <nav className="candidate-panel__tabs" aria-label="그룹 홈 탭">
              <Link to={`${base}/search`} className={`candidate-panel__tab${tab === 'chat' ? ' is-active' : ''}`} aria-current={tab === 'chat' ? 'page' : undefined}>
                대화
              </Link>
              <Link to={`${base}/candidates`} className={`candidate-panel__tab${tab === 'candidates' ? ' is-active' : ''}`} aria-current={tab === 'candidates' ? 'page' : undefined}>
                후보지 {count ?? ''}
              </Link>
              <Link to={`${base}/search?tab=ai`} className={`candidate-panel__tab${tab === 'ai' ? ' is-active' : ''}`} aria-current={tab === 'ai' ? 'page' : undefined}>
                ZIPFIT AI
              </Link>
            </nav>
          </div>

          {tab === 'chat' && (
            <>
              <ChatMessageList chat={chat} meId={meId} />
              <div className="search-panel__bottom">
                <div className="search-panel__info">
                  <ConditionBox workspaceId={workspace.id} extracted={analysis?.conditions ?? null} />
                </div>
                <div className="search-panel__analyze">
                  <button
                    type="button"
                    className="button button--primary button--lg"
                    onClick={() => void recommendations.requestAnalysis()}
                    disabled={inProgress || !hasChat}
                    title={!inProgress && !hasChat ? '대화를 나눈 뒤 분석할 수 있어요.' : undefined}
                  >
                    {inProgress ? '분석 중이에요…' : '대화 분석하기'}
                  </button>
                  {inProgress && (
                    <p className="search-panel__hint" role="status">
                      대화를 분석하고 있어요. 끝나면 추천 위치를 알려 드려요.
                    </p>
                  )}
                  {!inProgress && analysis?.status === 'FAILED' && (
                    <p className="search-panel__error" role="alert">
                      {analysis.failureMessage ?? '대화를 분석하지 못했어요. 잠시 후 다시 시도해 주세요.'}
                    </p>
                  )}
                  {recommendations.error && (
                    <p className="search-panel__error" role="alert">
                      {recommendations.error}
                    </p>
                  )}
                </div>
              </div>
              <ChatComposer onSend={chat.send} />
            </>
          )}

          {tab === 'ai' && (
            <div className="candidate-panel__body">
              <AiFeed
                analysis={analysis}
                items={items}
                suggestions={visibleSuggestions}
                hasChat={hasChat}
                inProgress={inProgress}
                conditionsPath={`${base}/conditions`}
                adding={recommendations.adding}
                activeId={activeMarker !== null && activeMarker < 0 ? -activeMarker : null}
                onHover={(recommendationId, hovering) => hover(-recommendationId, hovering)}
                onAdd={(recommendationId) => void recommendations.add(recommendationId)}
                onAccept={(type) => void accept(type)}
                onLater={(type) => setLater((list) => [...list, type])}
                accepting={accepting}
                onRequest={() => void recommendations.requestAnalysis()}
                onGoChat={() => navigate(`${base}/search`)}
              />
              {recommendations.error && (
                <p className="search-panel__error" role="alert">
                  {recommendations.error}
                </p>
              )}
            </div>
          )}

          {tab === 'candidates' && (
            <>
              <div className="candidate-panel__body">
                {candidatesError && <p className="candidate-panel__error">{candidatesError}</p>}
                {!candidatesError && !candidates && <p className="candidate-panel__hint">불러오는 중...</p>}
                {candidates?.length === 0 && (
                  <p className="candidate-panel__hint">
                    아직 추가된 후보지가 없어요. ZIPFIT AI 탭에서 추천 위치를 후보지로 추가해 보세요.
                  </p>
                )}
                {candidates && candidates.length > 0 && (
                  <ul className="candidate-panel__cards">
                    {candidates.map((c, i) => {
                      const { slope, vehicleAccess } = c.location;
                      const estimated = Boolean(slope?.estimated || vehicleAccess?.estimated);
                      return (
                        <li key={c.candidateId}>
                          <Link
                            to={`${base}/candidates/${c.candidateId}`}
                            className={`candidate-card${activeMarker === c.candidateId ? ' is-active' : ''}`}
                            onMouseEnter={() => hover(c.candidateId, true)}
                            onMouseLeave={() => hover(c.candidateId, false)}
                            onFocus={() => hover(c.candidateId, true)}
                            onBlur={() => hover(c.candidateId, false)}
                          >
                            <span className={`letter-badge${activeMarker === c.candidateId ? ' letter-badge--outline' : ''}`}>
                              {badgeLetter(i)}
                            </span>
                            <span className="candidate-card__body">
                              <span className="candidate-card__name">{c.name}</span>
                              {c.placeName !== c.name && <span className="candidate-card__place">{c.placeName}</span>}
                              <span className="candidate-card__slope">{slopeSummary(slope)}</span>
                              <span className="candidate-card__vehicle">{vehicleText(c)}</span>
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
                  <button type="button" className="button button--primary" onClick={() => setModal('compare')} aria-haspopup="dialog">
                    후보지 비교
                  </button>
                  <button type="button" className="button button--outline" onClick={() => setModal('vote')} aria-haspopup="dialog">
                    투표하기
                  </button>
                </div>
                <Link to={`${base}/conditions`} className="button button--outline">
                  조건 검토 · 확정
                </Link>
              </div>
            </>
          )}
        </aside>

        <div className="search-layout__map">
          <MapView
            markers={markers}
            activeId={activeMarker ?? chosen}
            focus={focus}
            onMarkerClick={(id) => {
              // 후보지는 카드에서 선택(상세 보기 버튼), 추천 위치는 ZIPFIT AI 목록을 강조한다.
              if (id > 0) setSelected(id);
              else {
                setActiveMarker(id);
                if (tab !== 'ai') navigate(`${base}/search?tab=ai`);
              }
            }}
            onMarkerHover={hover}
            controls
            info={
              items.length > 0 || (count ?? 0) > 0
                ? {
                    title: `AI 추천 ${recommendedCount}곳 / 저장한 후보지 ${count ?? 0}곳`,
                    detail: '재분석해도 저장한 후보지는 유지돼요.',
                  }
                : null
            }
          />
          {tab !== 'candidates' && (
            <section className="saved-card" aria-labelledby="saved-card-title">
              <h2 id="saved-card-title" className="saved-card__title">
                {count === undefined ? '저장한 후보지' : `저장한 후보지 ${count}곳`}
              </h2>
              {candidatesError && <p className="search-candidates__error">{candidatesError}</p>}
              {count === 0 && <p className="saved-card__hint">추천 위치를 후보지로 추가해 보세요.</p>}
              {candidates && candidates.length > 0 && (
                <ul className="saved-card__list">
                  {candidates.map((c, i) => {
                    const isChosen = chosen === c.candidateId;
                    return (
                      <li key={c.candidateId}>
                        <div
                          className={`saved-card__item${isChosen ? ' is-chosen' : ''}`}
                          onMouseEnter={() => hover(c.candidateId, true)}
                          onMouseLeave={() => hover(c.candidateId, false)}
                        >
                          <button
                            type="button"
                            className="saved-card__select"
                            aria-pressed={isChosen}
                            onClick={() => setSelected(c.candidateId)}
                          >
                            <span className={`letter-badge${isChosen ? ' letter-badge--outline' : ''}`}>{badgeLetter(i)}</span>
                            <span className="saved-card__text">
                              <span className="saved-card__name">{c.name}</span>
                              <strong className="saved-card__slope">{slopeSummary(c.location.slope)}</strong>
                              <span className="saved-card__vehicle">{vehicleText(c)}</span>
                            </span>
                          </button>
                          {isChosen && (
                            <Link to={`${base}/candidates/${c.candidateId}`} className="button button--primary button--sm saved-card__detail">
                              상세 보기
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="saved-card__actions">
                <button type="button" className="button button--outline" onClick={() => setModal('compare')} aria-haspopup="dialog">
                  후보지 비교
                </button>
                <button type="button" className="button button--outline" onClick={() => setModal('vote')} aria-haspopup="dialog">
                  투표하기
                </button>
                <Link to={`${base}/conditions`} className="button button--outline saved-card__wide">
                  조건 검토 · 확정
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
      {modal === 'vote' && <VoteModal onClose={() => setModal(null)} />}
      {modal === 'compare' && <ComparisonModal onClose={() => setModal(null)} />}
      {doneOpen && analysis && (
        <AnalysisDoneDialog
          conditions={analysis.conditions}
          items={items}
          onShow={() => {
            setDoneOpen(false);
            navigate(`${base}/search?tab=ai`);
          }}
          onClose={() => setDoneOpen(false)}
        />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="m21 21-6-6" />
    </svg>
  );
}
