import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../data-source';
import { IsNull, In } from 'typeorm';
import { Game } from '../entities/Game';
import { User } from '../entities/User';
import { UserStats } from '../entities/UserStats';
import { GameDto, UserDto, PlayerPiece, GameType, MillGameState, LeaderboardResponse, LeaderboardEntryDto } from '@vibe-games/shared';
import { calculateElo } from '../game/elo';
import { ENGINES } from '../game/gameRegistry';
import {
  runAiLoopIfNeeded,
  getOrCreateUser,
  seedBots,
  toGameDto,
  handleGameFinished,
  aiConfig,
  BOTS_MAP
} from '../services/gameService';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
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
    const engine = ENGINES[gameType];
    if (!engine) {
      return reply.code(400).send({ error: 'Unsupported game type' });
    }

    const gameRepo = AppDataSource.getRepository(Game);

    let playerXId: string | null = user.id;
    let playerOId: string | null = null;
    let playerXEntity: User | null = user;
    let playerOEntity: User | null = null;

    if (vsAi) {
      let botKey: string = aiLevel || 'medium_aggressive';
      if (botKey === 'easy') botKey = 'easy_random';
      else if (botKey === 'medium') botKey = 'medium_aggressive';
      else if (botKey === 'hard') botKey = 'hard_tactical';

      const gameBots = aiConfig[gameType] || aiConfig['mill'];
      const botConfig = gameBots[botKey] || gameBots['medium_aggressive'];
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
    } else if (aiStarts) {
      // Human game, host wants to go second (be player O)
      playerXId = null;
      playerOId = user.id;
      playerXEntity = null;
      playerOEntity = user;
    }

    const game = gameRepo.create({
      gameType,
      status: vsAi ? 'in_progress' : 'waiting',
      playerXId,
      playerOId,
      state: engine.createInitialState(),
      isPublic,
      playerX: playerXEntity,
      playerO: playerOEntity,
    });

    if (vsAi && aiStarts) {
      await runAiLoopIfNeeded(game);
      if (game.status === 'finished') {
        await handleGameFinished(game);
      }
    }

    await gameRepo.save(game);
    return reply.send(await toGameDto(game, request.user?.id));
  });

  // 2. Get Open Public Games
  server.get<{ Querystring: { gameType?: string; status?: string } }>('/', async (request, reply) => {
    const { gameType, status = 'waiting' } = request.query;
    const gameRepo = AppDataSource.getRepository(Game);
    
    let baseWhere: any = { isPublic: true };
    if (gameType) {
      baseWhere.gameType = gameType;
    }
    
    if (status === 'waiting') {
      const openGames = await gameRepo.find({
        where: [
          { ...baseWhere, status: 'waiting', playerOId: IsNull() },
          { ...baseWhere, status: 'waiting', playerXId: IsNull() },
        ],
        relations: ['playerX', 'playerO'],
        order: { createdAt: 'DESC' },
      });
      return reply.send(await Promise.all(openGames.map(g => toGameDto(g, request.user?.id))));
    } else if (status === 'in_progress') {
      const ongoingGames = await gameRepo.find({
        where: { ...baseWhere, status: 'in_progress' },
        relations: ['playerX', 'playerO'],
        order: { updatedAt: 'DESC' },
        take: 50
      });
      return reply.send(await Promise.all(ongoingGames.map(g => toGameDto(g, request.user?.id))));
    } else {
      const allGames = await gameRepo.find({
        where: [
          { ...baseWhere, status: 'waiting', playerOId: IsNull() },
          { ...baseWhere, status: 'waiting', playerXId: IsNull() },
          { ...baseWhere, status: 'in_progress' }
        ],
        relations: ['playerX', 'playerO'],
        order: { updatedAt: 'DESC' },
        take: 50
      });
      return reply.send(await Promise.all(allGames.map(g => toGameDto(g, request.user?.id))));
    }
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

    return reply.send(await Promise.all(myGames.map(g => toGameDto(g, request.user?.id))));
  });

  // Get ELO Leaderboard for a game type
  server.get<{ Params: { gameType: GameType } }>('/leaderboard/:gameType', async (request, reply) => {
    const { gameType } = request.params;
    if (gameType !== 'mill' && gameType !== 'connect_four' && gameType !== 'holy_grail') {
      return reply.code(400).send({ error: 'Unsupported game type' });
    }

    const statsRepo = AppDataSource.getRepository(UserStats);
    const statsList = await statsRepo.find({
      where: { gameType },
      relations: ['user'],
      order: { elo: 'DESC' },
      take: 100, // Limit to top 100
    });

    const entries: LeaderboardEntryDto[] = statsList.map(stats => {
      const isBot = BOTS_MAP.has(stats.userId);
      // If it is a bot, use the dynamic bot configuration elo rating (loaded from aiConfig.json)
      // to keep it in sync with tournament results!
      let currentElo = stats.elo;
      let username = stats.user ? stats.user.username : `Player_${stats.userId.substring(0, 5)}`;
      if (isBot) {
        const botInfo = BOTS_MAP.get(stats.userId);
        if (botInfo) {
          currentElo = botInfo.elo;
          username = botInfo.username;
        }
      }

      return {
        userId: stats.userId,
        username,
        avatarUrl: stats.user ? stats.user.avatarUrl : null,
        elo: currentElo,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        isBot,
      };
    });

    // Also sort entries by ELO DESC again, because bots might have updated configurations
    entries.sort((a, b) => b.elo - a.elo);

    const response: LeaderboardResponse = {
      gameType,
      entries,
    };

    return reply.send(response);
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

    return reply.send(await toGameDto(game, request.user?.id));
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
    if (game.playerXId === userId || game.playerOId === userId) {
      return reply.code(400).send({ error: 'Cannot play against yourself' });
    }

    if (game.playerXId === null) {
      game.playerXId = user.id;
      game.playerX = user;
    } else {
      game.playerOId = user.id;
      game.playerO = user;
    }
    game.status = 'in_progress';

    await gameRepo.save(game);
    return reply.send(await toGameDto(game, request.user?.id));
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
    if (game.playerXId !== userId && game.playerOId !== userId) {
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
    return reply.send(await toGameDto(game, request.user?.id));
  });

  // 5. Submit a Move (Perform place, move, or remove and trigger AI response)
  server.post<{
    Params: { id: string };
    Body: {
      action: string;
      position?: number;
      from?: number | string;
      to?: number | string;
      [key: string]: any;
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

    const engine = ENGINES[game.gameType];
    if (!engine) {
      return reply.code(400).send({ error: 'Unsupported game type' });
    }

    try {
      game.state = engine.handleMove(game.state, request.body, playerPiece);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }

    if (game.state.winner) {
      game.status = 'finished';
      game.winnerId = game.state.winner === 'draw' ? null : (game.state.winner === 'X' ? game.playerXId : game.playerOId);
    }

    // ── AI Opponent Logic Loop ───────────────────────────────────────────────
    await runAiLoopIfNeeded(game);

    if (game.status === 'finished') {
      await handleGameFinished(game);
    }

    await gameRepo.save(game);
    return reply.send(await toGameDto(game, request.user?.id));
  });
}
