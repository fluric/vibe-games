import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectFourBoard } from '../components/ConnectFourBoard';
import { MillBoard } from '../components/MillBoard';
import type { ConnectFourGameState, MillGameState } from '@vibe-games/shared';

// Mock audio
vi.mock('../utils/audio', () => ({
  audio: {
    playPlaceSound: vi.fn(),
    playCaptureSound: vi.fn(),
    playWinSound: vi.fn(),
    playLoseSound: vi.fn(),
    playDrawSound: vi.fn(),
  }
}));

describe('Boards', () => {
  it('renders ConnectFourBoard', () => {
    const mockState: ConnectFourGameState = {
      board: Array(42).fill(null),
      turn: 'X',
      winner: null
    };
    render(
      <ConnectFourBoard
        board={mockState.board}
        turn={mockState.turn}
        currentPlayerPiece="X"
        disabled={false}
        onAction={() => {}}
      />
    );
    expect(screen.getByText(/Click column to drop your/i)).toBeDefined();
  });

  it('renders MillBoard', () => {
    const mockState: MillGameState = {
      board: Array(24).fill(null),
      piecesOnBoard: { X: 0, O: 0 },
      turn: 'X',
      winner: null,
      phase: 'placement',
      placementsRemaining: { X: 9, O: 9 },
      millFormedThisTurn: false
    };
    render(
      <MillBoard
        board={mockState.board}
        turn={mockState.turn}
        phase={mockState.phase}
        millFormedThisTurn={false}
        currentPlayerPiece="X"
        disabled={false}
        onAction={async () => {}}
      />
    );
    // MillBoard has 24 points
    const cells = screen.getAllByTestId(/node-/);
    expect(cells.length).toBeGreaterThanOrEqual(24);
  });
});
