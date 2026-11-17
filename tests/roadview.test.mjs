import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// 차량 진입 2단계 판단(1차 로드뷰 유무, 2차 VLM 불법 주정차)과 로드뷰 PiP 창 위치·크기 계산
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-roadview-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const rv = await server.ssrLoadModule('/src/lib/roadview.ts');
const pip = await server.ssrLoadModule('/src/components/Map/pip.ts');

const unknown = { access: 'UNKNOWN', reason: '팀이 촬영한 지점이 아니어서 판단할 자료가 없어요.', source: '팀 촬영 이미지 VLM', estimated: true };

test('without a VLM verdict, roadview presence decides vehicle access', () => {
  assert.equal(rv.vehicleVerdict(unknown, 'found').access, 'POSSIBLE');
  assert.equal(rv.vehicleVerdict(unknown, 'found').stage, 'ROADVIEW');
  assert.equal(rv.vehicleVerdict(null, 'none').access, 'IMPOSSIBLE');
  assert.equal(rv.vehicleVerdict(null, 'checking').stage, 'NONE');
  assert.equal(rv.vehicleVerdict(null, 'unavailable').access, 'UNKNOWN');
});

test('a VLM verdict (e.g. illegal parking) overrides the roadview result', () => {
  const blocked = { access: 'IMPOSSIBLE', reason: '골목 입구 불법 주정차 차량이 길을 막음', source: '팀 촬영 이미지 (P1)', estimated: false };
  const verdict = rv.vehicleVerdict(blocked, 'found');
  assert.equal(verdict.access, 'IMPOSSIBLE');
  assert.equal(verdict.stage, 'VLM');
  assert.equal(verdict.vlm, '골목 입구 불법 주정차 차량이 길을 막음');
  assert.equal(rv.vehicleVerdictSummary(verdict, 'found'), '차량 진입 불가 · VLM 확인');
});

test('card summary names the basis and shows checking while roadview loads', () => {
  assert.equal(rv.vehicleVerdictSummary(rv.vehicleVerdict(unknown, 'found'), 'found'), '차량 진입 가능 · 로드뷰 기준');
  assert.equal(rv.vehicleVerdictSummary(rv.vehicleVerdict(unknown, 'none'), 'none'), '차량 진입 불가 · 로드뷰 기준');
  assert.equal(rv.vehicleVerdictSummary(rv.vehicleVerdict(unknown, 'checking'), 'checking'), '차량 진입 확인 중');
  assert.equal(rv.vehicleVerdictSummary(rv.vehicleVerdict(unknown, 'unavailable'), 'unavailable'), '차량 진입 판단 불가');
});

test('distance and bearing used to face the roadview toward the candidate', () => {
  const a = { latitude: 35.85, longitude: 128.6 };
  assert.ok(Math.abs(rv.distanceMeters(a, { latitude: 35.86, longitude: 128.6 }) - 1112) < 2);
  assert.ok(Math.abs(rv.bearingDegrees(a, { latitude: 35.86, longitude: 128.6 }) - 0) < 0.01); // 북쪽
  assert.ok(Math.abs(rv.bearingDegrees(a, { latitude: 35.85, longitude: 128.61 }) - 90) < 0.1); // 동쪽
  assert.ok(Math.abs(rv.bearingDegrees(a, { latitude: 35.84, longitude: 128.6 }) - 180) < 0.01); // 남쪽
});

const root = { w: 1000, h: 600 };

test('roadview PiP docks bottom-right and stays inside the map', () => {
  assert.deepEqual(pip.dockedRect(root, null), { x: 488, y: 258, w: 500, h: 330 });
  assert.deepEqual(pip.dockedRect(root, { w: 300, h: 200 }), { x: 688, y: 388, w: 300, h: 200 });
  assert.deepEqual(pip.dockedRect(root, null, 'large'), { x: 12, y: 12, w: 976, h: 576 });
  assert.equal(pip.isFull(pip.dockedRect(root, null, 'large'), root), true);
  // 휴대폰 폭이면 가로를 꽉 채운다
  assert.equal(pip.dockedRect({ w: 343, h: 640 }, null).w, 319);
});

test('roadview PiP moves and resizes within limits', () => {
  const start = { x: 488, y: 258, w: 500, h: 330 };
  assert.deepEqual(pip.moveRect(start, -2000, -2000, root), { x: 12, y: 12, w: 500, h: 330 });
  // 왼쪽 위 모서리를 끌면 오른쪽 아래는 그대로
  assert.deepEqual(pip.resizeRect(start, 'nw', -100, -50, root), { x: 388, y: 208, w: 600, h: 380 });
  // 최소 크기 아래로는 줄지 않는다
  assert.deepEqual(pip.resizeRect(start, 'nw', 1000, 1000, root), { x: 708, y: 388, w: 280, h: 200 });
  // 오른쪽 아래 모서리는 지도 끝까지만
  assert.deepEqual(pip.resizeRect({ x: 12, y: 12, w: 300, h: 200 }, 'se', 5000, 5000, root), { x: 12, y: 12, w: 976, h: 576 });
});

test('map recenters into the part the PiP window does not cover', () => {
  // 오른쪽 아래 창(폭 500): 왼쪽 빈 곳의 가운데
  assert.deepEqual(pip.visibleCenter({ x: 488, y: 258, w: 500, h: 330 }, root), { x: 244, y: 300 });
  // 창이 없거나 지도 전체면 가운데 그대로
  assert.deepEqual(pip.visibleCenter(null, root), { x: 500, y: 300 });
  assert.deepEqual(pip.visibleCenter({ x: 12, y: 12, w: 976, h: 576 }, root), { x: 500, y: 300 });
  // 휴대폰처럼 가로를 꽉 채운 아래쪽 창: 위쪽 빈 곳의 가운데
  assert.deepEqual(pip.visibleCenter({ x: 12, y: 340, w: 319, h: 288 }, { w: 343, h: 640 }), { x: 171.5, y: 170 });
});
