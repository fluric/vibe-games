import type { GameDto, AuthStatusResponse, LeaderboardResponse, GameType } from '@vibe-games/shared';

// Helper to get or generate a persistent local user ID
export function getUserId(): string {
  let id = localStorage.getItem('vibe-games-user-id');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateFallbackUuid();
    localStorage.setItem('vibe-games-user-id', id);
  }
  return id;
}

function generateFallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getApiUrl(): string {
  let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  if (!rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
    rawApiUrl = `https://${rawApiUrl}`;
  }
  return rawApiUrl;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  console.log(`[API Request] ${options.method || 'GET'} ${url}`);
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-user-id', getUserId());

  // Safari on iOS (ITP) blocks third-party cookies for cross-domain requests.
  // If we have a JWT stored in localStorage (set at login), send it as a Bearer
  // token so /auth/me and other authenticated endpoints work on Safari.
  const storedToken = localStorage.getItem('vibe-games-token');
  if (storedToken) {
    headers.set('Authorization', `Bearer ${storedToken}`);
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  console.log(`[API Response] ${response.status} for ${options.method || 'GET'} ${url}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error(`[API Error] Status: ${response.status}, Body:`, errorBody);
    throw new Error(errorBody.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function createGame(
  gameType: GameType,
  isPublic = true,
  vsAi = false,
  aiLevel?: 'easy' | 'medium' | 'hard' | 'easy_random' | 'easy_cowardly' | 'easy_greedy' | 'easy_aggressive' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle' | 'expert_smart' | 'rl_novice' | 'rl_intermediate' | 'rl_strong' | 'rl_master',
  aiStarts = false
): Promise<GameDto> {
  return request<GameDto>('/games', {
    method: 'POST',
    body: JSON.stringify({ gameType, isPublic, vsAi, aiLevel, aiStarts }),
  });
}

export async function listGames(gameType?: GameType, status?: string): Promise<GameDto[]> {
  const params = new URLSearchParams();
  if (gameType) params.append('gameType', gameType);
  if (status) params.append('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<GameDto[]>(`/games${query}`);
}

export async function getGame(id: string): Promise<GameDto> {
  return request<GameDto>(`/games/${id}`);
}

export async function joinGame(id: string): Promise<GameDto> {
  return request<GameDto>(`/games/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function submitMove(
  id: string,
  move: {
    action: string;
    position?: number;
    from?: string | number;
    to?: string | number;
    column?: number;
     
    [key: string]: any;
  }
): Promise<GameDto> {
  return request<GameDto>(`/games/${id}/move`, {
    method: 'POST',
    body: JSON.stringify(move),
  });
}

export async function listMyActiveGames(): Promise<GameDto[]> {
  return request<GameDto[]>('/games/my-active');
}

export async function cancelGame(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/games/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function forfeitGame(id: string): Promise<GameDto> {
  return request<GameDto>(`/games/${id}/forfeit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getAuthMe(): Promise<AuthStatusResponse> {
  return request<AuthStatusResponse>('/auth/me');
}

export async function loginWithGoogle(idToken: string): Promise<AuthStatusResponse> {
  return request<AuthStatusResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

export async function loginMock(name: string, email: string, avatarUrl?: string): Promise<AuthStatusResponse> {
  return request<AuthStatusResponse>('/auth/mock', {
    method: 'POST',
    body: JSON.stringify({ name, email, avatarUrl }),
  });
}

export async function logout(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getLeaderboard(gameType: GameType): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>(`/games/leaderboard/${gameType}`);
}

export async function updateUsername(username: string): Promise<AuthStatusResponse> {
  return request<AuthStatusResponse>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ username }),
  });
}

