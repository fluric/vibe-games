import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { MemoryGridRoomConfig } from '../../../data/escapeRooms';

// Using hex colors to avoid Tailwind JIT purging issues during dev server runtime
const COLORS = [
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#eab308', // yellow-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
];
const SHAPES = ['⬤', '■', '▲', '◆', '★', '♥', '✖', '⬢', '⬟'];

const LEVEL_COLORS = [
  'bg-blue-950/40',   // Level 1
  'bg-emerald-950/40',// Level 2
  'bg-yellow-950/40', // Level 3
  'bg-orange-950/40', // Level 4
  'bg-red-950/40'     // Level 5
];

const LEVEL_INSTRUCTIONS = [
  'Level 1: Remember the position.',
  'Level 2: The grid shuffles! Remember the original positions.',
  'Level 3: The grid shuffles! Remember the SHAPES.',
  'Level 4: The grid shuffles! Remember the COLORS.',
  'Level 5: The grid shuffles! Remember the original positions in REVERSE order.'
];

interface CellProps {
  color: string;
  shape: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function generateGrid(): CellProps[] {
  const shuffledColors = shuffleArray(COLORS);
  const shuffledShapes = shuffleArray(SHAPES);
  return shuffledColors.map((color, i) => ({
    color,
    shape: shuffledShapes[i]
  }));
}

export const MemoryGridPuzzle: React.FC<{ config: MemoryGridRoomConfig, onSolved: () => void }> = ({ onSolved }) => {
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'waiting_input' | 'success_anim' | 'fail_anim'>('idle');
  const [grid, setGrid] = useState<CellProps[]>([]);
  const [gridA, setGridA] = useState<CellProps[]>([]);
  const [targetSequence, setTargetSequence] = useState<number[]>([]);
  const [inputSequence, setInputSequence] = useState<number[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const startLevel = useCallback(() => {
    if (!isMounted.current) return;
    setPhase('showing');
    setFeedback('');
    setInputSequence([]);

    const newGridA = generateGrid();
    setGridA(newGridA);
    setGrid(newGridA);

    // Sequence length is equal to the level
    const seqLength = level;
    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const sequence = shuffleArray(indices).slice(0, seqLength);
    setTargetSequence(sequence);

    // Show sequence
    let step = 0;
    const showNext = () => {
      if (!isMounted.current) return;
      if (step < sequence.length) {
        setHighlightIndex(sequence[step]);
        setTimeout(() => {
          if (!isMounted.current) return;
          setHighlightIndex(null);
          step++;
          setTimeout(showNext, 400); // pause between highlights
        }, 800); // highlight duration
      } else {
        // Done showing
        if (level >= 2) {
          // Shuffle grid
          const newGridB = generateGrid();
          setGrid(newGridB);
        }
        setPhase('waiting_input');
      }
    };

    // Small delay before starting
    setTimeout(showNext, 1000);
  }, [level]);

  // Start Level 1 on mount
  useEffect(() => {
    if (phase === 'idle') {
      startLevel();
    }
  }, [phase, startLevel]);

  const handleCellClick = (index: number) => {
    if (phase !== 'waiting_input') return;

    const step = inputSequence.length;
    const targetAIndex = targetSequence[step];
    const targetCellA = gridA[targetAIndex];
    const clickedCellB = grid[index];

    let isValid = false;

    if (level === 1) {
      isValid = index === targetAIndex;
    } else if (level === 2) {
      isValid = index === targetAIndex;
    } else if (level === 3) {
      isValid = clickedCellB.shape === targetCellA.shape;
    } else if (level === 4) {
      isValid = clickedCellB.color === targetCellA.color;
    } else if (level === 5) {
      const reverseTargetIndex = targetSequence[targetSequence.length - 1 - step];
      isValid = index === reverseTargetIndex;
    }

    if (isValid) {
      const newInput = [...inputSequence, index];
      setInputSequence(newInput);
      
      // Temporary highlight for click
      setHighlightIndex(index);
      setTimeout(() => {
        if (isMounted.current) setHighlightIndex(null);
      }, 200);

      if (newInput.length === targetSequence.length) {
        // Passed level
        setPhase('success_anim');
        setFeedback('Correct!');
        setTimeout(() => {
          if (!isMounted.current) return;
          if (level === 5) {
            onSolved();
          } else {
            setLevel(l => l + 1);
            setPhase('idle'); // will trigger startLevel
          }
        }, 1500);
      }
    } else {
      // Failed level
      setPhase('fail_anim');
      setFeedback('Incorrect sequence!');
      // Highlight wrong click in red (handled by phase)
      setHighlightIndex(index);
      setTimeout(() => {
        if (!isMounted.current) return;
        setHighlightIndex(null);
        setLevel(l => Math.max(1, l - 1));
        setPhase('idle'); // will trigger startLevel
      }, 2000);
    }
  };

  return (
    <div className={`w-full max-w-sm mx-auto p-6 rounded-2xl border border-neutral-700/50 shadow-2xl transition-colors duration-1000 ${LEVEL_COLORS[level - 1]} flex flex-col items-center gap-6`}>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-white tracking-widest">LEVEL {level}</h3>
        <p className="text-sm text-neutral-300 min-h-[40px] flex items-center justify-center">
          {feedback || LEVEL_INSTRUCTIONS[level - 1]}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4 bg-neutral-900/80 rounded-xl border border-neutral-800 shadow-inner w-full aspect-square relative">
        {phase === 'fail_anim' && (
          <div className="absolute inset-0 bg-red-500/20 rounded-xl animate-pulse pointer-events-none" />
        )}
        {phase === 'success_anim' && (
          <div className="absolute inset-0 bg-emerald-500/20 rounded-xl animate-pulse pointer-events-none" />
        )}
        
        {grid.map((cell, idx) => {
          const isHighlighted = highlightIndex === idx;
          const isFailedClick = phase === 'fail_anim' && isHighlighted;
          const isInputted = phase === 'waiting_input' && inputSequence.includes(idx);
          
          return (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              disabled={phase !== 'waiting_input'}
              className={`
                relative w-full h-full rounded-lg shadow-md flex items-center justify-center text-5xl transition-all duration-300
                ${isHighlighted ? 'scale-95 brightness-150 ring-4 ring-white z-10' : 'hover:brightness-110 active:scale-95'}
                ${isFailedClick ? 'ring-4 ring-red-500' : ''}
                ${isInputted ? 'opacity-50 scale-95' : ''}
                ${phase !== 'waiting_input' && !isHighlighted ? 'opacity-90' : ''}
              `}
              style={{
                backgroundColor: isFailedClick ? '#7f1d1d' : cell.color,
                boxShadow: isHighlighted ? '0 0 20px rgba(255,255,255,0.6)' : 'inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)'
              }}
            >
              <span className="drop-shadow-lg select-none opacity-90 text-white font-bold">{cell.shape}</span>
            </button>
          );
        })}
      </div>
      
      <div className="flex gap-2 h-2 w-full justify-center opacity-50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 rounded-full ${i < level ? 'bg-white' : 'bg-neutral-700'}`} 
          />
        ))}
      </div>
    </div>
  );
};
