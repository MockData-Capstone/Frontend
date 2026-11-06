import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { loadKakaoMaps } from '../../lib/kakaoMap';
import './Map.css';

export interface MapMarker {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  // 배열이 바뀔 때마다 마커를 다시 그리고 지도 범위를 다시 맞춘다 — 부모에서 useMemo로 넘길 것.
  markers: MapMarker[];
  activeId?: number | null;
  onMarkerClick?: (id: number) => void;
  onMarkerHover?: (id: number, hovering: boolean) => void;
  // UI v0.4 §3 지도 레이아웃의 [지도|경사도|로드뷰] 세그먼트와 확대·축소 버튼
  controls?: boolean;
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
  onMarkerClick,
  onMarkerHover,
  controls = false,
}: MapViewProps & { appKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
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
      el.className = 'map-marker';
      el.textContent = marker.label;
      el.addEventListener('click', () => handleClick(marker.id));
      el.addEventListener('mouseenter', () => handleHover(marker.id, true));
      el.addEventListener('mouseleave', () => handleHover(marker.id, false));
      const overlay = new kakao.maps.CustomOverlay({ position, content: el, clickable: true });
      overlay.setMap(map);
      registry.set(marker.id, { el, overlay });
      bounds.extend(position);
    }
    if (markers.length === 1) {
      map.setCenter(new kakao.maps.LatLng(markers[0].latitude, markers[0].longitude));
    } else if (markers.length > 1) {
      map.setBounds(bounds, 80, 80, 80, 80);
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
      overlay.setZIndex(active ? 2 : 1);
    });
  }, [activeId, map, markers]);

  const zoom = (delta: number) => {
    if (map) map.setLevel(map.getLevel() + delta, { animate: true });
  };

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-view__canvas" />
      {failed && <p className="map-view__message">지도를 불러오지 못했어요.</p>}
      {controls && (
        <>
          <div className="map-view__segment">
            <button type="button" className="is-active" aria-pressed="true">
              지도
            </button>
            <button type="button" disabled title="준비 중인 기능이에요.">
              경사도
            </button>
            <button type="button" disabled title="준비 중인 기능이에요.">
              로드뷰
            </button>
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
    </div>
  );
}
