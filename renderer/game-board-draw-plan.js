import { resolveAnimationFrameName } from './animation-frame.js';
import { getCellBounds, getGridLinePositions } from './render-grid.js';

export function buildGameBoardDrawPlan({
  session,
  boardWidth,
  boardHeight,
  canvasWidth,
  canvasHeight,
  currentTimeMs = 0,
  activePlayerId = null,
  selectedSource = null,
  isTileRevealed,
  normalizeTileKind,
  normalizeEntityKind,
  getTileSpriteSheetSource,
  getEntitySpriteSheetSource,
  getEntityOrientation
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

    const hasEntity = Boolean(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind);
    const entityId = cell?.entityId ?? cell?.occupantId ?? cell?.playerId ?? null;
    const entityKind = hasEntity ? normalizeEntityKind(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind) : null;
    const isActivePlayerCell = hasEntity && entityKind === 'player' && activePlayerId !== null && activePlayerId !== undefined && String(entityId) === String(activePlayerId);
    const isSelectedSource = Boolean(selectedSource && Number(selectedSource.x) === x && Number(selectedSource.y) === y && isActivePlayerCell);

    const isTileVisible = isTileRevealed(session, x, y);

    if (!isTileVisible) {
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

      if (!isActivePlayerCell) {
        continue;
      }
    } else {
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
    }

    if (hasEntity) {
      const inset = Math.max(2, Math.round(Math.min(bounds.width, bounds.height) * 0.14));
      const entityAnimation = cell?.entityAnimation || null;
      const entityFrameName = resolveAnimationFrameName(entityAnimation, currentTimeMs);
      const entityOrientation = resolveEntityOrientation({ cell, entityId, getEntityOrientation });
      const entitySpriteSource = typeof getEntitySpriteSheetSource === 'function'
        ? getEntitySpriteSheetSource(entityKind, {
            orientation: entityOrientation,
          selected: entityKind === 'player' && (isSelectedSource || isActivePlayerCell),
          variant: 'fallback'
          })
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
        entityKind,
        entityOrientation
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

function resolveEntityOrientation({ cell, entityId, getEntityOrientation }) {
  if (typeof getEntityOrientation === 'function') {
    const resolvedOrientation = getEntityOrientation(entityId, cell);
    if (Number.isInteger(resolvedOrientation)) {
      return ((resolvedOrientation % 4) + 4) % 4;
    }
  }

  const cellOrientation = Number.isInteger(cell?.entityOrientation)
    ? cell.entityOrientation
    : Number.isInteger(cell?.entityFacing)
      ? cell.entityFacing
      : Number.isInteger(cell?.facing)
        ? cell.facing
        : Number.isInteger(cell?.direction)
          ? cell.direction
          : Number.isInteger(cell?.movementDirection)
            ? cell.movementDirection
            : 0;

  return ((cellOrientation % 4) + 4) % 4;
}