import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  cacheDir: 'node_modules/.vite-vote-tests', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
});
after(() => server.close());
const { withMyChoice, applyVoteMessage } = await server.ssrLoadModule('/src/components/Vote/state.ts');
const result = {
  candidateId: 8, candidateName: '계명대역 인근', agreeCount: 1, disagreeCount: 1,
  split: true, myChoice: null,
  votes: [{ userId: 1, nickname: '나', choice: 'AGREE' }, { userId: 2, nickname: '멤버', choice: 'DISAGREE' }],
};

test('shared vote notifications restore the viewer choice from votes, not null myChoice', () => {
  assert.equal(withMyChoice(result, 1).myChoice, 'AGREE');
  assert.equal(withMyChoice(result, 2).myChoice, 'DISAGREE');
  assert.equal(withMyChoice(result, 3).myChoice, null);
  assert.equal(withMyChoice(result, null).myChoice, null);
  assert.equal(result.myChoice, null);
});

test('live votes update counts, split and member choices without changing other candidates', () => {
  const other = { ...result, candidateId: 9 };
  const changed = { ...result, agreeCount: 0, disagreeCount: 2, split: false, votes: result.votes.map((v) => ({ ...v, choice: 'DISAGREE' })) };
  const updated = applyVoteMessage([result, other], { type: 'VOTE_UPDATED', data: changed }, 1);
  assert.deepEqual(updated[0], { ...changed, myChoice: 'DISAGREE' });
  assert.equal(updated[1], other);
  assert.equal(result.votes[0].choice, 'AGREE');
});

test('renamed and removed candidates stay in sync, late votes never resurrect a removed candidate', () => {
  const renamed = applyVoteMessage([result], { type: 'CANDIDATE_UPDATED', data: { candidateId: 8, name: '새 이름' } }, 1);
  assert.equal(renamed[0].candidateName, '새 이름');
  const removed = applyVoteMessage(renamed, { type: 'CANDIDATE_REMOVED', data: { candidateId: 8 } }, 1);
  assert.deepEqual(applyVoteMessage(removed, { type: 'VOTE_UPDATED', data: result }, 1), []);
  assert.equal(applyVoteMessage(renamed, { type: 'UNRELATED', data: {} }, 1), renamed);
});
