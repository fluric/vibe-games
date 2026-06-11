import assert from 'assert';
import Fastify from 'fastify';
import { AppDataSource } from '../data-source';
import { gameRoutes } from '../routes/games';
import { Game } from '../entities/Game';
import { User } from '../entities/User';
import { GameDto } from '@vibe-games/shared';

const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

async function runTests() {
  console.log('🧪 Starting Games API Integration Tests...\n');

  // 1. Initialize DataSource
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  
  // Clean up database tables to make tests repeatable and independent
  const gameRepo = AppDataSource.getRepository(Game);
  const userRepo = AppDataSource.getRepository(User);
  await gameRepo.clear();
  // Delete all users except AI user if it exists to avoid foreign key violations
  await userRepo.createQueryBuilder().delete().where('id != :aiId', { aiId: AI_USER_ID }).execute();

  // Create Fastify test app
  const app = Fastify();
  await app.register(gameRoutes, { prefix: '/games' });
  await app.ready();

  const user1Id = '11111111-1111-1111-1111-111111111111';
  const user2Id = '22222222-2222-2222-2222-222222222222';

  let testGameId: string = '';

  // ── Test 1: Create Game (vs Human) ─────────────────────────────────────────
  console.log('👉 Testing: Create Game (Human)...');
  const createRes = await app.inject({
    method: 'POST',
    url: '/games',
    headers: { 'x-user-id': user1Id },
    payload: {
      gameType: 'mill',
      isPublic: true,
      vsAi: false,
    },
  });

  assert.strictEqual(createRes.statusCode, 200);
  const createdGame = JSON.parse(createRes.body) as GameDto;
  assert.strictEqual(createdGame.gameType, 'mill');
  assert.strictEqual(createdGame.status, 'waiting');
  assert.strictEqual(createdGame.playerX?.id, user1Id);
  assert.strictEqual(createdGame.playerO, null);
  assert.strictEqual(createdGame.isPublic, true);
  assert.ok(createdGame.id);
  
  testGameId = createdGame.id;

  // ── Test 2: List Open Games (Lobby) ────────────────────────────────────────
  console.log('👉 Testing: List Open Games...');
  const listRes = await app.inject({
    method: 'GET',
    url: '/games',
  });

  assert.strictEqual(listRes.statusCode, 200);
  const lobbyList = JSON.parse(listRes.body) as GameDto[];
  assert.ok(lobbyList.length >= 1);
  const found = lobbyList.find((g) => g.id === testGameId);
  assert.ok(found);
  assert.strictEqual(found.playerX?.id, user1Id);

  // ── Test 3: Get Game Details ───────────────────────────────────────────────
  console.log('👉 Testing: Get Game Details...');
  const detailsRes = await app.inject({
    method: 'GET',
    url: `/games/${testGameId}`,
  });

  assert.strictEqual(detailsRes.statusCode, 200);
  const details = JSON.parse(detailsRes.body) as GameDto;
  assert.strictEqual(details.id, testGameId);
  assert.strictEqual(details.status, 'waiting');

  // ── Test 4: Join Game ──────────────────────────────────────────────────────
  console.log('👉 Testing: Join Game...');
  // First attempt to play against self
  const selfJoinRes = await app.inject({
    method: 'POST',
    url: `/games/${testGameId}/join`,
    headers: { 'x-user-id': user1Id },
  });
  assert.strictEqual(selfJoinRes.statusCode, 400);

  // Join as user 2
  const joinRes = await app.inject({
    method: 'POST',
    url: `/games/${testGameId}/join`,
    headers: { 'x-user-id': user2Id },
  });

  assert.strictEqual(joinRes.statusCode, 200);
  const joinedGame = JSON.parse(joinRes.body) as GameDto;
  assert.strictEqual(joinedGame.status, 'in_progress');
  assert.strictEqual(joinedGame.playerO?.id, user2Id);

  // Verify it is no longer in the open lobby
  const postJoinListRes = await app.inject({
    method: 'GET',
    url: '/games',
  });
  const updatedLobby = JSON.parse(postJoinListRes.body) as GameDto[];
  assert.ok(!updatedLobby.some((g) => g.id === testGameId));

  // ── Test 5: Create Game vs AI ──────────────────────────────────────────────
  console.log('👉 Testing: Create Game vs AI...');
  const aiCreateRes = await app.inject({
    method: 'POST',
    url: '/games',
    headers: { 'x-user-id': user1Id },
    payload: {
      gameType: 'mill',
      isPublic: false,
      vsAi: true,
    },
  });

  assert.strictEqual(aiCreateRes.statusCode, 200);
  const aiGame = JSON.parse(aiCreateRes.body) as GameDto;
  assert.strictEqual(aiGame.status, 'in_progress');
  assert.strictEqual(aiGame.playerO?.id, AI_USER_ID);
  
  const aiGameId = aiGame.id;

  // ── Test 6: Move Submissions (Human vs AI Game) ────────────────────────────
  console.log('👉 Testing: Submit Moves & AI Response...');
  // It is X's (user1) turn initially.
  // Submit a placement at index 0.
  const moveRes1 = await app.inject({
    method: 'POST',
    url: `/games/${aiGameId}/move`,
    headers: { 'x-user-id': user1Id },
    payload: {
      action: 'place',
      position: 0,
    },
  });

  assert.strictEqual(moveRes1.statusCode, 200);
  const gameAfterMove1 = JSON.parse(moveRes1.body) as GameDto;
  
  // Player X placed at 0.
  assert.strictEqual(gameAfterMove1.state.board[0], 'X');
  // Since it was vs AI, the AI should have automatically responded in a loop
  // and passed the turn back to X.
  assert.strictEqual(gameAfterMove1.state.turn, 'X');
  // AI should have placed exactly one piece on the board as 'O'.
  const oCount = gameAfterMove1.state.board.filter((c) => c === 'O').length;
  assert.strictEqual(oCount, 1);
  assert.strictEqual(gameAfterMove1.state.piecesOnBoard.O, 1);
  assert.strictEqual(gameAfterMove1.state.piecesOnBoard.X, 1);

  // Try to play as O (which is AI) and verify error
  const invalidPlayerRes = await app.inject({
    method: 'POST',
    url: `/games/${aiGameId}/move`,
    headers: { 'x-user-id': AI_USER_ID },
    payload: {
      action: 'place',
      position: 1,
    },
  });
  assert.strictEqual(invalidPlayerRes.statusCode, 400); // Not AI's turn (or forbidden)

  // Try to place on an occupied position
  let occupiedPos = gameAfterMove1.state.board.indexOf('O');
  const invalidMoveRes = await app.inject({
    method: 'POST',
    url: `/games/${aiGameId}/move`,
    headers: { 'x-user-id': user1Id },
    payload: {
      action: 'place',
      position: occupiedPos,
    },
  });
  assert.strictEqual(invalidMoveRes.statusCode, 400);

  // ── Test 7: Active Games & Cancellation ────────────────────────────────────
  console.log('👉 Testing: Active Games List & Cancellation...');
  // Create a game as user 1
  const cancelTestRes = await app.inject({
    method: 'POST',
    url: '/games',
    headers: { 'x-user-id': user1Id },
    payload: {
      gameType: 'mill',
      isPublic: true,
      vsAi: false,
    },
  });
  assert.strictEqual(cancelTestRes.statusCode, 200);
  const cancelGameObj = JSON.parse(cancelTestRes.body) as GameDto;
  const cancelGameId = cancelGameObj.id;

  // Retrieve active games for user 1
  const activeRes1 = await app.inject({
    method: 'GET',
    url: '/games/my-active',
    headers: { 'x-user-id': user1Id },
  });
  assert.strictEqual(activeRes1.statusCode, 200);
  const activeGames1 = JSON.parse(activeRes1.body) as GameDto[];
  // Should contain the new game and the vs AI game
  assert.ok(activeGames1.some((g) => g.id === cancelGameId));
  assert.ok(activeGames1.some((g) => g.id === aiGameId));

  // Retrieve active games for user 2
  const activeRes2 = await app.inject({
    method: 'GET',
    url: '/games/my-active',
    headers: { 'x-user-id': user2Id },
  });
  assert.strictEqual(activeRes2.statusCode, 200);
  const activeGames2 = JSON.parse(activeRes2.body) as GameDto[];
  // Should contain testGameId (since user 2 joined it), but not cancelGameId or aiGameId
  assert.ok(activeGames2.some((g) => g.id === testGameId));
  assert.ok(!activeGames2.some((g) => g.id === cancelGameId));
  assert.ok(!activeGames2.some((g) => g.id === aiGameId));

  // Try to cancel the game as user 2 (which should fail)
  const wrongCancelRes = await app.inject({
    method: 'POST',
    url: `/games/${cancelGameId}/cancel`,
    headers: { 'x-user-id': user2Id },
    payload: {},
  });
  assert.strictEqual(wrongCancelRes.statusCode, 403);

  // Cancel the game as user 1
  const rightCancelRes = await app.inject({
    method: 'POST',
    url: `/games/${cancelGameId}/cancel`,
    headers: { 'x-user-id': user1Id },
    payload: {},
  });
  assert.strictEqual(rightCancelRes.statusCode, 200);
  const cancelBody = JSON.parse(rightCancelRes.body);
  assert.strictEqual(cancelBody.success, true);

  // Verify it is no longer active for user 1
  const postCancelActiveRes = await app.inject({
    method: 'GET',
    url: '/games/my-active',
    headers: { 'x-user-id': user1Id },
  });
  const postCancelActiveGames = JSON.parse(postCancelActiveRes.body) as GameDto[];
  assert.ok(!postCancelActiveGames.some((g) => g.id === cancelGameId));

  console.log('\n✅ All Games API Integration Tests passed successfully!');
}

// Execute tests
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
