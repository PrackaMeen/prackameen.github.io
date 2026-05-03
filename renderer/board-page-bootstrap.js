export function createBoardPageBootstrap({
  canvasEl,
  stageEl,
  boardViewport,
  boardHud,
  gameBoardCanvas,
  gameBoardOverlayCanvas,
  state,
  renderBoard,
  onBoardClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  setNavMessage
}) {
  const layoutResizeObserver = typeof ResizeObserver !== "undefined" && stageEl
    ? new ResizeObserver(() => {
        boardViewport.fitBoardToStage(state.boardWidth, state.boardHeight);
        boardViewport.resizeBoardSurface(state.boardWidth, state.boardHeight);
      })
    : null;
  let suppressNextClick = false;

  if (layoutResizeObserver && stageEl) {
    layoutResizeObserver.observe(stageEl);
  }

  renderBoard(state.session);
  boardViewport.syncZoom();
  boardHud.syncHud();

  canvasEl?.addEventListener("click", handleCanvasClick);
  canvasEl?.addEventListener("touchstart", onTouchStart, { passive: false });
  canvasEl?.addEventListener("touchmove", onTouchMove, { passive: false });
  canvasEl?.addEventListener("touchend", handleTouchEnd, { passive: false });
  canvasEl?.addEventListener("touchcancel", handleTouchCancel, { passive: false });

  return {
    dispose() {
      canvasEl?.removeEventListener("click", handleCanvasClick);
      canvasEl?.removeEventListener("touchstart", onTouchStart);
      canvasEl?.removeEventListener("touchmove", onTouchMove);
      canvasEl?.removeEventListener("touchend", handleTouchEnd);
      canvasEl?.removeEventListener("touchcancel", handleTouchCancel);
      layoutResizeObserver?.disconnect();
      gameBoardCanvas.dispose();
      gameBoardOverlayCanvas.dispose();
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