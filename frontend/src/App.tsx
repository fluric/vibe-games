import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

interface HealthState {
  loading: boolean;
  ok: boolean | null;
  database: boolean | null;
  version: string | null;
}

function App() {
  const [count, setCount] = useState(0)
  const [health, setHealth] = useState<HealthState>({
    loading: true,
    ok: null,
    database: null,
    version: null,
  });

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setHealth({
          loading: false,
          ok: data.ok,
          database: data.database,
          version: data.version,
        });
      })
      .catch((err) => {
        console.error('Failed to fetch health status:', err);
        setHealth({
          loading: false,
          ok: false,
          database: false,
          version: null,
        });
      });
  }, []);

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>

        {/* System Status Dashboard */}
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-solid border-[var(--border)] bg-[var(--social-bg)] backdrop-blur-md shadow-sm w-72 text-left">
          <h3 className="text-sm font-semibold text-[var(--text-h)] border-b border-solid border-[var(--border)] pb-2 mb-1">
            System Connectivity
          </h3>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">API Gateway:</span>
            {health.loading ? (
              <span className="text-gray-500 animate-pulse">Checking...</span>
            ) : health.ok ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-rose-500">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                Offline
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">PostgreSQL DB:</span>
            {health.loading ? (
              <span className="text-gray-500 animate-pulse">Checking...</span>
            ) : health.database ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-rose-500">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                Disconnected
              </span>
            )}
          </div>

          {health.version && (
            <div className="flex items-center justify-between text-xs text-gray-500 border-t border-solid border-[var(--border)] pt-2 mt-1">
              <span>App Version:</span>
              <span>v{health.version}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
