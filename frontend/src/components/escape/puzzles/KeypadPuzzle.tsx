import { useState, useCallback } from 'react';
import type { KeypadRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

interface Props {
  config: KeypadRoomConfig;
  onSolved: () => void;
}

/** 4-digit PIN keypad puzzle.
 *  Three clues are visible in the scene; one is hidden behind a tappable hotspot. */
export function KeypadPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [digits, setDigits] = useState('');
  const [shaking, setShaking] = useState(false);
  const [revealedHotspot, setRevealedHotspot] = useState(false);
  const [solved, setSolved] = useState(false);

  const pressDigit = useCallback((d: string) => {
    if (solved) return;
    setDigits((prev) => (prev.length < 4 ? prev + d : prev));
  }, [solved]);

  const pressDelete = useCallback(() => {
    if (solved) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [solved]);

  const pressConfirm = useCallback(() => {
    if (solved || digits.length < 4) return;
    if (digits === config.solution) {
      setSolved(true);
      setTimeout(onSolved, 700);
    } else {
      setShaking(true);
      setDigits('');
      setTimeout(() => setShaking(false), 600);
    }
  }, [digits, config.solution, onSolved, solved]);

  return (
    <div className="escape-puzzle escape-keypad">
      {/* Visible clues */}
      <div className="keypad-clues">
        {config.visibleClues.map((clue) => (
          <div key={clue.label} className="keypad-clue-note">
            <span className="keypad-clue-text">{clue.text}</span>
            <span className="keypad-clue-label">{clue.label}</span>
          </div>
        ))}
        {/* Hidden hotspot */}
        <button
          className={`keypad-hotspot${revealedHotspot ? ' revealed' : ''}`}
          onClick={() => setRevealedHotspot(true)}
          aria-label={config.hiddenHotspot.label}
        >
          {revealedHotspot ? (
            <span className="keypad-clue-text glow">{config.hiddenHotspot.revealedClue}</span>
          ) : (
            <span className="keypad-hotspot-icon">🔍 {config.hiddenHotspot.label}</span>
          )}
        </button>
      </div>

      {/* Keypad */}
      <div className={`keypad-panel${shaking ? ' shake' : ''}${solved ? ' correct' : ''}`}>
        <div className="keypad-display" aria-label={t('ui_entered_pin', { defaultValue: 'Entered PIN' })} aria-live="polite">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`keypad-digit${digits[i] ? ' filled' : ''}`}>
              {digits[i] ? '●' : '○'}
            </span>
          ))}
        </div>
        <div className="keypad-grid">
          {['1','2','3','4','5','6','7','8','9','⌫','0','↵'].map((key) => (
            <button
              key={key}
              id={`keypad-btn-${key}`}
              className="keypad-key"
              onClick={() => {
                if (key === '⌫') pressDelete();
                else if (key === '↵') pressConfirm();
                else pressDigit(key);
              }}
              aria-label={key === '⌫' ? t('ui_delete', { defaultValue: 'Delete' }) : key === '↵' ? t('ui_confirm', { defaultValue: 'Confirm' }) : key}
            >
              {key}
            </button>
          ))}
        </div>
        {solved && <p className="keypad-success">{t('ui_correct', { defaultValue: '✓ Correct' })}</p>}
      </div>
    </div>
  );
}
