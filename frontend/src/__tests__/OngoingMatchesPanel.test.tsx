import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OngoingMatchesPanel } from '../components/lobby/OngoingMatchesPanel';
import type { GameDto } from '@vibe-games/shared';

describe('OngoingMatchesPanel', () => {
  it('renders "No active matches" message when games array is empty', () => {
    render(<OngoingMatchesPanel games={[]} onSpectate={vi.fn()} />);
    expect(screen.getByText('No active matches to spectate right now.')).toBeInTheDocument();
  });

  it('renders ongoing games correctly', () => {
    const mockGames = [
      {
        id: 'game-1',
        gameType: 'connect_four',
        status: 'in_progress',
        playerX: { id: 'p1', username: 'Alice', elo: 1000 },
        playerO: { id: 'p2', username: 'Bob', elo: 1000 },
        state: { board: [], phase: 'playing', turn: 'X' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'game-2',
        gameType: 'holy_grail',
        status: 'in_progress',
        playerX: { id: 'p3', username: 'Charlie', elo: 1000 },
        playerO: undefined, // test fallback to 'Player O'
        state: { board: [], phase: 'playing', turn: 'X' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ] as unknown as GameDto[];

    render(<OngoingMatchesPanel games={mockGames} onSpectate={vi.fn()} />);
    
    // Check first game
    expect(screen.getByText('connect four')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Check second game
    expect(screen.getByText('holy grail')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Player O')).toBeInTheDocument(); // fallback
  });

  it('calls onSpectate with correct game ID when Spectate button is clicked', () => {
    const mockGames = [
      {
        id: 'game-1',
        gameType: 'connect_four',
        status: 'in_progress',
        playerX: { id: 'p1', username: 'Alice', elo: 1000 },
        playerO: { id: 'p2', username: 'Bob', elo: 1000 },
        state: { board: [], phase: 'playing', turn: 'X' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ] as unknown as GameDto[];
    
    const mockOnSpectate = vi.fn();
    render(<OngoingMatchesPanel games={mockGames} onSpectate={mockOnSpectate} />);
    
    const spectateButton = screen.getByRole('button', { name: /Spectate/i });
    fireEvent.click(spectateButton);
    
    expect(mockOnSpectate).toHaveBeenCalledTimes(1);
    expect(mockOnSpectate).toHaveBeenCalledWith('game-1');
  });
});
