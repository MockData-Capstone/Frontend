import type { ExtractedConditions, HouseCondition, RoomType } from '../types/search';

// 조건 표시 형식 — 11 "함께 정한 조건"과 18 조건 확정이 같이 쓴다.
// 금액은 서버가 만원 단위로 준다. 값이 없는 항목은 빼고, 경사·차량 진입은 켠 것만 보여준다.
// 예: ["보증금 0~1,000만", "월세 ~60만", "투룸", "40~60㎡", "경사 피하기", "차량 진입 필요"]

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  ONE_ROOM: '원룸',
  TWO_ROOM: '투룸',
  THREE_ROOM_OR_MORE: '쓰리룸 이상',
};

export function roomTypeLabel(type: RoomType): string {
  return ROOM_TYPE_LABELS[type];
}

const number = (value: number) => value.toLocaleString('ko-KR');

// 만원 단위 금액 → "1,000만", "1억", "1억 5,000만"
export function formatManwon(value: number): string {
  const eok = Math.floor(value / 10000);
  const man = value % 10000;
  if (eok === 0) return `${number(man)}만`;
  return man === 0 ? `${number(eok)}억` : `${number(eok)}억 ${number(man)}만`;
}

// 있는 값만: "30~60만", "~60만", "500만~". 둘 다 1억 미만이면 단위를 끝에 한 번만 붙인다.
export function formatManwonRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return min < 10000 && max < 10000
      ? `${number(min)}~${formatManwon(max)}`
      : `${formatManwon(min)}~${formatManwon(max)}`;
  }
  if (max !== null) return `~${formatManwon(max)}`;
  if (min !== null) return `${formatManwon(min)}~`;
  return null;
}

const area = (value: number) => number(Math.round(value * 10) / 10);

// "40~60㎡", "~60㎡", "40㎡~"
export function formatAreaRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `${area(min)}~${area(max)}㎡`;
  if (max !== null) return `~${area(max)}㎡`;
  if (min !== null) return `${area(min)}㎡~`;
  return null;
}

export function conditionSummary(condition: HouseCondition): string[] {
  const deposit = formatManwonRange(condition.depositMin, condition.depositMax);
  const rent = formatManwonRange(condition.monthlyRentMin, condition.monthlyRentMax);
  return [
    deposit && `보증금 ${deposit}`,
    rent && `월세 ${rent}`,
    condition.roomType && roomTypeLabel(condition.roomType),
    formatAreaRange(condition.areaMin, condition.areaMax),
    condition.avoidSlope === true && '경사 피하기',
    condition.needVehicleAccess === true && '차량 진입 필요',
  ].filter((item): item is string => typeof item === 'string');
}

// AI가 대화에서 뽑은 조건 중 확정 조건에는 없는 항목 (지역·목적지·편의시설)
export function extractedExtras(conditions: ExtractedConditions): string[] {
  const destinations = conditions.destinations ?? [];
  const facilities = conditions.facilities ?? [];
  return [
    conditions.region ? `지역 ${conditions.region}` : null,
    destinations.length > 0 ? `목적지 ${destinations.join(', ')}` : null,
    facilities.length > 0 ? `편의시설 ${facilities.join(', ')}` : null,
  ].filter((item): item is string => item !== null);
}

// 대화에서 뽑은 조건 개수 (06-B "조건 6개") — 값이 있는 항목만 센다
export function countConditions(c: ExtractedConditions | null): number {
  if (!c) return 0;
  return [
    c.region,
    c.depositMin ?? c.depositMax,
    c.monthlyRentMin ?? c.monthlyRentMax,
    c.roomType ?? c.areaMin ?? c.areaMax,
    c.facilities?.length ? 1 : null,
    c.destinations?.length ? 1 : null,
    c.avoidSlope,
    c.needVehicleAccess,
  ].filter((v) => v !== null && v !== undefined).length;
}
