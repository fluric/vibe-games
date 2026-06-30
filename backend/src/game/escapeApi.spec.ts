import assert from 'assert';
import Fastify from 'fastify';
import { AppDataSource } from '../data-source';
import { escapeRoutes } from '../routes/escape';
import { EscapeProgress } from '../entities/EscapeProgress';
import { User } from '../entities/User';
import { EscapeProgressResponse, EscapeLeaderboardResponse } from '@vibe-games/shared';

async function runTests() {
  console.log('🧪 Starting Escape API Integration Tests...\n');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  
  const progressRepo = AppDataSource.getRepository(EscapeProgress);
  const userRepo = AppDataSource.getRepository(User);
  await progressRepo.clear();

  // Create Fastify test app
  const app = Fastify();
  await app.register(escapeRoutes, { prefix: '/escape' });
  
  app.addHook('preHandler', async (request) => {
    const headerUserId = request.headers['x-user-id'] as string;
    if (headerUserId) {
      const user = await userRepo.findOneBy({ id: headerUserId });
      if (user) (request as any).user = user;
    }
  });

  await app.ready();

  const user1Id = '33333333-3333-3333-3333-333333333333';
  const user2Id = '44444444-4444-4444-4444-444444444444';

  const user1 = userRepo.create({ id: user1Id, username: 'EscapeTest1', email: 'escape1@vibegames.local' });
  const user2 = userRepo.create({ id: user2Id, username: 'EscapeTest2', email: 'escape2@vibegames.local' });
  await userRepo.save([user1, user2]);

  // ── Test 1: Initial Progress (Empty) ──────────────────────────────────────
  console.log('👉 Testing: Initial Progress...');
  const progressRes = await app.inject({
    method: 'GET',
    url: '/escape/progress',
    headers: { 'x-user-id': user1Id },
  });

  assert.strictEqual(progressRes.statusCode, 200);
  const initialProgress = JSON.parse(progressRes.body) as EscapeProgressResponse;
  assert.strictEqual(initialProgress.roomsCleared, 0);
  assert.strictEqual(initialProgress.rooms.length, 3);
  assert.strictEqual(initialProgress.rooms[0].solved, false);

  // ── Test 2: Solve Room 1 ──────────────────────────────────────────────────
  console.log('👉 Testing: Solve Room 1...');
  const solveRes1 = await app.inject({
    method: 'POST',
    url: '/escape/solve',
    headers: { 'x-user-id': user1Id },
    payload: { roomId: 1 },
  });

  assert.strictEqual(solveRes1.statusCode, 200);
  const solveBody1 = JSON.parse(solveRes1.body);
  assert.strictEqual(solveBody1.ok, true);

  // Verify progress updated
  const progressRes2 = await app.inject({
    method: 'GET',
    url: '/escape/progress',
    headers: { 'x-user-id': user1Id },
  });
  const progress2 = JSON.parse(progressRes2.body) as EscapeProgressResponse;
  assert.strictEqual(progress2.roomsCleared, 1);
  assert.strictEqual(progress2.rooms[0].solved, true);

  // ── Test 3: Solve Room out of order (fails) ───────────────────────────────
  console.log('👉 Testing: Solve out of order (fails)...');
  const solveRes3 = await app.inject({
    method: 'POST',
    url: '/escape/solve',
    headers: { 'x-user-id': user1Id },
    payload: { roomId: 3 }, // Room 2 not yet solved
  });
  assert.strictEqual(solveRes3.statusCode, 403);

  // ── Test 4: Fully Escape ──────────────────────────────────────────────────
  console.log('👉 Testing: Fully Escape...');
  await app.inject({ method: 'POST', url: '/escape/solve', headers: { 'x-user-id': user1Id }, payload: { roomId: 2 } });
  await app.inject({ method: 'POST', url: '/escape/solve', headers: { 'x-user-id': user1Id }, payload: { roomId: 3 } });

  const progressRes3 = await app.inject({ method: 'GET', url: '/escape/progress', headers: { 'x-user-id': user1Id } });
  const progress3 = JSON.parse(progressRes3.body) as EscapeProgressResponse;
  assert.strictEqual(progress3.roomsCleared, 3);

  // ── Test 5: Leaderboard ───────────────────────────────────────────────────
  console.log('👉 Testing: Leaderboard...');
  const leaderboardRes = await app.inject({ method: 'GET', url: '/escape/leaderboard' });
  assert.strictEqual(leaderboardRes.statusCode, 200);
  const leaderboard = JSON.parse(leaderboardRes.body) as EscapeLeaderboardResponse;
  assert.strictEqual(leaderboard.entries.length, 1);
  assert.strictEqual(leaderboard.entries[0].userId, user1Id);

  console.log('\n✅ All Escape API Integration Tests passed successfully!');
}

(async () => {
  try {
    await runTests();
  } catch (error) {
    console.error('\n❌ Integration Test failed!');
    console.error(error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔌 Database connection closed.');
    }
  }
})();
