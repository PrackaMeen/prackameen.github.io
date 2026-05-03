import { resolveAnimationFrameName } from './animation-frame.js';
import { getCellBounds, getGridLinePositions } from './render-grid.js';

export function buildGameBoardDrawPlan({
  session,
  boardWidth,
  boardHeight,
  canvasWidth,
  canvasHeight,
  currentTimeMs = 0,
  isTileRevealed,
  normalizeTileKind,
  normalizeEntityKind,
  getTileSpriteSheetSource,
  getEntitySpriteSheetSource
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
    const tileSpriteSource = typeof getTileSpriteSheetSource === 'function'
      ? getTileSpriteSheetSource(tileKind, tileOrientation)
      : null;
    const tileFrameAnimation = cell?.tileAnimation || tileSpriteSource?.animation || null;
    const tileFrameName = resolveAnimationFrameName(tileFrameAnimation, currentTimeMs);

    plan.push({
      type: 'tile-sprite',
      frameName: tileFrameName,
      animated: Boolean(tileFrameAnimation?.frameNames?.length > 1),
      source: tileSpriteSource,
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
      const entityAnimation = cell?.entityAnimation || null;
      const entityFrameName = resolveAnimationFrameName(entityAnimation, currentTimeMs);
      const entitySpriteSource = typeof getEntitySpriteSheetSource === 'function'
        ? getEntitySpriteSheetSource(entityKind)
        : null;

      plan.push({
        type: 'entity-sprite',
        frameName: entityFrameName,
        animated: Boolean(entityAnimation?.frameNames?.length > 1),
        source: entitySpriteSource,
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