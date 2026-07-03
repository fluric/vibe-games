import React from 'react';
import { useTranslation } from 'react-i18next';
import type { HolyGrailGameState, PlayerPiece } from '@vibe-games/shared';
import * as audio from '../AudioEffects';
import { formatCardValue, parseCardLabel } from './boardUtils';
import { getGroupedHistory } from './historyUtils';
import { GroupedHistoryEntry } from './HistoryRenderer';

interface GrailSidePanelProps {
  state: HolyGrailGameState;
  myPiece: PlayerPiece | null;
  turn: 'X' | 'O';
  phase: 'deploy' | 'move' | 'react';
  isMyTurn: boolean;
  isReviewingLastTurn: boolean;
  setIsReviewingLastTurn: (val: boolean) => void;
  reviewRadioactivity: any[];
  setReviewMoves: (moves: any[]) => void;
  setReviewDeploys: (deploys: any[]) => void;
  setReviewRadioactivity: (rads: any[]) => void;
  lastSelfEndTurnIdx: number;
  setLastReviewedEndTurnIdx: (idx: number) => void;
  submittingMove: boolean;
  isBoardLocked: boolean;
  endDeploy: () => void;
  endTurn: () => void;
  isLogCollapsed: boolean;
  setIsLogCollapsed: (val: boolean) => void;
  logContainerRef: React.RefObject<HTMLDivElement>;
}

export const GrailSidePanel: React.FC<GrailSidePanelProps> = ({
  state,
  myPiece,
  turn,
  phase,
  isMyTurn,
  isReviewingLastTurn,
  setIsReviewingLastTurn,
  reviewRadioactivity,
  setReviewMoves,
  setReviewDeploys,
  setReviewRadioactivity,
  lastSelfEndTurnIdx,
  setLastReviewedEndTurnIdx,
  submittingMove,
  isBoardLocked,
  endDeploy,
  endTurn,
  isLogCollapsed,
  setIsLogCollapsed,
  logContainerRef
}) => {
  const { t } = useTranslation('game');
  const { hands } = state;

  return (
    <div className="w-full xl:w-80 flex flex-col gap-4 bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl backdrop-blur-md relative z-20">
      <div>
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{t("active_turn", { defaultValue: "Active Turn" })}</div>
        <div className="flex items-center gap-2 mt-1 flex-nowrap">
          <span className={`w-3 h-3 rounded-full shrink-0 ${turn === 'X' ? 'bg-blue-500' : 'bg-rose-500'}`} />
          <span className="font-bold text-lg text-white whitespace-nowrap">{t("player_turn_prefix", { defaultValue: "Player" })} {turn}</span>
          {isMyTurn && (
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium shrink-0">{t("your_turn_badge", { defaultValue: "Your Turn" })}</span>
          )}
        </div>
      </div>

      {myPiece && (
        <div className="border-t border-neutral-800 pt-3">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{t("opponent_hand", { defaultValue: "Opponent Hand" })}</div>
          <div className="text-white font-bold text-lg mt-0.5">
            {hands[myPiece === 'X' ? 'O' : 'X']?.length || 0} {t("cards_count", { defaultValue: "cards" })}
          </div>
        </div>
      )}

      <div className="border-t border-neutral-800 pt-3 relative">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{t("phase", { defaultValue: "Phase" })}</div>
          
          {/* Info Icon & Hover Tooltip */}
          <div className="relative group/info cursor-help flex items-center justify-center w-5 h-5 rounded-full bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-400 font-bold transition-all shadow-sm shadow-indigo-500/10">
            ℹ️
            <div className="absolute right-0 top-full mt-2 xl:left-full xl:right-auto xl:top-1/2 xl:-translate-y-1/2 xl:mt-0 xl:ml-2 hidden group-hover/info:block w-64 bg-neutral-950 border border-neutral-800 p-3.5 rounded-xl shadow-2xl z-50 pointer-events-none text-xs leading-relaxed text-neutral-350 font-normal normal-case">
              {isReviewingLastTurn ? (
                <span>
                  {t("review_mode_desc", { defaultValue: "<strong>Review Mode:</strong> Opponent turn completed. Take your time to review the logs and board state (opponent deployments/moves shown as overlays) before starting your action phase." })}
                </span>
              ) : (
                <>
                  {phase === 'deploy' && (
                    <span>
                      {t("deploy_phase_desc1", { defaultValue: "Deploy cards from your hand onto your 🛖 <strong>Urban housing cells</strong>." })} 
                      <br/><br/>
                      {t("deploy_phase_desc2", { defaultValue: "Your valid cells are highlighted in purple." })} 
                      <br/><br/>
                      {t("deploy_phase_desc3", { defaultValue: "<strong>To place:</strong> Click a highlighted housing cell, then click a card in your hand. Or click a card first, then click a highlighted cell." })}
                    </span>
                  )}
                  {phase === 'move' && (
                    <span>{t("move_phase_desc", { defaultValue: "Select one of your stacks, then click an adjacent hex to move units. Stacks with Kings can carry the Grail 🏆." })}</span>
                  )}
                  {phase === 'react' && (
                    <span>{t("react_phase_desc", { defaultValue: "You are under attack! Click the contested cells (highlighted in red ⚔️) to fight or retreat." })}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
          <span className="text-white font-semibold text-lg capitalize">
            {isReviewingLastTurn ? t('review_phase', { defaultValue: 'Review Phase' }) : `${t(phase + '_phase', { defaultValue: phase + ' Phase' })}`}
          </span>
          {isReviewingLastTurn && (reviewRadioactivity || []).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {reviewRadioactivity.map((rad: any, idx: number) => {
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
            {t('start_my_turn', { defaultValue: 'Start My Turn' })}
          </button>
        ) : isMyTurn ? (
          phase === 'deploy' ? (
            <button
              onClick={endDeploy}
              disabled={submittingMove || isBoardLocked}
              className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 shadow-lg shadow-indigo-600/20 transition-all duration-200 cursor-pointer"
            >
              {t('go_to_movement', { defaultValue: 'Go to Movement' })}
            </button>
          ) : phase === 'move' ? (
            <button
              onClick={endTurn}
              disabled={submittingMove || isBoardLocked}
              className="w-full py-2.5 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 shadow-lg shadow-emerald-600/20 transition-all duration-200 cursor-pointer"
            >
              {t('end_turn_btn', { defaultValue: 'End Turn' })}
            </button>
          ) : (
            <div className="text-center text-xs text-neutral-500 italic py-2">{t('reacting_to_combat', { defaultValue: 'Reacting to combat...' })}</div>
          )
        ) : (
          <button
            disabled
            className="w-full py-2.5 rounded-xl font-semibold bg-neutral-900 text-neutral-500 cursor-not-allowed border border-neutral-800/60"
          >
            {t('opponent_turn_btn', { defaultValue: 'Opponent Turn' })}
          </button>
        )}
      </div>

      {/* Battle Log */}
      <div className="border-t border-neutral-800 pt-3 flex flex-col w-full">
        <button 
          onClick={() => setIsLogCollapsed(!isLogCollapsed)}
          className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 w-full hover:text-neutral-300 transition-colors"
        >
          <span>{t("battle_log", { defaultValue: "Battle Log" })}</span>
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
                return groupedLogs.map((grouped) => <GroupedHistoryEntry key={grouped.key} grouped={grouped} />);
              }
              return (
                <div className="text-xs text-neutral-600 italic text-center my-auto">{t("no_events_yet", { defaultValue: "No events yet." })}</div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
