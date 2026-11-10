import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Run the production hooks with controlled React state and socket notifications.
// HTTP calls still use the production API clients; no DOM or layout is replaced in the app.
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  resolve: { alias: [
    { find: /^react$/, replacement: 'test-react' },
    { find: /^(?:\.\.\/)+app\/providers\/useWorkspaceSocket$/, replacement: 'test-socket' },
  ] },
  cacheDir: 'node_modules/.vite-tour-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
  plugins: [{ name: 'controlled-hook-runtime',
    resolveId(source, importer) {
      if (source === 'test-react' || source === 'react' && importer?.replaceAll('\\', '/').includes('/src/')) return '\0test-react';
      if (source === 'test-socket' || source.endsWith('/useWorkspaceSocket')) return '\0test-socket';
    },
    load(id) {
      if (id === '\0test-react') return `
        export const control = { states: [], cleanups: [] };
        export function useState(initial) {
          const index = control.states.length;
          control.states.push(typeof initial === 'function' ? initial() : initial);
          return [control.states[index], value => { control.states[index] = typeof value === 'function' ? value(control.states[index]) : value; }];
        }
        export const useCallback = fn => fn;
        export const useEffect = fn => { control.cleanups.push(fn()); };
      `;
      if (id === '\0test-socket') return `
        export const control = { reconnect: [], messages: [] };
        export const useWorkspaceReconnect = fn => { control.reconnect.push(fn); };
        export const useWorkspaceMessages = fn => { control.messages.push(fn); };
      `;
    },
  }],
});
const originalWindow = globalThis.window;
globalThis.window = { location: { origin: 'http://localhost:5173', pathname: '/' } };
const { control: react } = await server.ssrLoadModule('test-react');
const { control: socket } = await server.ssrLoadModule('test-socket');
const session = await server.ssrLoadModule('/src/lib/api.ts');
const { useTourStatus } = await server.ssrLoadModule('/src/hooks/useTourStatus.ts');
const { default: TourBanner } = await server.ssrLoadModule('/src/components/Tour/index.tsx');
const flush = () => new Promise((resolve) => setImmediate(resolve));
let currentTour, history, games, failed;
beforeEach(() => {
  for (const cleanup of react.cleanups) cleanup?.();
  react.cleanups.length = 0; react.states.length = 0;
  socket.reconnect.length = 0; socket.messages.length = 0;
  currentTour = null; history = []; games = []; failed = false;
  session.api.defaults.adapter = async (config) => {
    if (failed) throw new Error('Offline');
    const data = config.url.endsWith('/tours/current') ? { tour: currentTour }
      : config.url.endsWith('/tours') ? { items: history } : { items: games };
    return { data, status: 200, headers: {}, config };
  };
});
after(async () => { for (const cleanup of react.cleanups) cleanup?.(); globalThis.window = originalWindow; await server.close(); });

test('a tour started while disconnected is loaded again when the workspace reconnects', async () => {
  useTourStatus(7); await flush();
  assert.equal(react.states[0].tour, null);
  currentTour = { tourId: 42, visitor: { userId: 2 } };
  for (const reconnect of socket.reconnect) reconnect();
  await flush(); assert.deepEqual(react.states[0].tour, currentTour);
});
test('a missed tour end updates history, while a failed resync preserves the last known status', async () => {
  currentTour = { tourId: 42 };
  useTourStatus(7); await flush();
  failed = true; for (const reconnect of socket.reconnect) reconnect();
  await flush(); assert.equal(react.states[0].tour.tourId, 42);
  failed = false; currentTour = null; history = [{ startedAt: '2026-11-11T01:00:00Z' }];
  for (const reconnect of socket.reconnect) reconnect();
  await flush(); assert.deepEqual(react.states[0], { tour: null, lastEndedTourStartedAt: history[0].startedAt });
});
test('a missed game completion refreshes the existing tour banner after reconnect', async () => {
  TourBanner({ workspaceId: 7, meId: 2 }); await flush();
  assert.equal(react.states[1], null);
  games = [{ gameId: 5, status: 'ABORTED' }, { gameId: 4, status: 'FINISHED', visitor: { userId: 2 } }];
  for (const reconnect of socket.reconnect) reconnect();
  await flush(); assert.equal(react.states[1].gameId, 4);
});
