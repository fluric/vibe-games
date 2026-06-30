import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KeypadPuzzle } from '../components/escape/puzzles/KeypadPuzzle';
import { CipherWheelPuzzle } from '../components/escape/puzzles/CipherWheelPuzzle';
import { FuseBoxPuzzle } from '../components/escape/puzzles/FuseBoxPuzzle';
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

