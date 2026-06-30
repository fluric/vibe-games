import { useState, useCallback } from 'react';
import type { SymbolGridRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

interface Props {
  config: SymbolGridRoomConfig;
  onSolved: () => void;
}

export function SymbolGridPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [sequence, setSequence] = useState<number[]>([]);
  const [shaking, setShaking] = useState(false);
  const [solved, setSolved] = useState(false);

  const pressSymbol = useCallback((index: number) => {
    if (solved || shaking) return;

    setSequence((prev) => {
      const nextSeq = [...prev, index];
      
      // Check if the current sequence is correct so far
      for (let i = 0; i < nextSeq.length; i++) {
        if (nextSeq[i] !== config.solutionSequence[i]) {
          // Wrong symbol pressed!
          setShaking(true);
          setTimeout(() => {
            setSequence([]);
            setShaking(false);
          }, 600);
          return prev; // don't update sequence visually if wrong
        }
      }

      // If correct and full length reached
      if (nextSeq.length === config.solutionSequence.length) {
        setSolved(true);
        setTimeout(onSolved, 800);
      }

      return nextSeq;
    });
  }, [config.solutionSequence, onSolved, solved, shaking]);

  const reset = useCallback(() => {
    if (solved || shaking) return;
    setSequence([]);
  }, [solved, shaking]);

  return (
    <div className="escape-puzzle escape-symbol-grid flex flex-col md:flex-row gap-8 items-center">
      <div className="keypad-clues flex flex-col gap-4 max-w-sm">
        {config.clues.map((clue, idx) => (
          <div key={idx} className="keypad-clue-note bg-yellow-100 text-yellow-900 p-3 rounded shadow rotate-1 text-sm font-medium">
            <span className="keypad-clue-text">{clue}</span>
          </div>
        ))}
        <button className="escape-nav-back mt-2 w-full text-center" onClick={reset}>
          {t('ui_reset', { defaultValue: 'Reset Sequence' })}
        </button>
      </div>

      <div className={`keypad-panel flex flex-col items-center gap-6${shaking ? ' shake' : ''}${solved ? ' correct' : ''}`}>
        <div className="keypad-display flex gap-2 mb-2" aria-label={t('ui_entered_symbols', { defaultValue: 'Entered Symbols' })} aria-live="polite">
          {Array.from({ length: config.solutionSequence.length }).map((_, i) => (
            <span key={i} className={`keypad-digit w-10 h-10 flex items-center justify-center bg-black/50 border border-neutral-700 rounded text-xl ${sequence[i] !== undefined ? 'text-white border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-neutral-600'}`}>
              {sequence[i] !== undefined ? config.symbols[sequence[i]] : '○'}
            </span>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-3 p-5 bg-neutral-900 rounded-xl border-2 border-neutral-800 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]">
          {config.symbols.map((symbol, i) => {
            const isSelected = sequence.includes(i);
            return (
              <button
                key={i}
                data-testid={`symbol-btn-${i}`}
                className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl bg-neutral-800 border-b-4 border-neutral-950 rounded-lg transition-all active:border-b-0 active:translate-y-1 hover:brightness-110 ${isSelected ? 'opacity-30 cursor-not-allowed border-b-0 translate-y-1' : 'cursor-pointer shadow-md'}`}
                onClick={() => !isSelected && pressSymbol(i)}
                disabled={isSelected || solved || shaking}
                aria-label={`Symbol ${i}`}
              >
                {symbol}
              </button>
            );
          })}
        </div>

        {solved && <p className="keypad-success text-emerald-400 font-bold text-lg mt-2">{t('ui_correct', { defaultValue: '✓ Correct' })}</p>}
      </div>
    </div>
  );
}
