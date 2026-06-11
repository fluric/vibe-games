import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Game } from './entities/Game';
import { UserStats } from './entities/UserStats';

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USER ?? 'vibegames',
        password: process.env.DB_PASSWORD ?? 'vibegames',
        database: process.env.DB_NAME ?? 'vibegames',
      }),
  // ⚠️ synchronize: true is OK for local dev only.
  // Switch to migrations (migration:run) before any shared/prod environment.
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Game, UserStats],
  migrations: ['src/migrations/*.ts'],
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

