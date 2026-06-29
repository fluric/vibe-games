import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../api/games';
import { API_VERSION, type GameDto, type UserDto, type LeaderboardEntryDto } from '@vibe-games/shared';
import * as audio from '../components/AudioEffects';
import aiConfig from '../../../backend/src/game/aiConfig.json';
import { ConfirmModal } from '../components/ConfirmModal';

import { ActiveGamesPanel } from '../components/lobby/ActiveGamesPanel';
import { JoinByCodePanel } from '../components/lobby/JoinByCodePanel';
import { PublicLobbiesPanel } from '../components/lobby/PublicLobbiesPanel';
import { LeaderboardPanel } from '../components/lobby/LeaderboardPanel';

const typedConfig = aiConfig as unknown as Record<'mill' | 'connect_four' | 'holy_grail', Record<string, { id: string; username: string; elo: number; type: string }>>;


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
    easy_cowardly: "Blocked-Avoidance & Defense",
    easy_greedy: "Material Hunter",
    easy_aggressive: "Line Hunter",
    medium_aggressive: "Center Control & Openings",
    medium_defensive: "Defensive Blocking",
    medium_mobile: "Spaced Alignment",
    hard_tactical: "Minimax Depth 4",
    expert_garry: "Minimax Depth 5",
    legendary_magnus: "Minimax Depth 6",
    perfect_oracle: "Center Alignment Search",
    rl_novice: "Neural Network (Depth 0)",
    rl_intermediate: "Neural Network + MCTS 50",
    rl_strong: "Neural Network + MCTS 200",
    rl_master: "Neural Network + MCTS 800",
  },
  holy_grail: {
    easy_random: "Random Play",
    medium_aggressive: "Positional & Combat",
    hard_tactical: "Tactical Search",
    expert_smart: "Lookahead 1-ply Simulation"
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
    rl_novice: "⚡",
    rl_intermediate: "⚡",
    rl_strong: "⚡",
    rl_master: "⚡",
  },
  holy_grail: {
    easy_random: "🟢",
    medium_aggressive: "🟡",
    hard_tactical: "🔴",
    expert_smart: "🌌"
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
    easy_cowardly: "Connie searches shallowly and hates getting blocked. Easy to maneuver around.",
    easy_greedy: "Gordon values material over safety. Trappable by planning ahead.",
    easy_aggressive: "Arthur pursues line structures single-mindedly, often leaving his own pieces exposed.",
    medium_aggressive: "Archie searches 3 plies deep, prioritizing connecting pieces and center column alignment.",
    medium_defensive: "Debbie searches 3 plies deep, focusing on blocking opponent 3-in-a-row threats.",
    medium_mobile: "Monty searches 3 plies deep, focusing on maintaining flexible, non-blocked connections.",
    hard_tactical: "Toby calculates 4 plies ahead, focusing on blocking and creating alignment traps.",
    expert_garry: "Garry evaluates 5 plies deep with optimized positional heuristics. A true challenge!",
    legendary_magnus: "Magnus calculates 6 plies deep with extremely optimized weights. Legendary level!",
    perfect_oracle: "The Oracle uses deep positional evaluation and center column search for maximum control.",
    rl_novice: "⚡ Neural Novice uses a pure neural network (no lookahead) trained by AlphaZero-style self-play.",
    rl_intermediate: "⚡ Neural Scout combines a trained neural network with 50 MCTS simulations per move.",
    rl_strong: "⚡ Neural Strategist runs 200 MCTS simulations guided by a deep self-play trained network.",
    rl_master: "⚡ Neural Master runs 800 MCTS simulations. The strongest self-play trained bot on this platform.",
  },
  holy_grail: {
    easy_random: "Randy HG plays completely random moves.",
    medium_aggressive: "Archie HG plays a positional game targeting farms and bases.",
    hard_tactical: "Toby HG calculates moves and combat sequences.",
    expert_smart: "Sophia simulates all possible next moves and evaluates positions using detailed combat, farm, base, and Grail heuristics."
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
  const actionPendingRef = useRef(false);
  const [cancelGameId, setCancelGameId] = useState<string | null>(null);
  const [forfeitGameId, setForfeitGameId] = useState<string | null>(null);
  const [openGames, setOpenGames] = useState<GameDto[]>([]);
  const [activeGames, setActiveGames] = useState<GameDto[]>([]);
  const [loadingLobby, setLoadingLobby] = useState(true);
  const [creatingGame, setCreatingGame] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  type BotLevel = 'easy_random' | 'easy_cowardly' | 'easy_greedy' | 'easy_aggressive' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle' | 'expert_smart' | 'rl_novice' | 'rl_intermediate' | 'rl_strong' | 'rl_master';

  const [activeGameTab, setActiveGameTab] = useState<'mill' | 'connect_four' | 'holy_grail'>(() => {
    const saved = localStorage.getItem('vibe-games-active-tab');
    return (saved === 'mill' || saved === 'connect_four' || saved === 'holy_grail') ? saved : 'mill';
  });

  const [aiLevelMill, setAiLevelMill] = useState<BotLevel>(() => {
    const saved = localStorage.getItem('vibe-games-ai-level-mill');
    const validLevels = [
      'easy_random', 'easy_cowardly', 'easy_greedy', 'easy_aggressive',
      'medium_aggressive', 'medium_defensive', 'medium_mobile',
      'hard_tactical', 'expert_garry', 'legendary_magnus', 'perfect_oracle'
    ];
    return (saved && validLevels.includes(saved)) ? (saved as BotLevel) : 'medium_aggressive';
  });

  const [aiLevelConnectFour, setAiLevelConnectFour] = useState<BotLevel>(() => {
    const saved = localStorage.getItem('vibe-games-ai-level-connect_four');
    const validLevels = [
      'easy_random', 'easy_cowardly', 'easy_greedy', 'easy_aggressive',
      'medium_aggressive', 'medium_defensive', 'medium_mobile',
      'hard_tactical', 'expert_garry', 'legendary_magnus', 'perfect_oracle',
      'rl_novice', 'rl_intermediate', 'rl_strong', 'rl_master',
    ];
    return (saved && validLevels.includes(saved)) ? (saved as BotLevel) : 'medium_aggressive';
  });

  const [aiLevelHolyGrail, setAiLevelHolyGrail] = useState<BotLevel>(() => {
    const saved = localStorage.getItem('vibe-games-ai-level-holy_grail');
    const validLevels = ['easy_random', 'medium_aggressive', 'hard_tactical', 'expert_smart'];
    return (saved && validLevels.includes(saved)) ? (saved as BotLevel) : 'medium_aggressive';
  });

  const [aiStartsMill, setAiStartsMill] = useState<boolean>(() => {
    return localStorage.getItem('vibe-games-ai-starts-mill') === 'true';
  });
  const [aiStartsConnectFour, setAiStartsConnectFour] = useState<boolean>(() => {
    return localStorage.getItem('vibe-games-ai-starts-connect_four') === 'true';
  });
  const [aiStartsHolyGrail, setAiStartsHolyGrail] = useState<boolean>(() => {
    return localStorage.getItem('vibe-games-ai-starts-holy_grail') === 'true';
  });

  const currentAiStarts = activeGameTab === 'mill' 
    ? aiStartsMill 
    : activeGameTab === 'connect_four' 
    ? aiStartsConnectFour 
    : aiStartsHolyGrail;

  const [gameModeMill, setGameModeMill] = useState<'ai' | 'human'>(() => {
    const saved = localStorage.getItem('vibe-games-game-mode-mill');
    return saved === 'human' ? 'human' : 'ai';
  });
  const [gameModeConnectFour, setGameModeConnectFour] = useState<'ai' | 'human'>(() => {
    const saved = localStorage.getItem('vibe-games-game-mode-connect_four');
    return saved === 'human' ? 'human' : 'ai';
  });
  const [gameModeHolyGrail, setGameModeHolyGrail] = useState<'ai' | 'human'>(() => {
    const saved = localStorage.getItem('vibe-games-game-mode-holy_grail');
    return saved === 'human' ? 'human' : 'ai';
  });

  const currentGameMode = activeGameTab === 'mill' 
    ? gameModeMill 
    : activeGameTab === 'connect_four' 
    ? gameModeConnectFour 
    : gameModeHolyGrail;

  const [lobbyTab, setLobbyTab] = useState<'lobbies' | 'leaderboard'>('lobbies');


  const currentAiLevel = activeGameTab === 'mill' 
    ? aiLevelMill 
    : activeGameTab === 'connect_four' 
    ? aiLevelConnectFour 
    : aiLevelHolyGrail;

  useEffect(() => {
    localStorage.setItem('vibe-games-ai-level-mill', aiLevelMill);
  }, [aiLevelMill]);

  useEffect(() => {
    localStorage.setItem('vibe-games-ai-level-connect_four', aiLevelConnectFour);
  }, [aiLevelConnectFour]);

  useEffect(() => {
    localStorage.setItem('vibe-games-ai-level-holy_grail', aiLevelHolyGrail);
  }, [aiLevelHolyGrail]);

  useEffect(() => {
    localStorage.setItem('vibe-games-active-tab', activeGameTab);
  }, [activeGameTab]);

  useEffect(() => {
    localStorage.setItem('vibe-games-ai-starts-mill', String(aiStartsMill));
  }, [aiStartsMill]);

  useEffect(() => {
    localStorage.setItem('vibe-games-ai-starts-connect_four', String(aiStartsConnectFour));
  }, [aiStartsConnectFour]);

  useEffect(() => {
    localStorage.setItem('vibe-games-ai-starts-holy_grail', String(aiStartsHolyGrail));
  }, [aiStartsHolyGrail]);

  useEffect(() => {
    localStorage.setItem('vibe-games-game-mode-mill', gameModeMill);
  }, [gameModeMill]);

  useEffect(() => {
    localStorage.setItem('vibe-games-game-mode-connect_four', gameModeConnectFour);
  }, [gameModeConnectFour]);

  useEffect(() => {
    localStorage.setItem('vibe-games-game-mode-holy_grail', gameModeHolyGrail);
  }, [gameModeHolyGrail]);
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
      setOpenGames(games.filter((g) => g.playerX?.id !== currentUser.id && g.playerO?.id !== currentUser.id));
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    console.log('[DEBUG] Lobby executeCancelGame, gameId:', cancelGameId);
    try {
      audio.playPlaceSound();
      await api.cancelGame(cancelGameId);
      console.log('[DEBUG] Lobby cancel success, fetching lobby...');
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
    console.log('[DEBUG] Lobby executeForfeitGame, gameId:', forfeitGameId);
    try {
      audio.playPlaceSound();
      await api.forfeitGame(forfeitGameId);
      console.log('[DEBUG] Lobby forfeit success, fetching lobby...');
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
    selectedAiLevel?: 'easy' | 'medium' | 'hard' | 'easy_random' | 'easy_cowardly' | 'easy_greedy' | 'easy_aggressive' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle' | 'expert_smart' | 'rl_novice' | 'rl_intermediate' | 'rl_strong' | 'rl_master'
  ) => {
    if (syncStatus === 'mismatch') {
      alert('Cannot create match: API version mismatch. Please refresh the page.');
      return;
    }
    if (creatingGame) return;
    setCreatingGame(true);
    try {
      audio.playPlaceSound();
      const newGame = await api.createGame(activeGameTab, isPublic, vsAi, selectedAiLevel, currentAiStarts);
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
              <a
                href={`${(import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/^(?!https?:\/\/)/, 'https://')}/auth/google/redirect?returnUrl=${encodeURIComponent(window.location.href)}`}
                className="text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
              >
                Having trouble? Sign in via redirect
              </a>
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
            {currentUser && (
              <div className="flex items-center gap-2 bg-neutral-900/50 border border-neutral-800/85 px-3 py-1.5 rounded-xl text-xs w-fit">
                <span className="text-neutral-500 font-medium">Player:</span>
                {isEditingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editNameVal}
                      onChange={(e) => setEditNameVal(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-neutral-700 w-32"
                      autoFocus
                      required
                    />
                    <button type="submit" className="text-emerald-400 hover:text-emerald-300 font-bold px-1 cursor-pointer">✓</button>
                    <button type="button" onClick={() => setIsEditingName(false)} className="text-rose-400 hover:text-rose-300 font-bold px-1 cursor-pointer">✕</button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">{username}</span>
                    <button
                      onClick={() => {
                        setEditNameVal(username);
                        setIsEditingName(true);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 text-[11px] underline ml-1 cursor-pointer"
                    >
                      Edit Name
                    </button>
                  </div>
                )}
              </div>
            )}
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
          <button
            onClick={() => setActiveGameTab('holy_grail')}
            className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
              activeGameTab === 'holy_grail'
                ? 'bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.4)] text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
            }`}
          >
            🏆 Grail Quest
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
                <span className="text-neutral-400">
                  {activeGameTab === 'mill'
                    ? "Nine Men's Morris Rating:"
                    : activeGameTab === 'connect_four'
                    ? 'Connect Four Rating:'
                    : 'Grail Quest Rating:'}
                </span>
                <span className="font-bold text-indigo-400">
                  {(() => {
                    const stats = currentUser?.gameStats?.[activeGameTab] || currentUser;
                    return stats?.elo ?? 1200;
                  })()}{' '}
                  ELO
                </span>
              </div>
              <div className="flex gap-4 text-xs text-neutral-500 mt-2">
                {(() => {
                  const stats = currentUser?.gameStats?.[activeGameTab] || currentUser;
                  return (
                    <>
                      <span>Wins: <strong className="text-emerald-400">{stats?.wins ?? 0}</strong></span>
                      <span>Losses: <strong className="text-rose-500">{stats?.losses ?? 0}</strong></span>
                      <span>Draws: <strong className="text-neutral-400">{stats?.draws ?? 0}</strong></span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Creation Panel */}
          <div className="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-5 justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Create a New Match</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Launch a match of {activeGameTab === 'mill' ? "Nine Men's Morris" : activeGameTab === 'connect_four' ? 'Connect Four' : 'Grail Quest'} immediately.
              </p>
            </div>
            <div className="flex flex-col gap-4">

              {/* Game mode toggle */}
              <div className="flex bg-neutral-950/60 border border-neutral-800/80 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (activeGameTab === 'mill') setGameModeMill('ai');
                    else if (activeGameTab === 'connect_four') setGameModeConnectFour('ai');
                    else setGameModeHolyGrail('ai');
                  }}
                  className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all ${
                    currentGameMode === 'ai'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  🤖 vs AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeGameTab === 'mill') setGameModeMill('human');
                    else if (activeGameTab === 'connect_four') setGameModeConnectFour('human');
                    else setGameModeHolyGrail('human');
                  }}
                  className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all ${
                    currentGameMode === 'human'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  👥 vs Human
                </button>
              </div>

              <div className="flex flex-col gap-2 bg-neutral-950/40 border border-neutral-800/80 rounded-2xl p-4 w-full">

                {/* AI strength — only shown in AI mode */}
                {currentGameMode === 'ai' && (
                  <>
                    <label htmlFor="ai-bot-select" className="text-xs text-neutral-400 font-semibold">
                      Select AI Opponent:
                    </label>
                    <select
                      id="ai-bot-select"
                      value={currentAiLevel}
                      onChange={(e) => {
                        const val = e.target.value as BotLevel;
                        if (activeGameTab === 'mill') {
                          setAiLevelMill(val);
                        } else if (activeGameTab === 'connect_four') {
                          setAiLevelConnectFour(val);
                        } else {
                          setAiLevelHolyGrail(val);
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                    >
                      {Object.entries(typedConfig[activeGameTab] || typedConfig.mill)
                        .sort((a, b) => a[1].elo - b[1].elo)
                        .map(([key, bot]) => (
                          <option key={key} value={key}>
                            {BOT_EMOJIS[activeGameTab]?.[key] || "🤖"} {bot.username} — ELO {bot.elo} [{BOT_DESCRIPTIONS[activeGameTab]?.[key] || "AI Bot"}]
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      {BOT_HELP_TEXT[activeGameTab]?.[currentAiLevel] || "AI Bot will calculate moves based on difficulty."}
                    </p>
                    <div className="border-t border-neutral-800/80 my-2"></div>
                  </>
                )}

                <label className="text-xs text-neutral-400 font-semibold">
                  Who Starts the Game?
                </label>
                <div className="flex gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeGameTab === 'mill') setAiStartsMill(false);
                      else if (activeGameTab === 'connect_four') setAiStartsConnectFour(false);
                      else setAiStartsHolyGrail(false);
                    }}
                    className={`flex-1 py-2 text-xs rounded-xl font-semibold border transition-all ${
                      !currentAiStarts
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    👤 You Start (First)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeGameTab === 'mill') setAiStartsMill(true);
                      else if (activeGameTab === 'connect_four') setAiStartsConnectFour(true);
                      else setAiStartsHolyGrail(true);
                    }}
                    className={`flex-1 py-2 text-xs rounded-xl font-semibold border transition-all ${
                      currentAiStarts
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    {currentGameMode === 'ai' ? '🤖 AI Starts (First)' : '🧑 Opponent Starts (First)'}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              {currentGameMode === 'ai' ? (
                <button
                  onClick={() => handleCreateGame(true, false, currentAiLevel)}
                  disabled={creatingGame || syncStatus === 'mismatch'}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    🤖
                  </div>
                  <span className="font-bold text-xs text-white">Play vs AI</span>
                  <span className="text-[10px] text-neutral-500 text-center">Practice offline</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-4">
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
              )}
            </div>
          </div>
        </div>

        {/* Active Matches Section */}
        <ActiveGamesPanel
          activeGames={activeGames}
          activeGameTab={activeGameTab}
          userId={userId}
          copiedId={copiedId}
          onCopyLink={handleCopyLink}
          onCancelGame={handleCancelGame}
          onForfeitGame={handleForfeitGame}
          onNavigate={navigate}
        />

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
                <button
                  onClick={fetchLeaderboard}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  🔄 Refresh Leaderboard
                </button>
              )}
            </div>

            {lobbyTab === 'lobbies' ? (
              <PublicLobbiesPanel
                lobbyError={lobbyError}
                loadingLobby={loadingLobby}
                filteredLobbies={filteredLobbies}
                syncStatus={syncStatus}
                onJoinGame={handleJoinGame}
              />
            ) : (
              <LeaderboardPanel
                leaderboardError={leaderboardError}
                loadingLeaderboard={loadingLeaderboard}
                leaderboardEntries={leaderboardEntries}
                currentUser={currentUser}
              />
            )}
          </div>

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
        title="Cancel Game Lobby"
        message="Are you sure you want to cancel this game lobby?"
        confirmLabel="Cancel Game"
        onConfirm={executeCancelGame}
        onCancel={() => {
          actionPendingRef.current = false;
          setCancelGameId(null);
        }}
      />

      <ConfirmModal
        isOpen={forfeitGameId !== null}
        title="Forfeit Match"
        message="Are you sure you want to forfeit this match? This will count as a loss."
        confirmLabel="Forfeit"
        onConfirm={executeForfeitGame}
        onCancel={() => {
          actionPendingRef.current = false;
          setForfeitGameId(null);
        }}
      />
    </div>
  );
}
