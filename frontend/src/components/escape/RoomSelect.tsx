import type { EscapeRoom } from '../../data/escapeRooms';
import type { EscapeRoomProgressDto } from '@vibe-games/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  rooms: EscapeRoom[];
  progress: EscapeRoomProgressDto[];
  maxAccessible: number;
  onSelectRoom: (roomId: number) => void;
}

/** Room selection grid — shows Solved / Available / Locked cards. */
export function RoomSelect({ rooms, progress, maxAccessible, onSelectRoom }: Props) {
  const { t } = useTranslation('escape');
  const progressMap = new Map(progress.map((p) => [p.roomId, p]));

  return (
    <div className="escape-room-select">
      <header className="escape-select-header">
        <h1 className="escape-title">🔐 {t('ui.escape', { defaultValue: 'Escape' })}</h1>
        <p className="escape-subtitle">{t('ui.escape_subtitle', { defaultValue: 'Solve the puzzles. Open the doors. Get out.' })}</p>
      </header>

      <div className="escape-room-grid">
        {rooms.map((room) => {
          const p = progressMap.get(room.id);
          const isSolved = p?.solved ?? false;
          const isAvailable = room.id <= maxAccessible;
          const isLocked = !isAvailable;

          return (
            <button
              key={room.id}
              id={`room-card-${room.id}`}
              className={`escape-room-card${isSolved ? ' solved' : ''}${isAvailable && !isSolved ? ' available' : ''}${isLocked ? ' locked' : ''}`}
              onClick={() => !isLocked && onSelectRoom(room.id)}
              disabled={isLocked}
              aria-label={`Room ${room.id}: ${room.name} — ${isSolved ? 'Solved' : isAvailable ? 'Available' : 'Locked'}`}
            >
              <div className="room-card-number">
                {isLocked ? '🔒' : isSolved ? '✅' : `0${room.id}`}
              </div>
              <h2 className="room-card-name">{room.name}</h2>
              <p className="room-card-atmosphere">{room.atmosphere}</p>
              <div className="room-card-status">
                {isSolved && <span className="badge badge-solved">{t('ui.solved', { defaultValue: 'Solved' })}</span>}
                {isAvailable && !isSolved && <span className="badge badge-available">{t('ui.enter', { defaultValue: 'Enter →' })}</span>}
                {isLocked && <span className="badge badge-locked">{t('ui.locked', { defaultValue: 'Locked' })}</span>}
              </div>
              {isSolved && p?.solvedAt && (
                <p className="room-card-date">
                  {t('ui.cleared_on', { defaultValue: 'Cleared' })} {new Date(p.solvedAt).toLocaleDateString()}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
