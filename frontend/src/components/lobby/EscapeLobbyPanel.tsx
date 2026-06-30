import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function EscapeLobbyPanel() {
  const { t } = useTranslation('lobby');

  return (
    <div className="bg-gradient-to-br from-teal-950/40 to-neutral-900/60 border border-teal-700/30 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center justify-center gap-6 text-center min-h-[280px]">
      <div className="w-16 h-16 rounded-2xl bg-teal-600/10 border border-teal-600/30 flex items-center justify-center text-3xl">
        🔐
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">Escape</h2>
        <p className="text-neutral-400 mt-2 max-w-md">
          {t('escape_solo_desc', { defaultValue: 'A solo puzzle adventure. Solve each room to unlock the next. How far can you get?' })}
        </p>
      </div>
      <Link
        to="/escape"
        id="escape-lobby-enter-btn"
        className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-8 rounded-xl transition-all active:scale-95 shadow-[0_0_24px_rgba(20,184,166,0.35)] hover:shadow-[0_0_32px_rgba(20,184,166,0.5)] text-base"
      >
        {t('enter_escape', { defaultValue: 'Enter Escape →' })}
      </Link>
    </div>
  );
}
