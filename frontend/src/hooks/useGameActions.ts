import { useState, useRef } from 'react';
import * as api from '../api/games';
import * as audio from '../components/AudioEffects';

export function useGameActions(fetchLobby: () => Promise<void>) {
  const actionPendingRef = useRef(false);
  const [cancelGameId, setCancelGameId] = useState<string | null>(null);
  const [forfeitGameId, setForfeitGameId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCancelGame = (gameId: string) => {
    actionPendingRef.current = true;
    setCancelGameId(gameId);
  };

  const handleForfeitGame = (gameId: string) => {
    actionPendingRef.current = true;
    setForfeitGameId(gameId);
  };

  const executeCancelGame = async () => {
    if (!cancelGameId) return;
    try {
      audio.playPlaceSound();
      await api.cancelGame(cancelGameId);
      await fetchLobby();
    } catch (err) {
      audio.playErrorSound();
      console.error('[DEBUG] Lobby cancel failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel game');
    } finally {
      actionPendingRef.current = false;
      setCancelGameId(null);
    }
  };

  const executeForfeitGame = async () => {
    if (!forfeitGameId) return;
    try {
      audio.playPlaceSound();
      await api.forfeitGame(forfeitGameId);
      await fetchLobby();
    } catch (err) {
      audio.playErrorSound();
      console.error('[DEBUG] Lobby forfeit failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to forfeit game');
    } finally {
      actionPendingRef.current = false;
      setForfeitGameId(null);
    }
  };

  const handleCopyLink = (gameId: string) => {
    const url = `${window.location.origin}/game/${gameId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(gameId);
    audio.playPlaceSound();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearPendingAction = () => {
    actionPendingRef.current = false;
  };

  return {
    cancelGameId,
    setCancelGameId,
    forfeitGameId,
    setForfeitGameId,
    copiedId,
    actionPendingRef,
    handleCancelGame,
    handleForfeitGame,
    executeCancelGame,
    executeForfeitGame,
    handleCopyLink,
    clearPendingAction,
  };
}
