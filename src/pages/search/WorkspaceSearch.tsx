import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { ChatComposer, ChatMessageList } from '../../components/Chat';
import MapView, { type MapMarker } from '../../components/Map';
import { useChat } from '../../hooks/useChat';
import { searchPlaces } from '../../lib/kakaoMap';
import { toMarkers } from '../candidates/format';
import ConditionBox from './ConditionBox';
import RecommendationList from './RecommendationList';
import { useRecommendations } from './useRecommendations';
import { useWorkspaceCandidates } from './useWorkspaceCandidates';
// 왼쪽 패널 틀(제목·[대화|후보지] 탭)은 후보지 목록(14)과 같다.
import '../candidates/CandidateList.css';
import './WorkspaceSearch.css';

const KAKAO_JS_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY;
// 시안의 조건 칩. 연결할 기능이 아직 없어 비활성으로 둔다.
const FILTER_CHIPS = ['월세', '보증금', '방 구조', '면적', '차량 진입'];

// 11 그룹 홈 (UI v0.4 §6, 흐름도 "대화 → 분석 → 후보지 함께 찾기").
// 왼쪽: 대화(CHAT) · 함께 정한 조건(COND-02) · 추천 위치(REC-02) · [대화 분석하기](REC-01) · 입력창
// 오른쪽: 지도(후보지 A·B·C, 추천 위치는 회색 번호)와 후보지 카드.
// 비교(16)·투표(17)·조건 확정(18)·그룹 설정(12)은 화면이 생기면 연결한다.
export default function WorkspaceSearch() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const navigate = useNavigate();
  const meId = me?.id ?? null;
  const chat = useChat(workspace.id, meId);
  const recommendations = useRecommendations(workspace.id);
  const { candidates, error: candidatesError } = useWorkspaceCandidates(workspace.id, meId);
  // 지도 마커 id는 후보지 candidateId, 추천 위치 -recommendationId (둘이 겹치지 않게)
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [keyword, setKeyword] = useState('');
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const searchId = useRef(0);

  const { analysis, items } = recommendations;
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

  // 떠날 때는 지금 강조된 게 자기일 때만 지운다 (후보지 목록 14와 같은 이유)
  const hover = (id: number, hovering: boolean) =>
    setActiveMarker((current) => (hovering ? id : current === id ? null : current));

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed || !KAKAO_JS_KEY) return;
    // 앞선 검색이 늦게 끝나도 마지막 검색만 반영한다.
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

  const inProgress = recommendations.requesting || analysis?.status === 'IN_PROGRESS';
  const hasChat = chat.messages.length > 0;
  const count = candidates?.length;
  const candidatesPath = `/workspaces/${workspace.id}/candidates`;

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
        <ul className="search-toolbar__chips">
          {FILTER_CHIPS.map((chip) => (
            <li key={chip}>
              <button type="button" className="search-toolbar__chip" disabled title="준비 중인 기능이에요.">
                {chip}
              </button>
            </li>
          ))}
        </ul>
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
              <h1 className="candidate-panel__title">대화</h1>
              <button
                type="button"
                className="search-panel__settings"
                disabled
                title="준비 중인 화면이에요."
              >
                그룹 설정
              </button>
            </div>
            <div className="candidate-panel__tabs">
              <span className="candidate-panel__tab is-active">대화</span>
              <Link to={candidatesPath} className="candidate-panel__tab">
                후보지 {count ?? ''}
              </Link>
            </div>
          </div>

          <ChatMessageList chat={chat} meId={meId} />

          <div className="search-panel__bottom">
            {/* 조건·추천 위치가 길어져도 대화가 가려지지 않게 이 칸만 스크롤한다 */}
            <div className="search-panel__info">
              <ConditionBox workspaceId={workspace.id} extracted={analysis?.conditions ?? null} />
              {items.length > 0 && (
                <RecommendationList
                  items={items}
                  activeId={activeMarker !== null && activeMarker < 0 ? -activeMarker : null}
                  adding={recommendations.adding}
                  onHover={(recommendationId, hovering) => hover(-recommendationId, hovering)}
                  onAdd={(recommendationId) => void recommendations.add(recommendationId)}
                />
              )}
            </div>
            <div className="search-panel__analyze">
              <button
                type="button"
                className="button button--primary"
                onClick={() => void recommendations.requestAnalysis()}
                disabled={inProgress || !hasChat}
                title={!inProgress && !hasChat ? '대화를 나눈 뒤 분석할 수 있어요.' : undefined}
              >
                {inProgress ? '분석 중이에요…' : '대화 분석하기'}
              </button>
              {inProgress && (
                <p className="search-panel__hint" role="status">
                  대화를 분석하고 있어요. 끝나면 추천 위치를 보여 드려요.
                </p>
              )}
              {!inProgress && analysis?.status === 'COMPLETED' && items.length === 0 && (
                <p className="search-panel__hint">
                  추천할 위치를 찾지 못했어요. 대화를 더 나눈 뒤 다시 분석해 보세요.
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
        </aside>

        <div className="search-layout__map">
          <MapView
            markers={markers}
            activeId={activeMarker}
            focus={focus}
            onMarkerClick={(id) => {
              // 후보지는 상세(15)로, 추천 위치는 목록의 카드를 강조한다.
              if (id > 0) navigate(`${candidatesPath}/${id}`);
              else setActiveMarker(id);
            }}
            onMarkerHover={hover}
            controls
          />
          <section className="search-candidates" aria-labelledby="search-candidates-title">
            <h2 id="search-candidates-title" className="search-candidates__title">
              {count === undefined ? '후보지' : `후보지 ${count}곳`}
            </h2>
            {candidatesError ? (
              <p className="search-candidates__error">{candidatesError}</p>
            ) : (
              count === 0 && (
                <p className="search-candidates__hint">추천 위치를 후보지로 추가해 보세요.</p>
              )
            )}
            <div className="search-candidates__actions">
              <button type="button" className="button button--secondary" disabled title="준비 중인 화면이에요.">
                후보지 비교
              </button>
              <button type="button" className="button button--secondary" disabled title="준비 중인 화면이에요.">
                투표하기
              </button>
              <button type="button" className="button button--primary" disabled title="준비 중인 화면이에요.">
                조건 확정
              </button>
            </div>
          </section>
        </div>
      </div>
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
