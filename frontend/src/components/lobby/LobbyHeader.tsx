import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UserDto } from '@vibe-games/shared';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface Props {
  currentUser: UserDto | null;
  username: string;
  isEditingName: boolean;
  editNameVal: string;
  setEditNameVal: (val: string) => void;
  setIsEditingName: (val: boolean) => void;
  onSaveName: (e: React.FormEvent) => void;
  onLogout: () => void;
}

export function LobbyHeader({
  currentUser,
  username,
  isEditingName,
  editNameVal,
  setEditNameVal,
  setIsEditingName,
  onSaveName,
  onLogout,
}: Props) {
  const { t } = useTranslation('lobby');

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400 bg-clip-text text-transparent">
          Vibe Games
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          {t('subtitle', { defaultValue: 'Select a game and challenge players in real time' })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {currentUser && (
          <div className="flex items-center gap-2 bg-neutral-900/50 border border-neutral-800/85 px-3 py-1.5 rounded-xl text-xs w-fit">
            <span className="text-neutral-500 font-medium">{t('player', { defaultValue: 'Player:' })}</span>
            {isEditingName ? (
              <form onSubmit={onSaveName} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editNameVal}
                  onChange={(e) => setEditNameVal(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-neutral-700 w-32"
                  autoFocus
                  required
                />
                <button type="submit" className="text-emerald-400 hover:text-emerald-300 font-bold px-1 cursor-pointer">✓</button>
                <button type="button" onClick={() => setIsEditingName(false)} className="text-rose-400 hover:text-rose-300 font-bold px-1 cursor-pointer">✕</button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white">{username}</span>
                <button
                  onClick={() => {
                    setEditNameVal(username);
                    setIsEditingName(true);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] underline ml-1 cursor-pointer"
                >
                  {t('edit_name')}
                </button>
              </div>
            )}
          </div>
        )}
        <LanguageSwitcher />
        <Link
          to="/status"
          className="text-xs px-3.5 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-medium transition-all"
        >
          {t('system_health')}
        </Link>
        {currentUser && (
          <button
            onClick={onLogout}
            className="text-xs px-3.5 py-2 rounded-lg bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900/40 text-rose-400 font-medium transition-all active:scale-95"
          >
            {t('log_out')}
          </button>
        )}
      </div>
    </div>
  );
}
