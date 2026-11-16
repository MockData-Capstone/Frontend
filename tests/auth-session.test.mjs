import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import axios, { AxiosError } from 'axios';
import { createServer } from 'vite';

// Vite loads the real TypeScript modules and import.meta.env; no additional test dependencies.
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: false,
  cacheDir: 'node_modules/.vite-auth-tests',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
const session = await server.ssrLoadModule('/src/lib/api.ts');
const auth = await server.ssrLoadModule('/src/lib/authApi.ts');
const originalAdapter = axios.defaults.adapter;
const originalWindow = globalThis.window;
const originalWebSocket = globalThis.WebSocket;
globalThis.window = { location: { pathname: '/workspaces', href: '/workspaces' } };

after(async () => {
  axios.defaults.adapter = originalAdapter;
  globalThis.window = originalWindow;
  globalThis.WebSocket = originalWebSocket;
  await server.close();
});

function response(config, data, status = 200) {
  return { config, data, status, statusText: String(status), headers: {} };
}

function unauthorized(config, code) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, response(config, { code }, 401));
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  session.setTokens(null);
  window.location.href = '/workspaces';
  axios.defaults.adapter = session.api.defaults.adapter = async (config) => {
    throw new Error(`Unexpected request: ${config.url}`);
  };
});

test('login and signup allow the browser to store the refresh cookie', async () => {
  const requests = [];
  session.api.defaults.adapter = async (config) => {
    requests.push(config);
    return response(config, { accessToken: 'access', tokenType: 'Bearer', accessTokenExpiresIn: 1800 });
  };
  await auth.login({ email: 'test@example.invalid', password: 'password1' });
  await auth.signUp({ email: 'test@example.invalid', password: 'password1', nickname: 'test', privacyAgreed: true });
  assert.equal(requests.length, 2);
  for (const request of requests) assert.equal(request.withCredentials, true);
});

test('startup restores a session using only the cookie and an empty request body', async () => {
  axios.defaults.adapter = async (config) => {
    assert.ok(config.url.endsWith('/api/auth/token/refresh'));
    assert.equal(config.withCredentials, true);
    assert.equal(config.data, undefined);
    assert.equal(config.headers.Authorization, undefined);
    return response(config, { accessToken: 'restored' });
  };
  await session.refreshTokens();
  assert.equal(session.getTokens().accessToken, 'restored');
});

