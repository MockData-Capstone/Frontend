// Run only against the disposable H2 instance described in docs/api-integration.md.
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const base = 'http://127.0.0.1:8081';
if (process.env.ZIPFIT_TEST_ALLOW_WRITES !== 'isolated-h2') throw new Error('Set ZIPFIT_TEST_ALLOW_WRITES=isolated-h2 after starting the disposable H2 server. Never use the Neon server.');
process.env.VITE_API_BASE_URL = base;
globalThis.window = { location: { origin: 'http://127.0.0.1:5175', pathname: '/', href: '/' } };
const receivedMail = [];
const smtp = net.createServer((socket) => {
  socket.write('220 localhost test SMTP\r\n');
  let buffer = ''; let collecting = false; let body = '';
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (collecting) {
        if (line === '.') { receivedMail.push(body); body = ''; collecting = false; socket.write('250 queued locally\r\n'); }
        else body += `${line}\r\n`;
      } else if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n');
      else if (/^DATA/.test(line)) { collecting = true; socket.write('354 send body\r\n'); }
      else if (/^QUIT/.test(line)) { socket.end('221 bye\r\n'); }
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise((resolve, reject) => { smtp.once('error', reject); smtp.listen(2525, '127.0.0.1', resolve); });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-integration-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
const load = (name) => server.ssrLoadModule(`/src/lib/${name}.ts`);
const session = await load('api');
assert.equal(session.BASE_URL, base);
const auth = await load('authApi'), users = await load('userApi'), groups = await load('workspaceApi');
const settings = await load('workspaceSettingsApi'), chats = await load('chatApi'), recommendations = await load('recommendationApi');
const candidates = await load('candidateApi'), votes = await load('voteApi'), comparisons = await load('comparisonApi');
const conditions = await load('conditionApi'), listings = await load('listingApi'), notifications = await load('notificationApi');
const games = await load('minigameApi'), tours = await load('tourApi');
const sockets = [];
const results = [];
const stamp = Date.now().toString().slice(-7);
const password = 'ZipfitTest2026!';
async function check(name, test) { await test(); results.push(name); console.log(`PASS ${name}`); }
async function rejected(action, code) { await assert.rejects(action, (error) => error.response?.data?.code === code); }
async function register(suffix) {
  const email = `integration-${stamp}-${suffix}@example.invalid`;
  const tokens = await auth.signUp({ email, password, nickname: `시험${stamp}${suffix}`, privacyAgreed: true });
  session.setTokens(tokens); const user = await auth.getMe(); return { email, tokens, ...user };
}
function as(user) { session.setTokens(user.tokens); }
async function socket(user, workspaceId) {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws/workspaces?workspaceId=${workspaceId}&token=${encodeURIComponent(user.tokens.accessToken)}`);
  sockets.push(ws);
  const messages = [];
  ws.addEventListener('message', (event) => messages.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  return { ws, messages };
}
async function until(read, predicate, milliseconds = 10000) {
  const deadline = Date.now() + milliseconds;
  do { const value = await read(); if (predicate(value)) return value; await new Promise((resolve) => setTimeout(resolve, 100)); } while (Date.now() < deadline);
  throw new Error('Timed out waiting for the expected integration result');
}

try {
  session.setTokens(null);
  const host = await register('h'), member = await register('m'), stranger = await register('s');
  as(host); const workspace = await groups.createWorkspace({ name: '통합 검증 그룹', description: '테스트 전용' });
  const invitation = await groups.issueInvitation(workspace.id);
  as(member); await groups.acceptInvitation(invitation.token);
  await check('workspace access rejects non-members', async () => { as(stranger); await rejected(() => groups.getWorkspace(workspace.id), 'NOT_WORKSPACE_MEMBER'); });
  await check('member cannot modify host settings', async () => { as(member); await rejected(() => settings.updateWorkspace(workspace.id, { name: '거절' }), 'NOT_WORKSPACE_HOST'); });
  await check('host updates workspace and retrieves members', async () => { as(host); assert.equal((await settings.updateWorkspace(workspace.id, { name: '통합 검증 수정' })).name, '통합 검증 수정'); assert.equal((await groups.getMembers(workspace.id)).length, 2); });
  const channel = await socket(host, workspace.id);
  await socket(member, workspace.id);
  await until(() => groups.getMembers(workspace.id), (members) => members.every((item) => item.online));
  await check('chat rejects empty messages with a correlated error', async () => {
    channel.ws.send(JSON.stringify({ type: 'CHAT_SEND', data: { clientMessageId: 'empty', content: '' } }));
    const error = await until(() => channel.messages.find((message) => message.type === 'ERROR' && message.data.requestId === 'empty'), Boolean);
    assert.equal(error.data.code, 'EMPTY_MESSAGE');
  });
  await check('chat send, duplicate retry and cursor retrieval agree', async () => {
    const payload = JSON.stringify({ type: 'CHAT_SEND', data: { clientMessageId: 'retry-id', content: '성수 원룸 보증금 1000만 월세 50만으로 찾고 있어요.' } });
    channel.ws.send(payload); await until(() => channel.messages.filter((message) => message.type === 'CHAT_MESSAGE'), (items) => items.length === 1);
    channel.ws.send(payload); await until(() => channel.messages.filter((message) => message.type === 'CHAT_MESSAGE'), (items) => items.length === 2);
    as(host); const page = await chats.getMessages(workspace.id); assert.equal(page.items.length, 1);
    assert.equal((await chats.getMessages(workspace.id, { after: String(page.items[0].messageId) })).items.length, 0);
  });
  let recommendationList;
  await check('recommendation request completes and returns selectable places', async () => {
    await recommendations.requestRecommendations(workspace.id);
    recommendationList = await until(() => recommendations.getRecommendations(workspace.id), (value) => value.analysis?.status !== 'IN_PROGRESS');
    assert.equal(recommendationList.analysis.status, 'COMPLETED'); assert.ok(recommendationList.items.length >= 2);
    const event = await until(() => channel.messages.find((message) => message.type === 'RECOMMENDATION_COMPLETED'), Boolean);
    assert.ok(recommendations.refreshesRecommendations(event.type));
  });
  let first, second;
  await check('recommendations become candidates and duplicates are rejected', async () => {
    first = await candidates.addCandidate(workspace.id, recommendationList.items[0].recommendationId);
    second = await candidates.addCandidate(workspace.id, recommendationList.items[1].recommendationId);
    await rejected(() => candidates.addCandidate(workspace.id, recommendationList.items[0].recommendationId), 'DUPLICATE_CANDIDATE');
    assert.equal((await candidates.getCandidates(workspace.id)).length, 2);
  });
  await check('candidate rename and owner restrictions', async () => {
    assert.equal((await candidates.renameCandidate(first.candidateId, '첫 후보')).name, '첫 후보');
    as(member); await rejected(() => candidates.removeCandidate(first.candidateId), 'NOT_CANDIDATE_OWNER'); as(host);
  });
  await check('first vote, duplicate vote and changed vote use matching contracts', async () => {
    assert.equal((await votes.submitVote(first.candidateId, 'AGREE', null)).myChoice, 'AGREE');
    await rejected(() => votes.submitVote(first.candidateId, 'AGREE', null), 'ALREADY_VOTED');
    assert.equal((await votes.submitVote(first.candidateId, 'DISAGREE', 'AGREE')).myChoice, 'DISAGREE');
    assert.equal((await votes.getVotes(workspace.id)).find((row) => row.candidateId === first.candidateId).disagreeCount, 1);
  });
  await check('comparison retrieval and regeneration match candidate ids', async () => {
    assert.equal((await comparisons.getComparison(workspace.id)).items.length, 2);
    assert.equal((await comparisons.regenerateComparison(workspace.id, [first.candidateId, second.candidateId])).items.length, 2);
  });
  await check('listing links require confirmed conditions', async () => { await rejected(() => listings.getListingLinks(workspace.id, first.candidateId), 'CONDITION_REQUIRED'); });
  await check('condition draft, invalid ranges, confirmation and replacement', async () => {
    assert.equal((await conditions.getConditions(workspace.id)).condition, null);
    await rejected(() => conditions.saveConditions(workspace.id, { ...conditions.emptyCondition, depositMin: 1000, depositMax: 500 }, false), 'INVALID_RANGE');
    await conditions.saveConditions(workspace.id, { ...conditions.emptyCondition, depositMax: 1000, monthlyRentMax: 50 }, false);
    await rejected(() => conditions.saveConditions(workspace.id, conditions.emptyCondition, false), 'CONDITION_ALREADY_EXISTS');
    assert.equal((await conditions.saveConditions(workspace.id, { ...conditions.emptyCondition, depositMin: 0, avoidSlope: false }, true)).avoidSlope, false);
  });
  await check('condition suggestions can be accepted', async () => {
    const suggestions = await until(() => conditions.getSuggestions(workspace.id), (items) => items.length > 0);
    const accepted = await conditions.acceptSuggestion(workspace.id, suggestions[0].type); assert.ok(accepted.find((item) => item.type === suggestions[0].type).accepted);
  });
  await check('listing links expose applied and excluded conditions', async () => {
    const links = await listings.getListingLinks(workspace.id, first.candidateId); assert.ok(links.links.length > 0);
    for (const link of links.links) { assert.ok(listings.safeExternalUrl(link.url)); assert.ok(Array.isArray(link.excludedConditions)); }
  });
  const players = [host.id, member.id];
  await check('existing signup and invitation screens use matching availability and invitation contracts', async () => {
    assert.equal(await auth.checkEmailAvailability(host.email), false);
    assert.equal(await auth.checkNicknameAvailability(host.nickname), false);
    assert.equal((await groups.getCurrentInvitation(workspace.id)).token, invitation.token);
    assert.equal((await groups.getInvitationPreview(invitation.token)).workspaceName, '통합 검증 수정');
    assert.ok((await groups.getMyWorkspaces()).some((item) => item.id === workspace.id));
  });
  let roulette;
  await check('minigame setup rejects missing players and retrieves a started roulette', async () => {
    await rejected(() => games.startGame(workspace.id, { type: 'ROULETTE', participantUserIds: [host.id], visitorRule: null }), 'NOT_ENOUGH_PLAYERS');
    roulette = await games.startGame(workspace.id, { type: 'ROULETTE', participantUserIds: players, visitorRule: null });
    assert.equal((await games.getCurrentGame(workspace.id)).gameId, roulette.gameId);
    assert.equal((await games.getGame(roulette.gameId)).participants.length, 2);
    await until(() => channel.messages.find((event) => event.type === 'GAME_STARTED' && event.data.gameId === roulette.gameId), Boolean);
  });
  await check('roulette draw, result and game history agree', async () => {
    roulette = await games.drawRoulette(roulette.gameId); assert.equal(roulette.status, 'FINISHED');
    assert.ok(players.includes(roulette.visitor.userId));
    assert.equal((await games.getGame(roulette.gameId)).visitor.userId, roulette.visitor.userId);
    assert.equal((await games.getGameHistory(workspace.id))[0].gameId, roulette.gameId);
    assert.equal(await games.getCurrentGame(workspace.id), null);
  });
  await check('rock paper scissors preserves hidden choices, rejects duplicates and selects the loser', async () => {
    const game = await games.startGame(workspace.id, { type: 'ROCK_PAPER_SCISSORS', participantUserIds: players, visitorRule: 'LOSER' });
    const waiting = await games.submitChoice(game.gameId, game.currentRound, 'ROCK');
    assert.ok(waiting.submittedUserIds.includes(host.id)); assert.equal(waiting.rounds.length, 0);
    await rejected(() => games.submitChoice(game.gameId, game.currentRound, 'PAPER'), 'ALREADY_SUBMITTED');
    as(member); const result = await games.submitChoice(game.gameId, game.currentRound, 'SCISSORS');
    assert.equal(result.status, 'FINISHED'); assert.equal(result.visitor.userId, member.id); as(host);
  });
  await check('only the minigame starter can abort an active game', async () => {
    const game = await games.startGame(workspace.id, { type: 'ROULETTE', participantUserIds: players, visitorRule: null });
    as(member); await rejected(() => games.abortGame(game.gameId), 'NOT_GAME_STARTER');
    as(host); assert.equal((await games.abortGame(game.gameId)).status, 'ABORTED');
    assert.equal(await games.getCurrentGame(workspace.id), null);
  });
  let liveTour;
  await check('only the selected visitor starts the tour and obtains signaling and ICE settings', async () => {
    await rejected(() => tours.startTour(workspace.id), 'NOT_SELECTED_VISITOR');
    as(member); liveTour = await tours.startTour(workspace.id);
    assert.equal(liveTour.tour.visitor.userId, member.id); assert.ok(liveTour.signalingPath);
    assert.ok(Array.isArray(liveTour.ice.iceServers));
    assert.equal((await tours.getCurrentTour(workspace.id)).tourId, liveTour.tour.tourId);
    await until(() => channel.messages.find((event) => event.type === 'TOUR_STARTED' && event.data.tourId === liveTour.tour.tourId), Boolean);
  });
  await check('viewer participation, ICE renewal, exit and visitor rejoin follow the tour contract', async () => {
    const id = liveTour.tour.tourId;
    as(host); await rejected(() => tours.getIceServers(id), 'NOT_TOUR_PARTICIPANT');
    assert.equal((await tours.joinTour(id)).tour.participantCount, 2);
    assert.ok(Array.isArray((await tours.getIceServers(id)).iceServers));
    await rejected(() => tours.endTour(id), 'ONLY_VISITOR_ALLOWED');
    await tours.leaveTour(id); await rejected(() => tours.getIceServers(id), 'NOT_TOUR_PARTICIPANT');
    as(member); assert.equal((await tours.rejoinTour(id)).tour.tourId, id);
  });
  await check('visitor termination updates current tour, history and the workspace event', async () => {
    await tours.endTour(liveTour.tour.tourId);
    assert.equal(await tours.getCurrentTour(workspace.id), null);
    const history = await tours.getTourHistory(workspace.id);
    assert.equal(history[0].tourId, liveTour.tour.tourId); assert.equal(history[0].endReason, 'VISITOR_ENDED');
    await rejected(() => tours.startTour(workspace.id), 'TOUR_ALREADY_HELD');
    await until(() => channel.messages.find((event) => event.type === 'TOUR_ENDED' && event.data.tourId === liveTour.tour.tourId), Boolean);
  });
  await check('notification list, unread count, single read and read-all', async () => {
    as(member); const page = await notifications.getNotifications(); assert.ok(page.items.length > 0);
    assert.ok(await notifications.getUnreadCount() > 0);
    await notifications.markNotificationRead(page.items[0].notificationId); await notifications.markAllNotificationsRead();
    assert.equal(await notifications.getUnreadCount(), 0);
  });
  await check('push configuration, subscription and ownership errors', async () => {
    const config = await notifications.getPushPublicKey(); assert.equal(config.enabled, false);
    const endpoint = `https://push.example.invalid/${stamp}`;
    await notifications.registerPushSubscription({ endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } });
    as(stranger); await rejected(() => notifications.unregisterPushSubscription(endpoint), 'PUSH_SUBSCRIPTION_NOT_FOUND');
    as(member); await notifications.unregisterPushSubscription(endpoint);
  });
  await check('profile nickname and duplicate-name validation', async () => {
    assert.equal((await users.updateNickname(`변경${stamp}`)).nickname, `변경${stamp}`);
    await rejected(() => users.updateNickname(host.nickname), 'DUPLICATE_NICKNAME');
  });
  await check('profile multipart upload, invalid image and reset', async () => {
    const file = new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')], 'test.png', { type: 'image/png' });
    assert.ok((await users.updateProfileImage(file)).profileImageUrl);
    await rejected(() => users.updateProfileImage(new File(['not an image'], 'bad.png', { type: 'image/png' })), 'INVALID_IMAGE');
    assert.equal((await users.resetProfileImage()).profileImageUrl, null);
  });
  await check('password change rejects the old password and accepts the new one', async () => {
    await rejected(() => users.changePassword('wrong-password', 'Changed123!'), 'INVALID_PASSWORD');
    await users.changePassword(password, 'Changed123!');
    session.setTokens(null); await assert.rejects(() => auth.login({ email: member.email, password }));
    member.tokens = await auth.login({ email: member.email, password: 'Changed123!' }); as(member);
  });
  await check('social account linking validates password before contacting a provider', async () => {
    await rejected(() => users.linkSocialAccount('google', 'unused-test-code', 'wrong-password'), 'INVALID_PASSWORD');
  });
  await check('password reset mail stays local and one-time token is enforced', async () => {
    session.setTokens(null); await auth.requestPasswordReset(member.email);
    const mail = await until(() => receivedMail.at(-1), Boolean);
    let body = mail.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    if (/Content-Transfer-Encoding: base64/i.test(mail)) body = Buffer.from(body.replace(/\s/g, ''), 'base64').toString();
    else body = body.replace(/=\r?\n/g, '').replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const token = body.match(/password-reset\?token=([A-Za-z0-9_-]+)/)?.[1]; assert.ok(token);
    await rejected(() => auth.confirmPasswordReset('invalid', 'Reset123!'), 'INVALID_RESET_TOKEN');
    await auth.confirmPasswordReset(token, 'Reset123!');
    await rejected(() => auth.confirmPasswordReset(token, 'Reset123!'), 'INVALID_RESET_TOKEN');
    member.tokens = await auth.login({ email: member.email, password: 'Reset123!' });
  });
  await check('host cannot leave or withdraw before delegation', async () => { as(host); await rejected(() => settings.leaveWorkspace(workspace.id), 'HOST_CANNOT_LEAVE'); await rejected(users.withdraw, 'HOST_DELEGATION_REQUIRED'); });
  await check('host delegation updates permissions and leaving removes membership', async () => {
    assert.equal((await settings.delegateHost(workspace.id, member.id)).myRole, 'MEMBER');
    await settings.leaveWorkspace(workspace.id); await rejected(() => groups.getWorkspace(workspace.id), 'NOT_WORKSPACE_MEMBER');
  });
  await check('kicking a member invalidates previous invitations', async () => {
    as(member); const invite = await groups.issueInvitation(workspace.id); as(stranger); await groups.acceptInvitation(invite.token);
    as(member); await settings.kickMember(workspace.id, stranger.id); as(stranger); await assert.rejects(() => groups.acceptInvitation(invite.token));
  });
  await check('candidate and workspace deletion remove their resources', async () => {
    as(member); await candidates.removeCandidate(second.candidateId); await rejected(() => candidates.getCandidate(second.candidateId), 'CANDIDATE_NOT_FOUND');
    await settings.deleteWorkspace(workspace.id); await assert.rejects(() => groups.getWorkspace(workspace.id));
  });
  await check('account withdrawal removes the account', async () => { as(stranger); await users.withdraw(); session.setTokens(null); await assert.rejects(() => auth.login({ email: stranger.email, password })); });

  const ui = await register('ui'); as(ui);
  const uiWorkspace = await groups.createWorkspace({ name: '브라우저 연동 검증', description: '별도 H2 테스트 데이터' });
  await mkdir('node_modules/.cache', { recursive: true });
  await writeFile('node_modules/.cache/integration-fixture.json', JSON.stringify({ email: ui.email, password, workspaceId: uiWorkspace.id }));
  await writeFile('node_modules/.cache/integration-results.json', JSON.stringify({ passed: results.length, checks: results }, null, 2));
  console.log(`Integration checks passed: ${results.length}. Browser fixture prepared in the isolated H2 database.`);
} catch (error) {
  console.error('INTEGRATION FAILED:', error.response?.data?.code ?? error.message);
  process.exitCode = 1;
} finally {
  for (const ws of sockets) ws.close();
  await server.close();
  await new Promise((resolve) => smtp.close(resolve));
}
