import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KeypadPuzzle } from '../components/escape/puzzles/KeypadPuzzle';
import { CipherWheelPuzzle } from '../components/escape/puzzles/CipherWheelPuzzle';
import { FuseBoxPuzzle } from '../components/escape/puzzles/FuseBoxPuzzle';
import { SymbolGridPuzzle } from '../components/escape/puzzles/SymbolGridPuzzle';
import { ValvesPuzzle } from '../components/escape/puzzles/ValvesPuzzle';
// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue || key,
  }),
}));

describe('KeypadPuzzle', () => {
  const mockConfig = {
    puzzleType: 'keypad' as const,
    solution: '1234',
    visibleClues: [
      { x: '10%', y: '10%', text: 'Clue 1', label: 'Monitor' },
    ],
    hiddenHotspot: {
      id: 'hotspot1',
      label: 'Plant',
      x: '50%',
      y: '50%',
      revealedClue: 'Hidden Clue',
    },
  };

  it('renders clues and hidden hotspot', () => {
    render(<KeypadPuzzle config={mockConfig} onSolved={vi.fn()} />);
    expect(screen.getByText('Clue 1')).toBeDefined();
    expect(screen.getByText('🔍 Plant')).toBeDefined();
  });

  it('reveals hotspot on click', () => {
    render(<KeypadPuzzle config={mockConfig} onSolved={vi.fn()} />);
    const hotspot = screen.getByLabelText('Plant');
    fireEvent.click(hotspot);
    expect(screen.getByText('Hidden Clue')).toBeDefined();
  });

  it('allows typing PIN and solves when correct', async () => {
    const onSolved = vi.fn();
    render(<KeypadPuzzle config={mockConfig} onSolved={onSolved} />);
    
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    
    // Press confirm
    fireEvent.click(screen.getByText('↵'));
    
    // Should show correct
    expect(screen.getByText('✓ Correct')).toBeDefined();
    
    // Wait for the timeout (700ms in component)
    await waitFor(() => {
      expect(onSolved).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('shakes and clears input on incorrect PIN', async () => {
    const onSolved = vi.fn();
    render(<KeypadPuzzle config={mockConfig} onSolved={onSolved} />);
    
    fireEvent.click(screen.getByText('9'));
    fireEvent.click(screen.getByText('9'));
    fireEvent.click(screen.getByText('9'));
    fireEvent.click(screen.getByText('9'));
    
    // Press confirm
    fireEvent.click(screen.getByText('↵'));
    
    expect(screen.queryByText('✓ Correct')).toBeNull();
    expect(onSolved).not.toHaveBeenCalled();
  });
});

describe('CipherWheelPuzzle', () => {
  const mockConfig = {
    puzzleType: 'cipher' as const,
    ciphertext: 'B',
    shift: 1, // A shifted by 1 = B
    solution: 'A',
    sceneClueText: 'Look at the clock',
  };

  it('renders correctly', () => {
    const { container } = render(<CipherWheelPuzzle config={mockConfig} onSolved={vi.fn()} />);
    expect(screen.getByText('Look at the clock')).toBeDefined();
    expect(container.querySelector('.cipher-ciphertext')?.textContent).toBe('B');
  });

  it('shifts letters via keyboard arrows and solves', async () => {
    const onSolved = vi.fn();
    render(<CipherWheelPuzzle config={mockConfig} onSolved={onSolved} />);
    
    // Default shift is 0, so decoded is B. We need shift = 1 so decoded = A.
    // We can simulate ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    
    // Confirm decoding
    fireEvent.click(screen.getByText('Confirm Decoding'));
    
    // Should show Decoded
    expect(screen.getByText('✓ Decoded!')).toBeDefined();
    
    await waitFor(() => {
      expect(onSolved).toHaveBeenCalled();
    }, { timeout: 1000 });
  });
});

describe('FuseBoxPuzzle', () => {
  const mockConfig = {
    puzzleType: 'fuse' as const,
    wires: [
      { id: 'w1', color: 'Red', colorHex: '#ff0000', targetPost: 'p1' },
    ],
    posts: [
      { id: 'p1', label: 'Alpha' },
      { id: 'p2', label: 'Beta' },
    ],
    clues: ['Red to Alpha'],
  };

  it('renders wires and posts', () => {
    render(<FuseBoxPuzzle config={mockConfig} onSolved={vi.fn()} />);
    expect(screen.getByText('Red')).toBeDefined();
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Red to Alpha')).toBeDefined();
  });

  it('connects wire to post on click', () => {
    render(<FuseBoxPuzzle config={mockConfig} onSolved={vi.fn()} />);
    
    // Click wire
    fireEvent.click(screen.getByLabelText('Red wire'));
    
    // Click post
    fireEvent.click(screen.getByLabelText('Post Alpha — empty'));
    
    // Verify it changed to connected
    expect(screen.getByLabelText('Red wire — connected to post p1')).toBeDefined();
  });

  it('solves when circuit is correct', async () => {
    const onSolved = vi.fn();
    render(<FuseBoxPuzzle config={mockConfig} onSolved={onSolved} />);
    
    fireEvent.click(screen.getByLabelText('Red wire'));
    fireEvent.click(screen.getByLabelText('Post Alpha — empty'));
    
    // Click test circuit
    fireEvent.click(screen.getByText('Test Circuit'));
    
    expect(screen.getByText('✓ Circuit Restored!')).toBeDefined();
    
    await waitFor(() => {
      expect(onSolved).toHaveBeenCalled();
    }, { timeout: 1500 });
  });
});

describe('SymbolGridPuzzle', () => {
  const mockConfig = {
    puzzleType: 'symbol_grid' as const,
    symbols: ['A', 'B', 'C'],
    solutionSequence: [2, 0], // C then A
    clues: ['C comes first'],
  };

  it('renders clues and symbols', () => {
    render(<SymbolGridPuzzle config={mockConfig} onSolved={vi.fn()} />);
    expect(screen.getByText('C comes first')).toBeDefined();
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('C')).toBeDefined();
  });

  it('solves when correct sequence is entered', async () => {
    const onSolved = vi.fn();
    render(<SymbolGridPuzzle config={mockConfig} onSolved={onSolved} />);
    
    // Click C (index 2)
    fireEvent.click(screen.getByTestId('symbol-btn-2'));
    // Click A (index 0)
    fireEvent.click(screen.getByTestId('symbol-btn-0'));
    
    expect(screen.getByText('✓ Correct')).toBeDefined();
    
    await waitFor(() => {
      expect(onSolved).toHaveBeenCalled();
    }, { timeout: 1500 });
  });

  it('shakes on incorrect sequence', () => {
    const onSolved = vi.fn();
    render(<SymbolGridPuzzle config={mockConfig} onSolved={onSolved} />);
    
    // Click A (index 0) - incorrect first step
    fireEvent.click(screen.getByTestId('symbol-btn-0'));
    
    expect(screen.queryByText('✓ Correct')).toBeNull();
    expect(onSolved).not.toHaveBeenCalled();
  });
});

describe('ValvesPuzzle', () => {
  const mockConfig = {
    puzzleType: 'valves' as const,
    valves: [
      { id: 'v1', label: 'Valve1' },
      { id: 'v2', label: 'Valve2' },
    ],
    maxValue: 5,
    solution: [1, 2],
    clues: ['Set to 1 and 2'],
  };

  it('renders clues and valves', () => {
    render(<ValvesPuzzle config={mockConfig} onSolved={vi.fn()} />);
    expect(screen.getByText('Set to 1 and 2')).toBeDefined();
    expect(screen.getByText('Valve1')).toBeDefined();
    expect(screen.getByText('Valve2')).toBeDefined();
  });

  it('solves when correct values are set', async () => {
    const onSolved = vi.fn();
    render(<ValvesPuzzle config={mockConfig} onSolved={onSolved} />);
    
    // Increment v1 once
    fireEvent.click(screen.getByTestId('valve-v1-inc'));
    
    // Increment v2 twice
    fireEvent.click(screen.getByTestId('valve-v2-inc'));
    fireEvent.click(screen.getByTestId('valve-v2-inc'));
    
    expect(screen.getByText('✓ PRESSURE STABLE')).toBeDefined();
    
    await waitFor(() => {
      expect(onSolved).toHaveBeenCalled();
    }, { timeout: 1500 });
  });
});

