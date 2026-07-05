import { PlayerPiece, GrailQuestCellType, GrailQuestGameState } from '@vibe-games/shared';

// Neighbor offsets in axial coordinates (q, r)
// Clockwise starting from East (3 o'clock)
export const AXIAL_NEIGHBORS = [
  { q: 1, r: 0 },   // 0: East / 3 o'clock
  { q: 0, r: 1 },   // 1: Southeast / 5 o'clock
  { q: -1, r: 1 },  // 2: Southwest / 7 o'clock
  { q: -1, r: 0 },  // 3: West / 9 o'clock
  { q: 0, r: -1 },  // 4: Northwest / 11 o'clock
  { q: 1, r: -1 }   // 5: Northeast / 1 o'clock
];

// Calculate distance from center (0,0) or between two cells
export function getDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs((q1 + r1) - (q2 + r2))) / 2;
}

// Check if axial coordinate is within radius 3 grid
export function isValidHex(q: number, r: number): boolean {
  return getDistance(0, 0, q, r) <= 3;
}

// Get the type of a cell based on coordinates
export function getCellType(q: number, r: number): GrailQuestCellType {
  if (q === 0 && r === 0) return 'grail_center';
  
  if (q === 0 && r === -3) return 'home_base'; // Player X
  if (q === 0 && r === 3) return 'home_base';  // Player O
  
  // Urban / Housing Hexes
  if ((q === -1 && r === -2) || (q === 2 && r === -2)) return 'urban'; // Player X
  if ((q === -2 && r === 2) || (q === 1 && r === 2)) return 'urban';   // Player O
  
  // Farm Land Hexes
  if ((q === -2 && r === 0) || (q === 2 && r === 0)) return 'farm_land';
  
  // Hill Hexes
  if ((q === -1 && r === -1) || (q === 1 && r === -1) || (q === 1 && r === 1) || (q === -1 && r === 1)) {
    return 'hill';
  }
  
  return 'normal';
}

// Get the initial owner of a cell
export function getInitialOwner(q: number, r: number): PlayerPiece | null {
  const type = getCellType(q, r);
  if (type === 'home_base') {
    return r < 0 ? 'X' : 'O';
  }
  return null;
}

// Find axial neighbor index for clockwise merging sort (0-5, or -1 if not neighbors)
export function getNeighborIndex(q_dest: number, r_dest: number, q_start: number, r_start: number): number {
  const dq = q_start - q_dest;
  const dr = r_start - r_dest;
  return AXIAL_NEIGHBORS.findIndex(n => n.q === dq && n.r === dr);
}

// Count Farm Land cells owned by player
export function getFarmLandsCount(state: GrailQuestGameState, player: PlayerPiece): number {
  let count = 0;
  for (const cell of Object.values(state.board)) {
    if (cell.cellType === 'farm_land' && cell.owner === player) {
      count++;
    }
  }
  return count;
}
