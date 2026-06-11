import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../data-source';
import { IsNull, In } from 'typeorm';
import { Game } from '../entities/Game';
import { User } from '../entities/User';
import { GameDto, UserDto, PlayerPiece } from '@vibe-games/shared';
import {
  createInitialState,
  handlePlaceAction,
  handleMoveAction,
  handleRemoveAction,
} from '../game/millEngine';
import {
  getBestPlaceMove,
  getBestMove,
  getBestRemoval,
} from '../game/millAi';

const AI_USER_ID = '00000000-0000-0000-0000-000000000000';

async function getOrCreateUser(userId: string): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);
  let user = await userRepo.findOneBy({ id: userId });
  if (!user) {
    user = userRepo.create({
      id: userId,
      username: userId === AI_USER_ID ? 'AI Opponent' : `Player_${userId.substring(0, 5)}`,
    });
    await userRepo.save(user);
  }
  return user;
}

function toUserDto(user: User | null): UserDto | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
  };
}

function toGameDto(game: Game): GameDto {
  return {
    id: game.id,
    gameType: game.gameType,
    status: game.status,
    playerX: toUserDto(game.playerX),
    playerO: toUserDto(game.playerO),
    winnerId: game.winnerId,
    state: game.state,
    isPublic: game.isPublic,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

export async function gameRoutes(server: FastifyInstance) {
  // 1. Create a Game
  server.post<{
    Body: {
      gameType: 'mill';
      isPublic?: boolean;
      vsAi?: boolean;
    };
  }>('/', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.code(400).send({ error: 'Missing x-user-id header' });
    }

    const { gameType, isPublic = true, vsAi = false } = request.body;
    if (gameType !== 'mill') {
      return reply.code(400).send({ error: 'Unsupported game type' });
    }

    const gameRepo = AppDataSource.getRepository(Game);
    const playerX = await getOrCreateUser(userId);

    let playerOId = null;
    let playerO = null;
    if (vsAi) {
      playerO = await getOrCreateUser(AI_USER_ID);
      playerOId = AI_USER_ID;
    }

    const game = gameRepo.create({
      gameType,
      status: vsAi ? 'in_progress' : 'waiting',
      playerXId: playerX.id,
      playerOId,
      state: createInitialState(),
      isPublic,
      playerX,
      playerO,
    });

    await gameRepo.save(game);
    return reply.send(toGameDto(game));
  });

  // 2. Get Open Games (Lobby list)
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

    return reply.send(openGames.map(toGameDto));
  });

  // Get User's Active Games
  server.get('/my-active', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.code(400).send({ error: 'Missing x-user-id header' });
    }

    const gameRepo = AppDataSource.getRepository(Game);
    const myGames = await gameRepo.find({
      where: [
        { playerXId: userId, status: In(['waiting', 'in_progress']) },
        { playerOId: userId, status: In(['waiting', 'in_progress']) },
      ],
      relations: ['playerX', 'playerO'],
      order: { updatedAt: 'DESC' },
    });

    return reply.send(myGames.map(toGameDto));
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

    return reply.send(toGameDto(game));
  });

  // 4. Join a Game (Invite Link / Lobby list selection)
  server.post<{ Params: { id: string } }>('/:id/join', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.code(400).send({ error: 'Missing x-user-id header' });
    }

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

    const playerO = await getOrCreateUser(userId);
    game.playerOId = playerO.id;
    game.playerO = playerO;
    game.status = 'in_progress';

    await gameRepo.save(game);
    return reply.send(toGameDto(game));
  });

  // 4.5 Cancel a Game (Lobby slot cancellation by creator)
  server.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.code(400).send({ error: 'Missing x-user-id header' });
    }

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
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.code(400).send({ error: 'Missing x-user-id header' });
    }

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

    // Determine X vs O
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

    // Check if player ended the game
    if (game.state.winner) {
      game.status = 'finished';
      game.winnerId = game.state.winner === 'X' ? game.playerXId : game.playerOId;
    }

    // ── AI Opponent Logic Loop ───────────────────────────────────────────────
    let aiActive = !game.state.winner && game.playerOId === AI_USER_ID;
    while (aiActive && game.state.turn === 'O') {
      try {
        if (game.state.millFormedThisTurn) {
          const removePos = getBestRemoval(game.state.board);
          game.state = handleRemoveAction(game.state, removePos, 'O');
        } else if (game.state.phase === 'placement') {
          const placePos = getBestPlaceMove(game.state.board);
          game.state = handlePlaceAction(game.state, placePos, 'O');
        } else {
          const canFly = game.state.piecesOnBoard.O === 3;
          const aiMove = getBestMove(game.state.board, canFly);
          game.state = handleMoveAction(game.state, aiMove.from, aiMove.to, 'O');
        }

        // Check for AI victory
        if (game.state.winner) {
          game.status = 'finished';
          game.winnerId = game.state.winner === 'X' ? game.playerXId : game.playerOId;
          aiActive = false;
        }
      } catch (err) {
        // Fallback: declare player 'X' the winner if the AI encounters an error/blocking state
        game.status = 'finished';
        game.winnerId = game.playerXId;
        game.state.winner = 'X';
        aiActive = false;
      }
    }

    await gameRepo.save(game);
    return reply.send(toGameDto(game));
  });
}
