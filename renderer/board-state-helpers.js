export function getBoardCell(currentSession, x, y) {
  const cells = Array.isArray(currentSession?.board) ? currentSession.board : [];
  return cells.find((cell) => Number(cell?.x) === Number(x) && Number(cell?.y) === Number(y)) || null;
}

export function isTargetEngaged(currentSession, targetCell) {
  if (!targetCell) {
    return false;
  }

  const entityKind = String(targetCell.entityKind || targetCell.occupantKind || targetCell.monsterKind || targetCell.playerKind || "").toLowerCase();
  if (!entityKind) {
    return false;
  }

  return true;
}

export function isDiscoveryTracked(currentSession, boardWidth, boardHeight) {
  return Array.isArray(currentSession?.revealedTiles)
    && currentSession.revealedTiles.length > 0
    && currentSession.revealedTiles.length < boardWidth * boardHeight;
}

export function isTileRevealed(currentSession, x, y) {
  const revealedTiles = Array.isArray(currentSession?.revealedTiles) ? currentSession.revealedTiles : [];
  return revealedTiles.some((tile) => Number(tile?.x) === Number(x) && Number(tile?.y) === Number(y));
}
