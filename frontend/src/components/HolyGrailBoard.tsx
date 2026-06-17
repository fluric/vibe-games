import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { 
  HolyGrailGameState, 
  HolyGrailCell, 
  PlayerPiece, 
  PendingCombat,
  HolyGrailCard
} from '@vibe-games/shared';
import * as audio from './AudioEffects';

const HEX_SIZE = 45;
const WIDTH = 560;
const HEIGHT = 560;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

// Standard flat-topped hex center mapping
function getHexCenter(q: number, r: number) {
  const cx = CENTER_X + HEX_SIZE * (3 / 2) * q;
  const cy = CENTER_Y + HEX_SIZE * Math.sqrt(3) * (r + q / 2);
  return { cx, cy };
}

// Generate the coordinates of the 6 corners of a flat-topped hex
function getHexPoints(cx: number, cy: number, size: number): string {
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
function formatCardValue(value: number): string {
  if (value === 0) return '?';
  if (value === 13) return 'K';
  if (value === 12) return 'Q';
  if (value === 11) return 'J';
  return value.toString();
}

function parseCardLabel(label: string): number {
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
}
export interface TempVisualDeploy {
  cellKey: string;
  count: number;
}
interface RolledBackState {
  board: Record<string, HolyGrailCell>;
  grailCellKey: string;
}

interface AggregatedMove {
  from: string;
  to: string;
  cards: HolyGrailCard[];
  carriesGrail: boolean;
}

interface AggregatedReviewMove {
  from: string;
  to: string;
  count: number;
}

function getAggregatedFriendlyMoves(moves: { from: string; to: string; cards: HolyGrailCard[]; carriesGrail?: boolean }[]): AggregatedMove[] {
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

function getAggregatedReviewMoves(moves: TempVisualMove[]): AggregatedReviewMove[] {
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
        count: m.count
      });
    }
  }
  return Array.from(map.values());
}

function getCellDefaultOwner(cell: HolyGrailCell): PlayerPiece | 'neutral' | null {
  if (cell.cellType === 'home_base' || cell.cellType === 'urban') {
    return cell.r < 0 ? 'X' : 'O';
  }
  return 'neutral';
}

