import { getCellBounds } from './render-grid.js';
import { syncCanvasElementSize } from './canvas-size.js';
import { createOnDemandRenderLoop } from './render-loop.js';

export function createGameBoardOverlayCanvas({
  canvasEl,
  mapEl,
  getSession,
  getOverlayState,
  getCellSize,
  getHiddenTileAssetUrl,
  isTileRevealed
}) {
  const context = canvasEl?.getContext?.("2d") ?? null;
  const renderLoop = createOnDemandRenderLoop();
  const resizeObserver = typeof ResizeObserver !== "undefined" && mapEl
    ? new ResizeObserver(() => {
        render(getSession());
      })
    : null;
  const hiddenTileImage = typeof Image !== "undefined" ? new Image() : null;
  let hiddenTileSource = null;
  let hiddenTileLoadPromise = null;
  let renderToken = 0;
  let canvasSizeLocked = false;

  if (resizeObserver && mapEl) {
    resizeObserver.observe(mapEl);
  }

  return {
    render,
    dispose
  };

  function dispose() {
    resizeObserver?.disconnect();
    renderLoop.cancel();
  }

  function render(session = getSession()) {
    if (!canvasEl || !context || !mapEl) {
      return Promise.resolve();
    }

    const token = renderToken + 1;
    renderToken = token;
    return renderLoop.schedule(() => drawSession(session, getOverlayState?.() ?? null, token));
  }

  async function drawSession(session, overlayState, token) {
    const boardWidth = Number.isInteger(session?.boardWidth) && session.boardWidth > 0 ? session.boardWidth : 0;
    const boardHeight = Number.isInteger(session?.boardHeight) && session.boardHeight > 0 ? session.boardHeight : 0;

    if (boardWidth <= 0 || boardHeight <= 0) {
      clearCanvas();
      return;
    }

    const canvasSize = canvasSizeLocked
      ? { width: canvasEl.width, height: canvasEl.height }
      : syncCanvasElementSize(canvasEl, mapEl.getBoundingClientRect());
    canvasSizeLocked = true;
    const width = canvasSize.width;
    const height = canvasSize.height;

    if (token !== renderToken) {
      return;
    }

    clearCanvas();

    const selectedSource = overlayState?.selectedSource ?? null;
    const pendingTarget = overlayState?.pendingTarget ?? null;
    const previewTone = overlayState?.selectionPreviewTone ?? null;
    const viewportScale = Number.isFinite(overlayState?.viewportScale) ? overlayState.viewportScale : 1;
    const viewportPanX = Number.isFinite(overlayState?.viewportPanX) ? overlayState.viewportPanX : 0;
    const viewportPanY = Number.isFinite(overlayState?.viewportPanY) ? overlayState.viewportPanY : 0;

    if (!selectedSource || !pendingTarget) {
      return;
    }

    const sourceBounds = getCellBoundsAtPoint({
      boardWidth,
      boardHeight,
      canvasWidth: width,
      canvasHeight: height,
      cellSize: typeof getCellSize === 'function' ? getCellSize() : null,
      boardOriginX: Number.isInteger(overlayState?.boardOriginX) ? overlayState.boardOriginX : 0,
      boardOriginY: Number.isInteger(overlayState?.boardOriginY) ? overlayState.boardOriginY : 0,
      x: selectedSource.x,
      y: selectedSource.y,
      viewportScale,
      viewportPanX,
      viewportPanY
    });
    const targetBounds = getCellBoundsAtPoint({
      boardWidth,
      boardHeight,
      canvasWidth: width,
      canvasHeight: height,
      cellSize: typeof getCellSize === 'function' ? getCellSize() : null,
      boardOriginX: Number.isInteger(overlayState?.boardOriginX) ? overlayState.boardOriginX : 0,
      boardOriginY: Number.isInteger(overlayState?.boardOriginY) ? overlayState.boardOriginY : 0,
      x: pendingTarget.x,
      y: pendingTarget.y,
      viewportScale,
      viewportPanX,
      viewportPanY
    });

    if (!sourceBounds || !targetBounds) {
      return;
    }

    const overlayColor = previewTone?.color || selectedSource.colorHex || "#14532d";
    drawSelectionArrow(sourceBounds, targetBounds, overlayColor);

    if (previewTone?.tone === "green" && !isTileRevealedTarget(session, pendingTarget.x, pendingTarget.y)) {
      await drawHiddenTilePreview(targetBounds, token);
      if (token !== renderToken) {
        return;
      }
      drawPreviewBorder(targetBounds, overlayColor);
    }
  }

  function clearCanvas() {
    if (!canvasEl || !context) {
      return;
    }

    context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function drawSelectionArrow(sourceBounds, targetBounds, color) {
    const sourceCenterX = sourceBounds.x + sourceBounds.width / 2;
    const sourceCenterY = sourceBounds.y + sourceBounds.height / 2;
    const targetCenterX = targetBounds.x + targetBounds.width / 2;
    const targetCenterY = targetBounds.y + targetBounds.height / 2;
    const arrowSize = Math.max(6, Math.min(sourceBounds.width, sourceBounds.height) * 0.16);

    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = Math.max(2, Math.min(sourceBounds.width, sourceBounds.height) * 0.08);
    context.lineCap = "round";
    context.setLineDash([Math.max(4, arrowSize * 1.4), Math.max(3, arrowSize)]);

    context.beginPath();
    context.moveTo(sourceCenterX, sourceCenterY);
    context.lineTo(targetCenterX, targetCenterY);
    context.stroke();

    context.setLineDash([]);
    const angle = Math.atan2(targetCenterY - sourceCenterY, targetCenterX - sourceCenterX);
    const tipX = targetCenterX;
    const tipY = targetCenterY;
    const baseX = tipX - Math.cos(angle) * arrowSize * 1.1;
    const baseY = tipY - Math.sin(angle) * arrowSize * 1.1;
    const leftX = baseX + Math.cos(angle + Math.PI / 2) * arrowSize * 0.7;
    const leftY = baseY + Math.sin(angle + Math.PI / 2) * arrowSize * 0.7;
    const rightX = baseX + Math.cos(angle - Math.PI / 2) * arrowSize * 0.7;
    const rightY = baseY + Math.sin(angle - Math.PI / 2) * arrowSize * 0.7;

    context.beginPath();
    context.moveTo(tipX, tipY);
    context.lineTo(leftX, leftY);
    context.lineTo(rightX, rightY);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawPreviewBorder(bounds, color) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = Math.max(2, Math.min(bounds.width, bounds.height) * 0.06);
    context.fillStyle = color;
    context.globalAlpha = 0.12;
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.globalAlpha = 1;
    context.strokeRect(bounds.x + context.lineWidth / 2, bounds.y + context.lineWidth / 2, bounds.width - context.lineWidth, bounds.height - context.lineWidth);
    context.restore();
  }

  async function drawHiddenTilePreview(bounds, token) {
    const image = await ensureHiddenTileImage();
    if (token !== renderToken) {
      return;
    }

    context.save();
    if (image) {
      context.globalAlpha = 0.94;
      context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
    } else {
      context.fillStyle = "rgba(255, 251, 245, 0.94)";
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    context.restore();
  }

  function ensureHiddenTileImage() {
    if (!hiddenTileImage || typeof getHiddenTileAssetUrl !== "function") {
      return Promise.resolve(null);
    }

    const source = getHiddenTileAssetUrl();
    if (!source) {
      return Promise.resolve(null);
    }

    if (source !== hiddenTileSource) {
      hiddenTileSource = source;
      hiddenTileLoadPromise = new Promise((resolve) => {
        hiddenTileImage.onload = () => resolve(hiddenTileImage);
        hiddenTileImage.onerror = () => resolve(null);
      });
      hiddenTileImage.src = source;
    }

    return hiddenTileLoadPromise ?? Promise.resolve(hiddenTileImage);
  }

  function isTileRevealedTarget(currentSession, x, y) {
    if (typeof isTileRevealed === "function") {
      return Boolean(isTileRevealed(currentSession, x, y));
    }

    const cells = Array.isArray(currentSession?.board) ? currentSession.board : [];
    const cell = cells.find((entry) => Number(entry?.x) === Number(x) && Number(entry?.y) === Number(y)) || null;
    return Boolean(cell && (cell.revealed === true || cell.isRevealed === true));
  }

  function getCellBoundsAtPoint({ boardWidth, boardHeight, canvasWidth, canvasHeight, cellSize, boardOriginX, boardOriginY, x, y, viewportScale, viewportPanX, viewportPanY }) {
    const column = Number(x) - boardOriginX;
    const row = Number(y) - boardOriginY;

    if (!Number.isFinite(column) || !Number.isFinite(row) || column < 0 || row < 0 || column >= boardWidth || row >= boardHeight) {
      return null;
    }

    const baseBounds = getCellBounds({ column, row, boardWidth, boardHeight, canvasWidth, canvasHeight, cellSize });
    const scale = Number.isFinite(viewportScale) ? viewportScale : 1;
    const panX = Number.isFinite(viewportPanX) ? viewportPanX : 0;
    const panY = Number.isFinite(viewportPanY) ? viewportPanY : 0;

    return {
      ...baseBounds,
      x: baseBounds.x * scale + panX,
      y: baseBounds.y * scale + panY,
      width: baseBounds.width * scale,
      height: baseBounds.height * scale
    };
  }
}