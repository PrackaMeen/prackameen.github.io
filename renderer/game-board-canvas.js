import { loadSpriteSheet, resolveSpriteFrame } from './sprite-sheet.js';
import { syncCanvasElementSize } from './canvas-size.js';
import { getCellBounds } from './render-grid.js';
import { resolveAnimationFrameName } from './animation-frame.js';

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
  let animationFrameHandle = null;
  let animationSession = null;
  let selectionOverlayCacheKey = null;
  let selectionOverlaySource = null;

  const actorCache = new Map();
  const graphicCache = new Map();
  const assetSourceCache = new Map();

  if (resizeObserver && mapEl) {
    resizeObserver.observe(mapEl);
  }

  return {
    render,
    dispose,
    syncCamera,
    getEngine: () => engine
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

    if (typeof window !== 'undefined' && window.__GAME_BOARD_ENGINE__ === engine) {
      delete window.__GAME_BOARD_ENGINE__;
    }

    engine = null;
    engineReadyPromise = null;
    cancelAnimatedRenderLoop();
    graphicCache.clear();
    assetSourceCache.clear();
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
      cancelAnimatedRenderLoop();
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

    if (typeof window !== 'undefined') {
      const previous = Number(window.__GAME_BOARD_RENDER_COUNT__) || 0;
      window.__GAME_BOARD_RENDER_COUNT__ = previous + 1;
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
    applyCameraViewport(renderEngine, width, height, viewportTransform);

    const activeKeys = new Set();
    const cells = Array.isArray(session?.board) ? session.board : [];
    const currentTimeMs = Date.now();
    let hasAnimatedSources = false;

    for (const cell of cells) {
      const x = Number.isInteger(cell?.x) ? cell.x : 0;
      const y = Number.isInteger(cell?.y) ? cell.y : 0;
      const bounds = getCellBounds({
        column: x,
        row: y,
        boardOriginX,
        boardOriginY,
        boardWidth,
        boardHeight,
        cellSize,
        canvasWidth: width,
        canvasHeight: height
      });

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
        const tileGraphic = await getGraphicSource(tileSource, currentTimeMs);
        hasAnimatedSources = hasAnimatedSources || isAnimatedSource(tileSource);
        const tileKey = `tile:${x}:${y}`;
        const tileActor = createOrGetActor(renderEngine, tileKey, 10);
        applyGraphicActor(tileActor, tileGraphic, bounds);
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
        const entityGraphic = await getGraphicSource(entitySource, currentTimeMs);
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
        applyGraphicActor(entityActor, entityGraphic, entityBounds);
        activeKeys.add(entityKey);
      }
    }

    if (pendingPlacement) {
      const previewTargetX = Number(pendingPlacement.targetX);
      const previewTargetY = Number(pendingPlacement.targetY);

      if (Number.isFinite(previewTargetX) && Number.isFinite(previewTargetY) && !isTileRevealed(session, previewTargetX, previewTargetY)) {
        const previewBounds = getCellBounds({
          column: previewTargetX,
          row: previewTargetY,
          boardOriginX,
          boardOriginY,
          boardWidth,
          boardHeight,
          cellSize,
          canvasWidth: width,
          canvasHeight: height
        });

        const previewTileKind = normalizeTileKind(pendingPlacement.tileKind);
        const previewTileOrientation = Number.isInteger(pendingPlacement.tileOrientation) ? pendingPlacement.tileOrientation : 0;
        const previewSource = typeof getTileSpriteSheetSource === 'function'
          ? getTileSpriteSheetSource(previewTileKind, previewTileOrientation)
          : null;
        const previewGraphic = await getGraphicSource(previewSource, currentTimeMs);
        hasAnimatedSources = hasAnimatedSources || isAnimatedSource(previewSource);

        const previewKey = `preview:pending:${previewTargetX}:${previewTargetY}`;
        const previewActor = createOrGetActor(renderEngine, previewKey, 30);
        applyGraphicActor(previewActor, previewGraphic, previewBounds);
        activeKeys.add(previewKey);
      }
    }

    if (selectedSource && pendingTarget) {
      const sourceBounds = getCellBounds({
        column: selectedSource.x,
        row: selectedSource.y,
        boardOriginX,
        boardOriginY,
        boardWidth,
        boardHeight,
        cellSize,
        canvasWidth: width,
        canvasHeight: height
      });
      const targetBounds = getCellBounds({
        column: pendingTarget.x,
        row: pendingTarget.y,
        boardOriginX,
        boardOriginY,
        boardWidth,
        boardHeight,
        cellSize,
        canvasWidth: width,
        canvasHeight: height
      });

      if (sourceBounds && targetBounds) {
        const overlayColor = selectionPreviewTone?.color || selectedSource.colorHex || '#14532d';
        const showPreviewBorder = selectionPreviewTone?.tone === 'green' && !isTileRevealed(session, pendingTarget.x, pendingTarget.y);
        const overlaySource = await getSelectionOverlayGraphic({
          width,
          height,
          sourceBounds,
          targetBounds,
          overlayColor,
          showPreviewBorder
        });

        const overlayActor = createOrGetActor(renderEngine, 'overlay:selection', 40);
        applyGraphicActor(overlayActor, overlaySource, {
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
    } else {
      cancelAnimatedRenderLoop();
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
      antialiasing: false,
      pixelRatio: 1,
      suppressHiDPIScaling: true
    });

    const scene = new ex.Scene();
    createdEngine.add('board', scene);
    createdEngine.goToScene('board');
    await createdEngine.start();
    if (typeof window !== 'undefined') {
      window.__GAME_BOARD_ENGINE__ = createdEngine;
    }
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

  async function getGraphicSource(source, currentTimeMs = Date.now()) {
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
      if (!graphicCache.has(staticKey)) {
        graphicCache.set(staticKey, loadGraphicFromUrl(ex, imageUrl));
      }
      return graphicCache.get(staticKey);
    }

    const frameName = resolveAnimationFrameName(source?.animation, currentTimeMs);
    const animationKey = `animation:${imageUrl}|${source.metadataUrl}|${source.animation?.frameNames?.join(',') || 'default'}|${frameName}`;
    if (!graphicCache.has(animationKey)) {
      graphicCache.set(animationKey, loadGraphicFromSheet(ex, source, frameName));
    }

    return graphicCache.get(animationKey);
  }

  async function loadGraphicFromUrl(ex, imageUrl) {
    const imageSource = await loadExcaliburImageSource(ex, imageUrl);
    return imageSource.toSprite();
  }

  async function loadGraphicFromSheet(ex, source, resolvedFrameName = null) {
    const sheet = await loadSpriteSheet(source);
    const imageSource = await loadExcaliburImageSource(ex, source.imageUrl);
    if (!imageSource || !sheet?.image) {
      return loadGraphicFromUrl(ex, source.imageUrl);
    }

    const animation = source?.animation;
    const frameNames = Array.isArray(animation?.frameNames) && animation.frameNames.length
      ? animation.frameNames
      : [source?.defaultFrameName || 'default'];

    const frameName = resolvedFrameName || frameNames[0];
    const frame = resolveSpriteFrame(sheet, frameName);
    if (!frame) {
      return loadGraphicFromUrl(ex, source.imageUrl);
    }

    return imageSource.toSprite({
      sourceView: {
        x: frame.sx,
        y: frame.sy,
        width: frame.sw,
        height: frame.sh
      }
    });
  }

  async function loadExcaliburImageSource(ex, imageUrl) {
    const cacheKey = `asset:${imageUrl}`;
    if (!assetSourceCache.has(cacheKey)) {
      assetSourceCache.set(cacheKey, (async () => {
        const imageSource = new ex.ImageSource(imageUrl);
        await imageSource.load();
        return imageSource;
      })());
    }

    return assetSourceCache.get(cacheKey);
  }

  function isAnimatedSource(source) {
    return Boolean(source?.animation?.frameNames?.length > 1);
  }

  function applyGraphicActor(actor, graphic, bounds) {
    if (!actor || !graphic || !bounds) {
      return;
    }

    const ex = globalThis.window?.ex;
    if (!ex) {
      return;
    }
    actor.graphics.use(graphic);

    const baseWidth = Math.max(1, Number(graphic?.width) || Number(graphic?.sourceView?.width) || Number(graphic?.destSize?.width) || 1);
    const baseHeight = Math.max(1, Number(graphic?.height) || Number(graphic?.sourceView?.height) || Number(graphic?.destSize?.height) || 1);
    actor.pos = ex.vec(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    actor.scale = ex.vec(bounds.width / baseWidth, bounds.height / baseHeight);
  }

  function syncCamera(viewportTransform, width, height) {
    if (!engine) {
      return;
    }

    const safeWidth = Math.max(1, Number(width) || canvasEl?.width || 1);
    const safeHeight = Math.max(1, Number(height) || canvasEl?.height || 1);
    applyCameraViewport(engine, safeWidth, safeHeight, viewportTransform);
  }

  function applyCameraViewport(renderEngine, width, height, viewportTransform) {
    const ex = globalThis.window?.ex;
    const camera = renderEngine?.currentScene?.camera;
    if (!ex || !camera) {
      return;
    }

    const scale = Number.isFinite(viewportTransform?.scale) && viewportTransform.scale > 0 ? viewportTransform.scale : 1;
    const panX = Number.isFinite(viewportTransform?.panX) ? viewportTransform.panX : 0;
    const panY = Number.isFinite(viewportTransform?.panY) ? viewportTransform.panY : 0;
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);

    camera.zoom = scale;
    camera.pos = ex.vec((safeWidth / 2 - panX) / scale, (safeHeight / 2 - panY) / scale);
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

  function tryGetBoundsForPoint({ x, y, boardOriginX, boardOriginY, boardWidth, boardHeight, cellSize, width, height }) {
    const column = Number(x) - boardOriginX;
    const row = Number(y) - boardOriginY;
    if (!Number.isFinite(column) || !Number.isFinite(row) || column < 0 || row < 0 || column >= boardWidth || row >= boardHeight) {
      return null;
    }

    return getCellBounds({
      column: Number(x),
      row: Number(y),
      boardOriginX,
      boardOriginY,
      boardWidth,
      boardHeight,
      cellSize,
      canvasWidth: width,
      canvasHeight: height
    });
  }

  async function getSelectionOverlayGraphic({ width, height, sourceBounds, targetBounds, overlayColor, showPreviewBorder }) {
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
    return source.toSprite();
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

    animationSession = session;
    if (animationFrameHandle !== null) {
      return;
    }

    animationFrameHandle = requestFrame(() => {
      animationFrameHandle = null;

      if (isDisposed) {
        return;
      }

      const nextSession = animationSession || getSession?.() || session;
      void render(nextSession).catch(() => undefined);
    });
  }

  function cancelAnimatedRenderLoop() {
    animationSession = null;

    if (animationFrameHandle !== null) {
      cancelFrame(animationFrameHandle);
      animationFrameHandle = null;
    }
  }

  function requestFrame(callback) {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }

    return setTimeout(callback, 16);
  }

  function cancelFrame(handle) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle);
      return;
    }

    clearTimeout(handle);
  }
}
