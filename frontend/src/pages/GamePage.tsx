import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api/games';
import type { GameDto, PlayerPiece, UserDto, MillGameState, HolyGrailGameState } from '@vibe-games/shared';
import { MillBoard } from '../components/MillBoard';
import { ConnectFourBoard } from '../components/ConnectFourBoard';
import { HolyGrailBoard } from '../components/HolyGrailBoard';
import * as audio from '../components/AudioEffects';
import { ConfirmModal } from '../components/ConfirmModal';
import { RulesModal } from '../components/RulesModal';
import { isBotId } from '../utils/botUtils';
import { GameLayout } from '../components/game/GameLayout';

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
  const [showRules, setShowRules] = useState(false);
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
        if (active) navigate(`/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
      } finally {
        if (active) setCheckingAuth(false);
      }
    };
    checkSession();
    return () => { active = false; };
  }, [navigate]);

  const fetchGame = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getGame(id);
      const alreadyInGame = data.playerX?.id === userId || data.playerO?.id === userId;
      const hasEmptySlot = data.playerX === null || data.playerO === null;
      if (data.status === 'waiting' && !alreadyInGame && hasEmptySlot) {
        try {
          const joined = await api.joinGame(id);
          setGame(joined);
          setError(null);
          return;
        } catch (joinErr) {}
      }
      if (game && game.status !== 'finished' && data.status === 'finished') {
        const myPiece = getMyPiece(data);
        if (myPiece && data.state.winner === myPiece) audio.playVictorySound();
        else if (myPiece && data.state.winner && data.state.winner !== myPiece) audio.playErrorSound();
      }
      const oldState = game && game.gameType === 'mill' ? (game.state as MillGameState) : null;
      const newState = data.gameType === 'mill' ? (data.state as MillGameState) : null;
      if (data.status === 'in_progress' && newState?.millFormedThisTurn && newState.turn === getMyPiece(data) && (!oldState || !oldState.millFormedThisTurn)) {
        audio.playMillSound();
      }
      setGame(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [id, userId, game, getMyPiece]);

  useEffect(() => {
    if (checkingAuth || game) return;
    fetchGame();
  }, [checkingAuth, game, fetchGame]);

  useEffect(() => {
    if (checkingAuth || !id || !game) return;
    const isAiGame = isGameAgainstAi(game);
    const isFinished = game?.status === 'finished';
    if (isFinished || isAiGame) return;
    const interval = setInterval(() => {
      if (!actionPendingRef.current) fetchGame();
    }, 2000);
    return () => clearInterval(interval);
  }, [id, game?.status, game?.playerX?.id, game?.playerO?.id, fetchGame, checkingAuth]);

  const handleBoardAction = async (action: string, params: any) => {
    if (!id || submittingMove) return;
    setSubmittingMove(true);
    try {
      const updated = await api.submitMove(id, { action, ...params });
      const oldBoard = game?.state.board;
      const newBoard = updated.state.board;
      const isAiGame = isGameAgainstAi(updated);

      if (updated.gameType === 'connect_four' && isAiGame && Array.isArray(oldBoard) && Array.isArray(newBoard)) {
        const newIndices: number[] = [];
        for (let i = 0; i < newBoard.length; i++) {
          if (oldBoard[i] === null && newBoard[i] !== null) newIndices.push(i);
        }
        if (newIndices.length === 2) {
          const humanPiece = getMyPiece(updated);
          const humanIndex = newIndices.find(idx => newBoard[idx] === humanPiece);
          const aiIndex = newIndices.find(idx => newBoard[idx] !== humanPiece);
          if (humanIndex !== undefined && aiIndex !== undefined) {
            const intermediateBoard = [...newBoard];
            intermediateBoard[aiIndex] = null;
            setGame({
              ...updated,
              state: { ...updated.state, board: intermediateBoard, turn: updated.state.turn === 'X' ? 'O' : 'X', winner: null },
              status: 'in_progress',
            } as GameDto);
            if (connectFourTimeoutRef.current) clearTimeout(connectFourTimeoutRef.current);
            connectFourTimeoutRef.current = setTimeout(() => {
              setGame(updated);
              setSubmittingMove(false);
              if (updated.status === 'finished') {
                const myPiece = getMyPiece(updated);
                if (myPiece && updated.state.winner === myPiece) audio.playVictorySound();
                else if (myPiece && updated.state.winner && updated.state.winner !== myPiece) audio.playErrorSound();
              }
            }, 1200);
            return;
          }
        }
      }
      setGame(updated);
      setSubmittingMove(false);
      if (updated.status === 'finished') {
        const myPiece = getMyPiece(updated);
        if (myPiece && updated.state.winner === myPiece) audio.playVictorySound();
        else if (myPiece && updated.state.winner && updated.state.winner !== myPiece) audio.playErrorSound();
      } else {
        if (updated.gameType === 'mill' && (updated.state as MillGameState).millFormedThisTurn && updated.state.turn === getMyPiece(updated)) {
          audio.playMillSound();
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Move rejected by server');
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

  const executeCancelGame = async () => {
    if (!id) return;
    try {
      audio.playPlaceSound();
      await api.cancelGame(id);
      navigate('/');
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to cancel game');
    } finally {
      actionPendingRef.current = false;
      setShowCancelConfirm(false);
    }
  };

  const executeForfeitGame = async () => {
    if (!id) return;
    try {
      audio.playPlaceSound();
      const updated = await api.forfeitGame(id);
      setGame(updated);
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to forfeit game');
    } finally {
      actionPendingRef.current = false;
      setShowForfeitConfirm(false);
    }
  };

  if (loading || checkingAuth) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center"><div className="w-10 h-10 border-2 border-t-indigo-500 rounded-full animate-spin"></div></div>;
  if (error || !game) return <div className="min-h-screen bg-neutral-950 text-white flex justify-center items-center">{error}</div>;

  const myPiece = getMyPiece(game);
  const isSpectator = myPiece === null;
  const isMyTurn = game.status === 'in_progress' && game.state.turn === myPiece && !isSpectator;

  let bannerMessage = '';
  let bannerSub = '';
  if (game.status === 'waiting') {
    bannerMessage = 'Waiting for Player 2';
    bannerSub = 'Share the invite link below so they can join.';
  } else if (game.status === 'finished') {
    if (game.state.winner === 'draw') bannerMessage = "It's a Draw!";
    else bannerMessage = `${game.state.winner === 'X' ? game.playerX?.username : game.playerO?.username} Wins!`;
    bannerSub = 'GG! Return to the lobby to host or join another match.';
  } else if (game.status === 'in_progress') {
    if (isSpectator) {
      bannerMessage = `Spectating: Turn belongs to ${game.state.turn}`;
      bannerSub = 'Reviewing live moves in real time.';
    } else if (isMyTurn) {
      if (game.gameType === 'mill') {
        const millState = game.state as MillGameState;
        if (millState.millFormedThisTurn) bannerMessage = 'Formed a Mill! 💥';
        else if (millState.phase === 'placement') bannerMessage = 'Your Turn: Place Piece';
        else if (millState.phase === 'movement') bannerMessage = 'Your Turn: Move Piece';
        else if (millState.phase === 'flying') bannerMessage = 'Your Turn: Fly Piece ✈️';
      } else if (game.gameType === 'connect_four') {
        bannerMessage = 'Your Turn: Drop Piece 🔴';
      } else if (game.gameType === 'holy_grail') {
        const grailState = game.state as HolyGrailGameState;
        if (grailState.phase === 'react') bannerMessage = 'Your Turn: React to Attack! ⚔️';
        else if (grailState.phase === 'deploy') bannerMessage = 'Your Turn: Deploy Units 🛖';
        else if (grailState.phase === 'move') bannerMessage = 'Your Turn: Move Units 🛡️';
      }
    } else {
      bannerMessage = `Opponent's Turn (${game.state.turn})`;
      bannerSub = isGameAgainstAi(game) ? 'AI is calculating move...' : `Waiting for opponent to submit their action.`;
    }
  }

  return (
    <>
      <GameLayout
        game={game}
        userId={userId}
        gameId={id!}
        isSpectator={isSpectator}
        isMyTurn={isMyTurn}
        bannerMessage={bannerMessage}
        bannerSub={bannerSub}
        onCancelGame={() => { actionPendingRef.current = true; setShowCancelConfirm(true); }}
        onForfeitGame={() => { actionPendingRef.current = true; setShowForfeitConfirm(true); }}
        onShowRules={() => setShowRules(true)}
        onCopyLink={handleCopyLink}
        copiedLink={copied}
      >
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
        ) : game.gameType === 'holy_grail' ? (
          <HolyGrailBoard
            state={game.state as HolyGrailGameState}
            myPiece={myPiece}
            disabled={game.status !== 'in_progress' || !isMyTurn || submittingMove}
            submittingMove={submittingMove}
            onAction={(act) => handleBoardAction(act.type, act)}
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
      </GameLayout>

      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Cancel Game Lobby"
        message="Are you sure you want to cancel this game lobby?"
        confirmLabel="Cancel Game"
        onConfirm={executeCancelGame}
        onCancel={() => { actionPendingRef.current = false; setShowCancelConfirm(false); }}
      />

      <ConfirmModal
        isOpen={showForfeitConfirm}
        title="Forfeit Match"
        message="Are you sure you want to forfeit this match? This will count as a loss."
        confirmLabel="Forfeit"
        onConfirm={executeForfeitGame}
        onCancel={() => { actionPendingRef.current = false; setShowForfeitConfirm(false); }}
      />

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </>
  );
}
