import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { UserStats } from '../entities/UserStats';
import { UserDto, AuthStatusResponse } from '@vibe-games/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'vibe-games-default-secret-key-do-not-use-in-prod';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function toUserDto(user: User): Promise<UserDto> {
  const statsRepo = AppDataSource.getRepository(UserStats);
  const stats = await statsRepo.findOneBy({ userId: user.id, gameType: 'mill' });

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    email: user.email,
    elo: stats ? stats.elo : 1200,
    wins: stats ? stats.wins : 0,
    losses: stats ? stats.losses : 0,
    draws: stats ? stats.draws : 0,
  };
}

async function getOrCreateGoogleUser(
  googleId: string,
  email: string,
  name: string,
  picture?: string
): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);
  let user = await userRepo.findOne({
    where: [{ googleId }, { email }],
  });

  if (!user) {
    // Sanitize and determine unique username
    let baseUsername = name.trim().replace(/\s+/g, '_').substring(0, 30);
    if (!baseUsername) {
      baseUsername = email.split('@')[0].substring(0, 30);
    }
    if (!baseUsername) {
      baseUsername = 'Player';
    }

    let username = baseUsername;
    let existing = await userRepo.findOneBy({ username });
    while (existing) {
      username = `${baseUsername}_${Math.random().toString(36).substring(2, 6)}`;
      existing = await userRepo.findOneBy({ username });
    }

    user = userRepo.create({
      googleId,
      email,
      username,
      avatarUrl: picture || null,
    });
    await userRepo.save(user);
  } else {
    // Update profile info if missing
    let updated = false;
    if (!user.googleId) {
      user.googleId = googleId;
      updated = true;
    }
    if (!user.avatarUrl && picture) {
      user.avatarUrl = picture;
      updated = true;
    }
    if (updated) {
      await userRepo.save(user);
    }
  }

  return user;
}

