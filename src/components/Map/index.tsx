import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { loadKakaoMaps } from '../../lib/kakaoMap';
import { bearingDegrees, distanceMeters, nearestPanoId, ROADVIEW_RADIUS_M } from '../../lib/roadview';
import './Map.css';
import {
  clampRect,
  dockedRect,
  isFull,
  moveRect,
  PRESETS,
  resizeRect,
  visibleCenter,
  type Box,
  type PresetId,
  type Rect,
} from './pip';

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

export interface RoadviewTarget {
  latitude: number;
  longitude: number;
  // 있으면 로드뷰를 이 장소 쪽으로 돌려서 연다 (후보지 상세)
  name?: string;
}

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
  roadviewAt?: RoadviewTarget | null;
  // 로드뷰 창이 열리고 닫힐 때 (부모 버튼 문구를 맞춘다)
  onRoadviewChange?: (open: boolean) => void;
  // 지도 위 안내 상자 (예: "AI 추천 2곳 / 저장한 후보지 3곳")
  info?: { title: string; detail?: string } | null;
}

const APP_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY;
// 마커가 없을 때 보여줄 위치: 입지 분석 시범 지역인 대구(시청)
const DEFAULT_CENTER = { latitude: 35.8714, longitude: 128.6014 };

// 로드뷰는 지도 위에 떠 있는 PiP 창으로 연다. 창 크기는 이 브라우저에 기억한다(위치는 열려 있는 동안만).
const PIP_KEY = 'zipfit.roadview.pip';

function loadPipSize(): Box | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PIP_KEY) ?? 'null') as Box | null;
    return saved && saved.w > 0 && saved.h > 0 ? saved : null;
  } catch {
    return null;
  }
}

function savePipSize(size: Box) {
  try {
    localStorage.setItem(PIP_KEY, JSON.stringify({ w: Math.round(size.w), h: Math.round(size.h) }));
  } catch {
    // 저장이 막혀도 이번 화면에서는 그대로 쓴다
  }
}

