import { getEntityAssetUrl, getTileAssetUrl, normalizeEntityKind, normalizeTileKind } from "../../lib/game-assets.js";
import { buildGameStartSession } from "../../lib/game-start-session.js";
import { createDefaultRoomApiClient } from "../../session/RoomApiClient.js";

let gameWasmLoadPromise = null;

export function mountPage(context) {
  context.setTitle("Game");

  const boardEl = document.getElementById("gameBoard");
  const arrowLayerEl = document.getElementById("gameBoardArrowLayer");
  const statusEl = document.getElementById("gameBoardStatus");
  const performActionBtn = document.getElementById("performActionBtn");
  const roomApi = createDefaultRoomApiClient();
  const session = window.__GAME_SESSION__ || createFallbackSession();
  const gameWasmScriptUrl = `/assets/game-wasm/wwwroot/js/game-runtime.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`;
  const state = {
    session,
    activePlayerId: session.currentPlayerId ?? session.activePlayerId ?? session.players?.[0]?.id ?? null,
    activePlayerName: session.currentPlayerName ?? session.players?.[0]?.name ?? "Player A",
    selectedSource: null,
    pendingTarget: null,
    isSubmitting: false,
    feedback: "",
    zoomScale: 1,
    pinchStartDistance: null,
    pinchStartScale: 1,
    activeTouchPoints: new Map()
  };

  void ensureGameWasmHydrated(state.session).catch(() => undefined);

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
      let payload = null;

      if (wasm) {
        await wasm.hydrate(state.session);
        payload = await wasm.applyAction({
          actionName: "move",
          sourceX: state.selectedSource.x,
          sourceY: state.selectedSource.y,
          targetX: state.pendingTarget.x,
          targetY: state.pendingTarget.y
        });
      } else {
        const response = await fetch(`${roomApi.apiBaseUrl}/session/action`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            command: "move",
            targetX: state.pendingTarget.x,
            targetY: state.pendingTarget.y
          })
        });

        payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || payload?.error || `Action failed (${response.status})`);
        }
      }

      if (!payload?.success) {
        throw new Error(payload?.message || "Action failed.");
      }

      applyWasmSnapshotToSession(state.session, payload.snapshot);
      window.__GAME_SESSION__ = state.session;
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

    state.pinchStartDistance = getPointerDistance(points[0], points[1]);
    state.pinchStartScale = state.zoomScale;
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

    const currentDistance = getPointerDistance(points[0], points[1]);
    if (currentDistance <= 0) {
      return;
    }

    const nextScale = clampScale(state.pinchStartScale * (currentDistance / state.pinchStartDistance));
    if (nextScale === state.zoomScale) {
      return;
    }

    state.zoomScale = nextScale;
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
    }
  };

  const handleMapTouchCancel = (event) => {
    handleMapTouchEnd(event);
  };

  renderBoard(session);
  syncZoom();
  syncHud();

  boardEl?.addEventListener("click", handleBoardClick);
  performActionBtn?.addEventListener("click", handlePerformAction);
  boardEl?.addEventListener("touchstart", handleMapTouchStart, { passive: false });
  boardEl?.addEventListener("touchmove", handleMapTouchMove, { passive: false });
  boardEl?.addEventListener("touchend", handleMapTouchEnd, { passive: false });
  boardEl?.addEventListener("touchcancel", handleMapTouchCancel, { passive: false });

  return {
    dispose() {
      boardEl?.removeEventListener("click", handleBoardClick);
      performActionBtn?.removeEventListener("click", handlePerformAction);
      boardEl?.removeEventListener("touchstart", handleMapTouchStart);
      boardEl?.removeEventListener("touchmove", handleMapTouchMove);
      boardEl?.removeEventListener("touchend", handleMapTouchEnd);
      boardEl?.removeEventListener("touchcancel", handleMapTouchCancel);
    }
  };

  function createFallbackSession() {
    return buildGameStartSession([]);
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

  async function ensureGameWasmHydrated(currentSession) {
    try {
      const wasm = await ensureGameWasmRuntime();
      await wasm.hydrate(currentSession);
    } catch {
      // Keep the page usable if the runtime assets are unavailable.
    }
  }

  function applyWasmSnapshotToSession(currentSession, snapshot) {
    if (!currentSession || !Array.isArray(currentSession.board)) {
      return;
    }

    if (!snapshot || !Array.isArray(snapshot.characters)) {
      return;
    }

    const boardByCoordinate = new Map(
      currentSession.board.map((cell) => [`${Number(cell.x)},${Number(cell.y)}`, cell])
    );

    for (const character of snapshot.characters) {
      if (!character || !Number.isInteger(character.id)) {
        continue;
      }

      const nextPositionKey = `${character.x},${character.y}`;
      const nextCell = boardByCoordinate.get(nextPositionKey);
      if (!nextCell) {
        continue;
      }

      const currentCell = currentSession.board.find((cell) => String(cell.entityId) === String(character.id));
      if (currentCell && currentCell !== nextCell) {
        ["entityKind", "entityId", "entityName", "entityColorHex", "occupantId", "occupantName", "occupantAlive"].forEach((key) => {
          delete currentCell[key];
        });
      }

      nextCell.entityKind = "player";
      nextCell.entityId = character.id;
      nextCell.entityName = character.name || `Player ${character.id}`;
      nextCell.entityColorHex = nextCell.entityColorHex || null;
      nextCell.occupantId = character.id;
      nextCell.occupantName = character.name || `Player ${character.id}`;
      nextCell.occupantAlive = Boolean(character.isAlive);
    }

    if (Array.isArray(currentSession.players)) {
      for (const player of currentSession.players) {
        const matchingCharacter = snapshot.characters.find((character) => String(character.id) === String(player.id));
        if (!matchingCharacter) {
          continue;
        }

        player.position = { x: matchingCharacter.x, y: matchingCharacter.y };
      }
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

    boardEl.style.gridTemplateColumns = `repeat(${width}, var(--game-cell-size))`;
    boardEl.style.gridTemplateRows = `repeat(${height}, var(--game-cell-size))`;
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

    boardEl.style.setProperty("--game-cell-scale", String(state.zoomScale));
    renderArrowOverlay(width, height);
  }

  function syncZoom() {
    if (!boardEl) {
      return;
    }

    boardEl.style.setProperty("--game-cell-scale", String(state.zoomScale));
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
    if (statusEl) {
      if (state.feedback) {
        statusEl.textContent = state.feedback;
      } else if (!state.selectedSource) {
        statusEl.textContent = `Click ${state.activePlayerName} to select it.`;
      } else if (!state.pendingTarget) {
        statusEl.textContent = `Selected ${state.activePlayerName}. Click a tile to queue movement.`;
      } else {
        statusEl.textContent = `Queued move to (${state.pendingTarget.x}, ${state.pendingTarget.y}). Backend validates on action.`;
      }
    }

    if (performActionBtn) {
      performActionBtn.disabled = !state.selectedSource || !state.pendingTarget || state.isSubmitting;
      performActionBtn.textContent = state.isSubmitting ? "Sending..." : "Perform Action";
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
