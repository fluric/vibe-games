import type { GameDto } from '@vibe-games/shared';

// Helper to get or generate a persistent local user ID
export function getUserId(): string {
  let id = localStorage.getItem('vibe-games-user-id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : generateFallbackUuid();
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
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-user-id', getUserId());

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function createGame(
  gameType: 'mill',
  isPublic = true,
  vsAi = false
): Promise<GameDto> {
  return request<GameDto>('/games', {
    method: 'POST',
    body: JSON.stringify({ gameType, isPublic, vsAi }),
  });
}

export async function listOpenGames(): Promise<GameDto[]> {
  return request<GameDto[]>('/games');
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
    action: 'place' | 'move' | 'remove';
    position?: number;
    from?: number;
    to?: number;
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
