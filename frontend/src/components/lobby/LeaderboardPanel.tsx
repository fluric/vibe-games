import type { LeaderboardEntryDto, UserDto } from '@vibe-games/shared';

interface LeaderboardPanelProps {
  leaderboardError: string | null;
  loadingLeaderboard: boolean;
  leaderboardEntries: LeaderboardEntryDto[];
  currentUser: UserDto | null;
}

export function LeaderboardPanel({
  leaderboardError,
  loadingLeaderboard,
  leaderboardEntries,
  currentUser
}: LeaderboardPanelProps) {
  return (
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
  );
}
