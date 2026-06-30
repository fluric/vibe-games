import { useEscapeRooms } from '../../data/escapeRooms';

interface Props {
  currentRoomId: number;
  roomsCleared: number;
  onBack: () => void;
}

/** Top HUD bar shown during an active room.
 *  Shows room title, progress dots, and a back button. */
export function HudBar({ currentRoomId, roomsCleared, onBack }: Props) {
  const escapeRooms = useEscapeRooms();
  const room = escapeRooms.find((r) => r.id === currentRoomId);

  return (
    <div className="escape-hud" role="banner">
      <button
        className="escape-hud-back"
        onClick={onBack}
        aria-label="Back to room selection"
        id="escape-hud-back-btn"
      >
        ← Rooms
      </button>

      <div className="escape-hud-center">
        <span className="escape-hud-room-name">{room?.name ?? `Room ${currentRoomId}`}</span>
        <div className="escape-hud-dots" aria-label={`Progress: ${roomsCleared} of ${escapeRooms.length} solved`}>
          {escapeRooms.map((r) => (
            <span
              key={r.id}
              className={`hud-dot${r.id === currentRoomId ? ' current' : ''}${r.id <= roomsCleared ? ' cleared' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="escape-hud-right">
        <span className="escape-hud-count">{roomsCleared}/{escapeRooms.length}</span>
      </div>
    </div>
  );
}
