import type { HolyGrailGameState, HolyGrailCell, PlayerPiece, HolyGrailCard } from "@vibe-games/shared";

export const HEX_SIZE = 45;
export const WIDTH = 560;
export const HEIGHT = 560;
export const CENTER_X = WIDTH / 2;
export const CENTER_Y = HEIGHT / 2;

// Standard flat-topped hex center mapping
export function getHexCenter(q: number, r: number) {
  const cx = CENTER_X + HEX_SIZE * (3 / 2) * q;
  const cy = CENTER_Y + HEX_SIZE * Math.sqrt(3) * (r + q / 2);
  return { cx, cy };
}

// Generate the coordinates of the 6 corners of a flat-topped hex
export function getHexPoints(cx: number, cy: number, size: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angleRad);
    const y = cy + size * Math.sin(angleRad);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

// Helper to translate card value to display card string
export function formatCardValue(value: number): string {
  if (value === 0) return '?';
  if (value === 13) return 'K';
  if (value === 12) return 'Q';
  if (value === 11) return 'J';
  return value.toString();
}

export function parseCardLabel(label: string): number {
  if (!label) return 0;
  label = label.trim();
  const lower = label.toLowerCase();
  if (lower.includes('king') || lower === 'k') return 13;
  if (lower.includes('queen') || lower === 'q') return 12;
  if (lower.includes('jack') || lower === 'j') return 11;
  const num = parseInt(label, 10);
  return isNaN(num) ? 0 : num;
}

export interface TempVisualMove {
  from: string;
  to: string;
  count: number;
  player?: PlayerPiece;
  isRetreat?: boolean;
}
export interface TempVisualDeploy {
  cellKey: string;
  count: number;
}
export interface TempVisualRadioactivity {
  cellKey: string;
  player: PlayerPiece | 'neutral';
  card: string;
}
export interface RolledBackState {
  board: Record<string, HolyGrailCell>;
  grailCellKey: string;
}

export interface AggregatedMove {
  from: string;
  to: string;
  cards: HolyGrailCard[];
  carriesGrail: boolean;
}

export interface AggregatedReviewMove {
  from: string;
  to: string;
  count: number;
  player?: PlayerPiece;
  isRetreat?: boolean;
}

export function getAggregatedFriendlyMoves(moves: { from: string; to: string; cards: HolyGrailCard[]; carriesGrail?: boolean }[]): AggregatedMove[] {
  const map = new Map<string, AggregatedMove>();
  for (const m of moves) {
    const key = `${m.from}->${m.to}`;
    const existing = map.get(key);
    if (existing) {
      existing.cards = [...existing.cards, ...m.cards];
      if (m.carriesGrail) existing.carriesGrail = true;
    } else {
      map.set(key, {
        from: m.from,
        to: m.to,
        cards: [...m.cards],
        carriesGrail: !!m.carriesGrail
      });
    }
  }
  return Array.from(map.values());
}

