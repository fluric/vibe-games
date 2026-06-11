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

  if (process.env.NODE_ENV === 'production') {
    await AppDataSource.runMigrations();
    console.log('✅ Database migrations applied');
  }

  // ── Server ─────────────────────────────────────────────────────────────────
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  });

  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      
      const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      const isVercel = origin.endsWith('.vercel.app') || new URL(origin).hostname.endsWith('.vercel.app');
      
      if (isLocalhost || isVercel) {
        cb(null, true);
        return;
      }
      
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
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
