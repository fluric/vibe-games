import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { UserStats } from '../entities/UserStats';
import { UserDto, GameType } from '@vibe-games/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'vibe-games-default-secret-key-do-not-use-in-prod';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

export const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export async function toUserDto(user: User): Promise<UserDto> {
  const statsRepo = AppDataSource.getRepository(UserStats);
  const allStats = await statsRepo.findBy({ userId: user.id });

  const gameStats = {} as Record<GameType, import('@vibe-games/shared').UserStatsDto>;
  const gameTypes: GameType[] = ['mill', 'connect_four', 'tic_tac_toe', 'grail_quest'];

  for (const gt of gameTypes) {
    const stats = allStats.find((s) => s.gameType === gt);
    gameStats[gt] = {
      elo: stats ? stats.elo : 1200,
      wins: stats ? stats.wins : 0,
      losses: stats ? stats.losses : 0,
      draws: stats ? stats.draws : 0,
    };
  }

  const millStats = gameStats['mill'];

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    email: user.email,
    elo: millStats.elo,
    wins: millStats.wins,
    losses: millStats.losses,
    draws: millStats.draws,
    gameStats,
  };
}

export async function getOrCreateGoogleUser(
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

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
}

export async function getUserById(userId: string): Promise<User | null> {
  const userRepo = AppDataSource.getRepository(User);
  return await userRepo.findOneBy({ id: userId });
}

export async function updateUsername(userId: string, username: string): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOneBy({ id: userId });
  if (!user) throw new Error('User not found');

  const cleanUsername = username?.trim();
  if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
    throw new Error('Username must be between 3 and 30 characters');
  }

  const existing = await userRepo.findOneBy({ username: cleanUsername });
  if (existing && existing.id !== user.id) {
    throw new Error('Username is already taken');
  }

  user.username = cleanUsername;
  await userRepo.save(user);
  return user;
}

export async function verifyGoogleToken(idToken: string) {
  if (!googleClient) throw new Error('Google auth client is not configured');
  
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  
  const payload = ticket.getPayload();
  if (!payload || !payload.email) throw new Error('Invalid token payload');
  
  return await getOrCreateGoogleUser(
    payload.sub,
    payload.email,
    payload.name || 'Anonymous User',
    payload.picture
  );
}

export async function handleGoogleRedirectCallback(code: string, redirectUri: string) {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret || !googleClient) throw new Error('Google auth not configured');

  const client = new OAuth2Client(GOOGLE_CLIENT_ID, clientSecret, redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) throw new Error('No id_token returned from Google');

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) throw new Error('Invalid token payload');

  return await getOrCreateGoogleUser(
    payload.sub,
    payload.email,
    payload.name || 'Anonymous User',
    payload.picture
  );
}
