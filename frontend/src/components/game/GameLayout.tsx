import { Link } from 'react-router-dom';
import type { GameDto } from '@vibe-games/shared';
import { PlayerStats } from './PlayerStats';
import * as audio from '../AudioEffects';
import { useTranslation } from 'react-i18next';

interface GameLayoutProps {
  game: GameDto;
  userId: string;
  gameId: string;
  isSpectator: boolean;
  isMyTurn: boolean;
  bannerMessage: string;
  bannerSub: string;
  onCancelGame: () => void;
  onForfeitGame: () => void;
  onShowRules: () => void;
  onCopyLink: () => void;
  copiedLink: boolean;
  children: React.ReactNode;
}

export function GameLayout({
  game,
  userId,
  gameId,
  isSpectator,
  isMyTurn,
  bannerMessage,
  bannerSub,
  onCancelGame,
  onForfeitGame,
  onShowRules,
  onCopyLink,
  copiedLink,
  children
}: GameLayoutProps) {
  const { t } = useTranslation('game');
  const isHolyGrail = game.gameType === 'holy_grail';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col items-center p-6 md:p-12 relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-6xl flex flex-col gap-6 z-10">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              onClick={() => audio.playPlaceSound()}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {t('leave_match', { defaultValue: '⬅️ Leave Match' })}
            </Link>

            {game.status === 'waiting' && (game.playerX?.id === userId || game.playerO?.id === userId) && (
              <button
                type="button"
                onClick={onCancelGame}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
              >
                {t('cancel_game', { defaultValue: 'Cancel Game' })}
              </button>
            )}

            {game.status === 'in_progress' && !isSpectator && (
              <button
                type="button"
                onClick={onForfeitGame}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 transition-all border border-rose-900/30 hover:border-rose-800/50 active:scale-95"
              >
                {t('forfeit_match', { defaultValue: 'Forfeit Match' })}
              </button>
            )}

            {isHolyGrail && (
              <button
                type="button"
                onClick={onShowRules}
                className="px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/40 text-xs font-semibold text-indigo-400 transition-all border border-indigo-900/30 hover:border-indigo-800/50 active:scale-95 flex items-center gap-1.5"
              >
                {t('rules', { defaultValue: 'ℹ️ Rules' })}
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-neutral-500 font-mono">
              {t('game_id', { defaultValue: 'Game ID:' })} {gameId.substring(0, 8)}...
            </div>
            <div className="text-[10px] text-neutral-600 font-mono">
              {t('your_id', { defaultValue: 'Your ID:' })} {userId.substring(0, 8)}...
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-2xl border backdrop-blur-md text-center flex flex-col gap-1.5 shadow-xl transition-all duration-300 ${
          game.status === 'finished'
            ? game.state.winner === 'draw'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : isMyTurn
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
        }`}>
          <h2 className="text-xl font-bold tracking-tight">{bannerMessage}</h2>
          <p className="text-xs text-neutral-400 font-medium">{bannerSub}</p>
        </div>

        {isHolyGrail ? (
          <div className="flex flex-col gap-6 w-full items-center mt-2">
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-4xl justify-center items-stretch">
              <div className="flex-1"><PlayerStats game={game} player="X" /></div>
              <div className="flex-1"><PlayerStats game={game} player="O" /></div>
            </div>
            <div className="w-full flex justify-center mt-4">
              {children}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mt-2">
            <div className="col-span-12 md:col-span-6 xl:col-span-3 order-1 xl:order-none flex flex-col gap-4">
              <PlayerStats game={game} player="X" />
            </div>
            <div className="col-span-12 xl:col-span-6 order-3 xl:order-none flex flex-col items-center justify-center">
              {children}
            </div>
            <div className="col-span-12 md:col-span-6 xl:col-span-3 order-2 xl:order-none flex flex-col gap-4">
              <PlayerStats game={game} player="O" />
            </div>
          </div>
        )}

        {game.status === 'waiting' && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mt-4 backdrop-blur-md flex flex-col items-center text-center gap-3">
            <div className="text-sm font-bold text-white">{t('invite_friend', { defaultValue: 'Invite a Friend to Play' })}</div>
            <p className="text-xs text-neutral-400 max-w-sm">
              {t('invite_desc', { defaultValue: 'Copy this link and send it to your opponent. When they open it, they will join the game as Player O.' })}
            </p>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 w-full max-w-md justify-between font-mono text-xs">
              <span className="text-neutral-500 truncate mr-2 select-all">
                {window.location.origin}/game/{gameId}
              </span>
              <button
                onClick={onCopyLink}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-500 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {copiedLink ? t('copied', { defaultValue: '✓ Copied!' }) : t('copy_link', { defaultValue: 'Copy Link' })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
