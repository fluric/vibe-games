import { useTranslation } from 'react-i18next';

interface Props {
  syncStatus: 'synced' | 'warn' | 'mismatch';
  backendApiVersion: string | null;
  backendRevision: string | null;
}

export function VersionSyncBanners({
  syncStatus,
  backendApiVersion,
  backendRevision
}: Props) {
  const { t } = useTranslation('lobby');

  if (syncStatus === 'synced') return null;

  return (
    <>
      {syncStatus === 'mismatch' && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-rose-500/5">
          <div className="flex items-center gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <p className="font-bold">{t('version_mismatch_title', { defaultValue: 'Critical version mismatch detected' })}</p>
              <p className="text-xs text-rose-300/80 mt-0.5">
                {t('version_mismatch_desc', { defaultValue: `The server has been updated with a newer API version (v${backendApiVersion || '?'}). Please refresh the page to update your client.` })}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            {t('refresh_page', { defaultValue: 'Refresh Page' })}
          </button>
        </div>
      )}

      {syncStatus === 'warn' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-3 shadow-lg shadow-amber-500/5">
          <span className="text-xl">⚙️</span>
          <div>
            <p className="font-bold">{t('system_update_title', { defaultValue: 'System update in progress' })}</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              {t('system_update_desc', { defaultValue: 'The background system is being updated (running version {{rev}}). Gameplay remains active.', replace: { rev: backendRevision?.substring(0, 7) || '?' } })}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
