
interface JoinByCodePanelProps {
  inviteCode: string;
  setInviteCode: (code: string) => void;
  joiningCode: boolean;
  syncStatus: 'synced' | 'warn' | 'mismatch';
  onJoinByCode: (e: React.FormEvent) => void;
}

export function JoinByCodePanel({
  inviteCode,
  setInviteCode,
  joiningCode,
  syncStatus,
  onJoinByCode
}: JoinByCodePanelProps) {
  return (
    <div className="md:col-span-1 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between gap-4">
      <div>
        <h3 className="text-lg font-bold text-white">Join by Code</h3>
        <p className="text-xs text-neutral-400 mt-1">
          Enter an invite code / game ID sent by a friend to join their private lobby.
        </p>
      </div>
      <form onSubmit={onJoinByCode} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Paste Game ID / Code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          disabled={syncStatus === 'mismatch'}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={joiningCode || !inviteCode.trim() || syncStatus === 'mismatch'}
          className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold text-xs transition-all flex items-center justify-center gap-2"
        >
          {joiningCode ? 'Joining...' : 'Enter Game'}
        </button>
      </form>
    </div>
  );
}
