import { formatCardValue } from './utils';
import { useTranslation } from 'react-i18next';
import type { HolyGrailCell } from '@vibe-games/shared';

 
type Combat = any;
 
type GameState = any;

export interface GrailControlsProps {
  isMyTurn: boolean;
  phase: string;
  selectedCellKey: string | null;
  isReviewingLastTurn: boolean;
  moveTargetKey: string | null;
  grailCellKey: string | null;
  board: Record<string, HolyGrailCell>;
  moveCount: number;
  setMoveCount: (count: number) => void;
  executeMove: () => void;
  submittingMove: boolean;
  isBoardLocked: boolean;

  activeCombatCellKey: string | null;
  setActiveCombatCellKey: (key: string | null) => void;
  displayedCombat: Combat | null;
  getAdjacentFriendlyCells: (cellKey: string) => string[];
  myPiece: 'X' | 'O' | null;
  isRevealingAttacker: boolean;
  isRevealingDefender: boolean;
  isTransitioningNext: boolean;
  state: GameState;
  displayedAttackerVal?: number;
  displayedDefenderVal?: number;
  displayedDefenderVal2?: number;
   
  displayedDefenderStack: any[];
  executeFightReact: (combat: Combat) => void;
  executeRetreatReact: (combat: Combat) => void;
  retreatTargetKey: string | null;
  setRetreatTargetKey: (key: string | null) => void;
}

