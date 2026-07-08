import { useTranslation } from 'react-i18next';

interface Props {
  activeGameTab: 'mill' | 'connect_four' | 'grail_quest' | 'escape' | 'reversi';
  setActiveGameTab: (tab: 'mill' | 'connect_four' | 'grail_quest' | 'escape' | 'reversi') => void;
}

export function GameModeTabs({ activeGameTab, setActiveGameTab }: Props) {
  const { t } = useTranslation('lobby');

  return (
    <div className="flex bg-neutral-900/60 border border-neutral-800 p-1.5 rounded-2xl gap-2 w-full max-w-md mx-auto shadow-lg backdrop-blur-md">
      <button
        onClick={() => setActiveGameTab('mill')}
        className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
          activeGameTab === 'mill'
            ? 'bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.4)] text-white'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
        }`}
      >
        ⚙️ {t('nine_mens_morris', { defaultValue: "Nine Men's Morris" })}
      </button>
      <button
        onClick={() => setActiveGameTab('connect_four')}
        className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
          activeGameTab === 'connect_four'
            ? 'bg-rose-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
        }`}
      >
        🔴 {t('connect_four', { defaultValue: 'Connect Four' })}
      </button>
      <button
        onClick={() => setActiveGameTab('reversi')}
        className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
          activeGameTab === 'reversi'
            ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.4)] text-white'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
        }`}
      >
        ⚫ {t('reversi', { defaultValue: 'Reversi' })}
      </button>
      <button
        onClick={() => setActiveGameTab('grail_quest')}
        className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
          activeGameTab === 'grail_quest'
            ? 'bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.4)] text-white'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
        }`}
      >
        🏆 {t('grail_quest', { defaultValue: 'Grail Quest' })}
      </button>

      <button
        onClick={() => setActiveGameTab('escape')}
        className={`flex-1 py-3 text-sm rounded-xl font-bold transition-all active:scale-[0.98] ${
          activeGameTab === 'escape'
            ? 'bg-teal-600 shadow-[0_0_15px_rgba(20,184,166,0.4)] text-white'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
        }`}
      >
        🔐 {t('escape_room', { defaultValue: 'Escape' })}
      </button>
    </div>
  );
}
