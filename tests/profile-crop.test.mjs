import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-crop-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const { toCropRect, PROFILE_OUTPUT_SIZE } = await server.ssrLoadModule('/src/lib/cropImage.ts');

test('a square area inside the image is rounded to whole pixels', () => {
  assert.deepEqual(toCropRect({ x: 10.4, y: 20.6, width: 300.2, height: 300.2 }, 1000, 800), { x: 10, y: 21, size: 300 });
});

test('an uneven area becomes a square using the shorter side', () => {
  assert.deepEqual(toCropRect({ x: 0, y: 0, width: 400, height: 380 }, 1000, 800), { x: 0, y: 0, size: 380 });
});

test('an area that slips past the right or bottom edge is pulled back inside', () => {
  assert.deepEqual(toCropRect({ x: 950, y: 790, width: 100, height: 100 }, 1000, 800), { x: 900, y: 700, size: 100 });
});

test('negative offsets from rounding start at the top-left corner', () => {
  assert.deepEqual(toCropRect({ x: -0.6, y: -3, width: 200, height: 200 }, 500, 500), { x: 0, y: 0, size: 200 });
});

test('the square never exceeds the shorter side of the image', () => {
  assert.deepEqual(toCropRect({ x: 0, y: 0, width: 1200, height: 1200 }, 1000, 600), { x: 0, y: 0, size: 600 });
});

test('a tiny area still keeps at least one pixel', () => {
  assert.deepEqual(toCropRect({ x: 3, y: 3, width: 0.2, height: 0.2 }, 10, 10), { x: 3, y: 3, size: 1 });
});

test('uploaded profile photos are 512 pixels square', () => {
  assert.equal(PROFILE_OUTPUT_SIZE, 512);
});
