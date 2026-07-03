import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/games';
import { getEscapeLeaderboard } from '../api/escape';
import { type GameDto, type UserDto, type LeaderboardEntryDto, type EscapeLeaderboardEntry } from '@vibe-games/shared';
import * as audio from '../components/AudioEffects';
import { ConfirmModal } from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';

import { ActiveGamesPanel } from '../components/lobby/ActiveGamesPanel';
import { JoinByCodePanel } from '../components/lobby/JoinByCodePanel';
import { OngoingMatchesPanel } from '../components/lobby/OngoingMatchesPanel';
import { CreateGamePanel } from '../components/lobby/CreateGamePanel';
import { LobbyUserStats } from '../components/lobby/LobbyUserStats';
import { LobbyHeader } from '../components/lobby/LobbyHeader';
import { LobbyAuthBlock } from '../components/lobby/LobbyAuthBlock';
import { GameModeTabs } from '../components/lobby/GameModeTabs';
import { LobbyTabsSection } from '../components/lobby/LobbyTabsSection';
import { VersionSyncBanners } from '../components/lobby/VersionSyncBanners';
import { useVersionSync } from '../hooks/useVersionSync';
import { useGameActions } from '../hooks/useGameActions';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void | Promise<void>;
  }) => void;
  renderButton: (
    element: HTMLElement | null,
    options: { theme?: string; size?: string; width?: number }
  ) => void;
}

interface GoogleIdentity {
  accounts: {
    id: GoogleAccountsId;
  };
}

