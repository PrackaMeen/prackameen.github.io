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
        boardViewport.centerCameraOnActivePlayer(state.session);
      })
    : null;

  if (layoutResizeObserver && stageEl) {
    layoutResizeObserver.observe(stageEl);
  }

  renderBoard(state.session);
  boardViewport.syncZoom();
  boardHud.syncHud();

  canvasEl?.addEventListener("click", onBoardClick);
  canvasEl?.addEventListener("touchstart", onTouchStart, { passive: false });
  canvasEl?.addEventListener("touchmove", onTouchMove, { passive: false });
  canvasEl?.addEventListener("touchend", onTouchEnd, { passive: false });
  canvasEl?.addEventListener("touchcancel", onTouchCancel, { passive: false });

  return {
    dispose() {
      canvasEl?.removeEventListener("click", onBoardClick);
      canvasEl?.removeEventListener("touchstart", onTouchStart);
      canvasEl?.removeEventListener("touchmove", onTouchMove);
      canvasEl?.removeEventListener("touchend", onTouchEnd);
      canvasEl?.removeEventListener("touchcancel", onTouchCancel);
      layoutResizeObserver?.disconnect();
      gameBoardCanvas.dispose();
      gameBoardOverlayCanvas.dispose();
      setNavMessage("");
    }
  };
}