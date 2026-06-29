import React from 'react';

import type { 
} from '@vibe-games/shared';
import * as audio from './AudioEffects';
import { useHolyGrailBoard } from './holygrail/useHolyGrailBoard';
import { CardHand } from './holygrail/CardHand';
import { HexGridRenderer } from './holygrail/HexGridRenderer';
import { GrailControls } from './holygrail/GrailControls';

import {
  formatCardValue,
  parseCardLabel,
  getGroupedHistory,
  renderGroupedHistoryEntry,
  HolyGrailBoardProps
} from './holygrail/boardUtils';

export const HolyGrailBoard: React.FC<HolyGrailBoardProps> = ({
  state,
  myPiece,
  disabled,
  submittingMove,
  onAction
}) => {
  const hook = useHolyGrailBoard(props);
  const { state, myPiece, submittingMove, onAction } = props; // @ts-ignore
  const { hands, phase, turn, pendingCombats } = state;
  const { setIsReviewingLastTurn } = hook;
  const { setReviewMoves } = hook;
  const { setReviewDeploys } = hook;
  const { setReviewRadioactivity } = hook;
  const { setLastReviewedEndTurnIdx } = hook;
  const { setIsLogCollapsed } = hook;
  const { activeHand } = hook;
  const { selectedHandCardIndex } = hook;
  const { selectedCellKey } = hook;
  const { setSelectedCellKey } = hook;
  const { hoveredCellKey } = hook;
  const { setHoveredCellKey } = hook;
  const { moveTargetKey } = hook;
  const { retreatTargetKey } = hook;
  const { setRetreatTargetKey } = hook;
  const { moveCount } = hook;
  const { setMoveCount } = hook;
  const { activeCombatCellKey } = hook;
  const { setActiveCombatCellKey } = hook;
  const { hoveredMoveIdx } = hook;
  const { setHoveredMoveIdx } = hook;
  const { displayedCombat } = hook;
  const { displayedAttackerVal } = hook;
  const { displayedDefenderVal } = hook;
  const { displayedDefenderVal2 } = hook;
  const { displayedDefenderStack } = hook;
  const { isRevealingAttacker } = hook;
  const { isRevealingDefender } = hook;
  const { isTransitioningNext } = hook;
  const { isBoardLocked } = hook;
  const { logContainerRef } = hook;
  const { getCellFillClass } = hook;
  const { handleCellClick } = hook;
  const { handleHandCardClick } = hook;
  const { endDeploy } = hook;
  const { executeMove } = hook;
  const { endTurn } = hook;
  const { getAdjacentFriendlyCells } = hook;
  const { executeFightReact } = hook;
  const { executeRetreatReact } = hook;
  const { canDeploy } = hook;
  const { board, grailCellKey, isReviewingLastTurn, setIsReviewingLastTurn, setReviewMoves, setReviewDeploys, setReviewRadioactivity, setLastReviewedEndTurnIdx, isLogCollapsed, setIsLogCollapsed, isMyTurn, aggregatedFriendlyMoves, aggregatedReviewMoves } = hook;
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
          <div className="flex items-center gap-2 mt-1 flex-nowrap">
            <span className={`w-3 h-3 rounded-full shrink-0 ${turn === 'X' ? 'bg-blue-500' : 'bg-rose-500'}`} />
            <span className="font-bold text-lg text-white whitespace-nowrap">Player {turn}</span>
            {isMyTurn && (
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium shrink-0">Your Turn</span>
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
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            <span className="text-white font-semibold text-lg capitalize">
              {isReviewingLastTurn ? 'Review Phase' : `${phase} Phase`}
            </span>
            {isReviewingLastTurn && reviewRadioactivity.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {reviewRadioactivity.map((rad, idx) => {
                  const isX = rad.player === 'X';
                  const playerColor = isX ? 'text-blue-400' : rad.player === 'O' ? 'text-rose-400' : 'text-neutral-400';
                  const cardVal = parseCardLabel(rad.card);
                  const displaySymbol = formatCardValue(cardVal);
                  return (
                    <div 
                      key={idx} 
                      title={`Destroyed by radiation at ${rad.cellKey === '0,0' ? 'Grail Center' : rad.cellKey}`}
                      className="text-[10px] font-mono flex items-center gap-1 cursor-help"
                    >
                      <span>☢️</span>
                      <span className={`${playerColor} font-black bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 shadow-md`}>
                        {displaySymbol}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
                setReviewRadioactivity([]);
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
        {pendingCombats.length > 0 && !isReviewingLastTurn && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-1.5 max-w-md w-full px-4">
            {pendingCombats.map((c, idx) => {
              const isControllingReaction = phase === 'react' && c.defender === myPiece && !isReviewingLastTurn;
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
        <HexGridRenderer
          board={board}
          grailCellKey={grailCellKey}
          pendingCombats={pendingCombats}
          hoveredCellKey={hoveredCellKey}
          setHoveredCellKey={setHoveredCellKey}
          handleCellClick={handleCellClick}
          getCellFillClass={getCellFillClass}
          myPiece={myPiece}
          turn={turn}
          isReviewingLastTurn={isReviewingLastTurn}
          reviewDeploys={reviewDeploys}
          aggregatedFriendlyMoves={aggregatedFriendlyMoves}
          aggregatedReviewMoves={aggregatedReviewMoves}
          hoveredMoveIdx={hoveredMoveIdx}
          setHoveredMoveIdx={setHoveredMoveIdx}
        />

        {/* Hand View at the bottom of the board canvas (Spacious card-game style) */}
        <CardHand
          activeHand={activeHand}
          canDeploy={canDeploy}
          selectedHandCardIndex={selectedHandCardIndex}
          selectedCellKey={selectedCellKey}
          isBoardLocked={isBoardLocked}
          submittingMove={submittingMove}
          isMyTurn={isMyTurn}
          isReviewingLastTurn={isReviewingLastTurn}
          phase={phase}
          handleHandCardClick={handleHandCardClick}
          onAction={onAction}
          setSelectedCellKey={setSelectedCellKey}
        />
      </div>

      {/* ── Active Actions Panels (Right Column) ── */}
      <GrailControls
        isMyTurn={isMyTurn}
        phase={phase}
        selectedCellKey={selectedCellKey}
        isReviewingLastTurn={isReviewingLastTurn}
        moveTargetKey={moveTargetKey}
        grailCellKey={grailCellKey}
        board={board}
        moveCount={moveCount}
        setMoveCount={setMoveCount}
        executeMove={executeMove}
        submittingMove={submittingMove}
        isBoardLocked={isBoardLocked}
        activeCombatCellKey={activeCombatCellKey}
        setActiveCombatCellKey={setActiveCombatCellKey}
        displayedCombat={displayedCombat}
        getAdjacentFriendlyCells={getAdjacentFriendlyCells}
        myPiece={myPiece}
        isRevealingAttacker={isRevealingAttacker}
        isRevealingDefender={isRevealingDefender}
        isTransitioningNext={isTransitioningNext}
        state={state}
        displayedAttackerVal={displayedAttackerVal}
        displayedDefenderVal={displayedDefenderVal}
        displayedDefenderVal2={displayedDefenderVal2}
        displayedDefenderStack={displayedDefenderStack}
        executeFightReact={executeFightReact}
        executeRetreatReact={executeRetreatReact}
        retreatTargetKey={retreatTargetKey}
        setRetreatTargetKey={setRetreatTargetKey}
      />

    </div>
  );
};
