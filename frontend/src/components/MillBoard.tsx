import { useState, useEffect, useRef } from 'react';
import type { PlayerPiece } from '@vibe-games/shared';
import * as audio from './AudioEffects';

// Static copy of the adjacency list for frontend check
const ADJACENCY_LIST: Record<number, number[]> = {
  0: [1, 7], 1: [0, 2, 9], 2: [1, 3], 3: [2, 4, 11],
  4: [3, 5], 5: [4, 6, 13], 6: [5, 7], 7: [6, 0, 15],
  8: [9, 15], 9: [8, 10, 1, 17], 10: [9, 11], 11: [10, 12, 3, 19],
  12: [11, 13], 13: [12, 14, 5, 21], 14: [13, 15], 15: [14, 8, 7, 23],
  16: [17, 23], 17: [16, 18, 9], 18: [17, 19], 19: [18, 20, 11],
  20: [19, 21], 21: [20, 22, 13], 22: [21, 23], 23: [22, 16, 15],
};

interface MillBoardProps {
  board: (PlayerPiece | null)[];
  turn: PlayerPiece;
  phase: 'placement' | 'movement' | 'flying';
  millFormedThisTurn: boolean;
  positionHistory?: string[];
  currentPlayerPiece: PlayerPiece | null;
  disabled: boolean;
  onAction: (
    action: 'place' | 'move' | 'remove',
    params: { position?: number; from?: number; to?: number }
  ) => Promise<void>;
}

// Convert index 0-23 to coordinates in a 0-100 viewBox
function getPositionCoords(index: number): { x: number; y: number } {
  const ring = Math.floor(index / 8);
  const pos = index % 8;
  const ringHalfWidths = [42, 28, 14]; // concentric sizes
  const hw = ringHalfWidths[ring];
  const cx = 50;
  const cy = 50;

  switch (pos) {
    case 0: return { x: cx - hw, y: cy - hw };
    case 1: return { x: cx,      y: cy - hw };
    case 2: return { x: cx + hw, y: cy - hw };
    case 3: return { x: cx + hw, y: cy      };
    case 4: return { x: cx + hw, y: cy + hw };
    case 5: return { x: cx,      y: cy + hw };
    case 6: return { x: cx - hw, y: cy + hw };
    case 7: return { x: cx - hw, y: cy      };
    default: return { x: cx, y: cy };
  }
}

