import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { AuthStatusResponse } from '@vibe-games/shared';
import * as authService from '../services/authService';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

export async function authRoutes(server: FastifyInstance) {
  const setSessionCookie = (reply: any, userId: string): string => {
    const token = authService.generateToken(userId);
    const isProd = process.env.NODE_ENV === 'production';

    reply.setCookie('session', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return token;
  };

  server.post<{ Body: { idToken: string } }>('/google', async (request, reply) => {
    const { idToken } = request.body;
    if (!idToken) return reply.code(400).send({ error: 'Missing idToken' });

    try {
      const user = await authService.verifyGoogleToken(idToken);
      const token = setSessionCookie(reply, user.id);
      return reply.send({ user: await authService.toUserDto(user), token } satisfies AuthStatusResponse);
    } catch (err: any) {
      request.log.error(err);
      const isConfigError = err.message === 'Google auth client is not configured';
      return reply.code(isConfigError ? 500 : 401).send({ error: isConfigError ? err.message : 'Failed to verify Google token' });
    }
  });

  server.get<{ Querystring: { returnUrl?: string } }>('/google/redirect', async (request, reply) => {
    if (!GOOGLE_CLIENT_ID) return reply.code(500).send({ error: 'Google auth not configured' });
    
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret) return reply.code(500).send({ error: 'Google client secret not configured for redirect flow' });

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

  server.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/google/redirect/callback', async (request, reply) => {
    const { code, state, error: authError } = request.query;

    let returnUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        returnUrl = stateData.returnUrl || returnUrl;
      } catch { }
    }

    if (authError || !code) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      return reply.redirect(`${returnUrl}${sep}auth_error=${encodeURIComponent(authError || 'no_code')}`);
    }

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const redirectUri = `${backendUrl}/auth/google/redirect/callback`;

    try {
      const user = await authService.handleGoogleRedirectCallback(code, redirectUri);
      const token = setSessionCookie(reply, user.id);
      
      const sep = returnUrl.includes('?') ? '&' : '?';
      return reply.redirect(`${returnUrl}${sep}token=${encodeURIComponent(token)}`);
    } catch (err: any) {
      request.log.error(err);
      const sep = returnUrl.includes('?') ? '&' : '?';
      if (err.message.includes('not configured')) {
         return reply.code(500).send({ error: err.message });
      }
      return reply.redirect(`${returnUrl}${sep}auth_error=token_exchange_failed`);
    }
  });

  server.post<{ Body: { name: string; email: string; avatarUrl?: string } }>('/mock', async (request, reply) => {
    const isProd = process.env.NODE_ENV === 'production';
    const allowMock = process.env.ALLOW_MOCK_AUTH === 'true';

    if (isProd && !allowMock) return reply.code(403).send({ error: 'Mock authentication is disabled in production' });

    const { name, email, avatarUrl } = request.body;
    if (!name || !email) return reply.code(400).send({ error: 'Missing name or email' });

    try {
      const googleId = `mock-${email}`;
      const user = await authService.getOrCreateGoogleUser(googleId, email, name, avatarUrl);
      const token = setSessionCookie(reply, user.id);

      return reply.send({ user: await authService.toUserDto(user), token } satisfies AuthStatusResponse);
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to perform mock login' });
    }
  });

  server.post('/logout', async (request, reply) => {
    reply.clearCookie('session', {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return reply.send({ success: true });
  });

  server.put<{ Body: { username: string } }>('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : request.cookies.session;

    if (!sessionToken) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const decoded = authService.verifyToken(sessionToken);
      const user = await authService.updateUsername(decoded.userId, request.body.username);
      return reply.send({ user: await authService.toUserDto(user) } satisfies AuthStatusResponse);
    } catch (err: any) {
      if (err.message === 'User not found') return reply.code(404).send({ error: err.message });
      if (err.message.includes('Username')) return reply.code(400).send({ error: err.message });
      return reply.code(401).send({ error: 'Invalid session token' });
    }
  });

  server.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : request.cookies.session;

    if (!sessionToken) return reply.send({ user: null } satisfies AuthStatusResponse);

    try {
      const decoded = authService.verifyToken(sessionToken);
      const user = await authService.getUserById(decoded.userId);
      if (!user) return reply.send({ user: null } satisfies AuthStatusResponse);
      return reply.send({ user: await authService.toUserDto(user) } satisfies AuthStatusResponse);
    } catch (err) {
      reply.clearCookie('session', {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });
      return reply.send({ user: null } satisfies AuthStatusResponse);
    }
  });
}
