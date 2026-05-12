export function getBoardPointFromCell(cell) {
  const x = Number.parseInt(cell?.dataset?.x || "", 10);
  const y = Number.parseInt(cell?.dataset?.y || "", 10);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }

  return { x, y };
}

export function getBoardPointFromPointer({
  boardRect,
  boardWidth,
  boardHeight,
  boardOriginX = 0,
  boardOriginY = 0,
  cellSize = null,
  viewportTransform = null,
  clientX,
  clientY
}) {
  if (!Number.isInteger(boardWidth) || !Number.isInteger(boardHeight) || boardWidth <= 0 || boardHeight <= 0) {
    return null;
  }

  if (!Number.isFinite(boardRect?.width) || !Number.isFinite(boardRect?.height) || boardRect.width <= 0 || boardRect.height <= 0) {
    return null;
  }

  const scale = Number.isFinite(viewportTransform?.scale) && viewportTransform.scale > 0 ? viewportTransform.scale : 1;
  const panX = Number.isFinite(viewportTransform?.panX) ? viewportTransform.panX : 0;
  const panY = Number.isFinite(viewportTransform?.panY) ? viewportTransform.panY : 0;
  const lockedCellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : null;
  const columnSize = lockedCellSize ? lockedCellSize * scale : boardRect.width / boardWidth;
  const rowSize = lockedCellSize ? lockedCellSize * scale : boardRect.height / boardHeight;
  if (columnSize <= 0 || rowSize <= 0) {
    return null;
  }

  const offsetX = clientX - boardRect.left - panX;
  const offsetY = clientY - boardRect.top - panY;
  const x = boardOriginX + Math.floor(offsetX / columnSize);
  const y = boardOriginY + Math.floor(offsetY / rowSize);

  if (x < boardOriginX || y < boardOriginY || x >= boardOriginX + boardWidth || y >= boardOriginY + boardHeight) {
    return null;
  }

  return { x, y };
}

export function getBoardPointFromWorld({
  boardWidth,
  boardHeight,
  boardOriginX = 0,
  boardOriginY = 0,
  cellSize = null,
  worldX,
  worldY
}) {
  if (!Number.isInteger(boardWidth) || !Number.isInteger(boardHeight) || boardWidth <= 0 || boardHeight <= 0) {
    return null;
  }

  const lockedCellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : null;
  if (!lockedCellSize) {
    return null;
  }

  const column = Math.floor((Number(worldX) - boardOriginX * lockedCellSize) / lockedCellSize);
  const row = Math.floor((Number(worldY) - boardOriginY * lockedCellSize) / lockedCellSize);

  if (column < 0 || row < 0 || column >= boardWidth || row >= boardHeight) {
    return null;
  }

  return {
    x: boardOriginX + column,
    y: boardOriginY + row
  };
}

export function getPointerDistance(firstPoint, secondPoint) {
  return Math.hypot(firstPoint.clientX - secondPoint.clientX, firstPoint.clientY - secondPoint.clientY);
}

export function getPointerMidpoint(firstPoint, secondPoint) {
  return {
    clientX: (firstPoint.clientX + secondPoint.clientX) / 2,
    clientY: (firstPoint.clientY + secondPoint.clientY) / 2
  };
}

export function getTouchPoint(touch) {
  return {
    clientX: touch.clientX,
    clientY: touch.clientY
  };
}

export function clampScale(scale) {
  return Math.min(2.75, Math.max(0.7, scale));
}