export function getAggregatedReviewMoves(moves: TempVisualMove[]): AggregatedReviewMove[] {
  const map = new Map<string, AggregatedReviewMove>();
  for (const m of moves) {
    const key = `${m.from}->${m.to}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += m.count;
    } else {
      map.set(key, {
        from: m.from,
        to: m.to,
        count: m.count,
        player: m.player,
        isRetreat: m.isRetreat
      });
    }
  }
  return Array.from(map.values());
}

export function getCellDefaultOwner(cell: HolyGrailCell): PlayerPiece | 'neutral' | null {
  if (cell.cellType === 'home_base' || cell.cellType === 'urban') {
    return cell.r < 0 ? 'X' : 'O';
  }
  return 'neutral';
}

export function rollbackBoardAndGrail(
  board: Record<string, HolyGrailCell>,
  grailCellKey: string | undefined,
  reviewDeploys: TempVisualDeploy[],
  reviewMoves: TempVisualMove[],
  oppPiece: PlayerPiece
): RolledBackState {
  const rolledBoard: Record<string, HolyGrailCell> = JSON.parse(JSON.stringify(board));
  let rolledGrailKey = grailCellKey || '0,0';

  // 1. Rollback moves in reverse order
  for (let i = reviewMoves.length - 1; i >= 0; i--) {
    const move = reviewMoves[i];
    const fromCell = rolledBoard[move.from];
    const toCell = rolledBoard[move.to];
    if (fromCell && toCell) {
      if (rolledGrailKey === move.to) {
        rolledGrailKey = move.from;
      }

      const countToTake = Math.min(move.count, toCell.soldiers.length);
      
      const taken: HolyGrailCard[] = [];
      for (let c = 0; c < countToTake; c++) {
        const popped = toCell.soldiers.pop();
        if (popped) taken.push(popped);
      }

      while (taken.length < move.count) {
        taken.push({ value: 10, revealed: false });
      }

      if (move.isRetreat) {
        fromCell.soldiers.unshift(...taken);
      } else {
        fromCell.soldiers.push(...taken);
      }
      fromCell.owner = move.player || oppPiece;

      if (toCell.soldiers.length === 0) {
        toCell.owner = getCellDefaultOwner(toCell);
      }
    }
  }

  // 2. Rollback deploys
  for (const deploy of reviewDeploys) {
    const cell = rolledBoard[deploy.cellKey];
    if (cell) {
      for (let c = 0; c < deploy.count; c++) {
        cell.soldiers.pop();
      }
      if (cell.soldiers.length === 0) {
        cell.owner = getCellDefaultOwner(cell);
      }
    }
  }

  return {
    board: rolledBoard,
    grailCellKey: rolledGrailKey
  };
}

export function formatCardString(cardStr: string): string {
  if (!cardStr) return '?';
  if (cardStr.includes(',')) {
    return '[' + cardStr.split(',').map(s => formatCardValue(parseCardLabel(s.trim()))).join(', ') + ']';
  }
  return formatCardValue(parseCardLabel(cardStr));
}


export function parseCombatText(log: string) {
  const cellMatch = log.match(/\bat\s+([^:]+):/);
  const cell = cellMatch ? cellMatch[1].trim() : '';
  
  const attMatch = log.match(/Attacker\s+\(([XO])\)'s\s+(.*?)\s+vs/);
  const attackerPiece = attMatch ? attMatch[1] : '';
  const attackerCard = attMatch ? attMatch[2].trim() : '';
  
  const defMatch = log.match(/Defender\s+\(([XO])\)'s\s+([^.]+)\./);
  const defenderPiece = defMatch ? defMatch[1] : '';
  let defenderCard = defMatch ? defMatch[2].trim() : '';
  if (defenderCard.startsWith('[')) {
    defenderCard = defenderCard.replace(/\[|\]/g, '');
  }

  let winnerText = '';
  if (log.includes('Attacker wins')) winnerText = 'Attacker';
  else if (log.includes('Defender chooses') && log.includes('wins')) winnerText = 'Defender';
  else if (log.includes('Defender wins')) winnerText = 'Defender';
  else if (log.includes('Draw!')) winnerText = 'Draw';

  const degradeMatch = log.match(/degrades\s+to\s+([^\s.]+)/);
  const degradedVal = degradeMatch ? degradeMatch[1].trim() : '';

  if (!attackerPiece) {
    const fallbackAtt = log.includes('Attacker (X)') ? 'X' : log.includes('Attacker (O)') ? 'O' : 'X';
    const fallbackDef = fallbackAtt === 'X' ? 'O' : 'X';
    return { 
      cell, 
      attackerPiece: fallbackAtt, 
      attackerCard: attackerCard || '?', 
      defenderPiece: fallbackDef, 
      defenderCard: defenderCard || '?', 
      winnerText, 
      degradedVal 
    };
  }

  return { cell, attackerPiece, attackerCard, defenderPiece, defenderCard, winnerText, degradedVal };
}

export function parseRetreatText(log: string) {
  const cellMatch = log.match(/\bat\s+([^:]+):/);
  let cell = cellMatch ? cellMatch[1].trim() : '';
  if (cell === 'Grail Center') cell = '0,0';

  const defMatch = log.match(/Defender\s+\(([XO])\)\s+retreated\s+to\s+([^\s.]+)/);
  const defenderPiece = defMatch ? defMatch[1] : '';
  const retreatTo = defMatch ? defMatch[2] : '';

  const countMatch = log.match(/retreated\s+to\s+[^\s]+\s+with\s+(\d+)\s+unit/);
  const defenderCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  const attMatch = log.match(/Attacker\s+\(([XO])\)\s+captures/);
  const attackerPiece = attMatch ? attMatch[1] : '';

  return { cell, defenderPiece, retreatTo, attackerPiece, defenderCount };
}

export function parseRadioactiveText(log: string) {
  const match = log.match(/☢️ Radioactivity at ([^:]+):\s*\(([XO])\)\s*💀\s*(.+)/);
  if (match) {
    return {
      cell: match[1].trim(),
      player: match[2],
      card: match[3].trim()
    };
  }
  return null;
}

export interface GroupedLog {
  key: string;
  isJson: boolean;
  rawLog?: string;
  action?: {
    type: string;
    player: string;
    count: number;
    cellKey?: string;
    from?: string;
    to?: string;
    reactType?: string;
    retreatTo?: string;
  };
  combatSummary?: {
    cell: string;
    attacker: string;
    defender: string;
    attackerLostCount: number;
    defenderLostCount: number;
    attackerDestroyedCards: string[];
    defenderDestroyedCards: string[];
    outcome: 'attacker_captured' | 'defender_held' | 'defender_retreated';
    retreatTo?: string;
    rawLogs: string[];
  };
  radioactiveSummary?: {
    cell: string;
    player: string;
    card: string;
  };
}

export interface CombatSummary {
  cell: string;
  attacker: string;
  defender: string;
  attackerLostCount: number;
  defenderLostCount: number;
  attackerDestroyedCards: string[];
  defenderDestroyedCards: string[];
  outcome: 'attacker_captured' | 'defender_held' | 'defender_retreated';
  retreatTo?: string;
  rawLogs: string[];
}

export function parseCombatSummary(logs: string[]): CombatSummary | null {
  if (logs.length === 0) return null;

  let cell = '';
  let attacker = '';
  let defender = '';
  let attackerLostCount = 0;
  let defenderLostCount = 0;
  const attackerDestroyedCards: string[] = [];
  const defenderDestroyedCards: string[] = [];
  let outcome: 'attacker_captured' | 'defender_held' | 'defender_retreated' = 'defender_held';
  let retreatTo = '';

  for (const log of logs) {
    const isRetreat = log.includes('🏃') || log.toLowerCase().includes('retreat');
    if (isRetreat) {
      const info = parseRetreatText(log);
      if (info.cell) {
        cell = info.cell;
        defender = info.defenderPiece;
        attacker = info.attackerPiece;
        retreatTo = info.retreatTo;
        outcome = 'defender_retreated';
      }
    } else {
      const info = parseCombatText(log);
      if (info.cell) {
        cell = info.cell;
        attacker = info.attackerPiece;
        defender = info.defenderPiece;
        
        if (info.winnerText === 'Attacker') {
          defenderLostCount++;
          defenderDestroyedCards.push(info.defenderCard);
          outcome = 'attacker_captured';
        } else if (info.winnerText === 'Defender') {
          attackerLostCount++;
          attackerDestroyedCards.push(info.attackerCard);
          outcome = 'defender_held';
        } else if (info.winnerText === 'Draw') {
          attackerLostCount++;
          defenderLostCount++;
          attackerDestroyedCards.push(info.attackerCard);
          defenderDestroyedCards.push(info.defenderCard);
          outcome = 'defender_held';
        }
      }
    }
  }

  if (!cell) return null;

  return {
    cell,
    attacker,
    defender,
    attackerLostCount,
    defenderLostCount,
    attackerDestroyedCards,
    defenderDestroyedCards,
    outcome,
    retreatTo,
    rawLogs: logs
  };
}

export function getGroupedHistory(history: string[]): GroupedLog[] {
  if (!history || history.length === 0) return [];

  const grouped: GroupedLog[] = [];
  let currentCombatLogs: string[] = [];
  let currentCombatCell: string | null = null;

  const flushCombat = () => {
    if (currentCombatLogs.length > 0) {
      const summary = parseCombatSummary(currentCombatLogs);
      if (summary) {
        grouped.push({
          key: `combat-summary-${grouped.length}`,
          isJson: false,
          combatSummary: summary
        });
      } else {
        currentCombatLogs.forEach((log, index) => {
          grouped.push({
            key: `combat-fallback-${grouped.length}-${index}`,
            isJson: false,
            rawLog: log
          });
        });
      }
      currentCombatLogs = [];
      currentCombatCell = null;
    }
  };

  for (let i = 0; i < history.length; i++) {
    const raw = history[i];
    const isJson = raw.trim().startsWith('{');

    if (isJson) {
      try {
        const action = JSON.parse(raw);
        const type = action.type || action.action;

        if (type === 'react') {
          continue;
        }

        if (type === 'radioactivity') {
          flushCombat();
          grouped.push({
            key: `radioactive-${grouped.length}`,
            isJson: true,
            radioactiveSummary: {
              cell: action.cell,
              player: action.player,
              card: action.card
            }
          });
          continue;
        }

        flushCombat();


        // Merge consecutive deploys on same cell, or consecutive moves between same cells
        const last = grouped[grouped.length - 1];
        if (last && last.isJson && last.action) {
          const lastType = last.action.type;
          const lastPlayer = last.action.player;

          const isBothDeploy = (type === 'deploy' || type === 'deploy_all') && 
                              (lastType === 'deploy' || lastType === 'deploy_all');
          const isBothMove = (type === 'move' && lastType === 'move');

          if (isBothDeploy && lastPlayer === action.player && last.action.cellKey === action.cellKey) {
            const currentCount = action.count !== undefined ? action.count : 1;
            last.action.count += currentCount;
            continue;
          }

          if (isBothMove && lastPlayer === action.player && last.action.from === action.from && last.action.to === action.to) {
            const currentCount = action.count !== undefined ? action.count : 1;
            last.action.count += currentCount;
            continue;
          }
        }

        grouped.push({
          key: `action-${grouped.length}`,
          isJson: true,
          action: {
            type,
            player: action.player,
            count: action.count !== undefined ? action.count : 1,
            cellKey: action.cellKey,
            from: action.from,
            to: action.to,
            reactType: action.reactType,
            retreatTo: action.retreatTo
          }
        });
      } catch {
        grouped.push({
          key: `raw-err-${grouped.length}`,
          isJson: false,
          rawLog: raw
        });
      }
      continue;
    }

    const isRadioactivityLog = raw.includes('☢️') || raw.toLowerCase().includes('radioactivity');
    if (isRadioactivityLog) {
      flushCombat();
      const info = parseRadioactiveText(raw);
      if (info) {
        grouped.push({
          key: `radioactive-${grouped.length}`,
          isJson: false,
          radioactiveSummary: info
        });
      } else {
        grouped.push({
          key: `raw-text-${grouped.length}`,
          isJson: false,
          rawLog: raw
        });
      }
      continue;
    }

    const isCombatLog = raw.includes('⚔️') || raw.toLowerCase().includes('combat') || raw.toLowerCase().includes('vs');
    const isRetreatLog = raw.includes('🏃') || raw.toLowerCase().includes('retreat');

    if (isCombatLog || isRetreatLog) {
      let logCell: string;
      if (isCombatLog) {
        const info = parseCombatText(raw);
        logCell = info.cell;
      } else {
        const info = parseRetreatText(raw);
        logCell = info.cell;
      }

      if (logCell) {
        if (currentCombatCell && currentCombatCell !== logCell) {
          flushCombat();
        }
        currentCombatCell = logCell;
        currentCombatLogs.push(raw);
      } else {
        flushCombat();
        grouped.push({
          key: `raw-text-${grouped.length}`,
          isJson: false,
          rawLog: raw
        });
      }
    } else {
      flushCombat();
      grouped.push({
        key: `raw-text-${grouped.length}`,
        isJson: false,
        rawLog: raw
      });
    }
  }

  flushCombat();
  return grouped;
}

export function renderGroupedHistoryEntry(grouped: GroupedLog) {
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
          : `Player (${summary.defender}) defended the cell`
      }`,
      `\nDuel History:`,
      ...summary.rawLogs.map(rawLog => {
        const isCombat = rawLog.includes('⚔️') || rawLog.toLowerCase().includes('combat') || rawLog.toLowerCase().includes('vs');
        const isRetreat = rawLog.includes('🏃') || rawLog.toLowerCase().includes('retreat');
        if (isCombat) {
          const info = parseCombatText(rawLog);
          const attCardFormatted = formatCardString(info.attackerCard);
          const defCardFormatted = formatCardString(info.defenderCard);
          
          if (info.winnerText === 'Draw') {
            return ` • ${attCardFormatted} (${info.attackerPiece}) vs ${defCardFormatted} (${info.defenderPiece}) -> Draw`;
          } else {
            const isAttackerWinner = info.winnerText === 'Attacker';
            const winnerPiece = isAttackerWinner ? info.attackerPiece : info.defenderPiece;
            const originalCard = isAttackerWinner 
              ? info.attackerCard 
              : (info.defenderCard.includes(',') ? info.defenderCard.split(',')[0].trim() : info.defenderCard);
            const winnerCard = info.degradedVal ? formatCardString(info.degradedVal) : formatCardString(originalCard);
            return ` • ${attCardFormatted} (${info.attackerPiece}) vs ${defCardFormatted} (${info.defenderPiece}) -> ${winnerCard} (${winnerPiece})`;
          }
        }
        if (isRetreat) {
          const info = parseRetreatText(rawLog);
          return ` • Defender (${info.defenderPiece}) retreated to ${info.retreatTo}`;
        }
        return ` • ${rawLog}`;
      })
    ].join('\n');

    return (
      <div 
        key={grouped.key} 
        title={tooltipText}
        className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex flex-col items-start cursor-help hover:bg-neutral-800/30 px-1 rounded transition-colors"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${attColor} font-bold`}>({summary.attacker})</span>
          <span className="text-red-400 font-bold">⚔️</span>
          <span className="text-neutral-400 font-semibold">{summary.cell}</span>
          <span className="text-neutral-500">vs</span>
          <span className={`${defColor} font-bold`}>({summary.defender})</span>
          <span className="text-neutral-500">:</span>
        </div>

        <div className="flex items-center gap-1.5 pl-6 flex-wrap mt-0.5">
          {summary.outcome === 'defender_retreated' ? (
            <>
              <span className={`${defColor} font-bold`}>({summary.defender})</span>
              <span className="text-amber-500 font-bold">🏃</span>
              <span className="text-neutral-400 font-semibold">{summary.retreatTo}</span>
            </>
          ) : summary.outcome === 'attacker_captured' ? (
            <>
              <span className={`${attColor} font-bold`}>({summary.attacker})</span>
              <span className="text-indigo-400 font-bold">📥</span>
            </>
          ) : (
            <>
              <span className={`${defColor} font-bold`}>({summary.defender})</span>
              <span className="text-emerald-400 font-bold">🛡️</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 pl-6 text-xs text-neutral-400 select-none leading-relaxed mt-0.5">
          <span>💀</span>
          <span className="text-blue-400 font-bold">{formatDestroyedList(xLostCards)}</span>
          <span className="text-neutral-500">vs</span>
          <span className="text-rose-400 font-bold">{formatDestroyedList(oLostCards)}</span>
        </div>
      </div>
    );
  }

  if (grouped.isJson && grouped.action) {
    const action = grouped.action;
    const playerColor = action.player === 'X' ? 'text-blue-400' : action.player === 'O' ? 'text-rose-400' : 'text-neutral-400';

    if (action.type === 'deploy' || action.type === 'deploy_all') {
      return (
        <div key={grouped.key} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5">
          <span className={`${playerColor} font-bold`}>({action.player})</span>
          <span className="text-indigo-400 font-bold">📥</span>
          <span className="font-bold text-white">{action.count}</span>
          <span className="text-neutral-500">at</span>
          <span className="text-neutral-400 font-semibold">{action.cellKey}</span>
        </div>
      );
    }
    if (action.type === 'move') {
      return (
        <div key={grouped.key} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5">
          <span className={`${playerColor} font-bold`}>({action.player})</span>
          <span className="text-emerald-450 font-bold">🏃</span>
          <span className="font-bold text-white">{action.count}</span>
          <span className="text-neutral-400 font-semibold">{action.from} ➡️ {action.to}</span>
        </div>
      );
    }
    if (action.type === 'end_deploy') {
      return (
        <div key={grouped.key} className="text-xs text-neutral-400 italic py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5">
          <span className={`${playerColor} font-bold`}>({action.player})</span>
          <span className="font-semibold text-neutral-500">🏁 Completed Deploy</span>
        </div>
      );
    }
    if (action.type === 'end_turn') {
      return (
        <div key={grouped.key} className="text-xs text-neutral-400 italic py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5">
          <span className={`${playerColor} font-bold`}>({action.player})</span>
          <span className="font-semibold text-neutral-500">⌛ Ended Turn</span>
        </div>
      );
    }
    if (action.type === 'react') {
      return (
        <div key={grouped.key} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5">
          <span className={`${playerColor} font-bold`}>({action.player})</span>
          <span className="text-amber-400 font-bold">🛡️</span>
          <span>{action.reactType === 'retreat' ? `Retreated to ${action.retreatTo}` : `Defended at ${action.cellKey}`}</span>
        </div>
      );
    }
  }

  const rawLog = grouped.rawLog || '';
  const isCombat = rawLog.includes('⚔️') || rawLog.toLowerCase().includes('combat') || rawLog.toLowerCase().includes('vs');
  const isRetreat = rawLog.includes('🏃') || rawLog.toLowerCase().includes('retreat');

  if (isCombat) {
    const info = parseCombatText(rawLog);
    if (info.cell) {
      const attColor = info.attackerPiece === 'X' ? 'text-blue-400' : 'text-rose-400';
      const defColor = info.defenderPiece === 'X' ? 'text-blue-400' : 'text-rose-400';
      const winnerColor = info.winnerText === 'Attacker' ? attColor : info.winnerText === 'Defender' ? defColor : 'text-neutral-400';

      return (
        <div key={grouped.key} className="text-xs py-1 border-b border-neutral-800/40 leading-normal text-neutral-300 font-mono flex items-center gap-1.5 flex-wrap">
          <span className={`${attColor} font-bold`}>({info.attackerPiece})</span>
          <span className="text-red-400 font-bold">⚔️</span>
          <span className={`${defColor} font-bold`}>({info.defenderPiece})</span>
          <span className="text-neutral-500">at</span>
          <span className="text-neutral-400 font-semibold">{info.cell}</span>
          <span className="text-neutral-500">:</span>
          <span className="text-white font-bold">{info.attackerCard}</span>
          <span className="text-neutral-500">vs</span>
          <span className="text-white font-bold">{info.defenderCard}</span>
          <span className="text-neutral-400">➡️</span>
          {info.winnerText === 'Draw' ? (
            <span className="text-neutral-500 font-bold">💀 Draw</span>
          ) : (
            <>
              <span className={`${winnerColor} font-bold`}>
                ({info.winnerText === 'Attacker' ? info.attackerPiece : info.defenderPiece})
              </span>
              {info.degradedVal && (
                <span className="text-neutral-400 font-semibold">[{info.degradedVal}]</span>
              )}
            </>
          )}
        </div>
      );
    }
  }

  if (isRetreat) {
    const info = parseRetreatText(rawLog);
    if (info.cell) {
      const defColor = info.defenderPiece === 'X' ? 'text-blue-400' : 'text-rose-400';
      const attColor = info.attackerPiece === 'X' ? 'text-blue-400' : 'text-rose-400';

      return (
        <div key={grouped.key} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed font-mono flex items-center gap-1.5 flex-wrap">
          <span className={`${defColor} font-bold`}>({info.defenderPiece})</span>
          <span className="text-amber-500 font-bold">🏃</span>
          <span className="text-neutral-500">retreat to</span>
          <span className="text-neutral-400 font-semibold">{info.retreatTo}</span>
          <span className="text-neutral-500">|</span>
          <span className={`${attColor} font-bold`}>({info.attackerPiece})</span>
          <span className="text-indigo-400 font-bold">📥</span>
          <span className="text-neutral-400 font-semibold">{info.cell}</span>
        </div>
      );
    }
  }

  return (
    <div key={grouped.key} className="text-xs text-neutral-300 py-1 border-b border-neutral-800/40 leading-relaxed">
      {rawLog}
    </div>
  );
}

export interface HolyGrailBoardProps {
  state: HolyGrailGameState;
  myPiece: PlayerPiece | null;
  disabled: boolean;
  submittingMove: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction: (action: any) => Promise<void>;
}

