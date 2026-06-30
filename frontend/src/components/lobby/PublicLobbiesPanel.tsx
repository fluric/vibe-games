import type { GameDto } from '@vibe-games/shared';

interface PublicLobbiesPanelProps {
  lobbyError: string | null;
  loadingLobby: boolean;
  filteredLobbies: GameDto[];
  syncStatus: 'synced' | 'warn' | 'mismatch';
  onJoinGame: (gameId: string) => void;
}

export function PublicLobbiesPanel({
  lobbyError,
  loadingLobby,
  filteredLobbies,
  syncStatus,
  onJoinGame
}: PublicLobbiesPanelProps) {
  return (
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
                onClick={() => onJoinGame(game.id)}
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
  );
}
