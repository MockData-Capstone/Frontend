import { useEffect, useState } from 'react';
import { loadKakaoMaps } from '../lib/kakaoMap';
import { nearestPanoId, type RoadviewState } from '../lib/roadview';

const APP_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY;

interface Point {
  id: number;
  latitude: number | null;
  longitude: number | null;
}

// 후보지마다 반경 안에 로드뷰가 있는지(차량 진입 1차 판단)를 확인한다. { 후보지 ID: 상태 }
// 결과가 오기 전이면 'checking', 좌표가 없거나 지도 SDK를 못 불러오면 'unavailable'.
export function useRoadviewAccess(points: Point[]): Record<number, RoadviewState> {
  const [results, setResults] = useState<Record<string, RoadviewState>>({});
  const keyOf = (p: Point) => `${p.latitude},${p.longitude}`;
  const wanted = points.filter((p) => p.latitude !== null && p.longitude !== null);
  const signature = [...new Set(wanted.map(keyOf))].sort().join('|');

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    const coords = signature.split('|').map((key) => key.split(',').map(Number) as [number, number]);
    const done = (key: string, state: RoadviewState) => {
      if (!cancelled) setResults((current) => (current[key] === state ? current : { ...current, [key]: state }));
    };
    const ready = APP_KEY ? loadKakaoMaps(APP_KEY) : Promise.reject(new Error('카카오 JS 키 없음'));
    ready
      .then(() => {
        for (const [latitude, longitude] of coords) {
          nearestPanoId(latitude, longitude)
            .then((panoId) => done(`${latitude},${longitude}`, panoId === null ? 'none' : 'found'))
            .catch(() => done(`${latitude},${longitude}`, 'unavailable'));
        }
      })
      .catch(() => coords.forEach(([latitude, longitude]) => done(`${latitude},${longitude}`, 'unavailable')));
    return () => {
      cancelled = true;
    };
  }, [signature]);

  const states: Record<number, RoadviewState> = {};
  for (const p of points) {
    states[p.id] = p.latitude === null || p.longitude === null ? 'unavailable' : (results[keyOf(p)] ?? 'checking');
  }
  return states;
}
