import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from 'jsonwebtoken';
import { AppDataSource } from './data-source';
import { healthRoutes } from './routes/health';
import { gameRoutes } from './routes/games';
import { authRoutes } from './routes/auth';
import { User } from './entities/User';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'vibe-games-default-secret-key-do-not-use-in-prod';

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

  await server.register(cookie);

  server.decorateRequest('user', undefined);

  server.addHook('preHandler', async (request) => {
    // 1. Try cookie session
    const sessionCookie = request.cookies.session;
    if (sessionCookie) {
      try {
        const decoded = jwt.verify(sessionCookie, JWT_SECRET) as { userId: string };
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOneBy({ id: decoded.userId });
        if (user) {
          request.user = user;
          return;
        }
      } catch (err) {
        // Ignore JWT verification errors, proceed to header fallback
      }
    }

    // 2. Try x-user-id header fallback (for tests, CLI, compatibility)
    const userIdHeader = request.headers['x-user-id'] as string;
    if (userIdHeader) {
      const userRepo = AppDataSource.getRepository(User);
      let user = await userRepo.findOneBy({ id: userIdHeader });
      if (!user) {
        user = userRepo.create({
          id: userIdHeader,
          username: `Player_${userIdHeader.substring(0, 5)}`,
        });
        await userRepo.save(user);
      }
      request.user = user;
    }
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(authRoutes, { prefix: '/auth' });
  await server.register(gameRoutes, { prefix: '/games' });

  // ── Start ──────────────────────────────────────────────────────────────────
  await server.listen({ port: PORT, host: HOST });
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
