import type { MapMarker } from '../../components/Map';
import type { Candidate, SlopeGrade, SlopeInfo, VehicleAccess, VehicleInfo } from '../../types';

// 경사 등급 명칭은 PRD 4장, 진입성 판정 명칭은 기능명세서 LOC-02를 따른다.
export function gradeLabel(grade: SlopeGrade): string {
  switch (grade) {
    case 'GENTLE':
      return '완만';
    case 'MODERATE':
      return '보통';
    case 'STEEP':
      return '가파름';
  }
}

export function vehicleLabel(access: VehicleAccess): string {
  switch (access) {
    case 'POSSIBLE':
      return '가능';
    case 'LIMITED':
      return '제한적';
    case 'IMPOSSIBLE':
      return '불가';
    case 'UNKNOWN':
      return '판단 불가';
  }
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

// 산출하지 못한 항목은 "정보 없음"으로 보여준다 (LOC-03).
export function slopeSummary(slope: SlopeInfo | null): string {
  if (!slope || slope.averagePercent === null) return '경사 정보 없음';
  const grade = slope.grade ? ` · ${gradeLabel(slope.grade)}` : '';
  return `평균 경사 ${formatPercent(slope.averagePercent)}${grade}`;
}

export function vehicleSummary(vehicle: VehicleInfo | null): string {
  return vehicle ? `차량 진입 ${vehicleLabel(vehicle.access)}` : '차량 진입 정보 없음';
}

// 배지 글자는 목록 순서대로 A, B, C … (백엔드는 추가한 순서로 준다)
export function badgeLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

export function toMarkers(candidates: Candidate[]): MapMarker[] {
  return candidates.map((c, i) => ({
    id: c.candidateId,
    label: badgeLetter(i),
    latitude: c.latitude,
    longitude: c.longitude,
  }));
}
