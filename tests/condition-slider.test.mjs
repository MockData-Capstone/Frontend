import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-slider-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const scale = await server.ssrLoadModule('/src/components/ConditionChips/rangeScale.ts');

test('every scale climbs without repeats and ends before the 무제한 stop', () => {
  for (const kind of ['rent', 'deposit', 'area']) {
    const ticks = scale.SCALES[kind];
    assert.equal(ticks[0], 0, kind);
    ticks.slice(1).forEach((tick, i) => assert.ok(tick > ticks[i], `${kind} ${ticks[i]} → ${tick}`));
    assert.equal(scale.lastIndex(kind), ticks.length);
  }
  assert.equal(scale.SCALES.rent.at(-1), 300);
  assert.equal(scale.SCALES.deposit.at(-1), 30000);
  assert.equal(scale.SCALES.area.at(-1), 200);
});

test('empty ends sit at the far left and far right', () => {
  assert.equal(scale.indexOf('deposit', null, 'min'), 0);
  assert.equal(scale.indexOf('deposit', null, 'max'), scale.lastIndex('deposit'));
  assert.equal(scale.valueAt('deposit', 0, 'min'), null);
  assert.equal(scale.valueAt('deposit', scale.lastIndex('deposit'), 'max'), null);
});

test('values on a tick map both ways, values between ticks snap to the nearest stop', () => {
  assert.equal(scale.indexOf('rent', 60, 'max'), 12);
  assert.equal(scale.valueAt('rent', 12, 'max'), 60);
  assert.equal(scale.valueAt('deposit', 6, 'min'), 1000);
  // 1,200만은 1,000만 칸, 1,300만은 1,500만 칸
  assert.equal(scale.SCALES.deposit[scale.indexOf('deposit', 1200, 'min')], 1000);
  assert.equal(scale.SCALES.deposit[scale.indexOf('deposit', 1300, 'min')], 1500);
  // 눈금보다 큰 값은 가장 큰 눈금 칸 (무제한과 구분)
  assert.equal(scale.indexOf('deposit', 50000, 'max'), scale.lastIndex('deposit') - 1);
});

test('the big label reads like the chip: 이하·이상·범위·제한 없음', () => {
  assert.equal(scale.rangeText('rent', null, 60), '60만 이하');
  assert.equal(scale.rangeText('deposit', 300, 2000), '300만 ~ 2,000만');
  assert.equal(scale.rangeText('deposit', 10000, null), '1억 이상');
  assert.equal(scale.rangeText('deposit', 0, 1000), '0 ~ 1,000만');
  assert.equal(scale.rangeText('area', 40, 60), '40㎡ ~ 60㎡');
  assert.equal(scale.rangeText('area', null, null), '제한 없음');
  assert.equal(scale.pyeongText(40, 60), '약 12평 ~ 18평');
  assert.equal(scale.pyeongText(null, 33), '약 10평 이하');
  assert.equal(scale.pyeongText(null, null), null);
});

test('tick labels point at real stops and finish with 무제한', () => {
  for (const kind of ['rent', 'deposit', 'area']) {
    const marks = scale.tickMarks(kind);
    assert.equal(marks.at(-1).label, '무제한');
    assert.equal(marks.at(-1).index, scale.lastIndex(kind));
    marks.slice(0, -1).forEach((mark) => assert.ok(mark.index < scale.lastIndex(kind), `${kind} ${mark.label}`));
  }
  assert.deepEqual(scale.tickMarks('deposit').map((m) => m.label), ['0', '500만', '2,000만', '1억', '무제한']);
});
