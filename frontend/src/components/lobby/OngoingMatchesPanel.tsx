import type { GameDto } from '@vibe-games/shared';

interface OngoingMatchesPanelProps {
  games: GameDto[];
  onSpectate: (gameId: string) => void;
}

export function OngoingMatchesPanel({ games, onSpectate }: OngoingMatchesPanelProps) {
  if (games.length === 0) {
    return (
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-8 text-center text-neutral-500 text-sm">
        No active matches to spectate right now.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {games.map((g) => (
        <div key={g.id} className="bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 flex flex-col gap-3 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                {g.gameType.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
            </div>
            <button
              onClick={() => onSpectate(g.id)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2"
            >
              👁️ Spectate
            </button>
          </div>

          <div className="flex items-center justify-between bg-neutral-950/50 rounded-lg p-3 border border-neutral-800/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]">X</div>
              <span className="text-sm font-semibold text-neutral-200 truncate max-w-[100px]">
                {g.playerX?.username || 'Player X'}
              </span>
            </div>
            <div className="text-xs text-neutral-500 font-bold px-2">VS</div>
            <div className="flex items-center gap-2 flex-row-reverse">
              <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-[10px] text-rose-400 font-bold border border-rose-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]">O</div>
              <span className="text-sm font-semibold text-neutral-200 truncate max-w-[100px] text-right">
                {g.playerO?.username || 'Player O'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
