import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import aiConfig from '../../../../backend/src/game/aiConfig.json';
import { BOT_DESCRIPTIONS, BOT_EMOJIS, BOT_HELP_TEXT } from '../../data/bots';

const typedConfig = aiConfig as unknown as Record<'mill' | 'connect_four' | 'holy_grail', Record<string, { id: string; username: string; elo: number; type: string }>>;
type BotLevel = 'easy' | 'medium' | 'hard' | 'easy_random' | 'easy_cowardly' | 'easy_greedy' | 'easy_aggressive' | 'medium_aggressive' | 'medium_defensive' | 'medium_mobile' | 'hard_tactical' | 'expert_garry' | 'legendary_magnus' | 'perfect_oracle' | 'expert_smart' | 'rl_novice' | 'rl_intermediate' | 'rl_strong' | 'rl_master';

interface CreateGamePanelProps {
  activeGameTab: 'mill' | 'connect_four' | 'holy_grail' | 'escape';
  creatingGame: boolean;
  syncStatus: 'synced' | 'warn' | 'mismatch';
  onCreateGame: (vsAi: boolean, isPublic: boolean, aiLevel?: BotLevel, aiStarts?: boolean) => void;
}

export function CreateGamePanel({ activeGameTab, creatingGame, syncStatus, onCreateGame }: CreateGamePanelProps) {
  const { t } = useTranslation();

  // Load saved preferences
  const loadPref = <T,>(key: string, defaultVal: T): T => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return defaultVal;
  };

  const [aiLevelMill, setAiLevelMill] = useState<BotLevel>(() => loadPref('aiLevel_mill', 'medium_aggressive'));
  const [aiLevelConnectFour, setAiLevelConnectFour] = useState<BotLevel>(() => loadPref('aiLevel_connect_four', 'medium_aggressive'));
  const [aiLevelHolyGrail, setAiLevelHolyGrail] = useState<BotLevel>(() => loadPref('aiLevel_holy_grail', 'medium_aggressive'));

  const [aiStartsMill, setAiStartsMill] = useState<boolean>(() => loadPref('aiStarts_mill', false));
  const [aiStartsConnectFour, setAiStartsConnectFour] = useState<boolean>(() => loadPref('aiStarts_connect_four', false));
  const [aiStartsHolyGrail, setAiStartsHolyGrail] = useState<boolean>(() => loadPref('aiStarts_holy_grail', false));

  const [gameModeMill, setGameModeMill] = useState<'ai' | 'human'>(() => loadPref('gameMode_mill', 'human'));
  const [gameModeConnectFour, setGameModeConnectFour] = useState<'ai' | 'human'>(() => loadPref('gameMode_connect_four', 'human'));
  const [gameModeHolyGrail, setGameModeHolyGrail] = useState<'ai' | 'human'>(() => loadPref('gameMode_holy_grail', 'human'));

  // Save preferences
  useEffect(() => { localStorage.setItem('aiLevel_mill', JSON.stringify(aiLevelMill)); }, [aiLevelMill]);
  useEffect(() => { localStorage.setItem('aiLevel_connect_four', JSON.stringify(aiLevelConnectFour)); }, [aiLevelConnectFour]);
  useEffect(() => { localStorage.setItem('aiLevel_holy_grail', JSON.stringify(aiLevelHolyGrail)); }, [aiLevelHolyGrail]);
  useEffect(() => { localStorage.setItem('aiStarts_mill', JSON.stringify(aiStartsMill)); }, [aiStartsMill]);
  useEffect(() => { localStorage.setItem('aiStarts_connect_four', JSON.stringify(aiStartsConnectFour)); }, [aiStartsConnectFour]);
  useEffect(() => { localStorage.setItem('aiStarts_holy_grail', JSON.stringify(aiStartsHolyGrail)); }, [aiStartsHolyGrail]);
  useEffect(() => { localStorage.setItem('gameMode_mill', JSON.stringify(gameModeMill)); }, [gameModeMill]);
  useEffect(() => { localStorage.setItem('gameMode_connect_four', JSON.stringify(gameModeConnectFour)); }, [gameModeConnectFour]);
  useEffect(() => { localStorage.setItem('gameMode_holy_grail', JSON.stringify(gameModeHolyGrail)); }, [gameModeHolyGrail]);

  if (activeGameTab === 'escape') {
    return (
      <div className="md:col-span-2 bg-gradient-to-br from-teal-950/40 to-neutral-900/60 border border-teal-700/30 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center justify-center gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-600/10 border border-teal-600/30 flex items-center justify-center text-3xl">
          🔐
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">Escape</h3>
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

  const currentAiStarts = activeGameTab === 'mill' ? aiStartsMill : activeGameTab === 'connect_four' ? aiStartsConnectFour : aiStartsHolyGrail;
  const currentGameMode = activeGameTab === 'mill' ? gameModeMill : activeGameTab === 'connect_four' ? gameModeConnectFour : gameModeHolyGrail;
  const currentAiLevel = activeGameTab === 'mill' ? aiLevelMill : activeGameTab === 'connect_four' ? aiLevelConnectFour : aiLevelHolyGrail;

  const handleCreate = (vsAi: boolean, isPublic: boolean) => {
    onCreateGame(vsAi, isPublic, currentAiLevel, currentAiStarts);
  };

  return (
    <div className="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-5 justify-between">
      <div>
        <h3 className="text-lg font-bold text-white">{t('create_new_match', { defaultValue: 'Create a New Match' })}</h3>
        <p className="text-sm text-neutral-400 mt-1">
          {t('launch_match_desc', {
            defaultValue: 'Launch a match of {{game}} immediately.',
            game: activeGameTab === 'mill' ? t('nine_mens_morris', { defaultValue: "Nine Men's Morris" }) : activeGameTab === 'connect_four' ? t('connect_four', { defaultValue: 'Connect Four' }) : t('grail_quest', { defaultValue: 'Grail Quest' })
          })}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {/* Game mode toggle */}
        <div className="flex bg-neutral-950/60 border border-neutral-800/80 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              if (activeGameTab === 'mill') setGameModeMill('ai');
              else if (activeGameTab === 'connect_four') setGameModeConnectFour('ai');
              else setGameModeHolyGrail('ai');
            }}
            className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all ${
              currentGameMode === 'ai'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🤖 {t('vs_ai', { defaultValue: 'vs AI' })}
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeGameTab === 'mill') setGameModeMill('human');
              else if (activeGameTab === 'connect_four') setGameModeConnectFour('human');
              else setGameModeHolyGrail('human');
            }}
            className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all ${
              currentGameMode === 'human'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            👥 {t('vs_human', { defaultValue: 'vs Human' })}
          </button>
        </div>

        <div className="flex flex-col gap-2 bg-neutral-950/40 border border-neutral-800/80 rounded-2xl p-4 w-full">
          {/* AI strength — only shown in AI mode */}
          {currentGameMode === 'ai' && (
            <>
              <label htmlFor="ai-bot-select" className="text-xs text-neutral-400 font-semibold">
                {t('select_ai_opponent', { defaultValue: 'Select AI Opponent:' })}
              </label>
              <select
                id="ai-bot-select"
                value={currentAiLevel}
                onChange={(e) => {
                  const val = e.target.value as BotLevel;
                  if (activeGameTab === 'mill') {
                    setAiLevelMill(val);
                  } else if (activeGameTab === 'connect_four') {
                    setAiLevelConnectFour(val);
                  } else {
                    setAiLevelHolyGrail(val);
                  }
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500 transition-all font-sans"
              >
                {Object.entries(typedConfig[activeGameTab] || typedConfig.mill)
                  .sort((a, b) => a[1].elo - b[1].elo)
                  .map(([key, bot]) => (
                    <option key={key} value={key}>
                      {BOT_EMOJIS[activeGameTab]?.[key] || "🤖"} {bot.username} — Leaderscore {bot.elo} [{t(`bot_tag.${activeGameTab}.${key}`, { defaultValue: BOT_DESCRIPTIONS[activeGameTab]?.[key] || 'AI Bot' })}]
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-neutral-500 mt-1">
                {t(`bot_help.${activeGameTab}.${currentAiLevel}`, { defaultValue: BOT_HELP_TEXT[activeGameTab]?.[currentAiLevel] || 'AI Bot will calculate moves based on difficulty.' })}
              </p>
              <div className="border-t border-neutral-800/80 my-2"></div>
            </>
          )}

          <label className="text-xs text-neutral-400 font-semibold">
            {t('who_starts', { defaultValue: 'Who Starts the Game?' })}
          </label>
          <div className="flex gap-2 mt-0.5">
            <button
              type="button"
              onClick={() => {
                if (activeGameTab === 'mill') setAiStartsMill(false);
                else if (activeGameTab === 'connect_four') setAiStartsConnectFour(false);
                else setAiStartsHolyGrail(false);
              }}
              className={`flex-1 py-2 text-xs rounded-xl font-semibold border transition-all ${
                !currentAiStarts
                  ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              👤 {t('you_start_first', { defaultValue: 'You Start (First)' })}
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeGameTab === 'mill') setAiStartsMill(true);
                else if (activeGameTab === 'connect_four') setAiStartsConnectFour(true);
                else setAiStartsHolyGrail(true);
              }}
              className={`flex-1 py-2 text-xs rounded-xl font-semibold border transition-all ${
                currentAiStarts
                  ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              {currentGameMode === 'ai' ? `🤖 ${t('ai_starts_first', { defaultValue: 'AI Starts (First)' })}` : `🧑 ${t('opponent_starts_first', { defaultValue: 'Opponent Starts (First)' })}`}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        {currentGameMode === 'ai' ? (
          <button
            onClick={() => handleCreate(true, false)}
            disabled={creatingGame || syncStatus === 'mismatch'}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              🤖
            </div>
            <span className="font-bold text-xs text-white">{t('play_vs_ai', { defaultValue: 'Play vs AI' })}</span>
            <span className="text-[10px] text-neutral-500 text-center">{t('practice_offline', { defaultValue: 'Practice offline' })}</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCreate(false, true)}
              disabled={creatingGame || syncStatus === 'mismatch'}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                🌍
              </div>
              <span className="font-bold text-xs text-white">{t('host_public', { defaultValue: 'Host Public' })}</span>
              <span className="text-[10px] text-neutral-500 text-center">{t('list_in_public_lobby', { defaultValue: 'List in public lobby' })}</span>
            </button>
            <button
              onClick={() => handleCreate(false, false)}
              disabled={creatingGame || syncStatus === 'mismatch'}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700/50 hover:border-neutral-600 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                🔗
              </div>
              <span className="font-bold text-xs text-white">{t('host_private', { defaultValue: 'Host Private' })}</span>
              <span className="text-[10px] text-neutral-500 text-center">{t('share_direct_link', { defaultValue: 'Share direct link' })}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
