import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onComplete: () => void;
}

/** Animated door-unlock transition.
 *  When isOpen becomes true: plays a door-sweep animation, then calls onComplete. */
export function DoorUnlock({ isOpen, onComplete }: Props) {
  const { t } = useTranslation('escape');
  const [phase, setPhase] = useState<'idle' | 'unlocking' | 'done'>('idle');

  useEffect(() => {
    if (isOpen) {
      setPhase('unlocking');
      const t = setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 1800);
      return () => clearTimeout(t);
    } else {
      setPhase('idle');
    }
  }, [isOpen, onComplete]);

  if (phase === 'idle') return null;

  return (
    <div className="door-overlay" role="status" aria-label="Door unlocking…">
      <div className="door-frame">
        <div className={`door-panel${phase === 'unlocking' ? ' swinging' : ''}`} />
        <div className="door-lock-icon">🔓</div>
      </div>
      <p className="door-text">{t('access_granted', { defaultValue: 'Access granted…' })}</p>
    </div>
  );
}
