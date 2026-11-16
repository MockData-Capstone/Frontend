import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// UI v0.4.3에서 새로 연결한 화면의 순수 로직: 분석 완료 팝업의 조건 개수, 그룹 조건 저장 값, 조건 검사, 알림 이동 경로
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-design-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const format = await server.ssrLoadModule('/src/lib/conditionFormat.ts');
const conditionApi = await server.ssrLoadModule('/src/lib/conditionApi.ts');
const groupConditions = await server.ssrLoadModule('/src/hooks/useGroupConditions.ts');
const links = await server.ssrLoadModule('/src/lib/notificationLinks.ts');

const empty = {
  depositMin: null, depositMax: null, monthlyRentMin: null, monthlyRentMax: null,
  roomType: null, areaMin: null, areaMax: null, avoidSlope: null, needVehicleAccess: null,
};

test('analysis popup counts each condition group once and skips missing ones', () => {
  assert.equal(format.countConditions(null), 0);
  assert.equal(format.countConditions({ ...empty, region: null, facilities: [], destinations: [] }), 0);
  // 지역 · 보증금 · 월세 · 방(투룸) · 편의시설 · 목적지 · 차량 = 7 (06-B "조건 7개")
  const extracted = {
    ...empty, region: '계명대역', depositMax: 1000, monthlyRentMax: 60, roomType: 'TWO_ROOM',
    facilities: ['편의점', '헬스장'], destinations: ['계명대학교'], needVehicleAccess: true,
  };
  assert.equal(format.countConditions(extracted), 7);
  // 보증금 최소·최대가 둘 다 있어도 한 개, 면적만 있어도 방·면적 한 개
  assert.equal(format.countConditions({ ...empty, region: null, facilities: [], destinations: [], depositMin: 0, depositMax: 500, areaMin: 30 }), 2);
});

test('saving group conditions sends only the condition fields', () => {
  const saved = { ...empty, depositMax: 1000, lastModifiedBy: { userId: 1, nickname: '손지은' }, updatedAt: '2026-11-17T00:00:00Z' };
  assert.deepEqual(groupConditions.pick(saved), { ...empty, depositMax: 1000 });
});

test('chip and form values are validated before saving', () => {
  assert.equal(conditionApi.validateCondition({ ...empty, monthlyRentMin: 70, monthlyRentMax: 60 }), '월세 최솟값이 최댓값보다 클 수 없어요.');
  assert.equal(conditionApi.validateCondition({ ...empty, depositMax: -1 }), '보증금은 0~1000000 범위의 정수로 입력해주세요.');
  assert.equal(conditionApi.validateCondition({ ...empty, areaMin: 33.5, areaMax: 60 }), null);
  assert.equal(conditionApi.validateCondition({ ...empty, monthlyRentMax: 60.5 }), '월세은 0~10000 범위의 정수로 입력해주세요.');
});

test('notification inbox links to the screens that now exist', () => {
  const base = { workspaceId: 3, linkActive: true };
  assert.equal(links.notificationPath({ ...base, type: 'MEMBER_JOINED' }), '/workspaces/3/settings');
  assert.equal(links.notificationPath({ ...base, type: 'ANALYSIS_COMPLETED' }), '/workspaces/3/search');
  assert.equal(links.notificationPath({ ...base, type: 'VOTE_NEEDED' }), '/workspaces/3/candidates');
  assert.equal(links.notificationPath({ ...base, type: 'TOUR_STARTED' }), '/workspaces/3/tour');
  assert.equal(links.notificationPath({ ...base, type: 'MEMBER_JOINED', linkActive: false }), null);
});
