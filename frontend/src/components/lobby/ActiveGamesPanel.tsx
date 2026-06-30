import type { GameDto } from '@vibe-games/shared';
import { useTranslation } from 'react-i18next';

interface ActiveGamesPanelProps {
  activeGames: GameDto[];
  userId: string;
  copiedId: string | null;
  onCopyLink: (gameId: string) => void;
  onCancelGame: (gameId: string) => void;
  onForfeitGame: (gameId: string) => void;
  onNavigate: (path: string) => void;
}

export function ActiveGamesPanel({
  activeGames,
  userId,
  copiedId,
  onCopyLink,
  onCancelGame,
  onForfeitGame,
  onNavigate
}: ActiveGamesPanelProps) {
  const { t } = useTranslation('lobby');
  const filteredActiveGames = activeGames;
  if (filteredActiveGames.length === 0) return null;

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        {t('your_active_matches', { defaultValue: 'Your Active Matches' })}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredActiveGames.map((game) => {
          const myPiece = game.playerX?.id === userId ? 'X' : 'O';
          const opponentPlayer = myPiece === 'X' ? game.playerO : game.playerX;
          const isWaiting = game.status === 'waiting';
          const opponentName = opponentPlayer?.username || (isWaiting ? t('waiting_for_opponent', { defaultValue: 'Waiting for opponent...' }) : t('unknown_player', { defaultValue: 'Unknown Player' }));
          const isMyTurn = game.state.turn === myPiece;

          return (
            <div
              key={game.id}
              className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all gap-4"
            >
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-300">
                    {isWaiting ? (
                      <span className="text-indigo-400">{t('hosting', { defaultValue: 'Hosting' })} {game.isPublic ? t('public', { defaultValue: 'Public' }) : t('private', { defaultValue: 'Private' })} {t('lobby', { defaultValue: 'Lobby' })}</span>
                    ) : (
                      <span>vs {opponentName}</span>
                    )}
                  </span>
                  <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                    {game.gameType.replace('_', ' ')}
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
                      type="button"
                      onClick={() => onCopyLink(game.id)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 transition-all border border-neutral-700/50 hover:border-neutral-600 active:scale-95 flex items-center gap-1"
                    >
                      {copiedId === game.id ? '✓ Copied' : '🔗 Copy Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancelGame(game.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate(`/game/${game.id}`)}
                      className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
                    >
                      Resume Match
                    </button>
                    <button
                      type="button"
                      onClick={() => onForfeitGame(game.id)}
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
  );
}
