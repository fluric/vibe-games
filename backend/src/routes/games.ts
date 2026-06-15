import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../data-source';
import { IsNull, In } from 'typeorm';
import { Game } from '../entities/Game';
import { User } from '../entities/User';
import { UserStats } from '../entities/UserStats';
import { GameDto, UserDto, PlayerPiece, GameType, MillGameState } from '@vibe-games/shared';
import { calculateElo } from '../game/elo';
import { getAiAction } from '../game/millAi';
import { StrategyWeights } from '../game/minimaxAi';
const aiConfig: Record<string, { id: string; username: string; elo: number; type: string; depth?: number; weights?: StrategyWeights }> = require('../game/aiConfig.json');
import {
  createInitialState,
  handlePlaceAction,
  handleMoveAction,
  handleRemoveAction,
} from '../game/millEngine';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

// BOTS configuration lookup map
const BOTS_MAP = new Map<string, { username: string; elo: number; type: string; depth?: number; weights?: StrategyWeights }>();
for (const [key, val] of Object.entries(aiConfig)) {
  BOTS_MAP.set(val.id, { username: val.username, elo: val.elo, type: val.type, depth: val.depth, weights: val.weights });
}

function invertState(state: MillGameState): MillGameState {
  const invertedBoard = state.board.map((cell: PlayerPiece | null) => {
    if (cell === 'X') return 'O';
    if (cell === 'O') return 'X';
    return null;
  });

  return {
    ...state,
    board: invertedBoard,
    turn: state.turn === 'X' ? 'O' : 'X',
    placementsRemaining: {
      X: state.placementsRemaining.O,
      O: state.placementsRemaining.X,
    },
    piecesOnBoard: {
      X: state.piecesOnBoard.O,
      O: state.piecesOnBoard.X,
    }
  };
}

function runAiLoopIfNeeded(game: Game) {
  const botId = [game.playerXId, game.playerOId].find(id => id && BOTS_MAP.has(id));
  if (!botId) return;

  const botInfo = BOTS_MAP.get(botId)!;
  const aiPiece: PlayerPiece = botId === game.playerXId ? 'X' : 'O';

  let aiActive = !game.state.winner;
  while (aiActive && game.state.turn === aiPiece) {
    try {
      // Invert the state if the AI is Player X (since minimax assumes maximizing O)
      const stateToPass = aiPiece === 'X' ? invertState(game.state) : game.state;
      const rawAction = getAiAction(stateToPass, botInfo.type as any, botInfo.depth, botInfo.weights, 4000);

      if (rawAction.type === 'place') {
        game.state = handlePlaceAction(game.state, rawAction.position!, aiPiece);
      } else if (rawAction.type === 'move') {
        game.state = handleMoveAction(game.state, rawAction.from!, rawAction.to!, aiPiece);
      } else if (rawAction.type === 'remove') {
        game.state = handleRemoveAction(game.state, rawAction.position!, aiPiece);
      }

      if (game.state.winner) {
        game.status = 'finished';
        game.winnerId = game.state.winner === 'draw' ? null : (game.state.winner === 'X' ? game.playerXId : game.playerOId);
        aiActive = false;
      }
    } catch (err) {
      game.status = 'finished';
      const humanPiece = aiPiece === 'X' ? 'O' : 'X';
      game.winnerId = humanPiece === 'X' ? game.playerXId : game.playerOId;
      game.state.winner = humanPiece;
      aiActive = false;
    }
  }
}

async function getOrCreateUser(userId: string): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);
  let user = await userRepo.findOneBy({ id: userId });
  if (!user) {
    const botInfo = BOTS_MAP.get(userId);
    user = userRepo.create({
      id: userId,
      username: botInfo ? botInfo.username : `Player_${userId.substring(0, 5)}`,
      googleId: botInfo ? `bot-${userId}` : undefined,
      email: botInfo ? `bot-${userId}@vibegames.local` : undefined,
    });
    try {
      await userRepo.save(user);
    } catch (err) {
      const existing = await userRepo.findOneBy({ id: userId });
      if (existing) {
        user = existing;
      } else {
        throw err;
      }
    }
  }
  return user;
}

