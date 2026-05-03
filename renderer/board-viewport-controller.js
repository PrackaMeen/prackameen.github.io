import { clampScale, getPointerDistance, getPointerMidpoint, getTouchPoint } from './pointer-to-tile.js';

export function createBoardViewportController({
  state,
  mapEl,
  stageEl,
  canvasEl,
  onZoomChanged,
  onViewportChanged,
  onBoardStateChanged
}) {
  return {
    handleMapTouchStart,
    handleMapTouchMove,
    handleMapTouchEnd,
    handleMapTouchCancel,
    syncZoom,
    fitBoardToStage,
    centerCameraOnActivePlayer,
    getBoardCellSize,
    getCameraTargetCell
  };

  function handleMapTouchStart(event) {
    if (!canvasEl || !event.target || !canvasEl.contains(event.target)) {
      return;
    }

    for (const touch of Array.from(event.changedTouches || [])) {
      const point = getTouchPoint(touch);
      state.activeTouchPoints.set(touch.identifier, point);
    }

    if (state.activeTouchPoints.size !== 2) {
      return;
    }

    const points = Array.from(state.activeTouchPoints.values());
    if (points.length !== 2) {
      return;
    }

    state.gestureStartMidpoint = getPointerMidpoint(points[0], points[1]);
    state.pinchStartDistance = getPointerDistance(points[0], points[1]);
    state.pinchStartScale = state.zoomScale;
    state.gestureStartPanX = state.panX;
    state.gestureStartPanY = state.panY;
    state.feedback = "";
    onBoardStateChanged?.();
  }

  function handleMapTouchMove(event) {
    if (!canvasEl || !canvasEl.contains(event.target)) {
      return;
    }

    for (const touch of Array.from(event.changedTouches || [])) {
      state.activeTouchPoints.set(touch.identifier, getTouchPoint(touch));
    }

    if (state.activeTouchPoints.size !== 2 || state.pinchStartDistance === null) {
      return;
    }

    const points = Array.from(state.activeTouchPoints.values());
    if (points.length !== 2) {
      return;
    }

    const currentMidpoint = getPointerMidpoint(points[0], points[1]);
    const currentDistance = getPointerDistance(points[0], points[1]);
    if (currentDistance <= 0) {
      return;
    }

    const nextScale = clampScale(state.pinchStartScale * (currentDistance / state.pinchStartDistance));
    const nextPanX = state.gestureStartPanX + (currentMidpoint.clientX - state.gestureStartMidpoint.clientX);
    const nextPanY = state.gestureStartPanY + (currentMidpoint.clientY - state.gestureStartMidpoint.clientY);

    if (nextScale !== state.zoomScale) {
      state.zoomScale = nextScale;
      onZoomChanged?.();
    }

    if (nextPanX !== state.panX || nextPanY !== state.panY) {
      state.panX = nextPanX;
      state.panY = nextPanY;
      onZoomChanged?.();
    }

    syncZoom();

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  function handleMapTouchEnd(event) {
    for (const touch of Array.from(event.changedTouches || [])) {
      state.activeTouchPoints.delete(touch.identifier);
    }

    if (state.activeTouchPoints.size < 2) {
      state.pinchStartDistance = null;
      state.pinchStartScale = state.zoomScale;
      state.gestureStartMidpoint = null;
    }
  }

  function handleMapTouchCancel(event) {
    handleMapTouchEnd(event);
  }

  function syncZoom() {
    if (!mapEl) {
      return;
    }

    mapEl.style.setProperty("--game-board-zoom", String(state.zoomScale));
    mapEl.style.setProperty("--game-board-pan-x", `${state.panX}px`);
    mapEl.style.setProperty("--game-board-pan-y", `${state.panY}px`);
  }

  function fitBoardToStage(width, height) {
    if (!mapEl || !stageEl || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return;
    }

    const stageStyle = window.getComputedStyle(stageEl);
    const paddingLeft = Number.parseFloat(stageStyle.paddingLeft || "0") || 0;
    const paddingRight = Number.parseFloat(stageStyle.paddingRight || "0") || 0;
    const paddingTop = Number.parseFloat(stageStyle.paddingTop || "0") || 0;
    const paddingBottom = Number.parseFloat(stageStyle.paddingBottom || "0") || 0;
    const availableWidth = Math.max(0, stageEl.clientWidth - paddingLeft - paddingRight);
    const availableHeight = Math.max(0, stageEl.clientHeight - paddingTop - paddingBottom);
    const fitWidth = availableWidth / width;
    const fitHeight = availableHeight / height;
    const nextCellSize = Math.max(8, Math.floor(Math.min(fitWidth, fitHeight)));
    const boardPixelWidth = width * nextCellSize;
    const boardPixelHeight = height * nextCellSize;

    mapEl.style.setProperty("--game-cell-size", `${nextCellSize}px`);
    mapEl.style.width = `${boardPixelWidth}px`;
    mapEl.style.height = `${boardPixelHeight}px`;
  }

  function centerCameraOnActivePlayer(currentSession) {
    if (!stageEl || !mapEl) {
      return;
    }

    const targetCell = getCameraTargetCell(currentSession);
    if (!targetCell) {
      return;
    }

    const cellSize = getBoardCellSize();
    if (cellSize <= 0) {
      return;
    }

    const stageStyle = window.getComputedStyle(stageEl);
    const paddingLeft = Number.parseFloat(stageStyle.paddingLeft || "0") || 0;
    const paddingRight = Number.parseFloat(stageStyle.paddingRight || "0") || 0;
    const paddingTop = Number.parseFloat(stageStyle.paddingTop || "0") || 0;
    const paddingBottom = Number.parseFloat(stageStyle.paddingBottom || "0") || 0;
    const contentWidth = Math.max(0, stageEl.clientWidth - paddingLeft - paddingRight);
    const contentHeight = Math.max(0, stageEl.clientHeight - paddingTop - paddingBottom);
    const boardPixelWidth = state.boardWidth * cellSize;
    const boardPixelHeight = state.boardHeight * cellSize;
    const centeredLeft = paddingLeft + Math.max(0, (contentWidth - boardPixelWidth) / 2);
    const centeredTop = paddingTop;
    const targetX = (targetCell.x - state.boardOriginX + 0.5) * cellSize;
    const targetY = (targetCell.y - state.boardOriginY + 0.5) * cellSize;

    state.panX = (paddingLeft + (contentWidth / 2)) - centeredLeft - (targetX * state.zoomScale);
    state.panY = (paddingTop + (contentHeight / 2)) - centeredTop - (targetY * state.zoomScale);
    syncZoom();
  }

  function getBoardCellSize() {
    const rawValue = mapEl?.style.getPropertyValue("--game-cell-size") || "";
    const parsed = Number.parseFloat(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    const rect = mapEl?.getBoundingClientRect?.();
    const width = Number.isFinite(rect?.width) && state.boardWidth > 0 ? rect.width / state.boardWidth : 0;
    const height = Number.isFinite(rect?.height) && state.boardHeight > 0 ? rect.height / state.boardHeight : 0;

    return Math.max(width, height, 0);
  }

  function getCameraTargetCell(currentSession) {
    const cells = Array.isArray(currentSession?.board) ? currentSession.board : [];
    if (state.activePlayerId !== null && state.activePlayerId !== undefined) {
      const activeCell = cells.find((cell) => String(cell?.entityId ?? cell?.occupantId ?? "") === String(state.activePlayerId));
      if (activeCell && Number.isInteger(activeCell.x) && Number.isInteger(activeCell.y)) {
        return { x: activeCell.x, y: activeCell.y };
      }
    }

    const fallbackCell = cells.find((cell) => cell?.entityKind === "player" && Number.isInteger(cell.x) && Number.isInteger(cell.y));
    if (fallbackCell) {
      return { x: fallbackCell.x, y: fallbackCell.y };
    }

    return null;
  }
}
