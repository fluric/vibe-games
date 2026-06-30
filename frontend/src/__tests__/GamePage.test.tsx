import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { GamePage } from '../pages/GamePage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue || key,
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() }
  }),
}));

vi.mock('../api/games', () => ({
  getGame: vi.fn().mockResolvedValue({
    id: 'game-1',
    gameType: 'mill',
    status: 'in_progress',
    isPublic: true,
    playerXId: '1',
    playerOId: '2',
    playerX: { id: '1', username: 'TestUser' },
    playerO: { id: '2', username: 'Bot' },
    state: { board: Array(24).fill(null), piecesOnBoard: { X: 0, O: 0 }, placementsRemaining: { X: 9, O: 9 }, turn: 'X' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }),
  getAuthMe: vi.fn().mockResolvedValue({ user: { id: '1', username: 'TestUser', email: 'test@local.com', createdAt: '2025-01-01T00:00:00Z', elo: 1200, wins: 0, losses: 0, draws: 0 } }),
  getUserId: vi.fn().mockReturnValue('1'),
}));

vi.mock('../utils/audio', () => ({
  audio: {
    playPlaceSound: vi.fn(),
    playCaptureSound: vi.fn(),
    playWinSound: vi.fn(),
    playLoseSound: vi.fn(),
    playDrawSound: vi.fn(),
  }
}));

describe('GamePage', () => {
  it('renders game board', async () => {
    render(
      <MemoryRouter initialEntries={['/game/game-1']}>
        <Routes>
          <Route path="/game/:id" element={<GamePage />} />
        </Routes>
      </MemoryRouter>
    );
    const elements = await screen.findAllByText(/TestUser/i);
    expect(elements.length).toBeGreaterThan(0);
  });
});
