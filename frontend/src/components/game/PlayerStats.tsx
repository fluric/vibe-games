import type { GameDto, MillGameState, PlayerPiece } from '@vibe-games/shared';
import { isBotId } from '../../utils/botUtils';
import { useTranslation } from 'react-i18next';

interface PlayerStatsProps {
  game: GameDto;
  player: 'X' | 'O';
}

export function PlayerStats({ game, player }: PlayerStatsProps) {
  const { t } = useTranslation('game');
  const isPlayerX = player === 'X';
  const playerDto = isPlayerX ? game.playerX : game.playerO;
  const isMyTurn = game.status === 'in_progress' && game.state.turn === player;

  let themeX = {
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    shadow: 'shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    activeBg: 'bg-blue-500/10 border-blue-500/30',
    gradient: 'from-blue-500 to-indigo-600'
  };
  let themeO = {
    bg: 'bg-rose-500',
    text: 'text-rose-400',
    shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    activeBg: 'bg-rose-500/10 border-rose-500/30',
    gradient: 'from-rose-500 to-amber-600'
  };

  if (game.gameType === 'connect_four') {
    themeX = {
      bg: 'bg-rose-500',
      text: 'text-rose-400',
      shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]',
      activeBg: 'bg-rose-500/10 border-rose-500/30',
      gradient: 'from-rose-500 to-rose-700'
    };
    themeO = {
      bg: 'bg-amber-400',
      text: 'text-amber-400',
      shadow: 'shadow-[0_0_8px_rgba(251,191,36,0.6)]',
      activeBg: 'bg-amber-400/10 border-amber-400/30',
      gradient: 'from-amber-400 to-amber-600'
    };
  }

  const theme = isPlayerX ? themeX : themeO;
  const bgClass = theme.bg;
  const textClass = theme.text;
  const shadowClass = theme.shadow;
  const activeBg = theme.activeBg;
  const gradient = theme.gradient;

  let rem = 0;
  let placed = 0;
  let captured = 0;

  if (game.gameType === 'mill') {
    const millState = game.state as MillGameState;
    placed = isPlayerX ? millState.piecesOnBoard.X : millState.piecesOnBoard.O;
    rem = isPlayerX ? millState.placementsRemaining.X : millState.placementsRemaining.O;
    captured = Math.max(0, 9 - placed - rem);
  }

  let reversiScore = 0;
  if (game.gameType === 'reversi') {
    reversiScore = (game.state.board as (PlayerPiece | null)[]).filter(p => p === player).length;
  }

  const ratingLabel = game.gameType === 'mill' ? t('morris_rating', { defaultValue: 'Morris Rating' }) : game.gameType === 'connect_four' ? t('c4_rating', { defaultValue: 'C4 Rating' }) : game.gameType === 'reversi' ? t('reversi_rating', { defaultValue: 'Reversi Rating' }) : t('grail_rating', { defaultValue: 'Grail Rating' });

  const isGrailQuest = game.gameType === 'grail_quest';
  const innerCardClass = isGrailQuest
    ? `p-4 rounded-2xl border h-full transition-all flex flex-col justify-between ${isMyTurn ? activeBg : 'bg-neutral-900/40 border-neutral-800'}`
    : `p-5 rounded-2xl border transition-all ${isMyTurn ? activeBg : 'bg-neutral-900/40 border-neutral-800'}`;

  return (
    <div data-testid={`player-${player.toLowerCase()}-card`} className={innerCardClass}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold tracking-widest ${textClass} uppercase`}>{t('player_name', { defaultValue: 'Player' })} {player}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${bgClass} ${shadowClass}`} />
      </div>
      <div className={`flex items-center gap-3 ${isGrailQuest ? 'mt-2' : 'mt-3'}`}>
        {playerDto && isBotId(playerDto.id) ? (
          <div className={`w-${isGrailQuest ? '9 h-9 text-base' : '10 h-10 text-lg'} rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-md`}>
            🤖
          </div>
        ) : playerDto?.avatarUrl ? (
          <img
            src={playerDto.avatarUrl}
            alt={playerDto.username}
            className={`w-${isGrailQuest ? '9 h-9' : '10 h-10'} rounded-full border border-neutral-800 object-cover shadow-md`}
          />
        ) : (
          <div className={`w-${isGrailQuest ? '9 h-9 text-xs' : '10 h-10 text-xs'} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-extrabold shadow-md`}>
            {(playerDto?.username || 'W').substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <h3 className="text-sm font-bold text-white truncate">
            {playerDto?.username || t('waiting', { defaultValue: 'Waiting...' })}
          </h3>
          <span className="text-[9px] text-neutral-500">
            {playerDto ? `${ratingLabel}: ${playerDto.elo ?? 1200}` : t('waiting', { defaultValue: 'Waiting...' })}
          </span>
        </div>
      </div>
      {game.gameType === 'mill' && (
        <div className="border-t border-neutral-800/80 pt-3 mt-3 flex flex-col gap-1.5 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>{t('placements_left', { defaultValue: 'Placements Left:' })}</span>
            <span className="font-bold text-white">{rem}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('active_pieces', { defaultValue: 'Active Pieces:' })}</span>
            <span className="font-bold text-white">{placed}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('pieces_lost', { defaultValue: 'Pieces Lost:' })}</span>
            <span className="font-bold text-rose-500">{captured}</span>
          </div>
        </div>
      )}
      {game.gameType === 'reversi' && (
        <div className="border-t border-neutral-800/80 pt-3 mt-3 flex flex-col gap-1.5 text-xs text-neutral-400">
          <div className="flex justify-between items-center">
            <span>{t('discs_on_board', { defaultValue: 'Discs on Board:' })}</span>
            <div className="flex items-center gap-1.5 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              <span className={`w-2.5 h-2.5 rounded-full ${bgClass} ${shadowClass}`} />
              <span className="font-bold text-white text-sm">{reversiScore}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
