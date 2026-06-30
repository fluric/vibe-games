import assert from 'assert';
import { AppDataSource } from '../data-source';
import { Game } from '../entities/Game';
import { User } from '../entities/User';
import {
  createGame,
  getOpenGames,
  joinGame,
  submitMove,
  forfeitGame,
  cancelGame
} from '../services/gameService';

async function runTests() {
  console.log('🧪 Starting gameService.ts Integration Tests...\n');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const gameRepo = AppDataSource.getRepository(Game);
  const userRepo = AppDataSource.getRepository(User);

  await gameRepo.clear();
  await userRepo.createQueryBuilder().delete().execute();

  const user1 = userRepo.create({ id: '11111111-1111-1111-1111-111111111111', username: 'User1', email: 'u1@test.com' });
  const user2 = userRepo.create({ id: '22222222-2222-2222-2222-222222222222', username: 'User2', email: 'u2@test.com' });
  await userRepo.save([user1, user2]);

  try {
    // Test 1: createGame (public)
    const game = await createGame(user1, 'connect_four', true, false, 'easy', false);
    assert.strictEqual(game.status, 'waiting', 'Game should be waiting');
    assert.strictEqual(game.playerXId, user1.id, 'User1 should be Player X');

    // Test 2: getOpenGames
    const openGames = await getOpenGames('connect_four', 'waiting');
    assert.strictEqual(openGames.length, 1, 'Should find 1 open game');

    // Test 3: joinGame
    const joinedGame = await joinGame(game.id, user2);
    assert.strictEqual(joinedGame.status, 'in_progress', 'Game should be in_progress');
    assert.strictEqual(joinedGame.playerOId, user2.id, 'User2 should be Player O');

    // Test 4: submitMove
    // Connect Four: Drop piece in col 0
    const movedGame = await submitMove(game.id, user1.id, { column: 0 });
    const state: any = movedGame.state;
    assert.strictEqual(state.turn, 'O', 'Turn should pass to O');
    assert.strictEqual(state.board[35], 'X', 'Piece should be placed at bottom of col 0');

    // Test 5: cancelGame on waiting game
    const game2 = await createGame(user1, 'connect_four', true, false, 'easy', false);
    await cancelGame(game2.id, user1.id);
    const checkGame2 = await gameRepo.findOneBy({ id: game2.id });
    assert.strictEqual(checkGame2, null, 'Game should be deleted after cancellation');

    // Test 6: forfeitGame
    const forfeitRes = await forfeitGame(game.id, user1.id);
    assert.strictEqual(forfeitRes.status, 'finished', 'Game should be finished after forfeit');
    assert.strictEqual(forfeitRes.winnerId, user2.id, 'User2 should win if User1 forfeits');

    console.log('✅ All gameService tests passed!');
  } catch (err) {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
