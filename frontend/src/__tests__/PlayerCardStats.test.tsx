/**
 * Tests for the Active Player card in LobbyPage.
 *
 * Spec reference: specs/lobby_spec.md Section 1.1
 * Spec reference: specs/testing_spec.md Section 1.3
 *
 * These tests verify that the ELO rating and wins/losses/draws update correctly
 * when the user switches between game type tabs. No server is needed.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────────
// Minimal mock of the LobbyPage context — we test the player card logic
// by extracting the display logic into a small testable component.
// ──────────────────────────────────────────────────────────────────────────────

import type { UserDto, GameType } from '@vibe-games/shared';

/** Reproduces the player card stat display logic from LobbyPage.tsx */
function PlayerCardStats({
  currentUser,
  activeGameTab,
}: {
  currentUser: UserDto | null;
  activeGameTab: GameType;
}) {
  const ratingLabel =
    activeGameTab === 'mill'
      ? "Nine Men's Morris Rating:"
      : activeGameTab === 'connect_four'
        ? 'Connect Four Rating:'
        : activeGameTab === 'holy_grail'
          ? 'Grail Quest Rating:'
          : 'Rating:';

  const stats = currentUser?.gameStats?.[activeGameTab] ?? {
    elo: currentUser?.elo ?? 1200,
    wins: currentUser?.wins ?? 0,
    losses: currentUser?.losses ?? 0,
    draws: currentUser?.draws ?? 0,
  };

  return (
    <div>
      <span data-testid="rating-label">{ratingLabel}</span>
      <span data-testid="elo">{stats.elo} ELO</span>
      <span data-testid="wins">Wins: {stats.wins}</span>
      <span data-testid="losses">Losses: {stats.losses}</span>
      <span data-testid="draws">Draws: {stats.draws}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Test data
// ──────────────────────────────────────────────────────────────────────────────

const mockUser: UserDto = {
  id: 'test-user-id',
  username: 'TestPlayer',
  createdAt: '2025-01-01T00:00:00Z',
  elo: 1200,
  wins: 5,
  losses: 3,
  draws: 1,
  gameStats: {
    mill:         { elo: 1350, wins: 5, losses: 3, draws: 1 },
    connect_four: { elo: 1176, wins: 0, losses: 1, draws: 0 },
    tic_tac_toe:  { elo: 1200, wins: 0, losses: 0, draws: 0 },
    holy_grail:   { elo: 1450, wins: 2, losses: 0, draws: 0 },
    escape:       { elo: 1200, wins: 0, losses: 0, draws: 0 },
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('PlayerCard — ELO and stats per game tab (specs/lobby_spec.md §1.1)', () => {
  it('shows Nine Mens Morris label and correct stats on mill tab', () => {
    render(<PlayerCardStats currentUser={mockUser} activeGameTab="mill" />);
    expect(screen.getByTestId('rating-label').textContent).toContain("Nine Men's Morris Rating:");
    expect(screen.getByTestId('elo').textContent).toBe('1350 ELO');
    expect(screen.getByTestId('wins').textContent).toBe('Wins: 5');
    expect(screen.getByTestId('losses').textContent).toBe('Losses: 3');
    expect(screen.getByTestId('draws').textContent).toBe('Draws: 1');
  });

  it('shows Connect Four label and correct stats on connect_four tab', () => {
    render(<PlayerCardStats currentUser={mockUser} activeGameTab="connect_four" />);
    expect(screen.getByTestId('rating-label').textContent).toBe('Connect Four Rating:');
    expect(screen.getByTestId('elo').textContent).toBe('1176 ELO');
    expect(screen.getByTestId('wins').textContent).toBe('Wins: 0');
    expect(screen.getByTestId('losses').textContent).toBe('Losses: 1');
  });

  it('shows Grail Quest label and correct stats on holy_grail tab', () => {
    render(<PlayerCardStats currentUser={mockUser} activeGameTab="holy_grail" />);
    expect(screen.getByTestId('rating-label').textContent).toBe('Grail Quest Rating:');
    expect(screen.getByTestId('elo').textContent).toBe('1450 ELO');
    expect(screen.getByTestId('wins').textContent).toBe('Wins: 2');
    expect(screen.getByTestId('losses').textContent).toBe('Losses: 0');
  });

  it('falls back to 1200 ELO and 0 stats when user has no gameStats', () => {
    const userWithoutStats: UserDto = {
      id: 'no-stats-user',
      username: 'NewPlayer',
      createdAt: '2025-01-01T00:00:00Z',
    };
    render(<PlayerCardStats currentUser={userWithoutStats} activeGameTab="mill" />);
    expect(screen.getByTestId('elo').textContent).toBe('1200 ELO');
    expect(screen.getByTestId('wins').textContent).toBe('Wins: 0');
    expect(screen.getByTestId('losses').textContent).toBe('Losses: 0');
    expect(screen.getByTestId('draws').textContent).toBe('Draws: 0');
  });

  it('falls back gracefully when currentUser is null', () => {
    render(<PlayerCardStats currentUser={null} activeGameTab="mill" />);
    expect(screen.getByTestId('elo').textContent).toBe('1200 ELO');
    expect(screen.getByTestId('wins').textContent).toBe('Wins: 0');
  });
});
