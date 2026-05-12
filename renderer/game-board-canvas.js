import { loadSpriteSheet, resolveSpriteFrame } from './sprite-sheet.js';
import { resolveAnimationFrameName } from './animation-frame.js';
import { syncCanvasElementSize } from './canvas-size.js';
import { getCellBounds } from './render-grid.js';

export function createGameBoardCanvas({
  canvasEl,
  mapEl,
  getSession,
  getActivePlayerId,
  getSelectedSource,
  getPendingTarget,
  getSelectionPreviewTone,
  getCellSize,
  getViewportTransform,
  getTileSpriteSheetSource,
  getEntitySpriteSheetSource,
  normalizeTileKind,
  normalizeEntityKind,
  isTileRevealed
}) {
  const context = canvasEl?.getContext?.('2d') ?? null;
  const resizeObserver = typeof ResizeObserver !== 'undefined' && mapEl
    ? new ResizeObserver(() => {
        void render(getSession());
      })
    : null;

  let isDisposed = false;
  let renderToken = 0;
  let canvasSizeLocked = false;
  let engine = null;
  let engineReadyPromise = null;
  let selectionOverlayCacheKey = null;
  let selectionOverlaySource = null;

  const actorCache = new Map();
  const imageSourceCache = new Map();

  if (resizeObserver && mapEl) {
    resizeObserver.observe(mapEl);
  }

  return {
    render,
    dispose
  };

  function dispose() {
    isDisposed = true;
    resizeObserver?.disconnect();
    clearCanvasAndActors();

    if (engine) {
      try {
        engine.stop();
      } catch {
        // no-op cleanup guard
      }
    }

    engine = null;
    engineReadyPromise = null;
    imageSourceCache.clear();
    selectionOverlayCacheKey = null;
    selectionOverlaySource = null;
  }

  function render(session = getSession()) {
    if (!canvasEl || !context || !mapEl) {
      return Promise.resolve();
    }

    const token = renderToken + 1;
    renderToken = token;
    return drawSession(session, token);
  }

  async function drawSession(session, token) {
    const boardWidth = Number.isInteger(session?.boardWidth) && session.boardWidth > 0 ? session.boardWidth : 0;
    const boardHeight = Number.isInteger(session?.boardHeight) && session.boardHeight > 0 ? session.boardHeight : 0;

    if (boardWidth <= 0 || boardHeight <= 0) {
      clearCanvasAndActors();
      return;
    }

    const canvasSize = canvasSizeLocked
      ? { width: canvasEl.width, height: canvasEl.height }
      : syncCanvasElementSize(canvasEl, mapEl.getBoundingClientRect());
    canvasSizeLocked = true;
    forceCanvasPresentationSize();

    const width = canvasSize.width;
    const height = canvasSize.height;

    if (token !== renderToken) {
      return;
    }

    const renderEngine = await ensureEngineReady();
    if (!renderEngine || token !== renderToken || isDisposed) {
      return;
    }

    const boardOriginX = Number.isInteger(session?.boardOriginX) ? session.boardOriginX : 0;
    const boardOriginY = Number.isInteger(session?.boardOriginY) ? session.boardOriginY : 0;
    const pendingPlacement = session?.pendingPlacement ?? null;
    const cellSize = typeof getCellSize === 'function' ? getCellSize() : null;
    const viewportTransform = typeof getViewportTransform === 'function' ? getViewportTransform() : null;
    const activePlayerId = typeof getActivePlayerId === 'function' ? getActivePlayerId() : null;
    const selectedSource = typeof getSelectedSource === 'function' ? getSelectedSource() : null;
    const pendingTarget = typeof getPendingTarget === 'function' ? getPendingTarget() : null;
    const selectionPreviewTone = typeof getSelectionPreviewTone === 'function' ? getSelectionPreviewTone() : null;

    const activeKeys = new Set();
    const cells = Array.isArray(session?.board) ? session.board : [];
    const currentTimeMs = Date.now();
    let hasAnimatedSources = false;

    for (const cell of cells) {
      const x = Number.isInteger(cell?.x) ? cell.x : 0;
      const y = Number.isInteger(cell?.y) ? cell.y : 0;
      const bounds = transformBounds(getCellBounds({
        column: x,
        row: y,
        boardOriginX,
        boardOriginY,
        boardWidth,
        boardHeight,
        cellSize,
        canvasWidth: width,
        canvasHeight: height
      }), viewportTransform);

      const hasEntity = Boolean(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind);
      const entityId = cell?.entityId ?? cell?.occupantId ?? cell?.playerId ?? null;
      const entityKind = hasEntity ? normalizeEntityKind(cell?.entityKind || cell?.occupantKind || cell?.monsterKind || cell?.playerKind) : null;
      const isActivePlayerCell = hasEntity
        && entityKind === 'player'
        && activePlayerId !== null
        && activePlayerId !== undefined
        && String(entityId) === String(activePlayerId);
      const isSelectedSource = Boolean(
        selectedSource
        && Number(selectedSource.x) === x
        && Number(selectedSource.y) === y
        && isActivePlayerCell
      );

      if (isTileRevealed(session, x, y)) {
        const isPendingPlacementTarget = Boolean(
          pendingPlacement
          && Number(pendingPlacement.targetX) === x
          && Number(pendingPlacement.targetY) === y
        );
        const tileKind = normalizeTileKind(
          isPendingPlacementTarget
            ? pendingPlacement.tileKind
            : cell?.tileKind || cell?.kind || cell?.terrainKind
        );
        const tileOrientation = Number.isInteger(isPendingPlacementTarget ? pendingPlacement.tileOrientation : undefined)
          ? pendingPlacement.tileOrientation
          : Number.isInteger(cell?.tileOrientation)
            ? cell.tileOrientation
            : Number.isInteger(cell?.orientation)
              ? cell.orientation
              : 0;
        const tileSource = typeof getTileSpriteSheetSource === 'function'
          ? getTileSpriteSheetSource(tileKind, tileOrientation)
          : null;
        const tileImage = await getImageSource(tileSource, currentTimeMs);
        hasAnimatedSources = hasAnimatedSources || isAnimatedSource(tileSource);

        const tileKey = `tile:${x}:${y}`;
        const tileActor = createOrGetActor(renderEngine, tileKey, 10);
        applyImageActor(tileActor, tileImage, bounds);
        activeKeys.add(tileKey);
      }

      if (hasEntity) {
        const entityOrientation = resolveEntityOrientation(cell);
        const previewOrientation = isSelectedSource && Number.isInteger(selectedSource?.previewFacing)
          ? selectedSource.previewFacing
          : entityOrientation;
        const entitySource = typeof getEntitySpriteSheetSource === 'function'
          ? getEntitySpriteSheetSource(entityKind, {
              orientation: previewOrientation,
              selected: entityKind === 'player' && isSelectedSource,
              variant: 'char'
            })
          : null;
        const entityImage = await getImageSource(entitySource, currentTimeMs);
        hasAnimatedSources = hasAnimatedSources || isAnimatedSource(entitySource);

        const inset = Math.max(2, Math.round(Math.min(bounds.width, bounds.height) * 0.14));
        const entityBounds = {
          x: bounds.x + inset,
          y: bounds.y + inset,
          width: bounds.width - inset * 2,
          height: bounds.height - inset * 2
        };

        const entityKey = `entity:${x}:${y}`;
        const entityActor = createOrGetActor(renderEngine, entityKey, 20);
        applyImageActor(entityActor, entityImage, entityBounds);
        activeKeys.add(entityKey);
      }
    }

    if (pendingPlacement) {
      const previewTargetX = Number(pendingPlacement.targetX);
      const previewTargetY = Number(pendingPlacement.targetY);

      if (Number.isFinite(previewTargetX) && Number.isFinite(previewTargetY) && !isTileRevealed(session, previewTargetX, previewTargetY)) {
        const previewBounds = transformBounds(getCellBounds({
          column: previewTargetX,
          row: previewTargetY,
          boardOriginX,
          boardOriginY,
          boardWidth,
          boardHeight,
          cellSize,
          canvasWidth: width,
          canvasHeight: height
        }), viewportTransform);

        const previewTileKind = normalizeTileKind(pendingPlacement.tileKind);
        const previewTileOrientation = Number.isInteger(pendingPlacement.tileOrientation) ? pendingPlacement.tileOrientation : 0;
        const previewSource = typeof getTileSpriteSheetSource === 'function'
          ? getTileSpriteSheetSource(previewTileKind, previewTileOrientation)
          : null;
        const previewImage = await getImageSource(previewSource, currentTimeMs);
        hasAnimatedSources = hasAnimatedSources || isAnimatedSource(previewSource);

        const previewKey = `preview:pending:${previewTargetX}:${previewTargetY}`;
        const previewActor = createOrGetActor(renderEngine, previewKey, 30);
        applyImageActor(previewActor, previewImage, previewBounds);
        activeKeys.add(previewKey);
      }
    }

    if (selectedSource && pendingTarget) {
      const sourceBounds = tryGetBoundsForPoint({
        x: Number(selectedSource.x),
        y: Number(selectedSource.y),
        boardOriginX,
        boardOriginY,
        boardWidth,
        boardHeight,
        cellSize,
        width,
        height,
        viewportTransform
      });
      const targetBounds = tryGetBoundsForPoint({
        x: Number(pendingTarget.x),
        y: Number(pendingTarget.y),
        boardOriginX,
        boardOriginY,
        boardWidth,
        boardHeight,
        cellSize,
        width,
        height,
        viewportTransform
      });

      if (sourceBounds && targetBounds) {
        const overlayColor = selectionPreviewTone?.color || selectedSource.colorHex || '#14532d';
        const showPreviewBorder = selectionPreviewTone?.tone === 'green' && !isTileRevealed(session, pendingTarget.x, pendingTarget.y);
        const overlaySource = await getSelectionOverlayImageSource({
          width,
          height,
          sourceBounds,
          targetBounds,
          overlayColor,
          showPreviewBorder
        });

        const overlayActor = createOrGetActor(renderEngine, 'overlay:selection', 40);
        applyImageActor(overlayActor, overlaySource, {
          x: 0,
          y: 0,
          width,
          height
        });
        activeKeys.add('overlay:selection');
      }
    }

    pruneInactiveActors(activeKeys);

    if (hasAnimatedSources) {
      renderAnimatedSnapshot(session);
    }
  }

  function clearCanvas() {
    if (!canvasEl || !context) {
      return;
    }

    context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function forceCanvasPresentationSize() {
    if (!canvasEl) {
      return;
    }

    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.position = 'absolute';
    canvasEl.style.inset = '0';
  }

  function clearCanvasAndActors() {
    clearCanvas();
    for (const actor of actorCache.values()) {
      try {
        actor.kill?.();
      } catch {
        // no-op cleanup guard
      }
    }
    actorCache.clear();
  }

  async function ensureEngineReady() {
    if (isDisposed) {
      return null;
    }

    if (engine) {
      return engine;
    }

    if (engineReadyPromise) {
      return engineReadyPromise;
    }

    engineReadyPromise = createEngine().then((createdEngine) => {
      if (!createdEngine) {
        engineReadyPromise = null;
      }
      return createdEngine;
    });

    return engineReadyPromise;
  }

  async function createEngine() {
    const ex = globalThis.window?.ex;
    if (!ex || !canvasEl) {
      return null;
    }

    const createdEngine = new ex.Engine({
      canvasElement: canvasEl,
      displayMode: ex.DisplayMode?.FillContainer,
      suppressPlayButton: true,
      antialiasing: false
    });

    const scene = new ex.Scene();
    createdEngine.add('board', scene);
    createdEngine.goToScene('board');
    await createdEngine.start();
    forceCanvasPresentationSize();

    engine = createdEngine;
    return engine;
  }

  function createOrGetActor(renderEngine, key, zIndex) {
    const existing = actorCache.get(key);
    if (existing) {
      existing.z = zIndex;
      return existing;
    }

    const ex = globalThis.window?.ex;
    if (!ex) {
      return existing ?? null;
    }
    const actor = new ex.Actor({ x: 0, y: 0, width: 1, height: 1 });
    actor.z = zIndex;
    renderEngine.currentScene.add(actor);
    actorCache.set(key, actor);
    return actor;
  }

  function pruneInactiveActors(activeKeys) {
    for (const [key, actor] of actorCache.entries()) {
      if (activeKeys.has(key)) {
        continue;
      }

      try {
        actor.kill?.();
      } catch {
        // no-op cleanup guard
      }
      actorCache.delete(key);
    }
  }

  async function getImageSource(source, currentTimeMs = Date.now()) {
    const imageUrl = typeof source === 'string' ? source : String(source?.imageUrl || '');
    if (!imageUrl) {
      return null;
    }

    const ex = globalThis.window?.ex;
    if (!ex) {
      return null;
    }

    if (typeof source === 'string' || !source?.metadataUrl) {
      const staticKey = `static:${imageUrl}`;
      if (!imageSourceCache.has(staticKey)) {
        imageSourceCache.set(staticKey, loadImageSourceFromUrl(ex, imageUrl));
      }
      return imageSourceCache.get(staticKey);
    }

    const frameName = resolveFrameName(source, currentTimeMs);
    const frameKey = `frame:${imageUrl}|${source.metadataUrl}|${frameName}`;
    if (!imageSourceCache.has(frameKey)) {
      imageSourceCache.set(frameKey, loadImageSourceFromSheetFrame(ex, source, frameName));
    }

    return imageSourceCache.get(frameKey);
  }

  async function loadImageSourceFromUrl(ex, imageUrl) {
    const imageSource = new ex.ImageSource(imageUrl);
    await imageSource.load();
    return imageSource;
  }

  async function loadImageSourceFromSheetFrame(ex, source, frameName) {
    const sheet = await loadSpriteSheet(source);
    const frame = resolveSpriteFrame(sheet, frameName);
    const image = sheet?.image ?? null;
    if (!image || !frame) {
      return loadImageSourceFromUrl(ex, source.imageUrl);
    }

    const frameCanvas = createFrameCanvas(frame.sw, frame.sh);
    const frameContext = frameCanvas?.getContext?.('2d') ?? null;
    if (!frameContext) {
      return loadImageSourceFromUrl(ex, source.imageUrl);
    }

    frameContext.clearRect(0, 0, frame.sw, frame.sh);
    frameContext.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
    const dataUrl = frameCanvas.toDataURL('image/png');
    const imageSource = new ex.ImageSource(dataUrl);
    await imageSource.load();
    return imageSource;
  }

  function createFrameCanvas(width, height) {
    if (typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function resolveFrameName(source, currentTimeMs) {
    if (!source || typeof source !== 'object') {
      return 'default';
    }

    if (source.animation) {
      return resolveAnimationFrameName(source.animation, currentTimeMs);
    }

    return source.defaultFrameName || 'default';
  }

  function isAnimatedSource(source) {
    return Boolean(source?.animation?.frameNames?.length > 1);
  }

  function applyImageActor(actor, imageSource, bounds) {
    if (!actor || !imageSource || !bounds) {
      return;
    }

    const ex = globalThis.window?.ex;
    if (!ex) {
      return;
    }
    const sprite = imageSource.toSprite();
    actor.graphics.use(sprite);

    const baseWidth = Math.max(1, Number(sprite?.width) || Number(imageSource?.width) || 1);
    const baseHeight = Math.max(1, Number(sprite?.height) || Number(imageSource?.height) || 1);
    actor.pos = ex.vec(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    actor.scale = ex.vec(bounds.width / baseWidth, bounds.height / baseHeight);
  }

  function resolveEntityOrientation(cell) {
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

  function transformBounds(bounds, viewportTransform) {
    const topLeft = transformPoint({ x: bounds.x, y: bounds.y }, viewportTransform);
    const bottomRight = transformPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, viewportTransform);

    return {
      ...bounds,
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };
  }

  function transformPoint(point, viewportTransform) {
    const scale = Number.isFinite(viewportTransform?.scale) ? viewportTransform.scale : 1;
    const panX = Number.isFinite(viewportTransform?.panX) ? viewportTransform.panX : 0;
    const panY = Number.isFinite(viewportTransform?.panY) ? viewportTransform.panY : 0;

    return {
      x: (Number(point?.x) || 0) * scale + panX,
      y: (Number(point?.y) || 0) * scale + panY
    };
  }

  function tryGetBoundsForPoint({ x, y, boardOriginX, boardOriginY, boardWidth, boardHeight, cellSize, width, height, viewportTransform }) {
    const column = Number(x) - boardOriginX;
    const row = Number(y) - boardOriginY;
    if (!Number.isFinite(column) || !Number.isFinite(row) || column < 0 || row < 0 || column >= boardWidth || row >= boardHeight) {
      return null;
    }

    return transformBounds(getCellBounds({
      column: Number(x),
      row: Number(y),
      boardOriginX,
      boardOriginY,
      boardWidth,
      boardHeight,
      cellSize,
      canvasWidth: width,
      canvasHeight: height
    }), viewportTransform);
  }

  async function getSelectionOverlayImageSource({ width, height, sourceBounds, targetBounds, overlayColor, showPreviewBorder }) {
    const cacheKey = [
      width,
      height,
      Math.round(sourceBounds.x),
      Math.round(sourceBounds.y),
      Math.round(sourceBounds.width),
      Math.round(sourceBounds.height),
      Math.round(targetBounds.x),
      Math.round(targetBounds.y),
      Math.round(targetBounds.width),
      Math.round(targetBounds.height),
      String(overlayColor),
      showPreviewBorder ? '1' : '0'
    ].join('|');

    if (selectionOverlaySource && selectionOverlayCacheKey === cacheKey) {
      return selectionOverlaySource;
    }

    const imageUrl = renderSelectionOverlayToDataUrl({
      width,
      height,
      sourceBounds,
      targetBounds,
      overlayColor,
      showPreviewBorder
    });

    if (!imageUrl) {
      selectionOverlayCacheKey = null;
      selectionOverlaySource = null;
      return null;
    }

    const ex = globalThis.window?.ex;
    if (!ex) {
      return null;
    }

    const source = new ex.ImageSource(imageUrl);
    await source.load();

    selectionOverlayCacheKey = cacheKey;
    selectionOverlaySource = source;
    return source;
  }

  function renderSelectionOverlayToDataUrl({ width, height, sourceBounds, targetBounds, overlayColor, showPreviewBorder }) {
    if (typeof document === 'undefined' || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = Math.max(1, Math.round(width));
    overlayCanvas.height = Math.max(1, Math.round(height));
    const overlayContext = overlayCanvas.getContext('2d');
    if (!overlayContext) {
      return null;
    }

    drawSelectionArrowOverlay(overlayContext, sourceBounds, targetBounds, overlayColor);
    if (showPreviewBorder) {
      drawSelectionPreviewBorderOverlay(overlayContext, targetBounds, overlayColor);
    }

    return overlayCanvas.toDataURL('image/png');
  }

  function drawSelectionArrowOverlay(overlayContext, sourceBounds, targetBounds, color) {
    const sourceCenterX = sourceBounds.x + sourceBounds.width / 2;
    const sourceCenterY = sourceBounds.y + sourceBounds.height / 2;
    const targetCenterX = targetBounds.x + targetBounds.width / 2;
    const targetCenterY = targetBounds.y + targetBounds.height / 2;
    const arrowSize = Math.max(6, Math.min(sourceBounds.width, sourceBounds.height) * 0.16);

    overlayContext.save();
    overlayContext.strokeStyle = color;
    overlayContext.fillStyle = color;
    overlayContext.lineWidth = Math.max(2, Math.min(sourceBounds.width, sourceBounds.height) * 0.08);
    overlayContext.lineCap = 'round';
    overlayContext.setLineDash([Math.max(4, arrowSize * 1.4), Math.max(3, arrowSize)]);

    overlayContext.beginPath();
    overlayContext.moveTo(sourceCenterX, sourceCenterY);
    overlayContext.lineTo(targetCenterX, targetCenterY);
    overlayContext.stroke();

    overlayContext.setLineDash([]);
    const angle = Math.atan2(targetCenterY - sourceCenterY, targetCenterX - sourceCenterX);
    const tipX = targetCenterX;
    const tipY = targetCenterY;
    const baseX = tipX - Math.cos(angle) * arrowSize * 1.1;
    const baseY = tipY - Math.sin(angle) * arrowSize * 1.1;
    const leftX = baseX + Math.cos(angle + Math.PI / 2) * arrowSize * 0.7;
    const leftY = baseY + Math.sin(angle + Math.PI / 2) * arrowSize * 0.7;
    const rightX = baseX + Math.cos(angle - Math.PI / 2) * arrowSize * 0.7;
    const rightY = baseY + Math.sin(angle - Math.PI / 2) * arrowSize * 0.7;

    overlayContext.beginPath();
    overlayContext.moveTo(tipX, tipY);
    overlayContext.lineTo(leftX, leftY);
    overlayContext.lineTo(rightX, rightY);
    overlayContext.closePath();
    overlayContext.fill();
    overlayContext.restore();
  }

  function drawSelectionPreviewBorderOverlay(overlayContext, bounds, color) {
    overlayContext.save();
    overlayContext.strokeStyle = color;
    overlayContext.lineWidth = Math.max(2, Math.min(bounds.width, bounds.height) * 0.06);
    overlayContext.fillStyle = color;
    overlayContext.globalAlpha = 0.12;
    overlayContext.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    overlayContext.globalAlpha = 1;
    overlayContext.strokeRect(
      bounds.x + overlayContext.lineWidth / 2,
      bounds.y + overlayContext.lineWidth / 2,
      bounds.width - overlayContext.lineWidth,
      bounds.height - overlayContext.lineWidth
    );
    overlayContext.restore();
  }

  function renderAnimatedSnapshot(session) {
    if (!session) {
      return;
    }

    // Excalibur handles timing internally in the browser; this method exists
    // to preserve the public async render contract while keeping tests stable.
    void session;
  }
}