async function seedBots() {
  const userRepo = AppDataSource.getRepository(User);
  const userStatsRepo = AppDataSource.getRepository(UserStats);

  for (const bot of Object.values(aiConfig)) {
    let existing = await userRepo.findOneBy({ id: bot.id });
    if (!existing) {
      existing = userRepo.create({
        id: bot.id,
        username: bot.username,
        googleId: `bot-${bot.id}`,
        email: `bot-${bot.id}@vibegames.local`,
      });
      try {
        await userRepo.save(existing);
      } catch (err) {
        // Safe to ignore if concurrent seed process inserted first
      }
    }

    let stats = await userStatsRepo.findOneBy({ userId: bot.id, gameType: 'mill' });
    if (!stats) {
      stats = userStatsRepo.create({
        userId: bot.id,
        gameType: 'mill',
        elo: bot.elo,
      });
      try {
        await userStatsRepo.save(stats);
      } catch (err) {
        // Safe to ignore if concurrent seed process inserted first
      }
    }
  }
}

async function toUserDto(user: User | null, gameType: GameType): Promise<UserDto | null> {
  if (!user) return null;

  const botInfo = BOTS_MAP.get(user.id);
  if (botInfo) {
    return {
      id: user.id,
      username: botInfo.username,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl,
      elo: botInfo.elo,
    };
  }

  const statsRepo = AppDataSource.getRepository(UserStats);
  const stats = await statsRepo.findOneBy({ userId: user.id, gameType });

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    email: user.email,
    elo: stats ? stats.elo : 1200,
    wins: stats ? stats.wins : 0,
    losses: stats ? stats.losses : 0,
    draws: stats ? stats.draws : 0,
  };
}