export function MillBoard({
  board,
  turn,
  phase,
  millFormedThisTurn,
  positionHistory,
  currentPlayerPiece,
  disabled,
  onAction,
}: MillBoardProps) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [loadingNode, setLoadingNode] = useState<number | null>(null);

  const isMyTurn = !disabled && turn === currentPlayerPiece;

  const prevBoardRef = useRef(board);
  const [lastDiff, setLastDiff] = useState<{ added: number | null; movedFrom: number | null; captured: number | null }>({ added: null, movedFrom: null, captured: null });

  useEffect(() => {
    let refBoard: (PlayerPiece | null)[] | null = null;

    if (positionHistory && positionHistory.length >= 2) {
      const currentHistoryState = positionHistory[positionHistory.length - 1];
      const currentTurn = currentHistoryState.slice(-1) as PlayerPiece;
      
      let refIndex = positionHistory.length - 2;
      
      if (millFormedThisTurn) {
        // Current player is mid-turn. Find start of their current sequence.
        while (refIndex > 0 && positionHistory[refIndex - 1].endsWith(currentTurn)) {
          refIndex--;
        }
      } else {
        // Current player just started. Find start of the PREVIOUS sequence.
        const prevTurn = positionHistory[refIndex].slice(-1);
        while (refIndex > 0 && positionHistory[refIndex - 1].endsWith(prevTurn)) {
          refIndex--;
        }
      }

      const refBoardStr = positionHistory[refIndex].slice(0, 24);
      refBoard = refBoardStr.split('').map(c => c === '.' ? null : c as PlayerPiece);
    } else {
      // Fallback to in-memory ref
      const prev = prevBoardRef.current;
      const boardChanged = board.some((val, i) => val !== prev[i]);
      if (boardChanged) {
        refBoard = prev;
      }
    }

    if (refBoard) {
      const addedNodes: { index: number; piece: PlayerPiece }[] = [];
      const removedNodes: { index: number; piece: PlayerPiece }[] = [];
      
      for (let i = 0; i < 24; i++) {
        if (refBoard[i] === null && board[i] !== null) {
          addedNodes.push({ index: i, piece: board[i]! });
        }
        if (refBoard[i] !== null && board[i] === null) {
          removedNodes.push({ index: i, piece: refBoard[i]! });
        }
      }
      
      const addedNode = addedNodes.length > 0 ? addedNodes[0] : null;
      
      let movedFrom: number | null = null;
      let captured: number | null = null;

      if (addedNode) {
        // If there's an added node, the moved source is the removed node of the same color
        const sourceNode = removedNodes.find(n => n.piece === addedNode.piece);
        if (sourceNode) movedFrom = sourceNode.index;
        
        // The captured piece is the removed node of the opposite color
        const capturedNode = removedNodes.find(n => n.piece !== addedNode.piece);
        if (capturedNode) captured = capturedNode.index;
      } else {
        // If nothing was added, it was just a pure removal
        if (removedNodes.length > 0) captured = removedNodes[0].index;
      }

      setLastDiff({ added: addedNode?.index ?? null, movedFrom, captured });
    }
    
    prevBoardRef.current = board;
  }, [board, positionHistory, millFormedThisTurn]);

  const handleNodeClick = async (index: number) => {
    if (disabled || loadingNode !== null) return;

    // ── Case A: Pending Mill Removal ──────────────────────────────────────────
    if (millFormedThisTurn) {
      if (!isMyTurn) return;
      const piece = board[index];
      // Must click an opponent's piece
      const opponentPiece = currentPlayerPiece === 'X' ? 'O' : 'X';
      if (piece !== opponentPiece) {
        audio.playErrorSound();
        return;
      }
      
      try {
        setLoadingNode(index);
        await onAction('remove', { position: index });
        audio.playPlaceSound();
      } catch {
        audio.playErrorSound();
      } finally {
        setLoadingNode(null);
      }
      return;
    }

    // ── Case B: Placement Phase ───────────────────────────────────────────────
    if (phase === 'placement') {
      if (!isMyTurn) return;
      if (board[index] !== null) {
        audio.playErrorSound();
        return;
      }

      try {
        setLoadingNode(index);
        await onAction('place', { position: index });
        audio.playPlaceSound();
      } catch {
        audio.playErrorSound();
      } finally {
        setLoadingNode(null);
      }
      return;
    }

    // ── Case C: Movement / Flying Phase ───────────────────────────────────────
    if (phase === 'movement' || phase === 'flying') {
      const piece = board[index];

      // 1. Select / change selected piece
      if (piece === currentPlayerPiece && isMyTurn) {
        setSelectedNode(index === selectedNode ? null : index);
        audio.playPlaceSound();
        return;
      }

      // 2. Perform movement action
      if (selectedNode !== null && piece === null && isMyTurn) {
        // In movement phase, must be adjacent. In flying phase, can be anywhere.
        const isMoveAllowed =
          phase === 'flying' || (ADJACENCY_LIST[selectedNode]?.includes(index) ?? false);

        if (!isMoveAllowed) {
          audio.playErrorSound();
          return;
        }

        try {
          setLoadingNode(index);
          const fromNode = selectedNode;
          setSelectedNode(null);
          await onAction('move', { from: fromNode, to: index });
          audio.playPlaceSound();
        } catch {
          audio.playErrorSound();
        } finally {
          setLoadingNode(null);
        }
      } else {
        audio.playErrorSound();
      }
    }
  };

  // Helper to highlight potential landing spots for the selected piece
  const getHighlightClass = (index: number): string => {
    if (disabled) return '';
    const piece = board[index];

    // Highlight opponent pieces during mill removal
    if (millFormedThisTurn && isMyTurn) {
      const opponentPiece = currentPlayerPiece === 'X' ? 'O' : 'X';
      if (piece === opponentPiece) {
        return 'cursor-pointer stroke-rose-500 stroke-2 animate-pulse filter drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]';
      }
    }

    // Highlight placing spots
    if (phase === 'placement' && isMyTurn && piece === null) {
      return 'hover:fill-emerald-400 hover:opacity-60 cursor-pointer';
    }

    // Highlight owned pieces that can be selected
    if ((phase === 'movement' || phase === 'flying') && isMyTurn) {
      if (piece === currentPlayerPiece) {
        return index === selectedNode
          ? 'cursor-pointer stroke-[var(--border)] stroke-2 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]'
          : 'cursor-pointer hover:stroke-gray-300 hover:stroke-1';
      }
      
      // Highlight landing spots for selected piece
      if (selectedNode !== null && piece === null) {
        const isAllowed =
          phase === 'flying' || (ADJACENCY_LIST[selectedNode]?.includes(index) ?? false);
        if (isAllowed) {
          return 'cursor-pointer fill-emerald-500/30 stroke-emerald-500 stroke-[1.5] hover:fill-emerald-500/60 animate-pulse';
        }
      }
    }

    return '';
  };

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto bg-neutral-900/60 backdrop-blur-md rounded-2xl border border-neutral-800 p-4 shadow-2xl flex items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Neon Glow Filters */}
        <defs>
          <filter id="glow-x" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-o" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-grid" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Outer Ring ──────────────────────────────────────────────────────── */}
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          fill="none"
          stroke="#333333"
          strokeWidth="1"
        />
        {/* ── Middle Ring ─────────────────────────────────────────────────────── */}
        <rect
          x="22"
          y="22"
          width="56"
          height="56"
          fill="none"
          stroke="#444444"
          strokeWidth="1"
        />
        {/* ── Inner Ring ──────────────────────────────────────────────────────── */}
        <rect
          x="36"
          y="36"
          width="28"
          height="28"
          fill="none"
          stroke="#555555"
          strokeWidth="1"
        />

        {/* ── Connecting Crossbar Lines ───────────────────────────────────────── */}
        {/* Top line (1 to 17) */}
        <line x1="50" y1="8" x2="50" y2="36" stroke="#444444" strokeWidth="1" />
        {/* Right line (3 to 19) */}
        <line x1="64" y1="50" x2="92" y2="50" stroke="#444444" strokeWidth="1" />
        {/* Bottom line (5 to 21) */}
        <line x1="50" y1="64" x2="50" y2="92" stroke="#444444" strokeWidth="1" />
        {/* Left line (7 to 23) */}
        <line x1="8" y1="50" x2="36" y2="50" stroke="#444444" strokeWidth="1" />

        {/* ── Active Connection Highlights (Subtle board glow) ────────────────── */}
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          fill="none"
          stroke="#4f46e5"
          strokeWidth="0.5"
          opacity="0.15"
          filter="url(#glow-grid)"
        />

        {/* ── Last Move Indicators ──────────────────────────────────────────────── */}
        {lastDiff.movedFrom !== null && lastDiff.added !== null && (
          <line
            x1={getPositionCoords(lastDiff.movedFrom).x}
            y1={getPositionCoords(lastDiff.movedFrom).y}
            x2={getPositionCoords(lastDiff.added).x}
            y2={getPositionCoords(lastDiff.added).y}
            stroke="#fbbf24" /* Amber 400 */
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.6"
            className="pointer-events-none animate-pulse"
          />
        )}
        {lastDiff.captured !== null && (
           // Highlight captured piece's former spot briefly
           <circle
             cx={getPositionCoords(lastDiff.captured).x}
             cy={getPositionCoords(lastDiff.captured).y}
             r="4"
             fill="none"
             stroke="#ef4444"
             strokeWidth="1"
             opacity="0.4"
             className="pointer-events-none"
           />
        )}

        {/* ── Render Board Points & Interactive Hotspots ───────────────────────── */}
        {Array.from({ length: 24 }).map((_, index) => {
          const coords = getPositionCoords(index);
          const piece = board[index];
          const highlightClass = getHighlightClass(index);
          const isSelected = selectedNode === index;
          const isLoading = loadingNode === index;

          return (
            <g key={index}>
              {/* Outer target hotspot for easy clicking on mobile / mouse */}
              <circle
                data-testid={`node-${index}`}
                cx={coords.x}
                cy={coords.y}
                r="6"
                fill="transparent"
                className="cursor-pointer"
                onClick={() => handleNodeClick(index)}
              />

              {/* Last placed/moved piece aura */}
              {lastDiff.added === index && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r="5.5"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  opacity="0.8"
                  className="pointer-events-none animate-pulse"
                />
              )}

              {/* Node backing dot */}
              {piece === null && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r="1.8"
                  fill="#555555"
                  className={`transition-all duration-300 pointer-events-none ${highlightClass}`}
                />
              )}

              {/* Highlight Overlay Ring */}
              {highlightClass && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r="4.5"
                  fill="none"
                  className={`pointer-events-none ${highlightClass}`}
                />
              )}

              {/* Player X Piece (Neon Blue Disc) */}
              {piece === 'X' && (
                <g
                  className={`transition-transform duration-300 pointer-events-none ${
                    isSelected ? 'scale-110' : ''
                  }`}
                  onClick={() => handleNodeClick(index)}
                >
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="4.2"
                    fill="#3b82f6"
                    filter="url(#glow-x)"
                    className={isSelected ? 'animate-pulse' : ''}
                  />
                  {/* Outer metallic/neon rim */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="4.2"
                    fill="none"
                    stroke="#93c5fd"
                    strokeWidth="0.6"
                  />
                  {/* Innermost design core */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="1.2"
                    fill="#ffffff"
                    opacity="0.9"
                  />
                </g>
              )}

              {/* Player O Piece (Neon Red/Orange Disc) */}
              {piece === 'O' && (
                <g
                  className={`transition-transform duration-300 pointer-events-none ${
                    isSelected ? 'scale-110' : ''
                  }`}
                  onClick={() => handleNodeClick(index)}
                >
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="4.2"
                    fill="#ef4444"
                    filter="url(#glow-o)"
                    className={isSelected ? 'animate-pulse' : ''}
                  />
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="4.2"
                    fill="none"
                    stroke="#fca5a5"
                    strokeWidth="0.6"
                  />
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="1.2"
                    fill="#ffffff"
                    opacity="0.9"
                  />
                </g>
              )}

              {/* Loading Indicator Spinner Overlay */}
              {isLoading && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r="5"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  className="animate-spin pointer-events-none"
                  style={{ transformOrigin: `${coords.x}px ${coords.y}px` }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
