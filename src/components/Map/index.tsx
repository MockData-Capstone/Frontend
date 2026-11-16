import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { loadKakaoMaps } from '../../lib/kakaoMap';
import './Map.css';

export interface MapMarker {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  // 있으면 [A] 이름 꼴의 말풍선 마커로 그린다 (UI v0.4.3 지도 마커)
  name?: string;
  // 회색 마커 — 그룹 홈(06)의 추천 위치처럼 후보지(테라코타)와 구분할 때
  tone?: 'muted';
}

export type MapLayer = 'map' | 'terrain' | 'roadview';

interface MapViewProps {
  // 배열이 바뀔 때마다 마커를 다시 그리고 지도 범위를 다시 맞춘다 — 부모에서 useMemo로 넘길 것.
  markers: MapMarker[];
  activeId?: number | null;
  // 검색한 곳 등으로 지도를 옮긴다. 새 객체를 넘길 때마다 옮긴다.
  focus?: { latitude: number; longitude: number } | null;
  onMarkerClick?: (id: number) => void;
  onMarkerHover?: (id: number, hovering: boolean) => void;
  // [지도|경사도|로드뷰] 세그먼트와 확대·축소 버튼
  controls?: boolean;
  // 이 위치의 로드뷰를 연다 (후보지 상세의 [로드뷰 보기]). 새 객체를 넘길 때마다 연다.
  roadviewAt?: { latitude: number; longitude: number } | null;
  // 지도 위 안내 상자 (예: "AI 추천 2곳 / 저장한 후보지 3곳")
  info?: { title: string; detail?: string } | null;
}

const APP_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY;
// 마커가 없을 때 보여줄 위치: 입지 분석 시범 지역인 대구(시청)
const DEFAULT_CENTER = { latitude: 35.8714, longitude: 128.6014 };

export default function MapView(props: MapViewProps) {
  if (!APP_KEY) {
    return (
      <div className="map-view">
        <p className="map-view__message">
          {/* 설정 방법은 개발 중에만 보여준다 */}
          {import.meta.env.DEV
            ? '지도를 표시하려면 .env.local에 VITE_KAKAO_JS_KEY를 설정해 주세요.'
            : '지금은 지도를 표시할 수 없어요.'}
        </p>
      </div>
    );
  }
  return <KakaoMapView {...props} appKey={APP_KEY} />;
}

