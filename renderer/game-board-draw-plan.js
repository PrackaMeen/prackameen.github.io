import { getCellBounds, getGridLinePositions } from './render-grid.js';

export function buildGameBoardDrawPlan({
  session,
  boardWidth,
  boardHeight,
  canvasWidth,
  canvasHeight,
  isTileRevealed,
  normalizeTileKind,
  normalizeEntityKind,
  getTileAssetUrl,
  getEntityAssetUrl
}) {
  const cells = Array.isArray(session?.board) ? session.board : [];
  const plan = [];

  for (const cell of cells) {
    const x = Number.isInteger(cell?.x) ? cell.x : 0;
    const y = Number.isInteger(cell?.y) ? cell.y : 0;
    const bounds = getCellBounds({
      column: x,
      row: y,
      boardWidth,
      boardHeight,
      canvasWidth,
      canvasHeight
    });

    if (!isTileRevealed(session, x, y)) {
      plan.push({
        type: 'fill-cell',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fillStyle: 'rgba(255, 251, 245, 0.92)',
        column: x,
        row: y
      });
      continue;
    }

    const tileKind = normalizeTileKind(cell?.tileKind || cell?.kind || cell?.terrainKind);
    const tileOrientation = Number.isInteger(cell?.tileOrientation)
      ? cell.tileOrientation
      : Number.isInteger(cell?.orientation)
        ? cell.orientation
        : 0;

    plan.push({
      type: 'tile-sprite',
      frameName: 'default',
      source: getTileAssetUrl(tileKind, tileOrientation),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      column: x,
      row: y,
      tileKind,
      tileOrientation
    });

    const hasEntity = Boolean(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind);
    if (hasEntity) {
      const entityKind = normalizeEntityKind(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind);
      const inset = Math.max(2, Math.round(Math.min(bounds.width, bounds.height) * 0.14));

      plan.push({
        type: 'entity-sprite',
        frameName: 'default',
        source: getEntityAssetUrl(entityKind),
        x: bounds.x + inset,
        y: bounds.y + inset,
        width: bounds.width - inset * 2,
        height: bounds.height - inset * 2,
        column: x,
        row: y,
        entityKind
      });
    }
  }

  const gridLines = getGridLinePositions({ boardWidth, boardHeight, canvasWidth, canvasHeight });
  for (const y of gridLines.horizontal) {
    plan.push({ type: 'grid-line-horizontal', y });
  }
  for (const x of gridLines.vertical) {
    plan.push({ type: 'grid-line-vertical', x });
  }

  return plan;
}