import React, { useState, useEffect, useRef } from 'react';
import type { PlayerPiece } from '@vibe-games/shared';
import { useTranslation } from 'react-i18next';

// Reversi logic duplicated for frontend hints
const DIRECTIONS = [
  -9, -8, -7,
  -1,      1,
   7,  8,  9
];

function getFlippedDiscs(board: (PlayerPiece | null)[], pos: number, player: PlayerPiece): number[] {
  const flipped: number[] = [];
  const opponent = player === 'X' ? 'O' : 'X';

  const row = Math.floor(pos / 8);
  const col = pos % 8;

  for (const dir of DIRECTIONS) {
    let r = row;
    let c = col;
    const currentDirFlipped: number[] = [];

    while (true) {
      if (dir === -9) { r--; c--; }
      else if (dir === -8) { r--; }
      else if (dir === -7) { r--; c++; }
      else if (dir === -1) { c--; }
      else if (dir === 1) { c++; }
      else if (dir === 7) { r++; c--; }
      else if (dir === 8) { r++; }
      else if (dir === 9) { r++; c++; }

      if (r < 0 || r >= 8 || c < 0 || c >= 8) break;

      const idx = r * 8 + c;
      const cell = board[idx];

      if (cell === opponent) {
        currentDirFlipped.push(idx);
      } else if (cell === player) {
        if (currentDirFlipped.length > 0) {
          flipped.push(...currentDirFlipped);
        }
        break;
      } else {
        break;
      }
    }
  }

  return flipped;
}

function getLegalMoves(board: (PlayerPiece | null)[], player: PlayerPiece): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === null && getFlippedDiscs(board, i, player).length > 0) {
      moves.push(i);
    }
  }
  return moves;
}


interface CellContentProps {
  value: PlayerPiece;
  isFlipping: boolean;
  isInitial: boolean;
  flipDelayMs?: number;
}

const ReversiCellContent: React.FC<CellContentProps> = ({ value, isFlipping, isInitial, flipDelayMs = 0 }) => {
  const [visualValue, setVisualValue] = useState(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isInitial) {
      setVisualValue(value);
      setAnimating(false);
      return;
    }
    
    if (value !== visualValue) {
      let active = true;
      if (isFlipping) {
        const delayTimer = setTimeout(() => {
          if (!active) return;
          setAnimating(true);
          
          setTimeout(() => {
            if (!active) return;
            setVisualValue(value);
          }, 600);
          
          setTimeout(() => {
            if (!active) return;
            setAnimating(false);
          }, 1200);
        }, flipDelayMs);
        
        return () => { active = false; clearTimeout(delayTimer); };
      } else {
        setVisualValue(value);
      }
    }
  }, [value, isFlipping, visualValue, isInitial, flipDelayMs]);

  const discColorClasses = visualValue === 'X'
    ? 'bg-neutral-900 border-black shadow-[inset_0_4px_6px_rgba(255,255,255,0.2)]' // Black
    : 'bg-neutral-100 border-neutral-300 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.1)]'; // White

  return (
    <div 
      className={`w-[85%] h-[85%] rounded-full border-2 ${discColorClasses} transition-transform`} 
      style={{
        animation: animating ? 'flip 1.2s ease-in-out forwards' : 'none'
      }}
    />
  );
};

interface ReversiBoardProps {
  board: (PlayerPiece | null)[];
  turn: PlayerPiece;
  lastMoveIndex?: number;
  currentPlayerPiece: PlayerPiece | null;
  disabled: boolean;
  onAction: (action: { action: 'place'; position: number }) => void;
}

