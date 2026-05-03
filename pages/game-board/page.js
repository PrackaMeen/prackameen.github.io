import { createDefaultRoomApiClient } from "../../session/RoomApiClient.js";
import { createGameBoardCanvas } from "../../renderer/game-board-canvas.js";
import { createGameBoardOverlayCanvas } from "../../renderer/game-board-overlay-canvas.js";
import { createBoardInteractionController } from "../../renderer/board-interaction-controller.js";
import { createBoardViewportController } from "../../renderer/board-viewport-controller.js";
import { createBoardHudController } from "../../renderer/board-hud-controller.js";
import { createBoardRuntimeController } from "../../renderer/board-runtime-controller.js";
import { createBoardPageBootstrap } from "../../renderer/board-page-bootstrap.js";
import { createBoardActionController } from "../../renderer/board-action-controller.js";
import { getBoardCell, isTargetEngaged, isTileRevealed } from "../../renderer/board-state-helpers.js";

export async function mountPage(context) {
  context.setTitle("Game");

  const {
    applyTileDefinitionsFromRuntime,
    getEntityAssetUrl,
    getHiddenTileAssetUrl,
    getTileAssetUrl,
    getEntitySpriteSheetSource,
    getTileSpriteSheetSource,
    getTileWalls,
    normalizeEntityKind,
    normalizeTileKind
  } = await import(`../../lib/game-assets.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`);

  const boardEl = document.getElementById("gameBoard");
  const mapEl = document.getElementById("gameBoardMap");
  const stageEl = document.getElementById("gameBoardStage");
  const canvasEl = document.getElementById("gameBoardCanvas");
  const overlayCanvasEl = document.getElementById("gameBoardOverlayCanvas");
  const actionBarEl = document.querySelector(".game-board-action-bar");
  const roomApi = createDefaultRoomApiClient();
  const session = window.__GAME_SESSION__ || null;
  const gameWasmScriptUrl = `/assets/game-wasm/wwwroot/js/game-runtime.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`;
  const setNavMessage = typeof context.setNavMessage === "function" ? context.setNavMessage : () => {};
  let boardHud = null;
  let boardRuntime = null;
  let boardAction = null;
  const state = {
    session,
    activePlayerId: session?.currentPlayerId ?? session?.activePlayerId ?? session?.players?.[0]?.id ?? null,
    activePlayerName: session?.currentPlayerName ?? session?.players?.[0]?.name ?? "Player A",
    selectedSource: null,
    pendingTarget: null,
    pendingPlacement: null,
    selectionPreviewTone: null,
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
    boardWidth: 0,
    boardHeight: 0,
    boardOriginX: 0,
    boardOriginY: 0
  };
  const gameBoardCanvas = createGameBoardCanvas({
    canvasEl,
    boardEl,
    getSession: () => state.session,
    getTileSpriteSheetSource,
    getEntitySpriteSheetSource,
    normalizeTileKind,
    normalizeEntityKind,
    isTileRevealed
  });
  const gameBoardOverlayCanvas = createGameBoardOverlayCanvas({
    canvasEl: overlayCanvasEl,
    boardEl,
    getSession: () => state.session,
    getOverlayState: () => ({
      selectedSource: state.selectedSource,
      pendingTarget: state.pendingTarget,
      pendingPlacement: state.pendingPlacement,
      selectionPreviewTone: state.selectionPreviewTone,
      boardOriginX: state.boardOriginX,
      boardOriginY: state.boardOriginY
    }),
    getHiddenTileAssetUrl,
    isTileRevealed
  });
  const boardInteraction = createBoardInteractionController({
    state,
    canvasEl,
    getBoardCell,
    getActivePlayerName: () => state.activePlayerName,
    isTileRevealed,
    getTileWalls,
    normalizeTileKind,
    isTargetEngaged,
    onBoardStateChanged: () => {
      renderBoard(state.session);
      boardHud?.syncHud();
    },
    onSelectionChanged: () => {
      gameBoardOverlayCanvas.render(state.session);
    }
  });
  const boardViewport = createBoardViewportController({
    state,
    boardEl,
    mapEl,
    stageEl,
    canvasEl,
    onZoomChanged: () => {
      gameBoardOverlayCanvas.render(state.session);
    },
    onViewportChanged: () => {
      gameBoardOverlayCanvas.render(state.session);
    },
    onBoardStateChanged: () => {
      boardHud?.syncHud();
    }
  });
  boardRuntime = createBoardRuntimeController({
    state,
    gameWasmScriptUrl,
    applyTileDefinitionsFromRuntime,
    renderBoard,
    syncHud: () => boardHud?.syncHud()
  });

  void boardRuntime.ensureGameWasmHydrated().catch(() => undefined);

  const handleBoardClick = (event) => boardInteraction.handleBoardClick(event);

  boardHud = createBoardHudController({
    state,
    actionBarEl,
    setNavMessage,
    isTileRevealed,
    getTileAssetUrl,
    onPerformAction: () => void boardAction?.handlePerformAction(),
    onCancelSelection: () => void boardAction?.handleCancelSelection(),
    onRotatePlacement: (delta) => void boardAction?.handleRotatePlacement(delta)
  });

  boardAction = createBoardActionController({
    state,
    boardRuntime,
    boardHud,
    boardInteraction,
    renderBoard,
    isTileRevealed
  });

  const handleMapTouchStart = boardViewport.handleMapTouchStart;
  const handleMapTouchMove = boardViewport.handleMapTouchMove;
  const handleMapTouchEnd = boardViewport.handleMapTouchEnd;
  const handleMapTouchCancel = boardViewport.handleMapTouchCancel;

  const boardBootstrap = createBoardPageBootstrap({
    canvasEl,
    stageEl,
    boardViewport,
    boardHud,
    gameBoardCanvas,
    gameBoardOverlayCanvas,
    state,
    renderBoard,
    onBoardClick: handleBoardClick,
    onTouchStart: handleMapTouchStart,
    onTouchMove: handleMapTouchMove,
    onTouchEnd: handleMapTouchEnd,
    onTouchCancel: handleMapTouchCancel,
    setNavMessage
  });

  return {
    dispose() {
      boardBootstrap.dispose();
    }
  };

  function renderBoard(currentSession) {
    if (!boardEl) {
      return;
    }

    const cells = Array.isArray(currentSession?.board) ? currentSession.board : [];
    const width = Number.isInteger(currentSession?.boardWidth) && currentSession.boardWidth > 0
      ? currentSession.boardWidth
      : 0;
    const height = Number.isInteger(currentSession?.boardHeight) && currentSession.boardHeight > 0
      ? currentSession.boardHeight
      : 0;
    const originX = Number.isInteger(currentSession?.boardOriginX) ? currentSession.boardOriginX : 0;
    const originY = Number.isInteger(currentSession?.boardOriginY) ? currentSession.boardOriginY : 0;

    state.boardWidth = width;
    state.boardHeight = height;
    state.boardOriginX = originX;
    state.boardOriginY = originY;
    state.pendingPlacement = currentSession?.pendingPlacement || null;

    if (state.pendingPlacement) {
      state.selectedSource = null;
      state.pendingTarget = null;
      state.selectionPreviewTone = null;
    }

    if (width <= 0 || height <= 0) {
      boardEl.innerHTML = "";
      gameBoardCanvas.render(currentSession);
      gameBoardOverlayCanvas.render(currentSession);
      return;
    }

    boardEl.style.gridTemplateColumns = `repeat(${width}, var(--game-cell-size))`;
    boardEl.style.gridTemplateRows = `repeat(${height}, var(--game-cell-size))`;
    boardViewport.fitBoardToStage(width, height);
    boardEl.innerHTML = "";

    cells.forEach((cell) => {
      const tileKind = normalizeTileKind(cell.tileKind || cell.kind || cell.terrainKind);
      const entityKind = normalizeEntityKind(cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind);
      const hasEntity = Boolean(cell.entityKind || cell.occupantKind || cell.monsterKind || cell.playerKind);
      const isRevealed = isTileRevealed(currentSession, Number(cell.x), Number(cell.y));
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
      tile.style.gridColumnStart = String(Number(cell.x) - originX + 1);
      tile.style.gridRowStart = String(Number(cell.y) - originY + 1);

      if (boardInteraction.isActivePlayerCell(entityId, state.activePlayerId)) {
        tile.classList.add("game-board-cell--active-player");
      }

      if (boardInteraction.isSelectedSource(Number(cell.x), Number(cell.y))) {
        tile.classList.add("game-board-cell--selected-player");
        boardInteraction.applySelectionAccent(tile);
      }

      if (boardInteraction.isPendingTarget(Number(cell.x), Number(cell.y))) {
        tile.classList.add("game-board-cell--selected-target");
        boardInteraction.applySelectionAccent(tile);

        if (state.selectionPreviewTone?.tone === "green" && !isTileRevealed(currentSession, Number(cell.x), Number(cell.y))) {
          tile.classList.add("game-board-cell--temporary-preview");
        }
      }

      if (state.pendingPlacement && state.pendingPlacement.targetX === Number(cell.x) && state.pendingPlacement.targetY === Number(cell.y)) {
        tile.classList.add("game-board-cell--placement-target");
        boardInteraction.applySelectionAccent(tile);
      }

      const terrainLayer = document.createElement("span");
      terrainLayer.className = `game-board-cell__layer game-board-cell__layer--terrain game-board-cell__layer--${tileKind}`;
      if (isRevealed) {
        terrainLayer.style.backgroundImage = `url(${getTileAssetUrl(tileKind, tileOrientation)})`;
      } else {
        tile.classList.add("game-board-cell--hidden-space");
      }
      tile.appendChild(terrainLayer);

      if (hasEntity && isRevealed) {
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

    gameBoardCanvas.render(currentSession);
    gameBoardOverlayCanvas.render(currentSession);
    boardViewport.centerCameraOnActivePlayer(currentSession);
  }

}