export function LobbyPage() {
  const { t } = useTranslation('lobby');
  const navigate = useNavigate();
  const [openGames, setOpenGames] = useState<GameDto[]>([]);
  const [activeGames, setActiveGames] = useState<GameDto[]>([]);
  const [ongoingGames, setOngoingGames] = useState<GameDto[]>([]);
  const [loadingLobby, setLoadingLobby] = useState(true);
  const [creatingGame, setCreatingGame] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  const [activeGameTab, setActiveGameTab] = useState<'mill' | 'connect_four' | 'holy_grail' | 'escape'>(() => {
    try {
      const saved = localStorage.getItem('vibe-games-active-tab');
      return (saved === 'mill' || saved === 'connect_four' || saved === 'holy_grail' || saved === 'escape') ? saved : 'mill';
    } catch {
      return 'mill';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vibe-games-active-tab', activeGameTab);
    } catch {
      // Ignore quota errors, etc.
    }
  }, [activeGameTab]);

  const [lobbyTab, setLobbyTab] = useState<'lobbies' | 'leaderboard'>('lobbies');

  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntryDto[]>([]);
  const [escapeLeaderboardEntries, setEscapeLeaderboardEntries] = useState<EscapeLeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const { syncStatus, backendApiVersion, backendRevision } = useVersionSync();

  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [devName, setDevName] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(() => {
    return !!(window as Window & { google?: GoogleIdentity }).google?.accounts?.id;
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = editNameVal.trim();
    if (!clean || clean.length < 3 || clean.length > 30) {
      alert('Username must be between 3 and 30 characters');
      return;
    }
    try {
      audio.playPlaceSound();
      const res = await api.updateUsername(clean);
      if (res.user) {
        setCurrentUser(res.user);
      }
      setIsEditingName(false);
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to update username');
    }
  };

  const userId = currentUser?.id || '';
  const username = currentUser?.username || 'Guest';

  // Polling for open games and user's active games
  const fetchLobby = useCallback(async () => {
    if (!currentUser) return;
    try {
      const games = await api.listGames(undefined, "waiting");
      const ongoing = await api.listGames(undefined, "in_progress");
      
      // Filter out matches created by this player (since they can't play against themselves)
      setOpenGames(games.filter((g) => g.playerX?.id !== currentUser.id && g.playerO?.id !== currentUser.id));
      setOngoingGames(ongoing);
      setLobbyError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error updating lobby';
      console.error('Failed to load lobby:', err);
      setLobbyError(errorMsg);
    } finally {
      setLoadingLobby(false);
    }

    try {
      const myGames = await api.listMyActiveGames();
      setActiveGames(myGames);
    } catch (err) {
      console.error('Failed to load active games:', err);
    }
  }, [currentUser]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    setLeaderboardError(null);
    try {
      if (activeGameTab === 'escape') {
        const data = await getEscapeLeaderboard();
        setEscapeLeaderboardEntries(data.entries);
      } else {
        const data = await api.getLeaderboard(activeGameTab as 'mill' | 'connect_four' | 'holy_grail');
        setLeaderboardEntries(data.entries);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load leaderboard';
      console.error('Failed to fetch leaderboard:', err);
      setLeaderboardError(errorMsg);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [activeGameTab]);

  useEffect(() => {
    if (lobbyTab === 'leaderboard') {
       
      fetchLeaderboard();
    }
  }, [lobbyTab, activeGameTab, fetchLeaderboard]);

  // Handle token from OAuth redirect flow (Firefox fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectToken = params.get('token');
    const authError = params.get('auth_error');

    if (authError) {
      alert(`Google login failed: ${authError}`);
      params.delete('auth_error');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    if (redirectToken) {
      localStorage.setItem('vibe-games-token', redirectToken);
      params.delete('token');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Re-check auth with the new token
      (async () => {
        try {
          const res = await api.getAuthMe();
          if (res.user) {
            setCurrentUser(res.user);
            localStorage.setItem('vibe-games-user-id', res.user.id);
          }
        } catch (err) {
          console.error('Failed to verify redirect token:', err);
        } finally {
          setCheckingAuth(false);
        }
      })();
      return; // Skip the normal session check
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await api.getAuthMe();
        if (res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('vibe-games-user-id', res.user.id);
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
     
    fetchLobby();
    const interval = setInterval(() => {
      if (!actionPendingRef.current) {
        fetchLobby();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser, fetchLobby]);

  // Handle redirect on successful login if redirect query parameter exists
  useEffect(() => {
    if (currentUser) {
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get('redirect');
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
      }
    }
  }, [currentUser, navigate]);

  // Load Google GSI client script dynamically
  useEffect(() => {
    if (currentUser || gsiLoaded) return;

    let active = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (active) {
        setGsiLoaded(true);
      }
    };
    script.onerror = () => {
      console.error('Failed to load Google Sign-In script');
    };
    document.body.appendChild(script);

    return () => {
      active = false;
      try {
        document.body.removeChild(script);
      } catch {
        // Ignore if already removed or missing
      }
    };
  }, [currentUser, gsiLoaded]);

  // Render Google Sign-In button once script is loaded and auth check is done (so container exists in DOM)
  useEffect(() => {
    if (currentUser || checkingAuth || !gsiLoaded) return;

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const google = (window as Window & { google?: GoogleIdentity }).google;
    const buttonEl = document.getElementById('google-signin-button');

    if (googleClientId && google?.accounts?.id && buttonEl) {
      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential: string }) => {
            setLoggingIn(true);
            try {
              audio.playPlaceSound();
              const authRes = await api.loginWithGoogle(response.credential);
              setCurrentUser(authRes.user);
              if (authRes.user) {
                localStorage.setItem('vibe-games-user-id', authRes.user.id);
              }
              // Store token for Safari ITP: sent as Authorization header on all requests
              if (authRes.token) {
                localStorage.setItem('vibe-games-token', authRes.token);
              }
            } catch (err) {
              audio.playErrorSound();
              alert(err instanceof Error ? err.message : 'Google Login failed');
            } finally {
              setLoggingIn(false);
            }
          },
        });
        google.accounts.id.renderButton(
          buttonEl,
          { theme: 'filled_blue', size: 'large', width: 280 }
        );
      } catch (err) {
        console.error('Failed to initialize/render Google Sign-In button:', err);
      }
    }
  }, [currentUser, checkingAuth, gsiLoaded]);

  const {
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
  } = useGameActions(fetchLobby);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devName.trim() || !devEmail.trim()) return;
    setLoggingIn(true);
    try {
      audio.playPlaceSound();
      const authRes = await api.loginMock(devName.trim(), devEmail.trim());
      setCurrentUser(authRes.user);
      if (authRes.user) {
        localStorage.setItem('vibe-games-user-id', authRes.user.id);
      }
      // Store token for Safari ITP: sent as Authorization header on all requests
      if (authRes.token) {
        localStorage.setItem('vibe-games-token', authRes.token);
      }
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Developer login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
      audio.playPlaceSound();
      await api.logout();
      setCurrentUser(null);
      localStorage.removeItem('vibe-games-user-id');
      localStorage.removeItem('vibe-games-token');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Log out failed');
    }
  };

  const handleCreateGame = async (
    vsAi = false,
    isPublic = true,
    selectedAiLevel?: string,
    aiStartsFirst?: boolean
  ) => {
    if (syncStatus === 'mismatch') {
      alert('Cannot create match: API version mismatch. Please refresh the page.');
      return;
    }
    if (creatingGame) return;
    setCreatingGame(true);
    try {
      audio.playPlaceSound();
      const newGame = await api.createGame(activeGameTab, isPublic, vsAi, selectedAiLevel as any, aiStartsFirst);
      navigate(`/game/${newGame.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setCreatingGame(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    if (syncStatus === 'mismatch') {
      alert('Cannot join match: API version mismatch. Please refresh the page.');
      return;
    }
    try {
      audio.playPlaceSound();
      const joined = await api.joinGame(gameId);
      navigate(`/game/${joined.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to join game');
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (syncStatus === 'mismatch') {
      alert('Cannot join match: API version mismatch. Please refresh the page.');
      return;
    }
    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) return;

    setJoiningCode(true);
    try {
      // First attempt to get the game to verify it exists
      const game = await api.getGame(trimmedCode);
      if (game.status === 'waiting') {
        await handleJoinGame(trimmedCode);
      } else {
        // If already in progress and the user is a player in it, just navigate
        if (game.playerX?.id === userId || game.playerO?.id === userId) {
          navigate(`/game/${trimmedCode}`);
        } else {
          throw new Error('Game is already full or finished');
        }
      }
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Invalid or unjoinable invite code');
    } finally {
      setJoiningCode(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <p className="text-sm text-neutral-400 animate-pulse">{t('checking_credentials', { defaultValue: 'Checking credentials...' })}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LobbyAuthBlock
        devName={devName}
        setDevName={setDevName}
        devEmail={devEmail}
        setDevEmail={setDevEmail}
        loggingIn={loggingIn}
        onDevLogin={handleDevLogin}
        googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col items-center p-6 md:p-12 relative overflow-hidden">
      {/* Dynamic background accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-4xl flex flex-col gap-8 z-10">
        
        {/* Header */}
        <LobbyHeader
          currentUser={currentUser}
          username={username}
          isEditingName={isEditingName}
          editNameVal={editNameVal}
          setEditNameVal={setEditNameVal}
          setIsEditingName={setIsEditingName}
          onSaveName={handleSaveName}
          onLogout={handleLogout}
        />

        {/* Version Synchronization Banners */}
        <VersionSyncBanners 
          syncStatus={syncStatus} 
          backendApiVersion={backendApiVersion} 
          backendRevision={backendRevision} 
        />

        {/* Game Mode Selector Tabs */}
        <GameModeTabs activeGameTab={activeGameTab} setActiveGameTab={setActiveGameTab} />
        {/* User Card & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <LobbyUserStats
            currentUser={currentUser!}
            activeGameTab={activeGameTab}
          />

          {/* Creation Panel */}
          <CreateGamePanel
            activeGameTab={activeGameTab}
            creatingGame={creatingGame}
            syncStatus={syncStatus}
            onCreateGame={handleCreateGame}
          />
        </div>


        {/* Active Matches Section */}
        <ActiveGamesPanel
          activeGames={activeGames}
          userId={userId}
          copiedId={copiedId}
          onCopyLink={handleCopyLink}
          onCancelGame={handleCancelGame}
          onForfeitGame={handleForfeitGame}
          onNavigate={navigate}
        />

        {/* Global Ongoing Matches (Spectate) */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-neutral-800">
            <span className="text-xl">📺</span>
            <h3 className="text-lg font-bold text-white">{t('live_matches', { defaultValue: 'Live Matches' })}</h3>
            <span className="text-xs text-neutral-500 ml-auto bg-neutral-950 px-2 py-1 rounded-md border border-neutral-800">
              {t('spectator_mode', { defaultValue: 'Spectator Mode' })}
            </span>
          </div>
          <OngoingMatchesPanel games={ongoingGames.filter(g => g.playerX?.id !== currentUser?.id && g.playerO?.id !== currentUser?.id)} onSpectate={(id) => navigate(`/game/${id}`)} />
        </div>

        {/* Lobby and Invite Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Public Lobby List */}
          <LobbyTabsSection
            activeGameTab={activeGameTab}
            lobbyTab={lobbyTab}
            setLobbyTab={setLobbyTab}
            fetchLobby={fetchLobby}
            fetchLeaderboard={fetchLeaderboard}
            lobbyError={lobbyError}
            loadingLobby={loadingLobby}
            openGames={openGames}
            syncStatus={syncStatus}
            handleJoinGame={handleJoinGame}
            leaderboardError={leaderboardError}
            loadingLeaderboard={loadingLeaderboard}
            leaderboardEntries={leaderboardEntries}
            escapeLeaderboardEntries={escapeLeaderboardEntries}
            currentUser={currentUser}
          />

          {/* Join Direct Code Card */}
          <JoinByCodePanel
            inviteCode={inviteCode}
            setInviteCode={setInviteCode}
            joiningCode={joiningCode}
            syncStatus={syncStatus}
            onJoinByCode={handleJoinByCode}
          />
        </div>
      </div>

      {/* Custom Confirmation Modals */}
      <ConfirmModal
        isOpen={cancelGameId !== null}
        title={t('cancel_game_title', { ns: 'game', defaultValue: 'Cancel Game Lobby' })}
        message={t('cancel_game_msg', { ns: 'game', defaultValue: 'Are you sure you want to cancel this game lobby?' })}
        confirmLabel={t('cancel_game_btn', { ns: 'game', defaultValue: 'Cancel Game' })}
        onConfirm={executeCancelGame}
        onCancel={() => {
          clearPendingAction();
          setCancelGameId(null);
        }}
      />

      <ConfirmModal
        isOpen={forfeitGameId !== null}
        title={t('forfeit_match_title', { ns: 'game', defaultValue: 'Forfeit Match' })}
        message={t('forfeit_match_msg', { ns: 'game', defaultValue: 'Are you sure you want to forfeit this match? This will count as a loss.' })}
        confirmLabel={t('forfeit_match_btn', { ns: 'game', defaultValue: 'Forfeit' })}
        onConfirm={executeForfeitGame}
        onCancel={() => {
          clearPendingAction();
          setForfeitGameId(null);
        }}
      />
    </div>
  );
}