export const ReversiBoard: React.FC<ReversiBoardProps> = ({
  board,
  turn,
  lastMoveIndex,
  currentPlayerPiece,
  disabled,
  onAction,
}) => {
  const { t } = useTranslation('game');
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);

  const ROWS = 8;
  const COLS = 8;

  const [initialBoard, setInitialBoard] = useState(board);
  const prevBoardRef = useRef(board);
  const [lastDiffIndex, setLastDiffIndex] = useState<number | null>(null);
  const [recentlyFlipped, setRecentlyFlipped] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prev = prevBoardRef.current;
    if (board.some((v, i) => v !== prev[i])) {
      const addedIdx = board.findIndex((v, i) => v !== null && prev[i] === null);
      if (addedIdx !== -1) {
        setLastDiffIndex(addedIdx);
      }
      
      const flipped = new Set<number>();
      for (let i = 0; i < 64; i++) {
        if (prev[i] !== null && board[i] !== null && prev[i] !== board[i]) {
          flipped.add(i);
        }
      }
      setRecentlyFlipped(flipped);
      
      prevBoardRef.current = board;
    }
  }, [board]);

  const displayLastMove = lastMoveIndex ?? lastDiffIndex;

  const getStaggerDelay = (index: number) => {
    if (displayLastMove === null || displayLastMove === undefined) return 0;
    
    const r1 = Math.floor(index / COLS);
    const c1 = index % COLS;
    const r2 = Math.floor(displayLastMove / COLS);
    const c2 = displayLastMove % COLS;
    
    const distance = Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
    return distance * 250; // 250ms per tile distance
  };

  useEffect(() => {
    if (board.every(cell => cell === null) || board.filter(cell => cell !== null).length === 4) {
      setInitialBoard(board);
      setLastDiffIndex(null);
      setRecentlyFlipped(new Set());
    }
  }, [board]);

  const legalMoves = currentPlayerPiece ? getLegalMoves(board, currentPlayerPiece) : [];
  const isMyTurn = currentPlayerPiece === turn && !disabled;
  const mustPass = isMyTurn && legalMoves.length === 0;

  const handleCellClick = (pos: number) => {
    if (disabled || !isMyTurn) return;
    if (board[pos] !== null) return;
    if (!legalMoves.includes(pos)) return;
    
    onAction({ action: 'place', position: pos });
  };

  const handlePass = () => {
    if (disabled || !isMyTurn || !mustPass) return;
    onAction({ action: 'place', position: 64 });
  };

  const renderCellContent = (index: number) => {
    const cellValue = board[index];
    
    if (cellValue !== null) {
      return (
        <ReversiCellContent
          value={cellValue}
          isFlipping={recentlyFlipped.has(index)}
          isInitial={initialBoard[index] === cellValue}
          flipDelayMs={getStaggerDelay(index)}
        />
      );
    }

    const isLegal = isMyTurn && legalMoves.includes(index);

    if (isMyTurn && hoveredPos === index && isLegal) {
      return (
        <div 
          className={`w-[85%] h-[85%] rounded-full opacity-40 transition-all duration-200 ${
            currentPlayerPiece === 'X' 
              ? 'bg-neutral-900 border-2 border-dashed border-neutral-700' 
              : 'bg-neutral-100 border-2 border-dashed border-neutral-300'
          }`}
        />
      );
    }

    if (isLegal) {
      return (
        <div className="w-[30%] h-[30%] rounded-full bg-emerald-500/30 opacity-70 border border-emerald-500/50" />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className={`text-xs font-semibold px-3 py-1 rounded-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 transition-all duration-200 ${
          isMyTurn && !mustPass
            ? 'opacity-100 scale-100 animate-pulse' 
            : 'opacity-0 scale-95 pointer-events-none select-none'
        }`}
      >
        {currentPlayerPiece === 'X'
          ? t('reversi_drop_black', { defaultValue: 'Place your ⚫ Black disc' })
          : t('reversi_drop_white', { defaultValue: 'Place your ⚪ White disc' })}
      </div>

      {mustPass && (
        <div className="animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300">
          <button
            onClick={handlePass}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            {t('reversi_pass', { defaultValue: 'No Moves - Pass Turn' })}
          </button>
        </div>
      )}

      <div className="relative p-2 md:p-4 bg-emerald-950 border-4 border-emerald-900 rounded-lg shadow-[inset_0_4px_12px_rgba(0,0,0,0.5),0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-8 place-items-center bg-emerald-800 p-2 sm:p-3 rounded border-2 border-emerald-950">
          {Array.from({ length: ROWS }).map((_, r) => (
            <React.Fragment key={r}>
              {Array.from({ length: COLS }).map((_, c) => {
                const index = r * COLS + c;

                const isLegal = isMyTurn && legalMoves.includes(index);
                const isLastMove = displayLastMove === index;
                
                return (
                  <div
                    key={index}
                    className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center relative transition-colors duration-200 bg-emerald-700 ${
                      isLegal ? 'cursor-pointer hover:bg-emerald-600' : ''
                    }`}
                    onMouseEnter={() => isMyTurn && setHoveredPos(index)}
                    onMouseLeave={() => setHoveredPos(null)}
                    onClick={() => handleCellClick(index)}
                  >
                    {/* Grid lines styling */}
                    <div className="absolute inset-0 border border-emerald-950/80 pointer-events-none" />
                    
                    {renderCellContent(index)}
                    
                    {isLastMove && board[index] !== null && (
                      <div className="absolute inset-0 rounded-full border-2 border-rose-500 opacity-90 animate-pulse pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.6)] scale-[0.35]" />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes flip {
          0% { transform: scaleX(1); }
          50% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
};
