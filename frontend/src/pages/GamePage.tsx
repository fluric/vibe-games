import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api/games';
import type { GameDto, PlayerPiece, UserDto, MillGameState, GrailQuestGameState, ConnectFourGameState } from '@vibe-games/shared';
import { MillBoard } from '../components/MillBoard';
import { ConnectFourBoard } from '../components/ConnectFourBoard';
import { GrailQuestBoard } from '../components/GrailQuestBoard';
import { ReversiBoard } from '../components/ReversiBoard';
import * as audio from '../components/AudioEffects';
import { ConfirmModal } from '../components/ConfirmModal';
import { RulesModal } from '../components/RulesModal';
import { isBotId } from '../utils/botUtils';
import { GameLayout } from '../components/game/GameLayout';
import { useTranslation } from 'react-i18next';

function isGameAgainstAi(game?: GameDto | null): boolean {
  if (!game) return false;
  return isBotId(game.playerX?.id) || isBotId(game.playerO?.id);
}

export function GamePage() {
  const { t } = useTranslation('game');
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
      } catch (err: unknown) {
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
        } catch (joinErr: unknown) {}
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
    } catch (err: unknown) {
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
    const isFinished = game?.status === 'finished';
    if (isFinished) return;
    const interval = setInterval(() => {
      if (!actionPendingRef.current) fetchGame();
    }, 2000);
    return () => clearInterval(interval);
  }, [id, game?.status, game?.playerX?.id, game?.playerO?.id, fetchGame, checkingAuth]);

  const handleBoardAction = async (action: string, params: unknown) => {
    if (!id || submittingMove) return;
    setSubmittingMove(true);
    try {
      const updated = await api.submitMove(id, { action, ...(params as Record<string, unknown>) });
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    bannerMessage = t('waiting_for_opponent', { defaultValue: 'Waiting for opponent to join...' });
    bannerSub = t('share_invite_link', { defaultValue: 'Share the invite link below so they can join.' });
  } else if (game.status === 'finished') {
    if (game.state.winner === 'draw') bannerMessage = t('draw', { defaultValue: "It's a Draw!" });
    else bannerMessage = t('winner', { defaultValue: '{{winner}} Wins!', winner: game.state.winner === 'X' ? game.playerX?.username : game.playerO?.username });
    bannerSub = t('gg_return', { defaultValue: 'GG! Return to the lobby to host or join another match.' });
  } else if (game.status === 'in_progress') {
    if (isSpectator) {
      bannerMessage = t('spectating_turn', { defaultValue: 'Spectating: Turn belongs to {{turn}}', turn: game.state.turn });
      bannerSub = t('reviewing_live', { defaultValue: 'Reviewing live moves in real time.' });
    } else if (isMyTurn) {
      if (game.gameType === 'mill') {
        const millState = game.state as MillGameState;
        if (millState.millFormedThisTurn) bannerMessage = t('mill_formed', { defaultValue: 'Formed a Mill! 💥' });
        else if (millState.phase === 'placement') bannerMessage = t('your_turn_place', { defaultValue: 'Your Turn: Place Piece' });
        else if (millState.phase === 'movement') bannerMessage = t('your_turn_move', { defaultValue: 'Your Turn: Move Piece' });
        else if (millState.phase === 'flying') bannerMessage = t('your_turn_fly', { defaultValue: 'Your Turn: Fly Piece ✈️' });
      } else if (game.gameType === 'connect_four') {
        bannerMessage = t('your_turn_drop', { defaultValue: 'Your Turn: Drop Piece' });
      } else if (game.gameType === 'grail_quest') {
        const grailState = game.state as GrailQuestGameState;
        if (grailState.phase === 'react') bannerMessage = t('your_turn_react', { defaultValue: 'Your Turn: React to Attack! ⚔️' });
        else if (grailState.phase === 'deploy') bannerMessage = t('your_turn_deploy', { defaultValue: 'Your Turn: Deploy Units 🛖' });
        else if (grailState.phase === 'move') bannerMessage = t('your_turn_move_units', { defaultValue: 'Your Turn: Move Units 🛡️' });
      } else if (game.gameType === 'reversi') {
        bannerMessage = t('your_turn_place_reversi', { defaultValue: 'Your Turn: Place Disc' });
      }
    } else {
      bannerMessage = t('opponents_turn', { defaultValue: 'Opponent\'s Turn ({{turn}})', turn: game.state.turn });
      bannerSub = isGameAgainstAi(game) ? 'AI is calculating move...' : t('waiting_for_action', { defaultValue: 'Waiting for opponent to submit their action.' });
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
            positionHistory={(game.state as MillGameState).positionHistory}
            currentPlayerPiece={myPiece}
            disabled={game.status !== 'in_progress' || !isMyTurn}
            onAction={handleBoardAction}
          />
        ) : game.gameType === 'grail_quest' || (game.gameType as string) === 'holy_grale' ? (
          <GrailQuestBoard
            state={game.state as GrailQuestGameState}
            myPiece={myPiece}
            disabled={game.status !== 'in_progress' || !isMyTurn || submittingMove}
            submittingMove={submittingMove}
            onAction={(act) => handleBoardAction(act.type, act)}
          />
        ) : game.gameType === 'reversi' ? (
          <ReversiBoard
            board={game.state.board as (PlayerPiece | null)[]}
            turn={game.state.turn}
            lastMoveIndex={(game.state as any).lastMoveIndex}
            currentPlayerPiece={myPiece}
            disabled={game.status !== 'in_progress' || !isMyTurn || submittingMove}
            onAction={(act) => handleBoardAction(act.action, { position: act.position })}
          />
        ) : game.gameType === 'connect_four' ? (
          <ConnectFourBoard
            board={game.state.board as (PlayerPiece | null)[]}
            turn={game.state.turn}
            lastMoveIndex={(game.state as ConnectFourGameState).lastMoveIndex}
            currentPlayerPiece={myPiece}
            disabled={game.status !== 'in_progress' || !isMyTurn || submittingMove}
            onAction={(act) => handleBoardAction('place', { position: act.column })}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-neutral-400">
            Unknown game mode: {game.gameType}
          </div>
        )}
      </GameLayout>

      <ConfirmModal
        isOpen={showCancelConfirm}
        title={t('cancel_game_title', { defaultValue: 'Cancel Game Lobby' })}
        message={t('cancel_game_msg', { defaultValue: 'Are you sure you want to cancel this game lobby?' })}
        confirmLabel={t('cancel_game_btn', { defaultValue: 'Cancel Game' })}
        onConfirm={executeCancelGame}
        onCancel={() => { actionPendingRef.current = false; setShowCancelConfirm(false); }}
      />

      <ConfirmModal
        isOpen={showForfeitConfirm}
        title={t('forfeit_match_title', { defaultValue: 'Forfeit Match' })}
        message={t('forfeit_match_msg', { defaultValue: 'Are you sure you want to forfeit this match? This counts as a loss and your ELO will be updated.' })}
        confirmLabel={t('forfeit_match_btn', { defaultValue: 'Forfeit Match' })}
        onConfirm={executeForfeitGame}
        onCancel={() => { actionPendingRef.current = false; setShowForfeitConfirm(false); }}
      />

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </>
  );
}
