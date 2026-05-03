import { areOrthogonallyAdjacent, classifyTargetPreview } from './board-selection.js';
import { canExitTowardsTarget as canExitTowardsTargetHelper, canTraverseBetweenCells as canTraverseBetweenCellsHelper } from './board-movement.js';
import { getBoardPointFromPointer } from './pointer-to-tile.js';

export function createBoardInteractionController({
  state,
  canvasEl,
  getBoardCell,
  getActivePlayerName,
  isTileRevealed,
  getTileWalls,
  normalizeTileKind,
  isTargetEngaged,
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

    const point = canvasEl
      ? getBoardPointFromPointer({
          boardRect: canvasEl.getBoundingClientRect(),
          boardWidth: state.boardWidth,
          boardHeight: state.boardHeight,
          boardOriginX: state.boardOriginX,
          boardOriginY: state.boardOriginY,
          clientX: event.clientX,
          clientY: event.clientY
        })
      : null;

    if (!point) {
      return;
    }

    const { x, y } = point;
    const cell = getBoardCell(state.session, x, y);
    if (!cell) {
      return;
    }

    const entityKind = cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind || "";
    const entityId = cell.entityId ?? cell.occupantId ?? cell.playerId ?? null;

    if (entityKind === "player" && isActivePlayerCell(entityId, state.activePlayerId)) {
      if (state.selectedSource && state.selectedSource.x === x && state.selectedSource.y === y && !state.pendingTarget) {
        clearSelection();
        return;
      }

      state.selectedSource = {
        x,
        y,
        entityId,
        name: cell.entityName || getActivePlayerName(),
        colorHex: cell.entityColorHex || null
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
    state.feedback = state.selectionPreviewTone.message;
    onSelectionChanged?.();
    onBoardStateChanged?.();
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

function isActivePlayerCell(entityId, activePlayerId) {
  if (entityId === null || entityId === undefined || activePlayerId === null || activePlayerId === undefined) {
    return false;
  }

  return String(entityId) === String(activePlayerId);
}
