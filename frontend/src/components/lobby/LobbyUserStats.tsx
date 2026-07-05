import { useTranslation } from 'react-i18next';
import type { UserDto } from '@vibe-games/shared';

interface Props {
  currentUser: UserDto;
  activeGameTab: 'mill' | 'connect_four' | 'grail_quest' | 'escape';
}

export function LobbyUserStats({
  currentUser,
  activeGameTab,
}: Props) {
  const { t } = useTranslation('lobby');
  const userId = currentUser.id || '';
  const username = currentUser.username || 'Guest';

  return (
    <div className="md:col-span-1 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">{t('active_player', { defaultValue: 'Active Player' })}</span>
          <h2 className="text-xl font-bold mt-1 text-white">{username}</h2>
          <p className="text-xs text-neutral-500 font-mono mt-1 select-all">{userId.substring(0, 8)}...</p>
        </div>
        {currentUser.avatarUrl ? (
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
        {activeGameTab === 'escape' ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-400">
                {t('escape_status_label', { defaultValue: 'Escape Status:' })}
              </span>
              <span className="font-bold text-teal-400">
                {t('escape_solo', { defaultValue: 'Solo Adventure' })}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {t('escape_progress_desc', { defaultValue: 'Solve rooms to climb the Hall of Fame.' })}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-400">
                {activeGameTab === 'mill'
                  ? t('morris_rating_label', { defaultValue: "Nine Men's Morris Rating:" })
                  : activeGameTab === 'connect_four'
                  ? t('c4_rating_label', { defaultValue: 'Connect Four Rating:' })
                  : t('grail_rating_label', { defaultValue: 'Grail Quest Rating:' })}
              </span>
              <span className="font-bold text-indigo-400">
                {(() => {
                  const tab = activeGameTab as 'mill' | 'connect_four' | 'grail_quest';
                  const stats = currentUser.gameStats?.[tab] || currentUser;
                  return stats?.elo ?? 1200;
                })()}{' '}
                Leaderscore
              </span>
            </div>
            <div className="flex gap-4 text-xs text-neutral-500 mt-2">
              {(() => {
                const tab = activeGameTab as 'mill' | 'connect_four' | 'grail_quest';
                const stats = currentUser.gameStats?.[tab] || currentUser;
                return (
                  <>
                    <span>{t('wins', { defaultValue: 'Wins:' })} <strong className="text-emerald-400">{stats?.wins ?? 0}</strong></span>
                    <span>{t('losses', { defaultValue: 'Losses:' })} <strong className="text-rose-500">{stats?.losses ?? 0}</strong></span>
                    <span>{t('draws', { defaultValue: 'Draws:' })} <strong className="text-neutral-400">{stats?.draws ?? 0}</strong></span>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