export const GrailControls: React.FC<GrailControlsProps> = ({
  isMyTurn,
  phase,
  selectedCellKey,
  isReviewingLastTurn,
  moveTargetKey,
  grailCellKey,
  board,
  moveCount,
  setMoveCount,
  executeMove,
  submittingMove,
  isBoardLocked,

  activeCombatCellKey,
  setActiveCombatCellKey,
  displayedCombat,
  getAdjacentFriendlyCells,
  myPiece,
  isRevealingAttacker,
  isRevealingDefender,
  isTransitioningNext,
  state,
  displayedAttackerVal,
  displayedDefenderVal,
  displayedDefenderVal2,
  displayedDefenderStack,
  executeFightReact,
  executeRetreatReact,
  retreatTargetKey,
  setRetreatTargetKey
}) => {
  const { t } = useTranslation('game');
  const disabled = isBoardLocked;

  // Helpers copied directly from HolyGrailBoard because they are tightly coupled to the modal log UI
  const parseCombatText = (rawLog: string) => {
    // Example: "X ⚔️ O: 4 vs 5 ➡️ Defender (O) wins!"
    const match = rawLog.match(/([XO])\s*⚔️\s*([XO]):\s*(.+?)\s+vs\s+(.+?)\s*➡️\s*(.+)/);
    if (match) {
      const winnerFull = match[5];
      let winnerText = 'Draw';
      let degradedVal: number | null = null;
      if (winnerFull.includes('Attacker')) winnerText = 'Attacker';
      else if (winnerFull.includes('Defender')) winnerText = 'Defender';
      
      const degradeMatch = winnerFull.match(/degrades to ([KQJ0-9]+)/i);
      if (degradeMatch) {
        degradedVal = degradeMatch[1] as unknown as number; // simplified
      }
      return {
        attackerPiece: match[1],
        defenderPiece: match[2],
        attackerCard: match[3],
        defenderCard: match[4],
        winnerText,
        degradedVal
      };
    }
    return { attackerPiece: '?', defenderPiece: '?', attackerCard: '?', defenderCard: '?', winnerText: '?' };
  };

  const parseRetreatText = (rawLog: string) => {
    // Example: "O 🏃 retreat to 1,-1"
    const match = rawLog.match(/([XO])\s*🏃\s*retreat to\s*([0-9,-]+)/);
    if (match) {
      return { defenderPiece: match[1], retreatTo: match[2] };
    }
    return { defenderPiece: '?', retreatTo: '?' };
  };

  return (
    <div className="w-full xl:w-80 flex flex-col gap-4">
      {/* Move sliders / controllers */}
      {isMyTurn && phase === 'move' && selectedCellKey && !isReviewingLastTurn && (
        <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl backdrop-blur-md">
          <h3 className="text-sm font-semibold text-neutral-400 mb-1 uppercase tracking-wider">{t('move_soldiers', { defaultValue: 'Move Soldiers' })}</h3>
          <div className="text-xs text-neutral-500 mb-3">{t('origin', { defaultValue: 'Origin:' })} {selectedCellKey}</div>

          {moveTargetKey ? (
            <div className="flex flex-col gap-4">
              {grailCellKey === selectedCellKey ? (
                <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3.5 rounded-xl flex items-start gap-2.5 shadow-lg">
                  <span className="text-base">⚠️</span>
                  <div className="leading-relaxed text-left">
                    <strong className="text-white block mb-0.5 font-bold">{t('carrying_grail', { defaultValue: 'Carrying the Grail!' })}</strong>
                    {t('carrying_grail_desc', { defaultValue: 'All units in this hex must be moved together. The stack must contain your King (K) to transport the Grail.' }).replace('{count}', String(board[selectedCellKey]?.soldiers.length))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-sm text-neutral-300 mb-1">
                    <span>{t('count_to_move', { defaultValue: 'Count to move:' })}</span>
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
                {t('move_to', { defaultValue: 'Move to' })} {moveTargetKey}
              </button>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-neutral-500 italic border border-dashed border-neutral-800 rounded-xl">
              {t('click_adjacent_to_move', { defaultValue: 'Click an adjacent hex to set target destination.' })}
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

            const isAttackerX = combat.attacker === 'X';
            const isDefenderX = combat.defender === 'X';

            const attLabelColor = isAttackerX ? 'text-blue-400' : 'text-rose-400';
            const attCardClass = isAttackerX 
              ? 'border-blue-500 bg-blue-950/20 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : 'border-rose-500 bg-rose-950/20 text-rose-100 shadow-[0_0_15px_rgba(239,68,68,0.1)]';

            const defLabelColor = isDefenderX ? 'text-blue-400' : 'text-rose-400';
            const defCardClass = isDefenderX
              ? 'border-blue-500 bg-blue-950/20 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
              : 'border-rose-500 bg-rose-950/20 text-rose-100 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
            const defCardClass2 = isDefenderX
              ? 'border-blue-500/80 bg-blue-950/20 text-blue-100/90 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
              : 'border-rose-500/80 bg-rose-950/20 text-rose-100/90 shadow-[0_0_15px_rgba(239,68,68,0.1)]';

            const isAnimating = isRevealingAttacker || isRevealingDefender || isTransitioningNext;

            // Helper to get specific logs for this cell
            const getCombatLogsForCell = (cellKey: string) => {
              if (!state.history) return [];
              const [q, r] = cellKey.split(',').map(Number);
              const isGrailCenter = q === 0 && r === 0;
              const cellName = isGrailCenter ? 'Grail Center' : cellKey;

              // Slice history starting from the last end_turn action to isolate current turn's combat logs
              const lastEndTurnIdx = [...state.history].reverse().findIndex((log: any) => {
                if (typeof log === 'string' && log.trim().startsWith('{')) {
                  try {
                    const parsed = JSON.parse(log);
                    return parsed.type === 'end_turn';
                  } catch {
                    return false;
                  }
                }
                return false;
              });

              const currentCombatHistory = lastEndTurnIdx !== -1 
                ? state.history.slice(state.history.length - lastEndTurnIdx) 
                : state.history;

              return currentCombatHistory.filter((log: any) => {
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
                  disabled={isAnimating}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl disabled:opacity-30 disabled:pointer-events-none"
                >
                  ✕
                </button>

                <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                  <span>⚔️</span> {t('contested_combat_resolution', { defaultValue: 'Contested Combat Resolution' })}
                </h3>
                <div className="text-xs text-neutral-500 mb-4">{t('cell', { defaultValue: 'Cell:' })} {combat.cellKey} {isHill && `(${t('hill_defense_active', { defaultValue: 'Hill Defense Active ⛰️' })})`}</div>

                {/* Attacker vs Defender top cards visualization */}
                <div className="flex items-center justify-around bg-neutral-950 p-5 rounded-2xl border border-neutral-800 mb-4">
                  {/* Attacker side */}
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-semibold ${attLabelColor} uppercase tracking-widest`}>{t('attacker', { defaultValue: 'Attacker' })}</span>
                    <div className={`w-16 h-22 border-2 ${attCardClass} rounded-xl flex items-center justify-center text-2xl font-black relative ${
                      (isRevealingAttacker || isTransitioningNext) ? 'animate-card-flip' : ''
                    }`}>
                      {displayedAttackerVal !== undefined ? formatCardValue(displayedAttackerVal) : '?'}
                      {displayedAttackerVal === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                    </div>
                    <span className="text-xs text-neutral-500">{combat.attackerRemainingCount} {t('left', { defaultValue: 'left' })}</span>
                    
                    {/* Remaining Attacker Stack Preview */}
                    <div className="flex gap-1 mt-1.5 max-w-[140px] overflow-x-auto justify-center">
                      {combat.attackerStack?.slice(1).map((card: any, cardIdx: number) => {
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
                    <span className={`text-[10px] font-semibold ${defLabelColor} uppercase tracking-widest font-mono`}>{t('defender', { defaultValue: 'Defender' })}</span>
                    
                    <div className="flex gap-2">
                      {/* Card 1 */}
                      <div className={`w-16 h-22 border-2 ${defCardClass} rounded-xl flex items-center justify-center text-2xl font-black relative ${
                        (isRevealingDefender || isTransitioningNext) ? 'animate-card-flip' : ''
                      }`}>
                        {displayedDefenderVal !== undefined ? formatCardValue(displayedDefenderVal) : '?'}
                        {displayedDefenderVal === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                      </div>
                      
                      {/* Card 2 (only if Hill Combat second card exists) */}
                      {displayedDefenderVal2 !== undefined && (
                        <div className={`w-16 h-22 border-2 ${defCardClass2} rounded-xl flex items-center justify-center text-2xl font-black relative ${
                          (isRevealingDefender || isTransitioningNext) ? 'animate-card-flip' : ''
                        }`}>
                          {formatCardValue(displayedDefenderVal2)}
                          {displayedDefenderVal2 === 13 && <span className="absolute -top-3 text-sm">👑</span>}
                        </div>
                      )}
                    </div>
                    
                    <span className="text-xs text-neutral-500">{combat.defenderRemainingCount} {t('left', { defaultValue: 'left' })}</span>

                    {/* Remaining Defender Stack Preview */}
                    <div className="flex gap-1 mt-1.5 max-w-[140px] overflow-x-auto justify-center">
                      {displayedDefenderStack.slice(displayedDefenderVal2 !== undefined ? 2 : 1).map((card: any, cardIdx: number) => {
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
                  <div className="text-[10px] font-semibold text-neutral-400 mb-1 uppercase tracking-wide">{t('combat_log', { defaultValue: 'Combat Log' })}</div>
                  <div className="max-h-24 overflow-y-auto bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 flex flex-col gap-1 shadow-inner scrollbar-thin">
                    {combatLogs.length > 0 ? (
                      combatLogs.map((log: any, idx: number) => renderCombatLogEntry(log, idx))
                    ) : (
                      <div className="text-[10px] text-neutral-600 italic text-center py-2">{t('no_duels_resolved', { defaultValue: 'No duels resolved yet in this combat.' })}</div>
                    )}
                  </div>
                </div>

                {/* React type actions */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => executeFightReact(combat)}
                    disabled={submittingMove || disabled || isAnimating}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white shadow-lg shadow-red-700/20 transition-all duration-200 hover:scale-[1.01] active:scale-95"
                  >
                    {t('duel_top_cards', { defaultValue: 'Duel Top Cards!' })}
                  </button>

                  {/* Retreat selection */}
                  <div className="border-t border-neutral-800/80 pt-3 mt-1">
                    <div className="text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">{t('retreat_to_friendly_cell', { defaultValue: 'Retreat to Friendly Cell' })}</div>
                    {adjacentFriendly.length === 0 ? (
                      <div className="text-xs text-neutral-600 italic">{t('no_friendly_adjacent', { defaultValue: 'No friendly adjacent cells available for retreat.' })}</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {adjacentFriendly.map((key: string) => (
                          <button
                            key={key}
                            disabled={isAnimating}
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
                        disabled={submittingMove || disabled || isAnimating}
                        className={`w-full mt-2.5 py-2 rounded-xl bg-neutral-950 border font-semibold transition-all hover:scale-[1.01] active:scale-95 ${
                          myPiece === 'X'
                            ? 'border-blue-600/40 text-blue-400 hover:bg-blue-950/70'
                            : 'border-rose-600/40 text-rose-400 hover:bg-rose-950/70'
                        }`}
                      >
                        {t('execute_retreat_to', { defaultValue: 'Execute Retreat to' })} {retreatTargetKey}
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
  );
};
