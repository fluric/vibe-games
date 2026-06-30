import type { GameDto, MillGameState } from '@vibe-games/shared';
import { isBotId } from '../../utils/botUtils';

interface PlayerStatsProps {
  game: GameDto;
  player: 'X' | 'O';
}

export function PlayerStats({ game, player }: PlayerStatsProps) {
  const isPlayerX = player === 'X';
  const playerDto = isPlayerX ? game.playerX : game.playerO;
  const isMyTurn = game.status === 'in_progress' && game.state.turn === player;

  const bgClass = isPlayerX ? 'bg-blue-500' : 'bg-rose-500';
  const textClass = isPlayerX ? 'text-blue-400' : 'text-rose-400';
  const shadowClass = isPlayerX ? 'shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  const activeBg = isPlayerX ? 'bg-blue-500/10 border-blue-500/30' : 'bg-rose-500/10 border-rose-500/30';
  const gradient = isPlayerX ? 'from-blue-500 to-indigo-600' : 'from-rose-500 to-amber-600';

  let rem = 0;
  let placed = 0;
  let captured = 0;

  if (game.gameType === 'mill') {
    const millState = game.state as MillGameState;
    placed = isPlayerX ? millState.piecesOnBoard.X : millState.piecesOnBoard.O;
    rem = isPlayerX ? millState.placementsRemaining.X : millState.placementsRemaining.O;
    captured = Math.max(0, 9 - placed - rem);
  }

  const ratingLabel = game.gameType === 'mill' ? 'Morris Rating' : game.gameType === 'connect_four' ? 'C4 Rating' : 'Grail Rating';

  const isHolyGrail = game.gameType === 'holy_grail';
  const innerCardClass = isHolyGrail
    ? `p-4 rounded-2xl border h-full transition-all flex flex-col justify-between ${isMyTurn ? activeBg : 'bg-neutral-900/40 border-neutral-800'}`
    : `p-5 rounded-2xl border transition-all ${isMyTurn ? activeBg : 'bg-neutral-900/40 border-neutral-800'}`;

  return (
    <div data-testid={`player-${player.toLowerCase()}-card`} className={innerCardClass}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold tracking-widest ${textClass} uppercase`}>Player {player}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${bgClass} ${shadowClass}`} />
      </div>
      <div className={`flex items-center gap-3 ${isHolyGrail ? 'mt-2' : 'mt-3'}`}>
        {playerDto && isBotId(playerDto.id) ? (
          <div className={`w-${isHolyGrail ? '9 h-9 text-base' : '10 h-10 text-lg'} rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-md`}>
            🤖
          </div>
        ) : playerDto?.avatarUrl ? (
          <img
            src={playerDto.avatarUrl}
            alt={playerDto.username}
            className={`w-${isHolyGrail ? '9 h-9' : '10 h-10'} rounded-full border border-neutral-800 object-cover shadow-md`}
          />
        ) : (
          <div className={`w-${isHolyGrail ? '9 h-9 text-xs' : '10 h-10 text-xs'} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-extrabold shadow-md`}>
            {(playerDto?.username || 'W').substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <h3 className="text-sm font-bold text-white truncate">
            {playerDto?.username || 'Waiting...'}
          </h3>
          <span className="text-[9px] text-neutral-500">
            {playerDto ? `${ratingLabel}: ${playerDto.elo ?? 1200}` : 'Waiting...'}
          </span>
        </div>
      </div>
      {game.gameType === 'mill' && (
        <div className="border-t border-neutral-800/80 pt-3 mt-3 flex flex-col gap-1.5 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>Placements Left:</span>
            <span className="font-bold text-white">{rem}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Pieces:</span>
            <span className="font-bold text-white">{placed}</span>
          </div>
          <div className="flex justify-between">
            <span>Pieces Lost:</span>
            <span className="font-bold text-rose-500">{captured}</span>
          </div>
        </div>
      )}
    </div>
  );
}
