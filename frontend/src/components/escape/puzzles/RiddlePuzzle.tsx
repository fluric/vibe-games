import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RiddleRoomConfig } from '../../../data/escapeRooms';
import { playPlaceSound, playVictorySound, playErrorSound } from '../../AudioEffects';

interface Props {
  config: RiddleRoomConfig;
  onSolved: () => void;
}

/** 
 * Riddle text input puzzle.
 * Allows the user to type in an answer to a given riddle text.
 */
export function RiddlePuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [inputValue, setInputValue] = useState('');
  const [solved, setSolved] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (solved) return;

    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const guess = normalize(inputValue);
    const solutionStr = normalize(config.solution);

    // Check for exact match or synonyms
    const isCorrect = 
      guess === solutionStr || 
      (solutionStr === 'CLE' && guess === 'CLEF') ||
      (solutionStr === 'HUMAN' && guess === 'MAN');

    if (isCorrect) {
      playVictorySound();
      setSolved(true);
      setTimeout(onSolved, 800); // short delay to show success state
    } else {
      playErrorSound();
      setErrorFlash(true);
      setTimeout(() => setErrorFlash(false), 500);
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    playPlaceSound();
    setInputValue(e.target.value.toUpperCase());
  };

  return (
    <div className={`escape-puzzle escape-riddle ${solved ? 'solved' : ''}`}>
      <div className="flex flex-col items-center justify-center p-6 gap-6 max-w-lg mx-auto bg-neutral-900/80 rounded-2xl border border-amber-900/40 shadow-2xl backdrop-blur-sm">
        
        <div className="text-center space-y-4">
          <div className="text-3xl mb-2">👁️</div>
          <div className="text-xl font-serif text-amber-100 leading-relaxed italic">
            {config.riddleText.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full mt-4 flex flex-col items-center gap-4">
          <input
            type="text"
            className={`w-full text-center text-2xl tracking-widest font-mono bg-neutral-950 border-2 rounded-xl py-3 px-4 focus:outline-none transition-all ${
              errorFlash
                ? 'border-rose-500 text-rose-400'
                : solved
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                : 'border-amber-700/50 text-amber-200 focus:border-amber-500'
            }`}
            placeholder={t('ui_type_answer', { defaultValue: 'TYPE ANSWER...' })}
            value={inputValue}
            onChange={handleInputChange}
            disabled={solved}
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />
          
          <button
            type="submit"
            disabled={solved || !inputValue.trim()}
            className={`px-8 py-2 rounded-lg font-bold tracking-widest transition-colors ${
              solved 
                ? 'bg-emerald-600 text-white' 
                : 'bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50'
            }`}
          >
            {solved ? t('ui_solved', { defaultValue: 'SOLVED' }) : t('ui_submit', { defaultValue: 'SUBMIT' })}
          </button>
        </form>

      </div>
    </div>
  );
}
