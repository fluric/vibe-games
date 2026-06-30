import { useState, useCallback } from 'react';
import type { ValvesRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

interface Props {
  config: ValvesRoomConfig;
  onSolved: () => void;
}

export function ValvesPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  // Initialize valves to 0
  const [valves, setValves] = useState<number[]>(new Array(config.valves.length).fill(0));
  const [solved, setSolved] = useState(false);

  const turnValve = useCallback((index: number, delta: number) => {
    if (solved) return;
    setValves((prev) => {
      const next = [...prev];
      const newVal = next[index] + delta;
      if (newVal >= 0 && newVal <= config.maxValue) {
        next[index] = newVal;
      }

      // Check if solved
      let isSolved = true;
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== config.solution[i]) {
          isSolved = false;
          break;
        }
      }

      if (isSolved) {
        setSolved(true);
        setTimeout(onSolved, 800);
      }

      return next;
    });
  }, [config.maxValue, config.solution, onSolved, solved]);

  return (
    <div className="escape-puzzle escape-valves flex flex-col md:flex-row gap-8 items-center justify-center p-4">
      <div className="keypad-clues flex flex-col gap-3 max-w-sm">
        {config.clues.map((clue, idx) => (
          <div key={idx} className="keypad-clue-note bg-blue-900/40 text-blue-100 border border-blue-500/30 p-3 rounded-lg shadow-md text-sm font-medium">
            <span className="keypad-clue-text">{clue}</span>
          </div>
        ))}
      </div>

      <div className={`flex flex-col items-center gap-8 bg-neutral-900 border-4 border-neutral-800 p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden ${solved ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : ''}`}>
        
        {/* Decorative pipes in the background */}
        <div className="absolute top-0 left-10 w-4 h-full bg-neutral-800/50 pointer-events-none" />
        <div className="absolute top-0 right-10 w-4 h-full bg-neutral-800/50 pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-full h-4 bg-neutral-800/50 pointer-events-none transform -translate-y-1/2" />

        <div className="grid grid-cols-2 gap-x-12 gap-y-10 z-10">
          {config.valves.map((valve, i) => (
            <div key={valve.id} className="flex flex-col items-center gap-3">
              <span className="text-neutral-400 font-bold tracking-widest text-sm uppercase bg-black/50 px-3 py-1 rounded-full border border-neutral-700">{valve.label}</span>
              
              {/* Valve visualization */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Dial background */}
                <div className="absolute inset-0 rounded-full border-4 border-neutral-700 bg-neutral-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]" />
                
                {/* Rotating handle based on value */}
                <div 
                  className="absolute w-20 h-20 rounded-full border-4 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-transform duration-300 ease-in-out flex items-center justify-center"
                  style={{ transform: `rotate(${(valves[i] / config.maxValue) * 270}deg)` }}
                >
                  <div className="w-full h-2 bg-rose-500" />
                  <div className="absolute w-2 h-full bg-rose-500" />
                  <div className="w-8 h-8 rounded-full bg-rose-600 absolute shadow-inner z-10" />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 bg-black/40 p-2 rounded-xl border border-neutral-800">
                <button 
                  data-testid={`valve-${valve.id}-dec`}
                  className="w-8 h-8 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center text-xl font-bold border-b-2 border-neutral-900 active:border-b-0 active:translate-y-px"
                  onClick={() => turnValve(i, -1)}
                  disabled={solved || valves[i] <= 0}
                >
                  -
                </button>
                <span className="text-xl font-mono text-cyan-400 font-bold min-w-[1.5rem] text-center" data-testid={`valve-${valve.id}-val`}>
                  {valves[i]}
                </span>
                <button 
                  data-testid={`valve-${valve.id}-inc`}
                  className="w-8 h-8 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center text-xl font-bold border-b-2 border-neutral-900 active:border-b-0 active:translate-y-px"
                  onClick={() => turnValve(i, 1)}
                  disabled={solved || valves[i] >= config.maxValue}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {solved && <p className="keypad-success text-emerald-400 font-bold text-xl mt-4 z-10 bg-black/60 px-6 py-2 rounded-full backdrop-blur-sm border border-emerald-500/30">{t('ui_pressure_stable', { defaultValue: '✓ PRESSURE STABLE' })}</p>}
      </div>
    </div>
  );
}
