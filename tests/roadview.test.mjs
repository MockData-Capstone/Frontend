import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// 차량 진입 2단계 판단: 1차 로드뷰 유무, 2차 VLM(불법 주정차) 판정
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-roadview-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const rv = await server.ssrLoadModule('/src/lib/roadview.ts');

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
