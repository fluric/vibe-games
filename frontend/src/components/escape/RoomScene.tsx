import type { EscapeRoom } from '../../data/escapeRooms';

interface Props {
  room: EscapeRoom;
  children: React.ReactNode; // the puzzle component
}

/** Atmospheric room background that wraps the puzzle content.
 *  Uses CSS classes to set a themed background per room ID. */
export function RoomScene({ room, children }: Props) {
  return (
    <div className={`escape-room-scene room-theme-${room.id}`} role="main" aria-label={room.name}>
      {/* Atmospheric overlay grid */}
      <div className="scene-grid-overlay" aria-hidden="true" />

      {/* Room title + description */}
      <div className="scene-header">
        <h1 className="scene-room-name">{room.name}</h1>
        <p className="scene-room-description">{room.description}</p>
      </div>

      {/* Puzzle content area */}
      <div className="scene-puzzle-area">{children}</div>

      {/* Decorative corner accents */}
      <div className="scene-corner scene-corner-tl" aria-hidden="true" />
      <div className="scene-corner scene-corner-tr" aria-hidden="true" />
      <div className="scene-corner scene-corner-bl" aria-hidden="true" />
      <div className="scene-corner scene-corner-br" aria-hidden="true" />
    </div>
  );
}