async function toGameDto(game: Game): Promise<GameDto> {
  return {
    id: game.id,
    gameType: game.gameType,
    status: game.status,
    playerX: await toUserDto(game.playerX, game.gameType),
    playerO: await toUserDto(game.playerO, game.gameType),
    winnerId: game.winnerId,
    state: game.state,
    isPublic: game.isPublic,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

async function handleGameFinished(game: Game) {
  if (game.status !== 'finished') return;

  const playerXId = game.playerXId;
  const playerOId = game.playerOId;
  const winner = game.state.winner; // 'X' | 'O' | 'draw'

  if (!playerXId || !playerOId) return;

  const userStatsRepo = AppDataSource.getRepository(UserStats);

  let xStats = await userStatsRepo.findOneBy({ userId: playerXId, gameType: game.gameType });
  if (!xStats) {
    const botInfo = BOTS_MAP.get(playerXId);
    xStats = userStatsRepo.create({
      userId: playerXId,
      gameType: game.gameType,
      elo: botInfo ? botInfo.elo : 1200,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  let oStats = await userStatsRepo.findOneBy({ userId: playerOId, gameType: game.gameType });
  if (!oStats) {
    const botInfo = BOTS_MAP.get(playerOId);
    oStats = userStatsRepo.create({
      userId: playerOId,
      gameType: game.gameType,
      elo: botInfo ? botInfo.elo : 1200,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  const oldXElo = xStats.elo;
  const oldOElo = oStats.elo;

  let xOutcome: 1 | 0.5 | 0 = 0.5;
  let oOutcome: 1 | 0.5 | 0 = 0.5;

  if (winner === 'X') {
    xOutcome = 1;
    oOutcome = 0;
    xStats.wins += 1;
    oStats.losses += 1;
  } else if (winner === 'O') {
    xOutcome = 0;
    oOutcome = 1;
    xStats.losses += 1;
    oStats.wins += 1;
  } else {
    xStats.draws += 1;
    oStats.draws += 1;
  }

  const newXElo = calculateElo(oldXElo, oldOElo, xOutcome);
  const newOElo = calculateElo(oldOElo, oldXElo, oOutcome);

  const isXBot = BOTS_MAP.has(playerXId);
  const isOBot = BOTS_MAP.has(playerOId);

  if (!isXBot) {
    xStats.elo = newXElo;
    try {
      await userStatsRepo.save(xStats);
    } catch (err) {
      const existing = await userStatsRepo.findOneBy({ userId: playerXId, gameType: game.gameType });
      if (existing) {
        existing.wins += winner === 'X' ? 1 : 0;
        existing.losses += winner === 'O' ? 1 : 0;
        existing.draws += winner === 'draw' ? 1 : 0;
        existing.elo = calculateElo(existing.elo, oldOElo, xOutcome);
        await userStatsRepo.save(existing);
      } else {
        throw err;
      }
    }
  }

  if (!isOBot) {
    oStats.elo = newOElo;
    try {
      await userStatsRepo.save(oStats);
    } catch (err) {
      const existing = await userStatsRepo.findOneBy({ userId: playerOId, gameType: game.gameType });
      if (existing) {
        existing.wins += winner === 'O' ? 1 : 0;
        existing.losses += winner === 'X' ? 1 : 0;
        existing.draws += winner === 'draw' ? 1 : 0;
        existing.elo = calculateElo(existing.elo, oldXElo, oOutcome);
        await userStatsRepo.save(existing);
      } else {
        throw err;
      }
    }
  }
}

export async function gameRoutes(server: FastifyInstance) {
  // Automatically seed bots when routes load
  await seedBots();

  // Plugin-level authentication hook (guarantees auth runs inside tests as well)
  server.addHook('preHandler', async (request) => {
    if (request.user) return; // already populated globally

    // Fallback: Check custom user header (backward compatibility for dev/tests)
    const headerUserId = request.headers['x-user-id'] as string;
    if (headerUserId) {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: headerUserId });
      if (user) {
        request.user = user;
        return;
      }
    }
  });

  // 1. Create a Game
  server.post<{
    Body: {
      gameType: GameType;
      isPublic?: boolean;
      vsAi?: boolean;
      aiLevel?: 'easy' | 'medium' | 'hard' | 'easy_random' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle';
      aiStarts?: boolean;
    };
  }>('/', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { gameType, isPublic = true, vsAi = false, aiLevel = 'medium_aggressive', aiStarts = false } = request.body;
    if (gameType !== 'mill') {
      return reply.code(400).send({ error: 'Unsupported game type' });
    }

    const gameRepo = AppDataSource.getRepository(Game);

    let playerXId = user.id;
    let playerOId = null;
    let playerXEntity = user;
    let playerOEntity = null;

    if (vsAi) {
      let botKey: string = aiLevel || 'medium_aggressive';
      if (botKey === 'easy') botKey = 'easy_random';
      else if (botKey === 'medium') botKey = 'medium_aggressive';
      else if (botKey === 'hard') botKey = 'hard_tactical';

      const botConfig = aiConfig[botKey] || aiConfig['medium_aggressive'];
      const botUser = await getOrCreateUser(botConfig.id);

      if (aiStarts) {
        playerXId = botConfig.id;
        playerOId = user.id;
        playerXEntity = botUser;
        playerOEntity = user;
      } else {
        playerXId = user.id;
        playerOId = botConfig.id;
        playerXEntity = user;
        playerOEntity = botUser;
      }
    }

    const game = gameRepo.create({
      gameType,
      status: vsAi ? 'in_progress' : 'waiting',
      playerXId,
      playerOId,
      state: createInitialState(),
      isPublic,
      playerX: playerXEntity,
      playerO: playerOEntity,
    });

    if (vsAi && aiStarts) {
      runAiLoopIfNeeded(game);
      if (game.status === 'finished') {
        await handleGameFinished(game);
      }
    }

    await gameRepo.save(game);
    return reply.send(await toGameDto(game));
  });

  // 2. Get Open Public Games
  server.get('/', async (request, reply) => {
    const gameRepo = AppDataSource.getRepository(Game);
    const openGames = await gameRepo.find({
      where: {
        status: 'waiting',
        isPublic: true,
        playerOId: IsNull(),
      },
      relations: ['playerX', 'playerO'],
      order: { createdAt: 'DESC' },
    });

    return reply.send(await Promise.all(openGames.map(toGameDto)));
  });

  // Get User's Active Games
  server.get('/my-active', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = user.id;
    const gameRepo = AppDataSource.getRepository(Game);
    const myGames = await gameRepo.find({
      where: [
        { playerXId: userId, status: In(['waiting', 'in_progress']) },
        { playerOId: userId, status: In(['waiting', 'in_progress']) },
      ],
      relations: ['playerX', 'playerO'],
      order: { updatedAt: 'DESC' },
    });

    return reply.send(await Promise.all(myGames.map(toGameDto)));
  });

  // 3. Get Game Details
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({
      where: { id: request.params.id },
      relations: ['playerX', 'playerO'],
    });

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }

    return reply.send(await toGameDto(game));
  });

  // 4. Join a Game (Invite Link / Lobby list selection)
  server.post<{ Params: { id: string } }>('/:id/join', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = user.id;
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({
      where: { id: request.params.id },
      relations: ['playerX', 'playerO'],
    });

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'waiting') {
      return reply.code(400).send({ error: 'Game is not in a joinable status' });
    }
    if (game.playerXId === userId) {
      return reply.code(400).send({ error: 'Cannot play against yourself' });
    }

    const playerO = user;
    game.playerOId = playerO.id;
    game.playerO = playerO;
    game.status = 'in_progress';

    await gameRepo.save(game);
    return reply.send(await toGameDto(game));
  });

  // 4.5 Cancel a Game (Lobby slot cancellation by creator)
  server.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = user.id;
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({
      where: { id: request.params.id },
    });

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    if (game.playerXId !== userId) {
      return reply.code(403).send({ error: 'Only the creator can cancel this game' });
    }
    if (game.status !== 'waiting') {
      return reply.code(400).send({ error: 'Only games in waiting status can be cancelled' });
    }

    await gameRepo.remove(game);
    return reply.send({ success: true });
  });

  // 4.6 Forfeit/Resign a Game (Active game resignation by a participant)
  server.post<{ Params: { id: string } }>('/:id/forfeit', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = user.id;
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({
      where: { id: request.params.id },
      relations: ['playerX', 'playerO'],
    });

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'in_progress') {
      return reply.code(400).send({ error: 'Only games in progress can be forfeited' });
    }
    if (game.playerXId !== userId && game.playerOId !== userId) {
      return reply.code(403).send({ error: 'Only participants can forfeit this game' });
    }

    game.status = 'finished';
    const winnerPiece = game.playerXId === userId ? 'O' : 'X';
    game.winnerId = game.playerXId === userId ? game.playerOId : game.playerXId;

    game.state = {
      ...game.state,
      winner: winnerPiece,
    };

    await handleGameFinished(game);
    await gameRepo.save(game);
    return reply.send(await toGameDto(game));
  });

  // 5. Submit a Move (Perform place, move, or remove and trigger AI response)
  server.post<{
    Params: { id: string };
    Body: {
      action: 'place' | 'move' | 'remove';
      position?: number;
      from?: number;
      to?: number;
    };
  }>('/:id/move', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = user.id;
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({
      where: { id: request.params.id },
      relations: ['playerX', 'playerO'],
    });

    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'in_progress') {
      return reply.code(400).send({ error: 'Game is not in progress' });
    }

    const playerPiece: PlayerPiece =
      game.playerXId === userId ? 'X' : game.playerOId === userId ? 'O' : (null as any);
    if (!playerPiece) {
      return reply.code(403).send({ error: 'You are not a player in this game' });
    }

    if (game.state.turn !== playerPiece) {
      return reply.code(400).send({ error: `It is not your turn (current turn: ${game.state.turn})` });
    }

    const { action, position, from, to } = request.body;

    try {
      if (action === 'place') {
        if (position === undefined) return reply.code(400).send({ error: 'Missing position' });
        game.state = handlePlaceAction(game.state, position, playerPiece);
      } else if (action === 'move') {
        if (from === undefined || to === undefined) {
          return reply.code(400).send({ error: 'Missing from/to coordinates' });
        }
        game.state = handleMoveAction(game.state, from, to, playerPiece);
      } else if (action === 'remove') {
        if (position === undefined) return reply.code(400).send({ error: 'Missing position' });
        game.state = handleRemoveAction(game.state, position, playerPiece);
      } else {
        return reply.code(400).send({ error: 'Invalid game action type' });
      }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }

    if (game.state.winner) {
      game.status = 'finished';
      game.winnerId = game.state.winner === 'draw' ? null : (game.state.winner === 'X' ? game.playerXId : game.playerOId);
    }

    // ── AI Opponent Logic Loop ───────────────────────────────────────────────
    runAiLoopIfNeeded(game);

    if (game.status === 'finished') {
      await handleGameFinished(game);
    }

    await gameRepo.save(game);
    return reply.send(await toGameDto(game));
  });
}
