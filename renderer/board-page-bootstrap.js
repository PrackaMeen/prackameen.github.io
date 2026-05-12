export function createBoardPageBootstrap({
  canvasEl,
  stageEl,
  boardViewport,
  boardHud,
  gameBoardCanvas,
  gameBoardOverlayCanvas = null,
  boardEngineAdapter,
  state,
  renderBoard,
  onBoardClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  setNavMessage
}) {
  let suppressNextClick = false;

  renderBoard(state.session);
  boardViewport.syncZoom();
  boardHud.syncHud();
  void boardEngineAdapter?.initialize?.().catch(() => undefined);

  canvasEl?.addEventListener("click", handleCanvasClick, true);
  canvasEl?.addEventListener("touchstart", onTouchStart, { passive: false });
  canvasEl?.addEventListener("touchmove", onTouchMove, { passive: false });
  canvasEl?.addEventListener("touchend", handleTouchEnd, { passive: false });
  canvasEl?.addEventListener("touchcancel", handleTouchCancel, { passive: false });

  return {
    dispose() {
      canvasEl?.removeEventListener("click", handleCanvasClick, true);
      canvasEl?.removeEventListener("touchstart", onTouchStart);
      canvasEl?.removeEventListener("touchmove", onTouchMove);
      canvasEl?.removeEventListener("touchend", handleTouchEnd);
      canvasEl?.removeEventListener("touchcancel", handleTouchCancel);
      gameBoardCanvas.dispose();
      gameBoardOverlayCanvas?.dispose?.();
      boardEngineAdapter?.dispose?.();
      setNavMessage("");
    }
  };

  function handleCanvasClick(event) {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }

    onBoardClick?.(event);
  }

  function handleTouchEnd(event) {
    const result = onTouchEnd?.(event);
    if (result?.kind === "tap") {
      suppressNextClick = true;
      onBoardClick?.({
        clientX: result.point.clientX,
        clientY: result.point.clientY
      });
      return;
    }

    if (result) {
      suppressNextClick = true;
    }
  }

  function handleTouchCancel(event) {
    const result = onTouchCancel?.(event);
    if (result) {
      suppressNextClick = true;
    }
  }
}