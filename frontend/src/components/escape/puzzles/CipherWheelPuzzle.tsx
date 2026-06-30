import { useState, useRef, useCallback, useEffect } from 'react';
import type { CipherRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function caesarDecode(text: string, shift: number): string {
  return text
    .toUpperCase()
    .split('')
    .map((ch) => {
      const idx = ALPHABET.indexOf(ch);
      if (idx === -1) return ch;
      return ALPHABET[(idx - shift + 26) % 26];
    })
    .join('');
}

interface Props {
  config: CipherRoomConfig;
  onSolved: () => void;
}

/** Draggable cipher wheel puzzle.
 *  Player rotates two concentric rings to decode a ciphertext word. */
export function CipherWheelPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [shift, setShift] = useState(0);
  const [solved, setSolved] = useState(false);
  const [flash, setFlash] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  const decoded = caesarDecode(config.ciphertext, shift);
  const isCorrect = decoded === config.solution;

  const handleConfirm = useCallback(() => {
    if (solved || locked) return;
    if (isCorrect) {
      setSolved(true);
      setTimeout(onSolved, 700);
    } else {
      setFlash(true);
      const nextErrorCount = errorCount + 1;
      setErrorCount(nextErrorCount);
      const delayMs = 1000 * Math.pow(2, nextErrorCount - 1); // 1s, 2s, 4s...
      setLocked(true);
      
      setTimeout(() => {
        setFlash(false);
        setLocked(false);
      }, delayMs);
    }
  }, [isCorrect, onSolved, solved, locked, errorCount]);

  // Mouse drag
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - lastX.current;
    if (Math.abs(delta) > 12) {
      setShift((s) => (s + (delta > 0 ? 1 : -1) + 26) % 26);
      lastX.current = e.clientX;
    }
  };
  const onPointerUp = () => { dragging.current = false; };

  // Keyboard arrow support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setShift((s) => (s - 1 + 26) % 26);
      if (e.key === 'ArrowRight') setShift((s) => (s + 1) % 26);
      if (e.key === 'Enter') handleConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleConfirm]);

  const outerDeg = (shift / 26) * 360;

  return (
    <div className="escape-puzzle escape-cipher">
      {/* Scene clue */}
      <div className="cipher-clue-box">
        <span className="cipher-clue-icon">🕰️</span>
        <span className="cipher-clue-text">{config.sceneClueText}</span>
      </div>

      <p className="cipher-instruction" style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0.5rem 0 1.5rem', textAlign: 'center', maxWidth: '400px', alignSelf: 'center' }}>
        <strong>{t('ui.hint', { defaultValue: 'Hint:' })}</strong> {t('ui.cipher_instruction', { defaultValue: 'This is a Caesar cipher. By dragging the wheel, you shift every letter in the encoded message by a fixed number of spaces across the alphabet.' })}
      </p>

      {/* Ciphertext display */}
      <div className="cipher-scroll">
        <span className="cipher-label">{t('ui.encoded_message', { defaultValue: 'Encoded message:' })}</span>
        <span className="cipher-ciphertext">{config.ciphertext}</span>
        <span className="cipher-arrow">↓ {t('ui.shift', { defaultValue: 'shift' })} = {shift}</span>
        <span className={`cipher-decoded${solved ? ' match' : ''}`}>{decoded}</span>
      </div>

      {/* Wheel */}
      <div
        ref={wheelRef}
        className={`cipher-wheel${solved ? ' solved' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={25}
        aria-valuenow={shift}
        aria-label={t('ui.cipher_wheel_aria', { defaultValue: 'Cipher shift wheel — drag left or right' })}
        tabIndex={0}
      >
        {/* Outer ring — ciphertext letters */}
        <div className="cipher-ring outer" style={{ transform: `rotate(${outerDeg}deg)` }}>
          {ALPHABET.split('').map((ch, i) => (
            <span
              key={ch}
              className="cipher-ring-letter"
              style={{ transform: `rotate(${(i / 26) * 360}deg) translateY(-110px)` }}
            >
              {ch}
            </span>
          ))}
        </div>
        {/* Inner ring — plaintext letters (fixed) */}
        <div className="cipher-ring inner">
          {ALPHABET.split('').map((ch, i) => (
            <span
              key={ch}
              className="cipher-ring-letter"
              style={{ transform: `rotate(${(i / 26) * 360}deg) translateY(-70px)` }}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="cipher-wheel-center">
          <span>{t('ui.drag', { defaultValue: 'DRAG' })}</span>
        </div>
      </div>

      <button
        className={`escape-btn${flash ? ' flash-error' : ''}${solved ? ' solved' : ''}`}
        onClick={handleConfirm}
        disabled={solved || locked}
        id="cipher-confirm-btn"
      >
        {solved ? t('ui.decoded', { defaultValue: '✓ Decoded!' }) : locked ? t('ui.system_locked', { defaultValue: 'System Locked...' }) : t('ui.confirm_decoding', { defaultValue: 'Confirm Decoding' })}
      </button>
    </div>
  );
}