export async function authRoutes(server: FastifyInstance) {
  // Helper to set cookie AND return the token for clients that can't use cookies (Safari ITP)
  const setSessionCookie = (reply: any, userId: string): string => {
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    const isProd = process.env.NODE_ENV === 'production';

    reply.setCookie('session', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Return the token so callers can include it in the response body.
    // Safari on iOS (ITP) blocks third-party httpOnly cookies when frontend
    // and backend are on different domains, causing session loss on reload.
    // The frontend stores this token in localStorage and sends it via
    // Authorization: Bearer header instead.
    return token;
  };

  // Google Login Route
  server.post<{
    Body: { idToken: string };
  }>('/google', async (request, reply) => {
    const { idToken } = request.body;
    if (!idToken) {
      return reply.code(400).send({ error: 'Missing idToken' });
    }

    if (!googleClient) {
      return reply.code(500).send({ error: 'Google auth client is not configured' });
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        return reply.code(400).send({ error: 'Invalid token payload' });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name || 'Anonymous User';
      const picture = payload.picture;

      if (!email) {
        return reply.code(400).send({ error: 'Email is required from Google' });
      }

      const user = await getOrCreateGoogleUser(googleId, email, name, picture);
      const token = setSessionCookie(reply, user.id);

      return reply.send({ user: await toUserDto(user), token } satisfies AuthStatusResponse);
    } catch (err: any) {
      request.log.error(err);
      return reply.code(401).send({ error: 'Failed to verify Google token' });
    }
  });

  // ── OAuth Redirect Flow (Firefox / privacy-browser fallback) ────────────
  // Uses the traditional authorization code flow instead of GSI popup.
  // Requires GOOGLE_CLIENT_SECRET and BACKEND_URL env vars.

  server.get<{
    Querystring: { returnUrl?: string };
  }>('/google/redirect', async (request, reply) => {
    if (!GOOGLE_CLIENT_ID) {
      return reply.code(500).send({ error: 'Google auth not configured' });
    }

    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret) {
      return reply.code(500).send({ error: 'Google client secret not configured for redirect flow' });
    }

    const returnUrl = request.query.returnUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const redirectUri = `${backendUrl}/auth/google/redirect/callback`;

    const client = new OAuth2Client(GOOGLE_CLIENT_ID, clientSecret, redirectUri);

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state: Buffer.from(JSON.stringify({ returnUrl })).toString('base64url'),
      prompt: 'select_account',
    });

    return reply.redirect(authUrl);
  });

  server.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>('/google/redirect/callback', async (request, reply) => {
    const { code, state, error: authError } = request.query;

    // Parse returnUrl from state
    let returnUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        returnUrl = stateData.returnUrl || returnUrl;
      } catch { /* ignore malformed state */ }
    }

    if (authError || !code) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      return reply.redirect(`${returnUrl}${sep}auth_error=${encodeURIComponent(authError || 'no_code')}`);
    }

    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret || !GOOGLE_CLIENT_ID) {
      return reply.code(500).send({ error: 'Google auth not configured' });
    }

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const redirectUri = `${backendUrl}/auth/google/redirect/callback`;

    try {
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, clientSecret, redirectUri);
      const { tokens } = await client.getToken(code);

      if (!tokens.id_token) {
        throw new Error('No id_token returned from Google');
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Invalid token payload');
      }

      const user = await getOrCreateGoogleUser(
        payload.sub,
        payload.email,
        payload.name || 'Anonymous User',
        payload.picture
      );

      const token = setSessionCookie(reply, user.id);

      // Redirect back to frontend with token in URL
      const sep = returnUrl.includes('?') ? '&' : '?';
      return reply.redirect(`${returnUrl}${sep}token=${encodeURIComponent(token)}`);
    } catch (err: any) {
      request.log.error(err);
      const sep = returnUrl.includes('?') ? '&' : '?';
      return reply.redirect(`${returnUrl}${sep}auth_error=token_exchange_failed`);
    }
  });

  // Mock Developer Login Route
  server.post<{
    Body: { name: string; email: string; avatarUrl?: string };
  }>('/mock', async (request, reply) => {
    const isProd = process.env.NODE_ENV === 'production';
    const allowMock = process.env.ALLOW_MOCK_AUTH === 'true';

    if (isProd && !allowMock) {
      return reply.code(403).send({ error: 'Mock authentication is disabled in production' });
    }

    const { name, email, avatarUrl } = request.body;
    if (!name || !email) {
      return reply.code(400).send({ error: 'Missing name or email' });
    }

    try {
      const googleId = `mock-${email}`;
      const user = await getOrCreateGoogleUser(googleId, email, name, avatarUrl);
      const token = setSessionCookie(reply, user.id);

      return reply.send({ user: await toUserDto(user), token } satisfies AuthStatusResponse);
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to perform mock login' });
    }
  });

  // Logout Route
  server.post('/logout', async (request, reply) => {
    reply.clearCookie('session', {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return reply.send({ success: true });
  });

  // Update current user username.
  server.put<{
    Body: { username: string };
  }>('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let sessionToken: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.slice(7);
    } else {
      sessionToken = request.cookies.session;
    }

    if (!sessionToken) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as { userId: string };
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: decoded.userId });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const { username } = request.body;
      const cleanUsername = username?.trim();
      if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
        return reply.code(400).send({ error: 'Username must be between 3 and 30 characters' });
      }

      // Check if username is already taken by someone else
      const existing = await userRepo.findOneBy({ username: cleanUsername });
      if (existing && existing.id !== user.id) {
        return reply.code(400).send({ error: 'Username is already taken' });
      }

      user.username = cleanUsername;
      await userRepo.save(user);

      return reply.send({ user: await toUserDto(user) } satisfies AuthStatusResponse);
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid session token' });
    }
  });

  // Get current user session.
  // Accepts token via:
  //   1. Authorization: Bearer <token>  — primary (for Safari ITP / cross-domain)
  //   2. session cookie                 — fallback (non-Safari browsers)
  server.get('/me', async (request, reply) => {
    // Extract token from Authorization header first, then cookie
    const authHeader = request.headers.authorization;
    let sessionToken: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.slice(7);
    } else {
      sessionToken = request.cookies.session;
    }

    if (!sessionToken) {
      return reply.send({ user: null } satisfies AuthStatusResponse);
    }

    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as { userId: string };
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: decoded.userId });

      if (!user) {
        return reply.send({ user: null } satisfies AuthStatusResponse);
      }

      return reply.send({ user: await toUserDto(user) } satisfies AuthStatusResponse);
    } catch (err) {
      // Clear invalid session cookie
      reply.clearCookie('session', {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });
      return reply.send({ user: null } satisfies AuthStatusResponse);
    }
  });
}
