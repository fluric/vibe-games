import { useState } from 'react';
import type { FuseRoomConfig } from '../../data/escapeRooms';

interface Props {
  config: FuseRoomConfig;
  onSolved: () => void;
}

/** Wire-pairing fuse box puzzle.
 *  Desktop: drag wire onto post. Mobile: tap wire then tap post. */
export function FuseBoxPuzzle({ config, onSolved }: Props) {
  // Map wireId → matched postId (null = unmatched)
  const [connections, setConnections] = useState<Record<string, string | null>>(
    () => Object.fromEntries(config.wires.map((w) => [w.id, null])),
  );
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  // Desktop drag state
  const [draggingWire, setDraggingWire] = useState<string | null>(null);

  const usedPosts = new Set(Object.values(connections).filter(Boolean));

  const attemptConnect = (wireId: string, postId: string) => {
    if (solved) return;
    setConnections({ ...connections, [wireId]: postId });
    setSelectedWire(null);
  };

  const handleWireClick = (wireId: string) => {
    if (solved) return;
    if (connections[wireId]) {
      setConnections({ ...connections, [wireId]: null }); // disconnect
      return;
    }
    setSelectedWire(wireId === selectedWire ? null : wireId);
  };

  const handlePostClick = (postId: string) => {
    if (solved) return;
    if (usedPosts.has(postId)) {
      // Disconnect the wire on this post
      const wireId = Object.entries(connections).find(([_, p]) => p === postId)?.[0];
      if (wireId) {
        setConnections({ ...connections, [wireId]: null });
      }
      return;
    }
    if (!selectedWire) return;
    attemptConnect(selectedWire, postId);
  };

  // Drag handlers (desktop)
  const handleDragStart = (e: React.DragEvent, wireId: string) => {
    if (connections[wireId]) { e.preventDefault(); return; }
    setDraggingWire(wireId);
    e.dataTransfer.effectAllowed = 'link';
  };
  const handleDrop = (e: React.DragEvent, postId: string) => {
    e.preventDefault();
    if (draggingWire && !usedPosts.has(postId)) {
      attemptConnect(draggingWire, postId);
    }
    setDraggingWire(null);
  };

  const allConnected = Object.values(connections).filter(Boolean).length === config.wires.length;

  const handleTestCircuit = () => {
    if (!allConnected || solved) return;
    
    const allCorrect = config.wires.every((w) => connections[w.id] === w.targetPost);
    if (allCorrect) {
      setSolved(true);
      setTimeout(onSolved, 900);
    } else {
      setWrongFlash('all');
      setTimeout(() => setWrongFlash(null), 500);
      // Clear all connections on a short circuit!
      setConnections(Object.fromEntries(config.wires.map((w) => [w.id, null])));
    }
  };

  return (
    <div className={`escape-puzzle escape-fuse${solved ? ' solved' : ''}`}>
      <p className="fuse-instruction">
        {solved
          ? '⚡ Circuit complete!'
          : 'Connect each wire to its matching post. Tap the wire, then tap the post.'}
      </p>

      {!solved && config.clues && config.clues.length > 0 && (
        <div className="fuse-clues" style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '0.75rem', borderLeft: '4px solid #f59e0b', textAlign: 'left', fontSize: '0.875rem', color: '#cbd5e1' }}>
          <h4 style={{ color: '#f59e0b', margin: '0 0 0.5rem 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Circuit Diagram Notes</h4>
          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {config.clues.map((clue, idx) => (
              <li key={idx}>{clue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="fuse-panel">
        {/* Wires (left side) */}
        <div className="fuse-wires">
          <h3 className="fuse-col-label">Wires</h3>
          {config.wires.map((wire) => {
            const connected = connections[wire.id] != null;
            const isSelected = selectedWire === wire.id;
            const isWrong = wrongFlash === wire.id || wrongFlash === 'all';
            return (
              <button
                key={wire.id}
                id={`wire-${wire.id}`}
                className={`fuse-wire${connected ? ' connected' : ''}${isSelected ? ' selected' : ''}${isWrong ? ' wrong' : ''}`}
                style={{ '--wire-color': wire.colorHex } as React.CSSProperties}
                onClick={() => handleWireClick(wire.id)}
                draggable={!connected}
                onDragStart={(e) => handleDragStart(e, wire.id)}
                aria-label={`${wire.color} wire${connected ? ` — connected to post ${connections[wire.id]}` : ''}`}
                aria-pressed={isSelected}
                disabled={connected || solved}
              >
                <span className="wire-dot" style={{ background: wire.colorHex }} />
                <span className="wire-label">{wire.color}</span>
                {connected && <span className="wire-check">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Connector line visual */}
        <div className="fuse-connector" aria-hidden="true">
          <div className="fuse-connector-line" />
        </div>

        {/* Posts (right side) */}
        <div className="fuse-posts">
          <h3 className="fuse-col-label">Posts</h3>
          {config.posts.map((post) => {
            const occupied = usedPosts.has(post.id);
            const connectedWire = config.wires.find((w) => connections[w.id] === post.id);
            const isWrong = wrongFlash === 'all' && occupied;
            return (
              <button
                key={post.id}
                id={`post-${post.id}`}
                className={`fuse-post${occupied ? ' occupied' : ''}${draggingWire ? ' drop-target' : ''}${isWrong ? ' wrong' : ''}`}
                onClick={() => handlePostClick(post.id)}
                onDragOver={(e) => { if (!occupied) e.preventDefault(); }}
                onDrop={(e) => handleDrop(e, post.id)}
                aria-label={`Post ${post.label}${occupied ? ` — ${connectedWire?.color} wire connected` : ' — empty'}`}
                disabled={solved}
              >
                {connectedWire && (
                  <span className="post-wire-dot" style={{ background: connectedWire.colorHex }} />
                )}
                <span className="post-label">{post.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        className={`escape-btn${wrongFlash === 'all' ? ' flash-error' : ''}${solved ? ' solved' : ''}`}
        onClick={handleTestCircuit}
        disabled={!allConnected || solved}
        style={{ marginTop: '1.5rem', width: '100%' }}
        id="test-circuit-btn"
      >
        {solved ? '✓ Circuit Restored!' : 'Test Circuit'}
      </button>
    </div>
  );
}
