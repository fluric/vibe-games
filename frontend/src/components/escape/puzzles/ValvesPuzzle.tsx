import { useState, useCallback } from 'react';
import type { ValvesRoomConfig } from '../../../data/escapeRooms';
import { useTranslation } from 'react-i18next';

interface Props {
  config: ValvesRoomConfig;
  onSolved: () => void;
}

export function ValvesPuzzle({ config, onSolved }: Props) {
  const { t } = useTranslation('escape');
  const [valves, setValves] = useState<number[]>(new Array(config.valves.length).fill(0));
  const [attempts, setAttempts] = useState<{ guess: number[], exact: number, partial: number }[]>([]);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);

  const testPressure = useCallback(() => {
    if (solved || failed) return;

    let exact = 0;
    let partial = 0;
    const solCopy = [...config.solution];
    const guessCopy = [...valves];

    // First pass: exact matches
    for (let i = 0; i < guessCopy.length; i++) {
      if (guessCopy[i] === solCopy[i]) {
        exact++;
        solCopy[i] = -1;
        guessCopy[i] = -2;
      }
    }

    // Second pass: partial matches
    for (let i = 0; i < guessCopy.length; i++) {
      if (guessCopy[i] !== -2) {
        const matchIndex = solCopy.indexOf(guessCopy[i]);
        if (matchIndex !== -1) {
          partial++;
          solCopy[matchIndex] = -1;
        }
      }
    }

    const newAttempts = [...attempts, { guess: [...valves], exact, partial }];
    setAttempts(newAttempts);

    if (exact === config.solution.length) {
      setSolved(true);
      setTimeout(onSolved, 800);
    } else if (newAttempts.length >= 10) {
      setFailed(true);
    }
  }, [config.solution, onSolved, solved, failed, valves, attempts]);

  const reset = useCallback(() => {
    if (solved) return;
    setValves(new Array(config.valves.length).fill(0));
    setAttempts([]);
    setFailed(false);
  }, [config.valves.length, solved]);

  const turnValve = useCallback((index: number, delta: number) => {
    if (solved || failed) return;
    setValves((prev) => {
      const next = [...prev];
      const newVal = next[index] + delta;
      if (newVal >= 0 && newVal <= config.maxValue) {
        next[index] = newVal;
      }
      return next;
    });
  }, [config.maxValue, solved, failed]);

  return (
    <div className="escape-puzzle escape-valves flex flex-col xl:flex-row gap-8 items-start justify-center p-4 w-full">
      <div className="flex flex-col gap-6 w-full max-w-sm">
        <div className="keypad-clues flex flex-col gap-3">
          {config.clues.map((clue, idx) => (
            <div key={idx} className="keypad-clue-note bg-blue-900/40 text-blue-100 border border-blue-500/30 p-3 rounded-lg shadow-md text-sm font-medium">
              <span className="keypad-clue-text">{clue}</span>
            </div>
          ))}
        </div>
        
        {/* Attempts History */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-inner">
          <h3 className="text-neutral-400 text-sm font-bold uppercase mb-3">Pressure Logs ({attempts.length}/10)</h3>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
            {attempts.length === 0 ? (
              <p className="text-neutral-600 text-sm italic">No tests run yet.</p>
            ) : (
              attempts.map((att, i) => (
                <div key={i} className="flex justify-between items-center bg-black/40 p-2 rounded">
                  <span className="text-cyan-400 font-mono text-sm tracking-widest">{att.guess.join('-')}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: att.exact }).map((_, j) => <span key={`e-${j}`} title="Correct Valve & Pressure">🟢</span>)}
                    {Array.from({ length: att.partial }).map((_, j) => <span key={`p-${j}`} title="Correct Pressure, Wrong Valve">🟡</span>)}
                    {Array.from({ length: config.solution.length - att.exact - att.partial }).map((_, j) => <span key={`m-${j}`} title="Incorrect">🔴</span>)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={`flex flex-col items-center gap-8 bg-neutral-900 border-4 border-neutral-800 p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden ${solved ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : ''}`}>
        
        {/* Decorative pipes in the background */}
        <div className="absolute top-0 left-10 w-4 h-full bg-neutral-800/50 pointer-events-none" />
        <div className="absolute top-0 right-10 w-4 h-full bg-neutral-800/50 pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-full h-4 bg-neutral-800/50 pointer-events-none transform -translate-y-1/2" />

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-10 z-10 w-full max-w-xl">
          {config.valves.map((valve, i) => (
            <div key={valve.id} className="flex flex-col items-center gap-3 bg-black/20 p-4 rounded-xl border border-neutral-800/50">
              <span className="text-neutral-400 font-bold tracking-widest text-sm uppercase bg-black/50 px-3 py-1 rounded-full border border-neutral-700">{valve.label}</span>
              
              {/* Valve visualization */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                {/* Dial background */}
                <div className="absolute inset-0 rounded-full border-4 border-neutral-700 bg-neutral-800 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]" />
                
                {/* Rotating handle based on value */}
                <div 
                  className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-transform duration-300 ease-in-out flex items-center justify-center"
                  style={{ transform: `rotate(${(valves[i] / config.maxValue) * 270}deg)` }}
                >
                  <div className="w-full h-2 bg-rose-500" />
                  <div className="absolute w-2 h-full bg-rose-500" />
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-rose-600 absolute shadow-inner z-10" />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 sm:gap-4 bg-black/40 p-2 rounded-xl border border-neutral-800">
                <button 
                  data-testid={`valve-${valve.id}-dec`}
                  className="w-10 h-10 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center text-xl font-bold border-b-2 border-neutral-900 active:border-b-0 active:translate-y-px transition-all"
                  onClick={() => turnValve(i, -1)}
                  disabled={solved || failed || valves[i] <= 0}
                >
                  -
                </button>
                <span className="text-xl font-mono text-cyan-400 font-bold min-w-[1.5rem] text-center" data-testid={`valve-${valve.id}-val`}>
                  {valves[i]}
                </span>
                <button 
                  data-testid={`valve-${valve.id}-inc`}
                  className="w-10 h-10 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center text-xl font-bold border-b-2 border-neutral-900 active:border-b-0 active:translate-y-px transition-all"
                  onClick={() => turnValve(i, 1)}
                  disabled={solved || failed || valves[i] >= config.maxValue}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="z-10 mt-6 flex flex-col items-center gap-4 w-full">
          {!solved && !failed && (
            <button
              onClick={testPressure}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all active:scale-95"
            >
              Test Pressure
            </button>
          )}

          {failed && !solved && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-rose-500 font-bold text-lg bg-black/60 px-6 py-2 rounded-full border border-rose-500/30">SYSTEM LOCKOUT - MAX ATTEMPTS</p>
              <button
                onClick={reset}
                className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-2 px-6 rounded-xl transition-all"
              >
                Reset System
              </button>
            </div>
          )}

          {solved && <p className="keypad-success text-emerald-400 font-bold text-xl bg-black/60 px-6 py-2 rounded-full backdrop-blur-sm border border-emerald-500/30">{t('ui_pressure_stable', { defaultValue: '✓ PRESSURE STABLE' })}</p>}
        </div>
      </div>
    </div>
  );
}
