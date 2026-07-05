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
