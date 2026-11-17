import type { VehicleAccess, VehicleInfo } from '../types';

// 차량 진입 판단 (LOC-02)
// 1차: 카카오 로드뷰가 있는지. 로드뷰는 촬영 차량이 다닌 길에만 있으므로, 반경 안에 로드뷰가 있으면 진입 가능,
//      없으면 진입 불가로 본다. 카카오 JS SDK(RoadviewClient)로 브라우저에서 확인한다.
// 2차: VLM이 팀 촬영 사진에서 불법 주정차 등으로 길이 막혔는지 본 판정(백엔드 location.vehicleAccess).
//      판정이 있으면(UNKNOWN이 아니면) 그 결과를 따르고, 없으면 1차 결과를 쓴다.

export const ROADVIEW_RADIUS_M = 50;

// checking: 확인 중, found: 반경 안에 로드뷰 있음, none: 없음, unavailable: 지도 SDK를 못 불러와 확인 못 함
export type RoadviewState = 'checking' | 'found' | 'none' | 'unavailable';

export interface VehicleVerdict {
  access: VehicleAccess;
  // 최종 판정을 정한 단계
  stage: 'VLM' | 'ROADVIEW' | 'NONE';
  // 1차(로드뷰)·2차(VLM) 설명 문장
  roadview: string;
  vlm: string;
}

export function hasVlmVerdict(vehicle: VehicleInfo | null): vehicle is VehicleInfo {
  return vehicle !== null && vehicle.access !== 'UNKNOWN';
}

export function vehicleVerdict(vehicle: VehicleInfo | null, roadview: RoadviewState): VehicleVerdict {
  const roadviewText = {
    checking: '로드뷰가 있는지 확인하고 있어요.',
    found: `반경 ${ROADVIEW_RADIUS_M}m 안에 로드뷰 길이 있어요. 로드뷰 촬영 차량이 다닌 길이라 차량이 들어갈 수 있다고 봐요.`,
    none: `반경 ${ROADVIEW_RADIUS_M}m 안에 로드뷰 길이 없어 차량이 들어가기 어렵다고 봐요.`,
    unavailable: '지도를 불러오지 못해 로드뷰를 확인하지 못했어요.',
  }[roadview];
  if (hasVlmVerdict(vehicle)) {
    return {
      access: vehicle.access,
      stage: 'VLM',
      roadview: roadviewText,
      vlm: vehicle.reason ?? 'VLM이 팀 촬영 사진으로 판정했어요.',
    };
  }
  const access: VehicleAccess = roadview === 'found' ? 'POSSIBLE' : roadview === 'none' ? 'IMPOSSIBLE' : 'UNKNOWN';
  return {
    access,
    stage: access === 'UNKNOWN' ? 'NONE' : 'ROADVIEW',
    roadview: roadviewText,
    vlm: '팀이 촬영한 사진이 아직 없어 불법 주정차는 확인 전이에요.',
  };
}

const ACCESS_LABEL: Record<VehicleAccess, string> = {
  POSSIBLE: '가능',
  LIMITED: '제한적',
  IMPOSSIBLE: '불가',
  UNKNOWN: '판단 불가',
};

// 카드 한 줄: "차량 진입 가능 · 로드뷰 기준" / "차량 진입 불가 · 불법 주정차(VLM)"
export function vehicleVerdictSummary(verdict: VehicleVerdict, roadview: RoadviewState): string {
  if (verdict.stage === 'NONE' && roadview === 'checking') return '차량 진입 확인 중';
  const basis = verdict.stage === 'VLM' ? 'VLM 확인' : verdict.stage === 'ROADVIEW' ? '로드뷰 기준' : null;
  return `차량 진입 ${ACCESS_LABEL[verdict.access]}${basis ? ` · ${basis}` : ''}`;
}

// 두 좌표 사이 거리(m)
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const r = 6371000;
  const p1 = (a.latitude * Math.PI) / 180;
  const p2 = (b.latitude * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

// a에서 b를 바라보는 방위각(도, 북쪽 0 · 시계 방향). 로드뷰 시점(pan)을 후보지 쪽으로 돌릴 때 쓴다.
export function bearingDegrees(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const p1 = (a.latitude * Math.PI) / 180;
  const p2 = (b.latitude * Math.PI) / 180;
  const dl = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// 같은 좌표는 한 번만 묻는다(후보지 목록·상세·비교표가 같은 좌표를 여러 번 확인한다). 카카오 SDK가 로드된 뒤에만 부른다.
const nearest = new Map<string, Promise<number | null>>();

export function nearestPanoId(latitude: number, longitude: number, radius = ROADVIEW_RADIUS_M): Promise<number | null> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)},${radius}`;
  let found = nearest.get(key);
  if (!found) {
    found = new Promise((resolve) =>
      new kakao.maps.RoadviewClient().getNearestPanoId(new kakao.maps.LatLng(latitude, longitude), radius, resolve),
    );
    nearest.set(key, found);
  }
  return found;
}