function rollbackBoardAndGrail(
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

      fromCell.soldiers.push(...taken);
      fromCell.owner = oppPiece;

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

function formatCardString(cardStr: string): string {
  if (!cardStr) return '?';
  if (cardStr.includes(',')) {
    return '[' + cardStr.split(',').map(s => formatCardValue(parseCardLabel(s.trim()))).join(', ') + ']';
  }
  return formatCardValue(parseCardLabel(cardStr));
}


function parseCombatText(log: string) {
  const cellMatch = log.match(/\bat\s+([^:]+):/);
  const cell = cellMatch ? cellMatch[1].trim() : '';
  
  const attMatch = log.match(/Attacker\s+\(([XO])\)'s\s+([^\s]+)\s+vs/);
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

function parseRetreatText(log: string) {
  const cellMatch = log.match(/\bat\s+([^:]+):/);
  const cell = cellMatch ? cellMatch[1].trim() : '';

  const defMatch = log.match(/Defender\s+\(([XO])\)\s+retreated\s+to\s+([^\s.]+)/);
  const defenderPiece = defMatch ? defMatch[1] : '';
  const retreatTo = defMatch ? defMatch[2] : '';

  const attMatch = log.match(/Attacker\s+\(([XO])\)\s+captures/);
  const attackerPiece = attMatch ? attMatch[1] : '';

  return { cell, defenderPiece, retreatTo, attackerPiece };
}

function parseRadioactiveText(log: string) {
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

interface GroupedLog {
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

interface CombatSummary {
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

function parseCombatSummary(logs: string[]): CombatSummary | null {
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

function getGroupedHistory(history: string[]): GroupedLog[] {
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

function renderGroupedHistoryEntry(grouped: GroupedLog) {
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

interface HolyGrailBoardProps {
  state: HolyGrailGameState;
  myPiece: PlayerPiece | null;
  disabled: boolean;
  submittingMove: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction: (action: any) => Promise<void>;
}

export const HolyGrailBoard: React.FC<HolyGrailBoardProps> = ({
  state,
  myPiece,
  disabled,
  submittingMove,
  onAction
}) => {
  const { board: stateBoard, hands, phase, turn, winner, pendingCombats, grailCellKey: stateGrailCellKey = '0,0' } = state;

  const { id: gameId } = useParams<{ id: string }>();

  const [isReviewingLastTurn, setIsReviewingLastTurn] = useState<boolean>(false);
  const [reviewMoves, setReviewMoves] = useState<TempVisualMove[]>([]);
  const [reviewDeploys, setReviewDeploys] = useState<TempVisualDeploy[]>([]);
  const [lastReviewedEndTurnIdx, setLastReviewedEndTurnIdx] = useState<number>(-1);
  const [isLogCollapsed, setIsLogCollapsed] = useState<boolean>(true);

  const isMyTurn = turn === myPiece && !winner;
  const history = useMemo(() => state.history || [], [state.history]);

  const aggregatedFriendlyMoves = useMemo(() => {
    return getAggregatedFriendlyMoves(state.movesThisTurn || []);
  }, [state.movesThisTurn]);

  const aggregatedReviewMoves = useMemo(() => {
    return getAggregatedReviewMoves(reviewMoves);
  }, [reviewMoves]);

  // Find the last index of our own end_turn action
  let lastSelfEndTurnIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    const log = history[i];
    if (typeof log === 'string' && log.trim().startsWith('{')) {
      try {
        const action = JSON.parse(log);
        if (action.player === myPiece && (action.type === 'end_turn' || action.action === 'end_turn')) {
          lastSelfEndTurnIdx = i;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  // Cache is now updated at the end of our turn inside the endTurn handler to capture finalized user positions.

  // Determine displaying board state
  const getDisplayedState = (): { board: Record<string, HolyGrailCell>; grailCellKey: string } => {
    const defaultState = {
      board: stateBoard,
      grailCellKey: stateGrailCellKey || '0,0'
    };

    if (!isReviewingLastTurn) {
      return defaultState;
    }

    // Attempt to load from sessionStorage
    try {
      const cached = sessionStorage.getItem(`pre-board-${gameId || 'default'}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.board) {
          return {
            board: parsed.board,
            grailCellKey: parsed.grailCellKey || '0,0'
          };
        }
      }
    } catch {
      // ignore
    }

    // Fallback: Rollback using history
    const oppPiece = myPiece === 'X' ? 'O' : 'X';
    return rollbackBoardAndGrail(stateBoard, stateGrailCellKey, reviewDeploys, reviewMoves, oppPiece);
  };

  const { board, grailCellKey } = getDisplayedState();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!state.winner) {
      if (isMyTurn) {
        // Check if we are in the middle of our turn (already took deploy/move actions in current turn)
        let isMiddleOfTurn = false;
        for (let i = history.length - 1; i >= 0; i--) {
          const log = history[i];
          if (typeof log === 'string' && log.trim().startsWith('{')) {
            try {
              const action = JSON.parse(log);
              if (action.player) {
                if (action.player === myPiece) {
                  if (action.type !== 'end_turn' && action.action !== 'end_turn') {
                    isMiddleOfTurn = true;
                  }
                }
                break; // Found the latest JSON action, stop searching
              }
            } catch {
              // ignore
            }
          }
        }

        if (isMiddleOfTurn) {
          setLastReviewedEndTurnIdx(lastSelfEndTurnIdx);
          setIsReviewingLastTurn(false);
          setReviewMoves([]);
          setReviewDeploys([]);
          return;
        }

        if (lastSelfEndTurnIdx > lastReviewedEndTurnIdx) {
          // Check if there are any opponent JSON actions after our last end_turn
          const sliceStart = lastSelfEndTurnIdx + 1;
          let hasOppAction = false;
          const opponentMoves: TempVisualMove[] = [];
          const opponentDeploys: TempVisualDeploy[] = [];

          for (let i = sliceStart; i < history.length; i++) {
            const log = history[i];
            if (typeof log === 'string' && log.trim().startsWith('{')) {
              try {
                const action = JSON.parse(log);
                if (action.player && action.player !== myPiece) {
                  hasOppAction = true;
                  const type = action.type || action.action;
                  if (type === 'move' && action.from && action.to) {
                    opponentMoves.push({
                      from: action.from,
                      to: action.to,
                      count: action.count || 1
                    });
                  } else if ((type === 'deploy' || type === 'deploy_all') && action.cellKey) {
                    const existing = opponentDeploys.find(d => d.cellKey === action.cellKey);
                    const count = action.count !== undefined ? action.count : 1;
                    if (existing) {
                      existing.count += count;
                    } else {
                      opponentDeploys.push({
                        cellKey: action.cellKey,
                        count
                      });
                    }
                  }
                }
              } catch {
                // ignore
              }
            }
          }

          if (hasOppAction) {
            setIsReviewingLastTurn(true);
            setReviewMoves(opponentMoves);
            setReviewDeploys(opponentDeploys);
          } else {
            setIsReviewingLastTurn(false);
            setReviewMoves([]);
            setReviewDeploys([]);
            setLastReviewedEndTurnIdx(lastSelfEndTurnIdx);
          }
        } else {
          setIsReviewingLastTurn(false);
          setReviewMoves([]);
          setReviewDeploys([]);
        }
      } else {
        setIsReviewingLastTurn(false);
        setReviewMoves([]);
        setReviewDeploys([]);
      }
    }
  }, [isMyTurn, history, myPiece, state.winner, lastSelfEndTurnIdx, lastReviewedEndTurnIdx]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isBoardLocked = disabled || isReviewingLastTurn;

  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [moveTargetKey, setMoveTargetKey] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState<number>(1);
  const [selectedHandCardIndex, setSelectedHandCardIndex] = useState<number | null>(null);
  const [activeCombatCellKey, setActiveCombatCellKey] = useState<string | null>(null);
  const [retreatTargetKey, setRetreatTargetKey] = useState<string | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const [hoveredMoveIdx, setHoveredMoveIdx] = useState<number | null>(null);

  const [displayedCombat, setDisplayedCombat] = useState<PendingCombat | null>(null);
  const [displayedAttackerVal, setDisplayedAttackerVal] = useState<number | undefined>(undefined);
  const [displayedDefenderVal, setDisplayedDefenderVal] = useState<number | undefined>(undefined);
  const [displayedDefenderVal2, setDisplayedDefenderVal2] = useState<number | undefined>(undefined);
  const [displayedDefenderStack, setDisplayedDefenderStack] = useState<HolyGrailCard[]>([]);
  
  const [isRevealingAttacker, setIsRevealingAttacker] = useState(false);
  const [isTransitioningNext, setIsTransitioningNext] = useState(false);
  
  const prevHistoryLenRef = useRef<number>(state.history?.length || 0);
  const isTransitioningRef = useRef<boolean>(false);
  const lastActiveCombatCellKeyRef = useRef<string | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPropCombat = pendingCombats.find(c => c.cellKey === activeCombatCellKey) || null;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!activeCombatCellKey) {
      setDisplayedCombat(null);
      setDisplayedAttackerVal(undefined);
      setDisplayedDefenderVal(undefined);
      setDisplayedDefenderVal2(undefined);
      setDisplayedDefenderStack([]);
      lastActiveCombatCellKeyRef.current = null;
      return;
    }

    if (lastActiveCombatCellKeyRef.current !== activeCombatCellKey && currentPropCombat) {
      const isHill = board[currentPropCombat.cellKey]?.cellType === 'hill';
      const defSoldiers = board[currentPropCombat.cellKey]?.soldiers || [];
      const hasSecondDefenderCard = isHill && defSoldiers.length >= 2;
      setDisplayedCombat(currentPropCombat);
      setDisplayedAttackerVal(currentPropCombat.attackerTopCard?.value || 0);
      setDisplayedDefenderVal(currentPropCombat.defenderTopCard?.value || 0);
      setDisplayedDefenderVal2(hasSecondDefenderCard ? (defSoldiers[1]?.value || 0) : undefined);
      setDisplayedDefenderStack(defSoldiers);
      lastActiveCombatCellKeyRef.current = activeCombatCellKey;
    }
  }, [activeCombatCellKey, currentPropCombat, board]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const history = state.history || [];
    const prevHistoryLen = prevHistoryLenRef.current;
    prevHistoryLenRef.current = history.length;

    if (history.length > prevHistoryLen && activeCombatCellKey) {
      const lastLog = history[history.length - 1];
      if (lastLog && lastLog.includes('⚔️') && lastLog.includes(activeCombatCellKey)) {
        const duel = parseCombatText(lastLog);
        if (duel) {
          isTransitioningRef.current = true;
          
          const wasAttackerKnown = displayedAttackerVal !== undefined && displayedAttackerVal > 0;

          if (!wasAttackerKnown) {
            // STAGE 1: Spin card to reveal attacker value
            setIsRevealingAttacker(true);
            setDisplayedAttackerVal(0);
          }

          const attackerRevealTimer = setTimeout(() => {
            const parsedAtt = parseCardLabel(duel.attackerCard);
            
            let parsedDef: number;
            let parsedDef2: number | undefined = undefined;

            if (duel.defenderCard.includes(',')) {
              const parts = duel.defenderCard.split(',');
              parsedDef = parseCardLabel(parts[0].trim());
              parsedDef2 = parseCardLabel(parts[1].trim());
            } else {
              parsedDef = parseCardLabel(duel.defenderCard);
            }

            setDisplayedAttackerVal(parsedAtt);
            setDisplayedDefenderVal(parsedDef);
            setDisplayedDefenderVal2(parsedDef2);
          }, wasAttackerKnown ? 0 : 200);

          // STAGE 2: Spin both cards face down, and swap to the new state
          const transitionTimer = setTimeout(() => {
            if (!wasAttackerKnown) {
              setIsRevealingAttacker(false);
            }

            // Wait for transition classes to reset, then trigger flip to next soldier
            resetDelayTimerRef.current = setTimeout(() => {
              if (currentPropCombat) {
                setIsTransitioningNext(true);
                
                const nextAttVal = currentPropCombat.attackerTopCard?.value || 0;
                const nextDefVal = currentPropCombat.defenderTopCard?.value || 0;
                const nextDefStack = board[currentPropCombat.cellKey]?.soldiers || [];
                const isHillNext = board[currentPropCombat.cellKey]?.cellType === 'hill';
                const nextDefVal2 = (isHillNext && nextDefStack.length >= 2) ? (nextDefStack[1]?.value || 0) : undefined;

                swapTimerRef.current = setTimeout(() => {
                  setDisplayedCombat(currentPropCombat);
                  setDisplayedAttackerVal(nextAttVal);
                  setDisplayedDefenderVal(nextDefVal);
                  setDisplayedDefenderVal2(nextDefVal2);
                  setDisplayedDefenderStack(nextDefStack);
                }, 200);

                endTransitionTimerRef.current = setTimeout(() => {
                  setIsTransitioningNext(false);
                  isTransitioningRef.current = false;
                }, 400);
              } else {
                isTransitioningRef.current = false;
              }
            }, wasAttackerKnown ? 0 : 50);
          }, 1400);

          return () => {
            clearTimeout(attackerRevealTimer);
            clearTimeout(transitionTimer);
            if (resetDelayTimerRef.current) clearTimeout(resetDelayTimerRef.current);
            if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
            if (endTransitionTimerRef.current) clearTimeout(endTransitionTimerRef.current);
          };
        }
      }
    }
  }, [state.history, activeCombatCellKey, currentPropCombat, board, displayedAttackerVal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [state.history?.length]);

  const activeHand = myPiece ? (hands[myPiece] || []) : [];

  const endDeploy = useCallback(async () => {
    try {
      await onAction({ type: 'end_deploy' });
      setSelectedCellKey(null);
      setSelectedHandCardIndex(null);
    } catch (e) {
      console.error(e);
    }
  }, [onAction]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Auto-advance deploy phase if hand is empty
  useEffect(() => {
    if (phase === 'deploy' && isMyTurn && activeHand.length === 0 && !isBoardLocked && !submittingMove) {
      endDeploy();
    }
  }, [phase, isMyTurn, activeHand.length, isBoardLocked, submittingMove, endDeploy]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // If active combat is resolved, close modal
  useEffect(() => {
    if (activeCombatCellKey) {
      const exists = pendingCombats.some(c => c.cellKey === activeCombatCellKey);
      if (!exists) {
        const timer = setTimeout(() => {
          setActiveCombatCellKey(null);
        }, 1800);
        return () => clearTimeout(timer);
      }
    }
  }, [pendingCombats, activeCombatCellKey]);

  // Determine distance between two cell keys
  const getCellDistance = (key1: string, key2: string) => {
    const [q1, r1] = key1.split(',').map(Number);
    const [q2, r2] = key2.split(',').map(Number);
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs((q1 + r1) - (q2 + r2))) / 2;
  };

  // Check if cell has any adjacent combat retreats
  const getAdjacentFriendlyCells = (cellKey: string): string[] => {
    if (!myPiece) return [];
    return Object.keys(board).filter(key => {
      if (board[key].owner !== myPiece) return false;
      return getCellDistance(cellKey, key) === 1;
    });
  };

  const handleCellClick = (key: string) => {
    if (isBoardLocked || !isMyTurn) return;
    const cell = board[key];

    // ── React Phase Action ──
    if (phase === 'react') {
      const combat = pendingCombats.find(c => c.cellKey === key && c.defender === myPiece);
      if (combat) {
        setActiveCombatCellKey(key);
        setRetreatTargetKey(null);
      }
      return;
    }

    // ── Deploy Phase Action ──
    if (phase === 'deploy') {
      const isValidDeployCell = cell.owner === myPiece && (
        cell.cellType === 'home_base' || cell.cellType === 'urban'
      );
      if (isValidDeployCell) {
        if (selectedHandCardIndex !== null) {
          // Instantly deploy!
          const card = activeHand[selectedHandCardIndex];
          onAction({
            type: 'deploy',
            cellKey: key,
            cardValue: card.value
          }).then(() => {
            setSelectedHandCardIndex(null);
            setSelectedCellKey(key);
          }).catch(console.error);
        } else {
          setSelectedCellKey(key === selectedCellKey ? null : key);
        }
      }
      return;
    }

    // ── Move Phase Action ──
    if (phase === 'move') {
      if (selectedCellKey === null) {
        // Select starting stack
        if (cell.owner === myPiece && cell.soldiers.length > 0) {
          setSelectedCellKey(key);
          setMoveTargetKey(null);
          setMoveCount(cell.soldiers.length);
        }
      } else {
        // If clicking same cell, deselect
        if (selectedCellKey === key) {
          setSelectedCellKey(null);
          return;
        }

        // If clicking adjacent cell, initiate move modal/slider
        const distance = getCellDistance(selectedCellKey, key);
        if (distance === 1) {
          setMoveTargetKey(key);
          const maxCount = board[selectedCellKey]?.soldiers.length || 1;
          setMoveCount(maxCount);
        } else {
          // Select another friendly stack
          if (cell.owner === myPiece && cell.soldiers.length > 0) {
            setSelectedCellKey(key);
            setMoveTargetKey(null);
            setMoveCount(cell.soldiers.length);
          } else {
            setSelectedCellKey(null);
          }
        }
      }
    }
  };

  const handleHandCardClick = (idx: number) => {
    if (isBoardLocked || !isMyTurn || phase !== 'deploy') return;
    if (selectedCellKey) {
      // Instantly deploy!
      const card = activeHand[idx];
      onAction({
        type: 'deploy',
        cellKey: selectedCellKey,
        cardValue: card.value
      }).then(() => {
        setSelectedHandCardIndex(null);
      }).catch(console.error);
    } else {
      setSelectedHandCardIndex(idx === selectedHandCardIndex ? null : idx);
    }
  };

  const executeMove = async () => {
    if (!selectedCellKey || !moveTargetKey || moveCount <= 0) return;
    try {
      await onAction({
        type: 'move',
        from: selectedCellKey,
        to: moveTargetKey,
        count: moveCount
      });
      setSelectedCellKey(null);
      setMoveTargetKey(null);
    } catch (e) {
      console.error(e);
    }
  };

  const executeFightReact = async (combat: PendingCombat) => {
    try {
      await onAction({
        type: 'react',
        cellKey: combat.cellKey,
        reactType: 'fight'
      });
      // Duel resolution is updated in-place, modal stays open if combat continues
    } catch (e) {
      console.error(e);
    }
  };

  const executeRetreatReact = async (combat: PendingCombat) => {
    if (!retreatTargetKey) return;
    try {
      await onAction({
        type: 'react',
        cellKey: combat.cellKey,
        reactType: 'retreat',
        retreatTo: retreatTargetKey
      });
      setActiveCombatCellKey(null);
      setRetreatTargetKey(null);
    } catch (e) {
      console.error(e);
    }
  };

  const endTurn = async () => {
    try {
      // 1. Construct the finalized board where all our in-transit moves are placed on their destinations
      const finalizedBoard: Record<string, HolyGrailCell> = JSON.parse(JSON.stringify(board));
      
      const friendlyTargets = new Set<string>();
      for (const move of state.movesThisTurn || []) {
        friendlyTargets.add(move.to);
      }
      
      const AXIAL_NEIGHBORS = [
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 1, r: -1 }
      ];

      const getNeighborIndex = (q_dest: number, r_dest: number, q_start: number, r_start: number): number => {
        const dq = q_start - q_dest;
        const dr = r_start - r_dest;
        return AXIAL_NEIGHBORS.findIndex(n => n.q === dq && n.r === dr);
      };

      const reassembleCellStackFrontend = (
        moves: { from: string; to: string; cards: HolyGrailCard[]; carriesGrail?: boolean }[],
        cellKey: string,
        baseSoldiers: HolyGrailCard[]
      ): HolyGrailCard[] => {
        const incoming = moves.filter(m => m.to === cellKey);
        if (incoming.length === 0) return baseSoldiers;

        const [q_dest, r_dest] = cellKey.split(',').map(Number);
        const sortedIncoming = [...incoming].sort((a, b) => {
          const [aq, ar] = a.from.split(',').map(Number);
          const [bq, br] = b.from.split(',').map(Number);
          return getNeighborIndex(q_dest, r_dest, aq, ar) - getNeighborIndex(q_dest, r_dest, bq, br);
        });

        const mergedIncoming = sortedIncoming.flatMap(m => m.cards);
        return [...baseSoldiers, ...mergedIncoming];
      };

      for (const toKey of friendlyTargets) {
        const toCell = finalizedBoard[toKey];
        if (toCell) {
          toCell.soldiers = reassembleCellStackFrontend(state.movesThisTurn || [], toKey, toCell.soldiers);
          if (myPiece) {
            toCell.owner = myPiece;
          }
        }
      }

      const cacheData = {
        board: finalizedBoard,
        grailCellKey: stateGrailCellKey
      };

      try {
        sessionStorage.setItem(`pre-board-${gameId || 'default'}`, JSON.stringify(cacheData));
      } catch (err) {
        console.error('Failed to save pre-board to sessionStorage:', err);
      }

      await onAction({ type: 'end_turn' });
      setSelectedCellKey(null);
      setSelectedHandCardIndex(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Color mapping based on cell type
  const getCellFillClass = (cell: HolyGrailCell) => {
    const isSelected = selectedCellKey === `${cell.q},${cell.r}`;
    const isMoveTarget = moveTargetKey === `${cell.q},${cell.r}`;
    const isPendingCombat = pendingCombats.some(c => c.cellKey === `${cell.q},${cell.r}`);
    const isSelectableDeployCell = phase === 'deploy' && isMyTurn && cell.owner === myPiece && (
      cell.cellType === 'home_base' || cell.cellType === 'urban'
    );

    if (isPendingCombat) {
      return 'fill-red-950/70 stroke-red-500 stroke-[2.5] animate-pulse';
    }
    if (isMoveTarget) {
      return 'fill-blue-900/60 stroke-blue-400 stroke-[2.5]';
    }
    if (isSelected) {
      return myPiece === 'X'
        ? 'fill-blue-900/60 stroke-blue-400 stroke-[2.5]'
        : 'fill-rose-900/60 stroke-rose-400 stroke-[2.5]';
    }
    if (isSelectableDeployCell) {
      if (myPiece === 'X') {
        if (selectedHandCardIndex !== null) {
          return 'fill-blue-950/60 stroke-blue-400 stroke-[2] animate-pulse';
        }
        return 'fill-blue-900/40 stroke-blue-500 stroke-[1.5]';
      } else {
        if (selectedHandCardIndex !== null) {
          return 'fill-rose-950/60 stroke-rose-400 stroke-[2] animate-pulse';
        }
        return 'fill-rose-900/30 stroke-rose-500 stroke-[1.5]';
      }
    }

    switch (cell.cellType) {
      case 'home_base':
        return cell.r < 0 
          ? 'fill-blue-950/80 stroke-blue-500 stroke-[2]' 
          : 'fill-rose-900/40 stroke-rose-500 stroke-[2]';
      case 'urban':
        return cell.owner === 'X'
          ? 'fill-blue-950/50 stroke-blue-500/80 stroke-2'
          : cell.owner === 'O'
          ? 'fill-rose-950/50 stroke-rose-500/80 stroke-2'
          : 'fill-neutral-900 stroke-neutral-800';
      case 'farm_land':
        return cell.owner === 'X'
          ? 'fill-emerald-950/20 stroke-blue-500/80 stroke-2'
          : cell.owner === 'O'
          ? 'fill-emerald-950/20 stroke-rose-500/80 stroke-2'
          : 'fill-emerald-950/40 stroke-emerald-600/50 stroke-[1.5]';
      case 'hill':
        return 'fill-slate-800/60 stroke-slate-600/50 stroke-[1.5]';
      default:
        return 'fill-neutral-950/60 stroke-neutral-800/80 stroke-[1]';
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full max-w-6xl items-start justify-center p-4">
      <style>{`
        @keyframes cardFlip {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(90deg) scale(1.08); filter: brightness(1.3); }
          100% { transform: rotateY(0deg) scale(1); }
        }
        .animate-card-flip {
          animation: cardFlip 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
          perspective: 1000px;
        }
      `}</style>
      
      {/* ── Side panel for active phase info ── */}
      <div className="w-full xl:w-80 flex flex-col gap-4 bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl backdrop-blur-md relative z-20">
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Active Turn</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-3 h-3 rounded-full ${turn === 'X' ? 'bg-blue-500' : 'bg-rose-500'}`} />
            <span className="font-bold text-lg text-white">Player {turn}</span>
            {isMyTurn && (
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Your Turn</span>
            )}
          </div>
        </div>

        {myPiece && (
          <div className="border-t border-neutral-800 pt-3">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Opponent Hand</div>
            <div className="text-white font-bold text-lg mt-0.5">
              {hands[myPiece === 'X' ? 'O' : 'X']?.length || 0} cards
            </div>
          </div>
        )}

        <div className="border-t border-neutral-800 pt-3 relative">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Phase</div>
            
            {/* Info Icon & Hover Tooltip */}
            <div className="relative group/info cursor-help flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-400 font-bold transition-all shadow-sm shadow-indigo-500/10">
              ℹ️
              <div className="absolute right-0 top-full mt-2 xl:left-full xl:right-auto xl:top-1/2 xl:-translate-y-1/2 xl:mt-0 xl:ml-2 hidden group-hover/info:block w-64 bg-neutral-950 border border-neutral-800 p-3.5 rounded-xl shadow-2xl z-50 pointer-events-none text-xs leading-relaxed text-neutral-350 font-normal normal-case">
                {isReviewingLastTurn ? (
                  <span>
                    <strong>Review Mode:</strong> Opponent turn completed. Take your time to review the logs and board state (opponent deployments/moves shown as overlays) before starting your action phase.
                  </span>
                ) : (
                  <>
                    {phase === 'deploy' && (
                      <span>
                        Deploy cards from your hand onto your 🛖 <strong>Urban housing cells</strong>. 
                        <br/><br/>
                        Your valid cells are highlighted in purple. 
                        <br/><br/>
                        <strong>To place:</strong> Click a highlighted housing cell, then click a card in your hand. Or click a card first, then click a highlighted cell.
                      </span>
                    )}
                    {phase === 'move' && (
                      <span>Select one of your stacks, then click an adjacent hex to move units. Stacks with Kings can carry the Grail 🏆.</span>
                    )}
                    {phase === 'react' && (
                      <span>You are under attack! Click the contested cells (highlighted in red ⚔️) to fight or retreat.</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-white font-semibold text-lg capitalize mt-0.5">
            {isReviewingLastTurn ? 'Reviewing Log' : `${phase} Phase`}
          </div>
        </div>

        {/* Turn Actions */}
        <div className="flex flex-col gap-2 mt-2 h-[42px] justify-center">
          {isReviewingLastTurn ? (
            <button
              onClick={() => {
                audio.playPlaceSound();
                setIsReviewingLastTurn(false);
                setReviewMoves([]);
                setReviewDeploys([]);
                setLastReviewedEndTurnIdx(lastSelfEndTurnIdx);
              }}
              className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/20 transition-all duration-200 animate-pulse cursor-pointer"
            >
              Start My Turn
            </button>
          ) : isMyTurn ? (
            phase === 'deploy' ? (
              <button
                onClick={endDeploy}
                disabled={submittingMove || isBoardLocked}
                className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 shadow-lg shadow-indigo-600/20 transition-all duration-200 cursor-pointer"
              >
                Go to Movement
              </button>
            ) : phase === 'move' ? (
              <button
                onClick={endTurn}
                disabled={submittingMove || isBoardLocked}
                className="w-full py-2.5 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 shadow-lg shadow-emerald-600/20 transition-all duration-200 cursor-pointer"
              >
                End Turn
              </button>
            ) : (
              <div className="text-center text-xs text-neutral-500 italic py-2">Reacting to combat...</div>
            )
          ) : (
            <button
              disabled
              className="w-full py-2.5 rounded-xl font-semibold bg-neutral-900 text-neutral-500 cursor-not-allowed border border-neutral-800/60"
            >
              Opponent Turn
            </button>
          )}
        </div>

        {/* Battle Log */}
        <div className="border-t border-neutral-800 pt-3 flex flex-col w-full">
          <button 
            onClick={() => setIsLogCollapsed(!isLogCollapsed)}
            className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 w-full hover:text-neutral-300 transition-colors"
          >
            <span>Battle Log</span>
            <span className="text-[10px]">{isLogCollapsed ? '▶' : '▼'}</span>
          </button>
          {!isLogCollapsed && (
            <div 
              ref={logContainerRef}
              className="flex-1 min-h-[200px] max-h-[240px] overflow-y-auto bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 flex flex-col gap-1 shadow-inner scrollbar-thin"
            >
              {(() => {
                const groupedLogs = getGroupedHistory(state.history || []);
                if (groupedLogs.length > 0) {
                  return groupedLogs.map((grouped) => renderGroupedHistoryEntry(grouped));
                }
                return (
                  <div className="text-xs text-neutral-600 italic text-center my-auto">No events yet.</div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Board Canvas ── */}
      <div className="relative flex flex-col items-center gap-4 w-full max-w-full">
        {/* Pending combat alerts */}
        {pendingCombats.length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-1.5 max-w-md w-full px-4">
            {pendingCombats.map((c, idx) => {
              const isControllingReaction = phase === 'react' && c.defender === myPiece;
              return (
                <div 
                  key={idx}
                  onClick={() => isControllingReaction && handleCellClick(c.cellKey)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm backdrop-blur-md cursor-pointer transition-all duration-200 ${
                    isControllingReaction 
                      ? 'bg-red-955/80 border-red-500/50 hover:bg-red-955 hover:scale-[1.01] text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                      : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse">⚔️</span>
                    <span className="font-semibold text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">
                      Combat at {c.cellKey}
                    </span>
                  </div>
                  <div className="text-xs">
                    {isControllingReaction ? 'Click to React!' : 'Awaiting defender...'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Board SVG */}
        <div className="w-full bg-neutral-950/45 border border-neutral-800/80 p-2 sm:p-4 rounded-3xl backdrop-blur-sm shadow-2xl relative flex justify-center">
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full max-w-[560px] aspect-square select-none"
          >
            <defs>
              <marker 
                id="arrow" 
                viewBox="0 0 10 10" 
                refX="4" 
                refY="5" 
                markerWidth="5" 
                markerHeight="5" 
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-indigo-400" />
              </marker>
              <marker 
                id="arrow-blue" 
                viewBox="0 0 10 10" 
                refX="4" 
                refY="5" 
                markerWidth="5" 
                markerHeight="5" 
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-blue-500" />
              </marker>
              <marker 
                id="arrow-rose" 
                viewBox="0 0 10 10" 
                refX="4" 
                refY="5" 
                markerWidth="5" 
                markerHeight="5" 
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-rose-500" />
              </marker>
            </defs>

            {/* Grid Cells */}
            {Object.values(board).map((cell) => {
              const { cx, cy } = getHexCenter(cell.q, cell.r);
              const cellKey = `${cell.q},${cell.r}`;
              const isGrail = grailCellKey === cellKey;
              const hasSoldiers = cell.soldiers.length > 0;
              const topCard = cell.soldiers[0];
              const isContested = pendingCombats.some(c => c.cellKey === cellKey);

              return (
                <g 
                  key={cellKey}
                  data-testid={`cell-${cellKey}`}
                  onClick={() => handleCellClick(cellKey)}
                  onMouseEnter={() => {
                    if (cell.soldiers.length > 0) {
                      setHoveredCellKey(cellKey);
                    }
                  }}
                  onMouseLeave={() => setHoveredCellKey(null)}
                  className="group cursor-pointer"
                >
                  {/* Hexagon Shape */}
                  <polygon
                    points={getHexPoints(cx, cy, HEX_SIZE - 2)}
                    className={`transition-all duration-200 ${getCellFillClass(cell)} hover:brightness-125`}
                    strokeDasharray={cell.cellType === 'urban' ? "4 3" : undefined}
                  />

                  {/* Inner Labels & Badges */}
                  {/* Cell Coordinates (Small utility label) */}
                  <text 
                    x={cx} 
                    y={cy - 22} 
                    textAnchor="middle" 
                    className="text-[9px] fill-neutral-600 font-mono select-none"
                  >
                    {cellKey}
                  </text>

                  {/* Cell type decorator icons */}
                  {cell.cellType === 'hill' && !hasSoldiers && (
                    <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-slate-400">⛰️</text>
                  )}
                  {cell.cellType === 'farm_land' && !hasSoldiers && (
                    <g>
                      <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-emerald-400">🌾</text>
                      {cell.owner === 'X' && (
                        <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-blue-500 stroke-neutral-950 stroke-[1]" />
                      )}
                      {cell.owner === 'O' && (
                        <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-rose-500 stroke-neutral-950 stroke-[1]" />
                      )}
                    </g>
                  )}
                  {cell.cellType === 'home_base' && !hasSoldiers && (
                    <text x={cx} y={cy - 4} textAnchor="middle" className={`text-base opacity-75 select-none ${cell.r < 0 ? 'fill-blue-400' : 'fill-rose-400'}`}>🏰</text>
                  )}
                  {cell.cellType === 'urban' && !hasSoldiers && (
                    <g>
                      <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-indigo-400">🛖</text>
                      {cell.owner === 'X' && (
                        <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-blue-500 stroke-neutral-950 stroke-[1]" />
                      )}
                      {cell.owner === 'O' && (
                        <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-rose-500 stroke-neutral-950 stroke-[1]" />
                      )}
                    </g>
                  )}

                  {/* Combat swords if contested */}
                  {isContested && (
                    <g transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
                      <circle 
                        r="14" 
                        className="fill-red-500/20 stroke-red-500 stroke-2 animate-ping" 
                      />
                      <text 
                        textAnchor="middle" 
                        y="5" 
                        className="text-lg drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] filter"
                      >
                        ⚔️
                      </text>
                    </g>
                  )}

                  {/* Soldiers Stack representation */}
                  {hasSoldiers && !isContested && (
                    <g transform={`translate(${cx}, ${cy - 5})`}>
                      {/* Badge background for stack size if size > 1 */}
                      {cell.soldiers.length > 1 && (
                        <circle 
                          r="11" 
                          cx="18" 
                          cy="-14" 
                          className="fill-neutral-900 stroke-neutral-700 stroke" 
                        />
                      )}
                      {cell.soldiers.length > 1 && (
                        <text 
                          x="18" 
                          y="-10.5" 
                          textAnchor="middle" 
                          className="text-[10px] font-bold fill-neutral-400 font-mono"
                        >
                          {cell.soldiers.length}
                        </text>
                      )}

                      {/* Top Card Face Drawing */}
                      <rect 
                        x="-14" 
                        y="-12" 
                        width="28" 
                        height="38" 
                        rx="4" 
                        className={`stroke-2 ${
                          cell.owner === 'X' 
                            ? 'fill-blue-950 stroke-blue-500' 
                            : cell.owner === 'O'
                            ? 'fill-rose-950 stroke-rose-500'
                            : 'fill-neutral-900 stroke-neutral-600'
                        }`} 
                      />

                      {/* Card value label */}
                      <text 
                        y="10" 
                        textAnchor="middle" 
                        className={`text-base font-black ${
                          cell.owner === 'X' 
                            ? 'fill-blue-200' 
                            : cell.owner === 'O'
                            ? 'fill-rose-200'
                            : 'fill-neutral-300'
                        }`}
                      >
                        {formatCardValue(topCard.value)}
                      </text>

                      {/* Cell type text indicator at the bottom of the card */}
                      {cell.cellType !== 'normal' && cell.cellType !== 'grail_center' && (
                        <text 
                          y="22" 
                          textAnchor="middle" 
                          className="text-[7px] font-bold fill-neutral-400 uppercase tracking-wider opacity-90 select-none"
                        >
                          {cell.cellType === 'urban' ? 'Urban' : cell.cellType === 'farm_land' ? 'Farm' : cell.cellType === 'hill' ? 'Hill' : 'Base'}
                        </text>
                      )}

                      {/* Small crown/stars icons for J/Q/K */}
                      {topCard.value === 13 && (
                        <text y="-4" textAnchor="middle" className="text-[9px] fill-amber-400">👑</text>
                      )}
                      {topCard.value === 12 && (
                        <text y="-4" textAnchor="middle" className="text-[9px] fill-purple-400">✨</text>
                      )}
                      {topCard.value === 11 && (
                        <text y="-4" textAnchor="middle" className="text-[9px] fill-blue-400">🛡️</text>
                      )}
                      {cell.owner === myPiece && topCard.revealed && (
                        <text x="9" y="-4" textAnchor="middle" className="text-[8px]">
                          <title>Visible to opponent</title>
                          👁️
                        </text>
                      )}
                    </g>
                  )}

                  {/* Grail indicator overlay */}
                  {isGrail && (
                    <g transform={`translate(${cx}, ${cy - (hasSoldiers ? 31 : 0)})`} className="pointer-events-none">
                      <circle 
                        r="14" 
                        className="fill-amber-500/20 stroke-amber-400 stroke-2 animate-ping" 
                      />
                      <text 
                        textAnchor="middle" 
                        y="5" 
                        className="text-lg drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] filter"
                      >
                        🏆
                      </text>
                    </g>
                  )}

                  {/* Opponent Deploy Indicator Overlay (Review Phase) */}
                  {isReviewingLastTurn && (() => {
                    const deploy = reviewDeploys.find(d => d.cellKey === cellKey);
                    if (!deploy) return null;
                    const oppPiece = myPiece === 'X' ? 'O' : 'X';
                    const oppFill = oppPiece === 'X' ? 'fill-blue-950 stroke-blue-500' : 'fill-rose-950 stroke-rose-500';
                    const oppText = oppPiece === 'X' ? 'fill-blue-200' : 'fill-rose-200';
                    const oppPulse = oppPiece === 'X' ? 'stroke-blue-500/40' : 'stroke-rose-500/40';
                    return (
                      <g transform={`translate(${cx}, ${cy + (hasSoldiers ? 22 : 0)})`} className="pointer-events-none">
                        <circle 
                          r="10" 
                          className={`${oppFill} stroke-2`} 
                        />
                        <text 
                          textAnchor="middle" 
                          y="3.5" 
                          className={`text-[9px] font-bold ${oppText} font-mono`}
                        >
                          +{deploy.count}
                        </text>
                        <circle 
                          r="14" 
                          className={`fill-none stroke-2 animate-ping ${oppPulse}`} 
                        />
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Movement Path Arrows */}
            {aggregatedFriendlyMoves.map((move, idx) => {
              const fromCell = board[move.from];
              const toCell = board[move.to];
              if (!fromCell || !toCell) return null;

              const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
              const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);

              const dx = cx2 - cx1;
              const dy = cy2 - cy1;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) return null;

              const startX = cx1 + dx * (22 / len);
              const startY = cy1 + dy * (22 / len);
              const endX = cx2 - dx * (26 / len);
              const endY = cy2 - dy * (26 / len);

              const midX = (cx1 + cx2) / 2;
              const midY = (cy1 + cy2) / 2;

              return (
                <g 
                  key={`move-arrow-${idx}`}
                  onMouseEnter={() => setHoveredMoveIdx(idx)}
                  onMouseLeave={() => setHoveredMoveIdx(null)}
                  className="cursor-pointer"
                >
                  {/* Dashed line */}
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    className="stroke-indigo-400/90 stroke-[3] [stroke-dasharray:4,3]"
                    markerEnd="url(#arrow)"
                  />

                  {/* Thick transparent interactive area for easier hover */}
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    className="stroke-transparent stroke-[12]"
                  />

                  {/* Move count badge */}
                  <circle
                    cx={midX}
                    cy={midY}
                    r="8"
                    className="fill-indigo-950 stroke-indigo-400 stroke-[1.5]"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    className="text-[9px] font-black fill-indigo-200 select-none font-mono"
                  >
                    {move.cards.length}
                  </text>
                </g>
              );
            })}

            {/* Opponent Movement Path Arrows (Review Phase) */}
            {isReviewingLastTurn && aggregatedReviewMoves.map((move, idx) => {
              const fromCell = board[move.from];
              const toCell = board[move.to];
              if (!fromCell || !toCell) return null;

              const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
              const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);

              const dx = cx2 - cx1;
              const dy = cy2 - cy1;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) return null;

              const startX = cx1 + dx * (22 / len);
              const startY = cy1 + dy * (22 / len);
              const endX = cx2 - dx * (26 / len);
              const endY = cy2 - dy * (26 / len);

              const midX = (cx1 + cx2) / 2;
              const midY = (cy1 + cy2) / 2;

              const oppPiece = myPiece === 'X' ? 'O' : 'X';
              const oppColorClass = oppPiece === 'X' ? 'stroke-blue-500/90' : 'stroke-rose-500/90';
              const oppFillClass = oppPiece === 'X' ? 'fill-blue-950 stroke-blue-400' : 'fill-rose-950 stroke-rose-400';
              const oppTextClass = oppPiece === 'X' ? 'fill-blue-200' : 'fill-rose-200';
              const markerId = oppPiece === 'X' ? 'arrow-blue' : 'arrow-rose';

              return (
                <g key={`review-move-arrow-${idx}`}>
                  {/* Dashed line */}
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    className={`${oppColorClass} stroke-[3] [stroke-dasharray:4,3]`}
                    markerEnd={`url(#${markerId})`}
                  />

                  {/* Move count badge */}
                  <circle
                    cx={midX}
                    cy={midY}
                    r="8"
                    className={`${oppFillClass} stroke-[1.5]`}
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    className={`text-[9px] font-black ${oppTextClass} select-none font-mono`}
                  >
                    {move.count}
                  </text>
                </g>
              );
            })}

            {/* Hovered Cell Stack Tooltip */}
            {hoveredCellKey && (() => {
              const cell = board[hoveredCellKey];
              if (!cell || cell.soldiers.length === 0) return null;
              
              const { cx, cy } = getHexCenter(cell.q, cell.r);
              
              const tooltipWidth = 145;
              const tooltipHeight = 36 + cell.soldiers.length * 20;
              const tooltipX = Math.max(10, Math.min(cx + 30, WIDTH - tooltipWidth - 10));
              const tooltipY = Math.max(10, Math.min(cy - 90, HEIGHT - tooltipHeight - 10));

              return (
                <g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
                  <rect
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="8"
                    className="fill-neutral-950/95 stroke-neutral-700/80 stroke-2"
                  />
                  <text
                    x={tooltipWidth / 2}
                    y="14"
                    textAnchor="middle"
                    className="fill-neutral-400 text-[8px] font-bold tracking-widest uppercase"
                  >
                    Stack Soldiers
                  </text>

                  {cell.soldiers.map((card, idx) => {
                    const isCardValueVisible = card.value > 0;
                    const isMyOwnRevealed = cell.owner === myPiece && card.revealed;
                    
                    return (
                      <g key={idx} transform={`translate(10, ${22 + idx * 20})`}>
                        <rect
                          width={tooltipWidth - 20}
                          height="16"
                          rx="3"
                          className={`${
                            cell.owner === 'X'
                              ? 'fill-blue-950/40 stroke-blue-500/30'
                              : cell.owner === 'O'
                              ? 'fill-rose-950/40 stroke-rose-500/30'
                              : 'fill-neutral-900 stroke-neutral-800'
                          } stroke`}
                        />
                        <text
                          x="6"
                          y="11"
                          className={`text-[9px] font-bold ${
                            isCardValueVisible
                              ? cell.owner === 'X'
                                ? 'fill-blue-200'
                                : cell.owner === 'O'
                                ? 'fill-rose-200'
                                : 'fill-neutral-200'
                              : 'fill-neutral-500 font-normal italic'
                          }`}
                        >
                          {isCardValueVisible
                            ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})`
                            : 'Hidden (?)'}
                          {card.moved && ' (Moved)'}
                          {isMyOwnRevealed && ' 👁️'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* Hovered Move Arrow Tooltip */}
            {hoveredMoveIdx !== null && (() => {
              const move = aggregatedFriendlyMoves[hoveredMoveIdx];
              if (!move) return null;

              const fromCell = board[move.from];
              const toCell = board[move.to];
              if (!fromCell || !toCell) return null;

              const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
              const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);
              const midX = (cx1 + cx2) / 2;
              const midY = (cy1 + cy2) / 2;

              const tooltipWidth = 140;
              const tooltipHeight = 36 + move.cards.length * 20;
              const tooltipX = Math.max(10, Math.min(midX + 15, WIDTH - tooltipWidth - 10));
              const tooltipY = Math.max(10, Math.min(midY - 40, HEIGHT - tooltipHeight - 10));

              return (
                <g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
                  <rect
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="8"
                    className="fill-neutral-950/95 stroke-indigo-500/50 stroke-2"
                  />
                  <text
                    x={tooltipWidth / 2}
                    y="14"
                    textAnchor="middle"
                    className="fill-indigo-300 text-[8px] font-bold tracking-widest uppercase"
                  >
                    Moved Units
                  </text>

                  {move.cards.map((card, idx) => {
                    const isCardValueVisible = card.value > 0;
                    
                    return (
                      <g key={idx} transform={`translate(10, ${22 + idx * 20})`}>
                        <rect
                          width={tooltipWidth - 20}
                          height="16"
                          rx="3"
                          className="fill-indigo-950/30 stroke-indigo-500/20 stroke"
                        />
                        <text
                          x="6"
                          y="11"
                          className={`text-[9px] font-bold ${
                            isCardValueVisible ? 'fill-indigo-200' : 'fill-neutral-500 font-normal italic'
                          }`}
                        >
                          {isCardValueVisible
                            ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})`
                            : 'Hidden (?)'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Hand View at the bottom of the board canvas (Spacious card-game style) */}
        <div 
          className="w-full max-w-[560px] bg-neutral-900/80 border border-neutral-800/80 px-5 py-3 rounded-2xl backdrop-blur-md flex flex-col items-center gap-3 shadow-xl min-h-[195px] h-[195px] justify-center"
        >
          <div className="flex justify-between items-center w-full text-xs font-semibold text-neutral-400 px-1">
            <span>YOUR HAND ({activeHand.length} cards)</span>
            <div className="flex items-center gap-3">
              {isMyTurn && phase === 'deploy' ? (
                <>
                  {selectedCellKey && activeHand.length > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await onAction({
                            type: 'deploy_all',
                            cellKey: selectedCellKey
                          });
                          setSelectedCellKey(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      disabled={isBoardLocked || submittingMove}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
                    >
                      Deploy All to {selectedCellKey}
                    </button>
                  )}
                  <span>{selectedCellKey ? `Click a card to deploy to ${selectedCellKey}` : 'Click a card, then click a highlighted cell'}</span>
                </>
              ) : (
                <span className="text-neutral-500 font-mono uppercase tracking-wider text-[10px]">Deploy Phase Only</span>
              )}
            </div>
          </div>
          {activeHand.length === 0 ? (
            <div className="text-center py-6 text-neutral-600 text-sm italic">Empty hand</div>
          ) : (
            <div className="flex flex-nowrap overflow-x-auto justify-start gap-3 w-full pb-1.5 scrollbar-thin">
              {activeHand.map((card, idx) => {
                const canInteract = isMyTurn && phase === 'deploy';
                return (
                  <button
                    key={idx}
                    onClick={() => canInteract && handleHandCardClick(idx)}
                    disabled={!canInteract}
                    className={`w-16 h-24 rounded-xl flex flex-col items-center justify-between p-2.5 border-2 transition-all duration-200 relative shadow-lg ${
                      canInteract 
                        ? 'hover:scale-105 active:scale-95 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed'
                    } ${
                      selectedHandCardIndex === idx && canInteract
                        ? 'bg-indigo-950 border-indigo-400 text-indigo-200 shadow-indigo-500/30 scale-110 -translate-y-2'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-bold self-start">{formatCardValue(card.value)}</span>
                    <span className="text-xl font-black">{formatCardValue(card.value)}</span>
                    <span className="text-[7px] uppercase font-bold tracking-tight text-neutral-500 self-end">
                      {card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Active Actions Panels (Right Column) ── */}
      <div className="w-full xl:w-80 flex flex-col gap-4">

        {/* Move sliders / controllers */}
        {isMyTurn && phase === 'move' && selectedCellKey && !isReviewingLastTurn && (
          <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl backdrop-blur-md">
            <h3 className="text-sm font-semibold text-neutral-400 mb-1 uppercase tracking-wider">Move Soldiers</h3>
            <div className="text-xs text-neutral-500 mb-3">Origin: {selectedCellKey}</div>

            {moveTargetKey ? (
              <div className="flex flex-col gap-4">
                {grailCellKey === selectedCellKey ? (
                  <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3.5 rounded-xl flex items-start gap-2.5 shadow-lg">
                    <span className="text-base">⚠️</span>
                    <div className="leading-relaxed text-left">
                      <strong className="text-white block mb-0.5 font-bold">Carrying the Grail!</strong>
                      All {board[selectedCellKey]?.soldiers.length} units in this hex must be moved together. The stack must contain your King (K) to transport the Grail.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between text-sm text-neutral-300 mb-1">
                      <span>Count to move:</span>
                      <span className="font-bold text-white">{moveCount} / {board[selectedCellKey]?.soldiers.length}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={board[selectedCellKey]?.soldiers.length || 1}
                      value={moveCount}
                      onChange={(e) => setMoveCount(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-neutral-950 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                <button
                  onClick={executeMove}
                  disabled={submittingMove || isBoardLocked}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-all"
                >
                  Move to {moveTargetKey}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-neutral-500 italic border border-dashed border-neutral-800 rounded-xl">
                Click an adjacent hex to set target destination.
              </div>
            )}
          </div>
        )}

        {/* Combat Reaction Modal Overlay / Panel */}
        {activeCombatCellKey !== null && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {(() => {
              const combat = displayedCombat;
              if (!combat) return null;
              const isHill = board[combat.cellKey]?.cellType === 'hill';
              const adjacentFriendly = getAdjacentFriendlyCells(combat.cellKey);

              // Helper to get specific logs for this cell
              const getCombatLogsForCell = (cellKey: string) => {
                if (!state.history) return [];
                const [q, r] = cellKey.split(',').map(Number);
                const isGrailCenter = q === 0 && r === 0;
                const cellName = isGrailCenter ? 'Grail Center' : cellKey;

                return state.history.filter(log => {
                  if (typeof log === 'string') {
                    if (log.trim().startsWith('{')) return false;
                    return log.includes(cellName) && (
                      log.toLowerCase().includes('combat') || 
                      log.toLowerCase().includes('vs') || 
                      log.toLowerCase().includes('retreat') ||
                      log.toLowerCase().includes('wins!') ||
                      log.toLowerCase().includes('draw!')
                    );
                  }
                  return false;
                });
              };

              const renderCombatLogEntry = (rawLog: string, idx: number) => {
                const isCombat = rawLog.includes('⚔️') || rawLog.toLowerCase().includes('combat') || rawLog.toLowerCase().includes('vs');
                const isRetreat = rawLog.includes('🏃') || rawLog.toLowerCase().includes('retreat');

                if (isCombat) {
                  const info = parseCombatText(rawLog);
                  const attColor = info.attackerPiece === 'X' ? 'text-blue-400' : 'text-rose-400';
                  const defColor = info.defenderPiece === 'X' ? 'text-blue-400' : 'text-rose-400';
                  const winnerColor = info.winnerText === 'Attacker' ? attColor : info.winnerText === 'Defender' ? defColor : 'text-neutral-400';

                  return (
                    <div key={idx} className="text-[11px] py-1 border-b border-neutral-800/40 leading-normal text-neutral-300 font-mono flex items-center gap-1.5 flex-wrap">
                      <span className={`${attColor} font-bold`}>({info.attackerPiece})</span>
                      <span className="text-red-400 font-bold">⚔️</span>
                      <span className={`${defColor} font-bold`}>({info.defenderPiece})</span>
                      <span className="text-neutral-500">:</span>
                      <span className="text-white font-bold">{info.attackerCard}</span>
                      <span className="text-neutral-500">vs</span>
                      <span className="text-white font-bold">{info.defenderCard}</span>
                      <span className="text-neutral-400 font-semibold">➡️</span>
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

                if (isRetreat) {
                  const info = parseRetreatText(rawLog);
                  const defColor = info.defenderPiece === 'X' ? 'text-blue-400' : 'text-rose-400';

                  return (
                    <div key={idx} className="text-[11px] text-neutral-300 py-1 border-b border-neutral-800/40 leading-normal font-mono flex items-center gap-1.5 flex-wrap">
                      <span className={`${defColor} font-bold`}>({info.defenderPiece})</span>
                      <span className="text-amber-500 font-bold">🏃</span>
                      <span className="text-neutral-500 font-semibold">retreat to</span>
                      <span className="text-neutral-400 font-semibold">{info.retreatTo}</span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="text-[11px] text-neutral-300 py-1 border-b border-neutral-800/40 leading-normal">
                    {rawLog}
                  </div>
                );
              };

              const combatLogs = getCombatLogsForCell(combat.cellKey);

              return (
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl relative">
                  <button 
                    onClick={() => setActiveCombatCellKey(null)}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>

                  <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <span>⚔️</span> Contested Combat Resolution
                  </h3>
                  <div className="text-xs text-neutral-500 mb-4">Cell: {combat.cellKey} {isHill && '(Hill Defense Active ⛰️)'}</div>

                  {/* Attacker vs Defender top cards visualization */}
                  <div className="flex items-center justify-around bg-neutral-950 p-5 rounded-2xl border border-neutral-800 mb-4">
                    {/* Attacker side */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Attacker</span>
                      <div className={`w-16 h-22 border-2 border-blue-500 bg-blue-950/20 rounded-xl flex items-center justify-center text-2xl font-black text-blue-100 relative shadow-[0_0_15px_rgba(59,130,246,0.1)] ${
                        (isRevealingAttacker || isTransitioningNext) ? 'animate-card-flip' : ''
                      }`}>
                        {displayedAttackerVal !== undefined ? formatCardValue(displayedAttackerVal) : '?'}
                        {displayedAttackerVal === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                      </div>
                      <span className="text-xs text-neutral-500">{combat.attackerRemainingCount} left</span>
                      
                      {/* Remaining Attacker Stack Preview */}
                      <div className="flex gap-1 mt-1.5 max-w-[140px] overflow-x-auto justify-center">
                        {combat.attackerStack?.slice(1).map((card, cardIdx) => {
                          const isKnown = card.value > 0;
                          const isMyOwnRevealed = combat.attacker === myPiece && card.revealed;
                          return (
                            <div 
                              key={cardIdx} 
                              title={isKnown ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})${isMyOwnRevealed ? ' - Visible to opponent' : ''}` : 'Hidden Opponent Soldier'}
                              className={`w-7 h-10 border rounded flex items-center justify-center text-[10px] font-bold shrink-0 cursor-help transition-all relative ${
                                isKnown
                                  ? combat.attacker === 'X'
                                    ? 'bg-blue-950/60 border-blue-500/50 text-blue-200 hover:border-blue-400'
                                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200 hover:border-rose-400'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 font-normal italic hover:border-neutral-700'
                              }`}
                            >
                              {isKnown ? formatCardValue(card.value) : '?'}
                              {isMyOwnRevealed && (
                                <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-neutral-950 border border-neutral-800 rounded-full px-0.5" title="Visible to opponent">👁️</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
 
                    <div className="text-xl font-black text-neutral-700">VS</div>
 
                    {/* Defender side */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-widest font-mono">Defender</span>
                      
                      <div className="flex gap-2">
                        {/* Card 1 */}
                        <div className={`w-16 h-22 border-2 border-rose-500 bg-rose-950/20 rounded-xl flex items-center justify-center text-2xl font-black text-rose-100 relative shadow-[0_0_15px_rgba(239,68,68,0.1)] ${
                          isTransitioningNext ? 'animate-card-flip' : ''
                        }`}>
                          {displayedDefenderVal !== undefined ? formatCardValue(displayedDefenderVal) : '?'}
                          {displayedDefenderVal === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                        </div>
                        
                        {/* Card 2 (only if Hill Combat second card exists) */}
                        {displayedDefenderVal2 !== undefined && (
                          <div className={`w-16 h-22 border-2 border-rose-500/80 bg-rose-950/20 rounded-xl flex items-center justify-center text-2xl font-black text-rose-100/90 relative shadow-[0_0_15px_rgba(239,68,68,0.1)] ${
                            isTransitioningNext ? 'animate-card-flip' : ''
                          }`}>
                            {formatCardValue(displayedDefenderVal2)}
                            {displayedDefenderVal2 === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                          </div>
                        )}
                      </div>
                      
                      <span className="text-xs text-neutral-500">{combat.defenderRemainingCount} left</span>

                      {/* Remaining Defender Stack Preview */}
                      <div className="flex gap-1 mt-1.5 max-w-[140px] overflow-x-auto justify-center">
                        {displayedDefenderStack.slice(displayedDefenderVal2 !== undefined ? 2 : 1).map((card, cardIdx) => {
                          const isKnown = card.value > 0;
                          const isMyOwnRevealed = combat.defender === myPiece && card.revealed;
                          return (
                            <div 
                              key={cardIdx} 
                              title={isKnown ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})${isMyOwnRevealed ? ' - Visible to opponent' : ''}` : 'Hidden Opponent Soldier'}
                              className={`w-7 h-10 border rounded flex items-center justify-center text-[10px] font-bold shrink-0 cursor-help transition-all relative ${
                                isKnown
                                  ? combat.defender === 'X'
                                    ? 'bg-blue-950/60 border-blue-500/50 text-blue-200 hover:border-blue-400'
                                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200 hover:border-rose-400'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 font-normal italic hover:border-neutral-700'
                              }`}
                            >
                              {isKnown ? formatCardValue(card.value) : '?'}
                              {isMyOwnRevealed && (
                                <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-neutral-950 border border-neutral-800 rounded-full px-0.5" title="Visible to opponent">👁️</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Duel Resolution Log Panel */}
                  <div className="mb-4">
                    <div className="text-[10px] font-semibold text-neutral-400 mb-1 uppercase tracking-wide">Combat Log</div>
                    <div className="max-h-24 overflow-y-auto bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 flex flex-col gap-1 shadow-inner scrollbar-thin">
                      {combatLogs.length > 0 ? (
                        combatLogs.map((log, idx) => renderCombatLogEntry(log, idx))
                      ) : (
                        <div className="text-[10px] text-neutral-600 italic text-center py-2">No duels resolved yet in this combat.</div>
                      )}
                    </div>
                  </div>

                  {/* React type actions */}
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => executeFightReact(combat)}
                      disabled={submittingMove || disabled}
                      className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white shadow-lg shadow-red-700/20 transition-all duration-200 hover:scale-[1.01] active:scale-95"
                    >
                      Duel Top Cards!
                    </button>

                    {/* Retreat selection */}
                    <div className="border-t border-neutral-800/80 pt-3 mt-1">
                      <div className="text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Retreat to Friendly Cell</div>
                      {adjacentFriendly.length === 0 ? (
                        <div className="text-xs text-neutral-600 italic">No friendly adjacent cells available for retreat.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {adjacentFriendly.map(key => (
                            <button
                              key={key}
                              onClick={() => setRetreatTargetKey(key)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                retreatTargetKey === key
                                  ? myPiece === 'X'
                                    ? 'bg-blue-950 border-blue-400 text-blue-300 shadow'
                                    : 'bg-rose-950 border-rose-400 text-rose-300 shadow'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                              }`}
                            >
                              Cell {key}
                            </button>
                          ))}
                        </div>
                      )}

                      {retreatTargetKey && (
                        <button
                          onClick={() => executeRetreatReact(combat)}
                          disabled={submittingMove || disabled}
                          className={`w-full mt-2.5 py-2 rounded-xl bg-neutral-950 border font-semibold transition-all hover:scale-[1.01] active:scale-95 ${
                            myPiece === 'X'
                              ? 'border-blue-600/40 text-blue-400 hover:bg-blue-950/70'
                              : 'border-rose-600/40 text-rose-400 hover:bg-rose-950/70'
                          }`}
                        >
                          Execute Retreat to {retreatTargetKey}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

    </div>
  );
};
