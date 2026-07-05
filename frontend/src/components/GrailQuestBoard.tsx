import { useGrailQuestBoard } from './grailquest/useGrailQuestBoard';
import { HexGridRenderer } from './grailquest/HexGridRenderer';
import { GrailControls } from './grailquest/GrailControls';
import { GrailSidePanel } from './grailquest/GrailSidePanel';
import { CardHand } from './grailquest/CardHand';

import type { GrailQuestBoardProps } from './grailquest/boardUtils';

export const GrailQuestBoard: React.FC<GrailQuestBoardProps> = (props) => {
  const { state, myPiece, submittingMove, onAction } = props;
  const hook = useGrailQuestBoard(props);
  const { phase, turn, pendingCombats } = state;

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
  const { board, grailCellKey, isReviewingLastTurn, setIsReviewingLastTurn, setReviewMoves, reviewDeploys, setReviewDeploys, reviewRadioactivity, setReviewRadioactivity, setLastReviewedEndTurnIdx, isLogCollapsed, setIsLogCollapsed, isMyTurn, aggregatedFriendlyMoves, aggregatedReviewMoves, lastSelfEndTurnIdx } = hook;
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
      <GrailSidePanel
        state={state}
        myPiece={myPiece}
        turn={turn}
        phase={phase}
        isMyTurn={isMyTurn}
        isReviewingLastTurn={isReviewingLastTurn}
        setIsReviewingLastTurn={setIsReviewingLastTurn}
        reviewRadioactivity={reviewRadioactivity}
        setReviewMoves={setReviewMoves}
        setReviewDeploys={setReviewDeploys}
        setReviewRadioactivity={setReviewRadioactivity}
        lastSelfEndTurnIdx={lastSelfEndTurnIdx}
        setLastReviewedEndTurnIdx={setLastReviewedEndTurnIdx}
        submittingMove={submittingMove}
        isBoardLocked={isBoardLocked}
        endDeploy={endDeploy}
        endTurn={endTurn}
        isLogCollapsed={isLogCollapsed}
        setIsLogCollapsed={setIsLogCollapsed}
        logContainerRef={logContainerRef as React.RefObject<HTMLDivElement>}
      />

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
