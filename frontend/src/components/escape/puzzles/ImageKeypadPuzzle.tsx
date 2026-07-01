import { useState, useCallback } from 'react';
import type { ImageKeypadRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

interface Props {
  config: ImageKeypadRoomConfig;
  onSolved: () => void;
}

/** 4-digit PIN puzzle with a large reference image. */
export function ImageKeypadPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [digits, setDigits] = useState('');
  const [shaking, setShaking] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);

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
      setShowHint(false);
      setTimeout(onSolved, 700);
    } else {
      setShaking(true);
      // If the user falls for the mirrored trap (0920 instead of 0340)
      if (digits === '0920' || digits === '9200') {
        setShowHint(true);
      }
      setDigits('');
      setTimeout(() => setShaking(false), 600);
    }
  }, [digits, config.solution, onSolved, solved]);

  return (
    <div className="escape-puzzle escape-image-keypad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '1rem' }}>
      
      {/* The main puzzle image */}
      <div className="image-keypad-image-container" style={{ maxWidth: '800px', width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <img 
          src={config.imageUrl} 
          alt="Puzzle visual" 
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      {/* Keypad */}
      <div className={`keypad-panel${shaking ? ' shake' : ''}${solved ? ' correct' : ''}`}>
        <div className="keypad-display" aria-label={t('ui_entered_pin', { defaultValue: 'Entered PIN' })} aria-live="polite">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`keypad-digit${digits[i] ? ' filled' : ''}`}>
              {digits[i] ? digits[i] : '○'}
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
        {showHint && !solved && <p className="keypad-error" style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>{t('room4.trap_hint', { defaultValue: 'Are you sure about that time? Look closely at the numbers...' })}</p>}
      </div>
    </div>
  );
}