test('concurrent startup, HTTP and socket refreshes share one rotation request', async () => {
  session.setTokens({ accessToken: 'expired' });
  const gate = deferred();
  let calls = 0;
  axios.defaults.adapter = async (config) => {
    calls += 1;
    await gate.promise;
    return response(config, { accessToken: 'renewed' });
  };
  const first = session.refreshTokens('expired');
  const second = session.refreshTokens('expired');
  assert.equal(first, second);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('an expired API request retries with the cookie-refreshed bearer token', async () => {
  session.setTokens({ accessToken: 'expired' });
  let apiCalls = 0;
  let refreshCalls = 0;
  session.api.defaults.adapter = async (config) => {
    apiCalls += 1;
    if (config.headers.Authorization === 'Bearer expired') throw unauthorized(config, 'AUTH_TOKEN_EXPIRED');
    assert.equal(config.headers.Authorization, 'Bearer renewed');
    return response(config, { items: [] });
  };
  axios.defaults.adapter = async (config) => {
    refreshCalls += 1;
    assert.equal(config.withCredentials, true);
    return response(config, { accessToken: 'renewed' });
  };
  const result = await session.api.get('/api/workspaces');
  assert.deepEqual(result.data, { items: [] });
  assert.equal(apiCalls, 2);
  assert.equal(refreshCalls, 1);
});

test('a late expiry event reuses the newer token without rotating the cookie again', async () => {
  session.setTokens({ accessToken: 'renewed' });
  const tokens = await session.refreshTokens('expired');
  assert.equal(tokens.accessToken, 'renewed');
});

test('invalid refresh cookies clear the session and require login', async () => {
  session.setTokens({ accessToken: 'expired' });
  session.api.defaults.adapter = async (config) => { throw unauthorized(config, 'AUTH_TOKEN_EXPIRED'); };
  axios.defaults.adapter = async (config) => { throw unauthorized(config, 'INVALID_REFRESH_TOKEN'); };
  await assert.rejects(session.api.get('/api/workspaces'));
  assert.equal(session.getTokens(), null);
  assert.equal(window.location.href, '/login');
});

test('the retried request cannot enter an endless refresh loop', async () => {
  session.setTokens({ accessToken: 'expired' });
  let refreshCalls = 0;
  session.api.defaults.adapter = async (config) => { throw unauthorized(config, 'AUTH_TOKEN_EXPIRED'); };
  axios.defaults.adapter = async (config) => {
    refreshCalls += 1;
    return response(config, { accessToken: 'also-expired' });
  };
  await assert.rejects(session.api.get('/api/workspaces'));
  assert.equal(refreshCalls, 1);
  assert.equal(session.getTokens(), null);
});

test('a public login rejection remains available to the login form', async () => {
  session.api.defaults.adapter = async (config) => { throw unauthorized(config, 'INVALID_CREDENTIALS'); };
  await assert.rejects(auth.login({ email: 'wrong@example.invalid', password: 'wrong' }));
  assert.equal(window.location.href, '/workspaces');
});

test('a stale refresh response cannot overwrite a newer login', async () => {
  const gate = deferred();
  axios.defaults.adapter = async (config) => {
    await gate.promise;
    return response(config, { accessToken: 'stale' });
  };
  const refresh = session.refreshTokens();
  session.setTokens({ accessToken: 'new-login' });
  gate.resolve();
  await assert.rejects(refresh, axios.isCancel);
  assert.equal(session.getTokens().accessToken, 'new-login');
});

test('logout waits for rotation, sends the cookie without a body, and prevents a new refresh', async () => {
  session.setTokens({ accessToken: 'expired' });
  const gate = deferred();
  const paths = [];
  axios.defaults.adapter = async (config) => {
    paths.push(config.url);
    assert.equal(config.withCredentials, true);
    assert.equal(config.data, undefined);
    if (config.url.endsWith('/token/refresh')) {
      await gate.promise;
      return response(config, { accessToken: 'renewed' });
    }
    assert.equal(session.getTokens().accessToken, 'renewed');
    return response(config, '', 204);
  };
  const refresh = session.refreshTokens();
  const logout = auth.logout();
  assert.equal(logout, auth.logout());
  await assert.rejects(session.refreshTokens(), axios.isCancel);
  assert.equal(paths.length, 1);
  gate.resolve();
  await Promise.all([refresh, logout]);
  assert.ok(paths[0].endsWith('/token/refresh'));
  assert.ok(paths[1].endsWith('/logout'));
  assert.equal(session.getTokens(), null);
});

test('logout also clears a cookie when no access token is held in memory', async () => {
  let calls = 0;
  axios.defaults.adapter = async (config) => {
    calls += 1;
    assert.ok(config.url.endsWith('/api/auth/logout'));
    assert.equal(config.withCredentials, true);
    assert.equal(config.headers.Authorization, undefined);
    return response(config, '', 204);
  };
  await auth.logout();
  assert.equal(calls, 1);
});

test('a failed logout preserves the session so logout can be retried', async () => {
  session.setTokens({ accessToken: 'active' });
  axios.defaults.adapter = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(auth.logout(), /Network unavailable/);
  assert.equal(session.getTokens().accessToken, 'active');
  assert.equal(window.location.href, '/workspaces');
});

class TestSocket {
  static opened = [];
  constructor(url) {
    this.url = url;
    TestSocket.opened.push(this);
  }
  close() { this.onclose?.({ code: 1000 }); }
}

test('workspace and notification sockets share renewal and reconnect with the new token', async () => {
  globalThis.WebSocket = TestSocket;
  TestSocket.opened = [];
  const { connectWorkspaceSocket } = await server.ssrLoadModule('/src/lib/websocket.ts');
  const { connectNotificationSocket } = await server.ssrLoadModule('/src/lib/notificationSocket.ts');
  session.setTokens({ accessToken: 'expired' });
  const gate = deferred();
  let refreshCalls = 0;
  axios.defaults.adapter = async (config) => {
    refreshCalls += 1;
    await gate.promise;
    return response(config, { accessToken: 'renewed' });
  };
  const handlers = { onMessage() {}, onOpenChange() {}, onRejected() {}, onReconnected() {} };
  const stopWorkspace = connectWorkspaceSocket(1, handlers);
  const stopNotifications = connectNotificationSocket(handlers);
  try {
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(TestSocket.opened.length, 2);
    for (const socket of [...TestSocket.opened]) socket.onclose({ code: 4402 });
    const refresh = session.refreshTokens('expired');
    gate.resolve();
    await refresh;
    assert.equal(refreshCalls, 1);
    assert.equal(TestSocket.opened.length, 4);
    for (const socket of TestSocket.opened.slice(2)) {
      assert.equal(new URL(socket.url).searchParams.get('token'), 'renewed');
    }
  } finally {
    stopWorkspace();
    stopNotifications();
  }
});

test('an unmounted socket cannot log out the app when its pending refresh fails', async () => {
  globalThis.WebSocket = TestSocket;
  TestSocket.opened = [];
  const { connectNotificationSocket } = await server.ssrLoadModule('/src/lib/notificationSocket.ts');
  session.setTokens({ accessToken: 'expired' });
  const gate = deferred();
  axios.defaults.adapter = async (config) => {
    await gate.promise;
    throw unauthorized(config, 'INVALID_REFRESH_TOKEN');
  };
  const stop = connectNotificationSocket({ onMessage() {}, onOpenChange() {}, onReconnected() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestSocket.opened[0].onclose({ code: 4402 });
  const refresh = session.refreshTokens('expired');
  stop();
  gate.resolve();
  await assert.rejects(refresh);
  assert.equal(window.location.href, '/workspaces');
  assert.equal(TestSocket.opened.length, 1);
});
