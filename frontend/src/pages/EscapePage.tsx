import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../components/escape/escape.css';
import { getEscapeProgress, solveRoom } from '../api/escape';
import { getAuthMe } from '../api/games';
import { useEscapeRooms } from '../data/escapeRooms';
import type { EscapeRoomProgressDto } from '@vibe-games/shared';

import { RoomSelect } from '../components/escape/RoomSelect';
import { RoomScene } from '../components/escape/RoomScene';
import { HudBar } from '../components/escape/HudBar';
import { DoorUnlock } from '../components/escape/DoorUnlock';
import { EscapeLeaderboard } from '../components/escape/EscapeLeaderboard';
import { KeypadPuzzle } from '../components/escape/puzzles/KeypadPuzzle';
import { CipherWheelPuzzle } from '../components/escape/puzzles/CipherWheelPuzzle';
import { FuseBoxPuzzle } from '../components/escape/puzzles/FuseBoxPuzzle';
import { ImageKeypadPuzzle } from '../components/escape/puzzles/ImageKeypadPuzzle';

import { useTranslation } from 'react-i18next';

export function EscapePage() {
  const { t } = useTranslation('escape');
  const escapeRooms = useEscapeRooms();
  const navigate = useNavigate();
  const { roomId: roomIdParam } = useParams<{ roomId?: string }>();
  const roomId = roomIdParam ? parseInt(roomIdParam, 10) : null;

  const [progress, setProgress] = useState<EscapeRoomProgressDto[]>([]);
  const [roomsCleared, setRoomsCleared] = useState(0);
  const [loading, setLoading] = useState(true);
  const [doorOpen, setDoorOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Auth guard + progress load
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await getAuthMe();
        if (!active) return;
        if (!auth.user) {
          navigate(`/?redirect=${encodeURIComponent('/escape')}`, { replace: true });
          return;
        }
        const prog = await getEscapeProgress();
        if (!active) return;
        setProgress(prog.rooms);
        setRoomsCleared(prog.roomsCleared);
      } catch {
        if (active) navigate('/', { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  // Gate: if roomId > maxAccessible, redirect to the correct one
  useEffect(() => {
    if (loading || roomId === null) return;
    const maxAccessible = roomsCleared + 1;
    if (roomId > maxAccessible || roomId < 1 || roomId > escapeRooms.length) {
      navigate(`/escape/${maxAccessible}`, { replace: true });
    }
  }, [loading, roomId, roomsCleared, navigate]);

  // Called when a puzzle is solved
  const handlePuzzleSolved = useCallback(async () => {
    if (roomId === null) return;
    try {
      await solveRoom(roomId);
      // Refetch progress to get authoritative server state
      const fresh = await getEscapeProgress();
      setProgress(fresh.rooms);
      setRoomsCleared(fresh.roomsCleared);
    } catch {
      // Silently continue — puzzle was solved locally
    }
    setDoorOpen(true);
  }, [roomId]);

  // After door animation: navigate back to select (or leaderboard if all done)
  const handleDoorComplete = useCallback(() => {
    setDoorOpen(false);
    const justCleared = (roomId ?? 0);
    if (justCleared >= escapeRooms.length) {
      // All rooms done — show leaderboard
      navigate('/escape', { replace: true });
      setShowLeaderboard(true);
    } else {
      navigate('/escape', { replace: true });
    }
  }, [navigate, roomId]);

  if (loading) {
    return (
      <div className="escape-loading-screen">
        <div className="escape-loading-spinner" />
        <p>{t('ui_loading', { defaultValue: 'Loading…' })}</p>
      </div>
    );
  }

  const maxAccessible = Math.min(roomsCleared + 1, escapeRooms.length);

  // ── Active room view ───────────────────────────────────────────────────────
  if (roomId !== null) {
    const room = escapeRooms.find((r) => r.id === roomId);
    if (!room) return null;

    const renderPuzzle = () => {
      switch (room.config.puzzleType) {
        case 'keypad':
          return <KeypadPuzzle config={room.config} onSolved={handlePuzzleSolved} />;
        case 'cipher':
          return <CipherWheelPuzzle config={room.config} onSolved={handlePuzzleSolved} />;
        case 'fuse':
          return <FuseBoxPuzzle config={room.config} onSolved={handlePuzzleSolved} />;
        case 'image_keypad':
          return <ImageKeypadPuzzle config={room.config} onSolved={handlePuzzleSolved} />;
      }
    };

    return (
      <div className="escape-page">
        <HudBar
          currentRoomId={roomId}
          roomsCleared={roomsCleared}
          onBack={() => navigate('/escape')}
        />
        <RoomScene room={room}>
          {renderPuzzle()}
        </RoomScene>
        <DoorUnlock isOpen={doorOpen} onComplete={handleDoorComplete} />
      </div>
    );
  }

  // ── Room select view ───────────────────────────────────────────────────────
  return (
    <div className="escape-page">
      <nav className="escape-nav">
        <button className="escape-nav-back" onClick={() => navigate('/')} id="escape-back-to-lobby">
          ← {t('ui_back_to_lobby', { defaultValue: 'Back to Lobby' })}
        </button>
        <button
          className={`escape-nav-tab${showLeaderboard ? ' active' : ''}`}
          onClick={() => setShowLeaderboard((v) => !v)}
          id="escape-leaderboard-toggle"
        >
          🏆 {t('ui_leaderboard', { defaultValue: 'Leaderboard' })}
        </button>
      </nav>

      {showLeaderboard ? (
        <EscapeLeaderboard />
      ) : (
        <RoomSelect
          rooms={escapeRooms}
          progress={progress}
          maxAccessible={maxAccessible}
          onSelectRoom={(id) => navigate(`/escape/${id}`)}
        />
      )}
    </div>
  );
}
