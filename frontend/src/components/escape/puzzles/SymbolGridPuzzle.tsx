import { useState, useCallback } from 'react';
import type { SymbolGridRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

interface Props {
  config: SymbolGridRoomConfig;
  onSolved: () => void;
}

export function SymbolGridPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [shaking, setShaking] = useState(false);
  const [solved, setSolved] = useState(false);
  const [playingSequence, setPlayingSequence] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState<number | null>(null);
  const [level, setLevel] = useState(3); // Starts with 3 symbols

  const playSequence = useCallback(async (currentLevel: number) => {
    setPlayingSequence(true);
    setPlayerSequence([]);
    
    // Wait a bit before starting
    await new Promise(r => setTimeout(r, 600));
    
    for (let i = 0; i < currentLevel; i++) {
      setActiveSymbol(config.solutionSequence[i]);
      await new Promise(r => setTimeout(r, 600));
      setActiveSymbol(null);
      await new Promise(r => setTimeout(r, 200));
    }
    
    setPlayingSequence(false);
  }, [config.solutionSequence]);

  const pressSymbol = useCallback((index: number) => {
    if (solved || shaking || playingSequence) return;

    setPlayerSequence((prev) => {
      const nextSeq = [...prev, index];
      
      // Check if the current sequence is correct so far
      for (let i = 0; i < nextSeq.length; i++) {
        if (nextSeq[i] !== config.solutionSequence[i]) {
          // Wrong symbol pressed!
          setShaking(true);
          setTimeout(() => {
            setPlayerSequence([]);
            setShaking(false);
            playSequence(level); // Replay current level
          }, 800);
          return prev; // don't update visually if wrong
        }
      }

      // If correct and full level length reached
      if (nextSeq.length === level) {
        if (level === config.solutionSequence.length) {
          // Entire puzzle solved
          setSolved(true);
          setTimeout(onSolved, 800);
        } else {
          // Progress to next level
          const nextLevel = level + 1;
          setLevel(nextLevel);
          setTimeout(() => {
            playSequence(nextLevel);
          }, 1000);
        }
      }

      return nextSeq;
    });
  }, [config.solutionSequence, onSolved, solved, shaking, playingSequence, level, playSequence]);

  const reset = useCallback(() => {
    if (solved || shaking || playingSequence) return;
    setPlayerSequence([]);
    setLevel(3);
  }, [solved, shaking, playingSequence]);

  return (
    <div className="escape-puzzle escape-symbol-grid flex flex-col md:flex-row gap-8 items-center">
      <div className="keypad-clues flex flex-col gap-4 max-w-sm">
        {config.clues.map((clue, idx) => (
          <div key={idx} className="keypad-clue-note bg-yellow-100 text-yellow-900 p-3 rounded shadow rotate-1 text-sm font-medium">
            <span className="keypad-clue-text">{clue}</span>
          </div>
        ))}
        <button className="escape-nav-back mt-2 w-full text-center" onClick={reset} disabled={playingSequence}>
          {t('ui_reset', { defaultValue: 'Reset Sequence' })}
        </button>
        <button 
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          onClick={() => playSequence(level)}
          disabled={playingSequence || solved || shaking}
        >
          {playingSequence ? 'Memorize...' : 'Play Sequence'}
        </button>
      </div>

      <div className={`keypad-panel flex flex-col items-center gap-6${shaking ? ' shake' : ''}${solved ? ' correct' : ''}`}>
        <div className="keypad-display flex gap-2 mb-2" aria-label={t('ui_entered_symbols', { defaultValue: 'Entered Symbols' })} aria-live="polite">
          {Array.from({ length: level }).map((_, i) => (
            <span key={i} className={`keypad-digit w-10 h-10 flex items-center justify-center bg-black/50 border border-neutral-700 rounded text-xl ${playerSequence[i] !== undefined ? 'text-white border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-neutral-600'}`}>
              {playerSequence[i] !== undefined ? config.symbols[playerSequence[i]] : '○'}
            </span>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-3 p-5 bg-neutral-900 rounded-xl border-2 border-neutral-800 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]">
          {config.symbols.map((symbol, i) => {
            const isSelected = playerSequence.includes(i);
            const isHighlight = activeSymbol === i;
            return (
              <button
                key={i}
                data-testid={`symbol-btn-${i}`}
                className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl bg-neutral-800 border-b-4 border-neutral-950 rounded-lg transition-all active:border-b-0 active:translate-y-1 hover:brightness-110 ${isSelected ? 'opacity-30 cursor-not-allowed border-b-0 translate-y-1' : ''} ${isHighlight ? 'bg-blue-600 border-blue-800 scale-110 shadow-[0_0_20px_rgba(37,99,235,0.8)]' : 'cursor-pointer shadow-md'}`}
                onClick={() => !isSelected && pressSymbol(i)}
                disabled={isSelected || solved || shaking || playingSequence}
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
