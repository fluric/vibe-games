import { useEffect, useState } from 'react';
import { getEscapeLeaderboard } from '../../api/escape';
import type { EscapeLeaderboardEntry } from '@vibe-games/shared';

/** Leaderboard of players who have cleared all available rooms,
 *  sorted by first-clear date (earliest = best rank). */
export function EscapeLeaderboard() {
  const [entries, setEntries] = useState<EscapeLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEscapeLeaderboard()
      .then((res) => setEntries(res.entries))
      .catch(() => setError('Could not load leaderboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="escape-loading">Loading leaderboard…</p>;
  if (error)   return <p className="escape-error">{error}</p>;

  return (
    <div className="escape-leaderboard">
      <h2 className="leaderboard-title">🏆 Escape — Hall of Fame</h2>
      <p className="leaderboard-subtitle">Players who fully escaped, ranked by first-clear date.</p>

      {entries.length === 0 ? (
        <p className="leaderboard-empty">No one has fully escaped yet. Be the first!</p>
      ) : (
        <table className="leaderboard-table" aria-label="Escape leaderboard">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rooms</th>
              <th>Escaped On</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.userId} className={i === 0 ? 'rank-first' : ''}>
                <td className="rank-cell">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </td>
                <td className="player-cell">
                  {entry.avatarUrl ? (
                    <img
                      src={entry.avatarUrl}
                      alt={entry.username}
                      className="player-avatar-sm"
                      width={24}
                      height={24}
                    />
                  ) : (
                    <span className="player-initial">{entry.username[0].toUpperCase()}</span>
                  )}
                  {entry.username}
                </td>
                <td>{entry.roomsCleared}</td>
                <td>{new Date(entry.firstClearedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