function KakaoMapView({
  appKey,
  markers,
  activeId = null,
  focus = null,
  onMarkerClick,
  onMarkerHover,
  controls = false,
  roadviewAt = null,
  info = null,
}: MapViewProps & { appKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roadviewRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [layer, setLayer] = useState<MapLayer>('map');
  const [roadview, setRoadview] = useState<{ latitude: number; longitude: number } | null>(null);
  const [roadviewNote, setRoadviewNote] = useState<string | null>(null);
  const markerRefs = useRef(
    new Map<number, { el: HTMLButtonElement; overlay: kakao.maps.CustomOverlay }>(),
  );

  const handleClick = useEffectEvent((id: number) => onMarkerClick?.(id));
  const handleHover = useEffectEvent((id: number, hovering: boolean) => onMarkerHover?.(id, hovering));

  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps(appKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const center = new kakao.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude);
        setMap(new kakao.maps.Map(containerRef.current, { center, level: 5 }));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [appKey]);

  useEffect(() => {
    if (!map) return;
    const registry = markerRefs.current;
    const bounds = new kakao.maps.LatLngBounds();
    for (const marker of markers) {
      const position = new kakao.maps.LatLng(marker.latitude, marker.longitude);
      const el = document.createElement('button');
      el.type = 'button';
      const classes = ['map-marker'];
      if (marker.tone === 'muted') classes.push('map-marker--muted');
      if (marker.name) classes.push('map-marker--named');
      el.className = classes.join(' ');
      if (marker.name) {
        const letter = document.createElement('span');
        letter.className = 'map-marker__letter';
        letter.textContent = marker.label;
        const name = document.createElement('span');
        name.className = 'map-marker__name';
        name.textContent = marker.name;
        el.append(letter, name);
        el.setAttribute('aria-label', `${marker.label} ${marker.name}`);
      } else {
        el.textContent = marker.label;
      }
      el.addEventListener('click', () => handleClick(marker.id));
      el.addEventListener('mouseenter', () => handleHover(marker.id, true));
      el.addEventListener('mouseleave', () => handleHover(marker.id, false));
      // 이름 마커는 말풍선 꼬리가 좌표를 가리키도록 아래쪽을 기준점으로 둔다
      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: el,
        clickable: true,
        ...(marker.name ? { yAnchor: 1.15 } : {}),
      });
      overlay.setMap(map);
      registry.set(marker.id, { el, overlay });
      bounds.extend(position);
    }
    if (markers.length === 1) {
      map.setCenter(new kakao.maps.LatLng(markers[0].latitude, markers[0].longitude));
    } else if (markers.length > 1) {
      map.setBounds(bounds, 90, 90, 90, 90);
    }
    return () => {
      registry.forEach(({ overlay }) => overlay.setMap(null));
      registry.clear();
    };
  }, [map, markers]);

  // 마커를 새로 그린 뒤에도 강조가 다시 적용되도록 map·markers에도 반응한다.
  useEffect(() => {
    markerRefs.current.forEach(({ el, overlay }, id) => {
      const active = id === activeId;
      el.classList.toggle('is-active', active);
      overlay.setZIndex(active ? 3 : 1);
    });
  }, [activeId, map, markers]);

  useEffect(() => {
    if (!map || !focus) return;
    map.setLevel(4);
    map.setCenter(new kakao.maps.LatLng(focus.latitude, focus.longitude));
  }, [map, focus]);

  // 경사도: 지형도(음영기복) 타일 / 로드뷰: 로드뷰가 있는 길을 파랗게 겹치고, 지도를 누르면 그 자리 로드뷰를 연다
  useEffect(() => {
    if (!map) return;
    const overlay =
      layer === 'terrain' ? kakao.maps.MapTypeId.TERRAIN : layer === 'roadview' ? kakao.maps.MapTypeId.ROADVIEW : null;
    if (overlay === null) return;
    map.addOverlayMapTypeId(overlay);
    const onClick = (event: { latLng: kakao.maps.LatLng }) =>
      setRoadview({ latitude: event.latLng.getLat(), longitude: event.latLng.getLng() });
    if (layer === 'roadview') kakao.maps.event.addListener(map, 'click', onClick);
    return () => {
      map.removeOverlayMapTypeId(overlay);
      if (layer === 'roadview') kakao.maps.event.removeListener(map, 'click', onClick);
    };
  }, [map, layer]);

  const [roadviewRequest, setRoadviewRequest] = useState(roadviewAt);
  if (roadviewAt !== roadviewRequest) {
    setRoadviewRequest(roadviewAt);
    if (roadviewAt) setRoadview(roadviewAt);
  }

  // 로드뷰 창: 가장 가까운 파노라마(반경 60m)를 찾아 띄운다
  useEffect(() => {
    if (!map || !roadview || !roadviewRef.current) return;
    const position = new kakao.maps.LatLng(roadview.latitude, roadview.longitude);
    const viewer = new kakao.maps.Roadview(roadviewRef.current);
    let cancelled = false;
    new kakao.maps.RoadviewClient().getNearestPanoId(position, 60, (panoId) => {
      if (cancelled) return;
      if (panoId === null) {
        setRoadviewNote('이 근처에는 로드뷰가 없어요. 파란 길 위를 눌러 보세요.');
        return;
      }
      setRoadviewNote(null);
      viewer.setPanoId(panoId, position);
    });
    return () => {
      cancelled = true;
    };
  }, [map, roadview]);

  const zoom = (delta: number) => {
    if (map) map.setLevel(map.getLevel() + delta, { animate: true });
  };

  const LAYERS: { id: MapLayer; label: string }[] = [
    { id: 'map', label: '지도' },
    { id: 'terrain', label: '경사도' },
    { id: 'roadview', label: '로드뷰' },
  ];

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-view__canvas" />
      {failed && <p className="map-view__message">지도를 불러오지 못했어요.</p>}
      {controls && (
        <>
          <div className="map-view__segment" role="group" aria-label="지도 보기 방식">
            {LAYERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={layer === item.id ? 'is-active' : undefined}
                aria-pressed={layer === item.id}
                onClick={() => setLayer(item.id)}
                disabled={!map}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="map-view__zoom">
            <button type="button" aria-label="확대" onClick={() => zoom(-1)} disabled={!map}>
              +
            </button>
            <button type="button" aria-label="축소" onClick={() => zoom(1)} disabled={!map}>
              −
            </button>
          </div>
        </>
      )}
      {(info || layer !== 'map') && (
        <div className="map-view__info" role="status">
          {layer === 'terrain' ? (
            <>
              <strong>경사도 보기</strong>
              <span>지형 음영으로 언덕을 보여줘요. 후보지별 경사 수치는 상세에서 확인하세요.</span>
            </>
          ) : layer === 'roadview' ? (
            <>
              <strong>로드뷰 보기</strong>
              <span>파란 길 위를 누르면 그 자리 로드뷰를 열어요.</span>
            </>
          ) : (
            info && (
              <>
                <strong>{info.title}</strong>
                {info.detail && <span>{info.detail}</span>}
              </>
            )
          )}
        </div>
      )}
      {roadview && (
        <div className="map-view__roadview" role="dialog" aria-label="로드뷰">
          <div ref={roadviewRef} className="map-view__roadview-canvas" />
          {roadviewNote && <p className="map-view__roadview-note">{roadviewNote}</p>}
          <button type="button" className="map-view__roadview-close" onClick={() => setRoadview(null)}>
            로드뷰 닫기
          </button>
        </div>
      )}
    </div>
  );
}
