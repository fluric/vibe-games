import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_VERSION } from '@vibe-games/shared';

interface HealthState {
  loading: boolean;
  ok: boolean | null;
  database: boolean | null;
  version: string | null;
  revision: string | null;
  apiVersion: string | null;
}

export function StatusPage() {
  const [health, setHealth] = useState<HealthState>({
    loading: true,
    ok: null,
    database: null,
    version: null,
    revision: null,
    apiVersion: null,
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
          revision: data.revision,
          apiVersion: data.apiVersion,
        });
      })
      .catch((err) => {
        console.error('Failed to fetch health status:', err);
        setHealth({
          loading: false,
          ok: false,
          database: false,
          version: null,
          revision: null,
          apiVersion: null,
        });
      });
  }, []);

  const frontendRevision = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'development';
  const frontendApiVersion = API_VERSION;

  const isApiCompatible = health.loading || health.apiVersion === null || health.apiVersion === frontendApiVersion;
  const isRevisionSynced = health.loading || health.revision === null || health.revision === frontendRevision;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col justify-center items-center gap-6 p-4 relative overflow-hidden">
      {/* Background glow styling */}
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-rose-500/10 blur-[150px] pointer-events-none" />

      {/* System Status Dashboard */}
      <div className="flex flex-col gap-3 p-6 rounded-2xl border border-solid border-neutral-800 bg-neutral-900/60 backdrop-blur-md shadow-2xl w-80 text-left z-10">
        <h3 className="text-base font-bold text-white border-b border-solid border-neutral-800 pb-2 mb-1">
          System Connectivity
        </h3>
        
        <div className="flex items-center justify-between text-sm py-1">
          <span className="text-neutral-400">API Gateway:</span>
          {health.loading ? (
            <span className="text-neutral-500 animate-pulse">Checking...</span>
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
          <span className="text-neutral-400">PostgreSQL DB:</span>
          {health.loading ? (
            <span className="text-neutral-500 animate-pulse">Checking...</span>
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

        {/* Version Synchronization Check Section */}
        <div className="border-t border-solid border-neutral-800/80 pt-3 mt-2 flex flex-col gap-2">
          <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
            System Synchronization
          </h4>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">API Contract:</span>
            {health.loading ? (
              <span className="text-neutral-500 animate-pulse">Checking...</span>
            ) : isApiCompatible ? (
              <span className="text-emerald-400 font-medium">Compatible (v{frontendApiVersion})</span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                🚨 Mismatch ({health.apiVersion || 'unknown'} vs {frontendApiVersion})
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Git Revision:</span>
            {health.loading ? (
              <span className="text-neutral-500 animate-pulse">Checking...</span>
            ) : isRevisionSynced ? (
              <span className="text-emerald-400 font-medium">Synced ({frontendRevision.substring(0, 7)})</span>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                ⚠️ Out of Sync
              </span>
            )}
          </div>

          {!health.loading && !isRevisionSynced && (
            <div className="text-[10px] text-amber-500 leading-normal bg-amber-500/5 border border-amber-500/10 rounded p-2 mt-1">
              Backend is running {health.revision?.substring(0, 7) || 'unknown'} while frontend expects {frontendRevision.substring(0, 7)}. A server deployment may be in progress.
            </div>
          )}
        </div>

        {health.version && (
          <div className="flex items-center justify-between text-[10px] text-neutral-500 border-t border-solid border-neutral-800/80 pt-3 mt-1 font-mono">
            <span>Package version:</span>
            <span>v{health.version}</span>
          </div>
        )}
      </div>

      <Link
        to="/"
        className="text-xs px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-semibold transition-all active:scale-95 z-10"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
