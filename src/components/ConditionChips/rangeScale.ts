import { formatManwon } from '../../lib/conditionFormat';

// 조건 칩 슬라이더 눈금 (월세·보증금은 만원, 면적은 ㎡). 손잡이는 눈금 칸을 옮겨 다니고, 눈금 다음 마지막 칸은 '무제한'이다.
// 자주 고르는 낮은 구간은 촘촘하게, 높은 구간은 성기게 둔다.
// 최소 손잡이가 맨 왼쪽(0)이면 최소 없음, 최대 손잡이가 맨 오른쪽(무제한)이면 최대 없음 — 둘 다 서버에는 null로 보낸다.

export type ScaleKind = 'rent' | 'deposit' | 'area';
export type Thumb = 'min' | 'max';

const steps = (from: number, to: number, by: number) =>
  Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);

export const SCALES: Record<ScaleKind, readonly number[]> = {
  // 100만까지 5만 단위, 그 위는 120·150·200·300만
  rent: [...steps(0, 100, 5), 120, 150, 200, 300],
  deposit: [0, 100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000, 15000, 20000, 30000],
  // 100㎡까지 5㎡ 단위, 그 위는 120·150·200㎡
  area: [...steps(0, 100, 5), 120, 150, 200],
};

// 슬라이더 아래 눈금 글자 (눈금 칸 번호). 마지막 칸 '무제한'은 따로 붙인다.
const TICK_LABELS: Record<ScaleKind, number[]> = {
  rent: [0, 10, 20],
  deposit: [0, 4, 8, 12],
  area: [0, 6, 12, 18],
};

const SQM_PER_PYEONG = 3.3058;

// '무제한' 칸 번호 (= 눈금 개수)
export function lastIndex(kind: ScaleKind): number {
  return SCALES[kind].length;
}

// 값이 있는 칸. 눈금 사이 값(예: 보증금 1,200만)은 가장 가까운 칸에 손잡이를 둔다(손잡이를 옮기기 전까지 값은 그대로).
export function indexOf(kind: ScaleKind, value: number | null, thumb: Thumb): number {
  if (value === null) return thumb === 'min' ? 0 : lastIndex(kind);
  const scale = SCALES[kind];
  let best = 0;
  scale.forEach((tick, i) => {
    if (Math.abs(tick - value) < Math.abs(scale[best] - value)) best = i;
  });
  return best;
}

export function valueAt(kind: ScaleKind, index: number, thumb: Thumb): number | null {
  if (thumb === 'min' && index <= 0) return null;
  if (index >= lastIndex(kind)) return null;
  return SCALES[kind][index];
}

export function formatValue(kind: ScaleKind, value: number): string {
  if (kind === 'area') return `${value.toLocaleString('ko-KR')}㎡`;
  return value === 0 ? '0' : formatManwon(value);
}

// 슬라이더 위에 크게 보여줄 범위: "300만 ~ 2,000만", "60만 이하", "1억 이상", "제한 없음"
export function rangeText(kind: ScaleKind, min: number | null, max: number | null): string {
  if (min === null && max === null) return '제한 없음';
  if (min === null) return `${formatValue(kind, max as number)} 이하`;
  if (max === null) return `${formatValue(kind, min)} 이상`;
  return `${formatValue(kind, min)} ~ ${formatValue(kind, max)}`;
}

// 면적만: 평으로 바꾼 범위 "약 12평 ~ 18평". 범위가 없으면 null.
export function pyeongText(min: number | null, max: number | null): string | null {
  const pyeong = (sqm: number) => `${Math.round(sqm / SQM_PER_PYEONG)}평`;
  if (min === null && max === null) return null;
  if (min === null) return `약 ${pyeong(max as number)} 이하`;
  if (max === null) return `약 ${pyeong(min)} 이상`;
  return `약 ${pyeong(min)} ~ ${pyeong(max)}`;
}

// 화면 읽기 프로그램이 읽을 손잡이 값
export function valueText(kind: ScaleKind, value: number | null, thumb: Thumb): string {
  if (value === null) return thumb === 'min' ? '최소 없음' : '무제한';
  return formatValue(kind, value);
}

export function tickMarks(kind: ScaleKind): { index: number; label: string }[] {
  return [
    ...TICK_LABELS[kind].map((index) => ({ index, label: formatValue(kind, SCALES[kind][index]) })),
    { index: lastIndex(kind), label: '무제한' },
  ];
}
