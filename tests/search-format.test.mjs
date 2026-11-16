import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// 채팅 시각은 기기 시간대를 따른다 — 테스트는 한국 시간으로 고정한다.
process.env.TZ = 'Asia/Seoul';

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-format-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const format = await server.ssrLoadModule('/src/lib/conditionFormat.ts');
const time = await server.ssrLoadModule('/src/lib/time.ts');

const empty = {
  depositMin: null, depositMax: null, monthlyRentMin: null, monthlyRentMax: null,
  roomType: null, areaMin: null, areaMax: null, avoidSlope: null, needVehicleAccess: null,
};

test('money ranges share the unit below 1억 and spell out 억 above it', () => {
  assert.equal(format.formatManwonRange(0, 1000), '0~1,000만');
  assert.equal(format.formatManwonRange(30, 60), '30~60만');
  assert.equal(format.formatManwonRange(null, 60), '~60만');
  assert.equal(format.formatManwonRange(500, null), '500만~');
  assert.equal(format.formatManwonRange(5000, 15000), '5,000만~1억 5,000만');
  assert.equal(format.formatManwonRange(null, 20000), '~2억');
  assert.equal(format.formatManwonRange(null, null), null);
});

test('area ranges keep one decimal and the ㎡ unit', () => {
  assert.equal(format.formatAreaRange(40, 60), '40~60㎡');
  assert.equal(format.formatAreaRange(null, 33.05), '~33.1㎡');
  assert.equal(format.formatAreaRange(12.5, null), '12.5㎡~');
  assert.equal(format.formatAreaRange(null, null), null);
});

test('condition summary keeps the agreed order and skips empty or switched-off items', () => {
  assert.deepEqual(
    format.conditionSummary({
      ...empty, depositMin: 0, depositMax: 1000, monthlyRentMax: 60, roomType: 'TWO_ROOM',
      areaMin: 40, areaMax: 60, avoidSlope: false, needVehicleAccess: true,
    }),
    ['보증금 0~1,000만', '월세 ~60만', '투룸', '40~60㎡', '차량 진입 필요'],
  );
  assert.deepEqual(format.conditionSummary({ ...empty, roomType: 'THREE_ROOM_OR_MORE', avoidSlope: true }), ['쓰리룸 이상', '경사 피하기']);
  assert.deepEqual(format.conditionSummary(empty), []);
});

test('extracted extras list region, destinations and facilities only when present', () => {
  assert.deepEqual(
    format.extractedExtras({ ...empty, region: '성수동', destinations: ['강남역'], facilities: ['지하철역', '마트'] }),
    ['지역 성수동', '목적지 강남역', '편의시설 지하철역, 마트'],
  );
  assert.deepEqual(format.extractedExtras({ ...empty, region: null, destinations: [], facilities: [] }), []);
});

test('chat time shows only the time today and adds the date on other days', () => {
  const now = Date.parse('2026-11-16T07:00:00Z'); // 한국 시간 오후 4시
  assert.equal(time.formatChatTime('2026-11-16T06:20:00.123456Z', now), '오후 3:20');
  assert.equal(time.formatChatTime('2026-11-15T01:05:00Z', now), '11월 15일 오전 10:05');
  assert.equal(time.formatChatTime('invalid', now), '');
});
