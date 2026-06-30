import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Game } from '../entities/Game';
import { GameType } from '@vibe-games/shared';
import {
  seedBots,
  toGameDto,
  createGame,
  getOpenGames,
  getUserActiveGames,
  getLeaderboard,
  joinGame,
  cancelGame,
  forfeitGame,
  submitMove
} from '../services/gameService';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

export async function gameRoutes(server: FastifyInstance) {
  await seedBots();

  server.addHook('preHandler', async (request) => {
    if (request.user) return;
    const headerUserId = request.headers['x-user-id'] as string;
    if (headerUserId) {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: headerUserId });
      if (user) request.user = user;
    }
  });

  server.post<{ Body: { gameType: GameType; isPublic?: boolean; vsAi?: boolean; aiLevel?: string; aiStarts?: boolean; } }>('/', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const { gameType, isPublic = true, vsAi = false, aiLevel = 'medium_aggressive', aiStarts = false } = request.body;
      const game = await createGame(request.user, gameType, isPublic, vsAi, aiLevel, aiStarts);
      return reply.send(await toGameDto(game, request.user.id));
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  server.get<{ Querystring: { gameType?: string; status?: string } }>('/', async (request, reply) => {
    const { gameType, status = 'waiting' } = request.query;
    const games = await getOpenGames(gameType, status);
    return reply.send(await Promise.all(games.map(g => toGameDto(g, request.user?.id))));
  });

  server.get('/my-active', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const games = await getUserActiveGames(request.user.id);
    return reply.send(await Promise.all(games.map(g => toGameDto(g, request.user?.id))));
  });

  server.get<{ Params: { gameType: GameType } }>('/leaderboard/:gameType', async (request, reply) => {
    try {
      const response = await getLeaderboard(request.params.gameType);
      return reply.send(response);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({ where: { id: request.params.id }, relations: ['playerX', 'playerO'] });
    if (!game) return reply.code(404).send({ error: 'Game not found' });
    return reply.send(await toGameDto(game, request.user?.id));
  });

  server.post<{ Params: { id: string } }>('/:id/join', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const game = await joinGame(request.params.id, request.user);
      return reply.send(await toGameDto(game, request.user.id));
    } catch (e: any) {
      const code = e.message === 'Game not found' ? 404 : (e.message.includes('play against yourself') || e.message.includes('joinable')) ? 400 : 500;
      return reply.code(code).send({ error: e.message });
    }
  });

  server.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      await cancelGame(request.params.id, request.user.id);
      return reply.send({ success: true });
    } catch (e: any) {
      const code = e.message === 'Game not found' ? 404 : e.message.includes('Only the creator') ? 403 : 400;
      return reply.code(code).send({ error: e.message });
    }
  });

  server.post<{ Params: { id: string } }>('/:id/forfeit', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const game = await forfeitGame(request.params.id, request.user.id);
      return reply.send(await toGameDto(game, request.user.id));
    } catch (e: any) {
      const code = e.message === 'Game not found' ? 404 : e.message.includes('Only participants') ? 403 : 400;
      return reply.code(code).send({ error: e.message });
    }
  });

  server.post<{ Params: { id: string }; Body: any }>('/:id/move', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const game = await submitMove(request.params.id, request.user.id, request.body);
      return reply.send(await toGameDto(game, request.user.id));
    } catch (e: any) {
      const code = e.message === 'Game not found' ? 404 : e.message.includes('not a player') ? 403 : 400;
      return reply.code(code).send({ error: e.message });
    }
  });
}
