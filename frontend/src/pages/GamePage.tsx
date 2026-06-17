import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as api from '../api/games';
import type { GameDto, PlayerPiece, UserDto, MillGameState, HolyGrailGameState } from '@vibe-games/shared';
import { MillBoard } from '../components/MillBoard';
import { ConnectFourBoard } from '../components/ConnectFourBoard';
import { HolyGrailBoard } from '../components/HolyGrailBoard';
import * as audio from '../components/AudioEffects';
import { ConfirmModal } from '../components/ConfirmModal';

const AI_BOT_IDS = [
  '00000000-0000-0000-0000-000000000000', // legacy
  '00000000-0000-0000-0000-000000000001', // Random Randy (Easy)
  '00000000-0000-0000-0000-000000000002', // Aggressive Archie (Medium)
  '00000000-0000-0000-0000-000000000003', // Defensive Debbie (Medium)
  '00000000-0000-0000-0000-000000000004', // Mobile Monty (Medium)
  '00000000-0000-0000-0000-000000000005', // Tactical Toby (Hard)
  '00000000-0000-0000-0000-000000000006', // Grandmaster Garry (Expert)
  '00000000-0000-0000-0000-000000000007', // Champion Magnus (Legendary)
  '00000000-0000-0000-0000-000000000008', // Perfect Oracle (Grandmaster)
  '00000000-0000-0000-0000-000000000009', // Random Randy (C4 Easy)
  '00000000-0000-0000-0000-000000000010', // Aggressive Archie (C4 Medium)
  '00000000-0000-0000-0000-000000000011', // Defensive Debbie (C4 Medium)
  '00000000-0000-0000-0000-000000000012', // Mobile Monty (C4 Medium)
  '00000000-0000-0000-0000-000000000013', // Tactical Toby (C4 Hard)
  '00000000-0000-0000-0000-000000000014', // Grandmaster Garry (C4 Expert)
  '00000000-0000-0000-0000-000000000015', // Champion Magnus (C4 Legendary)
  '00000000-0000-0000-0000-000000000016', // Perfect Oracle (C4 Grandmaster)
  '00000000-0000-0000-0000-000000000017', // Cowardly Connie (Easy)
  '00000000-0000-0000-0000-000000000018', // Greedy Gordon (Easy)
  '00000000-0000-0000-0000-000000000019', // Arthur the Aggressive (Easy)
  '00000000-0000-0000-0000-000000000020', // Cowardly Connie (C4 Easy)
  '00000000-0000-0000-0000-000000000021', // Greedy Gordon (C4 Easy)
  '00000000-0000-0000-0000-000000000022', // Arthur the Aggressive (C4 Easy)
  '00000000-0000-0000-0000-000000000030', // Random Randy (HG Easy)
  '00000000-0000-0000-0000-000000000031', // Aggressive Archie (HG Medium)
  '00000000-0000-0000-0000-000000000032', // Tactical Toby (HG Hard)
];

function isBotId(id?: string): boolean {
  if (!id) return false;
  return AI_BOT_IDS.includes(id);
}

