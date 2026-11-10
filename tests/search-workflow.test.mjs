import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-search-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
const originalWindow = globalThis.window;
const originalWebSocket = globalThis.WebSocket;
globalThis.window = { location: { origin: 'http://localhost:5173', pathname: '/' } };
after(async () => { globalThis.window = originalWindow; globalThis.WebSocket = originalWebSocket; await server.close(); });
const { mergeMessages, getMessages } = await server.ssrLoadModule('/src/lib/chatApi.ts');
const session = await server.ssrLoadModule('/src/lib/api.ts');
const message = (messageId, content = '대화') => ({ messageId, content });

test('overlapping chat history and live messages are deduplicated and chronologically ordered', () => {
  assert.deepEqual(mergeMessages([message(3), message(1)], [message(2), message(3, '최신')]), [message(1), message(2), message(3, '최신')]);
});
test('a withdrawal tombstone replaces previously visible chat content', () => {
  assert.deepEqual(mergeMessages([message(1)], [{ messageId: 1, content: null, deleted: true }]), [{ messageId: 1, content: null, deleted: true }]);
});
test('chat history preserves the server pagination cursor and surfaces request failures', async () => {
  session.api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/api/workspaces/4/messages');
    assert.deepEqual(config.params, { after: '12', size: 50 });
    throw new Error('Connection lost');
  };
  await assert.rejects(getMessages(4, { after: '12' }), /Connection lost/);
});
test('workspace messages are sent only through an open connection and retry keeps the same client id', async () => {
  class Socket {
    static OPEN = 1;
    static instances = [];
    readyState = 0;
    sent = [];
    constructor() { Socket.instances.push(this); }
    send(payload) { this.sent.push(JSON.parse(payload)); }
    close() { this.readyState = 3; }
  }
  globalThis.WebSocket = Socket;
  session.setTokens({ accessToken: 'test-access' });
  const { connectWorkspaceSocket } = await server.ssrLoadModule('/src/lib/websocket.ts');
  const connection = connectWorkspaceSocket(4, { onMessage() {}, onOpenChange() {}, onRejected() {} });
  const payload = { type: 'CHAT_SEND', data: { clientMessageId: 'same-id', content: '집을 찾아요' } };
  try {
    assert.equal(connection.send(payload), false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const socket = Socket.instances[0];
    assert.equal(connection.send(payload), false);
    socket.readyState = Socket.OPEN;
    assert.equal(connection.send(payload), true);
    assert.equal(connection.send(payload), true);
    assert.deepEqual(socket.sent, [payload, payload]);
    socket.send = () => { throw new Error('Disconnected during send'); };
    assert.equal(connection.send(payload), false);
  } finally { connection(); }
  assert.equal(connection.send(payload), false);
});

test('condition validation rejects reversed ranges, negative, fractional currency and nonfinite amounts', async () => {
  const { validateCondition, emptyCondition } = await server.ssrLoadModule('/src/lib/conditionApi.ts');
  assert.equal(validateCondition(emptyCondition), null);
  assert.equal(validateCondition({ ...emptyCondition, areaMin: 12.5, depositMin: 0 }), null);
  for (const change of [
    { depositMin: 500, depositMax: 100 }, { monthlyRentMin: -1 },
    { monthlyRentMax: 10001 }, { depositMin: 1.5 }, { areaMax: Infinity },
    { areaMin: 30, areaMax: 20 }, { areaMin: NaN },
  ]) assert.equal(typeof validateCondition({ ...emptyCondition, ...change }), 'string');
});
test('listing links reject executable or malformed URLs and allow web links', async () => {
  const { safeExternalUrl } = await server.ssrLoadModule('/src/lib/listingApi.ts');
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,test', '//example.com', 'invalid']) assert.equal(safeExternalUrl(unsafe), null);
  assert.equal(safeExternalUrl('https://example.com/search?a=1'), 'https://example.com/search?a=1');
});
test('first votes use POST, changed votes use PATCH, and server conflicts are surfaced', async () => {
  const { submitVote } = await server.ssrLoadModule('/src/lib/voteApi.ts');
  const calls = [];
  session.setTokens(null);
  session.api.defaults.adapter = async (config) => {
    calls.push({ method: config.method, url: config.url, body: JSON.parse(config.data) });
    return { data: { myChoice: JSON.parse(config.data).choice }, status: 200, headers: {}, config };
  };
  await submitVote(8, 'AGREE', null);
  await submitVote(8, 'DISAGREE', 'AGREE');
  assert.deepEqual(calls, [
    { method: 'post', url: '/api/candidates/8/votes', body: { choice: 'AGREE' } },
    { method: 'patch', url: '/api/candidates/8/votes/me', body: { choice: 'DISAGREE' } },
  ]);
  session.api.defaults.adapter = async () => { throw Object.assign(new Error('Already voted'), { response: { status: 409, data: { code: 'ALREADY_VOTED' } } }); };
  await assert.rejects(submitVote(8, 'AGREE', null), { message: 'Already voted' });
});
test('condition confirmation and full replacement preserve explicit false and null values', async () => {
  const { saveConditions, emptyCondition } = await server.ssrLoadModule('/src/lib/conditionApi.ts');
  const calls = [];
  session.api.defaults.adapter = async (config) => { calls.push(config); return { data: {}, status: 200, headers: {}, config }; };
  const value = { ...emptyCondition, avoidSlope: false, depositMin: 0 };
  await saveConditions(3, value, false);
  await saveConditions(3, value, true);
  assert.deepEqual(calls.map((config) => config.method), ['post', 'put']);
  for (const config of calls) assert.deepEqual(JSON.parse(config.data), value);
});

test('OAuth callbacks reject missing, replayed, mismatched and expired state', async () => {
  const { validateOAuthIntent } = await server.ssrLoadModule('/src/lib/oauth.ts');
  const now = 1000000;
  const intent = { provider: 'google', mode: 'login', state: 'expected', startedAt: now - 1000 };
  assert.deepEqual(validateOAuthIntent(JSON.stringify(intent), 'google', 'expected', now), intent);
  for (const [raw, provider, state, at] of [
    [null, 'google', 'expected', now], ['invalid', 'google', 'expected', now],
    [JSON.stringify(intent), 'kakao', 'expected', now], [JSON.stringify(intent), 'google', 'wrong', now],
    [JSON.stringify(intent), 'google', null, now], [JSON.stringify(intent), 'google', 'expected', now + 600000],
  ]) assert.throws(() => validateOAuthIntent(raw, provider, state, at));
});
test('account forms reject mismatched passwords and oversized, empty or unsupported uploads', async () => {
  const { validateNewPassword, validateProfileImage } = await server.ssrLoadModule('/src/lib/accountValidation.ts');
  assert.equal(validateNewPassword('Password123!', 'Password123!'), null);
  for (const [password, confirmation] of [['short1', 'short1'], ['passwordonly', 'passwordonly'], ['Password123', 'different']]) assert.ok(validateNewPassword(password, confirmation));
  assert.equal(validateProfileImage({ size: 100, type: 'image/png' }), null);
  for (const file of [{ size: 0, type: 'image/png' }, { size: 5242881, type: 'image/jpeg' }, { size: 100, type: 'image/svg+xml' }]) assert.ok(validateProfileImage(file));
});
