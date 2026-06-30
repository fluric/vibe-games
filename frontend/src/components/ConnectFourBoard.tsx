import React, { useState, useEffect } from 'react';
import type { PlayerPiece } from '@vibe-games/shared';
import { useTranslation } from 'react-i18next';

interface CellContentProps {
  value: PlayerPiece;
  row: number;
  isInitial: boolean;
}

const ConnectFourCellContent: React.FC<CellContentProps> = ({ value, row, isInitial }) => {
  const [animating, setAnimating] = useState(!isInitial);

  useEffect(() => {
    if (isInitial) return;
    const timer = setTimeout(() => {
      setAnimating(false);
    }, 450); // duration of drop-cell-anim
    return () => clearTimeout(timer);
  }, [isInitial]);

  const colorClasses = value === 'X'
    ? 'from-red-500 to-rose-700 border-red-400 shadow-[0_2px_4px_rgba(0,0,0,0.4),0_0_12px_rgba(239,68,68,0.5)]'
    : 'from-amber-400 to-yellow-600 border-amber-300 shadow-[0_2px_4px_rgba(0,0,0,0.4),0_0_12px_rgba(245,158,11,0.5)]';

  return (
    <div 
      className={`w-[76%] h-[76%] rounded-full bg-gradient-to-br border ${colorClasses} ${animating ? 'animate-drop-cell' : ''}`}
      style={{ '--target-row': row } as React.CSSProperties}
    />
  );
};

interface ConnectFourBoardProps {
  board: (PlayerPiece | null)[];
  turn: PlayerPiece;
  currentPlayerPiece: PlayerPiece | null;
  disabled: boolean;
  onAction: (action: { action: 'place'; column: number }) => void;
}

export const ConnectFourBoard: React.FC<ConnectFourBoardProps> = ({
  board,
  turn,
  currentPlayerPiece,
  disabled,
  onAction,
}) => {
  const { t } = useTranslation('game');
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  // Board dimensions
  const ROWS = 6;
  const COLS = 7;

  // Track initial board state on mount to prevent existing stones from animating on refresh/load
  const [initialBoard, setInitialBoard] = useState(board);

  // If the board is reset to completely empty, reset the initial board reference
  useEffect(() => {
    if (board.every(cell => cell === null)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialBoard(board);
    }
  }, [board]);

  // Helper to find the lowest empty row in a column
  const getLowestEmptyRow = (col: number): number => {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r * COLS + col] === null) {
        return r;
      }
    }
    return -1;
  };

  const handleColumnClick = (col: number) => {
    if (disabled) return;
    const lowestRow = getLowestEmptyRow(col);
    if (lowestRow === -1) return; // Column is full

    onAction({ action: 'place', column: col });
  };

  // Render previews for hover states
  const renderCellContent = (row: number, col: number) => {
    const cellValue = board[row * COLS + col];
    const index = row * COLS + col;
    const isInitialPiece = initialBoard[index] !== null;
    
    if (cellValue !== null) {
      return (
        <ConnectFourCellContent 
          value={cellValue}
          row={row}
          isInitial={isInitialPiece}
        />
      );
    }

    // Hover preview state
    if (!disabled && hoveredCol === col && getLowestEmptyRow(col) === row) {
      return (
        <div 
          className={`w-[76%] h-[76%] rounded-full opacity-45 border border-dashed transition-all duration-200 ${
            turn === 'X' 
              ? 'bg-rose-500/20 border-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
              : 'bg-amber-400/20 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
          }`}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Turn indicator message helper */}
      <div 
        className={`text-xs font-semibold px-3 py-1 rounded-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 transition-all duration-200 ${
          !disabled && currentPlayerPiece === turn 
            ? 'opacity-100 scale-100 animate-pulse' 
            : 'opacity-0 scale-95 pointer-events-none select-none'
        }`}
      >
        {turn === 'X'
          ? t('c4_drop_red', { defaultValue: 'Click column to drop your 🔴 Red piece' })
          : t('c4_drop_gold', { defaultValue: 'Click column to drop your 🟡 Gold piece' })}
      </div>

      {/* Grid container */}
      <div className="relative p-4 md:p-6 bg-neutral-950/40 border border-neutral-800/60 rounded-3xl backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.3)]">
        {/* Connect 4 Blue Frame */}
        <div className="grid grid-cols-7 gap-4 sm:gap-5 md:gap-6 bg-blue-900 border-4 border-blue-950 p-5 rounded-2xl shadow-[inset_0_4px_12px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.5)]">
          {Array.from({ length: ROWS }).map((_, r) => (
            <React.Fragment key={r}>
              {Array.from({ length: COLS }).map((_, c) => {
                const isColumnFull = getLowestEmptyRow(c) === -1;
                const isHovered = hoveredCol === c;
                
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center relative cursor-pointer transition-all duration-200 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] ${
                      isColumnFull ? 'cursor-not-allowed bg-neutral-950/90' : 'bg-neutral-950'
                    } ${
                      isHovered && !disabled && !isColumnFull
                        ? 'hover:bg-neutral-900/80 shadow-[inset_0_4px_8px_rgba(0,0,0,0.9),0_0_8px_rgba(59,130,246,0.3)] border border-blue-500/20'
                        : 'border border-neutral-900/40'
                    }`}
                    onMouseEnter={() => !disabled && setHoveredCol(c)}
                    onMouseLeave={() => setHoveredCol(null)}
                    onClick={() => handleColumnClick(c)}
                  >
                    {renderCellContent(r, c)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Column indicators at the bottom */}
      <div className="grid grid-cols-7 gap-4 sm:gap-5 md:gap-6 px-4 w-full max-w-[340px] sm:max-w-[420px] md:max-w-[570px] text-center text-xs font-bold text-neutral-500">
        {Array.from({ length: COLS }).map((_, c) => (
          <div 
            key={c} 
            className={`transition-colors duration-200 ${hoveredCol === c && !disabled ? 'text-blue-400' : ''}`}
          >
            {c + 1}
          </div>
        ))}
      </div>
    </div>
  );
};
