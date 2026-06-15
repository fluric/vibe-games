import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../api/games';
import { API_VERSION, type GameDto, type UserDto, type LeaderboardEntryDto } from '@vibe-games/shared';
import * as audio from '../components/AudioEffects';
import aiConfig from '../../../backend/src/game/aiConfig.json';

const BOT_DESCRIPTIONS: Record<string, Record<string, string>> = {
  mill: {
    easy_random: "Random Play",
    easy_cowardly: "Blocked-Avoidance & Defense",
    easy_greedy: "Material Hunter",
    easy_aggressive: "Mill Hunter",
    medium_aggressive: "Material & Mills",
    medium_defensive: "Threat Blocking",
    medium_mobile: "Piece Mobility",
    hard_tactical: "Minimax Depth 4",
    expert_garry: "Minimax Depth 5",
    legendary_magnus: "Minimax Depth 6",
    perfect_oracle: "Solved Openings & Positional Search",
  },
  connect_four: {
    easy_random: "Random Play",
    medium_aggressive: "Center Control & Openings",
    medium_defensive: "Defensive Blocking",
    medium_mobile: "Spaced Alignment",
    hard_tactical: "Minimax Depth 4",
    expert_garry: "Minimax Depth 5",
    legendary_magnus: "Minimax Depth 6",
    perfect_oracle: "Center Alignment Search",
  }
};

const BOT_EMOJIS: Record<string, Record<string, string>> = {
  mill: {
    easy_random: "🟢",
    easy_cowardly: "🟢",
    easy_greedy: "🟢",
    easy_aggressive: "🟢",
    medium_aggressive: "🟡",
    medium_defensive: "🟡",
    medium_mobile: "🟡",
    hard_tactical: "🔴",
    expert_garry: "🔥",
    legendary_magnus: "👑",
    perfect_oracle: "🌌",
  },
  connect_four: {
    easy_random: "🟢",
    medium_aggressive: "🟡",
    medium_defensive: "🟡",
    medium_mobile: "🟡",
    hard_tactical: "🔴",
    expert_garry: "🔥",
    legendary_magnus: "👑",
    perfect_oracle: "🌌",
  }
};

