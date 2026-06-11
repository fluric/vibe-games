import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface HealthState {
  loading: boolean;
  ok: boolean | null;
  database: boolean | null;
  version: string | null;
}

export function StatusPage() {
  const [health, setHealth] = useState<HealthState>({
    loading: true,
    ok: null,
    database: null,
    version: null,
  });

  useEffect(() => {
    let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
      rawApiUrl = `https://${rawApiUrl}`;
    }
    const API_URL = rawApiUrl;
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
    <div className="min-h-screen flex flex-col justify-center items-center gap-6 p-4">
      {/* System Status Dashboard */}
      <div className="flex flex-col gap-3 p-6 rounded-xl border border-solid border-[var(--border)] bg-[var(--social-bg)] backdrop-blur-md shadow-sm w-80 text-left">
        <h3 className="text-base font-semibold text-[var(--text-h)] border-b border-solid border-[var(--border)] pb-2 mb-1">
          System Connectivity
        </h3>
        
        <div className="flex items-center justify-between text-sm py-1">
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

        <div className="flex items-center justify-between text-sm py-1">
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
          <div className="flex items-center justify-between text-xs text-gray-500 border-t border-solid border-[var(--border)] pt-3 mt-1">
            <span>App Version:</span>
            <span>v{health.version}</span>
          </div>
        )}
      </div>

      <Link
        to="/"
        className="text-sm px-4 py-2 rounded-lg bg-[var(--accent-bg)] border-2 border-solid border-transparent hover:border-[var(--accent-border)] text-[var(--accent)] transition-all font-medium"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
