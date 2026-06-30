import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { EscapePage } from '../pages/EscapePage';
import { BrowserRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue || key,
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() }
  }),
}));

vi.mock('../api/escape', () => ({
  getProgress: vi.fn().mockResolvedValue({
    rooms: [
      { roomId: 1, solved: true, solvedAt: '2025-01-01T00:00:00Z' },
      { roomId: 2, solved: false, solvedAt: null },
      { roomId: 3, solved: false, solvedAt: null }
    ],
    roomsCleared: 1
  }),
  solveRoom: vi.fn().mockResolvedValue({ ok: true }),
  getEscapeLeaderboard: vi.fn().mockResolvedValue({ entries: [] })
}));

describe('EscapePage', () => {
  it('renders and fetches progress', async () => {
    render(
      <BrowserRouter>
        <EscapePage />
      </BrowserRouter>
    );
    const elements = await screen.findAllByText(/The Keypad/i);
    expect(elements.length).toBeGreaterThan(0);
  });
});
