
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
  combatSummary?: CombatSummary;
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
