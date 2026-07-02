import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  devName: string;
  setDevName: (val: string) => void;
  devEmail: string;
  setDevEmail: (val: string) => void;
  loggingIn: boolean;
  onDevLogin: (e: React.FormEvent) => void;
  googleClientId?: string;
}

export function LobbyAuthBlock({
  devName,
  setDevName,
  devEmail,
  setDevEmail,
  loggingIn,
  onDevLogin,
  googleClientId
}: Props) {
  const { t } = useTranslation('lobby');
  const showMockForm = !import.meta.env.PROD || import.meta.env.VITE_ALLOW_MOCK_AUTH === 'true';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      {/* Glowing background circles */}
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-sm bg-neutral-900/60 border border-neutral-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl flex flex-col gap-6 z-10">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400 bg-clip-text text-transparent tracking-tight">
            Vibe Games
          </h1>
          <p className="text-neutral-400 text-xs mt-2">
            Sign in to host lobbies, play vs AI, or challenge friends
          </p>
        </div>

        {googleClientId ? (
          <div className="flex flex-col items-center gap-4 py-2 border-b border-neutral-800/60 pb-6 last:border-0 last:pb-0">
            <div id="google-signin-button" className="transition-transform active:scale-[0.98]" />
            <a
              href={`${(import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/^(?!https?:\/\/)/, 'https://')}/auth/google/redirect?returnUrl=${encodeURIComponent(window.location.href)}`}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
            >
              Having trouble? Sign in via redirect
            </a>
          </div>
        ) : null}

        {showMockForm ? (
          <form onSubmit={onDevLogin} className="flex flex-col gap-4 pt-2 border-t border-neutral-800/60 first:border-0 first:pt-0">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                {googleClientId ? 'Or Sign In with Mock Account' : 'Developer Guest Account'}
              </span>
              <p className="text-[11px] text-neutral-500 mb-1">
                Enter any name and email to play instantly.
              </p>
              <input
                type="text"
                placeholder="Developer Name"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all font-sans"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                type="email"
                placeholder="developer@vibegames.local"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn || !devName.trim() || !devEmail.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-[0.98]"
            >
              {loggingIn ? t('authenticating', { defaultValue: 'Authenticating...' }) : t('log_in', { defaultValue: 'Enter Vibe Games' })}
            </button>
          </form>
        ) : !googleClientId ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center leading-normal">
            🔒 {t('auth_not_configured', { defaultValue: 'Authentication is not configured. Please configure a Google Client ID in settings to enable sign-in.' })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
