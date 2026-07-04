import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicLobbiesPanel } from './PublicLobbiesPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { EscapeLeaderboardTable } from './EscapeLeaderboardTable';
import type { GameDto, LeaderboardEntryDto, UserDto, EscapeLeaderboardEntry } from '@vibe-games/shared';

interface Props {
  activeGameTab: 'mill' | 'connect_four' | 'holy_grail' | 'escape';
  lobbyTab: 'lobbies' | 'leaderboard';
  setLobbyTab: (tab: 'lobbies' | 'leaderboard') => void;
  fetchLobby: () => void;
  fetchLeaderboard: () => void;
  lobbyError: string | null;
  loadingLobby: boolean;
  openGames: GameDto[];
  syncStatus: 'synced' | 'warn' | 'mismatch';
  handleJoinGame: (gameId: string) => void;
  leaderboardError: string | null;
  loadingLeaderboard: boolean;
  leaderboardEntries: LeaderboardEntryDto[];
  escapeLeaderboardEntries: EscapeLeaderboardEntry[];
  currentUser: UserDto | null;
}

export function LobbyTabsSection({
  activeGameTab,
  lobbyTab,
  setLobbyTab,
  fetchLobby,
  fetchLeaderboard,
  lobbyError,
  loadingLobby,
  openGames,
  syncStatus,
  handleJoinGame,
  leaderboardError,
  loadingLeaderboard,
  leaderboardEntries,
  escapeLeaderboardEntries,
  currentUser,
}: Props) {
  const { t } = useTranslation('lobby');
  
  useEffect(() => {
    if (activeGameTab === 'escape' && lobbyTab === 'lobbies') {
      setLobbyTab('leaderboard');
    }
  }, [activeGameTab, lobbyTab, setLobbyTab]);

  return (
    <div className="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
      {/* Tabs Header */}
      <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
        <div className="flex gap-4">
          {activeGameTab !== 'escape' && (
            <button
              onClick={() => setLobbyTab('lobbies')}
              className={`text-sm font-bold transition-colors pb-2 border-b-2 ${
                lobbyTab === 'lobbies'
                  ? 'text-white border-indigo-500'
                  : 'text-neutral-400 border-transparent hover:text-white'
              }`}
            >
              🌍 {t('active_lobbies', { defaultValue: 'Active Lobbies' })}
            </button>
          )}
          <button
            onClick={() => setLobbyTab('leaderboard')}
            className={`text-sm font-bold transition-colors pb-2 border-b-2 ${
              lobbyTab === 'leaderboard'
                ? 'text-white border-indigo-500'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            🏆 {t('elo_leaderboard', { defaultValue: 'Leaderboard' })}
          </button>
        </div>

        {lobbyTab === 'lobbies' ? (
          <button
            onClick={fetchLobby}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            🔄 {t('refresh_lobbies', { defaultValue: 'Refresh Lobbies' })}
          </button>
        ) : (
          <button
            onClick={fetchLeaderboard}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            🔄 {t('refresh_leaderboard', { defaultValue: 'Refresh Leaderboard' })}
          </button>
        )}
      </div>

      {lobbyTab === 'lobbies' ? (
        <PublicLobbiesPanel
          lobbyError={lobbyError}
          loadingLobby={loadingLobby}
          filteredLobbies={openGames}
          syncStatus={syncStatus}
          onJoinGame={handleJoinGame}
        />
      ) : activeGameTab === 'escape' ? (
        <EscapeLeaderboardTable
          leaderboardError={leaderboardError}
          loadingLeaderboard={loadingLeaderboard}
          leaderboardEntries={escapeLeaderboardEntries}
          currentUser={currentUser}
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
  );
}
