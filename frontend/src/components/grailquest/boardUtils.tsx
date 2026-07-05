import type { GrailQuestGameState, GrailQuestCell, PlayerPiece, GrailQuestCard } from "@vibe-games/shared";

export const HEX_SIZE = 45;
export const WIDTH = 560;
export const HEIGHT = 560;
export const CENTER_X = WIDTH / 2;
export const CENTER_Y = HEIGHT / 2;

// Standard flat-topped hex center mapping
export function getHexCenter(q: number, r: number) {
  const cx = CENTER_X + HEX_SIZE * (3 / 2) * q;
  const cy = CENTER_Y + HEX_SIZE * Math.sqrt(3) * (r + q / 2);
  return { cx, cy };
}

// Generate the coordinates of the 6 corners of a flat-topped hex
export function getHexPoints(cx: number, cy: number, size: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angleRad);
    const y = cy + size * Math.sin(angleRad);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

// Helper to translate card value to display card string
export function formatCardValue(value: number): string {
  if (value === 0) return '?';
  if (value === 13) return 'K';
  if (value === 12) return 'Q';
  if (value === 11) return 'J';
  return value.toString();
}

export function parseCardLabel(label: string): number {
  if (!label) return 0;
  label = label.trim();
  const lower = label.toLowerCase();
  if (lower.includes('king') || lower === 'k') return 13;
  if (lower.includes('queen') || lower === 'q') return 12;
  if (lower.includes('jack') || lower === 'j') return 11;
  const num = parseInt(label, 10);
  return isNaN(num) ? 0 : num;
}

export interface TempVisualMove {
  from: string;
  to: string;
  count: number;
  player?: PlayerPiece;
  isRetreat?: boolean;
}
export interface TempVisualDeploy {
  cellKey: string;
  count: number;
}
export interface TempVisualRadioactivity {
  cellKey: string;
  player: PlayerPiece | 'neutral';
  card: string;
}
export interface RolledBackState {
  board: Record<string, GrailQuestCell>;
  grailCellKey: string;
}

export interface AggregatedMove {
  from: string;
  to: string;
  cards: GrailQuestCard[];
  carriesGrail: boolean;
}

export interface AggregatedReviewMove {
  from: string;
  to: string;
  count: number;
  player?: PlayerPiece;
  isRetreat?: boolean;
}

export function getAggregatedFriendlyMoves(moves: { from: string; to: string; cards: GrailQuestCard[]; carriesGrail?: boolean }[]): AggregatedMove[] {
  const map = new Map<string, AggregatedMove>();
  for (const m of moves) {
    const key = `${m.from}->${m.to}`;
    const existing = map.get(key);
    if (existing) {
      existing.cards = [...existing.cards, ...m.cards];
      if (m.carriesGrail) existing.carriesGrail = true;
    } else {
      map.set(key, {
        from: m.from,
        to: m.to,
        cards: [...m.cards],
        carriesGrail: !!m.carriesGrail
      });
    }
  }
  return Array.from(map.values());
}

export function getAggregatedReviewMoves(moves: TempVisualMove[]): AggregatedReviewMove[] {
  const map = new Map<string, AggregatedReviewMove>();
  for (const m of moves) {
    const key = `${m.from}->${m.to}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += m.count;
    } else {
      map.set(key, {
        from: m.from,
        to: m.to,
        count: m.count,
        player: m.player,
        isRetreat: m.isRetreat
      });
    }
  }
  return Array.from(map.values());
}

export function getCellDefaultOwner(cell: GrailQuestCell): PlayerPiece | 'neutral' | null {
  if (cell.cellType === 'home_base' || cell.cellType === 'urban') {
    return cell.r < 0 ? 'X' : 'O';
  }
  return 'neutral';
}

export function rollbackBoardAndGrail(
  board: Record<string, GrailQuestCell>,
  grailCellKey: string | undefined,
  reviewDeploys: TempVisualDeploy[],
  reviewMoves: TempVisualMove[],
  oppPiece: PlayerPiece
): RolledBackState {
  const rolledBoard: Record<string, GrailQuestCell> = JSON.parse(JSON.stringify(board));
  let rolledGrailKey = grailCellKey || '0,0';

  // 1. Rollback moves in reverse order
  for (let i = reviewMoves.length - 1; i >= 0; i--) {
    const move = reviewMoves[i];
    const fromCell = rolledBoard[move.from];
    const toCell = rolledBoard[move.to];
    if (fromCell && toCell) {
      if (rolledGrailKey === move.to) {
        rolledGrailKey = move.from;
      }

      const countToTake = Math.min(move.count, toCell.soldiers.length);
      
      const taken: GrailQuestCard[] = [];
      for (let c = 0; c < countToTake; c++) {
        const popped = toCell.soldiers.pop();
        if (popped) taken.push(popped);
      }

      while (taken.length < move.count) {
        taken.push({ value: 10, revealed: false });
      }

      if (move.isRetreat) {
        fromCell.soldiers.unshift(...taken);
      } else {
        fromCell.soldiers.push(...taken);
      }
      fromCell.owner = move.player || oppPiece;

      if (toCell.soldiers.length === 0) {
        toCell.owner = getCellDefaultOwner(toCell);
      }
    }
  }

  // 2. Rollback deploys
  for (const deploy of reviewDeploys) {
    const cell = rolledBoard[deploy.cellKey];
    if (cell) {
      for (let c = 0; c < deploy.count; c++) {
        cell.soldiers.pop();
      }
      if (cell.soldiers.length === 0) {
        cell.owner = getCellDefaultOwner(cell);
      }
    }
  }

  return {
    board: rolledBoard,
    grailCellKey: rolledGrailKey
  };
}

export function formatCardString(cardStr: string): string {
  if (!cardStr) return '?';
  if (cardStr.includes(',')) {
    return '[' + cardStr.split(',').map(s => formatCardValue(parseCardLabel(s.trim()))).join(', ') + ']';
  }
  return formatCardValue(parseCardLabel(cardStr));
}



export interface GrailQuestBoardProps {
  state: GrailQuestGameState;
  myPiece: PlayerPiece | null;
  disabled: boolean;
  submittingMove: boolean;
   
  onAction: (action: any) => Promise<void>;
}