type RoadviewStatus =
  | { kind: 'loading' }
  | { kind: 'none' }
  // distance: 파노라마를 다 불러와 위치를 알게 되면 채운다
  | { kind: 'found'; distance: number | null };

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
  onRoadviewChange,
  info = null,
}: MapViewProps & { appKey: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const roadviewRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ container: HTMLElement; viewer: kakao.maps.Roadview } | null>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [layer, setLayer] = useState<MapLayer>('map');
  const [roadview, setRoadview] = useState<RoadviewTarget | null>(null);
  const [status, setStatus] = useState<RoadviewStatus>({ kind: 'loading' });
  // pipSize: 사용자가 마지막에 맞춘 창 크기, placed: 열려 있는 동안 옮기거나 키운 자리(없으면 오른쪽 아래에 붙인다)
  const [pipSize, setPipSize] = useState<Box | null>(loadPipSize);
  const [placed, setPlaced] = useState<Rect | null>(null);
  const [rootBox, setRootBox] = useState<Box>({ w: 0, h: 0 });
  // 지금 PiP 창의 자리(지도 크기를 재기 전이면 null)
  const pip = rootBox.w > 0 ? clampRect(placed ?? dockedRect(rootBox, pipSize), rootBox) : null;
  const full = pip !== null && isFull(pip, rootBox);
  const markerRefs = useRef(
    new Map<number, { el: HTMLButtonElement; overlay: kakao.maps.CustomOverlay }>(),
  );

  const handleClick = useEffectEvent((id: number) => onMarkerClick?.(id));
  const handleHover = useEffectEvent((id: number, hovering: boolean) => onMarkerHover?.(id, hovering));
  const notifyRoadview = useEffectEvent((open: boolean) => onRoadviewChange?.(open));
  // 로드뷰 자리를 지도에서 PiP 창에 가리지 않는 곳에 보이게 옮긴다.
  const reveal = useEffectEvent((position: kakao.maps.LatLng) => {
    if (!map) return;
    map.setCenter(position);
    const target = visibleCenter(pip, rootBox);
    const dx = Math.round(rootBox.w / 2 - target.x);
    const dy = Math.round(rootBox.h / 2 - target.y);
    if (dx || dy) map.panBy(dx, dy);
  });
  const openRoadviewAt = useEffectEvent((target: RoadviewTarget) => {
    setStatus({ kind: 'loading' });
    setRoadview(target);
  });

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
      openRoadviewAt({ latitude: event.latLng.getLat(), longitude: event.latLng.getLng() });
    if (layer === 'roadview') kakao.maps.event.addListener(map, 'click', onClick);
    return () => {
      map.removeOverlayMapTypeId(overlay);
      if (layer === 'roadview') kakao.maps.event.removeListener(map, 'click', onClick);
    };
  }, [map, layer]);

  const closeRoadview = () => setRoadview(null);

  const [roadviewRequest, setRoadviewRequest] = useState(roadviewAt);
  if (roadviewAt !== roadviewRequest) {
    setRoadviewRequest(roadviewAt);
    if (roadviewAt) {
      setStatus({ kind: 'loading' });
      setRoadview(roadviewAt);
    } else {
      setRoadview(null);
    }
  }

  useEffect(() => {
    notifyRoadview(roadview !== null);
  }, [roadview]);

  // 로드뷰 창: 반경 안의 가장 가까운 파노라마를 띄우고, 지도에 지금 보는 자리·방향을 핀으로 표시한다.
  // 장소(target.name)가 있으면 그쪽을 바라보게 돌린다.
  useEffect(() => {
    if (!map || !roadview || !roadviewRef.current) return;
    const requested = new kakao.maps.LatLng(roadview.latitude, roadview.longitude);
    // 로드뷰 창 하나에 뷰어는 하나만 만든다. 같은 칸에 뷰어를 또 만들면(개발 모드의 effect 두 번 실행 등) 사진을 불러오지 못한다.
    // 창을 닫으면 칸이 없어지므로 다음에 열 때 새로 만든다.
    const container = roadviewRef.current;
    if (viewerRef.current?.container !== container) {
      viewerRef.current = { container, viewer: new kakao.maps.Roadview(container) };
    }
    const { viewer } = viewerRef.current;
    const pinEl = document.createElement('div');
    pinEl.className = 'map-roadview-pin';
    pinEl.innerHTML = '<span class="map-roadview-pin__cone"></span><span class="map-roadview-pin__dot"></span>';
    pinEl.setAttribute('aria-hidden', 'true');
    const pin = new kakao.maps.CustomOverlay({ position: requested, content: pinEl, zIndex: 4 });
    let cancelled = false;

    const syncPin = () => {
      const position = viewer.getPosition();
      pin.setMap(map);
      pin.setPosition(position);
      pinEl.style.setProperty('--pan', `${viewer.getViewpoint().pan}deg`);
    };
    const onInit = () => {
      if (cancelled) return;
      const position = viewer.getPosition();
      const here = { latitude: position.getLat(), longitude: position.getLng() };
      setStatus({ kind: 'found', distance: Math.round(distanceMeters(here, roadview)) });
      if (roadview.name) {
        viewer.setViewpoint({ pan: bearingDegrees(here, roadview), tilt: 0, zoom: 0 });
      }
      syncPin();
      reveal(position);
    };
    kakao.maps.event.addListener(viewer, 'init', onInit);
    kakao.maps.event.addListener(viewer, 'position_changed', syncPin);
    kakao.maps.event.addListener(viewer, 'viewpoint_changed', syncPin);

    nearestPanoId(roadview.latitude, roadview.longitude, ROADVIEW_RADIUS_M)
      .then((panoId) => {
        if (cancelled) return;
        if (panoId === null) {
          // 로드뷰가 없는 자리도 어디를 확인했는지 보이게 빨간 점으로 표시한다
          setStatus({ kind: 'none' });
          pinEl.classList.add('is-none');
          pin.setMap(map);
          reveal(requested);
          return;
        }
        // 판정은 파노라마가 있는지로 바로 알 수 있으니, 사진을 다 불러오기 전에 먼저 알린다.
        setStatus({ kind: 'found', distance: null });
        viewer.setPanoId(panoId, requested);
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: 'none' });
      });
    return () => {
      cancelled = true;
      kakao.maps.event.removeListener(viewer, 'init', onInit);
      kakao.maps.event.removeListener(viewer, 'position_changed', syncPin);
      kakao.maps.event.removeListener(viewer, 'viewpoint_changed', syncPin);
      pin.setMap(null);
    };
  }, [map, roadview]);

  // 창 크기가 바뀌면 지도·로드뷰를 새 크기에 맞춘다(카카오 지도는 컨테이너 크기를 스스로 다시 재지 않는다).
  useEffect(() => {
    if (!map) return;
    const target = roadviewRef.current;
    const relayout = () => {
      map.relayout();
      viewerRef.current?.viewer.relayout();
    };
    relayout();
    if (!target || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(relayout);
    observer.observe(target);
    return () => observer.disconnect();
  }, [map, roadview]);

  // 지도 영역 크기를 재 둔다(PiP 창을 지도 안에 맞추는 데 쓴다).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setRootBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Esc로 로드뷰를 닫는다.
  useEffect(() => {
    if (!roadview) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setRoadview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roadview]);

  // 창을 끌어 옮기거나(머리줄) 모서리를 끌어 크기를 바꾼다. 크기를 바꾸면 끝날 때 기억한다.
  const drag = (e: PointerEvent<HTMLElement>, apply: (dx: number, dy: number) => Rect, remember: boolean) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let last: Rect | null = null;
    const move = (ev: globalThis.PointerEvent) => {
      last = apply(ev.clientX - startX, ev.clientY - startY);
      setPlaced(last);
    };
    const stop = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
      if (remember && last && !isFull(last, rootBox)) {
        setPipSize({ w: last.w, h: last.h });
        savePipSize(last);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  };

  const startMove = (e: PointerEvent<HTMLElement>) => {
    if (!pip || (e.target as HTMLElement).closest('button')) return;
    drag(e, (dx, dy) => moveRect(pip, dx, dy, rootBox), false);
  };

  const startResize = (corner: 'nw' | 'se') => (e: PointerEvent<HTMLElement>) => {
    if (!pip) return;
    e.stopPropagation();
    drag(e, (dx, dy) => resizeRect(pip, corner, dx, dy, rootBox), true);
  };

  // 왼쪽 위 손잡이에서 방향키: ←↑ 키우기, →↓ 줄이기 (오른쪽 아래 모서리는 그대로)
  const resizeByKey = (e: KeyboardEvent<HTMLElement>) => {
    if (!pip) return;
    const step = e.shiftKey ? 60 : 20;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (!(e.key in delta)) return;
    e.preventDefault();
    const next = resizeRect(pip, 'nw', delta[e.key][0], delta[e.key][1], rootBox);
    setPlaced(next);
    setPipSize({ w: next.w, h: next.h });
    savePipSize(next);
  };

  const applyPreset = (preset: PresetId) => {
    const next = dockedRect(rootBox, null, preset);
    setPlaced(next);
    if (preset !== 'large') {
      setPipSize({ w: next.w, h: next.h });
      savePipSize(next);
    }
  };

  const lookAtTarget = () => {
    const viewer = viewerRef.current?.viewer;
    if (!viewer || !roadview) return;
    const position = viewer.getPosition();
    const here = { latitude: position.getLat(), longitude: position.getLng() };
    viewer.setViewpoint({ pan: bearingDegrees(here, roadview), tilt: 0, zoom: 0 });
  };

  const zoom = (delta: number) => {
    if (map) map.setLevel(map.getLevel() + delta, { animate: true });
  };

  const LAYERS: { id: MapLayer; label: string }[] = [
    { id: 'map', label: '지도' },
    { id: 'terrain', label: '경사도' },
    { id: 'roadview', label: '로드뷰' },
  ];

  const open = roadview !== null;

  return (
    <div ref={rootRef} className={`map-view${open ? ' has-roadview' : ''}${full ? ' is-roadview-full' : ''}`}>
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
      {(info || layer !== 'map') && !open && (
        <div className="map-view__info" role="status">
          {layer === 'terrain' ? (
            <>
              <strong>경사도 보기</strong>
              <span>지형 음영으로 언덕을 보여줘요. 후보지별 경사 수치는 상세에서 확인하세요.</span>
            </>
          ) : layer === 'roadview' ? (
            <>
              <strong>로드뷰 보기 · 차량 진입</strong>
              <span>
                파란 길은 로드뷰 촬영 차량이 다닌 길이라 <b>차량 진입 가능</b>, 파란 길이 {ROADVIEW_RADIUS_M}m 안에 없으면{' '}
                <b>진입 불가</b>로 봐요. 지도를 누르면 그 자리를 확인하고 로드뷰를 열어요.
              </span>
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
        <section
          className={`map-view__roadview${full ? ' is-full' : ''}`}
          style={pip ? { left: pip.x, top: pip.y, width: pip.w, height: pip.h } : { visibility: 'hidden' }}
          aria-label="로드뷰"
        >
          <span
            className="map-view__roadview-corner map-view__roadview-corner--nw"
            role="separator"
            aria-label="로드뷰 창 크기 조절 (방향키: ←↑ 키우기, →↓ 줄이기)"
            tabIndex={0}
            onPointerDown={startResize('nw')}
            onKeyDown={resizeByKey}
          />
          <span
            className="map-view__roadview-corner map-view__roadview-corner--se"
            aria-hidden="true"
            onPointerDown={startResize('se')}
          />
          <div
            className="map-view__roadview-bar"
            title="끌어서 옮기기 · 두 번 누르면 크게/보통"
            onPointerDown={startMove}
            onDoubleClick={(e) => {
              if (!(e.target as HTMLElement).closest('button')) applyPreset(full ? 'medium' : 'large');
            }}
          >
            <p className={`map-view__roadview-status is-${status.kind}`} role="status">
              {status.kind === 'loading' && '로드뷰를 찾고 있어요…'}
              {status.kind === 'found' && (
                <>
                  <b>차량 진입 가능</b>
                  <span>
                    {status.distance === null
                      ? `${ROADVIEW_RADIUS_M}m 안에 로드뷰 길이 있어요 · 사진을 불러오는 중`
                      : `로드뷰 길까지 ${status.distance}m${roadview.name ? ` · ${roadview.name} 쪽을 보고 있어요` : ''}`}
                  </span>
                </>
              )}
              {status.kind === 'none' && (
                <>
                  <b>차량 진입 불가</b>
                  <span>
                    {ROADVIEW_RADIUS_M}m 안에 로드뷰 길이 없어요.{layer === 'roadview' ? ' 파란 길 위를 눌러 보세요.' : ''}
                  </span>
                </>
              )}
            </p>
            <div className="map-view__roadview-actions">
              {roadview.name && status.kind === 'found' && (
                <button type="button" onClick={lookAtTarget} title={`${roadview.name} 쪽으로 시점 돌리기`}>
                  후보지 쪽 보기
                </button>
              )}
              <div className="map-view__roadview-sizes" role="group" aria-label="로드뷰 크기">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={preset.id === 'large' ? full : undefined}
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button type="button" className="map-view__roadview-close" onClick={closeRoadview}>
                닫기
              </button>
            </div>
          </div>
          <div ref={roadviewRef} className="map-view__roadview-canvas" />
          {status.kind === 'none' && (
            <p className="map-view__roadview-note">
              이 근처({ROADVIEW_RADIUS_M}m 안)에는 로드뷰가 없어요. 로드뷰 촬영 차량이 다니지 않은 곳이라 차량 진입 불가로 봐요.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
