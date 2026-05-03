export function createBoardActionController({
  state,
  boardRuntime,
  boardHud,
  boardInteraction,
  renderBoard,
  isTileRevealed
}) {
  return {
    handlePerformAction,
    handleRotatePlacement,
    handleCancelSelection,
    cancelPendingPlacement
  };

  async function handlePerformAction() {
    if (state.isSubmitting) {
      return;
    }

    const placement = state.pendingPlacement || state.session?.pendingPlacement || null;
    const hasQueuedSelection = state.selectedSource && state.pendingTarget;
    if (!placement && !hasQueuedSelection) {
      return;
    }

    state.isSubmitting = true;
    state.feedback = placement ? "Committing tile placement..." : "Validating action...";
    boardHud.syncHud();

    try {
      const wasm = await boardRuntime.ensureGameWasmRuntime().catch(() => null);
      if (!wasm) {
        throw new Error("GameWasm bridge is unavailable.");
      }

      const request = placement
        ? {
            actionName: "commit_placement",
            sourceX: placement.sourceX,
            sourceY: placement.sourceY,
            targetX: placement.targetX,
            targetY: placement.targetY
          }
        : {
            actionName: isTileRevealed(state.session, state.pendingTarget.x, state.pendingTarget.y)
              ? "move"
              : "discover",
            sourceX: state.selectedSource.x,
            sourceY: state.selectedSource.y,
            targetX: state.pendingTarget.x,
            targetY: state.pendingTarget.y
          };

      const payload = await wasm.applyAction(request);

      if (!payload?.success) {
        throw new Error(payload?.message || "Action failed.");
      }

      if (payload?.snapshot) {
        state.session = payload.snapshot;
        window.__GAME_SESSION__ = payload.snapshot;
        state.activePlayerId = payload.snapshot.currentPlayerId ?? payload.snapshot.activePlayerId ?? state.activePlayerId;
        state.activePlayerName = payload.snapshot.currentPlayerName ?? payload.snapshot.activePlayerName ?? state.activePlayerName;
        updateActivePlayerOrientation(request);
      }

      boardInteraction.clearSelection();
      state.feedback = request.actionName === "discover"
        ? "Tile placed. Rotate it to continue."
        : payload?.message || "Move resolved by WASM runtime.";
      renderBoard(state.session);
      boardHud.syncHud();
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : "Action failed.";
      boardHud.syncHud();
    } finally {
      state.isSubmitting = false;
      boardHud.syncHud();
    }
  }

  async function handleRotatePlacement(delta) {
    if (!state.pendingPlacement || state.isSubmitting) {
      return;
    }

    state.isSubmitting = true;
    state.feedback = delta < 0 ? "Rotating tile left..." : "Rotating tile right...";
    boardHud.syncHud();

    try {
      const wasm = await boardRuntime.ensureGameWasmRuntime().catch(() => null);
      if (!wasm) {
        throw new Error("GameWasm bridge is unavailable.");
      }

      const payload = await wasm.applyAction({
        actionName: "rotate_placement",
        rotationDelta: delta
      });

      if (!payload?.success) {
        throw new Error(payload?.message || "Rotation failed.");
      }

      if (payload?.snapshot) {
        state.session = payload.snapshot;
        window.__GAME_SESSION__ = payload.snapshot;
        state.activePlayerId = payload.snapshot.currentPlayerId ?? payload.snapshot.activePlayerId ?? state.activePlayerId;
        state.activePlayerName = payload.snapshot.currentPlayerName ?? payload.snapshot.activePlayerName ?? state.activePlayerName;
        updateActivePlayerOrientation(request);
      }

      boardInteraction.clearSelection();
      state.feedback = payload?.message || "Tile rotated.";
      renderBoard(state.session);
      boardHud.syncHud();
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : "Rotation failed.";
      boardHud.syncHud();
    } finally {
      state.isSubmitting = false;
      boardHud.syncHud();
    }
  }

  async function cancelPendingPlacement() {
    if (!state.pendingPlacement || state.isSubmitting) {
      return;
    }

    state.isSubmitting = true;
    state.feedback = "Canceling tile placement...";
    boardHud.syncHud();

    try {
      const wasm = await boardRuntime.ensureGameWasmRuntime().catch(() => null);
      if (!wasm) {
        throw new Error("GameWasm bridge is unavailable.");
      }

      const payload = await wasm.applyAction({
        actionName: "cancel_placement"
      });

      if (!payload?.success) {
        throw new Error(payload?.message || "Cancel failed.");
      }

      if (payload?.snapshot) {
        state.session = payload.snapshot;
        window.__GAME_SESSION__ = payload.snapshot;
        state.activePlayerId = payload.snapshot.currentPlayerId ?? payload.snapshot.activePlayerId ?? state.activePlayerId;
        state.activePlayerName = payload.snapshot.currentPlayerName ?? payload.snapshot.activePlayerName ?? state.activePlayerName;
      }

      boardInteraction.clearSelection();
      state.feedback = payload?.message || "Tile placement canceled.";
      renderBoard(state.session);
      boardHud.syncHud();
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : "Cancel failed.";
      boardHud.syncHud();
    } finally {
      state.isSubmitting = false;
      boardHud.syncHud();
    }
  }

  function updateActivePlayerOrientation(request) {
    if (!state.entityOrientations || state.activePlayerId === null || state.activePlayerId === undefined) {
      return;
    }

    if (request.actionName !== "move" && request.actionName !== "commit_placement") {
      return;
    }

    if (!Number.isInteger(request.sourceX) || !Number.isInteger(request.sourceY) || !Number.isInteger(request.targetX) || !Number.isInteger(request.targetY)) {
      return;
    }

    const dx = request.targetX - request.sourceX;
    const dy = request.targetY - request.sourceY;
    let orientation = 0;

    if (Math.abs(dx) >= Math.abs(dy)) {
      orientation = dx >= 0 ? 1 : 3;
    } else {
      orientation = dy >= 0 ? 2 : 0;
    }

    state.entityOrientations.set(String(state.activePlayerId), orientation);
  }

  function handleCancelSelection() {
    if (!state.selectedSource && !state.pendingTarget && !state.pendingPlacement) {
      return;
    }

    if (state.pendingPlacement) {
      void cancelPendingPlacement();
      return;
    }

    boardInteraction.clearSelection();
    state.feedback = "";
    renderBoard(state.session);
    boardHud.syncHud();
  }
}
