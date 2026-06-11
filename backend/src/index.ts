import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppDataSource } from './data-source';
import { healthRoutes } from './routes/health';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function bootstrap() {
  // ── Database ───────────────────────────────────────────────────────────────
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  // ── Server ─────────────────────────────────────────────────────────────────
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  });

  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173'],
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  await server.register(healthRoutes, { prefix: '/health' });

  // ── Start ──────────────────────────────────────────────────────────────────
  await server.listen({ port: PORT, host: HOST });
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
