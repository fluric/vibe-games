import { FastifyInstance } from 'fastify';
import { HealthResponse } from '@vibe-games/shared';
import { AppDataSource } from '../data-source';

export async function healthRoutes(server: FastifyInstance) {
  server.get<{ Reply: HealthResponse }>('/', async (_request, reply) => {
    let databaseConnected = false;
    try {
      if (AppDataSource.isInitialized) {
        await AppDataSource.query('SELECT 1');
        databaseConnected = true;
      }
    } catch (err) {
      server.log.error(err, 'Database health check failed');
    }

    const ok = databaseConnected;

    return reply.send({
      ok,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
      database: databaseConnected,
    });
  });
}
