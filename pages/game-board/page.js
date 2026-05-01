import { createDefaultRoomApiClient } from "../../session/RoomApiClient.js";

let gameWasmLoadPromise = null;

export async function mountPage(context) {
  context.setTitle("Game");

  const {
    applyTileDefinitionsFromRuntime,
    getEntityAssetUrl,
    getTileAssetUrl,
    normalizeEntityKind,
    normalizeTileKind
  } = await import(`../../lib/game-assets.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`);

  const boardEl = document.getElementById("gameBoard");
  const mapEl = document.getElementById("gameBoardMap");
  const stageEl = document.getElementById("gameBoardStage");
  const arrowLayerEl = document.getElementById("gameBoardArrowLayer");
  const cancelSelectionBtn = document.getElementById("cancelSelectionBtn");
  const performActionBtn = document.getElementById("performActionBtn");
  const roomApi = createDefaultRoomApiClient();
  const session = window.__GAME_SESSION__ || createFallbackSession();
  const gameWasmScriptUrl = `/assets/game-wasm/wwwroot/js/game-runtime.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`;
  const setNavMessage = typeof context.setNavMessage === "function" ? context.setNavMessage : () => {};
  const state = {
    session,
    activePlayerId: session.currentPlayerId ?? session.activePlayerId ?? session.players?.[0]?.id ?? null,
    activePlayerName: session.currentPlayerName ?? session.players?.[0]?.name ?? "Player A",
    selectedSource: null,
    pendingTarget: null,
    isSubmitting: false,
    isRuntimeReady: false,
    feedback: "",
    zoomScale: 1,
    panX: 0,
    panY: 0,
    pinchStartDistance: null,
    pinchStartScale: 1,
    gestureStartMidpoint: null,
    gestureStartPanX: 0,
    gestureStartPanY: 0,
    activeTouchPoints: new Map(),
    boardWidth: 19,
    boardHeight: 19
  };

  const layoutResizeObserver = typeof ResizeObserver !== "undefined" && stageEl
    ? new ResizeObserver(() => {
        fitBoardToStage(state.boardWidth, state.boardHeight);
        centerCameraOnActivePlayer(state.session);
      })
    : null;

  if (layoutResizeObserver && stageEl) {
    layoutResizeObserver.observe(stageEl);
  }

  void ensureGameWasmHydrated().catch(() => undefined);

  const handleBoardClick = (event) => {
    const cell = event.target.closest?.(".game-board-cell");
    if (!cell || !boardEl?.contains(cell)) {
      return;
    }

    const x = Number.parseInt(cell.dataset.x || "", 10);
    const y = Number.parseInt(cell.dataset.y || "", 10);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return;
    }

    const entityKind = cell.dataset.entityKind || "";
    const entityId = cell.dataset.entityId || null;

    if (entityKind === "player" && isActivePlayerCell(entityId, x, y)) {
      if (state.selectedSource && state.selectedSource.x === x && state.selectedSource.y === y && !state.pendingTarget) {
        clearSelection();
        return;
      }

      state.selectedSource = {
        x,
        y,
        entityId,
        name: cell.dataset.entityName || state.activePlayerName,
        colorHex: cell.dataset.entityColorHex || null
      };
      state.pendingTarget = null;
      state.feedback = "";
      renderBoard(state.session);
      syncHud();
      return;
    }

    if (!state.selectedSource) {
      return;
    }

    state.pendingTarget = { x, y };
    state.feedback = "";
    renderBoard(state.session);
    syncHud();
  };

  const handlePerformAction = async () => {
    if (!state.selectedSource || !state.pendingTarget || state.isSubmitting) {
      return;
    }

    state.isSubmitting = true;
    state.feedback = "Validating action...";
    syncHud();

    try {
      const wasm = await ensureGameWasmRuntime().catch(() => null);
      if (!wasm) {
        throw new Error("GameWasm bridge is unavailable.");
      }

      const payload = await wasm.applyAction({
        actionName: "move",
        sourceX: state.selectedSource.x,
        sourceY: state.selectedSource.y,
        targetX: state.pendingTarget.x,
        targetY: state.pendingTarget.y
      });

      if (!payload?.success) {
        throw new Error(payload?.message || "Action failed.");
      }

      if (payload?.snapshot) {
        state.session = payload.snapshot;
        window.__GAME_SESSION__ = payload.snapshot;
        state.activePlayerId = payload.snapshot.currentPlayerId ?? payload.snapshot.activePlayerId ?? state.activePlayerId;
        state.activePlayerName = payload.snapshot.currentPlayerName ?? payload.snapshot.activePlayerName ?? state.activePlayerName;
      }
      clearSelection();
      state.feedback = payload?.message || "Move resolved by WASM runtime.";
      renderBoard(state.session);
      syncHud();
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : "Action failed.";
      syncHud();
    } finally {
      state.isSubmitting = false;
      syncHud();
    }
  };

  const handleCancelSelection = () => {
    if (!state.selectedSource && !state.pendingTarget) {
      return;
    }

    clearSelection();
    state.feedback = "";
    renderBoard(state.session);
    syncHud();
  };

  const handleMapTouchStart = (event) => {
    if (!boardEl || !event.target || !boardEl.contains(event.target)) {
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
    syncHud();
  };

  const handleMapTouchMove = (event) => {
    if (!boardEl || !boardEl.contains(event.target)) {
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
    }

    if (nextPanX !== state.panX || nextPanY !== state.panY) {
      state.panX = nextPanX;
      state.panY = nextPanY;
    }

    syncZoom();

    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handleMapTouchEnd = (event) => {
    for (const touch of Array.from(event.changedTouches || [])) {
      state.activeTouchPoints.delete(touch.identifier);
    }

    if (state.activeTouchPoints.size < 2) {
      state.pinchStartDistance = null;
      state.pinchStartScale = state.zoomScale;
      state.gestureStartMidpoint = null;
    }
  };

  const handleMapTouchCancel = (event) => {
    handleMapTouchEnd(event);
  };

  renderBoard(session);
  syncZoom();
  syncHud();

  boardEl?.addEventListener("click", handleBoardClick);
  cancelSelectionBtn?.addEventListener("click", handleCancelSelection);
  performActionBtn?.addEventListener("click", handlePerformAction);
  boardEl?.addEventListener("touchstart", handleMapTouchStart, { passive: false });
  boardEl?.addEventListener("touchmove", handleMapTouchMove, { passive: false });
  boardEl?.addEventListener("touchend", handleMapTouchEnd, { passive: false });
  boardEl?.addEventListener("touchcancel", handleMapTouchCancel, { passive: false });

  return {
    dispose() {
      boardEl?.removeEventListener("click", handleBoardClick);
      cancelSelectionBtn?.removeEventListener("click", handleCancelSelection);
      performActionBtn?.removeEventListener("click", handlePerformAction);
      boardEl?.removeEventListener("touchstart", handleMapTouchStart);
      boardEl?.removeEventListener("touchmove", handleMapTouchMove);
      boardEl?.removeEventListener("touchend", handleMapTouchEnd);
      boardEl?.removeEventListener("touchcancel", handleMapTouchCancel);
      layoutResizeObserver?.disconnect();
      setNavMessage("");
    }
  };

  function createFallbackSession() {
    return {
      boardWidth: 19,
      boardHeight: 19,
      board: [],
      players: []
    };
  }

  async function ensureGameWasmRuntime() {
    if (window.GameWasm?.ready) {
      return window.GameWasm.ready.then(() => window.GameWasm);
    }

    if (!gameWasmLoadPromise) {
      gameWasmLoadPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[data-game-wasm-runtime="true"]`);
        if (existingScript && window.GameWasm) {
          resolve(window.GameWasm);
          return;
        }

        const script = document.createElement("script");
        script.type = "module";
        script.src = gameWasmScriptUrl;
        script.dataset.gameWasmRuntime = "true";
        script.addEventListener("load", () => {
          if (!window.GameWasm?.ready) {
            reject(new Error("GameWasm bridge did not initialize."));
            return;
          }

          window.GameWasm.ready.then(() => resolve(window.GameWasm)).catch(reject);
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("Failed to load GameWasm bridge.")), { once: true });
        document.head.appendChild(script);
      });
    }

    return gameWasmLoadPromise;
  }

  async function ensureGameWasmHydrated() {
    try {
      const wasm = await ensureGameWasmRuntime();
      const bootstrapSession = state.session || window.__GAME_SESSION__ || null;
      const participants = Array.isArray(bootstrapSession?.players)
        ? bootstrapSession.players.map((player) => ({
            name: player.name || "Player",
            type: player.type || "player",
            colorHex: player.colorHex || null,
            isBot: player.type === "bot",
            role: player.role || "player"
          }))
        : [];
      const monsterCount = Array.isArray(bootstrapSession?.board)
        ? bootstrapSession.board.filter((cell) => cell?.entityKind === "monster").length
        : 9;
        const hasParticipants = participants.length > 0;
      const [runtimeState, runtimeTileDefinitions] = await Promise.all([
          typeof wasm.startGame === "function" && hasParticipants
          ? wasm.startGame({
              boardSize: Number.isInteger(bootstrapSession?.boardWidth) ? bootstrapSession.boardWidth : 19,
              monsterCount,
              participants
            })
          : wasm.getState(),
        typeof wasm.getTileDefinitions === "function" ? wasm.getTileDefinitions() : Promise.resolve(null)
      ]);
      const runtimeSnapshot = runtimeState?.snapshot || runtimeState;

      if (runtimeTileDefinitions) {
        applyTileDefinitionsFromRuntime(runtimeTileDefinitions);
      }

      if (runtimeSnapshot?.board) {
        state.isRuntimeReady = true;
        state.session = runtimeSnapshot;
        window.__GAME_SESSION__ = runtimeSnapshot;
        state.activePlayerId = runtimeSnapshot.currentPlayerId ?? runtimeSnapshot.activePlayerId ?? state.activePlayerId;
        state.activePlayerName = runtimeSnapshot.currentPlayerName ?? runtimeSnapshot.activePlayerName ?? state.activePlayerName;
        renderBoard(state.session);
        syncHud();
      }
    } catch {
      state.isRuntimeReady = false;
      state.feedback = "Game runtime is still loading.";
      syncHud();
    }
  }

  function renderBoard(currentSession) {
    if (!boardEl || !arrowLayerEl) {
      return;
    }

    const cells = Array.isArray(currentSession?.board) ? currentSession.board : [];
    const width = Number.isInteger(currentSession?.boardWidth) && currentSession.boardWidth > 0
      ? currentSession.boardWidth
      : 19;
    const height = Number.isInteger(currentSession?.boardHeight) && currentSession.boardHeight > 0
      ? currentSession.boardHeight
      : 19;

    state.boardWidth = width;
    state.boardHeight = height;

    boardEl.style.gridTemplateColumns = `repeat(${width}, var(--game-cell-size))`;
    boardEl.style.gridTemplateRows = `repeat(${height}, var(--game-cell-size))`;
    fitBoardToStage(width, height);
    boardEl.innerHTML = "";
    arrowLayerEl.innerHTML = "";

    cells.forEach((cell) => {
      const tileKind = normalizeTileKind(cell.tileKind || cell.kind || cell.terrainKind);
      const entityKind = normalizeEntityKind(cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind);
      const hasEntity = Boolean(cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind);
      const tileOrientation = Number.isInteger(cell.tileOrientation)
        ? cell.tileOrientation
        : Number.isInteger(cell.orientation)
          ? cell.orientation
          : 0;
      const entityId = cell.entityId ?? cell.occupantId ?? cell.playerId ?? null;

      const tile = document.createElement("div");
      tile.className = "game-board-cell";
      tile.setAttribute("role", "gridcell");
      tile.dataset.x = String(Number.isInteger(cell.x) ? cell.x : 0);
      tile.dataset.y = String(Number.isInteger(cell.y) ? cell.y : 0);
      tile.dataset.entityKind = hasEntity ? entityKind : "";
      if (entityId !== null && entityId !== undefined) {
        tile.dataset.entityId = String(entityId);
      }
      if (cell.entityName) {
        tile.dataset.entityName = cell.entityName;
      }
      if (cell.entityColorHex) {
        tile.dataset.entityColorHex = cell.entityColorHex;
        tile.style.setProperty("--entity-color", cell.entityColorHex);
      }
      tile.dataset.orientation = String(tileOrientation);

      if (isActivePlayerCell(entityId, Number(cell.x), Number(cell.y))) {
        tile.classList.add("game-board-cell--active-player");
      }

      if (isSelectedSource(Number(cell.x), Number(cell.y))) {
        tile.classList.add("game-board-cell--selected-player");
      }

      if (isPendingTarget(Number(cell.x), Number(cell.y))) {
        tile.classList.add("game-board-cell--selected-target");
      }

      const terrainLayer = document.createElement("span");
      terrainLayer.className = `game-board-cell__layer game-board-cell__layer--terrain game-board-cell__layer--${tileKind}`;
      terrainLayer.style.backgroundImage = `url(${getTileAssetUrl(tileKind, tileOrientation)})`;
      tile.appendChild(terrainLayer);

      if (hasEntity) {
        const entityLayer = document.createElement("span");
        entityLayer.className = `game-board-cell__layer game-board-cell__layer--entity game-board-cell__layer--${entityKind}`;
        entityLayer.style.backgroundImage = `url(${getEntityAssetUrl(entityKind)})`;
        if (cell.entityColorHex) {
          entityLayer.style.setProperty("--entity-color", cell.entityColorHex);
        }
        tile.appendChild(entityLayer);
      }

      boardEl.appendChild(tile);
    });

    centerCameraOnActivePlayer(currentSession);
    renderArrowOverlay(width, height);
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
    if (!boardEl || !stageEl || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
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

    boardEl.style.setProperty("--game-cell-size", `${nextCellSize}px`);
  }

  function centerCameraOnActivePlayer(currentSession) {
    if (!boardEl || !stageEl || !mapEl) {
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
    const targetX = (targetCell.x + 0.5) * cellSize;
    const targetY = (targetCell.y + 0.5) * cellSize;

    state.panX = (paddingLeft + (contentWidth / 2)) - centeredLeft - (targetX * state.zoomScale);
    state.panY = (paddingTop + (contentHeight / 2)) - centeredTop - (targetY * state.zoomScale);
    syncZoom();
  }

  function getBoardCellSize() {
    const rawValue = boardEl?.style.getPropertyValue("--game-cell-size") || "";
    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
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

  function renderArrowOverlay(width, height) {
    if (!arrowLayerEl) {
      return;
    }

    arrowLayerEl.innerHTML = "";
    if (!state.selectedSource || !state.pendingTarget) {
      return;
    }

    arrowLayerEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    arrowLayerEl.setAttribute("preserveAspectRatio", "none");

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "game-board-arrow-head");
    marker.setAttribute("markerWidth", "2");
    marker.setAttribute("markerHeight", "2");
    marker.setAttribute("refX", "1.4");
    marker.setAttribute("refY", "1");
    marker.setAttribute("orient", "auto-start-reverse");
    marker.setAttribute("markerUnits", "strokeWidth");

    const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    markerPath.setAttribute("d", "M 0 0 L 2 1 L 0 2 z");
    markerPath.setAttribute("fill", state.selectedSource.colorHex || "#285c77");
    marker.appendChild(markerPath);
    defs.appendChild(marker);
    arrowLayerEl.appendChild(defs);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", (state.selectedSource.x + 0.5).toString());
    line.setAttribute("y1", (state.selectedSource.y + 0.5).toString());
    line.setAttribute("x2", (state.pendingTarget.x + 0.5).toString());
    line.setAttribute("y2", (state.pendingTarget.y + 0.5).toString());
    line.setAttribute("stroke", state.selectedSource.colorHex || "#285c77");
    line.setAttribute("stroke-width", "0.14");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-dasharray", "0.28 0.18");
    line.setAttribute("marker-end", "url(#game-board-arrow-head)");
    line.style.filter = "drop-shadow(0 0.08rem 0.12rem rgba(18, 53, 75, 0.22))";
    arrowLayerEl.appendChild(line);
  }

  function syncHud() {
    const statusMessage = state.feedback
      || (!state.selectedSource
        ? `Click ${state.activePlayerName} to select it.`
        : !state.pendingTarget
          ? `Selected ${state.activePlayerName}. Click a tile to queue movement.`
          : `Queued move to (${state.pendingTarget.x}, ${state.pendingTarget.y}). Backend validates on action.`);

    setNavMessage(statusMessage);

    if (cancelSelectionBtn) {
      cancelSelectionBtn.disabled = !state.selectedSource && !state.pendingTarget;
    }

    if (performActionBtn) {
      performActionBtn.disabled = !state.selectedSource || !state.pendingTarget || state.isSubmitting;
      performActionBtn.textContent = state.isSubmitting ? "Sending..." : "Confirm Move";
    }
  }

  function clearSelection() {
    state.selectedSource = null;
    state.pendingTarget = null;
  }

  function isActivePlayerCell(entityId) {
    if (entityId === null || entityId === undefined || state.activePlayerId === null || state.activePlayerId === undefined) {
      return false;
    }

    return String(entityId) === String(state.activePlayerId);
  }

  function isSelectedSource(x, y) {
    return Boolean(state.selectedSource && state.selectedSource.x === x && state.selectedSource.y === y);
  }

  function isPendingTarget(x, y) {
    return Boolean(state.pendingTarget && state.pendingTarget.x === x && state.pendingTarget.y === y);
  }

  function getPointerDistance(firstPoint, secondPoint) {
    return Math.hypot(firstPoint.clientX - secondPoint.clientX, firstPoint.clientY - secondPoint.clientY);
  }

  function getPointerMidpoint(firstPoint, secondPoint) {
    return {
      clientX: (firstPoint.clientX + secondPoint.clientX) / 2,
      clientY: (firstPoint.clientY + secondPoint.clientY) / 2
    };
  }

  function getTouchPoint(touch) {
    return {
      clientX: touch.clientX,
      clientY: touch.clientY
    };
  }

  function clampScale(scale) {
    return Math.min(2.75, Math.max(0.7, scale));
  }
}
