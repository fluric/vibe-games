import { formatCardValue } from './utils';
import { useTranslation } from 'react-i18next';

export interface CardHandProps {
  activeHand: { value: number; revealed: boolean }[];
  canDeploy: boolean;
  selectedHandCardIndex: number | null;
  selectedCellKey: string | null;
  isBoardLocked: boolean;
  submittingMove: boolean;
  isMyTurn: boolean;
  isReviewingLastTurn: boolean;
  phase: string;
  handleHandCardClick: (idx: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction: (action: any) => Promise<void>;
  setSelectedCellKey: (key: string | null) => void;
}

export const CardHand: React.FC<CardHandProps> = ({
  activeHand,
  canDeploy,
  selectedHandCardIndex,
  selectedCellKey,
  isBoardLocked,
  submittingMove,
  isMyTurn,
  isReviewingLastTurn,
  phase,
  handleHandCardClick,
  onAction,
  setSelectedCellKey
}) => {
  const { t } = useTranslation('game');
  return (
    <div 
      className={`w-full max-w-[560px] bg-neutral-900/80 border border-neutral-800/80 px-5 py-3 rounded-2xl backdrop-blur-md flex flex-col items-center gap-3 shadow-xl min-h-[195px] h-[195px] justify-center transition-all duration-300 ${!canDeploy ? 'border-neutral-900/50 bg-neutral-900/40 opacity-70' : ''}`}
    >
      <div className="flex justify-between items-center w-full text-xs font-semibold text-neutral-400 px-1">
        <span>{t('your_hand', { defaultValue: 'YOUR HAND' })} ({activeHand.length} {t('cards', { defaultValue: 'cards' })})</span>
        <div className="flex items-center gap-3">
          {!isMyTurn ? (
            <span className="text-neutral-500 font-mono uppercase tracking-wider text-[10px]">{t('opponents_turn', { defaultValue: 'Opponent\'s Turn' })}</span>
          ) : isReviewingLastTurn ? (
            <span className="text-neutral-500 font-mono uppercase tracking-wider text-[10px]">{t('review_phase', { defaultValue: 'Review Phase Active' })}</span>
          ) : phase !== 'deploy' ? (
            <span className="text-neutral-500 font-mono uppercase tracking-wider text-[10px]">{t('deploy_phase_only', { defaultValue: 'Deploy Phase Only' })}</span>
          ) : (
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
                  {t('deploy_all_to', { defaultValue: 'Deploy All to' })} {selectedCellKey}
                </button>
              )}
              <span>{selectedCellKey ? t('click_card_to_deploy', { defaultValue: 'Click a card to deploy to' }) + ` ${selectedCellKey}` : t('click_card_then_cell', { defaultValue: 'Click a card, then click a highlighted cell' })}</span>
            </>
          )}
        </div>
      </div>
      {activeHand.length === 0 ? (
        <div className="text-center py-6 text-neutral-600 text-sm italic">{t('empty_hand', { defaultValue: 'Empty hand' })}</div>
      ) : (
        <div className={`flex flex-nowrap overflow-x-auto justify-start gap-3 w-full pb-1.5 scrollbar-thin transition-all duration-300 ${!canDeploy ? 'opacity-30 grayscale saturate-0 pointer-events-none' : ''}`}>
          {activeHand.map((card, idx) => {
            const canInteract = canDeploy;
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
                  {card.value === 13 ? t('king', { defaultValue: 'King' }) : card.value === 12 ? t('queen', { defaultValue: 'Queen' }) : card.value === 11 ? t('jack', { defaultValue: 'Jack' }) : t('sol', { defaultValue: 'Sol' })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
