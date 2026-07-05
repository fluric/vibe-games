import { useState, useEffect, useMemo } from 'react';
import type { PlayerPiece, GrailQuestCell } from '@vibe-games/shared';
import type { TempVisualMove, TempVisualDeploy, TempVisualRadioactivity } from './boardUtils';
import { rollbackBoardAndGrail } from './boardUtils';
import { parseRadioactiveText, parseRetreatText } from './historyUtils';

interface UseReviewPhaseParams {
  history: string[];
  stateBoard: Record<string, GrailQuestCell>;
  stateGrailCellKey: string;
  myPiece: PlayerPiece | null;
  turn: PlayerPiece;
  winner: PlayerPiece | 'draw' | null;
  gameId?: string;
}

export function useReviewPhase({
  history,
  stateBoard,
  stateGrailCellKey,
  myPiece,
  turn,
  winner,
  gameId
}: UseReviewPhaseParams) {
  const [isReviewingLastTurn, setIsReviewingLastTurn] = useState<boolean>(false);
  const [reviewMoves, setReviewMoves] = useState<TempVisualMove[]>([]);
  const [reviewDeploys, setReviewDeploys] = useState<TempVisualDeploy[]>([]);
  const [reviewRadioactivity, setReviewRadioactivity] = useState<TempVisualRadioactivity[]>([]);
  const [lastReviewedEndTurnIdx, setLastReviewedEndTurnIdx] = useState<number>(-1);

  const isMyTurn = turn === myPiece && !winner;

  // Find the last index of our own end_turn action
  let lastSelfEndTurnIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    const log = history[i];
    if (typeof log === 'string' && log.trim().startsWith('{')) {
      try {
        const action = JSON.parse(log);
        if (action.player === myPiece && (action.type === 'end_turn' || action.action === 'end_turn')) {
          lastSelfEndTurnIdx = i;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  // Determine displaying board state
  const { board, grailCellKey } = useMemo((): { board: Record<string, GrailQuestCell>; grailCellKey: string } => {
    const defaultState = {
      board: stateBoard,
      grailCellKey: stateGrailCellKey || '0,0'
    };

    if (!isReviewingLastTurn) {
      return defaultState;
    }

    try {
      const cached = sessionStorage.getItem(`pre-board-${gameId || 'default'}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.board) {
          return {
            board: parsed.board,
            grailCellKey: parsed.grailCellKey || '0,0'
          };
        }
      }
    } catch {
      // ignore
    }

    const oppPiece = myPiece === 'X' ? 'O' : 'X';
    return rollbackBoardAndGrail(stateBoard, stateGrailCellKey, reviewDeploys, reviewMoves, oppPiece);
  }, [stateBoard, stateGrailCellKey, isReviewingLastTurn, gameId, reviewDeploys, reviewMoves, myPiece]);

  useEffect(() => {
    if (!winner) {
      if (isMyTurn) {
        let isMiddleOfTurn = false;
        for (let i = history.length - 1; i >= 0; i--) {
          const log = history[i];
          if (typeof log === 'string' && log.trim().startsWith('{')) {
            try {
              const action = JSON.parse(log);
              if (action.player) {
                if (action.player === myPiece) {
                  if (action.type !== 'end_turn' && action.action !== 'end_turn') {
                    isMiddleOfTurn = true;
                  }
                }
                break;
              }
            } catch {
              // ignore
            }
          }
        }

        if (isMiddleOfTurn) {
          setLastReviewedEndTurnIdx(lastSelfEndTurnIdx);
          setIsReviewingLastTurn(false);
          setReviewMoves([]);
          setReviewDeploys([]);
          setReviewRadioactivity([]);
          return;
        }

        if (lastSelfEndTurnIdx > lastReviewedEndTurnIdx) {
          const sliceStart = lastSelfEndTurnIdx + 1;
          let hasOppAction = false;
          const opponentMoves: TempVisualMove[] = [];
          const opponentDeploys: TempVisualDeploy[] = [];
          const opponentRadioactivity: TempVisualRadioactivity[] = [];

          for (let i = sliceStart; i < history.length; i++) {
            const log = history[i];
            if (typeof log === 'string') {
              if (log.trim().startsWith('{')) {
                try {
                  const action = JSON.parse(log);
                  const type = action.type || action.action;
                  if (type === 'radioactivity') {
                    hasOppAction = true;
                    const cellKey = action.cell === 'Grail Center' ? '0,0' : action.cell;
                    opponentRadioactivity.push({
                      cellKey,
                      player: action.player,
                      card: action.card
                    });
                  } else if (action.player && action.player !== myPiece) {
                    hasOppAction = true;
                    if (type === 'move' && action.from && action.to) {
                      opponentMoves.push({
                        from: action.from,
                        to: action.to,
                        count: action.count || 1,
                        player: action.player
                      });
                    } else if ((type === 'deploy' || type === 'deploy_all') && action.cellKey) {
                      const existing = opponentDeploys.find(d => d.cellKey === action.cellKey);
                      const count = action.count !== undefined ? action.count : 1;
                      if (existing) {
                        existing.count += count;
                      } else {
                        opponentDeploys.push({
                          cellKey: action.cellKey,
                          count
                        });
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              } else {
                const isRadio = log.includes('☢️') || log.toLowerCase().includes('radioactivity');
                if (isRadio) {
                  const info = parseRadioactiveText(log);
                  if (info) {
                    hasOppAction = true;
                    const cellKey = info.cell === 'Grail Center' ? '0,0' : info.cell;
                    opponentRadioactivity.push({
                      cellKey,
                      player: info.player as PlayerPiece,
                      card: info.card
                    });
                  }
                }

                const isRetreat = log.includes('🏃') || log.toLowerCase().includes('retreat');
                if (isRetreat) {
                  const info = parseRetreatText(log);
                  if (info.cell && info.retreatTo && info.defenderPiece && info.defenderCount > 0) {
                    hasOppAction = true;
                    opponentMoves.push({
                      from: info.cell,
                      to: info.retreatTo,
                      count: info.defenderCount,
                      player: info.defenderPiece as PlayerPiece,
                      isRetreat: true
                    });
                  }
                }
              }
            }
          }

          if (hasOppAction) {
            setIsReviewingLastTurn(true);
            setReviewMoves(opponentMoves);
            setReviewDeploys(opponentDeploys);
            setReviewRadioactivity(opponentRadioactivity);
          } else {
            setIsReviewingLastTurn(false);
            setReviewMoves([]);
            setReviewDeploys([]);
            setReviewRadioactivity([]);
            setLastReviewedEndTurnIdx(lastSelfEndTurnIdx);
          }
        } else {
          setIsReviewingLastTurn(false);
          setReviewMoves([]);
          setReviewDeploys([]);
          setReviewRadioactivity([]);
        }
      } else {
        setIsReviewingLastTurn(false);
        setReviewMoves([]);
        setReviewDeploys([]);
        setReviewRadioactivity([]);
      }
    }
  }, [isMyTurn, history, myPiece, winner, lastSelfEndTurnIdx, lastReviewedEndTurnIdx]);

  return {
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
  };
}
