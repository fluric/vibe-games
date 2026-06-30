import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { LobbyPage } from '../pages/LobbyPage';
import { BrowserRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue || key,
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() }
  }),
}));

vi.mock('../api/games', () => ({
  listGames: vi.fn().mockResolvedValue([]),
  listMyActiveGames: vi.fn().mockResolvedValue([]),
  getLeaderboard: vi.fn().mockResolvedValue({ entries: [] }),
  getAuthMe: vi.fn().mockResolvedValue({ user: { id: '1', username: 'TestUser', email: 'test@local.com', createdAt: '2025-01-01T00:00:00Z', elo: 1200, wins: 0, losses: 0, draws: 0 } }),
  getServerInfo: vi.fn().mockResolvedValue({ apiVersion: '0.0.1', gitRevision: 'test' }),
}));

describe('LobbyPage', () => {
  it('renders and fetches auth', async () => {
    render(
      <BrowserRouter>
        <LobbyPage />
      </BrowserRouter>
    );
    const elements = await screen.findAllByText('TestUser');
    expect(elements.length).toBeGreaterThan(0);
  });
});