function isGameAgainstAi(game?: GameDto | null): boolean {
  if (!game) return false;
  return isBotId(game.playerX?.id) || isBotId(game.playerO?.id);
}

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDto | null>(null);
  const [submittingMove, setSubmittingMove] = useState(false);
  const connectFourTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionPendingRef = useRef(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  useEffect(() => {
    return () => {
      if (connectFourTimeoutRef.current) {
        clearTimeout(connectFourTimeoutRef.current);
      }
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);



  const userId = currentUser?.id || api.getUserId();

  const getMyPiece = useCallback((g: GameDto): PlayerPiece | null => {
    if (g.playerX?.id === userId) return 'X';
    if (g.playerO?.id === userId) return 'O';
    return null;
  }, [userId]);
  // Check user session on mount with active guard to prevent unmounted double-redirect race conditions
  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const res = await api.getAuthMe();
        if (!active) return;
        if (res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('vibe-games-user-id', res.user.id);
        } else {
          navigate(`/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
        }
      } catch (err) {
        console.error('Session check failed:', err);
        if (active) {
          navigate(`/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
        }
      } finally {
        if (active) {
          setCheckingAuth(false);
        }
      }
    };
    checkSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  const fetchGame = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getGame(id);
      
      // Auto-join if the game is waiting and we are not already a player
      const alreadyInGame = data.playerX?.id === userId || data.playerO?.id === userId;
      const hasEmptySlot = data.playerX === null || data.playerO === null;
      if (data.status === 'waiting' && !alreadyInGame && hasEmptySlot) {
        try {
          const joined = await api.joinGame(id);
          setGame(joined);
          setError(null);
          return;
        } catch (joinErr) {
          console.warn('Failed to auto-join game on load:', joinErr);
        }
      }
      
      // Play game-over sound once if status changes to finished in this fetch
      if (game && game.status !== 'finished' && data.status === 'finished') {
        const myPiece = getMyPiece(data);
        if (myPiece && data.state.winner === myPiece) {
          audio.playVictorySound();
        } else if (myPiece && data.state.winner && data.state.winner !== myPiece) {
          audio.playErrorSound();
        }
      }
      
      // Play mill sound if a mill was formed and it is my turn to remove
      const oldState = game && game.gameType === 'mill' ? (game.state as MillGameState) : null;
      const newState = data.gameType === 'mill' ? (data.state as MillGameState) : null;
      if (
        data.status === 'in_progress' &&
        newState?.millFormedThisTurn &&
        newState.turn === getMyPiece(data) &&
        (!oldState || !oldState.millFormedThisTurn)
      ) {
        audio.playMillSound();
      }

      setGame(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching game details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [id, userId, game, getMyPiece]);

  // Initial game load
  useEffect(() => {
    if (checkingAuth || game) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGame();
  }, [checkingAuth, game, fetchGame]);

  // Poll game state
  useEffect(() => {
    if (checkingAuth || !id || !game) return;
    
    // Set up polling interval only if game is not finished and not an AI game
    const isAiGame = isGameAgainstAi(game);
    const isFinished = game?.status === 'finished';

    if (isFinished || isAiGame) return;

    const interval = setInterval(() => {
      if (!actionPendingRef.current) {
        fetchGame();
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, game?.status, game?.playerX?.id, game?.playerO?.id, fetchGame, checkingAuth]);

  const handleBoardAction = async (
    action: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: { position?: number; from?: string | number; to?: string | number; [key: string]: any }
  ) => {
    if (!id || submittingMove) return;
    setSubmittingMove(true);

    try {
      const updated = await api.submitMove(id, {
        action,
        ...params,
      });
      
      const oldBoard = game?.state.board;
      const newBoard = updated.state.board;
      const isAiGame = isGameAgainstAi(updated);

      console.log('[DEBUG UI Delay] Check:', {
        gameType: updated.gameType,
        isAiGame,
        oldBoardExists: !!oldBoard,
        newBoardExists: !!newBoard,
        oldBoardLen: Array.isArray(oldBoard) ? oldBoard.length : undefined,
        newBoardLen: Array.isArray(newBoard) ? newBoard.length : undefined,
        playerXId: updated.playerX?.id,
        playerOId: updated.playerO?.id,
        isPlayerXBot: updated.playerX ? isBotId(updated.playerX.id) : false,
        isPlayerOBot: updated.playerO ? isBotId(updated.playerO.id) : false,
      });

      if (updated.gameType === 'connect_four' && isAiGame && Array.isArray(oldBoard) && Array.isArray(newBoard)) {
        const newIndices: number[] = [];
        for (let i = 0; i < newBoard.length; i++) {
          if (oldBoard[i] === null && newBoard[i] !== null) {
            newIndices.push(i);
          }
        }
        console.log('[DEBUG UI Delay] Diff indices:', newIndices);
        if (newIndices.length === 2) {
          const humanPiece = getMyPiece(updated);
          const humanIndex = newIndices.find(idx => newBoard[idx] === humanPiece);
          const aiIndex = newIndices.find(idx => newBoard[idx] !== humanPiece);

          console.log('[DEBUG UI Delay] Human piece:', humanPiece, 'humanIndex:', humanIndex, 'aiIndex:', aiIndex);

          if (humanIndex !== undefined && aiIndex !== undefined) {
            const intermediateBoard = [...newBoard];
            intermediateBoard[aiIndex] = null; // Hide AI move temporarily

            const intermediateGame: GameDto = {
              ...updated,
              state: {
                ...updated.state,
                board: intermediateBoard,
                turn: updated.state.turn === 'X' ? 'O' : 'X', // Set turn back to AI
                winner: null,
              },
              status: 'in_progress',
            };

            setGame(intermediateGame);

            if (connectFourTimeoutRef.current) {
              clearTimeout(connectFourTimeoutRef.current);
            }

            connectFourTimeoutRef.current = setTimeout(() => {
              setGame(updated);
              setSubmittingMove(false);
              if (updated.status === 'finished') {
                const myPiece = getMyPiece(updated);
                if (myPiece && updated.state.winner === myPiece) {
                  audio.playVictorySound();
                } else if (myPiece && updated.state.winner && updated.state.winner !== myPiece) {
                  audio.playErrorSound();
                }
              }
            }, 1200);

            return;
          }
        }
      }

      setGame(updated);
      setSubmittingMove(false);

      // Play victory / defeat sounds
      if (updated.status === 'finished') {
        const myPiece = getMyPiece(updated);
        if (myPiece && updated.state.winner === myPiece) {
          audio.playVictorySound();
        } else if (myPiece && updated.state.winner && updated.state.winner !== myPiece) {
          audio.playErrorSound();
        }
      } else {
        // Play mill chime if a mill was newly formed
        if (updated.gameType === 'mill' && (updated.state as MillGameState).millFormedThisTurn && updated.state.turn === getMyPiece(updated)) {
          audio.playMillSound();
        }
      }
    } catch (err) {
      console.error(err);
      setSubmittingMove(false);
    }
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/game/${id}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCancelGame = () => {
    actionPendingRef.current = true;
    setShowCancelConfirm(true);
  };

  const handleForfeitGame = () => {
    actionPendingRef.current = true;
    setShowForfeitConfirm(true);
  };

  const executeCancelGame = async () => {
    console.log('[DEBUG] executeCancelGame called, game id:', id);
    if (!id) return;
    try {
      audio.playPlaceSound();
      await api.cancelGame(id);
      console.log('[DEBUG] Cancel api call success, navigating to lobby...');
      navigate('/');
    } catch (err) {
      console.error('[DEBUG] Cancel api call failed:', err);
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to cancel game');
    } finally {
      actionPendingRef.current = false;
      setShowCancelConfirm(false);
    }
  };

  const executeForfeitGame = async () => {
    console.log('[DEBUG] executeForfeitGame called, game id:', id);
    if (!id) return;
    try {
      audio.playPlaceSound();
      const updated = await api.forfeitGame(id);
      console.log('[DEBUG] Forfeit api call success, updated status:', updated.status);
      setGame(updated);
    } catch (err) {
      console.error('[DEBUG] Forfeit api call failed:', err);
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to forfeit game');
    } finally {
      actionPendingRef.current = false;
      setShowForfeitConfirm(false);
    }
  };

  if (loading || checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-indigo-500 border-neutral-800 animate-spin" />
          <p className="text-sm text-neutral-400">Loading game session...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 p-6 font-sans">
        <div className="text-rose-400 text-xl font-bold">Game Error</div>
        <p className="text-sm text-neutral-400 max-w-md text-center">
          {error || 'The game session could not be found or has expired.'}
        </p>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-sm font-semibold text-white transition-all"
        >
          Back to Lobby
        </Link>
      </div>
    );
  }

  const myPiece = getMyPiece(game);
  const isSpectator = myPiece === null;
  const opponent = myPiece === 'X' ? game.playerO : game.playerX;
  const isMyTurn = game.status === 'in_progress' && game.state.turn === myPiece && !isSpectator;
  const isAiOpponent = opponent ? isBotId(opponent.id) : false;

  // Inventory numbers (only for Mill)
  let xPlaced = 0;
  let oPlaced = 0;
  let xRem = 0;
  let oRem = 0;
  let xCaptured = 0;
  let oCaptured = 0;

  if (game.gameType === 'mill') {
    const millState = game.state as MillGameState;
    xPlaced = millState.piecesOnBoard.X;
    oPlaced = millState.piecesOnBoard.O;
    xRem = millState.placementsRemaining.X;
    oRem = millState.placementsRemaining.O;
    xCaptured = Math.max(0, 9 - xPlaced - xRem);
    oCaptured = Math.max(0, 9 - oPlaced - oRem);
  }

  // Status banner wording
  let bannerMessage = '';
  let bannerSub = '';
  if (game.status === 'waiting') {
    bannerMessage = 'Waiting for Player 2';
    bannerSub = 'Share the invite link below so they can join.';
  } else if (game.status === 'finished') {
    if (game.state.winner === 'draw') {
      bannerMessage = "It's a Draw!";
    } else {
      const winnerName =
        game.state.winner === 'X'
          ? game.playerX?.username || 'Player X'
          : game.playerO?.username || 'Player O';
      bannerMessage = `${winnerName} Wins!`;
    }
    bannerSub = 'GG! Return to the lobby to host or join another match.';
  } else if (game.status === 'in_progress') {
    if (isSpectator) {
      bannerMessage = `Spectating: Turn belongs to ${game.state.turn}`;
      bannerSub = 'Reviewing live moves in real time.';
    } else if (isMyTurn) {
      if (game.gameType === 'mill') {
        const millState = game.state as MillGameState;
        if (millState.millFormedThisTurn) {
          bannerMessage = 'Formed a Mill! 💥';
          bannerSub = 'Select any opponent piece to capture and remove it.';
        } else if (millState.phase === 'placement') {
          bannerMessage = 'Your Turn: Place Piece';
          bannerSub = `Select an empty spot. Placements left: ${myPiece === 'X' ? xRem : oRem}`;
        } else if (millState.phase === 'movement') {
          bannerMessage = 'Your Turn: Move Piece';
          bannerSub = 'Click one of your pieces, then select an adjacent empty node.';
        } else if (millState.phase === 'flying') {
          bannerMessage = 'Your Turn: Fly Piece ✈️';
          bannerSub = 'You have 3 pieces left! Move any of your pieces to ANY empty node.';
        }
      } else if (game.gameType === 'connect_four') {
        bannerMessage = 'Your Turn: Drop Piece 🔴';
        bannerSub = 'Hover and click any column to drop your piece.';
      } else if (game.gameType === 'holy_grail') {
        const grailState = game.state as HolyGrailGameState;
        if (grailState.phase === 'react') {
          bannerMessage = 'Your Turn: React to Attack! ⚔️';
          bannerSub = 'Select a contested cell (red outline) to fight or retreat.';
        } else if (grailState.phase === 'deploy') {
          bannerMessage = 'Your Turn: Deploy Units 🛖';
          bannerSub = 'Deploy cards from your hand onto your Urban housing cells or Home Base.';
        } else if (grailState.phase === 'move') {
          bannerMessage = 'Your Turn: Move Units 🛡️';
          bannerSub = 'Move stacks to adjacent cells. Stacks with Kings can transport the Grail 🏆.';
        }
      }
    } else {
      bannerMessage = `Opponent's Turn (${game.state.turn})`;
      bannerSub = isAiOpponent
        ? 'AI is calculating move...'
        : `Waiting for ${opponent?.username || 'opponent'} to submit their action.`;
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col items-center p-6 md:p-12 relative overflow-x-hidden">
      {/* Background neon elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-6xl flex flex-col gap-6 z-10">
        
        {/* Navigation Bar */}
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              onClick={() => audio.playPlaceSound()}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              ⬅️ Leave Match
            </Link>

            {game.status === 'waiting' && (game.playerX?.id === userId || game.playerO?.id === userId) && (
              <button
                type="button"
                onClick={handleCancelGame}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
              >
                Cancel Game
              </button>
            )}

            {game.status === 'in_progress' && !isSpectator && (
              <button
                type="button"
                onClick={handleForfeitGame}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
              >
                Forfeit Match
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-neutral-500 font-mono">
              Game ID: {id?.substring(0, 8)}...
            </div>
            <div className="text-[10px] text-neutral-600 font-mono">
              Your ID: {userId.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* Status Indicator Banner */}
        <div className={`p-6 rounded-2xl border backdrop-blur-md text-center flex flex-col gap-1.5 shadow-xl transition-all duration-300 ${
          game.status === 'finished'
            ? game.state.winner === 'draw'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : isMyTurn
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
        }`}>
          <h2 className="text-xl font-bold tracking-tight">{bannerMessage}</h2>
          <p className="text-xs text-neutral-400 font-medium">{bannerSub}</p>
        </div>

        {/* Game Layout Grid */}
        {game.gameType === 'holy_grail' ? (
          <div className="flex flex-col gap-6 w-full items-center mt-2">
            {/* Horizontal Player Stats Row */}
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-4xl justify-center items-stretch">
              
              {/* Player X Stats */}
              <div className="flex-1">
                <div data-testid="player-x-card" className={`p-4 rounded-2xl border h-full transition-all flex flex-col justify-between ${
                  game.status === 'in_progress' && game.state.turn === 'X'
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-neutral-900/40 border-neutral-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Player X</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {game.playerX && isBotId(game.playerX.id) ? (
                      <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-base shadow-md">
                        🤖
                      </div>
                    ) : game.playerX?.avatarUrl ? (
                      <img
                        src={game.playerX.avatarUrl}
                        alt={game.playerX.username}
                        className="w-9 h-9 rounded-full border border-neutral-800 object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                        {(game.playerX?.username || 'W').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {game.playerX?.username || 'Waiting...'}
                      </h3>
                      <span className="text-[9px] text-neutral-500">
                        Grail Rating: {game.playerX?.elo ?? 1200}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player O Stats */}
              <div className="flex-1">
                <div data-testid="player-o-card" className={`p-4 rounded-2xl border h-full transition-all flex flex-col justify-between ${
                  game.status === 'in_progress' && game.state.turn === 'O'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-neutral-900/40 border-neutral-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-rose-400 uppercase">Player O</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {game.playerO && isBotId(game.playerO.id) ? (
                      <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-base shadow-md">
                        🤖
                      </div>
                    ) : game.playerO?.avatarUrl ? (
                      <img
                        src={game.playerO.avatarUrl}
                        alt={game.playerO.username}
                        className="w-9 h-9 rounded-full border border-neutral-800 object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                        {(game.playerO?.username || 'W').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {game.playerO?.username || 'Waiting...'}
                      </h3>
                      <span className="text-[9px] text-neutral-500">
                        {game.playerO ? `Grail Rating: ${game.playerO.elo ?? 1200}` : 'Waiting...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Board Component */}
            <div className="w-full flex justify-center mt-4">
              <HolyGrailBoard
                state={game.state as HolyGrailGameState}
                myPiece={myPiece}
                disabled={game.status !== 'in_progress' || !isMyTurn || submittingMove}
                submittingMove={submittingMove}
                onAction={async (act) => {
                  await handleBoardAction(act.type, act);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mt-2">
            
            {/* Player X Stats (Left Column) */}
            <div className="col-span-12 md:col-span-6 xl:col-span-3 order-1 xl:order-none flex flex-col gap-4">
              <div data-testid="player-x-card" className={`p-5 rounded-2xl border transition-all ${
                game.status === 'in_progress' && game.state.turn === 'X'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-neutral-900/40 border-neutral-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Player X</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                </div>
                <div className="flex items-center gap-3 mt-3">
                  {game.playerX && isBotId(game.playerX.id) ? (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg shadow-md">
                      🤖
                    </div>
                  ) : game.playerX?.avatarUrl ? (
                    <img
                      src={game.playerX.avatarUrl}
                      alt={game.playerX.username}
                      className="w-10 h-10 rounded-full border border-neutral-800 object-cover shadow-md"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                      {(game.playerX?.username || 'W').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {game.playerX?.username || 'Waiting...'}
                    </h3>
                    <span className="text-[9px] text-neutral-500">
                      {game.gameType === 'mill' ? 'Morris Rating' : 'C4 Rating'}: {game.playerX?.elo ?? 1200}
                    </span>
                  </div>
                </div>
                {game.gameType === 'mill' && (
                  <div className="border-t border-neutral-800/80 pt-3 mt-3 flex flex-col gap-1.5 text-xs text-neutral-400">
                    <div className="flex justify-between">
                      <span>Placements Left:</span>
                      <span className="font-bold text-white">{xRem}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Pieces:</span>
                      <span className="font-bold text-white">{xPlaced}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pieces Lost:</span>
                      <span className="font-bold text-rose-500">{xCaptured}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive SVG Game Canvas (Middle Column) */}
            <div className="col-span-12 xl:col-span-6 order-3 xl:order-none flex flex-col items-center justify-center">
              {game.gameType === 'mill' ? (
                <MillBoard
                  board={game.state.board as (PlayerPiece | null)[]}
                  turn={game.state.turn}
                  phase={(game.state as MillGameState).phase}
                  millFormedThisTurn={(game.state as MillGameState).millFormedThisTurn}
                  currentPlayerPiece={myPiece}
                  disabled={game.status !== 'in_progress' || !isMyTurn}
                  onAction={handleBoardAction}
                />
              ) : (
                <ConnectFourBoard
                  board={game.state.board as (PlayerPiece | null)[]}
                  turn={game.state.turn}
                  currentPlayerPiece={myPiece}
                  disabled={game.status !== 'in_progress' || !isMyTurn || submittingMove}
                  onAction={(act) => handleBoardAction('place', { position: act.column })}
                />
              )}
            </div>

            {/* Player O Stats (Right Column) */}
            <div className="col-span-12 md:col-span-6 xl:col-span-3 order-2 xl:order-none flex flex-col gap-4">
              <div data-testid="player-o-card" className={`p-5 rounded-2xl border transition-all ${
                game.status === 'in_progress' && game.state.turn === 'O'
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-neutral-900/40 border-neutral-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-rose-400 uppercase">Player O</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                </div>
                <div className="flex items-center gap-3 mt-3">
                  {game.playerO && isBotId(game.playerO.id) ? (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg shadow-md">
                      🤖
                    </div>
                  ) : game.playerO?.avatarUrl ? (
                    <img
                      src={game.playerO.avatarUrl}
                      alt={game.playerO.username}
                      className="w-10 h-10 rounded-full border border-neutral-800 object-cover shadow-md"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                      {(game.playerO?.username || 'W').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {game.playerO?.username || 'Waiting...'}
                    </h3>
                    <span className="text-[9px] text-neutral-500">
                      {game.playerO ? `${game.gameType === 'mill' ? 'Morris Rating' : 'C4 Rating'}: ${game.playerO.elo ?? 1200}` : 'Waiting...'}
                    </span>
                  </div>
                </div>
                {game.gameType === 'mill' && (
                  <div className="border-t border-neutral-800/80 pt-3 mt-3 flex flex-col gap-1.5 text-xs text-neutral-400">
                    <div className="flex justify-between">
                      <span>Placements Left:</span>
                      <span className="font-bold text-white">{oRem}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Pieces:</span>
                      <span className="font-bold text-white">{oPlaced}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pieces Lost:</span>
                      <span className="font-bold text-rose-500">{oCaptured}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Invite link and sharing dashboard for waiting lobby */}
        {game.status === 'waiting' && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mt-4 backdrop-blur-md flex flex-col items-center text-center gap-3">
            <div className="text-sm font-bold text-white">Invite a Friend to Play</div>
            <p className="text-xs text-neutral-400 max-w-sm">
              Copy this link and send it to your opponent. When they open it, they will join the game as Player O.
            </p>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 w-full max-w-md justify-between font-mono text-xs">
              <span className="text-neutral-500 truncate mr-2 select-all">
                {window.location.origin}/game/{id}
              </span>
              <button
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {copied ? 'Copied! ✓' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Custom Confirmation Modals */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Cancel Game Lobby"
        message="Are you sure you want to cancel this game lobby?"
        confirmLabel="Cancel Game"
        onConfirm={executeCancelGame}
        onCancel={() => {
          actionPendingRef.current = false;
          setShowCancelConfirm(false);
        }}
      />

      <ConfirmModal
        isOpen={showForfeitConfirm}
        title="Forfeit Match"
        message="Are you sure you want to forfeit this match? This will count as a loss."
        confirmLabel="Forfeit"
        onConfirm={executeForfeitGame}
        onCancel={() => {
          actionPendingRef.current = false;
          setShowForfeitConfirm(false);
        }}
      />
    </div>
  );
}
