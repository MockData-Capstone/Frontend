// 로드뷰 PiP 창의 위치·크기 계산. 지도 영역(root) 안 픽셀 좌표로 다룬다.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  w: number;
  h: number;
}

// 모서리: 끈 모서리의 반대쪽 모서리를 고정한 채 크기를 바꾼다
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export const MARGIN = 12;
// 머리줄 단추가 한 줄에 들어가는 최소 폭
export const MIN_W = 280;
export const MIN_H = 200;
// 좁은 화면(휴대폰)에서는 폭을 지도에 꽉 채운다
const NARROW = 600;

// [작게 · 보통 · 크게]. 크게는 지도 전체를 덮는다.
export const PRESETS = [
  { id: 'small', label: '작게', w: 0.34, h: 0.4 },
  { id: 'medium', label: '보통', w: 0.5, h: 0.55 },
  { id: 'large', label: '크게', w: 1, h: 1 },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];

// 지도 안에 들어오도록 크기·위치를 맞춘다. 지도가 최소 크기보다 작으면 지도에 맞춘다.
export function clampRect(rect: Rect, root: Box): Rect {
  const maxW = Math.max(0, root.w - MARGIN * 2);
  const maxH = Math.max(0, root.h - MARGIN * 2);
  const w = Math.min(Math.max(rect.w, Math.min(MIN_W, maxW)), maxW);
  const h = Math.min(Math.max(rect.h, Math.min(MIN_H, maxH)), maxH);
  const x = Math.min(Math.max(rect.x, MARGIN), root.w - MARGIN - w);
  const y = Math.min(Math.max(rect.y, MARGIN), root.h - MARGIN - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

// 오른쪽 아래에 붙인 창. size가 있으면(사용자가 마지막에 맞춘 크기) 그 크기, 없으면 프리셋 비율.
export function dockedRect(root: Box, size: Box | null, preset: PresetId = 'medium'): Rect {
  const p = PRESETS.find((item) => item.id === preset) ?? PRESETS[1];
  const narrow = root.w < NARROW;
  const w = preset === 'large' || narrow ? root.w : (size?.w ?? root.w * p.w);
  const h = preset === 'large' ? root.h : (size?.h ?? root.h * (narrow ? Math.max(p.h, 0.45) : p.h));
  return clampRect({ x: root.w - MARGIN - w, y: root.h - MARGIN - h, w, h }, root);
}

export function moveRect(start: Rect, dx: number, dy: number, root: Box): Rect {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, root);
}

export function resizeRect(start: Rect, corner: Corner, dx: number, dy: number, root: Box): Rect {
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const maxW = (west ? right : root.w - start.x) - MARGIN;
  const maxH = (north ? bottom : root.h - start.y) - MARGIN;
  const w = Math.min(Math.max(start.w + (west ? -dx : dx), MIN_W), Math.max(MIN_W, maxW));
  const h = Math.min(Math.max(start.h + (north ? -dy : dy), MIN_H), Math.max(MIN_H, maxH));
  return clampRect({ x: west ? right - w : start.x, y: north ? bottom - h : start.y, w, h }, root);
}

export function isFull(rect: Rect, root: Box) {
  return rect.w >= root.w - MARGIN * 2 - 1 && rect.h >= root.h - MARGIN * 2 - 1;
}

// 지도에서 PiP 창에 가리지 않는 부분의 가운데 (창이 오른쪽에 있으면 왼쪽 빈 곳, 아래에 있으면 위쪽 빈 곳)
export function visibleCenter(rect: Rect | null, root: Box): { x: number; y: number } {
  const center = { x: root.w / 2, y: root.h / 2 };
  if (!rect || isFull(rect, root)) return center;
  const left = rect.x;
  const right = root.w - (rect.x + rect.w);
  const top = rect.y;
  const bottom = root.h - (rect.y + rect.h);
  const best = Math.max(left / root.w, right / root.w, top / root.h, bottom / root.h);
  if (best === left / root.w) return { x: left / 2, y: center.y };
  if (best === right / root.w) return { x: root.w - right / 2, y: center.y };
  if (best === top / root.h) return { x: center.x, y: top / 2 };
  return { x: center.x, y: root.h - bottom / 2 };
}
