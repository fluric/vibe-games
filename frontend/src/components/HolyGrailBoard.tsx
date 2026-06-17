import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { 
  HolyGrailGameState, 
  HolyGrailCell, 
  PlayerPiece, 
  PendingCombat 
} from '@vibe-games/shared';

const HEX_SIZE = 45;
const WIDTH = 560;
const HEIGHT = 560;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

// Standard flat-topped hex center mapping
function getHexCenter(q: number, r: number) {
  const cx = CENTER_X + HEX_SIZE * (3 / 2) * q;
  const cy = CENTER_Y + HEX_SIZE * Math.sqrt(3) * (r + q / 2);
  return { cx, cy };
}

// Generate the coordinates of the 6 corners of a flat-topped hex
function getHexPoints(cx: number, cy: number, size: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angleRad);
    const y = cy + size * Math.sin(angleRad);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

// Helper to translate card value to display card string
function formatCardValue(value: number): string {
  if (value === 0) return '?';
  if (value === 13) return 'K';
  if (value === 12) return 'Q';
  if (value === 11) return 'J';
  return value.toString();
}

function formatCellName(key: string): string {
  if (key === '0,0') return 'Grail Center';
  if (key === '0,-3') return "Player X's Base";
  if (key === '0,3') return "Player O's Base";
  const [q, r] = key.split(',').map(Number);
  if (isNaN(q) || isNaN(r)) return key;
  return `(${q}, ${r})`;
}

function renderHistoryEntry(log: string, idx: number) {
  if (log.trim().startsWith('{')) {
    try {
      const action = JSON.parse(log);
      const playerText = action.player ? `Player ${action.player}` : 'A player';
      const playerColor = action.player === 'X' ? 'text-rose-400' : action.player === 'O' ? 'text-amber-400' : 'text-neutral-400';

      if (action.type === 'deploy' || action.action === 'deploy') {
        return (
          <div key={idx} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed">
            <span className={`font-semibold ${playerColor}`}>{playerText}</span> deployed{' '}
            <span className="font-semibold text-indigo-400">{formatCardValue(action.cardValue)}</span> at{' '}
            <span className="text-neutral-400 font-medium">{formatCellName(action.cellKey)}</span>
          </div>
        );
      }
      if (action.type === 'move' || action.action === 'move') {
        return (
          <div key={idx} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed">
            <span className={`font-semibold ${playerColor}`}>{playerText}</span> moved{' '}
            <span className="font-semibold text-emerald-450">{action.count} unit(s)</span> from{' '}
            <span className="text-neutral-400 font-medium">{formatCellName(action.from)}</span> to{' '}
            <span className="text-neutral-400 font-medium">{formatCellName(action.to)}</span>
          </div>
        );
      }
      if (action.type === 'end_deploy' || action.action === 'end_deploy') {
        return (
          <div key={idx} className="text-xs text-neutral-400 italic py-1 border-b border-neutral-800/40 leading-relaxed">
            <span className={`font-semibold ${playerColor} not-italic`}>{playerText}</span> completed deployment
          </div>
        );
      }
      if (action.type === 'end_turn' || action.action === 'end_turn') {
        return (
          <div key={idx} className="text-xs text-neutral-400 italic py-1 border-b border-neutral-800/40 leading-relaxed">
            <span className={`font-semibold ${playerColor} not-italic`}>{playerText}</span> ended turn
          </div>
        );
      }
      if (action.type === 'react' || action.action === 'react') {
        const reactVerb = action.reactType === 'retreat' ? 'retreated' : 'fought';
        const targetText = action.reactType === 'retreat' ? ` to ${formatCellName(action.retreatTo)}` : '';
        return (
          <div key={idx} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed">
            <span className={`font-semibold ${playerColor}`}>{playerText}</span> {reactVerb} at{' '}
            <span className="text-neutral-400 font-medium">{formatCellName(action.cellKey)}</span>
            {targetText}
          </div>
        );
      }
    } catch (e) {
      // ignore
    }
  }

  // Combat or retreat log (plain text)
  const isCombat = log.includes('⚔️') || log.toLowerCase().includes('combat') || log.toLowerCase().includes('vs');
  const isRetreat = log.includes('🏃') || log.toLowerCase().includes('retreat');

  if (isCombat) {
    return (
      <div key={idx} className="text-xs py-2 px-2.5 my-1 rounded-lg bg-red-950/40 border border-red-900/40 text-red-200 leading-relaxed shadow-sm">
        {log}
      </div>
    );
  }

  if (isRetreat) {
    return (
      <div key={idx} className="text-xs py-2 px-2.5 my-1 rounded-lg bg-amber-950/20 border border-amber-900/30 text-amber-200 leading-relaxed shadow-sm">
        {log}
      </div>
    );
  }

  return (
    <div key={idx} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed">
      {log}
    </div>
  );
}

interface HolyGrailBoardProps {
  state: HolyGrailGameState;
  myPiece: PlayerPiece | null;
  disabled: boolean;
  submittingMove: boolean;
  onAction: (action: any) => Promise<void>;
}

