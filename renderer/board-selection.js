export function areOrthogonallyAdjacent(source, target) {
  if (!Number.isInteger(source?.x) || !Number.isInteger(source?.y) || !Number.isInteger(target?.x) || !Number.isInteger(target?.y)) {
    return false;
  }

  return Math.abs(source.x - target.x) + Math.abs(source.y - target.y) === 1;
}

export function classifyTargetPreview({
  currentSession,
  source,
  target,
  isTileRevealed,
  getBoardCell,
  canTraverseBetweenCells,
  isTargetEngaged
}) {
  const fromCell = getBoardCell(currentSession, source?.x, source?.y);
  const toCell = getBoardCell(currentSession, target?.x, target?.y);

  if (!fromCell) {
    return { tone: 'red', color: '#b91c1c', message: 'Movement is not possible.' };
  }

  if (!areOrthogonallyAdjacent(source, target)) {
    return { tone: 'red', color: '#b91c1c', message: 'Movement is not possible.' };
  }

  if (!toCell) {
    return { tone: 'red', color: '#b91c1c', message: 'Movement is not possible.' };
  }

  if (!isTileRevealed(currentSession, target?.x, target?.y)) {
    if (!canTraverseBetweenCells(fromCell, {...toCell, tileKind: 'road4' },)) {
      return { tone: 'red', color: '#b91c1c', message: 'Movement is blocked by walls.' };
    }

    return { tone: 'green', color: '#14532d', message: 'Hidden tile preview.' };
  }

  if (!canTraverseBetweenCells(fromCell, toCell)) {
    return { tone: 'red', color: '#b91c1c', message: 'Movement is blocked by walls.' };
  }

  if (isTargetEngaged(currentSession, toCell)) {
    return { tone: 'blue', color: '#1d4ed8', message: 'This tile will trigger an attack.' };
  }

  return { tone: 'green', color: '#14532d', message: 'Movement is available.' };
}