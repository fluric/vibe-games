import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEscapeLeaderboard } from '../../api/escape';
import type { EscapeLeaderboardEntry } from '@vibe-games/shared';

/** Leaderboard of players who have cleared all available rooms,
 *  sorted by first-clear date (earliest = best rank). */
export function EscapeLeaderboard() {
  const { t } = useTranslation('escape');
  const [entries, setEntries] = useState<EscapeLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEscapeLeaderboard()
      .then((res) => setEntries(res.entries))
      .catch(() => setError(t('leaderboard_error', { defaultValue: 'Could not load leaderboard.' })))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="escape-loading">{t('loading_leaderboard', { defaultValue: 'Loading leaderboard…' })}</p>;
  if (error)   return <p className="escape-error">{error}</p>;

  return (
    <div className="escape-leaderboard">
      <h2 className="leaderboard-title">🏆 {t('hall_of_fame_title', { defaultValue: 'Escape — Hall of Fame' })}</h2>
      <p className="leaderboard-subtitle">{t('hall_of_fame_subtitle', { defaultValue: 'Players who fully escaped, ranked by first-clear date.' })}</p>

      {entries.length === 0 ? (
        <p className="leaderboard-empty">{t('no_one_escaped', { defaultValue: 'No one has fully escaped yet. Be the first!' })}</p>
      ) : (
        <table className="leaderboard-table" aria-label="Escape leaderboard">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('player_col', { defaultValue: 'Player' })}</th>
              <th>{t('rooms_col', { defaultValue: 'Rooms' })}</th>
              <th>{t('escaped_on_col', { defaultValue: 'Escaped On' })}</th>
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