export const HolyGrailBoard: React.FC<HolyGrailBoardProps> = ({
  state,
  myPiece,
  disabled,
  submittingMove,
  onAction
}) => {
  const { board, hands, phase, turn, winner, pendingCombats, grailCellKey = '0,0' } = state;

  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [moveTargetKey, setMoveTargetKey] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState<number>(1);
  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  const [activeCombatCellKey, setActiveCombatCellKey] = useState<string | null>(null);
  const [retreatTargetKey, setRetreatTargetKey] = useState<string | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const [hoveredMoveIdx, setHoveredMoveIdx] = useState<number | null>(null);

  const [isRevealingAttacker, setIsRevealingAttacker] = useState(false);
  const prevAttackerValRef = useRef<number | undefined>(undefined);
  const [displayedAttackerVal, setDisplayedAttackerVal] = useState<number | undefined>(undefined);
  
  const [isRevealingDefender, setIsRevealingDefender] = useState(false);
  const prevDefenderValRef = useRef<number | undefined>(undefined);
  const [displayedDefenderVal, setDisplayedDefenderVal] = useState<number | undefined>(undefined);

  const combat = pendingCombats.find(c => c.cellKey === activeCombatCellKey);

  useEffect(() => {
    if (combat && combat.attackerTopCard) {
      const currentVal = combat.attackerTopCard.value;
      const prevVal = prevAttackerValRef.current;
      if ((prevVal === 0 || prevVal === undefined) && currentVal > 0) {
        setIsRevealingAttacker(true);
        setDisplayedAttackerVal(0); // Show '?' first

        const midTimer = setTimeout(() => {
          setDisplayedAttackerVal(currentVal);
        }, 250);

        const endTimer = setTimeout(() => {
          setIsRevealingAttacker(false);
        }, 500);

        return () => {
          clearTimeout(midTimer);
          clearTimeout(endTimer);
        };
      } else {
        setDisplayedAttackerVal(currentVal);
      }
      prevAttackerValRef.current = currentVal;
    } else {
      setDisplayedAttackerVal(undefined);
      prevAttackerValRef.current = undefined;
    }
  }, [combat?.attackerTopCard?.value]);

  useEffect(() => {
    if (combat && combat.defenderTopCard) {
      const currentVal = combat.defenderTopCard.value;
      const prevVal = prevDefenderValRef.current;
      if ((prevVal === 0 || prevVal === undefined) && currentVal > 0) {
        setIsRevealingDefender(true);
        setDisplayedDefenderVal(0); // Show '?' first

        const midTimer = setTimeout(() => {
          setDisplayedDefenderVal(currentVal);
        }, 250);

        const endTimer = setTimeout(() => {
          setIsRevealingDefender(false);
        }, 500);

        return () => {
          clearTimeout(midTimer);
          clearTimeout(endTimer);
        };
      } else {
        setDisplayedDefenderVal(currentVal);
      }
      prevDefenderValRef.current = currentVal;
    } else {
      setDisplayedDefenderVal(undefined);
      prevDefenderValRef.current = undefined;
    }
  }, [combat?.defenderTopCard?.value]);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.history?.length]);

  const isMyTurn = turn === myPiece && !winner;
  const activeHand = myPiece ? (hands[myPiece] || []) : [];

  // If active combat is resolved, close modal
  useEffect(() => {
    if (activeCombatCellKey) {
      const exists = pendingCombats.some(c => c.cellKey === activeCombatCellKey);
      if (!exists) {
        setActiveCombatCellKey(null);
      }
    }
  }, [pendingCombats, activeCombatCellKey]);

  // Determine distance between two cell keys
  const getCellDistance = (key1: string, key2: string) => {
    const [q1, r1] = key1.split(',').map(Number);
    const [q2, r2] = key2.split(',').map(Number);
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs((q1 + r1) - (q2 + r2))) / 2;
  };

  // Check if cell has any adjacent combat retreats
  const getAdjacentFriendlyCells = (cellKey: string): string[] => {
    if (!myPiece) return [];
    return Object.keys(board).filter(key => {
      if (board[key].owner !== myPiece) return false;
      return getCellDistance(cellKey, key) === 1;
    });
  };

  const handleCellClick = (key: string) => {
    if (disabled || !isMyTurn) return;
    const cell = board[key];

    // ── React Phase Action ──
    if (phase === 'react') {
      const combat = pendingCombats.find(c => c.cellKey === key && c.defender === myPiece);
      if (combat) {
        setActiveCombatCellKey(key);
        setRetreatTargetKey(null);
      }
      return;
    }

    // ── Deploy Phase Action ──
    if (phase === 'deploy') {
      const isValidDeployCell = cell.owner === myPiece && (
        cell.cellType === 'home_base' || (cell.cellType === 'urban' && cell.soldiers.length > 0)
      );
      if (isValidDeployCell) {
        if (selectedHandCardIndex !== null) {
          // Instantly deploy!
          const card = activeHand[selectedHandCardIndex];
          onAction({
            type: 'deploy',
            cellKey: key,
            cardValue: card.value
          }).then(() => {
            setSelectedHandCardIndex(null);
            setSelectedCellKey(key);
          }).catch(console.error);
        } else {
          setSelectedCellKey(key === selectedCellKey ? null : key);
        }
      }
      return;
    }

    // ── Move Phase Action ──
    if (phase === 'move') {
      if (selectedCellKey === null) {
        // Select starting stack
        if (cell.owner === myPiece && cell.soldiers.length > 0) {
          setSelectedCellKey(key);
          setMoveTargetKey(null);
          setMoveCount(1);
        }
      } else {
        // If clicking same cell, deselect
        if (selectedCellKey === key) {
          setSelectedCellKey(null);
          return;
        }

        // If clicking adjacent cell, initiate move modal/slider
        const distance = getCellDistance(selectedCellKey, key);
        if (distance === 1) {
          setMoveTargetKey(key);
          const maxCount = board[selectedCellKey]?.soldiers.length || 1;
          setMoveCount(Math.min(1, maxCount));
        } else {
          // Select another friendly stack
          if (cell.owner === myPiece && cell.soldiers.length > 0) {
            setSelectedCellKey(key);
            setMoveTargetKey(null);
            setMoveCount(1);
          } else {
            setSelectedCellKey(null);
          }
        }
      }
    }
  };

  const handleHandCardClick = (idx: number) => {
    if (disabled || !isMyTurn || phase !== 'deploy') return;
    if (selectedCellKey) {
      // Instantly deploy!
      const card = activeHand[idx];
      onAction({
        type: 'deploy',
        cellKey: selectedCellKey,
        cardValue: card.value
      }).then(() => {
        setSelectedHandCardIndex(null);
      }).catch(console.error);
    } else {
      setSelectedHandCardIndex(idx === selectedHandCardIndex ? null : idx);
    }
  };

  const executeMove = async () => {
    if (!selectedCellKey || !moveTargetKey || moveCount <= 0) return;
    try {
      await onAction({
        type: 'move',
        from: selectedCellKey,
        to: moveTargetKey,
        count: moveCount
      });
      setSelectedCellKey(null);
      setMoveTargetKey(null);
    } catch (e) {
      console.error(e);
    }
  };

  const executeFightReact = async (combat: PendingCombat) => {
    try {
      await onAction({
        type: 'react',
        cellKey: combat.cellKey,
        reactType: 'fight'
      });
      // Duel resolution is updated in-place, modal stays open if combat continues
    } catch (e) {
      console.error(e);
    }
  };

  const executeRetreatReact = async (combat: PendingCombat) => {
    if (!retreatTargetKey) return;
    try {
      await onAction({
        type: 'react',
        cellKey: combat.cellKey,
        reactType: 'retreat',
        retreatTo: retreatTargetKey
      });
      setActiveCombatCellKey(null);
      setRetreatTargetKey(null);
    } catch (e) {
      console.error(e);
    }
  };

  const endDeploy = async () => {
    try {
      await onAction({ type: 'end_deploy' });
      setSelectedCellKey(null);
      setSelectedHandCardIndex(null);
    } catch (e) {
      console.error(e);
    }
  };

  const endTurn = async () => {
    try {
      await onAction({ type: 'end_turn' });
      setSelectedCellKey(null);
      setSelectedHandCardIndex(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Color mapping based on cell type
  const getCellFillClass = (cell: HolyGrailCell) => {
    const isSelected = selectedCellKey === `${cell.q},${cell.r}`;
    const isMoveTarget = moveTargetKey === `${cell.q},${cell.r}`;
    const isPendingCombat = pendingCombats.some(c => c.cellKey === `${cell.q},${cell.r}`);
    const isSelectableDeployCell = phase === 'deploy' && isMyTurn && cell.owner === myPiece && (
      cell.cellType === 'home_base' || (cell.cellType === 'urban' && cell.soldiers.length > 0)
    );

    if (isPendingCombat) {
      return 'fill-red-950/70 stroke-red-500 stroke-[2.5] animate-pulse';
    }
    if (isMoveTarget) {
      return 'fill-blue-900/60 stroke-blue-400 stroke-[2.5]';
    }
    if (isSelected) {
      return 'fill-indigo-900/60 stroke-indigo-400 stroke-[2.5]';
    }
    if (isSelectableDeployCell) {
      if (selectedHandCardIndex !== null) {
        return 'fill-indigo-950/60 stroke-indigo-400 stroke-[2] animate-pulse';
      }
      return 'fill-indigo-900/40 stroke-indigo-500 stroke-[1.5]';
    }

    switch (cell.cellType) {
      case 'grail_center':
        return 'fill-amber-950/60 stroke-amber-500 stroke-[2]';
      case 'home_base':
        return cell.r < 0 
          ? 'fill-rose-950/80 stroke-rose-500 stroke-[2]' 
          : 'fill-amber-900/40 stroke-amber-500 stroke-[2]';
      case 'urban':
        return cell.owner === 'X' && cell.soldiers.length > 0
          ? 'fill-rose-950/50 stroke-rose-500/80 stroke-2'
          : cell.owner === 'O' && cell.soldiers.length > 0
          ? 'fill-amber-950/50 stroke-amber-500/80 stroke-2'
          : 'fill-neutral-900 stroke-neutral-800';
      case 'farm_land':
        return 'fill-emerald-950/40 stroke-emerald-600/50 stroke-[1.5]';
      case 'hill':
        return 'fill-slate-800/60 stroke-slate-600/50 stroke-[1.5]';
      default:
        return 'fill-neutral-950/60 stroke-neutral-800/80 stroke-[1]';
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full max-w-6xl items-center justify-center p-4">
      <style>{`
        @keyframes cardFlip {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(90deg) scale(1.08); filter: brightness(1.3); }
          100% { transform: rotateY(0deg) scale(1); }
        }
        .animate-card-flip {
          animation: cardFlip 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
          perspective: 1000px;
        }
      `}</style>
      
      {/* ── Side panel for active phase info ── */}
      <div className="w-full xl:w-72 flex flex-col gap-4 bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl backdrop-blur-md">
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Active Turn</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-3 h-3 rounded-full ${turn === 'X' ? 'bg-rose-500' : 'bg-amber-500'}`} />
            <span className="font-bold text-lg text-white">Player {turn}</span>
            {isMyTurn && (
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Your Turn</span>
            )}
          </div>
        </div>

        {myPiece && (
          <div className="border-t border-neutral-800 pt-3">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Opponent Hand</div>
            <div className="text-white font-bold text-lg mt-0.5">
              {hands[myPiece === 'X' ? 'O' : 'X']?.length || 0} cards
            </div>
          </div>
        )}

        <div className="border-t border-neutral-800 pt-3">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Phase</div>
          <div className="text-white font-semibold text-lg capitalize mt-0.5">{phase} Phase</div>
        </div>

        {/* Phase instructions */}
        <div className="text-sm text-neutral-400 bg-neutral-950/40 border border-neutral-800/40 p-3 rounded-lg mt-1">
          {phase === 'deploy' && (
            <span>
              Deploy cards from your hand onto your 🛖 <strong>Urban housing cells</strong>. 
              <br/><br/>
              Your valid cells are highlighted in purple. 
              <br/><br/>
              <strong>To place:</strong> Click a highlighted housing cell, then click a card in your hand. Or click a card first, then click a highlighted cell.
            </span>
          )}
          {phase === 'move' && (
            <span>Select one of your stacks, then click an adjacent hex to move units. Stacks with Kings can carry the Grail 🏆.</span>
          )}
          {phase === 'react' && (
            <span>You are under attack! Click the contested cells (highlighted in red ⚔️) to fight or retreat.</span>
          )}
        </div>

        {/* Turn Actions */}
        {isMyTurn && (
          <div className="flex flex-col gap-2 mt-2">
            {phase === 'deploy' && (
              <button
                onClick={endDeploy}
                disabled={submittingMove || disabled}
                className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 shadow-lg shadow-indigo-600/20 transition-all duration-200"
              >
                Go to Movement
              </button>
            )}
            {phase === 'move' && (
              <button
                onClick={endTurn}
                disabled={submittingMove || disabled}
                className="w-full py-2.5 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 shadow-lg shadow-emerald-600/20 transition-all duration-200"
              >
                End Turn
              </button>
            )}
          </div>
        )}

        {/* Battle Log */}
        <div className="border-t border-neutral-800 pt-3 flex flex-col flex-1 w-full">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">Battle Log</div>
          <div className="flex-1 min-h-[200px] max-h-[240px] overflow-y-auto bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 flex flex-col gap-1 shadow-inner scrollbar-thin">
            {state.history && state.history.length > 0 ? (
              state.history.map((log, idx) => renderHistoryEntry(log, idx))
            ) : (
              <div className="text-xs text-neutral-600 italic text-center my-auto">No events yet.</div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Leave Match */}
        <div className="flex flex-col gap-2 mt-4 border-t border-neutral-800 pt-3">
          <Link
            to="/"
            className="w-full py-2 rounded-xl text-center font-bold text-xs border border-neutral-800 hover:border-neutral-700 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-white transition-all duration-200"
          >
            Leave Match
          </Link>
        </div>
      </div>

      {/* ── Main Board Canvas ── */}
      <div className="relative flex flex-col items-center gap-4">
        {/* Pending combat alerts */}
        {pendingCombats.length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-1.5 max-w-md w-full px-4">
            {pendingCombats.map((c, idx) => {
              const isControllingReaction = phase === 'react' && c.defender === myPiece;
              return (
                <div 
                  key={idx}
                  onClick={() => isControllingReaction && handleCellClick(c.cellKey)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm backdrop-blur-md cursor-pointer transition-all duration-200 ${
                    isControllingReaction 
                      ? 'bg-red-955/80 border-red-500/50 hover:bg-red-955 hover:scale-[1.01] text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                      : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse">⚔️</span>
                    <span className="font-semibold text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">
                      Combat at {c.cellKey}
                    </span>
                  </div>
                  <div className="text-xs">
                    {isControllingReaction ? 'Click to React!' : 'Awaiting defender...'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Board SVG */}
        <div className="bg-neutral-950/45 border border-neutral-800/80 p-2 sm:p-4 rounded-3xl backdrop-blur-sm shadow-2xl relative">
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] md:w-[520px] md:h-[520px] select-none"
          >
            <defs>
              <marker 
                id="arrow" 
                viewBox="0 0 10 10" 
                refX="4" 
                refY="5" 
                markerWidth="5" 
                markerHeight="5" 
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-indigo-400" />
              </marker>
            </defs>

            {/* Grid Cells */}
            {Object.values(board).map((cell) => {
              const { cx, cy } = getHexCenter(cell.q, cell.r);
              const cellKey = `${cell.q},${cell.r}`;
              const isGrail = grailCellKey === cellKey;
              const hasSoldiers = cell.soldiers.length > 0;
              const topCard = cell.soldiers[0];
              const isContested = pendingCombats.some(c => c.cellKey === cellKey);

              return (
                <g 
                  key={cellKey}
                  data-testid={`cell-${cellKey}`}
                  onClick={() => handleCellClick(cellKey)}
                  onMouseEnter={() => {
                    if (cell.soldiers.length > 0) {
                      setHoveredCellKey(cellKey);
                    }
                  }}
                  onMouseLeave={() => setHoveredCellKey(null)}
                  className="group cursor-pointer"
                >
                  {/* Hexagon Shape */}
                  <polygon
                    points={getHexPoints(cx, cy, HEX_SIZE - 2)}
                    className={`transition-all duration-200 ${getCellFillClass(cell)} hover:brightness-125`}
                    strokeDasharray={cell.cellType === 'urban' ? "4 3" : undefined}
                  />

                  {/* Inner Labels & Badges */}
                  {/* Cell Coordinates (Small utility label) */}
                  <text 
                    x={cx} 
                    y={cy - 22} 
                    textAnchor="middle" 
                    className="text-[9px] fill-neutral-600 font-mono select-none"
                  >
                    {cellKey}
                  </text>

                  {/* Cell type decorator icons */}
                  {cell.cellType === 'hill' && !hasSoldiers && (
                    <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-slate-400">⛰️</text>
                  )}
                  {cell.cellType === 'farm_land' && !hasSoldiers && (
                    <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-emerald-400">🌾</text>
                  )}
                  {cell.cellType === 'home_base' && !hasSoldiers && (
                    <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-rose-400">🏰</text>
                  )}
                  {cell.cellType === 'urban' && !hasSoldiers && (
                    <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-indigo-400">🛖</text>
                  )}

                  {/* Combat swords if contested */}
                  {isContested && (
                    <g transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
                      <circle 
                        r="14" 
                        className="fill-red-500/20 stroke-red-500 stroke-2 animate-ping" 
                      />
                      <text 
                        textAnchor="middle" 
                        y="5" 
                        className="text-lg drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] filter"
                      >
                        ⚔️
                      </text>
                    </g>
                  )}

                  {/* Soldiers Stack representation */}
                  {hasSoldiers && !isContested && (
                    <g transform={`translate(${cx}, ${cy - 5})`}>
                      {/* Badge background for stack size if size > 1 */}
                      {cell.soldiers.length > 1 && (
                        <circle 
                          r="11" 
                          cx="18" 
                          cy="-14" 
                          className="fill-neutral-900 stroke-neutral-700 stroke" 
                        />
                      )}
                      {cell.soldiers.length > 1 && (
                        <text 
                          x="18" 
                          y="-10.5" 
                          textAnchor="middle" 
                          className="text-[10px] font-bold fill-neutral-400 font-mono"
                        >
                          {cell.soldiers.length}
                        </text>
                      )}

                      {/* Top Card Face Drawing */}
                      <rect 
                        x="-14" 
                        y="-12" 
                        width="28" 
                        height="38" 
                        rx="4" 
                        className={`stroke-2 ${
                          cell.owner === 'X' 
                            ? 'fill-rose-950 stroke-rose-500' 
                            : cell.owner === 'O'
                            ? 'fill-amber-950 stroke-amber-500'
                            : 'fill-neutral-900 stroke-neutral-600'
                        }`} 
                      />

                      {/* Card value label */}
                      <text 
                        y="10" 
                        textAnchor="middle" 
                        className={`text-base font-black ${
                          cell.owner === 'X' 
                            ? 'fill-rose-200' 
                            : cell.owner === 'O'
                            ? 'fill-amber-200'
                            : 'fill-neutral-300'
                        }`}
                      >
                        {formatCardValue(topCard.value)}
                      </text>

                      {/* Cell type text indicator at the bottom of the card */}
                      {cell.cellType !== 'normal' && cell.cellType !== 'grail_center' && (
                        <text 
                          y="22" 
                          textAnchor="middle" 
                          className="text-[7px] font-bold fill-neutral-400 uppercase tracking-wider opacity-90 select-none"
                        >
                          {cell.cellType === 'urban' ? 'Urban' : cell.cellType === 'farm_land' ? 'Farm' : cell.cellType === 'hill' ? 'Hill' : 'Base'}
                        </text>
                      )}

                      {/* Small crown/stars icons for J/Q/K */}
                      {topCard.value === 13 && (
                        <text y="-4" textAnchor="middle" className="text-[9px] fill-amber-400">👑</text>
                      )}
                      {topCard.value === 12 && (
                        <text y="-4" textAnchor="middle" className="text-[9px] fill-purple-400">✨</text>
                      )}
                      {topCard.value === 11 && (
                        <text y="-4" textAnchor="middle" className="text-[9px] fill-blue-400">🛡️</text>
                      )}
                    </g>
                  )}

                  {/* Grail indicator overlay */}
                  {isGrail && (
                    <g transform={`translate(${cx}, ${cy - (hasSoldiers ? 31 : 0)})`} className="pointer-events-none">
                      <circle 
                        r="14" 
                        className="fill-amber-500/20 stroke-amber-400 stroke-2 animate-ping" 
                      />
                      <text 
                        textAnchor="middle" 
                        y="5" 
                        className="text-lg drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] filter"
                      >
                        🏆
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Movement Path Arrows */}
            {(state.movesThisTurn || []).map((move, idx) => {
              const fromCell = board[move.from];
              const toCell = board[move.to];
              if (!fromCell || !toCell) return null;

              const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
              const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);

              const dx = cx2 - cx1;
              const dy = cy2 - cy1;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) return null;

              const startX = cx1 + dx * (22 / len);
              const startY = cy1 + dy * (22 / len);
              const endX = cx2 - dx * (26 / len);
              const endY = cy2 - dy * (26 / len);

              const midX = (cx1 + cx2) / 2;
              const midY = (cy1 + cy2) / 2;

              return (
                <g 
                  key={`move-arrow-${idx}`}
                  onMouseEnter={() => setHoveredMoveIdx(idx)}
                  onMouseLeave={() => setHoveredMoveIdx(null)}
                  className="cursor-pointer"
                >
                  {/* Dashed line */}
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    className="stroke-indigo-400/90 stroke-[3] [stroke-dasharray:4,3]"
                    markerEnd="url(#arrow)"
                  />

                  {/* Thick transparent interactive area for easier hover */}
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    className="stroke-transparent stroke-[12]"
                  />

                  {/* Move count badge */}
                  <circle
                    cx={midX}
                    cy={midY}
                    r="8"
                    className="fill-indigo-950 stroke-indigo-400 stroke-[1.5]"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    className="text-[9px] font-black fill-indigo-200 select-none font-mono"
                  >
                    {move.cards.length}
                  </text>
                </g>
              );
            })}

            {/* Hovered Cell Stack Tooltip */}
            {hoveredCellKey && (() => {
              const cell = board[hoveredCellKey];
              if (!cell || cell.soldiers.length === 0) return null;
              
              const { cx, cy } = getHexCenter(cell.q, cell.r);
              
              const tooltipWidth = 140;
              const tooltipHeight = 36 + cell.soldiers.length * 20;
              const tooltipX = Math.max(10, Math.min(cx + 30, WIDTH - tooltipWidth - 10));
              const tooltipY = Math.max(10, Math.min(cy - 90, HEIGHT - tooltipHeight - 10));

              return (
                <g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
                  <rect
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="8"
                    className="fill-neutral-950/95 stroke-neutral-700/80 stroke-2"
                  />
                  <text
                    x={tooltipWidth / 2}
                    y="14"
                    textAnchor="middle"
                    className="fill-neutral-400 text-[8px] font-bold tracking-widest uppercase"
                  >
                    Stack Soldiers
                  </text>

                  {cell.soldiers.map((card, idx) => {
                    const isCardValueVisible = card.value > 0;
                    
                    return (
                      <g key={idx} transform={`translate(10, ${22 + idx * 20})`}>
                        <rect
                          width={tooltipWidth - 20}
                          height="16"
                          rx="3"
                          className={`${
                            cell.owner === 'X'
                              ? 'fill-rose-950/40 stroke-rose-500/30'
                              : cell.owner === 'O'
                              ? 'fill-amber-950/40 stroke-amber-500/30'
                              : 'fill-neutral-900 stroke-neutral-800'
                          } stroke`}
                        />
                        <text
                          x="6"
                          y="11"
                          className={`text-[9px] font-bold ${
                            isCardValueVisible
                              ? cell.owner === 'X'
                                ? 'fill-rose-200'
                                : cell.owner === 'O'
                                ? 'fill-amber-200'
                                : 'fill-neutral-200'
                              : 'fill-neutral-500 font-normal italic'
                          }`}
                        >
                          {isCardValueVisible
                            ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})`
                            : 'Hidden (?)'}
                          {card.moved && ' (Moved)'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* Hovered Move Arrow Tooltip */}
            {hoveredMoveIdx !== null && (() => {
              const move = (state.movesThisTurn || [])[hoveredMoveIdx];
              if (!move) return null;

              const fromCell = board[move.from];
              const toCell = board[move.to];
              if (!fromCell || !toCell) return null;

              const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
              const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);
              const midX = (cx1 + cx2) / 2;
              const midY = (cy1 + cy2) / 2;

              const tooltipWidth = 140;
              const tooltipHeight = 36 + move.cards.length * 20;
              const tooltipX = Math.max(10, Math.min(midX + 15, WIDTH - tooltipWidth - 10));
              const tooltipY = Math.max(10, Math.min(midY - 40, HEIGHT - tooltipHeight - 10));

              return (
                <g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
                  <rect
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="8"
                    className="fill-neutral-950/95 stroke-indigo-500/50 stroke-2"
                  />
                  <text
                    x={tooltipWidth / 2}
                    y="14"
                    textAnchor="middle"
                    className="fill-indigo-300 text-[8px] font-bold tracking-widest uppercase"
                  >
                    Moved Units
                  </text>

                  {move.cards.map((card, idx) => {
                    const isCardValueVisible = card.value > 0;
                    
                    return (
                      <g key={idx} transform={`translate(10, ${22 + idx * 20})`}>
                        <rect
                          width={tooltipWidth - 20}
                          height="16"
                          rx="3"
                          className="fill-indigo-950/30 stroke-indigo-500/20 stroke"
                        />
                        <text
                          x="6"
                          y="11"
                          className={`text-[9px] font-bold ${
                            isCardValueVisible ? 'fill-indigo-200' : 'fill-neutral-500 font-normal italic'
                          }`}
                        >
                          {isCardValueVisible
                            ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})`
                            : 'Hidden (?)'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Hand View at the bottom of the board canvas (Spacious card-game style) */}
        {isMyTurn && phase === 'deploy' && (
          <div className="w-full max-w-[560px] bg-neutral-900/80 border border-neutral-800/80 p-5 rounded-2xl backdrop-blur-md flex flex-col items-center gap-4 shadow-xl">
            <div className="flex justify-between items-center w-full text-xs font-semibold text-neutral-400 px-1">
              <span>YOUR HAND ({activeHand.length} cards)</span>
              <div className="flex items-center gap-3">
                {selectedCellKey && activeHand.length > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        await onAction({
                          type: 'deploy_all',
                          cellKey: selectedCellKey
                        });
                        setSelectedCellKey(null);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    disabled={disabled || submittingMove}
                    className="px-2 py-1 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded text-[10px] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
                  >
                    Deploy All to {selectedCellKey}
                  </button>
                )}
                <span>{selectedCellKey ? `Click a card to deploy to ${selectedCellKey}` : 'Click a card, then click a highlighted cell'}</span>
              </div>
            </div>
            {activeHand.length === 0 ? (
              <div className="text-center py-6 text-neutral-600 text-sm italic">Empty hand</div>
            ) : (
              <div className="flex flex-wrap justify-center gap-4 w-full">
                {activeHand.map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleHandCardClick(idx)}
                    className={`w-16 h-24 rounded-xl flex flex-col items-center justify-between p-2.5 border-2 transition-all duration-200 relative hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
                      selectedHandCardIndex === idx
                        ? 'bg-indigo-950 border-indigo-400 text-indigo-200 shadow-indigo-500/30 scale-110 -translate-y-2'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-bold self-start">{formatCardValue(card.value)}</span>
                    <span className="text-xl font-black">{formatCardValue(card.value)}</span>
                    <span className="text-[7px] uppercase font-bold tracking-tight text-neutral-500 self-end">
                      {card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Active Actions Panels (Right Column) ── */}
      <div className="w-full xl:w-80 flex flex-col gap-4">
        {/* Placeholder panel when deploying */}
        {isMyTurn && phase === 'deploy' && (
          <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl backdrop-blur-md hidden xl:block">
            <h3 className="text-sm font-semibold text-neutral-400 mb-2 uppercase tracking-wider">Deploy Mode</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Use the horizontal card hand under the board to easily pick and place cards.
            </p>
          </div>
        )}

        {/* Move sliders / controllers */}
        {isMyTurn && phase === 'move' && selectedCellKey && (
          <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl backdrop-blur-md">
            <h3 className="text-sm font-semibold text-neutral-400 mb-1 uppercase tracking-wider">Move Soldiers</h3>
            <div className="text-xs text-neutral-500 mb-3">Origin: {selectedCellKey}</div>

            {moveTargetKey ? (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between text-sm text-neutral-300 mb-1">
                    <span>Count to move:</span>
                    <span className="font-bold text-white">{moveCount} / {board[selectedCellKey]?.soldiers.length}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={board[selectedCellKey]?.soldiers.length || 1}
                    value={moveCount}
                    onChange={(e) => setMoveCount(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-neutral-950 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* King transport warnings */}
                {grailCellKey === selectedCellKey && (
                  <div className="text-xs bg-amber-950/20 border border-amber-500/20 text-amber-400 p-2.5 rounded-lg">
                    ⚠️ Carrying the Grail! At least one King (K) must be in the moving stack of {moveCount} cards.
                  </div>
                )}

                <button
                  onClick={executeMove}
                  disabled={submittingMove || disabled}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-all"
                >
                  Move to {moveTargetKey}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-neutral-500 italic border border-dashed border-neutral-800 rounded-xl">
                Click an adjacent hex to set target destination.
              </div>
            )}
          </div>
        )}

        {/* Combat Reaction Modal Overlay / Panel */}
        {activeCombatCellKey !== null && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {(() => {
              const combat = pendingCombats.find(c => c.cellKey === activeCombatCellKey);
              if (!combat) return null;
              const isHill = board[combat.cellKey]?.cellType === 'hill';
              const adjacentFriendly = getAdjacentFriendlyCells(combat.cellKey);

              // Helper to get specific logs for this cell
              const getCombatLogsForCell = (cellKey: string) => {
                if (!state.history) return [];
                const [q, r] = cellKey.split(',').map(Number);
                const isGrailCenter = q === 0 && r === 0;
                const cellName = isGrailCenter ? 'Grail Center' : cellKey;

                return state.history.filter(log => {
                  if (typeof log === 'string') {
                    if (log.trim().startsWith('{')) return false;
                    return log.includes(cellName) && (
                      log.toLowerCase().includes('combat') || 
                      log.toLowerCase().includes('vs') || 
                      log.toLowerCase().includes('retreat') ||
                      log.toLowerCase().includes('wins!') ||
                      log.toLowerCase().includes('draw!')
                    );
                  }
                  return false;
                });
              };

              const combatLogs = getCombatLogsForCell(combat.cellKey);

              return (
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl relative">
                  <button 
                    onClick={() => setActiveCombatCellKey(null)}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>

                  <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <span>⚔️</span> Contested Combat Resolution
                  </h3>
                  <div className="text-xs text-neutral-500 mb-4">Cell: {combat.cellKey} {isHill && '(Hill Defense Active ⛰️)'}</div>

                  {/* Attacker vs Defender top cards visualization */}
                  <div className="flex items-center justify-around bg-neutral-950 p-5 rounded-2xl border border-neutral-800 mb-4">
                    {/* Attacker side */}
                    <div className="flex flex-col items-center gap-1">
                               <div className={`w-16 h-22 border-2 border-rose-500 bg-rose-950/20 rounded-xl flex items-center justify-center text-2xl font-black text-rose-100 relative shadow-[0_0_15px_rgba(239,68,68,0.1)] ${
                        isRevealingAttacker ? 'animate-card-flip' : ''
                      }`}>
                        {displayedAttackerVal !== undefined ? formatCardValue(displayedAttackerVal) : '?'}
                        {displayedAttackerVal === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                      </div>
                      <span className="text-xs text-neutral-500">{combat.attackerRemainingCount} left</span>
                      
                      {/* Remaining Attacker Stack Preview */}
                      <div className="flex gap-1 mt-1.5 max-w-[140px] overflow-x-auto justify-center">
                        {combat.attackerStack?.slice(1).map((card, cardIdx) => {
                          const isKnown = card.value > 0;
                          return (
                            <div 
                              key={cardIdx} 
                              title={isKnown ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})` : 'Hidden Opponent Soldier'}
                              className={`w-7 h-10 border rounded flex items-center justify-center text-[10px] font-bold shrink-0 cursor-help transition-all ${
                                isKnown
                                  ? combat.attacker === 'X'
                                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 hover:border-rose-455'
                                    : 'bg-amber-950/60 border-amber-500/50 text-amber-200 hover:border-amber-455'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 font-normal italic hover:border-neutral-700'
                              }`}
                            >
                              {isKnown ? formatCardValue(card.value) : '?'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
 
                    <div className="text-xl font-black text-neutral-700">VS</div>
 
                    {/* Defender side */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest font-mono">Defender</span>
                      <div className={`w-16 h-22 border-2 border-amber-500 bg-amber-950/20 rounded-xl flex items-center justify-center text-2xl font-black text-amber-100 relative shadow-[0_0_15px_rgba(245,158,11,0.1)] ${
                        isRevealingDefender ? 'animate-card-flip' : ''
                      }`}>
                        {displayedDefenderVal !== undefined ? formatCardValue(displayedDefenderVal) : '?'}
                        {displayedDefenderVal === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                      </div>
                      <span className="text-xs text-neutral-500">{combat.defenderRemainingCount} left</span>

                      {/* Remaining Defender Stack Preview */}
                      <div className="flex gap-1 mt-1.5 max-w-[140px] overflow-x-auto justify-center">
                        {board[combat.cellKey]?.soldiers.slice(1).map((card, cardIdx) => {
                          const isKnown = card.value > 0;
                          return (
                            <div 
                              key={cardIdx} 
                              title={isKnown ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})` : 'Hidden Opponent Soldier'}
                              className={`w-7 h-10 border rounded flex items-center justify-center text-[10px] font-bold shrink-0 cursor-help transition-all ${
                                isKnown
                                  ? combat.defender === 'X'
                                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 hover:border-rose-455'
                                    : 'bg-amber-950/60 border-amber-500/50 text-amber-200 hover:border-amber-455'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 font-normal italic hover:border-neutral-700'
                              }`}
                            >
                              {isKnown ? formatCardValue(card.value) : '?'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Duel Resolution Log Panel */}
                  <div className="mb-4">
                    <div className="text-[10px] font-semibold text-neutral-400 mb-1 uppercase tracking-wide">Combat Log</div>
                    <div className="max-h-24 overflow-y-auto bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 flex flex-col gap-1 shadow-inner scrollbar-thin">
                      {combatLogs.length > 0 ? (
                        combatLogs.map((log, idx) => (
                          <div key={idx} className="text-[11px] text-neutral-300 border-b border-neutral-900/60 pb-1 last:border-b-0 leading-normal">
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-neutral-600 italic text-center py-2">No duels resolved yet in this combat.</div>
                      )}
                    </div>
                  </div>

                  {/* React type actions */}
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => executeFightReact(combat)}
                      disabled={submittingMove || disabled}
                      className="w-full py-3 rounded-xl bg-red-650 hover:bg-red-500 font-bold text-white shadow-lg shadow-red-700/20 transition-all duration-200 hover:scale-[1.01] active:scale-95"
                    >
                      Duel Top Cards!
                    </button>

                    {/* Retreat selection */}
                    <div className="border-t border-neutral-800/80 pt-3 mt-1">
                      <div className="text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Retreat to Friendly Cell</div>
                      {adjacentFriendly.length === 0 ? (
                        <div className="text-xs text-neutral-600 italic">No friendly adjacent cells available for retreat.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {adjacentFriendly.map(key => (
                            <button
                              key={key}
                              onClick={() => setRetreatTargetKey(key)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                retreatTargetKey === key
                                  ? 'bg-amber-950 border-amber-400 text-amber-300 shadow'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                              }`}
                            >
                              Cell {key}
                            </button>
                          ))}
                        </div>
                      )}

                      {retreatTargetKey && (
                        <button
                          onClick={() => executeRetreatReact(combat)}
                          disabled={submittingMove || disabled}
                          className="w-full mt-2.5 py-2 rounded-xl bg-neutral-950 border border-amber-600/40 text-amber-400 font-semibold hover:bg-amber-950/70 transition-all hover:scale-[1.01] active:scale-95"
                        >
                          Execute Retreat to {retreatTargetKey}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

    </div>
  );
};
