import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Header from '../components/Header';
import MapView, { type MapMarker } from '../components/Map';
import { pendingInvite } from '../lib/invite';
import { searchPlaces, type PlaceResult } from '../lib/kakaoMap';
import { badgeLetter } from './candidates/format';
import './Home.css';

const KAKAO_JS_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY;

type SearchState =
  | { status: 'idle' }
  | { status: 'searching'; keyword: string }
  | { status: 'done'; keyword: string; places: PlaceResult[] }
  | { status: 'error'; keyword: string };

// 메인(동네 찾기). 흐름도 v0.4 "01 첫 화면 · 지도 열람"과 "01-D 로그인 후 지도 메인" —
// 로그인 전에도 지도와 장소 검색을 쓸 수 있고, 아래 버튼만 로그인 여부에 따라 바뀐다.
// 1단계(지금): 검색창, 카카오 지도(지도·확대·축소), 검색 결과 목록, [로그인하고 함께 찾기]·[내 그룹에서 함께 찾기].
// 2단계(백엔드 필요): 동네별 경사·차량 진입·도보 시간 카드, 조건 칩(월세·보증금·방 구조·면적·차량 진입), 경사도·로드뷰.
export default function Home() {
  const { accessToken } = useAuth();

  // 로그인·가입·카카오 로그인은 모두 마지막에 메인으로 온다. 초대 링크로 와서 로그인하러 갔던 거면
  // 초대 화면(04)으로 돌려보내 참여를 이어간다 (MEM-02).
  const invite = accessToken ? pendingInvite() : null;
  if (invite) {
    return <Navigate to={`/invite/${invite}`} replace />;
  }

  return <HomeMap loggedIn={Boolean(accessToken)} />;
}

function HomeMap({ loggedIn }: { loggedIn: boolean }) {
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const requestId = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  const places = useMemo(() => (search.status === 'done' ? search.places : []), [search]);
  // 마커 id는 목록 순서(0, 1, 2 …)이고 머리글자는 카드와 같은 A, B, C …
  const markers = useMemo<MapMarker[]>(
    () =>
      places.map((place, i) => ({
        id: i,
        label: badgeLetter(i),
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    [places],
  );
  const activeId = hoverId ?? selectedId;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed || !KAKAO_JS_KEY) return;
    // 앞선 검색이 늦게 끝나도 마지막 검색 결과만 보여준다.
    const id = ++requestId.current;
    setSearch({ status: 'searching', keyword: trimmed });
    setHoverId(null);
    setSelectedId(null);
    try {
      const result = await searchPlaces(KAKAO_JS_KEY, trimmed);
      if (requestId.current === id) setSearch({ status: 'done', keyword: trimmed, places: result });
    } catch {
      if (requestId.current === id) setSearch({ status: 'error', keyword: trimmed });
    }
  };

  // 지도에서 마커를 누르면 그 카드를 고르고 목록에서 보이게 한다.
  const selectFromMap = (id: number) => {
    setSelectedId(id);
    listRef.current?.children[id]?.scrollIntoView({ block: 'nearest' });
  };

  const subtitle =
    search.status === 'idle'
      ? '지역, 지하철역, 학교를 검색해 보세요'
      : search.status === 'searching'
        ? `'${search.keyword}' 검색 중`
        : search.status === 'done'
          ? `'${search.keyword}' 검색 결과 · ${search.places.length}곳`
          : `'${search.keyword}' 검색 결과`;

  return (
    <div className="page page--home">
      <Header />

      <div className="home-toolbar">
        <form className="home-search" role="search" onSubmit={submit}>
          <SearchIcon />
          <input
            type="search"
            className="home-search__input"
            placeholder="지역, 지하철역, 학교 검색"
            aria-label="지역, 지하철역, 학교 검색"
            enterKeyHint="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={!KAKAO_JS_KEY}
          />
        </form>
      </div>

      <main className="home-layout">
        <aside className="home-panel" aria-labelledby="home-panel-title">
          <div className="home-panel__head">
            <h1 id="home-panel-title" className="home-panel__title">
              동네 둘러보기
            </h1>
            <p className="home-panel__subtitle">{subtitle}</p>
          </div>

          <div className="home-panel__body">
            {!KAKAO_JS_KEY ? (
              <p className="home-panel__hint">지도 키가 없어 검색할 수 없어요. (.env.local의 VITE_KAKAO_JS_KEY)</p>
            ) : search.status === 'idle' ? (
              <p className="home-panel__hint">검색하면 지도에 위치를 표시해요.</p>
            ) : search.status === 'searching' ? (
              <p className="home-panel__hint">검색하는 중...</p>
            ) : search.status === 'error' ? (
              <p className="home-panel__error" role="alert">
                검색하지 못했어요. 잠시 후 다시 시도해 주세요.
              </p>
            ) : places.length === 0 ? (
              <p className="home-panel__hint">검색 결과가 없어요. 다른 이름으로 검색해 보세요.</p>
            ) : (
              <ul ref={listRef} className="home-cards">
                {places.map((place, i) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      className={`home-card${activeId === i ? ' is-active' : ''}`}
                      aria-pressed={selectedId === i}
                      onClick={() => setSelectedId(i)}
                      onMouseEnter={() => setHoverId(i)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(i)}
                      onBlur={() => setHoverId(null)}
                    >
                      <span className="home-card__badge" aria-hidden="true">
                        {badgeLetter(i)}
                      </span>
                      <span className="home-card__body">
                        <span className="home-card__name">{place.name}</span>
                        <span className="home-card__address">{place.address}</span>
                        {place.category && <span className="home-card__category">{place.category}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* 2단계: 흐름도의 동네 카드(평균 경사·차량 진입·도보 시간)는 지역 정보 API가 생기면 채운다. */}
            {KAKAO_JS_KEY && <p className="home-panel__soon">경사·차량 진입 같은 동네 정보는 준비 중이에요.</p>}
          </div>

          <div className="home-panel__actions">
            {loggedIn ? (
              <>
                <Link to="/workspaces" className="button button--primary">
                  내 그룹에서 함께 찾기
                </Link>
                <p className="home-panel__note">내 그룹을 선택하거나 새 그룹을 만들어보세요.</p>
              </>
            ) : (
              <>
                <Link to="/login" className="button button--primary">
                  로그인하고 함께 찾기
                </Link>
                <p className="home-panel__note">로그인 전에도 지도와 지역 정보를 둘러볼 수 있어요.</p>
              </>
            )}
          </div>
        </aside>

        <div className="home-layout__map">
          <MapView
            markers={markers}
            activeId={activeId}
            onMarkerClick={selectFromMap}
            onMarkerHover={(id, hovering) => setHoverId(hovering ? id : null)}
            controls
          />
        </div>
      </main>
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
