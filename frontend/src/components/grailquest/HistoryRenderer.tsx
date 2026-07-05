import { formatCardString, formatCardValue, parseCardLabel } from './boardUtils';
import type { GroupedLog } from './historyUtils';

export const GroupedHistoryEntry: React.FC<{ grouped: GroupedLog }> = ({ grouped }) => {

  if (grouped.radioactiveSummary) {
    const summary = grouped.radioactiveSummary;
    const playerColor = summary.player === 'X' 
      ? 'text-blue-400' 
      : summary.player === 'O' 
      ? 'text-rose-400' 
      : 'text-amber-500';
    const showCell = summary.cell && summary.cell !== 'Grail Center';
    return (
      <div 
        key={grouped.key} 
        className="text-xs text-neutral-305 py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5 flex-wrap px-1 rounded hover:bg-neutral-800/30 transition-colors"
      >
        <span className="text-amber-400 font-bold">☢️</span>
        {showCell && (
          <>
            <span className="text-neutral-400 font-semibold">{summary.cell}</span>
            <span className="text-neutral-500">:</span>
          </>
        )}
        <span className="text-neutral-500 font-bold">💀</span>
        <span className={`${playerColor} font-bold`}>{formatCardString(summary.card)}</span>
      </div>
    );
  }

  if (grouped.combatSummary) {
    const summary = grouped.combatSummary;
    const attColor = summary.attacker === 'X' ? 'text-blue-400' : 'text-rose-400';
    const defColor = summary.defender === 'X' ? 'text-blue-400' : 'text-rose-400';
    const xLostCards = summary.attacker === 'X' ? summary.attackerDestroyedCards : summary.defenderDestroyedCards;
    const oLostCards = summary.attacker === 'O' ? summary.attackerDestroyedCards : summary.defenderDestroyedCards;

    const formatDestroyedList = (cards: string[]) => {
      return '[' + cards.map(c => formatCardValue(parseCardLabel(c))).join(',') + ']';
    };

    const tooltipText = [
      `Combat at ${summary.cell}`,
      `---------------------`,
      `Player (${summary.attacker}) Destroyed: ${summary.attackerDestroyedCards.length > 0 ? summary.attackerDestroyedCards.join(', ') : 'None'}`,
      `Player (${summary.defender}) Destroyed: ${summary.defenderDestroyedCards.length > 0 ? summary.defenderDestroyedCards.join(', ') : 'None'}`,
      `Outcome: ${
        summary.outcome === 'defender_retreated' 
          ? `Player (${summary.defender}) retreated to ${summary.retreatTo}` 
          : summary.outcome === 'attacker_captured'
          ? `Player (${summary.attacker}) captured the cell`
          : `Player (${summary.defender}) held the cell`
      }`
    ].join('\n');

    return (
      <div 
        key={grouped.key} 
        title={tooltipText}
        className="text-xs text-neutral-305 py-1 border-b border-neutral-800/40 leading-relaxed font-mono cursor-help hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-red-400 font-bold">⚔️</span>
          <span className="text-neutral-400 font-semibold">{summary.cell}</span>
          <span className="text-neutral-500">:</span>
          <span className={`${attColor} font-bold`}>(X)</span>
          <span className="text-neutral-500 text-[10px]">vs</span>
          <span className={`${defColor} font-bold`}>(O)</span>
        </div>

        {summary.outcome === 'defender_retreated' ? (
          <div className="flex items-center gap-1 mt-0.5 pl-5 flex-wrap">
            <span className="text-blue-400 font-bold">🏃</span>
            <span className={`${defColor} font-bold`}>
              ({summary.defender})
            </span>
            <span className="text-neutral-400">fled to</span>
            <span className="text-neutral-300 font-semibold">{summary.retreatTo}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-0.5 pl-5 flex-wrap">
            <span className="text-red-400/80 font-bold text-[10px]">💀</span>
            {(xLostCards.length > 0 || oLostCards.length > 0) ? (
              <>
                {xLostCards.length > 0 && (
                  <span className="text-blue-400 font-semibold">
                    (X) {formatDestroyedList(xLostCards)}
                  </span>
                )}
                {oLostCards.length > 0 && (
                  <span className="text-rose-400 font-semibold">
                    (O) {formatDestroyedList(oLostCards)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-neutral-500 italic text-[10px]">No casualties</span>
            )}
            <span className={`ml-auto font-bold text-[10px] uppercase tracking-wider ${
              summary.outcome === 'attacker_captured' ? 'text-amber-400' : 'text-neutral-500'
            }`}>
              {summary.outcome === 'attacker_captured' ? 'Capture' : 'Held'}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (grouped.isJson && grouped.action) {
    const action = grouped.action;
    const playerColor = action.player === 'X' ? 'text-blue-400' : 'text-rose-400';
    let label: string;
    let emoji = '';
    
    if (action.type === 'deploy' || action.type === 'deploy_all') {
      emoji = '🛖';
      label = `Deploy x${action.count} at ${action.cellKey}`;
    } else if (action.type === 'move') {
      emoji = '🚀';
      label = `Move x${action.count} ${action.from} → ${action.to}`;
    } else if (action.type === 'react') {
      emoji = action.reactType === 'retreat' ? '🏃' : '🛡️';
      label = action.reactType === 'retreat' 
        ? `Retreat to ${action.retreatTo}` 
        : `Fight at ${action.cellKey}`;
    } else if (action.type === 'end_turn') {
      return (
        <div key={grouped.key} className="text-xs text-neutral-500 py-1 font-bold text-center border-b border-neutral-800/40 tracking-widest uppercase mt-2">
          --- {action.player} End Turn ---
        </div>
      );
    } else {
      label = `Action: ${action.type}`;
    }

    return (
      <div key={grouped.key} className="text-xs text-neutral-300 py-0.5 leading-relaxed font-mono flex items-center gap-1.5 flex-wrap px-1 rounded hover:bg-neutral-800/30 transition-colors">
        <span className="opacity-80 w-4 text-center">{emoji}</span>
        <span className={`${playerColor} font-bold opacity-90`}>({action.player})</span>
        <span>{label}</span>
      </div>
    );
  }

  // Fallback for unparsed raw logs
  return (
    <div key={grouped.key} className="text-xs text-neutral-500 py-0.5 leading-relaxed font-mono truncate px-1" title={grouped.rawLog}>
      {grouped.rawLog}
    </div>
  );
}
