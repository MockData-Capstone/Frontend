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
