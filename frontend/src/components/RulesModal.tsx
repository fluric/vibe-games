import { useState } from 'react';
import * as audio from './AudioEffects';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'objective' | 'cards' | 'phases' | 'combat' | 'endround';

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('objective');

  if (!isOpen) return null;

  const handleClose = () => {
    audio.playPlaceSound();
    onClose();
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'objective', label: 'Overview', icon: '🎯' },
    { id: 'cards', label: 'Cards & Deck', icon: '🃏' },
    { id: 'phases', label: 'Turn Phases', icon: '🔄' },
    { id: 'combat', label: 'Combat Rules', icon: '⚔️' },
    { id: 'endround', label: 'End of Round', icon: '☣️' },
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
                Grail Quest (Holy Grail)
              </h3>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">
                Complete Rules & Strategy Guide
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
                    🎯 Game Objective
                  </h4>
                  <p>
                    Grail Quest is a tactical hexagonal combat game. You win by accomplishing either of the following:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5 text-neutral-400 text-xs">
                    <li>
                      <strong className="text-indigo-400">Secure the Grail:</strong> Move the <span className="text-amber-400 font-bold">Holy Grail 🏆</span> (starts at center hex <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-400">0,0</code>) back to your <strong className="text-white">Home Base</strong>.
                    </li>
                    <li>
                      <strong className="text-rose-400">Base Capture:</strong> Invade and occupy the opponent's <strong className="text-white">Home Base</strong> with your units.
                    </li>
                  </ul>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2.5">
                    🗺️ Hex Grid & Coordinate Map
                  </h4>
                  <p className="mb-3">
                    The game is played on a radius-3 axial hex board. Different hex types provide tactical advantages:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
                        🛖 Home Base (0,-3 & 0,3)
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        Your starting point. If the opponent captures it, you lose. You can deploy new units directly here.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                        🏢 Urban Housing
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        Owned city hexes close to base. These act as supplementary spawn locations to deploy cards from hand.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1">
                        🌾 Farm Land (-2,0 & 2,0)
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        Neutral resource hexes. Controlling a Farm Land grants you <strong className="text-white">+1 card draw</strong> at the start of your turn.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                      <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-1">
                        ⛰️ Hill Hexes
                      </div>
                      <p className="text-neutral-400 leading-normal">
                        Tactical high ground. If you have 2+ units defending a Hill, you gain a massive combat advantage (see Combat rules tab).
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
                    🃏 Cards as Units
                  </h4>
                  <p>
                    Your soldiers are represented by playing cards in your hand with values from <strong className="text-white">1 to 13</strong>:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5 text-neutral-400 text-xs">
                    <li><strong className="text-white">1 to 10:</strong> Regular number soldiers.</li>
                    <li><strong className="text-indigo-400">11:</strong> Jack (J)</li>
                    <li><strong className="text-indigo-400">12:</strong> Queen (Q)</li>
                    <li><strong className="text-indigo-400">13:</strong> King (K) — The <strong className="text-white">only unit</strong> capable of carrying the Grail.</li>
                  </ul>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    ⚖️ Recruitment Limits
                  </h4>
                  <p>
                    To prevent overwhelming face card armies, there is a strict limit on the number of face cards you can have <strong className="text-white">in play</strong> (hand and board combined):
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
                    <table className="w-full text-left text-xs bg-neutral-950/30">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950/60 font-bold text-neutral-400">
                          <th className="p-2.5">Card Unit</th>
                          <th className="p-2.5">Max In Play Limit</th>
                          <th className="p-2.5">Action on Excess Draw</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-neutral-400">
                        <tr>
                          <td className="p-2.5 font-semibold text-white">👑 King (K)</td>
                          <td className="p-2.5">Maximum 1</td>
                          <td className="p-2.5">Redrawn to a random number card (1-10)</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-white">👑 Queen (Q)</td>
                          <td className="p-2.5">Maximum 2</td>
                          <td className="p-2.5">Redrawn to a random number card (1-10)</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-white">👑 Jack (J)</td>
                          <td className="p-2.5">Maximum 3</td>
                          <td className="p-2.5">Redrawn to a random number card (1-10)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr className="border-neutral-800" />

                <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <div className="text-xs text-amber-300/90 leading-relaxed">
                    <strong className="text-white">Tip:</strong> Protect your King! If your King is destroyed and you already have cards in transit or wait lists, you must wait until you draw a new one to move the Grail. Keep face card capacities in mind when planning your deck expansion.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'phases' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    🔄 Turn Lifecycle
                  </h4>
                  <p>
                    Each player's turn is divided into three distinct phases:
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-3.5 text-neutral-400 text-xs">
                    <li>
                      <strong className="text-white text-sm">1. Reaction Phase (react)</strong>
                      <p className="mt-1 leading-relaxed">
                        This phase only triggers if the opponent moved units into your occupied cells on their last turn. For each contested cell, you must choose to:
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-neutral-500">
                        <li><strong className="text-neutral-400">Fight:</strong> Resolve combat immediately using card duels.</li>
                        <li><strong className="text-neutral-400">Retreat:</strong> Flee! Move all units in that cell to an adjacent cell you own, yielding the contested cell to the attacker.</li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-white text-sm">2. Deployment Phase (deploy)</strong>
                      <p className="mt-1 leading-relaxed">
                        At the start of this phase, you draw new cards (Base draw of <strong className="text-white">4 cards</strong>, plus <strong className="text-white">+1 card per owned Farm Land</strong>. Player X's very first turn only draws 2). You can drag/click cards from your hand to deploy them onto your <strong className="text-white">Home Base</strong> or owned <strong className="text-white">Urban housing</strong>. Click <strong className="text-indigo-400">"End Deploy"</strong> when finished.
                      </p>
                    </li>
                    <li>
                      <strong className="text-white text-sm">3. Movement Phase (move)</strong>
                      <p className="mt-1 leading-relaxed">
                        You can perform any number of moves. A single move shifts a stack of units from one owned cell to an adjacent cell. Each unit can only move once per turn.
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-neutral-500">
                        <li>Moving units into an empty cell claims it immediately.</li>
                        <li>Moving units into an opponent's cell schedules a battle for their next turn.</li>
                        <li><strong className="text-neutral-400">Grail Guard & Movement:</strong> Any soldiers present in the Grail's hex are bound to it and cannot leave it unless they move with the King (13) carrying the Grail. When moving from the Grail hex, you must move **all** soldiers together. If the King is destroyed, the Grail and all soldiers in the hex are locked in place until a new King arrives.</li>
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
                    ⚔️ Combat Resolution
                  </h4>
                  <p>
                    When a Fight is chosen, combat resolves as a series of 1-vs-1 duels between the top card of the attacking stack and the top card of the defending stack.
                  </p>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h5 className="text-white font-bold text-sm mb-2">👑 Face Card Duels (Jack, Queen, King)</h5>
                  <p className="text-xs text-neutral-400 mb-2">
                    When two face cards duel, they follow a rock-paper-scissors dynamic:
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold justify-center my-3">
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-indigo-400">
                      👑 King (13) beats Jack (11)
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-indigo-400">
                      👑 Jack (11) beats Queen (12)
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-indigo-400">
                      👑 Queen (12) beats King (13)
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    If they are the same face card, both are destroyed. Face cards **always beat** regular number cards (1-10).
                  </p>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h5 className="text-white font-bold text-sm mb-2">🔢 Number Card Duels (1-10)</h5>
                  <p className="text-xs text-neutral-400">
                    The card with the higher value wins. The winner's card survives but gets **degraded** (reduced in value) by the value of the losing card:
                  </p>
                  <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-xs font-mono text-center my-2 text-indigo-300">
                    Example: Attacking [10] vs Defending [4] <br />
                    ↳ Attacking [10] wins, but is degraded to a [6] (10 - 4) and sent to the bottom of its stack.
                  </div>
                  <p className="text-xs text-neutral-400">
                    If both number cards have the same value, both are destroyed.
                  </p>
                </div>

                <hr className="border-neutral-800" />

                <div>
                  <h5 className="text-white font-bold text-sm mb-2 flex items-center gap-1">
                    ⛰️ Hill Defense Advantage
                  </h5>
                  <p className="text-xs text-neutral-400">
                    If combat occurs on a **Hill hex**, a defender with at least 2 cards gets to "draw two":
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    The defender evaluates how the attacking top card performs against the defender's **top two cards** combined, and selects the matchup that is most favorable (Win &gt; Draw &gt; Loss). The selected card fights, and both defending cards are placed at the bottom of the stack afterward.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'endround' && (
              <div className="flex flex-col gap-5 text-sm text-neutral-300 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2 mb-2">
                    ⌛ End of Round Events
                  </h4>
                  <p>
                    After both players complete their turns, the round ends and three resolution phases take place:
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-3.5 text-neutral-400 text-xs">
                    <li>
                      <strong className="text-white text-sm">1. Grail Movement</strong>
                      <p className="mt-1 leading-relaxed">
                        If your King moves from the cell containing the Grail, he carries it along. At the end of the round, the Grail's position is updated to the King's destination cell.
                      </p>
                    </li>
                    <li>
                      <strong className="text-white text-sm">2. Grail Radiation (Radioactivity)</strong>
                      <p className="mt-1 leading-relaxed text-rose-400/90 font-medium">
                        The Holy Grail emits raw holy energy! At the end of the round, one random card occupying the Grail's hex is permanently destroyed. If it was the last unit on the cell, the cell becomes neutral.
                      </p>
                    </li>
                    <li>
                      <strong className="text-white text-sm">3. Victory & Draw Evaluation</strong>
                      <p className="mt-1 leading-relaxed">
                        The board is checked for game-ending conditions:
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-neutral-500">
                        <li>If the Grail reaches a player's Home Base, that player wins immediately.</li>
                        <li>If a player's Home Base is occupied by enemy units, that player loses.</li>
                        <li>If 400 turns elapse without a winner, the game is declared a Draw.</li>
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
            Got It, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}
