import type { HolyGrailCell } from '@vibe-games/shared';
import { getHexCenter, getHexPoints, formatCardValue, WIDTH, HEIGHT, HEX_SIZE } from './utils';

 
type MoveDetails = any;

export interface HexGridRendererProps {
  board: Record<string, HolyGrailCell>;
  grailCellKey: string | null;
  pendingCombats: { cellKey: string }[];
  hoveredCellKey: string | null;
  setHoveredCellKey: (key: string | null) => void;
  handleCellClick: (key: string) => void;
  getCellFillClass: (cell: HolyGrailCell) => string;
  myPiece: 'X' | 'O' | null;
  turn: 'X' | 'O';
  isReviewingLastTurn: boolean;
  reviewDeploys: { cellKey: string; count: number }[];
  aggregatedFriendlyMoves: { from: string; to: string; cards: MoveDetails[] }[];
  aggregatedReviewMoves: { from: string; to: string; count: number; player?: 'X' | 'O' }[];
  hoveredMoveIdx: number | null;
  setHoveredMoveIdx: (idx: number | null) => void;
}

export const HexGridRenderer: React.FC<HexGridRendererProps> = ({
  board,
  grailCellKey,
  pendingCombats,
  hoveredCellKey,
  setHoveredCellKey,
  handleCellClick,
  getCellFillClass,
  myPiece,
  turn,
  isReviewingLastTurn,
  reviewDeploys,
  aggregatedFriendlyMoves,
  aggregatedReviewMoves,
  hoveredMoveIdx,
  setHoveredMoveIdx
}) => {
  return (
    <div className="w-full bg-neutral-950/45 border border-neutral-800/80 p-2 sm:p-4 rounded-3xl backdrop-blur-sm shadow-2xl relative flex justify-center">
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[560px] aspect-square select-none"
      >
        <defs>
          <marker 
            id="arrow" 
            viewBox="0 0 10 10" 
            refX="4" 
            refY="5" 
            markerWidth="5" 
            markerHeight="5" 
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-indigo-400" />
          </marker>
          <marker 
            id="arrow-blue" 
            viewBox="0 0 10 10" 
            refX="4" 
            refY="5" 
            markerWidth="5" 
            markerHeight="5" 
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-blue-500" />
          </marker>
          <marker 
            id="arrow-rose" 
            viewBox="0 0 10 10" 
            refX="4" 
            refY="5" 
            markerWidth="5" 
            markerHeight="5" 
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-rose-500" />
          </marker>
        </defs>

        {/* Grid Cells */}
        {Object.values(board).map((cell) => {
          const { cx, cy } = getHexCenter(cell.q, cell.r);
          const cellKey = `${cell.q},${cell.r}`;
          const isGrail = grailCellKey === cellKey;
          const hasSoldiers = cell.soldiers.length > 0;
          const topCard = cell.soldiers[0];
          const isContested = pendingCombats.some(c => c.cellKey === cellKey);

          return (
            <g 
              key={cellKey}
              data-testid={`cell-${cellKey}`}
              onClick={() => handleCellClick(cellKey)}
              onMouseEnter={() => {
                if (cell.soldiers.length > 0) {
                  setHoveredCellKey(cellKey);
                }
              }}
              onMouseLeave={() => setHoveredCellKey(null)}
              className="group cursor-pointer"
            >
              {/* Hexagon Shape */}
              <polygon
                points={getHexPoints(cx, cy, HEX_SIZE - 2)}
                className={`transition-all duration-200 ${getCellFillClass(cell)} hover:brightness-125`}
                strokeDasharray={cell.cellType === 'urban' ? "4 3" : undefined}
              />

              {/* Inner Labels & Badges */}
              {/* Cell Coordinates (Small utility label) */}
              <text 
                x={cx} 
                y={cy - 22} 
                textAnchor="middle" 
                className="text-[9px] fill-neutral-600 font-mono select-none"
              >
                {cellKey}
              </text>

              {/* Cell type decorator icons */}
              {cell.cellType === 'hill' && !hasSoldiers && (
                <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-slate-400">⛰️</text>
              )}
              {cell.cellType === 'farm_land' && !hasSoldiers && (
                <g>
                  <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-emerald-400">🌾</text>
                  {cell.owner === 'X' && (
                    <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-blue-500 stroke-neutral-950 stroke-[1]" />
                  )}
                  {cell.owner === 'O' && (
                    <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-rose-500 stroke-neutral-950 stroke-[1]" />
                  )}
                </g>
              )}
              {cell.cellType === 'home_base' && !hasSoldiers && (
                <text x={cx} y={cy - 4} textAnchor="middle" className={`text-base opacity-75 select-none ${cell.r < 0 ? 'fill-blue-400' : 'fill-rose-400'}`}>🏰</text>
              )}
              {cell.cellType === 'urban' && !hasSoldiers && (
                <g>
                  <text x={cx} y={cy - 4} textAnchor="middle" className="text-base opacity-75 select-none fill-indigo-400">🛖</text>
                  {cell.owner === 'X' && (
                    <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-blue-500 stroke-neutral-950 stroke-[1]" />
                  )}
                  {cell.owner === 'O' && (
                    <circle cx={cx + 12} cy={cy - 12} r="3.5" className="fill-rose-500 stroke-neutral-950 stroke-[1]" />
                  )}
                </g>
              )}

              {/* Combat swords if contested */}
              {isContested && (
                <g transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
                  <circle 
                    r="14" 
                    className="fill-red-500/20 stroke-red-500 stroke-2 animate-ping" 
                  />
                  <text 
                    textAnchor="middle" 
                    y="5" 
                    className="text-lg drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] filter"
                  >
                    ⚔️
                  </text>
                </g>
              )}

              {/* Soldiers Stack representation */}
              {hasSoldiers && !isContested && (
                <g transform={`translate(${cx}, ${cy - 5})`}>
                  {/* Badge background for stack size if size > 1 */}
                  {cell.soldiers.length > 1 && (
                    <circle 
                      r="11" 
                      cx="18" 
                      cy="-14" 
                      className="fill-neutral-900 stroke-neutral-700 stroke" 
                    />
                  )}
                  {cell.soldiers.length > 1 && (
                    <text 
                      x="18" 
                      y="-10.5" 
                      textAnchor="middle" 
                      className="text-[10px] font-bold fill-neutral-400 font-mono"
                    >
                      {cell.soldiers.length}
                    </text>
                  )}

                  {/* Top Card Face Drawing */}
                  <rect 
                    x="-14" 
                    y="-12" 
                    width="28" 
                    height="38" 
                    rx="4" 
                    className={`stroke-2 ${
                      cell.owner === 'X' 
                        ? 'fill-blue-950 stroke-blue-500' 
                        : cell.owner === 'O'
                        ? 'fill-rose-950 stroke-rose-500'
                        : 'fill-neutral-900 stroke-neutral-600'
                    }`} 
                  />

                  {/* Card value label */}
                  <text 
                    y="10" 
                    textAnchor="middle" 
                    className={`text-base font-black ${
                      cell.owner === 'X' 
                        ? 'fill-blue-200' 
                        : cell.owner === 'O'
                        ? 'fill-rose-200'
                        : 'fill-neutral-300'
                    }`}
                  >
                    {formatCardValue(topCard.value)}
                  </text>

                  {/* Cell type text indicator at the bottom of the card */}
                  {cell.cellType !== 'normal' && cell.cellType !== 'grail_center' && (
                    <text 
                      y="22" 
                      textAnchor="middle" 
                      className="text-[7px] font-bold fill-neutral-400 uppercase tracking-wider opacity-90 select-none"
                    >
                      {cell.cellType === 'urban' ? 'Urban' : cell.cellType === 'farm_land' ? 'Farm' : cell.cellType === 'hill' ? 'Hill' : 'Base'}
                    </text>
                  )}

                  {/* Small crown/stars icons for J/Q/K */}
                  {topCard.value === 13 && (
                    <text y="-4" textAnchor="middle" className="text-[9px] fill-amber-400">👑</text>
                  )}
                  {topCard.value === 12 && (
                    <text y="-4" textAnchor="middle" className="text-[9px] fill-purple-400">✨</text>
                  )}
                  {topCard.value === 11 && (
                    <text y="-4" textAnchor="middle" className="text-[9px] fill-blue-400">🛡️</text>
                  )}
                  {cell.owner === myPiece && topCard.revealed && (
                    <text x="9" y="-4" textAnchor="middle" className="text-[8px]">
                      <title>Visible to opponent</title>
                      👁️
                    </text>
                  )}
                </g>
              )}

              {/* Grail indicator overlay */}
              {isGrail && (
                <g transform={`translate(${cx}, ${cy - (hasSoldiers ? 31 : 0)})`} className="pointer-events-none">
                  <circle 
                    r="14" 
                    className="fill-amber-500/20 stroke-amber-400 stroke-2 animate-ping" 
                  />
                  <text 
                    textAnchor="middle" 
                    y="5" 
                    className="text-lg drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] filter"
                  >
                    🏆
                  </text>
                </g>
              )}

              {/* Opponent Deploy Indicator Overlay (Review Phase) */}
              {isReviewingLastTurn && (() => {
                const deploy = reviewDeploys.find(d => d.cellKey === cellKey);
                if (!deploy) return null;
                const oppPiece = myPiece === 'X' ? 'O' : 'X';
                const oppFill = oppPiece === 'X' ? 'fill-blue-950 stroke-blue-500' : 'fill-rose-950 stroke-rose-500';
                const oppText = oppPiece === 'X' ? 'fill-blue-200' : 'fill-rose-200';
                const oppPulse = oppPiece === 'X' ? 'stroke-blue-500/40' : 'stroke-rose-500/40';
                return (
                  <g transform={`translate(${cx}, ${cy + (hasSoldiers ? 22 : 0)})`} className="pointer-events-none">
                    <circle 
                      r="10" 
                      className={`${oppFill} stroke-2`} 
                    />
                    <text 
                      textAnchor="middle" 
                      y="3.5" 
                      className={`text-[9px] font-bold ${oppText} font-mono`}
                    >
                      +{deploy.count}
                    </text>
                    <circle 
                      r="14" 
                      className={`fill-none stroke-2 animate-ping ${oppPulse}`} 
                    />
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Movement Path Arrows */}
        {aggregatedFriendlyMoves.map((move, idx) => {
          const fromCell = board[move.from];
          const toCell = board[move.to];
          if (!fromCell || !toCell) return null;

          const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
          const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);

          const dx = cx2 - cx1;
          const dy = cy2 - cy1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;

          const startX = cx1 + dx * (22 / len);
          const startY = cy1 + dy * (22 / len);
          const endX = cx2 - dx * (26 / len);
          const endY = cy2 - dy * (26 / len);

          const midX = (cx1 + cx2) / 2;
          const midY = (cy1 + cy2) / 2;

          const colorClass = turn === 'X' ? 'stroke-blue-500/90' : 'stroke-rose-500/90';
          const fillClass = turn === 'X' ? 'fill-blue-950 stroke-blue-400' : 'fill-rose-950 stroke-rose-400';
          const textClass = turn === 'X' ? 'fill-blue-200' : 'fill-rose-200';
          const markerId = turn === 'X' ? 'arrow-blue' : 'arrow-rose';

          return (
            <g 
              key={`move-arrow-${idx}`}
              onMouseEnter={() => setHoveredMoveIdx(idx)}
              onMouseLeave={() => setHoveredMoveIdx(null)}
              className="cursor-pointer"
            >
              {/* Dashed line */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                className={`${colorClass} stroke-[3] [stroke-dasharray:4,3]`}
                markerEnd={`url(#${markerId})`}
              />

              {/* Thick transparent interactive area for easier hover */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                className="stroke-transparent stroke-[12]"
              />

              {/* Move count badge */}
              <circle
                cx={midX}
                cy={midY}
                r="8"
                className={`${fillClass} stroke-[1.5]`}
              />
              <text
                x={midX}
                y={midY + 3}
                textAnchor="middle"
                className={`text-[9px] font-black ${textClass} select-none font-mono`}
              >
                {move.cards.length}
              </text>
            </g>
          );
        })}

        {/* Opponent Movement Path Arrows (Review Phase) */}
        {isReviewingLastTurn && aggregatedReviewMoves.map((move, idx) => {
          const fromCell = board[move.from];
          const toCell = board[move.to];
          if (!fromCell || !toCell) return null;

          const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
          const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);

          const dx = cx2 - cx1;
          const dy = cy2 - cy1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;

          const startX = cx1 + dx * (22 / len);
          const startY = cy1 + dy * (22 / len);
          const endX = cx2 - dx * (26 / len);
          const endY = cy2 - dy * (26 / len);

          const midX = (cx1 + cx2) / 2;
          const midY = (cy1 + cy2) / 2;

          const playerPiece = move.player || (myPiece === 'X' ? 'O' : 'X');
          const colorClass = playerPiece === 'X' ? 'stroke-blue-500/90' : 'stroke-rose-500/90';
          const fillClass = playerPiece === 'X' ? 'fill-blue-950 stroke-blue-400' : 'fill-rose-950 stroke-rose-400';
          const textClass = playerPiece === 'X' ? 'fill-blue-200' : 'fill-rose-200';
          const markerId = playerPiece === 'X' ? 'arrow-blue' : 'arrow-rose';

          return (
            <g key={`review-move-arrow-${idx}`}>
              {/* Dashed line */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                className={`${colorClass} stroke-[3] [stroke-dasharray:4,3]`}
                markerEnd={`url(#${markerId})`}
              />

              {/* Move count badge */}
              <circle
                cx={midX}
                cy={midY}
                r="8"
                className={`${fillClass} stroke-[1.5]`}
              />
              <text
                x={midX}
                y={midY + 3}
                textAnchor="middle"
                className={`text-[9px] font-black ${textClass} select-none font-mono`}
              >
                {move.count}
              </text>
            </g>
          );
        })}

        {/* Hovered Cell Stack Tooltip */}
        {hoveredCellKey && (() => {
          const cell = board[hoveredCellKey];
          if (!cell || cell.soldiers.length === 0) return null;
          
          const { cx, cy } = getHexCenter(cell.q, cell.r);
          
          const tooltipWidth = 145;
          const tooltipHeight = 36 + cell.soldiers.length * 20;
          const tooltipX = Math.max(10, Math.min(cx + 30, WIDTH - tooltipWidth - 10));
          const tooltipY = Math.max(10, Math.min(cy - 90, HEIGHT - tooltipHeight - 10));

          return (
            <g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                className="fill-neutral-950/95 stroke-neutral-700/80 stroke-2"
              />
              <text
                x={tooltipWidth / 2}
                y="14"
                textAnchor="middle"
                className="fill-neutral-400 text-[8px] font-bold tracking-widest uppercase"
              >
                Stack Soldiers
              </text>

              {cell.soldiers.map((card, idx) => {
                const isCardValueVisible = card.value > 0;
                const isMyOwnRevealed = cell.owner === myPiece && card.revealed;
                
                return (
                  <g key={idx} transform={`translate(10, ${22 + idx * 20})`}>
                    <rect
                      width={tooltipWidth - 20}
                      height={16}
                      rx="3"
                      className={`${
                        cell.owner === 'X'
                          ? 'fill-blue-950/40 stroke-blue-500/30'
                          : cell.owner === 'O'
                          ? 'fill-rose-950/40 stroke-rose-500/30'
                          : 'fill-neutral-900 stroke-neutral-800'
                      } stroke`}
                    />
                    <text
                      x="6"
                      y="11"
                      className={`text-[9px] font-bold ${
                        isCardValueVisible
                          ? cell.owner === 'X'
                            ? 'fill-blue-200'
                            : cell.owner === 'O'
                            ? 'fill-rose-200'
                            : 'fill-neutral-200'
                          : 'fill-neutral-500 font-normal italic'
                      }`}
                    >
                      {isCardValueVisible
                        ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})`
                        : 'Hidden (?)'}
                      {card.moved && ' (Moved)'}
                      {isMyOwnRevealed && ' 👁️'}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Hovered Move Arrow Tooltip */}
        {hoveredMoveIdx !== null && (() => {
          const move = aggregatedFriendlyMoves[hoveredMoveIdx];
          if (!move) return null;

          const fromCell = board[move.from];
          const toCell = board[move.to];
          if (!fromCell || !toCell) return null;

          const { cx: cx1, cy: cy1 } = getHexCenter(fromCell.q, fromCell.r);
          const { cx: cx2, cy: cy2 } = getHexCenter(toCell.q, toCell.r);
          const midX = (cx1 + cx2) / 2;
          const midY = (cy1 + cy2) / 2;

          const tooltipWidth = 140;
          const tooltipHeight = 36 + move.cards.length * 20;
          const tooltipX = Math.max(10, Math.min(midX + 15, WIDTH - tooltipWidth - 10));
          const tooltipY = Math.max(10, Math.min(midY - 40, HEIGHT - tooltipHeight - 10));

          return (
            <g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                className="fill-neutral-950/95 stroke-indigo-500/50 stroke-2"
              />
              <text
                x={tooltipWidth / 2}
                y="14"
                textAnchor="middle"
                className="fill-indigo-300 text-[8px] font-bold tracking-widest uppercase"
              >
                Moved Units
              </text>

              {move.cards.map((card, idx) => {
                const isCardValueVisible = card.value > 0;
                
                return (
                  <g key={idx} transform={`translate(10, ${22 + idx * 20})`}>
                    <rect
                      width={tooltipWidth - 20}
                      height={16}
                      rx="3"
                      className="fill-indigo-950/30 stroke-indigo-500/20 stroke"
                    />
                    <text
                      x="6"
                      y="11"
                      className={`text-[9px] font-bold ${
                        isCardValueVisible ? 'fill-indigo-200' : 'fill-neutral-500 font-normal italic'
                      }`}
                    >
                      {isCardValueVisible
                        ? `${formatCardValue(card.value)} (${card.value === 13 ? 'King' : card.value === 12 ? 'Queen' : card.value === 11 ? 'Jack' : 'Sol'})`
                        : 'Hidden (?)'}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
};
