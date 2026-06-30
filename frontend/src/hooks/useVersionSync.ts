import { useState, useCallback, useEffect } from 'react';
import { API_VERSION } from '@vibe-games/shared';

export function useVersionSync() {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'warn' | 'mismatch'>('synced');
  const [backendApiVersion, setBackendApiVersion] = useState<string | null>(null);
  const [backendRevision, setBackendRevision] = useState<string | null>(null);

  const checkVersionSync = useCallback(async () => {
    let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!rawApiUrl.startsWith('http://') && !rawApiUrl.startsWith('https://')) {
      rawApiUrl = `https://${rawApiUrl}`;
    }
    try {
      const res = await fetch(`${rawApiUrl}/health`);
      if (!res.ok) throw new Error('Health check request failed');
      const data = await res.json();
      
      const frontendRevision = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'development';
      const frontendApiVersion = API_VERSION;
      
      setBackendApiVersion(data.apiVersion || null);
      setBackendRevision(data.revision || null);

      if (data.apiVersion !== frontendApiVersion) {
        setSyncStatus('mismatch');
      } else if (data.revision !== frontendRevision) {
        setSyncStatus('warn');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Failed to run version sync check:', err);
    }
  }, []);

  useEffect(() => {
    checkVersionSync();
  }, [checkVersionSync]);

  useEffect(() => {
    if (syncStatus === 'synced') return;
    const intervalTime = syncStatus === 'mismatch' ? 15000 : 30000;
    const interval = setInterval(checkVersionSync, intervalTime);
    return () => clearInterval(interval);
  }, [syncStatus, checkVersionSync]);

  return { syncStatus, backendApiVersion, backendRevision };
}
