import assert from 'assert';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { AppDataSource } from '../data-source';
import { authRoutes } from '../routes/auth';
import { User } from '../entities/User';
import { AuthStatusResponse } from '@vibe-games/shared';

async function runTests() {
  console.log('🧪 Starting Auth API Integration Tests...\n');

  // 1. Initialize DataSource
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const userRepo = AppDataSource.getRepository(User);
  // Clean up database users table to make tests repeatable (avoiding primary key collisions)
  await userRepo.createQueryBuilder().delete().where('id IS NOT NULL').execute();

  // Create Fastify test app
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.ready();

  // ── Test 1: GET /auth/me (No session) ──────────────────────────────────────
  console.log('👉 Testing: GET /auth/me (No session)...');
  const meRes1 = await app.inject({
    method: 'GET',
    url: '/auth/me',
  });
  assert.strictEqual(meRes1.statusCode, 200);
  const meBody1 = JSON.parse(meRes1.body) as AuthStatusResponse;
  assert.strictEqual(meBody1.user, null);

  // ── Test 2: POST /auth/mock (Valid signup) ──────────────────────────────────
  console.log('👉 Testing: POST /auth/mock (Valid signup)...');
  const mockLoginRes = await app.inject({
    method: 'POST',
    url: '/auth/mock',
    payload: {
      name: 'Alice Dev',
      email: 'alice@vibegames.local',
      avatarUrl: 'http://avatar.url/alice',
    },
  });

  assert.strictEqual(mockLoginRes.statusCode, 200);
  const mockBody = JSON.parse(mockLoginRes.body) as AuthStatusResponse;
  assert.ok(mockBody.user);
  assert.strictEqual(mockBody.user.username, 'Alice_Dev');
  assert.strictEqual(mockBody.user.email, 'alice@vibegames.local');
  assert.strictEqual(mockBody.user.avatarUrl, 'http://avatar.url/alice');
  assert.ok(mockBody.user.id);

  // Verify cookie is set
  const cookies = mockLoginRes.cookies;
  const sessionCookie = cookies.find((c) => c.name === 'session');
  assert.ok(sessionCookie);
  assert.ok(sessionCookie.value);
  assert.strictEqual(sessionCookie.httpOnly, true);

  // ── Test 3: GET /auth/me (With valid session cookie) ────────────────────────
  console.log('👉 Testing: GET /auth/me (With valid session)...');
  const meRes2 = await app.inject({
    method: 'GET',
    url: '/auth/me',
    cookies: {
      session: sessionCookie.value,
    },
  });
  assert.strictEqual(meRes2.statusCode, 200);
  const meBody2 = JSON.parse(meRes2.body) as AuthStatusResponse;
  assert.ok(meBody2.user);
  assert.strictEqual(meBody2.user.id, mockBody.user.id);
  assert.strictEqual(meBody2.user.username, 'Alice_Dev');

  // ── Test 4: POST /auth/logout (Clear session) ──────────────────────────────
  console.log('👉 Testing: POST /auth/logout (Clear session)...');
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/auth/logout',
  });
  assert.strictEqual(logoutRes.statusCode, 200);
  const logoutBody = JSON.parse(logoutRes.body);
  assert.strictEqual(logoutBody.success, true);

  // Check that session cookie header was set to clear the cookie
  const clearedCookies = logoutRes.cookies;
  const clearedSession = clearedCookies.find((c) => c.name === 'session');
  assert.ok(clearedSession);
  // TypeORM / Fastify clearCookie sets maxAge to a negative number or past date
  assert.ok(clearedSession.expires && new Date(clearedSession.expires).getTime() < Date.now());

  // ── Test 5: GET /auth/me (After logout) ────────────────────────────────────
  console.log('👉 Testing: GET /auth/me (After logout)...');
  const meRes3 = await app.inject({
    method: 'GET',
    url: '/auth/me',
    cookies: {
      session: clearedSession.value,
    },
  });
  assert.strictEqual(meRes3.statusCode, 200);
  const meBody3 = JSON.parse(meRes3.body) as AuthStatusResponse;
  assert.strictEqual(meBody3.user, null);

  console.log('\n✅ All Auth API Integration Tests passed successfully!');
}

// Execute tests
(async () => {
  try {
    await runTests();
  } catch (error) {
    console.error('\n❌ Auth Integration Test failed!');
    console.error(error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔌 Database connection closed.');
    }
  }
})();
