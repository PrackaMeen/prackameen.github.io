export function getBoardPointFromCell(cell) {
  const x = Number.parseInt(cell?.dataset?.x || "", 10);
  const y = Number.parseInt(cell?.dataset?.y || "", 10);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }

  return { x, y };
}

export function getBoardPointFromPointer({ boardRect, boardWidth, boardHeight, boardOriginX = 0, boardOriginY = 0, clientX, clientY }) {
  if (!Number.isInteger(boardWidth) || !Number.isInteger(boardHeight) || boardWidth <= 0 || boardHeight <= 0) {
    return null;
  }

  if (!Number.isFinite(boardRect?.width) || !Number.isFinite(boardRect?.height) || boardRect.width <= 0 || boardRect.height <= 0) {
    return null;
  }

  const columnSize = boardRect.width / boardWidth;
  const rowSize = boardRect.height / boardHeight;
  if (columnSize <= 0 || rowSize <= 0) {
    return null;
  }

  const offsetX = clientX - boardRect.left;
  const offsetY = clientY - boardRect.top;
  const x = boardOriginX + Math.floor(offsetX / columnSize);
  const y = boardOriginY + Math.floor(offsetY / rowSize);

  if (x < boardOriginX || y < boardOriginY || x >= boardOriginX + boardWidth || y >= boardOriginY + boardHeight) {
    return null;
  }

  return { x, y };
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