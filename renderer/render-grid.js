export function getCanvasSize(rect) {
  return {
    width: Math.max(1, Math.round(Number(rect?.width) || 0)),
    height: Math.max(1, Math.round(Number(rect?.height) || 0))
  };
}

export function getCellBounds({ column, row, boardOriginX = 0, boardOriginY = 0, boardWidth, boardHeight, canvasWidth, canvasHeight, cellSize = null }) {
  const cellWidth = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : canvasWidth / boardWidth;
  const cellHeight = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : canvasHeight / boardHeight;

  return {
    x: (column - boardOriginX) * cellWidth,
    y: (row - boardOriginY) * cellHeight,
    width: cellWidth,
    height: cellHeight
  };
}

export function getGridLinePositions({ boardWidth, boardHeight, canvasWidth, canvasHeight, cellSize = null }) {
  const cellWidth = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : canvasWidth / boardWidth;
  const cellHeight = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : canvasHeight / boardHeight;

  return {
    horizontal: Array.from({ length: boardHeight + 1 }, (_, row) => Math.round(row * cellHeight) + 0.5),
    vertical: Array.from({ length: boardWidth + 1 }, (_, column) => Math.round(column * cellWidth) + 0.5)
  };
}