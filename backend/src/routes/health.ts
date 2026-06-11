import { FastifyInstance } from 'fastify';
import { HealthResponse } from '@vibe-games/shared';

export async function healthRoutes(server: FastifyInstance) {
  server.get<{ Reply: HealthResponse }>('/', async (_request, reply) => {
    return reply.send({
      ok: true,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
    });
  });
}
