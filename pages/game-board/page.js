import { createDefaultRoomApiClient } from "../../session/RoomApiClient.js";
import { createGameBoardCanvas } from "../../renderer/game-board-canvas.js";
import { createBoardInteractionController } from "../../renderer/board-interaction-controller.js";
import { createBoardViewportController } from "../../renderer/board-viewport-controller.js";
import { createBoardHudController } from "../../renderer/board-hud-controller.js";
import { createBoardRuntimeController } from "../../renderer/board-runtime-controller.js";
import { createBoardPageBootstrap } from "../../renderer/board-page-bootstrap.js";
import { createBoardActionController } from "../../renderer/board-action-controller.js";
import { createBoardRenderController } from "../../renderer/board-render-controller.js";
import { createExcaliburBoardEngineAdapter } from "../../renderer/excalibur-board-engine-adapter.js";
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

  const mapEl = document.getElementById("gameBoardMap");
  const stageEl = document.getElementById("gameBoardStage");
  const canvasEl = document.getElementById("gameBoardCanvas");
  const actionBarEl = document.querySelector(".game-board-action-bar");
  const roomApi = createDefaultRoomApiClient();
  const session = window.__GAME_SESSION__ || null;
  const gameWasmScriptUrl = `/assets/game-wasm/wwwroot/js/game-runtime.js?v=${encodeURIComponent(context.appBuildId || context.appVersion || "latest")}`;
  const setNavMessage = typeof context.setNavMessage === "function" ? context.setNavMessage : () => {};
  let boardHud = null;
  let boardRuntime = null;
  let boardAction = null;
  const boardEngineAdapter = createExcaliburBoardEngineAdapter({
    mapEl,
    canvasEl
  });
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
    boardOriginY: 0,
    lockedBoardCellSize: null,
    hasInitialCameraCenterApplied: false
  };
  window.__GAME_BOARD_STATE__ = state;
  const gameBoardCanvas = createGameBoardCanvas({
    canvasEl,
    mapEl,
    getSession: () => state.session,
    getActivePlayerId: () => state.activePlayerId,
    getSelectedSource: () => state.selectedSource,
    getPendingTarget: () => state.pendingTarget,
    getSelectionPreviewTone: () => state.selectionPreviewTone,
    getCellSize: () => boardViewport.getBoardCellSize(),
    getViewportTransform: () => ({
      scale: state.zoomScale,
      panX: state.panX,
      panY: state.panY
    }),
    getTileSpriteSheetSource,
    getEntitySpriteSheetSource,
    normalizeTileKind,
    normalizeEntityKind,
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
    isCameraCentered: () => boardViewport.isCameraCenteredOnActivePlayer(state.session),
    onCenterCamera: () => boardViewport.centerCameraOnActivePlayer(state.session),
    getWorldPointFromPointer: (event) => {
      const engine = gameBoardCanvas.getEngine?.();
      const ex = globalThis.window?.ex;
      if (!engine || !ex?.vec || !event) {
        return null;
      }

      return engine.screen?.pageToWorldCoordinates?.(ex.vec(event.clientX, event.clientY)) ?? null;
    },
    onConfirmSelection: () => void boardAction?.handlePerformAction(),
    onBoardStateChanged: () => {
      renderBoard(state.session);
      boardHud?.syncHud();
    },
    onSelectionChanged: () => {
      gameBoardCanvas.render(state.session);
    }
  });
  const boardViewport = createBoardViewportController({
    state,
    mapEl,
    stageEl,
    canvasEl,
    onZoomChanged: () => {
      gameBoardCanvas.syncCamera(
        { scale: state.zoomScale, panX: state.panX, panY: state.panY },
        canvasEl?.width,
        canvasEl?.height
      );
      gameBoardCanvas.render(state.session);
      boardHud?.syncHud();
    },
    onViewportChanged: () => {
      gameBoardCanvas.syncCamera(
        { scale: state.zoomScale, panX: state.panX, panY: state.panY },
        canvasEl?.width,
        canvasEl?.height
      );
      gameBoardCanvas.render(state.session);
      boardHud?.syncHud();
    },
    onBoardStateChanged: () => {
      boardHud?.syncHud();
    }
  });
  const boardRenderer = createBoardRenderController({
    state,
    mapEl,
    boardViewport,
    gameBoardCanvas
  });
  const { renderBoard } = boardRenderer;
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
    getTileSpriteSheetSource,
    isCameraCentered: () => boardViewport.isCameraCenteredOnActivePlayer(state.session),
    onCenterCamera: () => boardViewport.centerCameraOnActivePlayer(state.session),
    onPerformAction: () => void boardAction?.handlePerformAction(),
    onCancelSelection: () => void boardAction?.handleCancelSelection(),
    onRotatePlacement: (delta) => void boardAction?.handleRotatePlacement(delta)
  });

  boardAction = createBoardActionController({
    state,
    boardRuntime,
    boardViewport,
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
    state,
    renderBoard,
    onBoardClick: handleBoardClick,
    onTouchStart: handleMapTouchStart,
    onTouchMove: handleMapTouchMove,
    onTouchEnd: handleMapTouchEnd,
    onTouchCancel: handleMapTouchCancel,
    boardEngineAdapter,
    setNavMessage
  });

  return {
    dispose() {
      boardBootstrap.dispose();
      if (window.__GAME_BOARD_STATE__ === state) {
        delete window.__GAME_BOARD_STATE__;
      }
    }
  };
}
