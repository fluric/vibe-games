import type { EscapeProgressResponse, EscapeLeaderboardResponse } from '@vibe-games/shared';

function getApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const storedToken = localStorage.getItem('vibe-games-token');
  if (storedToken) headers.set('Authorization', `Bearer ${storedToken}`);

  const res = await fetch(url, { credentials: 'include', ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[escape API] ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch the current user's room-by-room progress. */
export function getEscapeProgress(): Promise<EscapeProgressResponse> {
  return request<EscapeProgressResponse>('/escape/progress');
}

/** Mark a room as solved. Idempotent — safe to call multiple times. */
export function solveRoom(roomId: number): Promise<{ ok: boolean; solvedAt: string }> {
  return request<{ ok: boolean; solvedAt: string }>('/escape/solve', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
  });
}

/** Fetch the full-escapee leaderboard. */
export function getEscapeLeaderboard(): Promise<EscapeLeaderboardResponse> {
  return request<EscapeLeaderboardResponse>('/escape/leaderboard');
}
