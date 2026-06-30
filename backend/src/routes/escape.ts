import type { FastifyInstance } from 'fastify';
import { AppDataSource } from '../data-source';
import { EscapeProgress } from '../entities/EscapeProgress';
import { User } from '../entities/User';
import type { EscapeProgressResponse, EscapeLeaderboardResponse } from '@vibe-games/shared';

/** Total number of rooms currently published. Bump this when new rooms are added. */
const TOTAL_ROOMS = 3;

/** Fastify plugin exposing all /escape/* endpoints. */
export async function escapeRoutes(server: FastifyInstance): Promise<void> {
  const progressRepo = AppDataSource.getRepository(EscapeProgress);
  const userRepo = AppDataSource.getRepository(User);

  // ── GET /escape/progress ──────────────────────────────────────────────────
  // Returns the authenticated user's room-by-room progress.
  server.get('/progress', async (request, reply): Promise<EscapeProgressResponse> => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' }) as never;
    }

    const rows = await progressRepo.find({
      where: { userId: request.user.id },
      order: { roomId: 'ASC' },
    });

    const roomMap = new Map(rows.map((r) => [r.roomId, r]));

    const rooms = Array.from({ length: TOTAL_ROOMS }, (_, i) => {
      const roomId = i + 1;
      const row = roomMap.get(roomId);
      return {
        roomId,
        solved: row?.solvedAt != null,
        solvedAt: row?.solvedAt?.toISOString() ?? null,
      };
    });

    const roomsCleared = rooms.filter((r) => r.solved).length;
    return { rooms, roomsCleared };
  });

  // ── POST /escape/solve ────────────────────────────────────────────────────
  // Marks a room as solved. Idempotent — repeated calls return the original solvedAt.
  server.post<{ Body: { roomId: number } }>(
    '/solve',
    async (request, reply): Promise<{ ok: boolean; solvedAt: string }> => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' }) as never;
      }

      const { roomId } = request.body;

      if (!Number.isInteger(roomId) || roomId < 1 || roomId > TOTAL_ROOMS) {
        return reply.code(400).send({ error: 'Invalid roomId' }) as never;
      }

      // Gate: player may only solve roomId if roomId <= roomsCleared + 1
      const clearedCount = await progressRepo.count({
        where: { userId: request.user.id },
      });
      const maxAccessible = clearedCount + 1;
      if (roomId > maxAccessible) {
        return reply.code(403).send({ error: 'Room not yet accessible' }) as never;
      }

      // Find or create the progress row
      let row = await progressRepo.findOne({
        where: { userId: request.user.id, roomId },
      });

      if (!row) {
        row = progressRepo.create({ userId: request.user.id, roomId, solvedAt: null });
      }

      // Only record the first solve — don't overwrite existing solvedAt
      if (!row.solvedAt) {
        row.solvedAt = new Date();
        await progressRepo.save(row);
      }

      return { ok: true, solvedAt: row.solvedAt.toISOString() };
    },
  );

  // ── GET /escape/leaderboard ───────────────────────────────────────────────
  // Returns players who have cleared all TOTAL_ROOMS rooms, sorted by when
  // they first fully escaped (earliest = best rank).
  server.get('/leaderboard', async (_request, _reply): Promise<EscapeLeaderboardResponse> => {
    // Aggregate per user: count solved rooms + find the latest solvedAt
    // (latest individual room solve = the moment the player fully escaped)
    const rows = await progressRepo
      .createQueryBuilder('ep')
      .select('ep.userId', 'userId')
      .addSelect('COUNT(*)', 'roomsCleared')
      .addSelect('MAX(ep.solvedAt)', 'firstClearedAt')
      .where('ep.solvedAt IS NOT NULL')
      .groupBy('ep.userId')
      .having('COUNT(*) >= :total', { total: TOTAL_ROOMS })
      .orderBy('"firstClearedAt"', 'ASC')
      .getRawMany<{ userId: string; roomsCleared: string; firstClearedAt: string }>();

    const userIds = rows.map((r) => r.userId);
    if (userIds.length === 0) return { entries: [] };

    const users = await userRepo
      .createQueryBuilder('u')
      .whereInIds(userIds)
      .getMany();

    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = rows.map((r) => {
      const u = userMap.get(r.userId);
      return {
        userId: r.userId,
        username: u?.username ?? 'Unknown',
        avatarUrl: u?.avatarUrl ?? null,
        roomsCleared: Number(r.roomsCleared),
        firstClearedAt: r.firstClearedAt,
      };
    });

    return { entries };
  });
}
