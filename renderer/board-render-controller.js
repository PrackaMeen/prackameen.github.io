export function createBoardRenderController({
  state,
  mapEl,
  boardViewport,
  gameBoardCanvas
}) {
  return {
    renderBoard
  };

  function renderBoard(currentSession) {
    if (!mapEl) {
      return;
    }

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
      gameBoardCanvas.render(currentSession);
      return;
    }

    boardViewport.lockBoardCellSize(width, height);

    if (!state.hasInitialCameraCenterApplied) {
      state.hasInitialCameraCenterApplied = true;
      boardViewport.centerCameraOnActivePlayer(currentSession);
    }

    gameBoardCanvas.render(currentSession);
  }
}
