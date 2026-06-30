import { useState } from 'react';
import * as audio from './AudioEffects';
import { useTranslation, Trans } from 'react-i18next';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'objective' | 'cards' | 'phases' | 'combat' | 'endround';

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('objective');

  const { t } = useTranslation('game');

  if (!isOpen) return null;

  const handleClose = () => {
    audio.playPlaceSound();
    onClose();
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'objective', label: t('overview', { defaultValue: 'Overview' }), icon: '🎯' },
    { id: 'cards', label: t('cards_deck', { defaultValue: 'Cards & Deck' }), icon: '🃏' },
    { id: 'phases', label: t('turn_phases', { defaultValue: 'Turn Phases' }), icon: '🔄' },
    { id: 'combat', label: t('combat_rules', { defaultValue: 'Combat Rules' }), icon: '⚔️' },
    { id: 'endround', label: t('end_of_round', { defaultValue: 'End of Round' }), icon: '☣️' },
  ];

  return (
    <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[999] flex items-center justify-center p-4">
      <div 
        id="rules-modal"
        className="bg-neutral-900/95 border border-neutral-800 rounded-3xl max-w-3xl w-full h-[85vh] md:h-[70vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {t('grail_quest_title', { defaultValue: 'Grail Quest (Holy Grail)' })}
              </h3>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">
                {t('complete_rules_guide', { defaultValue: 'Complete Rules & Strategy Guide' })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-sm border border-neutral-700/50 hover:border-neutral-600 transition-all active:scale-90"
            aria-label="Close rules"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Left Tab-Bar / Content Split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-950/20 p-2 md:p-3 gap-1 md:w-48 shrink-0 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    audio.playPlaceSound();
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all whitespace-nowrap md:w-full active:scale-[0.98] ${
                    isActive
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm'
                      : 'border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {activeTab === 'objective' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    🎯 {t('game_objective', { defaultValue: 'Game Objective' })}
                  </h4>
                  <p>
                    {t('game_objective_desc', { defaultValue: 'Grail Quest is a tactical hexagonal combat game. You win by accomplishing either of the following:' })}
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5 text-neutral-400 text-xs">
                    <li>
                      <Trans i18nKey="secure_the_grail" ns="game" defaultValue="<0>Secure the Grail:</0> Move the <1>Holy Grail 🏆</1> (starts at center hex <2>0,0</2>) back to your <3>Home Base</3>.">
                        <strong className="text-indigo-400">Secure the Grail:</strong> Move the <span className="text-amber-400 font-bold">Holy Grail 🏆</span> (starts at center hex <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-400">0,0</code>) back to your <strong className="text-white">Home Base</strong>.
                      </Trans>
                    </li>
                    <li>
                      <Trans i18nKey="base_capture" ns="game" defaultValue="<0>Base Capture:</0> Invade and occupy the opponent's <1>Home Base</1> with your units.">
                        <strong className="text-rose-400">Base Capture:</strong> Invade and occupy the opponent's <strong className="text-white">Home Base</strong> with your units.
                      </Trans>
                    </li>
                  </ul>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2.5">
                    🗺️ {t('hex_grid_map', { defaultValue: 'Hex Grid & Coordinate Map' })}
                  </h4>
                  <p className="mb-3">
                    {t('hex_grid_desc', { defaultValue: 'The game is played on a radius-3 axial hex board. Different hex types provide tactical advantages:' })}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
                        🛖 {t('home_base', { defaultValue: 'Home Base (0,-3 & 0,3)' })}
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        {t('home_base_desc', { defaultValue: 'Your starting point. If the opponent captures it, you lose. You can deploy new units directly here.' })}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                        🏢 {t('urban_housing', { defaultValue: 'Urban Housing' })}
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        {t('urban_housing_desc', { defaultValue: 'Owned city hexes close to base. These act as supplementary spawn locations to deploy cards from hand.' })}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1">
                        🌾 {t('farm_land', { defaultValue: 'Farm Land (-2,0 & 2,0)' })}
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        <Trans i18nKey="farm_land_desc" ns="game" defaultValue="Neutral resource hexes. Controlling a Farm Land grants you <0>+1 card draw</0> at the start of your turn.">
                          Neutral resource hexes. Controlling a Farm Land grants you <strong className="text-white">+1 card draw</strong> at the start of your turn.
                        </Trans>
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-1">
                        ⛰️ {t('hill_hexes', { defaultValue: 'Hill Hexes' })}
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        {t('hill_hexes_desc', { defaultValue: 'Tactical high ground. If you have 2+ units defending a Hill, you gain a massive combat advantage (see Combat rules tab).' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cards' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    🃏 {t('cards_as_units', { defaultValue: 'Cards as Units' })}
                  </h4>
                  <p>
                    <Trans i18nKey="cards_as_units_desc" ns="game" defaultValue="Your soldiers are represented by playing cards in your hand with values from <0>1 to 13</0>:">
                      Your soldiers are represented by playing cards in your hand with values from <strong className="text-white">1 to 13</strong>:
                    </Trans>
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5 text-neutral-400 text-xs">
                    <li><strong className="text-white">{t('1_to_10', { defaultValue: '1 to 10:' })}</strong> {t('regular_number_soldiers', { defaultValue: 'Regular number soldiers.' })}</li>
                    <li><strong className="text-indigo-400">11:</strong> {t('jack_j', { defaultValue: 'Jack (J)' })}</li>
                    <li><strong className="text-indigo-400">12:</strong> {t('queen_q', { defaultValue: 'Queen (Q)' })}</li>
                    <li>
                      <Trans i18nKey="king_desc" ns="game" defaultValue="<0>13:</0> King (K) — The <1>only unit</1> capable of carrying the Grail.">
                        <strong className="text-indigo-400">13:</strong> King (K) — The <strong className="text-white">only unit</strong> capable of carrying the Grail.
                      </Trans>
                    </li>
                  </ul>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    ⚖️ {t('recruitment_limits', { defaultValue: 'Recruitment Limits' })}
                  </h4>
                  <p>
                    <Trans i18nKey="recruitment_limits_desc" ns="game" defaultValue="To prevent overwhelming face card armies, there is a strict limit on the number of face cards you can have <0>in play</0> (hand and board combined):">
                      To prevent overwhelming face card armies, there is a strict limit on the number of face cards you can have <strong className="text-white">in play</strong> (hand and board combined):
                    </Trans>
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
                    <table className="w-full text-left text-xs bg-neutral-950/30">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950/60 font-bold text-neutral-400">
                          <th className="p-2.5">{t('card_unit', { defaultValue: 'Card Unit' })}</th>
                          <th className="p-2.5">{t('max_in_play', { defaultValue: 'Max In Play Limit' })}</th>
                          <th className="p-2.5">{t('action_on_excess', { defaultValue: 'Action on Excess Draw' })}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-neutral-400">
                        <tr>
                          <td className="p-2.5 font-semibold text-white">👑 {t('king', { defaultValue: 'King' })} (K)</td>
                          <td className="p-2.5">{t('max_n', { defaultValue: 'Maximum' })} 1</td>
                          <td className="p-2.5">{t('redrawn_to_random', { defaultValue: 'Redrawn to a random number card (1-10)' })}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-white">👑 {t('queen', { defaultValue: 'Queen' })} (Q)</td>
                          <td className="p-2.5">{t('max_n', { defaultValue: 'Maximum' })} 2</td>
                          <td className="p-2.5">{t('redrawn_to_random', { defaultValue: 'Redrawn to a random number card (1-10)' })}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-white">👑 {t('jack', { defaultValue: 'Jack' })} (J)</td>
                          <td className="p-2.5">{t('max_n', { defaultValue: 'Maximum' })} 3</td>
                          <td className="p-2.5">{t('redrawn_to_random', { defaultValue: 'Redrawn to a random number card (1-10)' })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-neutral-800" />

                <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <div className="text-xs text-amber-300/90 leading-relaxed">
                    <Trans i18nKey="tip_protect_king" ns="game" defaultValue="<0>Tip:</0> Protect your King! If your King is destroyed and you already have cards in transit or wait lists, you must wait until you draw a new one to move the Grail. Keep face card capacities in mind when planning your deck expansion.">
                      <strong className="text-white">Tip:</strong> Protect your King! If your King is destroyed and you already have cards in transit or wait lists, you must wait until you draw a new one to move the Grail. Keep face card capacities in mind when planning your deck expansion.
                    </Trans>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'phases' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    🔄 {t('turn_lifecycle', { defaultValue: 'Turn Lifecycle' })}
                  </h4>
                  <p>
                    {t('turn_lifecycle_desc', { defaultValue: 'Each player\'s turn is divided into three distinct phases:' })}
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-3.5 text-neutral-400 text-xs">
                    <li>
                      <strong className="text-white text-sm">{t('phase_react', { defaultValue: '1. Reaction Phase (react)' })}</strong>
                      <p className="mt-1 leading-relaxed">
                        {t('phase_react_desc', { defaultValue: 'This phase only triggers if the opponent moved units into your occupied cells on their last turn. For each contested cell, you must choose to:' })}
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-neutral-500">
                        <li>
                          <Trans i18nKey="react_fight" ns="game" defaultValue="<0>Fight:</0> Resolve combat immediately using card duels.">
                            <strong className="text-neutral-400">Fight:</strong> Resolve combat immediately using card duels.
                          </Trans>
                        </li>
                        <li>
                          <Trans i18nKey="react_retreat" ns="game" defaultValue="<0>Retreat:</0> Flee! Move all units in that cell to an adjacent cell you own, yielding the contested cell to the attacker.">
                            <strong className="text-neutral-400">Retreat:</strong> Flee! Move all units in that cell to an adjacent cell you own, yielding the contested cell to the attacker.
                          </Trans>
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-white text-sm">{t('phase_deploy', { defaultValue: '2. Deployment Phase (deploy)' })}</strong>
                      <p className="mt-1 leading-relaxed">
                        <Trans i18nKey="phase_deploy_desc" ns="game" defaultValue="At the start of this phase, you draw new cards (Base draw of <0>4 cards</0>, plus <1>+1 card per owned Farm Land</1>. Player X's very first turn only draws 2). You can drag/click cards from your hand to deploy them onto your <2>Home Base</2> or owned <3>Urban housing</3>. Click <4>'End Deploy'</4> when finished.">
                          At the start of this phase, you draw new cards (Base draw of <strong className="text-white">4 cards</strong>, plus <strong className="text-white">+1 card per owned Farm Land</strong>. Player X's very first turn only draws 2). You can drag/click cards from your hand to deploy them onto your <strong className="text-white">Home Base</strong> or owned <strong className="text-white">Urban housing</strong>. Click <strong className="text-indigo-400">"End Deploy"</strong> when finished.
                        </Trans>
                      </p>
                    </li>
                    <li>
                      <strong className="text-white text-sm">{t('phase_move', { defaultValue: '3. Movement Phase (move)' })}</strong>
                      <p className="mt-1 leading-relaxed">
                        {t('phase_move_desc', { defaultValue: 'You can perform any number of moves. A single move shifts a stack of units from one owned cell to an adjacent cell. Each unit can only move once per turn.' })}
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-neutral-500">
                        <li>{t('move_empty', { defaultValue: 'Moving units into an empty cell claims it immediately.' })}</li>
                        <li>{t('move_opponent', { defaultValue: 'Moving units into an opponent\'s cell schedules a battle for their next turn.' })}</li>
                        <li>
                          <Trans i18nKey="move_grail" ns="game" defaultValue="<0>Grail Guard & Movement:</0> Any soldiers present in the Grail's hex are bound to it and cannot leave it unless they move with the King (13) carrying the Grail. When moving from the Grail hex, you must move **all** soldiers together.">
                            <strong className="text-neutral-400">Grail Guard & Movement:</strong> Any soldiers present in the Grail's hex are bound to it and cannot leave it unless they move with the King (13) carrying the Grail. When moving from the Grail hex, you must move **all** soldiers together.
                          </Trans>
                        </li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {activeTab === 'combat' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    ⚔️ {t('combat_resolution', { defaultValue: 'Combat Resolution' })}
                  </h4>
                  <p>
                    {t('combat_resolution_desc', { defaultValue: 'When a Fight is chosen, combat resolves as a series of 1-vs-1 duels between the top card of the attacking stack and the top card of the defending stack.' })}
                  </p>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h5 className="text-white font-bold text-sm mb-2">👑 {t('face_card_duels', { defaultValue: 'Face Card Duels (Jack, Queen, King)' })}</h5>
                  <p className="text-xs text-neutral-400 mb-2">
                    {t('face_card_duels_desc', { defaultValue: 'When two face cards duel, they follow a rock-paper-scissors dynamic:' })}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold justify-center my-3">
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-indigo-400">
                      {t('king_beats_jack', { defaultValue: '👑 King (13) beats Jack (11)' })}
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-indigo-400">
                      {t('jack_beats_queen', { defaultValue: '👑 Jack (11) beats Queen (12)' })}
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-indigo-400">
                      {t('queen_beats_king', { defaultValue: '👑 Queen (12) beats King (13)' })}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    <Trans i18nKey="face_card_beats_number" ns="game" defaultValue="If they are the same face card, both are destroyed. Face cards **always beat** regular number cards (1-10).">
                      If they are the same face card, both are destroyed. Face cards **always beat** regular number cards (1-10).
                    </Trans>
                  </p>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h5 className="text-white font-bold text-sm mb-2">🔢 {t('number_card_duels', { defaultValue: 'Number Card Duels (1-10)' })}</h5>
                  <p className="text-xs text-neutral-400">
                    <Trans i18nKey="number_card_duels_desc" ns="game" defaultValue="The card with the higher value wins. The winner's card survives but gets **degraded** (reduced in value) by the value of the losing card:">
                      The card with the higher value wins. The winner's card survives but gets **degraded** (reduced in value) by the value of the losing card:
                    </Trans>
                  </p>
                  <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-xs font-mono text-center my-2 text-indigo-300">
                    <Trans i18nKey="degrade_example" ns="game" defaultValue="Example: Attacking [10] vs Defending [4] <br /> ↳ Attacking [10] wins, but is degraded to a [6] (10 - 4) and sent to the bottom of its stack.">
                      Example: Attacking [10] vs Defending [4] <br />
                      ↳ Attacking [10] wins, but is degraded to a [6] (10 - 4) and sent to the bottom of its stack.
                    </Trans>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {t('same_value_destroyed', { defaultValue: 'If both number cards have the same value, both are destroyed.' })}
                  </p>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h5 className="text-white font-bold text-sm mb-2 flex items-center gap-1">
                    ⛰️ {t('hill_defense_advantage', { defaultValue: 'Hill Defense Advantage' })}
                  </h5>
                  <p className="text-xs text-neutral-400">
                    <Trans i18nKey="hill_defense_desc1" ns="game" defaultValue="If combat occurs on a **Hill hex**, a defender with at least 2 cards gets to 'draw two':">
                      If combat occurs on a **Hill hex**, a defender with at least 2 cards gets to "draw two":
                    </Trans>
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    <Trans i18nKey="hill_defense_desc2" ns="game" defaultValue="The defender evaluates how the attacking top card performs against the defender's **top two cards**, and selects the matchup that is most favorable (Win > Draw > Loss). If the chosen card wins, the unused card survives and goes to the bottom of the stack as well, while the winning card degrades and goes to the bottom. If the chosen card draws (or both cards are weaker than the attacker's card), both defending cards are destroyed.">
                      The defender evaluates how the attacking top card performs against the defender's **top two cards**, and selects the matchup that is most favorable (Win &gt; Draw &gt; Loss). 
                      If the chosen card wins, the unused card survives and goes to the bottom of the stack as well, while the winning card degrades and goes to the bottom.
                      If the chosen card draws (or both cards are weaker than the attacker's card), both defending cards are destroyed.
                    </Trans>
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'endround' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    ⌛ {t('end_of_round_events', { defaultValue: 'End of Round Events' })}
                  </h4>
                  <p>
                    {t('end_of_round_desc', { defaultValue: 'After both players complete their turns, the round ends and three resolution phases take place:' })}
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-3.5 text-neutral-400 text-xs">
                    <li>
                      <strong className="text-white text-sm">{t('grail_movement', { defaultValue: '1. Grail Movement' })}</strong>
                      <p className="mt-1 leading-relaxed">
                        {t('grail_movement_desc', { defaultValue: 'If your King moves from the cell containing the Grail, he carries it along. At the end of the round, the Grail\'s position is updated to the King\'s destination cell.' })}
                      </p>
                    </li>
                    <li>
                      <strong className="text-white text-sm">{t('grail_radiation', { defaultValue: '2. Grail Radiation (Radioactivity)' })}</strong>
                      <p className="mt-1 leading-relaxed text-rose-400/90 font-medium">
                        {t('grail_radiation_desc', { defaultValue: 'The Holy Grail emits raw holy energy! At the end of the round, each soldier occupying the Grail\'s hex has a 50% chance of being permanently destroyed. If there are no units left on the cell, the cell becomes neutral.' })}
                      </p>
                    </li>
                    <li>
                      <strong className="text-white text-sm">{t('victory_draw_eval', { defaultValue: '3. Victory & Draw Evaluation' })}</strong>
                      <p className="mt-1 leading-relaxed">
                        {t('victory_draw_desc', { defaultValue: 'The board is checked for game-ending conditions:' })}
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-neutral-500">
                        <li>{t('victory_grail', { defaultValue: 'If the Grail reaches a player\'s Home Base, that player wins immediately.' })}</li>
                        <li>{t('defeat_base', { defaultValue: 'If a player\'s Home Base is occupied by enemy units, that player loses.' })}</li>
                        <li>{t('draw_condition', { defaultValue: 'If 400 turns elapse without a winner, the game is declared a Draw.' })}</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/40 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-700/20 active:scale-95"
          >
            {t('got_it_play', { defaultValue: 'Got It, Let\'s Play!' })}
          </button>
        </div>
      </div>
    </div>
  );
}