const BOT_HELP_TEXT: Record<string, Record<string, string>> = {
  mill: {
    easy_random: "Randy plays completely random moves. Great for absolute beginners.",
    easy_cowardly: "Connie searches shallowly and hates getting blocked. Easy to maneuver around.",
    easy_greedy: "Gordon values material over safety. Trappable by planning ahead.",
    easy_aggressive: "Arthur pursues mill structures single-mindedly, often leaving his own pieces exposed.",
    medium_aggressive: "Archie uses 3 plies of search prioritizing making mills and material count.",
    medium_defensive: "Debbie searches 3 plies deep prioritizing blocking opponent threats.",
    medium_mobile: "Monty searches 3 plies deep prioritizing keeping his own pieces free.",
    hard_tactical: "Toby calculates 4 plies ahead. He will punish tactical mistakes.",
    expert_garry: "Garry evaluates 5 plies deep with optimized positional heuristics. A true challenge!",
    legendary_magnus: "Magnus calculates 6 plies deep with extremely optimized weights. Legendary level!",
    perfect_oracle: "The Oracle uses deep positional evaluation and solved center column openings for maximum control.",
  },
  connect_four: {
    easy_random: "Randy plays completely random moves. Great for absolute beginners.",
    medium_aggressive: "Archie searches 3 plies deep, prioritizing connecting pieces and center column alignment.",
    medium_defensive: "Debbie searches 3 plies deep, focusing on blocking opponent 3-in-a-row threats.",
    medium_mobile: "Monty searches 3 plies deep, focusing on maintaining flexible, non-blocked connections.",
    hard_tactical: "Toby calculates 4 plies ahead, focusing on blocking and creating alignment traps.",
    expert_garry: "Garry evaluates 5 plies deep with optimized positional heuristics. A true challenge!",
    legendary_magnus: "Magnus calculates 6 plies deep with extremely optimized weights. Legendary level!",
    perfect_oracle: "The Oracle uses deep positional evaluation and center column search for maximum control.",
  }
};

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
  const navigate = useNavigate();
  const [openGames, setOpenGames] = useState<GameDto[]>([]);
  const [activeGames, setActiveGames] = useState<GameDto[]>([]);
  const [loadingLobby, setLoadingLobby] = useState(true);
  const [creatingGame, setCreatingGame] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiLevel, setAiLevel] = useState<'easy_random' | 'easy_cowardly' | 'easy_greedy' | 'easy_aggressive' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle'>('medium_aggressive');
  const [aiStarts, setAiStarts] = useState<boolean>(false);

  const [lobbyTab, setLobbyTab] = useState<'lobbies' | 'leaderboard'>('lobbies');
  const [activeGameTab, setActiveGameTab] = useState<'mill' | 'connect_four'>('mill');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntryDto[]>([]);
  const filteredLobbies = openGames.filter((g) => g.gameType === activeGameTab);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'warn' | 'mismatch'>('synced');
  const [backendApiVersion, setBackendApiVersion] = useState<string | null>(null);
  const [backendRevision, setBackendRevision] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [devName, setDevName] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(() => {
    return !!(window as Window & { google?: GoogleIdentity }).google?.accounts?.id;
  });

  const userId = currentUser?.id || '';
  const username = currentUser?.username || 'Guest';

  const checkVersionSync = useCallback(async () => {
    let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
      rawApiUrl = `https://${rawApiUrl}`;
    }
    try {
      const res = await fetch(`${rawApiUrl}/health`);
      if (!res.ok) throw new Error('Health check request failed');
      const data = await res.json();
      
      const frontendRevision = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'development';
      const frontendApiVersion = API_VERSION;
      
      setBackendApiVersion(data.apiVersion || null);
      setBackendRevision(data.revision || null);

      if (data.apiVersion !== frontendApiVersion) {
        setSyncStatus('mismatch');
      } else if (data.revision !== frontendRevision) {
        setSyncStatus('warn');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Failed to run version sync check:', err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkVersionSync();
  }, [checkVersionSync]);

  useEffect(() => {
    if (syncStatus === 'synced') return;
    const intervalTime = syncStatus === 'mismatch' ? 15000 : 30000;
    const interval = setInterval(checkVersionSync, intervalTime);
    return () => clearInterval(interval);
  }, [syncStatus, checkVersionSync]);

  // Polling for open games and user's active games
  const fetchLobby = useCallback(async () => {
    if (!currentUser) return;
    try {
      const games = await api.listOpenGames();
      // Filter out matches created by this player (since they can't play against themselves)
      setOpenGames(games.filter((g) => g.playerX?.id !== currentUser.id));
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
      const data = await api.getLeaderboard(activeGameTab);
      setLeaderboardEntries(data.entries);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchLeaderboard();
    }
  }, [lobbyTab, activeGameTab, fetchLeaderboard]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLobby();
    const interval = setInterval(fetchLobby, 3000);
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

    if (googleClientId && google && buttonEl) {
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

  const handleCancelGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to cancel this game lobby?')) return;
    try {
      audio.playPlaceSound();
      await api.cancelGame(gameId);
      await fetchLobby();
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to cancel game');
    }
  };

  const handleForfeitGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to forfeit this match? This will count as a loss.')) return;
    try {
      audio.playPlaceSound();
      await api.forfeitGame(gameId);
      await fetchLobby();
    } catch (err) {
      audio.playErrorSound();
      alert(err instanceof Error ? err.message : 'Failed to forfeit game');
    }
  };

  const handleCopyLink = (gameId: string) => {
    const url = `${window.location.origin}/game/${gameId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(gameId);
    audio.playPlaceSound();
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    selectedAiLevel?: 'easy' | 'medium' | 'hard' | 'easy_random' | 'easy_cowardly' | 'easy_greedy' | 'easy_aggressive' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle'
  ) => {
    if (syncStatus === 'mismatch') {
      alert('Cannot create match: API version mismatch. Please refresh the page.');
      return;
    }
    if (creatingGame) return;
    setCreatingGame(true);
    try {
      audio.playPlaceSound();
      const newGame = await api.createGame(activeGameTab, isPublic, vsAi, selectedAiLevel, vsAi ? aiStarts : false);
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
          <p className="text-sm text-neutral-400 animate-pulse">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const showMockForm = !import.meta.env.PROD || import.meta.env.VITE_ALLOW_MOCK_AUTH === 'true';

    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex items-center justify-center p-6 relative overflow-hidden">
        {/* Glowing background circles */}
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

        <div className="w-full max-w-sm bg-neutral-900/60 border border-neutral-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl flex flex-col gap-6 z-10">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400 bg-clip-text text-transparent tracking-tight">
              Vibe Games
            </h1>
            <p className="text-neutral-400 text-xs mt-2">
              Sign in to host lobbies, play vs AI, or challenge friends
            </p>
          </div>

          {googleClientId ? (
            <div className="flex flex-col items-center gap-4 py-2 border-b border-neutral-800/60 pb-6 last:border-0 last:pb-0">
              <div id="google-signin-button" className="transition-transform active:scale-[0.98]" />
            </div>
          ) : null}

          {showMockForm ? (
            <form onSubmit={handleDevLogin} className="flex flex-col gap-4 pt-2 border-t border-neutral-800/60 first:border-0 first:pt-0">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {googleClientId ? 'Or Sign In with Mock Account' : 'Developer Guest Account'}
                </span>
                <p className="text-[11px] text-neutral-500 mb-1">
                  Enter any name and email to play instantly.
                </p>
                <input
                  type="text"
                  placeholder="Developer Name"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all font-sans"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  type="email"
                  placeholder="developer@vibegames.local"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn || !devName.trim() || !devEmail.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-[0.98]"
              >
                {loggingIn ? 'Authenticating...' : 'Enter Vibe Games'}
              </button>
            </form>
          ) : !googleClientId ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center leading-normal">
              🔒 Authentication is not configured. Please configure a Google Client ID in settings to enable sign-in.
            </div>
          ) : null}
        </div>
      </div>
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400 bg-clip-text text-transparent">
              Vibe Games
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Select a game and challenge players in real time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/status"
              className="text-xs px-3.5 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-medium transition-all"
            >
              System Health
            </Link>
            {currentUser && (
              <button
                onClick={handleLogout}
                className="text-xs px-3.5 py-2 rounded-lg bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900/40 text-rose-400 font-medium transition-all active:scale-95"
              >
                Log Out
              </button>
            )}
          </div>
        </div>

        {/* Version Synchronization Banners */}
        {syncStatus === 'mismatch' && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-rose-500/5">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚨</span>
              <div>
                <p className="font-bold">Critical version mismatch detected</p>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  The server has been updated with a newer API version (v{backendApiVersion || '?'}). Please refresh the page to update your client.
                </p>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 active:scale-95 whitespace-nowrap self-start sm:self-auto"
            >
              Refresh Page
            </button>
          </div>
        )}

        {syncStatus === 'warn' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-3 shadow-lg shadow-amber-500/5">
            <span className="text-xl">⚙️</span>
            <div>
              <p className="font-bold">System update in progress</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                The background system is being updated (running version {backendRevision?.substring(0, 7) || '?'}). Gameplay remains active.
              </p>
            </div>
          </div>
        )}

        {/* Game Mode Selector Tabs */}
        <div className="flex bg-neutral-900/60 border border-neutral-800 p-1.5 rounded-2xl gap-2 w-full max-w-md mx-auto shadow-lg backdrop-blur-md">
          <button
            onClick={() => setActiveGameTab('mill')}
            className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
              activeGameTab === 'mill'
                ? 'bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.4)] text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
            }`}
          >
            🎮 Nine Men's Morris
          </button>
          <button
            onClick={() => setActiveGameTab('connect_four')}
            className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
              activeGameTab === 'connect_four'
                ? 'bg-rose-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
            }`}
          >
            🔴 Connect Four
          </button>
        </div>

        {/* User Card & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Active Player</span>
                <h2 className="text-xl font-bold mt-1 text-white">{username}</h2>
                <p className="text-xs text-neutral-500 font-mono mt-1 select-all">{userId.substring(0, 8)}...</p>
              </div>
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={username}
                  className="w-12 h-12 rounded-full border border-neutral-800 object-cover shadow-lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-lg">
                  {username.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="border-t border-neutral-800 pt-4 mt-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-400">Nine Men's Morris Rating:</span>
                <span className="font-bold text-indigo-400">{currentUser?.elo ?? 1200} ELO</span>
              </div>
              <div className="flex gap-4 text-xs text-neutral-500 mt-2">
                <span>Wins: <strong className="text-emerald-400">{currentUser?.wins ?? 0}</strong></span>
                <span>Losses: <strong className="text-rose-500">{currentUser?.losses ?? 0}</strong></span>
                <span>Draws: <strong className="text-neutral-400">{currentUser?.draws ?? 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Creation Panel */}
          <div className="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-5 justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Create a New Match</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Launch a match of Nine Men's Morris ("Mill") immediately.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 bg-neutral-950/40 border border-neutral-800/80 rounded-2xl p-4 w-full">
                <label htmlFor="ai-bot-select" className="text-xs text-neutral-400 font-semibold">
                  Select AI Opponent:
                </label>
                <select
                  id="ai-bot-select"
                  value={aiLevel}
                  onChange={(e) => setAiLevel(e.target.value as typeof aiLevel)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                >
                  {Object.entries((aiConfig as any)[activeGameTab] || (aiConfig as any).mill).map(([key, bot]: [string, any]) => (
                    <option key={key} value={key}>
                      {BOT_EMOJIS[activeGameTab]?.[key] || "🤖"} {bot.username} — ELO {bot.elo} [{BOT_DESCRIPTIONS[activeGameTab]?.[key] || "AI Bot"}]
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  {BOT_HELP_TEXT[activeGameTab]?.[aiLevel] || "AI Bot will calculate moves based on difficulty."}
                </p>

                <div className="border-t border-neutral-800/80 my-2"></div>

                <label className="text-xs text-neutral-400 font-semibold">
                  Who Starts the Game?
                </label>
                <div className="flex gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setAiStarts(false)}
                    className={`flex-1 py-2 text-xs rounded-xl font-semibold border transition-all ${
                      !aiStarts
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    👤 You Start (First)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiStarts(true)}
                    className={`flex-1 py-2 text-xs rounded-xl font-semibold border transition-all ${
                      aiStarts
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    🤖 AI Starts (First)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => handleCreateGame(true, false, aiLevel)}
                  disabled={creatingGame || syncStatus === 'mismatch'}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    🤖
                  </div>
                  <span className="font-bold text-xs text-white">Play vs AI</span>
                  <span className="text-[10px] text-neutral-500 text-center">Practice offline</span>
                </button>

              <button
                onClick={() => handleCreateGame(false, true)}
                disabled={creatingGame || syncStatus === 'mismatch'}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  🌍
                </div>
                <span className="font-bold text-xs text-white">Host Public</span>
                <span className="text-[10px] text-neutral-500 text-center">List in public lobby</span>
              </button>

              <button
                onClick={() => handleCreateGame(false, false)}
                disabled={creatingGame || syncStatus === 'mismatch'}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                  🔗
                </div>
                <span className="font-bold text-xs text-white">Host Private</span>
                <span className="text-[10px] text-neutral-500 text-center">Share direct link</span>
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Active Matches Section */}
        {activeGames.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              Your Active Matches
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeGames.map((game) => {
                const isCreator = game.playerX?.id === userId;
                const opponentName = isCreator
                  ? (game.playerO?.username || 'Waiting for opponent...')
                  : (game.playerX?.username || 'Unknown Player');
                const isWaiting = game.status === 'waiting';
                const myPiece = isCreator ? 'X' : 'O';
                const isMyTurn = game.state.turn === myPiece;

                return (
                  <div
                    key={game.id}
                    className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all gap-4"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-300">
                          {isWaiting ? (
                            <span className="text-indigo-400">Hosting {game.isPublic ? 'Public' : 'Private'} Lobby</span>
                          ) : (
                            <span>vs {opponentName}</span>
                          )}
                        </span>
                        {!isWaiting && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isMyTurn
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50'
                            }`}
                          >
                            {isMyTurn ? '🟢 Your Turn' : '🕒 Opponent Turn'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-1">
                        ID: {game.id.substring(0, 8)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isWaiting ? (
                        <>
                          <button
                            onClick={() => handleCopyLink(game.id)}
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 transition-all border border-neutral-700/50 hover:border-neutral-600 active:scale-95 flex items-center gap-1"
                          >
                            {copiedId === game.id ? '✓ Copied' : '🔗 Copy Link'}
                          </button>
                          <button
                            onClick={() => handleCancelGame(game.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/game/${game.id}`)}
                            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
                          >
                            Resume Match
                          </button>
                          <button
                            onClick={() => handleForfeitGame(game.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
                          >
                            Forfeit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lobby and Invite Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Public Lobby List */}
          <div className="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
            {/* Tabs Header */}
            <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
              <div className="flex gap-4">
                <button
                  onClick={() => setLobbyTab('lobbies')}
                  className={`text-sm font-bold transition-colors pb-2 border-b-2 ${
                    lobbyTab === 'lobbies'
                      ? 'text-white border-indigo-500'
                      : 'text-neutral-400 border-transparent hover:text-white'
                  }`}
                >
                  🌍 Active Lobbies
                </button>
                <button
                  onClick={() => setLobbyTab('leaderboard')}
                  className={`text-sm font-bold transition-colors pb-2 border-b-2 ${
                    lobbyTab === 'leaderboard'
                      ? 'text-white border-indigo-500'
                      : 'text-neutral-400 border-transparent hover:text-white'
                  }`}
                >
                  🏆 ELO Leaderboard
                </button>
              </div>

              {lobbyTab === 'lobbies' ? (
                <button
                  onClick={fetchLobby}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  🔄 Refresh Lobbies
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={activeGameTab}
                    onChange={(e) => setActiveGameTab(e.target.value as 'mill' | 'connect_four')}
                    className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-neutral-700 font-medium"
                  >
                    <option value="mill">Nine Men's Morris</option>
                    <option value="connect_four">Connect Four</option>
                  </select>
                  <button
                    onClick={fetchLeaderboard}
                    className="text-xs text-neutral-400 hover:text-white transition-colors"
                  >
                    🔄 Refresh
                  </button>
                </div>
              )}
            </div>

            {lobbyTab === 'lobbies' ? (
              <>
                {lobbyError && (
                  <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400">
                    {lobbyError}
                  </div>
                )}

                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {loadingLobby ? (
                    <div className="text-center py-8 text-neutral-500 text-sm">
                      Loading lobbies...
                    </div>
                  ) : filteredLobbies.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-sm">
                      No public games waiting. Create a game above to start!
                    </div>
                  ) : (
                    filteredLobbies.map((game) => (
                      <div
                        key={game.id}
                        className="flex justify-between items-center p-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all"
                      >
                        <div>
                          <div className="text-xs font-semibold text-neutral-300">
                            {game.playerX?.username || 'Unknown Player'}'s Game
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            ID: {game.id.substring(0, 8)}...
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinGame(game.id)}
                          disabled={syncStatus === 'mismatch'}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none text-xs font-bold text-white transition-colors active:scale-95"
                        >
                          Join Match
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {leaderboardError && (
                  <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400">
                    {leaderboardError}
                  </div>
                )}

                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {loadingLeaderboard ? (
                    <div className="text-center py-8 text-neutral-500 text-sm">
                      Loading leaderboard...
                    </div>
                  ) : leaderboardEntries.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-sm">
                      No ranked players yet for this game type.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs text-neutral-300">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500 font-semibold">
                          <th className="py-2 px-3 w-12 text-center">Rank</th>
                          <th className="py-2 px-3">Player</th>
                          <th className="py-2 px-3 w-20 text-right">ELO</th>
                          <th className="py-2 px-3 w-32 text-center">Record (W-L-D)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardEntries.map((entry, index) => {
                          const isCurrentUser = entry.userId === currentUser?.id;
                          return (
                            <tr
                              key={entry.userId}
                              className={`border-b border-neutral-850 hover:bg-neutral-950/30 transition-all ${
                                isCurrentUser ? 'bg-indigo-600/5 text-indigo-200' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center font-bold font-mono">
                                {index + 1}
                              </td>
                              <td className="py-2.5 px-3 flex items-center gap-2">
                                <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                                  {entry.username}
                                  {entry.isBot && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                      BOT
                                    </span>
                                  )}
                                  {isCurrentUser && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      YOU
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold font-mono text-white">
                                {entry.elo}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-neutral-400">
                                {entry.wins} - {entry.losses} - {entry.draws}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Join Direct Code Card */}
          <div className="md:col-span-1 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Join by Code</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Enter an invite code / game ID sent by a friend to join their private lobby.
              </p>
            </div>
            <form onSubmit={handleJoinByCode} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Paste Game ID / Code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={syncStatus === 'mismatch'}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={joiningCode || !inviteCode.trim() || syncStatus === 'mismatch'}
                className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                {joiningCode ? 'Joining...' : 'Enter Game'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
