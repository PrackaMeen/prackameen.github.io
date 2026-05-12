import { areOrthogonallyAdjacent, classifyTargetPreview } from './board-selection.js';
import { canExitTowardsTarget as canExitTowardsTargetHelper, canTraverseBetweenCells as canTraverseBetweenCellsHelper } from './board-movement.js';
import { getBoardPointFromPointer, getBoardPointFromWorld } from './pointer-to-tile.js';

export function createBoardInteractionController({
  state,
  canvasEl,
  getBoardCell,
  getActivePlayerName,
  isTileRevealed,
  getTileWalls,
  normalizeTileKind,
  isTargetEngaged,
  getWorldPointFromPointer,
  isCameraCentered,
  onCenterCamera,
  onConfirmSelection,
  onBoardStateChanged,
  onSelectionChanged
}) {
  return {
    handleBoardClick,
    clearSelection,
    isActivePlayerCell,
    isSelectedSource,
    isPendingTarget,
    applySelectionAccent,
    getSelectionPreviewColor,
    getSelectionPreviewMessage
  };

  function handleBoardClick(event) {
    if (state.pendingPlacement) {
      return;
    }

    const viewportTransform = {
      scale: Number.isFinite(state.zoomScale) ? state.zoomScale : 1,
      panX: Number.isFinite(state.panX) ? state.panX : 0,
      panY: Number.isFinite(state.panY) ? state.panY : 0
    };

    const worldPoint = typeof getWorldPointFromPointer === 'function' ? getWorldPointFromPointer(event) : null;
    const point = worldPoint
      ? getBoardPointFromWorld({
          boardWidth: state.boardWidth,
          boardHeight: state.boardHeight,
          boardOriginX: state.boardOriginX,
          boardOriginY: state.boardOriginY,
          cellSize: state.lockedBoardCellSize,
          worldX: worldPoint.x,
          worldY: worldPoint.y
        })
      : canvasEl
      ? getBoardPointFromPointer({
          boardRect: canvasEl.getBoundingClientRect(),
          boardWidth: state.boardWidth,
          boardHeight: state.boardHeight,
          boardOriginX: state.boardOriginX,
          boardOriginY: state.boardOriginY,
          cellSize: state.lockedBoardCellSize,
          viewportTransform,
          clientX: event.clientX,
          clientY: event.clientY
        })
      : null;

    if (!point) {
      return;
    }

    const { x, y } = point;

    if (state.selectedSource && state.pendingTarget && state.pendingTarget.x === x && state.pendingTarget.y === y && state.selectionPreviewTone?.tone === 'green') {
      onConfirmSelection?.();
      return;
    }

    const cell = getBoardCell(state.session, x, y);
    if (!cell) {
      return;
    }

    const entityKind = cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind || "";
    const entityId = cell.entityId ?? cell.occupantId ?? cell.playerId ?? null;

    if (entityKind === "player" && isActivePlayerCell(entityId, state.activePlayerId)) {
      if (state.selectedSource && state.selectedSource.x === x && state.selectedSource.y === y && !state.pendingTarget) {
        if (typeof isCameraCentered === 'function' && typeof onCenterCamera === 'function' && !isCameraCentered()) {
          onCenterCamera();
          return;
        }

        clearSelection();
        return;
      }

      state.selectedSource = {
        x,
        y,
        entityId,
        name: cell.entityName || getActivePlayerName(),
        colorHex: cell.entityColorHex || null,
        previewFacing: null
      };
      state.pendingTarget = null;
      state.selectionPreviewTone = { tone: "green", color: "#14532d", message: "" };
      state.feedback = "";
      onSelectionChanged?.();
      onBoardStateChanged?.();
      return;
    }

    if (!state.selectedSource) {
      return;
    }

    state.selectionPreviewTone = classifyTargetPreview({
      currentSession: state.session,
      source: state.selectedSource,
      target: { x, y },
      isTileRevealed,
      getBoardCell,
      canExitTowardsTarget: (fromCell, sourcePoint, targetPoint) => canExitTowardsTargetHelper(fromCell, sourcePoint, targetPoint, {
        normalizeTileKind,
        getTileWalls,
        areOrthogonallyAdjacent
      }),
      canTraverseBetweenCells: (fromCell, toCell) => canTraverseBetweenCellsHelper(fromCell, toCell, {
        normalizeTileKind,
        getTileWalls
      }),
      isTargetEngaged
    });
    state.pendingTarget = { x, y };
    state.selectedSource.previewFacing = state.selectionPreviewTone?.tone === "green"
      ? resolveFacingFromSelection(state.selectedSource, state.pendingTarget)
      : null;
    state.feedback = state.selectionPreviewTone.message;
    onSelectionChanged?.();
    onBoardStateChanged?.();

    console.log({ state, normalizeTileKind, getTileWalls, areOrthogonallyAdjacent, canExitTowardsTargetHelper, canTraverseBetweenCellsHelper });
  }

  function clearSelection() {
    state.selectedSource = null;
    state.pendingTarget = null;
    state.selectionPreviewTone = null;
    onSelectionChanged?.();
  }

  function isSelectedSource(x, y) {
    return Boolean(state.selectedSource && state.selectedSource.x === x && state.selectedSource.y === y);
  }

  function isPendingTarget(x, y) {
    return Boolean(state.pendingTarget && state.pendingTarget.x === x && state.pendingTarget.y === y);
  }

  function applySelectionAccent(tile) {
    const color = getSelectionPreviewColor();
    tile.style.setProperty("--selection-accent", color);
  }

  function getSelectionPreviewColor() {
    if (state.selectionPreviewTone && typeof state.selectionPreviewTone === "object") {
      return state.selectionPreviewTone.color || state.selectedSource?.colorHex || "#14532d";
    }

    return state.selectedSource?.colorHex || "#14532d";
  }

  function getSelectionPreviewMessage() {
    return state.selectionPreviewTone?.message || "";
  }
}

function resolveFacingFromSelection(source, target) {
  if (!Number.isInteger(source?.x) || !Number.isInteger(source?.y) || !Number.isInteger(target?.x) || !Number.isInteger(target?.y)) {
    return null;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 3 : 1;
  }

  return dy >= 0 ? 0 : 2;
}

function isActivePlayerCell(entityId, activePlayerId) {
  if (entityId === null || entityId === undefined || activePlayerId === null || activePlayerId === undefined) {
    return false;
  }

  return String(entityId) === String(activePlayerId);
}
