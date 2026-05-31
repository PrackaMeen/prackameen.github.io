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
  const LONG_PRESS_MS = 320;
  const TAP_MOVE_TOLERANCE_PX = 12;
  let touchGesture = null;

  return {
    handleMapTouchStart,
    handleMapTouchMove,
    handleMapTouchEnd,
    handleMapTouchCancel,
    syncZoom,
    lockBoardCellSize,
    centerCameraOnActivePlayer,
    isCameraCenteredOnActivePlayer,
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
      if (state.activeTouchPoints.size === 1) {
        const touch = Array.from(event.changedTouches || [])[0];
        const point = touch ? getTouchPoint(touch) : Array.from(state.activeTouchPoints.values())[0];
        touchGesture = {
          kind: 'press',
          touchId: touch?.identifier ?? Array.from(state.activeTouchPoints.keys())[0],
          startTimeMs: Date.now(),
          startPoint: point,
          startPanX: state.panX,
          startPanY: state.panY,
          isPanActive: false,
          isTapCancelled: false
        };
      }
      return;
    }

    const points = Array.from(state.activeTouchPoints.values());
    if (points.length !== 2) {
      return;
    }

    touchGesture = {
      kind: 'pinch',
      touchId: null,
      startTimeMs: Date.now(),
      startPoint: null,
      startPanX: state.panX,
      startPanY: state.panY,
      pinchStartDistance: getPointerDistance(points[0], points[1]),
      pinchStartScale: state.zoomScale,
      pinchStartMidpoint: getPointerMidpoint(points[0], points[1]),
      pinchStartBoardPoint: getBoardPointAtClientPoint(getPointerMidpoint(points[0], points[1]), state.zoomScale, state.panX, state.panY)
    };
    state.gestureStartMidpoint = getPointerMidpoint(points[0], points[1]);
    state.pinchStartDistance = getPointerDistance(points[0], points[1]);
    state.pinchStartScale = state.zoomScale;
    state.pinchStartBoardPoint = getBoardPointAtClientPoint(getPointerMidpoint(points[0], points[1]), state.zoomScale, state.panX, state.panY);
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

    if (event.cancelable) {
      event.preventDefault();
    }

    if (state.activeTouchPoints.size === 2) {
      const points = Array.from(state.activeTouchPoints.values());
      if (points.length !== 2) {
        return;
      }

      const currentMidpoint = getPointerMidpoint(points[0], points[1]);
      const currentDistance = getPointerDistance(points[0], points[1]);
      if (currentDistance <= 0) {
        return;
      }

      touchGesture = touchGesture?.kind === 'pinch'
        ? touchGesture
        : {
            kind: 'pinch',
            touchId: null,
            startTimeMs: Date.now(),
            startPoint: null,
            startPanX: state.panX,
            startPanY: state.panY,
            pinchStartDistance: state.pinchStartDistance ?? currentDistance,
            pinchStartScale: state.zoomScale,
            pinchStartMidpoint: state.gestureStartMidpoint ?? currentMidpoint,
            pinchStartBoardPoint: state.pinchStartBoardPoint ?? getBoardPointAtClientPoint(currentMidpoint, state.zoomScale, state.panX, state.panY)
          };

      const pinchStartDistance = touchGesture.pinchStartDistance || currentDistance;
      const pinchStartScale = touchGesture.pinchStartScale ?? state.zoomScale;
      const pinchStartMidpoint = touchGesture.pinchStartMidpoint || currentMidpoint;
        const pinchStartBoardPoint = touchGesture.pinchStartBoardPoint || getBoardPointAtClientPoint(pinchStartMidpoint, pinchStartScale, touchGesture.startPanX, touchGesture.startPanY);
      const nextScale = clampScale(pinchStartScale * (currentDistance / pinchStartDistance));
        const nextPanX = currentMidpoint.clientX - pinchStartBoardPoint.boardX * nextScale;
        const nextPanY = currentMidpoint.clientY - pinchStartBoardPoint.boardY * nextScale;

      if (nextScale !== state.zoomScale) {
        state.zoomScale = nextScale;
        onZoomChanged?.();
      }

      if (nextPanX !== state.panX || nextPanY !== state.panY) {
        state.panX = nextPanX;
        state.panY = nextPanY;
        onViewportChanged?.();
      }

      syncZoom();
      return;
    }

    if (state.activeTouchPoints.size !== 1 || !touchGesture || touchGesture.kind !== 'press') {
      return;
    }

    const point = Array.from(state.activeTouchPoints.values())[0];
    if (!point) {
      return;
    }

    const elapsedMs = Date.now() - touchGesture.startTimeMs;
    const deltaX = point.clientX - touchGesture.startPoint.clientX;
    const deltaY = point.clientY - touchGesture.startPoint.clientY;
    const movedDistance = Math.hypot(deltaX, deltaY);

    if (!touchGesture.isPanActive) {
      if (movedDistance > TAP_MOVE_TOLERANCE_PX && elapsedMs < LONG_PRESS_MS) {
        touchGesture.isTapCancelled = true;
        return;
      }

      if (elapsedMs < LONG_PRESS_MS) {
        return;
      }

      touchGesture.isPanActive = true;
    }

    const nextPanX = touchGesture.startPanX + (point.clientX - touchGesture.startPoint.clientX);
    const nextPanY = touchGesture.startPanY + (point.clientY - touchGesture.startPoint.clientY);

    if (nextPanX !== state.panX || nextPanY !== state.panY) {
      state.panX = nextPanX;
      state.panY = nextPanY;
      onViewportChanged?.();
    }

    syncZoom();
  }

  function handleMapTouchEnd(event) {
    let tapPoint = null;

    for (const touch of Array.from(event.changedTouches || [])) {
      state.activeTouchPoints.delete(touch.identifier);
    }

    if (touchGesture?.kind === 'press' && state.activeTouchPoints.size === 0) {
      const elapsedMs = Date.now() - touchGesture.startTimeMs;
      const point = Array.from(event.changedTouches || []).map(getTouchPoint)[0] || touchGesture.startPoint;
      const movedDistance = point
        ? Math.hypot(point.clientX - touchGesture.startPoint.clientX, point.clientY - touchGesture.startPoint.clientY)
        : Number.POSITIVE_INFINITY;

      if (!touchGesture.isTapCancelled && !touchGesture.isPanActive && elapsedMs < LONG_PRESS_MS && movedDistance <= TAP_MOVE_TOLERANCE_PX) {
        tapPoint = point;
      }
    }

    if (state.activeTouchPoints.size < 2) {
      state.pinchStartDistance = null;
      state.pinchStartScale = state.zoomScale;
      state.gestureStartMidpoint = null;
      state.pinchStartBoardPoint = null;
    }

    if (state.activeTouchPoints.size === 0) {
      touchGesture = null;
    }

    return tapPoint ? { kind: 'tap', point: tapPoint } : null;
  }

  function handleMapTouchCancel(event) {
    const result = handleMapTouchEnd(event);
    touchGesture = null;
    return result;
  }

  function syncZoom() {
    if (!mapEl) {
      return;
    }

    mapEl.style.setProperty("--game-board-zoom", String(state.zoomScale));
    mapEl.style.setProperty("--game-board-pan-x", `${state.panX}px`);
    mapEl.style.setProperty("--game-board-pan-y", `${state.panY}px`);
  }

  function lockBoardCellSize(width, height) {
    if (!stageEl || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
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
    state.lockedBoardCellSize = nextCellSize;
    mapEl.style.setProperty("--game-cell-size", `${nextCellSize}px`);
  }

  function centerCameraOnActivePlayer(currentSession) {
    lockBoardCellSize(state.boardWidth, state.boardHeight);
    const centeredCamera = getCenteredCameraPan(currentSession);
    if (!centeredCamera) {
      return;
    }

    state.panX = centeredCamera.panX;
    state.panY = centeredCamera.panY;
    syncZoom();
    onViewportChanged?.();
  }

  function isCameraCenteredOnActivePlayer(currentSession) {
    const centeredCamera = getCenteredCameraPan(currentSession);
    if (!centeredCamera) {
      return true;
    }

    return Math.abs(state.panX - centeredCamera.panX) < 0.5 && Math.abs(state.panY - centeredCamera.panY) < 0.5;
  }

  function getBoardCellSize() {
    if (Number.isFinite(state.lockedBoardCellSize) && state.lockedBoardCellSize > 0) {
      return state.lockedBoardCellSize;
    }

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

  function getCenteredCameraPan(currentSession) {
    if (!stageEl || !mapEl) {
      return null;
    }

    const targetCell = getCameraTargetCell(currentSession);
    if (!targetCell) {
      return null;
    }

    const cellSize = getBoardCellSize();
    if (cellSize <= 0) {
      return null;
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

    return {
      panX: (paddingLeft + (contentWidth / 2)) - centeredLeft - (targetX * state.zoomScale),
      panY: (paddingTop + (contentHeight / 2)) - centeredTop - (targetY * state.zoomScale)
    };
  }

  function getBoardPointAtClientPoint(clientPoint, scale, panX, panY) {
    const boardRect = mapEl?.getBoundingClientRect?.();
    const fallbackRect = { left: 0, top: 0 };
    const rect = Number.isFinite(boardRect?.left) && Number.isFinite(boardRect?.top) ? boardRect : fallbackRect;
    const nextScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const nextPanX = Number.isFinite(panX) ? panX : 0;
    const nextPanY = Number.isFinite(panY) ? panY : 0;

    return {
      boardX: ((clientPoint?.clientX ?? 0) - rect.left - nextPanX) / nextScale,
      boardY: ((clientPoint?.clientY ?? 0) - rect.top - nextPanY) / nextScale
    };
  }
}
