import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useReviewPhase } from './useReviewPhase';
import { useParams } from 'react-router-dom';
import type { GrailQuestCell, PendingCombat, GrailQuestCard } from '@vibe-games/shared';
import { getAggregatedFriendlyMoves, getAggregatedReviewMoves, parseCardLabel } from './boardUtils';
import type { GrailQuestBoardProps } from './boardUtils';
import { parseCombatText } from './historyUtils';

export function useGrailQuestBoard(props: GrailQuestBoardProps) {
  const { state, myPiece, disabled, submittingMove, onAction } = props;
  const { board: stateBoard, phase, turn, winner, hands, pendingCombats: rawPendingCombats, grailCellKey: stateGrailCellKey = '0,0' } = state;
  const pendingCombats = rawPendingCombats || [];

  const { id: gameId } = useParams<{ id: string }>();

  const [isLogCollapsed, setIsLogCollapsed] = useState<boolean>(true);
  const isMyTurn = turn === myPiece && !winner;
  const history = useMemo(() => state.history || [], [state.history]);

  const {
    isReviewingLastTurn,
    setIsReviewingLastTurn,
    reviewMoves,
    setReviewMoves,
    reviewDeploys,
    setReviewDeploys,
    reviewRadioactivity,
    setReviewRadioactivity,
    lastReviewedEndTurnIdx,
    setLastReviewedEndTurnIdx,
    lastSelfEndTurnIdx,
    board,
    grailCellKey
  } = useReviewPhase({
    history,
    stateBoard,
    stateGrailCellKey,
    myPiece,
    turn,
    winner: state.winner || null,
    gameId
  });

  const aggregatedFriendlyMoves = useMemo(() => {
    return getAggregatedFriendlyMoves(state.movesThisTurn || []);
  }, [state.movesThisTurn]);

  const aggregatedReviewMoves = useMemo(() => {
    return getAggregatedReviewMoves(reviewMoves);
  }, [reviewMoves]);
   

  const isBoardLocked = disabled || isReviewingLastTurn;
  const canDeploy = isMyTurn && phase === 'deploy' && !isBoardLocked;

  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [moveTargetKey, setMoveTargetKey] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState<number>(1);
  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  const [activeCombatCellKey, setActiveCombatCellKey] = useState<string | null>(null);
  const [retreatTargetKey, setRetreatTargetKey] = useState<string | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const [hoveredMoveIdx, setHoveredMoveIdx] = useState<number | null>(null);

  const [displayedCombat, setDisplayedCombat] = useState<PendingCombat | null>(null);
  const [displayedAttackerVal, setDisplayedAttackerVal] = useState<number | undefined>(undefined);
  const [displayedDefenderVal, setDisplayedDefenderVal] = useState<number | undefined>(undefined);
  const [displayedDefenderVal2, setDisplayedDefenderVal2] = useState<number | undefined>(undefined);
  const [displayedDefenderStack, setDisplayedDefenderStack] = useState<GrailQuestCard[]>([]);
  
  const [isRevealingAttacker, setIsRevealingAttacker] = useState(false);
  const [isRevealingDefender, setIsRevealingDefender] = useState(false);
  const [isTransitioningNext, setIsTransitioningNext] = useState(false);
  
  const prevHistoryLenRef = useRef<number>(state.history?.length || 0);
  const isTransitioningRef = useRef<boolean>(false);
  const lastActiveCombatCellKeyRef = useRef<string | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPropCombat = pendingCombats.find(c => c.cellKey === activeCombatCellKey) || null;

   
  useEffect(() => {
    if (!activeCombatCellKey) {
      if (displayedCombat !== null) setDisplayedCombat(null);
      if (displayedAttackerVal !== undefined) setDisplayedAttackerVal(undefined);
      if (displayedDefenderVal !== undefined) setDisplayedDefenderVal(undefined);
      if (displayedDefenderVal2 !== undefined) setDisplayedDefenderVal2(undefined);
      if (displayedDefenderStack.length > 0) setDisplayedDefenderStack([]);
      setIsRevealingAttacker(false);
      setIsRevealingDefender(false);
      lastActiveCombatCellKeyRef.current = null;
      return;
    }

    if (lastActiveCombatCellKeyRef.current !== activeCombatCellKey && currentPropCombat) {
      const isHill = board[currentPropCombat.cellKey]?.cellType === 'hill';
      const defSoldiers = board[currentPropCombat.cellKey]?.soldiers || [];
      const hasSecondDefenderCard = isHill && defSoldiers.length >= 2;
      setDisplayedCombat(currentPropCombat);
      setDisplayedAttackerVal(currentPropCombat.attackerTopCard?.value || 0);
      setDisplayedDefenderVal(currentPropCombat.defenderTopCard?.value || 0);
      setDisplayedDefenderVal2(hasSecondDefenderCard ? (defSoldiers[1]?.value || 0) : undefined);
      setDisplayedDefenderStack(defSoldiers);
      lastActiveCombatCellKeyRef.current = activeCombatCellKey;
    }
  }, [activeCombatCellKey, currentPropCombat, board, displayedCombat, displayedAttackerVal, displayedDefenderVal, displayedDefenderVal2, displayedDefenderStack]);
   

   
  useEffect(() => {
    const history = state.history || [];
    const prevHistoryLen = prevHistoryLenRef.current;
    prevHistoryLenRef.current = history.length;

    if (history.length > prevHistoryLen && activeCombatCellKey) {
      const lastLog = history[history.length - 1];
      if (lastLog && lastLog.includes('⚔️') && lastLog.includes(activeCombatCellKey)) {
        const duel = parseCombatText(lastLog);
        if (duel) {
          isTransitioningRef.current = true;
          
          const wasAttackerKnown = displayedAttackerVal !== undefined && displayedAttackerVal > 0;
          const wasDefenderKnown = displayedDefenderVal !== undefined && displayedDefenderVal > 0;

          if (!wasAttackerKnown) {
            // STAGE 1: Spin card to reveal attacker value
            setIsRevealingAttacker(true);
            setDisplayedAttackerVal(0);
          }
          if (!wasDefenderKnown) {
            // STAGE 1: Spin card to reveal defender value
            setIsRevealingDefender(true);
            setDisplayedDefenderVal(0);
            if (displayedDefenderVal2 !== undefined) {
              setDisplayedDefenderVal2(0);
            }
          }

          const shouldDelay = !wasAttackerKnown || !wasDefenderKnown;

          const revealTimer = setTimeout(() => {
            const parsedAtt = parseCardLabel(duel.attackerCard);
            
            let parsedDef: number;
            let parsedDef2: number | undefined = undefined;

            if (duel.defenderCard.includes(',')) {
              const parts = duel.defenderCard.split(',');
              parsedDef = parseCardLabel(parts[0].trim());
              parsedDef2 = parseCardLabel(parts[1].trim());
            } else {
              parsedDef = parseCardLabel(duel.defenderCard);
            }

            setDisplayedAttackerVal(parsedAtt);
            setDisplayedDefenderVal(parsedDef);
            setDisplayedDefenderVal2(parsedDef2);
          }, shouldDelay ? 200 : 0);

          // STAGE 2: Spin cards face down, and swap to the new state
          const transitionTimer = setTimeout(() => {
            if (!wasAttackerKnown) {
              setIsRevealingAttacker(false);
            }
            if (!wasDefenderKnown) {
              setIsRevealingDefender(false);
            }

            // Wait for transition classes to reset, then trigger flip to next soldier
            resetDelayTimerRef.current = setTimeout(() => {
              if (currentPropCombat) {
                setIsTransitioningNext(true);
                
                const nextAttVal = currentPropCombat.attackerTopCard?.value || 0;
                const nextDefVal = currentPropCombat.defenderTopCard?.value || 0;
                const nextDefStack = board[currentPropCombat.cellKey]?.soldiers || [];
                const isHillNext = board[currentPropCombat.cellKey]?.cellType === 'hill';
                const nextDefVal2 = (isHillNext && nextDefStack.length >= 2) ? (nextDefStack[1]?.value || 0) : undefined;

                swapTimerRef.current = setTimeout(() => {
                  setDisplayedCombat(currentPropCombat);
                  setDisplayedAttackerVal(nextAttVal);
                  setDisplayedDefenderVal(nextDefVal);
                  setDisplayedDefenderVal2(nextDefVal2);
                  setDisplayedDefenderStack(nextDefStack);
                }, 200);

                endTransitionTimerRef.current = setTimeout(() => {
                  setIsTransitioningNext(false);
                  isTransitioningRef.current = false;
                }, 400);
              } else {
                isTransitioningRef.current = false;
              }
            }, shouldDelay ? 50 : 0);
          }, 1400);

          return () => {
            clearTimeout(revealTimer);
            clearTimeout(transitionTimer);
            if (resetDelayTimerRef.current) clearTimeout(resetDelayTimerRef.current);
            if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
            if (endTransitionTimerRef.current) clearTimeout(endTransitionTimerRef.current);
          };
        }
      }
    }
   
  }, [state.history?.length, activeCombatCellKey]);
   

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLogCollapsed && logContainerRef.current) {
      const timer = setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTo({
            top: logContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [state.history?.length, isLogCollapsed]);

  const activeHand = myPiece ? (hands[myPiece] || []) : [];

  const endDeploy = useCallback(async () => {
    try {
      await onAction({ type: 'end_deploy' });
      setSelectedCellKey(null);
      setSelectedHandCardIndex(null);
    } catch (e) {
      console.error(e);
    }
  }, [onAction]);

   
  // Auto-advance deploy phase if hand is empty
  useEffect(() => {
    if (phase === 'deploy' && isMyTurn && activeHand.length === 0 && !isBoardLocked && !submittingMove) {
      endDeploy();
    }
  }, [phase, isMyTurn, activeHand.length, isBoardLocked, submittingMove, endDeploy]);
   

   
  // If active combat is resolved or phase is not react, close modal
  useEffect(() => {
    if (activeCombatCellKey) {
      const exists = pendingCombats.some(c => c.cellKey === activeCombatCellKey);
      if (!exists) {
        const timer = setTimeout(() => {
          setActiveCombatCellKey(null);
        }, 1800);
        return () => clearTimeout(timer);
      }
      if (phase !== 'react') {
        setActiveCombatCellKey(null);
        return;
      }
    }
  }, [pendingCombats, activeCombatCellKey, phase]);
   

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
    if (isBoardLocked || !isMyTurn) return;
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
        cell.cellType === 'home_base' || cell.cellType === 'urban'
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
          setMoveCount(cell.soldiers.length);
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
          setMoveCount(maxCount);
        } else {
          // Select another friendly stack
          if (cell.owner === myPiece && cell.soldiers.length > 0) {
            setSelectedCellKey(key);
            setMoveTargetKey(null);
            setMoveCount(cell.soldiers.length);
          } else {
            setSelectedCellKey(null);
          }
        }
      }
    }
  };

  const handleHandCardClick = (idx: number) => {
    if (isBoardLocked || !isMyTurn || phase !== 'deploy') return;
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

  const endTurn = async () => {
    try {
      // 1. Construct the finalized board where all our in-transit moves are placed on their destinations
      const finalizedBoard: Record<string, GrailQuestCell> = JSON.parse(JSON.stringify(board));
      
      const friendlyTargets = new Set<string>();
      for (const move of state.movesThisTurn || []) {
        friendlyTargets.add(move.to);
      }
      
      const AXIAL_NEIGHBORS = [
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 1, r: -1 }
      ];

      const getNeighborIndex = (q_dest: number, r_dest: number, q_start: number, r_start: number): number => {
        const dq = q_start - q_dest;
        const dr = r_start - r_dest;
        return AXIAL_NEIGHBORS.findIndex(n => n.q === dq && n.r === dr);
      };

      const reassembleCellStackFrontend = (
        moves: { from: string; to: string; cards: GrailQuestCard[]; carriesGrail?: boolean }[],
        cellKey: string,
        baseSoldiers: GrailQuestCard[]
      ): GrailQuestCard[] => {
        const incoming = moves.filter(m => m.to === cellKey);
        if (incoming.length === 0) return baseSoldiers;

        const [q_dest, r_dest] = cellKey.split(',').map(Number);
        const sortedIncoming = [...incoming].sort((a, b) => {
          const [aq, ar] = a.from.split(',').map(Number);
          const [bq, br] = b.from.split(',').map(Number);
          return getNeighborIndex(q_dest, r_dest, aq, ar) - getNeighborIndex(q_dest, r_dest, bq, br);
        });

        const mergedIncoming = sortedIncoming.flatMap(m => m.cards);
        return [...baseSoldiers, ...mergedIncoming];
      };

      for (const toKey of friendlyTargets) {
        const toCell = finalizedBoard[toKey];
        if (toCell) {
          toCell.soldiers = reassembleCellStackFrontend(state.movesThisTurn || [], toKey, toCell.soldiers);
          if (myPiece) {
            toCell.owner = myPiece;
          }
        }
      }

      const cacheData = {
        board: finalizedBoard,
        grailCellKey: stateGrailCellKey
      };

      try {
        sessionStorage.setItem(`pre-board-${gameId || 'default'}`, JSON.stringify(cacheData));
      } catch (err) {
        console.error('Failed to save pre-board to sessionStorage:', err);
      }

      await onAction({ type: 'end_turn' });
      setSelectedCellKey(null);
      setSelectedHandCardIndex(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Color mapping based on cell type
  const getCellFillClass = (cell: GrailQuestCell) => {
    const isSelected = selectedCellKey === `${cell.q},${cell.r}`;
    const isMoveTarget = moveTargetKey === `${cell.q},${cell.r}`;
    const isPendingCombat = pendingCombats.some(c => c.cellKey === `${cell.q},${cell.r}`);
    const isSelectableDeployCell = phase === 'deploy' && isMyTurn && cell.owner === myPiece && (
      cell.cellType === 'home_base' || cell.cellType === 'urban'
    );

    if (isPendingCombat) {
      return 'fill-red-950/70 stroke-red-500 stroke-[2.5] animate-pulse';
    }
    if (isMoveTarget) {
      return myPiece === 'X'
        ? 'fill-blue-900/60 stroke-blue-400 stroke-[2.5]'
        : 'fill-rose-900/60 stroke-rose-400 stroke-[2.5]';
    }
    if (isSelected) {
      return myPiece === 'X'
        ? 'fill-blue-900/60 stroke-blue-400 stroke-[2.5]'
        : 'fill-rose-900/60 stroke-rose-400 stroke-[2.5]';
    }
    if (isSelectableDeployCell) {
      if (myPiece === 'X') {
        if (selectedHandCardIndex !== null) {
          return 'fill-blue-950/60 stroke-blue-400 stroke-[2] animate-pulse';
        }
        return 'fill-blue-900/40 stroke-blue-500 stroke-[1.5]';
      } else {
        if (selectedHandCardIndex !== null) {
          return 'fill-rose-950/60 stroke-rose-400 stroke-[2] animate-pulse';
        }
        return 'fill-rose-900/30 stroke-rose-500 stroke-[1.5]';
      }
    }

    switch (cell.cellType) {
      case 'home_base':
        return cell.r < 0 
          ? 'fill-blue-950/80 stroke-blue-500 stroke-[2]' 
          : 'fill-rose-900/40 stroke-rose-500 stroke-[2]';
      case 'urban':
        return cell.owner === 'X'
          ? 'fill-blue-950/50 stroke-blue-500/80 stroke-2'
          : cell.owner === 'O'
          ? 'fill-rose-950/50 stroke-rose-500/80 stroke-2'
          : 'fill-neutral-900 stroke-neutral-800';
      case 'farm_land':
        return cell.owner === 'X'
          ? 'fill-emerald-950/20 stroke-blue-500/80 stroke-2'
          : cell.owner === 'O'
          ? 'fill-emerald-950/20 stroke-rose-500/80 stroke-2'
          : 'fill-emerald-950/40 stroke-emerald-600/50 stroke-[1.5]';
      case 'hill':
        return 'fill-slate-800/60 stroke-slate-600/50 stroke-[1.5]';
      default:
        return 'fill-neutral-950/60 stroke-neutral-800/80 stroke-[1]';
    }
  };


  return {
    board,
    grailCellKey,
    isReviewingLastTurn,
    setIsReviewingLastTurn,
    reviewMoves,
    setReviewMoves,
    reviewDeploys,
    setReviewDeploys,
    reviewRadioactivity,
    setReviewRadioactivity,
    lastReviewedEndTurnIdx,
    setLastReviewedEndTurnIdx,
    isLogCollapsed,
    setIsLogCollapsed,
    isMyTurn,
    history,
    aggregatedFriendlyMoves,
    aggregatedReviewMoves,
    lastSelfEndTurnIdx,
    activeHand,
    selectedHandCardIndex,
    setSelectedHandCardIndex,
    selectedCellKey,
    setSelectedCellKey,
    hoveredCellKey,
    setHoveredCellKey,
    moveTargetKey,
    setMoveTargetKey,
    retreatTargetKey,
    setRetreatTargetKey,
    moveCount,
    setMoveCount,
    activeCombatCellKey,
    setActiveCombatCellKey,
    hoveredMoveIdx,
    setHoveredMoveIdx,
    displayedCombat,
    setDisplayedCombat,
    displayedAttackerVal,
    setDisplayedAttackerVal,
    displayedDefenderVal,
    setDisplayedDefenderVal,
    displayedDefenderVal2,
    setDisplayedDefenderVal2,
    displayedDefenderStack,
    setDisplayedDefenderStack,
    isRevealingAttacker,
    setIsRevealingAttacker,
    isRevealingDefender,
    setIsRevealingDefender,
    isTransitioningNext,
    setIsTransitioningNext,
    isBoardLocked,
    logContainerRef,
    getCellFillClass,
    handleCellClick,
    handleHandCardClick,
    endDeploy,
    executeMove,
    endTurn,
    getAdjacentFriendlyCells,
    executeFightReact,
    executeRetreatReact,
    canDeploy,
  };
}
